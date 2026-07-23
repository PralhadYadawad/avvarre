#!/usr/bin/env node
// Codex Stop hook — two-phase:
//   Phase 1 (stop_hook_active=false): Log session, run gardening, remind to update .avvarre/
//   Phase 2 (stop_hook_active=true):  Allow stop
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execSync } = require('node:child_process');

function readInput(callback) {
    const chunks = [];
    process.stdin.on('data', (chunk) => chunks.push(chunk));
    process.stdin.on('end', () => {
        try {
            callback(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch {
            callback({});
        }
    });
}

readInput((input) => {
    if (input.stop_hook_active) {
        process.exit(0);
    }

    const cwd = input.cwd || process.cwd();
    const sessionId = input.sessionId || input.session_id || input.conversationId || 'unknown';
    const shortSession = sessionId.slice(0, 8);
    const transcriptPath = input.transcript_path || input.transcriptPath || '';
    const avvarreDir = path.join(cwd, '.avvarre');

    if (!fs.existsSync(avvarreDir)) {
        console.log(JSON.stringify({
            systemMessage: '[Avvarre] No .avvarre/ — run avvarre-init to set up project memory.'
        }));
        process.exit(0);
    }

    // ── State tracking ──────────────────────────────────────────────
    const stateFile = path.join(avvarreDir, '.session-state.json');
    let state = {};
    try { state = JSON.parse(fs.readFileSync(stateFile, 'utf-8')); } catch (e) {}
    const prev = state[shortSession] || {};

    // ── Developer identity ──────────────────────────────────────────
    let dev = os.userInfo().username || 'unknown';
    try {
        const gitUser = execSync('git config user.name', { cwd, timeout: 3000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
        if (gitUser) dev = gitUser;
    } catch (e) {}

    const prevLinesParsed = prev.linesParsed || 0;
    const startTime = prev.startTime || new Date().toTimeString().split(' ')[0].slice(0, 5);
    const endTime = new Date().toTimeString().split(' ')[0].slice(0, 5);
    const timeRange = startTime === endTime ? startTime : startTime + '–' + endTime;
    const prevData = prev.data || { userMsgs: [], agentSummaries: [], filesCreated: [], filesChanged: {}, commands: [] };

    // ── Parse transcript ────────────────────────────────────────────
    if (transcriptPath) {
        try {
            const raw = fs.readFileSync(transcriptPath, 'utf-8');
            const allLines = raw.split('\n').filter(Boolean);
            const newLines = allLines.slice(prevLinesParsed);

            for (const line of newLines) {
                try {
                    const entry = JSON.parse(line);
                    const entryType = entry.type || '';
                    const msg = entry.message || entry;
                    const role = msg.role || entryType;
                    const content = msg.content;

                    if (role === 'user' && content) {
                        const text = typeof content === 'string'
                            ? content
                            : Array.isArray(content)
                                ? content.filter(c => c.type === 'text').map(c => c.text).join(' ')
                                : '';
                        const isToolResult = Array.isArray(content) && content.some(c => c.type === 'tool_result');
                        if (!isToolResult && text && text.length > 5 && text.length < 500) {
                            const clean = text.replace(/<[^>]+>[^<]*<\/[^>]+>/g, '').trim();
                            if (clean.length > 5) {
                                const firstLine = clean.split('\n')[0].slice(0, 100);
                                if (!prevData.userMsgs.includes(firstLine)) {
                                    prevData.userMsgs.push(firstLine);
                                }
                            }
                        }
                    }

                    if (role === 'assistant' && Array.isArray(content)) {
                        for (const block of content) {
                            if (block.type === 'text' && block.text) {
                                const text = block.text.trim();
                                if (text.length > 20) {
                                    const firstLine = text.split('\n')
                                        .map(l => l.trim())
                                        .find(l => l.length > 20 && !l.startsWith('#') && !l.startsWith('---') && !l.startsWith('|'));
                                    if (firstLine) {
                                        const noise = /^(hi|hello|hey|sure|ok|done|yes|no|let me|i('ll| will)|here|thank|great|perfect|got it|sounds good)/i;
                                        if (!noise.test(firstLine)) {
                                            const summary = firstLine.slice(0, 120);
                                            if (!prevData.agentSummaries.includes(summary)) {
                                                prevData.agentSummaries.push(summary);
                                            }
                                        }
                                    }
                                }
                            }

                            if (block.type === 'tool_use') {
                                const tool = block.name || '';
                                const inp = block.input || {};
                                const fp = inp.file_path || inp.filePath || inp.path || '';
                                if (fp) {
                                    const rel = path.isAbsolute(fp) ? path.relative(cwd, fp).replace(/\\/g, '/') : fp;
                                    if (tool === 'Write' || tool === 'create_file') {
                                        if (!prevData.filesCreated.includes(rel)) prevData.filesCreated.push(rel);
                                    } else if (tool === 'Edit' || tool === 'replace_string_in_file' || tool === 'editFiles') {
                                        if (!prevData.filesChanged[rel]) prevData.filesChanged[rel] = [];
                                        if (inp.old_string && inp.new_string) {
                                            const oldSnip = inp.old_string.trim().split('\n')[0].slice(0, 50);
                                            const newSnip = inp.new_string.trim().split('\n')[0].slice(0, 50);
                                            if (oldSnip !== newSnip) {
                                                const diff = `\`${oldSnip}\` → \`${newSnip}\``;
                                                if (!prevData.filesChanged[rel].includes(diff)) prevData.filesChanged[rel].push(diff);
                                            }
                                        }
                                    }
                                }
                                if (tool === 'Bash' && inp.command) {
                                    const cmd = inp.command.trim().split('\n')[0].slice(0, 80);
                                    if (cmd && !cmd.startsWith('cat ') && !cmd.startsWith('echo ') && !cmd.startsWith('head ')) {
                                        if (!prevData.commands.includes(cmd)) prevData.commands.push(cmd);
                                    }
                                }
                            }
                        }
                    }
                } catch (e) {}
            }

            state[shortSession] = { linesParsed: allLines.length, startTime, data: prevData };
            const keys = Object.keys(state);
            if (keys.length > 10) {
                for (const k of keys.slice(0, keys.length - 10)) delete state[k];
            }
            try { fs.writeFileSync(stateFile, JSON.stringify(state)); } catch (e) {}
        } catch (e) {}
    }

    // ── Build session entry ─────────────────────────────────────────
    const entry = [];
    const d = prevData;

    if (d.userMsgs.length > 0) {
        const msgs = d.userMsgs.length <= 5 ? d.userMsgs : [...d.userMsgs.slice(0, 4), `(+${d.userMsgs.length - 4} more)`];
        entry.push('**Requests:** ' + msgs.join(' → '));
    }
    if (d.agentSummaries.length > 0) {
        const summaries = d.agentSummaries.length <= 5 ? d.agentSummaries : [...d.agentSummaries.slice(0, 4), `(+${d.agentSummaries.length - 4} more)`];
        entry.push('**Work done:** ' + summaries.join(' | '));
    }
    if (d.filesCreated.length > 0) {
        entry.push('**Created:** ' + d.filesCreated.map(f => '`' + f + '`').join(', '));
    }
    const changedKeys = Object.keys(d.filesChanged);
    if (changedKeys.length > 0) {
        const parts = [];
        for (const f of changedKeys) {
            const diffs = d.filesChanged[f];
            if (diffs.length > 0) {
                parts.push('`' + f + '`');
                for (const diff of diffs.slice(0, 2)) parts.push('  ' + diff);
                if (diffs.length > 2) parts.push('  (+' + (diffs.length - 2) + ' more edits)');
            } else {
                parts.push('`' + f + '`');
            }
        }
        entry.push('**Changed:**\n' + parts.map(p => p.startsWith('  ') ? p : '- ' + p).join('\n'));
    }
    if (d.commands.length > 0) {
        const cmds = d.commands.length <= 3 ? d.commands : [...d.commands.slice(0, 3), '(+' + (d.commands.length - 3) + ' more)'];
        entry.push('**Commands:** ' + cmds.map(c => '`' + c + '`').join(', '));
    }

    // ── Git fallback ────────────────────────────────────────────────
    let changedFiles = [];
    if (entry.length === 0) {
        let hasGit = false;
        try { execSync('git rev-parse --is-inside-work-tree', { cwd, stdio: ['pipe', 'pipe', 'ignore'] }); hasGit = true; } catch (e) {}
        if (hasGit) {
            try { const r = execSync('git diff --name-only', { cwd, encoding: 'utf-8' }).trim(); if (r) changedFiles.push(...r.split('\n').filter(Boolean)); } catch (e) {}
            try { const r = execSync('git diff --cached --name-only', { cwd, encoding: 'utf-8' }).trim(); if (r) changedFiles.push(...r.split('\n').filter(Boolean)); } catch (e) {}
            try { const r = execSync('git ls-files --others --exclude-standard', { cwd, encoding: 'utf-8' }).trim(); if (r) changedFiles.push(...r.split('\n').filter(Boolean)); } catch (e) {}
            changedFiles = [...new Set(changedFiles)];
        }
        if (changedFiles.length > 0) {
            const shown = changedFiles.slice(0, 20);
            entry.push('**Changed:** ' + shown.map(f => '`' + f + '`').join(', '));
            if (changedFiles.length > 20) entry.push(' (+' + (changedFiles.length - 20) + ' more)');
        }
    }

    // ── Write session log ───────────────────────────────────────────
    if (entry.length > 0) {
        const now = new Date();
        const date = now.toISOString().split('T')[0];
        const logPath = path.join(avvarreDir, 'session-log.md');
        let existing = '';
        try { existing = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf-8') : ''; } catch (e) {}

        const dateHeading = '## ' + date;
        const sessionHeading = '### ' + dev + ' — ' + shortSession + ' (' + timeRange + ')';
        const sessionBlock = sessionHeading + '\n' + entry.join('\n');

        const escapedDev = dev.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const sessionPattern = new RegExp('### ' + escapedDev + ' — ' + shortSession + ' \\([^)]+\\)[\\s\\S]*?(?=\\n### |\\n## |$)');
        const existingMatch = existing.match(sessionPattern);

        if (existingMatch) {
            const updated = existing.replace(sessionPattern, sessionBlock);
            try { fs.writeFileSync(logPath, updated); } catch (e) {}
        } else if (existing.includes(dateHeading)) {
            const idx = existing.indexOf(dateHeading);
            const afterHeading = existing.indexOf('\n', idx) + 1;
            const nextDate = existing.indexOf('\n## ', afterHeading);
            const insertAt = nextDate === -1 ? existing.length : nextDate;
            const updated = existing.slice(0, insertAt) + '\n' + sessionBlock + '\n' + existing.slice(insertAt);
            try { fs.writeFileSync(logPath, updated); } catch (e) {}
        } else {
            const block = '\n' + dateHeading + '\n\n' + sessionBlock + '\n';
            if (existing.startsWith('# ')) {
                const firstNewline = existing.indexOf('\n');
                const updated = existing.slice(0, firstNewline + 1) + block + existing.slice(firstNewline + 1);
                try { fs.writeFileSync(logPath, updated); } catch (e) {}
            } else {
                try { fs.writeFileSync(logPath, '# Session Log\n' + block + existing); } catch (e) {}
            }
        }
    }

    // ── Gardening check + reminder ──────────────────────────────────
    const nowMs = Date.now();
    const lastGardenTime = state.lastGardenTime || 0;
    const hasElapsed = (nowMs - lastGardenTime) > (60 * 60 * 1000);

    const codeExtensions = new Set([
        '.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.java', '.cpp', '.c', '.h', '.hpp', '.rs', '.rb', '.php', '.cs', '.kt', '.swift'
    ]);
    const allChanged = [...prevData.filesCreated, ...Object.keys(prevData.filesChanged), ...changedFiles];
    const hasCodeChanges = allChanged.some(f => codeExtensions.has(path.extname(f).toLowerCase()));

    if (hasCodeChanges && hasElapsed) {
        const warnings = runLightweightGarden(cwd);
        state.lastGardenTime = nowMs;
        try { fs.writeFileSync(stateFile, JSON.stringify(state)); } catch (e) {}

        const reminder = [
            '[Avvarre] Session logged. Before ending, update these files if needed:',
            '',
            '1. **tasks.md** — Mark completed tasks [x], update in-progress [/], add new tasks discovered.',
            '   Format: [x] Summary (steps: a→b→c→d) for done, [/] Summary (done: a→b | next: c→d) for partial.',
            '2. **context.md** — If project architecture, key decisions, or scope changed, update context.',
            '3. **conventions.md** — If new coding patterns or rules were established, add them.',
        ];
        if (warnings.length > 0) {
            reminder.push('', '⚠️ Memory Rot / Drift Alerts:', ...warnings.map(w => '- ' + w));
        }
        reminder.push('', 'Then if source code was written or changed, suggest: "Run /avvarre on changed files?"');

        console.log(JSON.stringify({
            systemMessage: reminder.join('\n'),
            hookSpecificOutput: {
                hookEventName: 'Stop',
                additionalContext: reminder.join('\n'),
            }
        }));
    } else {
        console.log(JSON.stringify({
            systemMessage: '[Avvarre] Session logged: ' + dev + ' — ' + shortSession + ' (' + timeRange + ').'
        }));
    }
});

function runLightweightGarden(cwd) {
    const warnings = [];
    const avvarreDir = path.join(cwd, '.avvarre');
    if (!fs.existsSync(avvarreDir)) return warnings;

    const now = Date.now();

    const contextPath = path.join(avvarreDir, 'context.md');
    if (fs.existsSync(contextPath)) {
        try {
            const contextText = fs.readFileSync(contextPath, 'utf-8').toLowerCase();
            const topDirs = fs.readdirSync(cwd, { withFileTypes: true })
                .filter(ent => ent.isDirectory() && !ent.name.startsWith('.') && !['node_modules', 'dist', '.next', '.avvarre', 'build'].includes(ent.name))
                .map(ent => ent.name);
            for (const dir of topDirs) {
                if (!contextText.includes(dir.toLowerCase())) {
                    warnings.push('Directory `' + dir + '/` is not described in `context.md` Project Structure.');
                }
            }
        } catch (e) {}
    }

    const tasksPath = path.join(avvarreDir, 'tasks.md');
    if (fs.existsSync(tasksPath)) {
        try {
            const tasksText = fs.readFileSync(tasksPath, 'utf-8');
            const lines = tasksText.split('\n');
            let blameLines = [];
            try {
                blameLines = execSync('git blame .avvarre/tasks.md', { cwd, stdio: ['pipe', 'pipe', 'ignore'], encoding: 'utf-8' }).split('\n');
            } catch (e) {}
            const fallbackDate = fs.statSync(tasksPath).mtime;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                const isInProgress = line.startsWith('- [/]');
                const isTodo = line.startsWith('- [ ]');
                if (isInProgress || isTodo) {
                    const taskText = line.slice(5).trim();
                    let taskDate = fallbackDate;
                    if (blameLines[i]) {
                        const dateMatch = blameLines[i].match(/\b(\d{4}-\d{2}-\d{2})\b/);
                        if (dateMatch) taskDate = new Date(dateMatch[1]);
                    }
                    const ageDays = Math.floor((now - taskDate.getTime()) / (24 * 60 * 60 * 1000));
                    if (isInProgress && ageDays > 7) warnings.push('Stalled in-progress task (' + ageDays + ' days active): "' + taskText + '"');
                    else if (isTodo && ageDays > 30) warnings.push('Stale pending task (' + ageDays + ' days unstarted): "' + taskText + '"');
                }
            }
        } catch (e) {}
    }

    const logPath = path.join(avvarreDir, 'session-log.md');
    if (fs.existsSync(logPath)) {
        try {
            const logText = fs.readFileSync(logPath, 'utf-8');
            const dates = [...logText.matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g)].map(m => m[1]);
            if (dates.length > 0) {
                const parsedDates = dates.map(d => new Date(d).getTime());
                const latestTime = Math.max(...parsedDates);
                const ageDays = Math.floor((now - latestTime) / (24 * 60 * 60 * 1000));
                if (ageDays > 7) warnings.push('Session log is stale (latest entry was ' + ageDays + ' days ago).');
            }
        } catch (e) {}
    }

    return warnings;
}
