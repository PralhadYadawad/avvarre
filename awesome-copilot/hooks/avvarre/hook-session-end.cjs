#!/usr/bin/env node
// Avvarre Stop hook — two-phase:
//   Phase 1 (stop_hook_active=false): Block stop, remind AI to update .avvarre/ files
//   Phase 2 (stop_hook_active=true):  Log session (incremental, one entry per session)
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const chunks = [];
process.stdin.on('data', (d) => chunks.push(d));
process.stdin.on('end', () => {
    let stopHookActive = false;
    let cwd = process.cwd();
    let sessionId = 'unknown';
    let transcriptPath = '';
    let isAntigravity = false;
    try {
        const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        stopHookActive = data.stop_hook_active || false;
        if (data.cwd) cwd = data.cwd;
        else if (data.workspacePaths && data.workspacePaths[0]) cwd = data.workspacePaths[0];

        if (data.sessionId || data.session_id) sessionId = data.sessionId || data.session_id;
        else if (data.conversationId) sessionId = data.conversationId;

        if (data.transcript_path) transcriptPath = data.transcript_path;
        else if (data.transcriptPath) transcriptPath = data.transcriptPath;

        if (data.conversationId) {
            isAntigravity = true;
        }
    } catch (e) {}

    const avvarreDir = path.join(cwd, '.avvarre');
    if (!fs.existsSync(avvarreDir)) {
        if (isAntigravity) {
            console.log(JSON.stringify({ decision: "allow", reason: "No .avvarre/ directory found" }));
        } else {
            console.log(JSON.stringify({
                systemMessage: '[Avvarre] No .avvarre/ — run /avvarre-init.'
            }));
        }
        process.exit(0);
    }

    const shortSession = sessionId.slice(0, 8);
    const stateFile = path.join(avvarreDir, '.session-state.json');
    let state = {};
    try { state = JSON.parse(fs.readFileSync(stateFile, 'utf-8')); } catch (e) {}
    const prev = state[shortSession] || {};

    let isPhase2 = stopHookActive;
    if (isAntigravity) {
        isPhase2 = prev.stopPrompted || false;
    }

    if (isPhase2) {
        state.lastGardenTime = Date.now();
        try { fs.writeFileSync(stateFile, JSON.stringify(state)); } catch (e) {}
        console.log(JSON.stringify({ decision: "allow" }));
        process.exit(0);
    }

    // =====================================================
    // Phase 1: Log the session, then optionally block to ask for .avvarre/ updates
    // =====================================================

    // --- Developer identity ---
    let dev = os.userInfo().username || 'unknown';
    const gitOpts = { cwd, timeout: 3000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] };
    try {
        const gitUser = execSync('git config user.name', gitOpts).trim();
        if (gitUser) dev = gitUser;
    } catch (e) {}

    const prevLinesParsed = prev.linesParsed || 0;
    const startTime = prev.startTime || new Date().toTimeString().split(' ')[0].slice(0, 5);
    const endTime = new Date().toTimeString().split(' ')[0].slice(0, 5);

    // Accumulate across fires: merge previous data with new
    const prevData = prev.data || { userMsgs: [], agentSummaries: [], filesCreated: [], filesChanged: {}, commands: [] };

    // --- Parse transcript (only new lines) ---
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

                    // --- User messages ---
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
                                // Deduplicate
                                if (!prevData.userMsgs.includes(firstLine)) {
                                    prevData.userMsgs.push(firstLine);
                                }
                            }
                        }
                    }

                    // --- Assistant messages + tool uses ---
                    if (role === 'assistant' && Array.isArray(content)) {
                        for (const block of content) {
                            // Agent text — keep only substantive messages
                            if (block.type === 'text' && block.text) {
                                const text = block.text.trim();
                                if (text.length > 20) {
                                    const firstLine = text.split('\n')
                                        .map(l => l.trim())
                                        .find(l => l.length > 20 && !l.startsWith('#') && !l.startsWith('---') && !l.startsWith('|'));
                                    if (firstLine) {
                                        // Filter noise: greetings, simple acknowledgments, questions
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

                            // Tool uses
                            if (block.type === 'tool_use') {
                                const tool = block.name || '';
                                const input = block.input || {};
                                const fp = input.file_path || input.filePath || input.path || '';

                                if (fp) {
                                    const rel = path.isAbsolute(fp)
                                        ? path.relative(cwd, fp).replace(/\\/g, '/')
                                        : fp;

                                    if (tool === 'Write' || tool === 'create_file') {
                                        if (!prevData.filesCreated.includes(rel)) {
                                            prevData.filesCreated.push(rel);
                                        }
                                    } else if (tool === 'Edit' || tool === 'replace_string_in_file' || tool === 'editFiles') {
                                        if (!prevData.filesChanged[rel]) prevData.filesChanged[rel] = [];
                                        if (input.old_string && input.new_string) {
                                            const oldSnip = input.old_string.trim().split('\n')[0].slice(0, 50);
                                            const newSnip = input.new_string.trim().split('\n')[0].slice(0, 50);
                                            if (oldSnip !== newSnip) {
                                                const diff = `\`${oldSnip}\` → \`${newSnip}\``;
                                                if (!prevData.filesChanged[rel].includes(diff)) {
                                                    prevData.filesChanged[rel].push(diff);
                                                }
                                            }
                                        }
                                    }
                                }

                                if (tool === 'Bash' && input.command) {
                                    const cmd = input.command.trim().split('\n')[0].slice(0, 80);
                                    if (cmd && !cmd.startsWith('cat ') && !cmd.startsWith('echo ') && !cmd.startsWith('head ')) {
                                        if (!prevData.commands.includes(cmd)) {
                                            prevData.commands.push(cmd);
                                        }
                                    }
                                }
                            }
                        }
                    }
                } catch (e) {}
            }

            // Save cursor state
            state[shortSession] = {
                linesParsed: allLines.length,
                startTime,
                data: prevData
            };
            // Clean old sessions (keep last 10)
            const keys = Object.keys(state);
            if (keys.length > 10) {
                for (const k of keys.slice(0, keys.length - 10)) delete state[k];
            }
            try { fs.writeFileSync(stateFile, JSON.stringify(state)); } catch (e) {}

        } catch (e) {
            // Transcript unreadable — fall back to git
        }
    }

    // --- Build compact entry ---
    const entry = [];
    const d = prevData;

    // Requests as flow
    if (d.userMsgs.length > 0) {
        const msgs = d.userMsgs.length <= 5
            ? d.userMsgs
            : [...d.userMsgs.slice(0, 4), `(+${d.userMsgs.length - 4} more)`];
        entry.push('**Requests:** ' + msgs.join(' → '));
    }

    // Agent work summaries
    if (d.agentSummaries.length > 0) {
        const summaries = d.agentSummaries.length <= 5
            ? d.agentSummaries
            : [...d.agentSummaries.slice(0, 4), `(+${d.agentSummaries.length - 4} more)`];
        entry.push('**Work done:** ' + summaries.join(' | '));
    }

    // Files created
    if (d.filesCreated.length > 0) {
        entry.push('**Created:** ' + d.filesCreated.map(f => `\`${f}\``).join(', '));
    }

    // Files changed with diffs
    const changedKeys = Object.keys(d.filesChanged);
    if (changedKeys.length > 0) {
        const parts = [];
        for (const f of changedKeys) {
            const diffs = d.filesChanged[f];
            if (diffs.length > 0) {
                parts.push(`\`${f}\``);
                // Show up to 2 diffs per file inline
                for (const diff of diffs.slice(0, 2)) {
                    parts.push(`  ${diff}`);
                }
                if (diffs.length > 2) parts.push(`  (+${diffs.length - 2} more edits)`);
            } else {
                parts.push(`\`${f}\``);
            }
        }
        entry.push('**Changed:**\n' + parts.map(p => p.startsWith('  ') ? p : `- ${p}`).join('\n'));
    }

    // Commands
    if (d.commands.length > 0) {
        const cmds = d.commands.length <= 3
            ? d.commands
            : [...d.commands.slice(0, 3), `(+${d.commands.length - 3} more)`];
        entry.push('**Commands:** ' + cmds.map(c => `\`${c}\``).join(', '));
    }

    // --- Fallback: git if no transcript data ---
    let changedFiles = [];
    if (entry.length === 0) {
        let hasGit = false;
        try {
            execSync('git rev-parse --is-inside-work-tree', gitOpts);
            hasGit = true;
        } catch (e) {}
        if (hasGit) {
            try { const r = execSync('git diff --name-only', gitOpts).trim(); if (r) changedFiles.push(...r.split('\n').filter(Boolean)); } catch (e) {}
            try { const r = execSync('git diff --cached --name-only', gitOpts).trim(); if (r) changedFiles.push(...r.split('\n').filter(Boolean)); } catch (e) {}
            try { const r = execSync('git ls-files --others --exclude-standard', gitOpts).trim(); if (r) changedFiles.push(...r.split('\n').filter(Boolean)); } catch (e) {}
            changedFiles = [...new Set(changedFiles)];
        } else {
            const cutoff = Date.now() - (2 * 60 * 60 * 1000);
            const skipDirs = new Set(['node_modules', '.git', 'dist', '.next', '__pycache__', '.avvarre']);
            const skipExts = new Set(['.lock', '.log']);
            function scan(dir, depth) {
                if (depth > 4) return;
                let entries;
                try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
                for (const ent of entries) {
                    const fp = path.join(dir, ent.name);
                    if (ent.isDirectory() && !skipDirs.has(ent.name) && !ent.name.startsWith('.')) {
                        scan(fp, depth + 1);
                    } else if (ent.isFile() && !skipExts.has(path.extname(ent.name).toLowerCase())) {
                        try {
                            if (fs.statSync(fp).mtimeMs > cutoff) {
                                changedFiles.push(path.relative(cwd, fp).replace(/\\/g, '/'));
                            }
                        } catch (e) {}
                    }
                }
            }
            scan(cwd, 0);
        }
        if (changedFiles.length > 0) {
            const shown = changedFiles.slice(0, 20);
            entry.push('**Changed:** ' + shown.map(f => `\`${f}\``).join(', '));
            if (changedFiles.length > 20) entry.push(` (+${changedFiles.length - 20} more)`);
        }
    }

    if (entry.length === 0) {
        console.log(JSON.stringify({ systemMessage: '[Avvarre] Session ended — no changes detected.' }));
        process.exit(0);
    }

    // --- Write to session log (one entry per session, replace if exists) ---
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const logPath = path.join(avvarreDir, 'session-log.md');
    let existing = '';
    try { existing = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf-8') : ''; } catch (e) {}

    const dateHeading = `## ${date}`;
    const timeRange = startTime === endTime ? startTime : `${startTime}–${endTime}`;
    const sessionHeading = `### ${dev} — ${shortSession} (${timeRange})`;
    const sessionBlock = sessionHeading + '\n' + entry.join('\n');

    // Check if this session already has an entry — if so, replace it
    const sessionPattern = new RegExp(`### ${dev.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} — ${shortSession} \\([^)]+\\)[\\s\\S]*?(?=\\n### |\\n## |$)`);
    const existingMatch = existing.match(sessionPattern);

    if (existingMatch) {
        // Replace existing entry
        const updated = existing.replace(sessionPattern, sessionBlock);
        try { fs.writeFileSync(logPath, updated); } catch (e) {}
    } else if (existing.includes(dateHeading)) {
        // Date exists, append session under it
        const idx = existing.indexOf(dateHeading);
        const afterHeading = existing.indexOf('\n', idx) + 1;
        const nextDate = existing.indexOf('\n## ', afterHeading);
        const insertAt = nextDate === -1 ? existing.length : nextDate;
        const updated = existing.slice(0, insertAt) + '\n' + sessionBlock + '\n' + existing.slice(insertAt);
        try { fs.writeFileSync(logPath, updated); } catch (e) {}
    } else {
        // New date — insert after # heading
        const block = '\n' + dateHeading + '\n\n' + sessionBlock + '\n';
        if (existing.startsWith('# ')) {
            const firstNewline = existing.indexOf('\n');
            const updated = existing.slice(0, firstNewline + 1) + block + existing.slice(firstNewline + 1);
            try { fs.writeFileSync(logPath, updated); } catch (e) {}
        } else {
            try { fs.writeFileSync(logPath, '# Session Log\n' + block + existing); } catch (e) {}
        }
    }

    if (!isPhase2) {
        // Check if 1 hour has elapsed since the last garden check
        const nowMs = Date.now();
        const lastGardenTime = state.lastGardenTime || 0;
        const hasElapsed = (nowMs - lastGardenTime) > (60 * 60 * 1000); // 1 hour

        // Code gardening is only forced if actual code files changed
        const codeExtensions = new Set([
            '.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.java', '.cpp', '.c', '.h', '.hpp', '.rs', '.rb', '.php', '.cs', '.kt', '.swift'
        ]);
        const allChanged = [
            ...prevData.filesCreated,
            ...Object.keys(prevData.filesChanged),
            ...changedFiles
        ];
        const hasCodeChanges = allChanged.some(f => codeExtensions.has(path.extname(f).toLowerCase()));

        if (!hasElapsed || !hasCodeChanges) {
            console.log(JSON.stringify({
                systemMessage: `[Avvarre] Session logged: ${dev} — ${shortSession} (${timeRange}).`
            }));
            process.exit(0);
        }

        // Run gardening checks
        const warnings = runLightweightGarden(cwd);

        // We logged the session, now mark block/continue
        if (isAntigravity) {
            try { state = JSON.parse(fs.readFileSync(stateFile, 'utf-8')); } catch (e) {}
            if (!state[shortSession]) state[shortSession] = {};
            state[shortSession].stopPrompted = true;
            try { fs.writeFileSync(stateFile, JSON.stringify(state)); } catch (e) {}

            const reminder = [
                '[Avvarre] Session logged automatically. Before you stop, please update these files if needed:',
                '',
                '1. **tasks.md** — Mark completed tasks `[x]`, update in-progress `[/]`, add new tasks discovered.',
                '   Format: `[x] Summary (steps: a→b→c→d)` for done, `[/] Summary (done: a→b | next: c→d)` for partial.',
                '2. **context.md** — If project architecture, key decisions, or scope changed, update context.',
                '3. **conventions.md** — If new coding patterns or rules were established, add them.',
            ];

            if (warnings.length > 0) {
                reminder.push('', '⚠️ **Memory Rot / Drift Alerts:**', ...warnings.map(w => `- ${w}`));
            }

            reminder.push('', 'Once you have updated them, attempt to stop again.');

            console.log(JSON.stringify({
                decision: 'continue',
                reason: reminder.join('\n')
            }));
            process.exit(0);
        } else {
            const reminder = [
                '[Avvarre] Before you stop, update these files:',
                '',
                '1. **tasks.md** — Mark completed tasks `[x]`, update in-progress `[/]`, add new tasks discovered.',
                '   Format: `[x] Summary (steps: a→b→c→d)` for done, `[/] Summary (done: a→b | next: c→d)` for partial.',
                '2. **context.md** — If project architecture, key decisions, or scope changed, update context.',
                '3. **conventions.md** — If new coding patterns or rules were established, add them.',
            ];

            if (warnings.length > 0) {
                reminder.push('', '⚠️ **Memory Rot / Drift Alerts:**', ...warnings.map(w => `- ${w}`));
            }

            reminder.push(
                '',
                'Then if source code was written or changed, suggest: "Run /avvarre on changed files?"',
                '',
                'Do this now, then finish your response.'
            );

            console.log(JSON.stringify({
                decision: 'block',
                reason: reminder.join('\n')
            }));
            process.exit(0);
        }
    }

    console.log(JSON.stringify({
        systemMessage: `[Avvarre] Session logged: ${dev} — ${shortSession} (${timeRange}).`
    }));
    process.exit(0);
});

function runLightweightGarden(cwd) {
    const warnings = [];
    const avvarreDir = path.join(cwd, '.avvarre');
    if (!fs.existsSync(avvarreDir)) return warnings;

    const now = Date.now();

    // 1. Context Drift (Directories)
    const contextPath = path.join(avvarreDir, 'context.md');
    if (fs.existsSync(contextPath)) {
        try {
            const contextText = fs.readFileSync(contextPath, 'utf-8').toLowerCase();
            const topDirs = fs.readdirSync(cwd, { withFileTypes: true })
                .filter(ent => ent.isDirectory() && !ent.name.startsWith('.') && !['node_modules', 'dist', '.next', '.avvarre', 'build', '.opencode'].includes(ent.name))
                .map(ent => ent.name);

            for (const dir of topDirs) {
                if (!contextText.includes(dir.toLowerCase())) {
                    warnings.push(`Directory \`${dir}/\` is not described in \`context.md\` Project Structure.`);
                }
            }
        } catch (e) {}
    }

    // 2. Stale Tasks
    const tasksPath = path.join(avvarreDir, 'tasks.md');
    if (fs.existsSync(tasksPath)) {
        try {
            const tasksText = fs.readFileSync(tasksPath, 'utf-8');
            const lines = tasksText.split('\n');
            let blameLines = [];
            try {
                blameLines = execSync('git blame .avvarre/tasks.md', {
                    cwd,
                    stdio: ['pipe', 'pipe', 'ignore'],
                    encoding: 'utf-8'
                }).split('\n');
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
                        if (dateMatch) {
                            taskDate = new Date(dateMatch[1]);
                        }
                    }

                    const ageDays = Math.floor((now - taskDate.getTime()) / (24 * 60 * 60 * 1000));

                    if (isInProgress && ageDays > 7) {
                        warnings.push(`Stalled in-progress task (${ageDays} days active): "${taskText}"`);
                    } else if (isTodo && ageDays > 30) {
                        warnings.push(`Stale pending task (${ageDays} days unstarted): "${taskText}"`);
                    }
                }
            }
        } catch (e) {}
    }

    // 3. Session Log Freshness
    const logPath = path.join(avvarreDir, 'session-log.md');
    if (fs.existsSync(logPath)) {
        try {
            const logText = fs.readFileSync(logPath, 'utf-8');
            const dates = [...logText.matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g)].map(m => m[1]);
            if (dates.length > 0) {
                const parsedDates = dates.map(d => new Date(d).getTime());
                const latestTime = Math.max(...parsedDates);
                const ageDays = Math.floor((now - latestTime) / (24 * 60 * 60 * 1000));
                if (ageDays > 7) {
                    warnings.push(`Session log is stale (latest entry was ${ageDays} days ago).`);
                }
            }
        } catch (e) {}
    }

    return warnings;
}
