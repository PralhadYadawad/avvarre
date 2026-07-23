import type { Plugin, Hooks } from "@opencode-ai/plugin";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

const shortSession = Math.random().toString(36).substring(2, 10);
const startTime = new Date().toTimeString().split(' ')[0].slice(0, 5);

// Guards to ensure hooks run exactly once per session lifetime
let contextInjected = false;
let skillSuggested = false;

// ── Helpers ────────────────────────────────────────────────────────────

function extractFilesFromArgs(args: any): string[] {
  const files: string[] = [];
  if (!args) return files;

  if (typeof args.filePath === 'string') files.push(args.filePath);
  if (typeof args.TargetFile === 'string') files.push(args.TargetFile);
  if (typeof args.file_path === 'string') files.push(args.file_path);
  if (typeof args.path === 'string') files.push(args.path);

  if (typeof args.patchText === 'string') {
    const regex = /\*\*\*\s+(?:Add File|Update File|Move to|Delete File):\s*([^\n\r]+)/g;
    let match;
    while ((match = regex.exec(args.patchText)) !== null) {
      if (match[1]) files.push(match[1].trim());
    }
  }
  return Array.from(new Set(files));
}

function queryDependencyGraph(cwd: string, changedFiles: string[]): string | null {
  const dbPath = path.join(cwd, '.avvarre', 'graph.db');
  if (!fs.existsSync(dbPath)) return null;

  let db: any;
  let queryAll: (sql: string, params: any[]) => any[];

  try {
    const { Database } = require("bun:sqlite");
    db = new Database(dbPath);
    queryAll = (sql, params) => db.query(sql).all(...params);
  } catch (e) {
    try {
      const { DatabaseSync } = require("node:sqlite");
      db = new DatabaseSync(dbPath);
      queryAll = (sql, params) => db.prepare(sql).all(...params);
    } catch (err) {
      return null;
    }
  }

  try {
    const cteSql = `
      WITH RECURSIVE impacted(node_qn, depth, relation_path) AS (
          SELECT qualified_name, 0, name FROM nodes WHERE file_path = ? AND (kind = 'Function' OR kind = 'Class' OR kind = 'Type')
          UNION
          SELECT e.source_qualified, i.depth + 1, e.source_qualified || ' -> ' || i.relation_path
          FROM impacted i
          JOIN edges e ON (e.target_qualified = i.node_qn OR i.node_qn LIKE '%::' || e.target_qualified)
          WHERE i.depth < 3 AND e.kind = 'CALLS'
          UNION
          SELECT e.source_qualified, i.depth + 1, e.source_qualified || ' -> ' || i.relation_path
          FROM impacted i
          JOIN edges e ON (e.target_qualified = i.node_qn OR i.node_qn LIKE '%::' || e.target_qualified)
          WHERE i.depth < 3 AND e.kind = 'INHERITS'
      )
      SELECT DISTINCT i.node_qn, i.depth, i.relation_path, n.name, n.file_path, n.line_start, n.kind
      FROM impacted i
      JOIN nodes n ON n.qualified_name = i.node_qn
      WHERE n.file_path != ?
      ORDER BY i.depth ASC
      LIMIT 30
    `;

    const testSql = `
      SELECT COUNT(*) as cnt FROM edges WHERE target_qualified = ? AND kind = 'TESTED_BY'
    `;

    const warningLines: string[] = [];
    const testGapLines: string[] = [];

    for (const file of changedFiles) {
      const resolved = path.isAbsolute(file) ? file : path.resolve(cwd, file);
      if (!fs.existsSync(resolved)) continue;

      const relativeFile = path.relative(cwd, resolved).replace(/\\/g, '/');
      const rows = queryAll(cteSql, [resolved, resolved]);

      if (rows && rows.length > 0) {
        warningLines.push(`- Modifying \`${relativeFile}\` has potential downstream impacts:`);
        for (const row of rows) {
          const relativeImpactedFile = path.relative(cwd, row.file_path).replace(/\\/g, '/');
          warningLines.push(`  * ${row.kind} \`${row.name}\` in \`${relativeImpactedFile}\` (Line ${row.line_start})`);
          warningLines.push(`    Path: ${row.relation_path}`);

          if (row.kind === 'Function' || row.kind === 'Class') {
            const testCheckRows = queryAll(testSql, [row.node_qn]);
            const hasTest = testCheckRows && testCheckRows[0] && testCheckRows[0].cnt > 0;
            if (!hasTest) {
              testGapLines.push(`  * ${row.kind} \`${row.name}\` in \`${relativeImpactedFile}\` (untested)`);
            }
          }
        }
      }
    }

    if (warningLines.length > 0) {
      const message = [
        `\n[Avvarre] DOWNSTREAM IMPACT WARNING:`,
        ...warningLines,
        ''
      ];
      if (testGapLines.length > 0) {
        message.push(
          `[Avvarre] TEST GAP ALERTS (Untested downstream components):`,
          ...testGapLines,
          ''
        );
      }
      message.push(`Please review the above impacts to ensure changes do not break downstream callers.`);
      return message.join('\n');
    }
  } catch (e) {
    // Silent catch
  }
  return null;
}

function detectTechStack(cwd: string): string[] {
  const detected: Record<string, string> = {};
  function add(fw: string, source: string) { if (!detected[fw]) detected[fw] = source; }

  const pkgPath = path.join(cwd, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
      if (deps.includes('next')) add('nextjs', 'package.json');
      if (deps.includes('react') || deps.includes('react-dom')) add('react', 'package.json');
      if (deps.includes('vue') || deps.includes('@vue/core')) add('vue', 'package.json');
      if (deps.includes('svelte') || deps.includes('@sveltejs/kit')) add('svelte', 'package.json');
      if (deps.includes('tailwindcss')) add('tailwind', 'package.json');
      if (deps.includes('express')) add('express', 'package.json');
      if (deps.includes('typescript')) add('typescript', 'package.json');
      add('node', 'package.json');
    } catch (e) {}
  }

  for (const pyFile of ['requirements.txt', 'pyproject.toml', 'Pipfile', 'setup.py']) {
    const pyPath = path.join(cwd, pyFile);
    if (fs.existsSync(pyPath)) {
      add('python', pyFile);
      try {
        const content = fs.readFileSync(pyPath, 'utf-8').toLowerCase();
        if (content.includes('fastapi')) add('fastapi', pyFile);
      } catch (e) {}
      break;
    }
  }

  if (fs.existsSync(path.join(cwd, 'go.mod'))) add('go', 'go.mod');
  if (fs.existsSync(path.join(cwd, 'Cargo.toml'))) add('rust', 'Cargo.toml');
  if (fs.existsSync(path.join(cwd, 'pubspec.yaml'))) add('dart', 'pubspec.yaml');

  const configMap: Record<string, string> = {
    'next.config.js': 'nextjs', 'next.config.ts': 'nextjs', 'next.config.mjs': 'nextjs',
    'tailwind.config.js': 'tailwind', 'tailwind.config.ts': 'tailwind',
    'svelte.config.js': 'svelte', 'svelte.config.ts': 'svelte',
    'tsconfig.json': 'typescript',
    'CMakeLists.txt': 'cpp',
  };
  for (const [file, fw] of Object.entries(configMap)) {
    if (fs.existsSync(path.join(cwd, file))) add(fw, file);
  }

  const extMap: Record<string, string> = { '.go': 'go', '.rs': 'rust', '.swift': 'swift', '.dart': 'dart', '.cpp': 'cpp', '.cc': 'cpp' };
  for (const scanDir of [cwd, path.join(cwd, 'src')]) {
    try {
      for (const entry of fs.readdirSync(scanDir, { withFileTypes: true })) {
        if (!entry.isFile()) continue;
        for (const [ext, fw] of Object.entries(extMap)) {
          if (entry.name.endsWith(ext)) add(fw, entry.name + ' (file extension)');
        }
      }
    } catch (e) {}
  }

  return Object.keys(detected);
}

function loadAvvarreContext(directory: string): string | null {
  const avvarreDir = path.join(directory, '.avvarre');
  if (!fs.existsSync(avvarreDir)) return null;

  const context: string[] = [];
  const avvarreDirStr = avvarreDir;

  const conventionsPath = path.join(avvarreDirStr, 'conventions.md');
  if (fs.existsSync(conventionsPath)) {
    const conventions = fs.readFileSync(conventionsPath, 'utf-8').trim();
    if (conventions) {
      context.push('[Avvarre] Project conventions loaded. Follow these rules:');
      context.push(conventions);
    }
  }

  const sessionLogPath = path.join(avvarreDirStr, 'session-log.md');
  if (fs.existsSync(sessionLogPath)) {
    const log = fs.readFileSync(sessionLogPath, 'utf-8').trim();
    if (log) {
      const sections = log.split(/^## /m).filter(Boolean);
      if (sections.length > 0) {
        const lastSession = sections[sections.length - 1].trim();
        context.push('\n[Avvarre] Last session:');
        context.push('## ' + lastSession);
      }
    }
  }

  const tasksPath = path.join(avvarreDirStr, 'tasks.md');
  if (fs.existsSync(tasksPath)) {
    const tasks = fs.readFileSync(tasksPath, 'utf-8').trim();
    if (tasks) {
      const pending = tasks.split('\n').filter(line =>
        line.match(/^\s*-?\s*\[[ /]\]/)
      );
      if (pending.length > 0) {
        context.push('\n[Avvarre] Pending tasks:');
        context.push(pending.join('\n'));
      }
    }
  }

  const skillsDir = path.join(avvarreDirStr, 'skills');
  if (fs.existsSync(skillsDir)) {
    const skills = fs.readdirSync(skillsDir).filter(f =>
      f.endsWith('.md') && f !== 'README.md'
    );
    if (skills.length > 0) {
      context.push('\n[Avvarre] Available skills: ' + skills.join(', '));
      context.push('Load ONLY the relevant skill before building a feature.');
    }
  }

  return context.length > 0 ? context.join('\n') : null;
}

function getGitChangedFiles(cwd: string): string[] {
  let changedFiles: string[] = [];
  try {
    const { execSync } = require('child_process');
    try {
      const r1 = execSync('git diff --name-only', { cwd, timeout: 5000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
      if (r1) changedFiles.push(...r1.split('\n').filter(Boolean));
    } catch (e) {}
    try {
      const r2 = execSync('git diff --cached --name-only', { cwd, timeout: 5000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
      if (r2) changedFiles.push(...r2.split('\n').filter(Boolean));
    } catch (e) {}
    try {
      const r3 = execSync('git ls-files --others --exclude-standard', { cwd, timeout: 5000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
      if (r3) changedFiles.push(...r3.split('\n').filter(Boolean));
    } catch (e) {}
  } catch (e) {
    // Fallback: filesystem scan
    const cutoff = Date.now() - (2 * 60 * 60 * 1000);
    const skipDirs = new Set(['node_modules', '.git', 'dist', '.next', '__pycache__', '.avvarre', '.opencode']);
    const skipExts = new Set(['.lock', '.log']);
    function scan(dir: string, depth: number) {
      if (depth > 4) return;
      let entries: fs.Dirent[];
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
  return [...new Set(changedFiles)];
}

function runLightweightGarden(cwd: string): string[] {
  const warnings: string[] = [];
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
      let blameLines: string[] = [];
      try {
        const { execSync } = require('child_process');
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

// ── Plugin Entry ───────────────────────────────────────────────────────

export const AvvarrePlugin: Plugin = async ({ project, client, $, directory }) => {
  const avvarreDir = path.join(directory, '.avvarre');
  const hasMemory = fs.existsSync(avvarreDir);

  console.log(`[Avvarre] Plugin Initialized (Session: ${shortSession})`);

  // ── Bootstrap context injection + skill suggestion ──────────────────
  // Injected into the system prompt before the first LLM call.
  // Guards prevent re-injection on subsequent LLM calls.
  const onSystemTransform: NonNullable<Hooks["experimental.chat.system.transform"]> = async (_input, output) => {
    if (!contextInjected && hasMemory) {
      const ctx = loadAvvarreContext(directory);
      if (ctx) {
        output.system = [...output.system, '', ctx];
        contextInjected = true;
      }
    }

    if (!skillSuggested && hasMemory) {
      const detectedFrameworks = detectTechStack(directory);
      const fetchable = new Set([
        'nextjs', 'react', 'vue', 'svelte', 'tailwind',
        'node', 'express', 'python', 'fastapi',
        'typescript', 'rust', 'cpp',
      ]);
      const filtered = detectedFrameworks.filter(fw => fetchable.has(fw));
      if (filtered.length > 0) {
        const avvarreSkillsDir = path.join(avvarreDir, 'skills');
        const alreadyFetched = new Set<string>();
        if (fs.existsSync(avvarreSkillsDir)) {
          try {
            for (const file of fs.readdirSync(avvarreSkillsDir)) {
              const match = file.match(/^(.+)_community_rules\.md$/);
              if (match) alreadyFetched.add(match[1]);
            }
          } catch (e) {}
        }

        const declinedSet = new Set<string>();
        const declinedPath = path.join(avvarreSkillsDir, '.declined.json');
        if (fs.existsSync(declinedPath)) {
          try {
            const state = JSON.parse(fs.readFileSync(declinedPath, 'utf-8'));
            for (const fw of (state.declined || [])) declinedSet.add(fw);
          } catch (e) {}
        }

        const newSuggestions = filtered.filter(fw =>
          !alreadyFetched.has(fw) && !declinedSet.has(fw)
        );

        if (newSuggestions.length > 0) {
          const skillMsg = `[Avvarre] Detected stack: ${newSuggestions.join(', ')}. Community best-practice skills are available. Ask the developer if they want to fetch them. To fetch: use "suggest_skills" MCP tool with action "fetch". To skip: use action "decline".`;
          output.system = [...output.system, '', skillMsg];
        }
      }
      skillSuggested = true;
    }
  };

  // ── Compaction hook: inject memory update reminder before compaction ──
  // This is the AI-visible equivalent of other plugins' session-end block.
  // The compaction prompt shapes the continuing context, so the AI sees
  // the reminder and acts on it.
  const onCompacting: NonNullable<Hooks["experimental.session.compacting"]> = async (_input, output) => {
    if (!hasMemory) return;
    output.context.push(`
[Avvarre] Session lifecycle reminder:
1. If you modified source code, update .avvarre/tasks.md — mark completed tasks [x], update in-progress [/], add new tasks.
2. If project architecture or scope changed, update .avvarre/context.md.
3. If new coding patterns were established, update .avvarre/conventions.md.
4. Then ask the developer: "Run /avvarre on changed files?"
`);
  };

  return {
    // Bootstrap: warn if .avvarre/ is missing (logged to app panel)
    "session.created": async () => {
      if (!hasMemory) {
        await client.app.log({
          body: {
            service: "avvarre",
            level: "warn",
            message: "No .avvarre/ directory found. Run /avvarre:init to scaffold project memory."
          }
        });
      }
    },

    // Context loader + skill suggestion via system prompt transformation
    "experimental.chat.system.transform": onSystemTransform,

    // Compaction hook: AI-visible memory update reminder
    "experimental.session.compacting": onCompacting,

    // Shell env: inject workspace directory hint for MCP server
    "shell.env": async (_input, output) => {
      output.env.AVVARRE_WORKSPACE = directory;
      output.env.AVVARRE_PLUGIN = "opencode";
    },

    // Impact warning (post-tool, pre-LLM)
    "tool.execute.after": async (input, output) => {
      const isEdit = ["write", "edit", "apply_patch"].includes(input.tool);
      if (!isEdit) return;

      const affected = extractFilesFromArgs(input.args);
      if (affected.length === 0) return;

      const warning = queryDependencyGraph(directory, affected);
      if (warning && output.output) {
        output.output = `${output.output.trim()}\n\n${warning}`;
      }
    },

    // Event bus: structured logging for session lifecycle events
    "event": async (input) => {
      if (!hasMemory) return;
      const ev = input.event;
      if (ev.type === "session.created" || ev.type === "session.deleted" || ev.type === "session.updated") {
        await client.app.log({
          body: {
            service: "avvarre",
            level: "debug",
            message: `Session event: ${ev.type}`
          }
        }).catch(() => {});
      }
    },

    // Session end: log changes to session-log.md and run gardening checks
    "session.idle": async () => {
      if (!hasMemory) return;

      const changedFiles = getGitChangedFiles(directory);
      if (changedFiles.length === 0) return;

      // Developer identity
      let dev = os.userInfo().username || 'unknown';
      try {
        const { execSync } = require('child_process');
        const gitName = execSync('git config user.name', { cwd: directory, timeout: 3000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
        if (gitName) dev = gitName;
      } catch (e) {}

      // Write incremental log to session-log.md
      const logPath = path.join(avvarreDir, 'session-log.md');
      const now = new Date();
      const date = now.toISOString().split('T')[0];
      const endTimeVal = now.toTimeString().split(' ')[0].slice(0, 5);
      const timeRangeStr = startTime === endTimeVal ? startTime : `${startTime}–${endTimeVal}`;

      const dateHeading = `## ${date}`;
      const sessionHeading = `### ${dev} — ${shortSession} (${timeRangeStr})`;
      const shown = changedFiles.slice(0, 20);
      const fileList = shown.map(f => `- \`${f}\``).join('\n');
      const sessionBlock = `${sessionHeading}\n**Changed:** ${shown.map(f => `\`${f}\``).join(', ')}${changedFiles.length > 20 ? ` (+${changedFiles.length - 20} more)` : ''}`;

      let existing = "";
      if (fs.existsSync(logPath)) {
        existing = fs.readFileSync(logPath, 'utf-8');
      }

      const sessionPattern = new RegExp(`### ${dev.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} — ${shortSession} \\([^)]+\\)[\\s\\S]*?(?=\\n### |\\n## |$)`);
      const existingMatch = existing.match(sessionPattern);

      if (existingMatch) {
        existing = existing.replace(sessionPattern, sessionBlock);
      } else if (existing.includes(dateHeading)) {
        const idx = existing.indexOf(dateHeading);
        const afterHeading = existing.indexOf('\n', idx) + 1;
        const nextDate = existing.indexOf('\n## ', afterHeading);
        const insertAt = nextDate === -1 ? existing.length : nextDate;
        existing = existing.slice(0, insertAt) + '\n' + sessionBlock + '\n' + existing.slice(insertAt);
      } else {
        const block = `\n${dateHeading}\n\n${sessionBlock}\n`;
        if (existing.startsWith('# ')) {
          const firstNewline = existing.indexOf('\n');
          existing = existing.slice(0, firstNewline + 1) + block + existing.slice(firstNewline + 1);
        } else {
          existing = `# Session Log\n${block}${existing}`;
        }
      }

      try {
        fs.writeFileSync(logPath, existing, 'utf-8');
      } catch (e) {}

      await client.app.log({
        body: {
          service: "avvarre",
          level: "info",
          message: `Session logged: ${changedFiles.length} file(s) changed`,
          extra: { session: shortSession, files: changedFiles.slice(0, 20) }
        }
      }).catch(() => {});

      // Gardening checks if code files changed and >1h since last check
      const codeExtensions = new Set([
        '.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.java', '.cpp', '.c', '.h', '.hpp', '.rs', '.rb', '.php', '.cs', '.kt', '.swift'
      ]);
      const hasCodeChanges = changedFiles.some(f => codeExtensions.has(path.extname(f).toLowerCase()));

      if (hasCodeChanges) {
        const stateFile = path.join(avvarreDir, '.session-state.json');
        let state: any = {};
        try { state = JSON.parse(fs.readFileSync(stateFile, 'utf-8')); } catch (e) {}

        const nowMs = Date.now();
        const lastGardenTime = state.lastGardenTime || 0;
        const hasElapsed = (nowMs - lastGardenTime) > (60 * 60 * 1000);

        if (hasElapsed) {
          const warnings = runLightweightGarden(directory);
          state.lastGardenTime = nowMs;
          try { fs.writeFileSync(stateFile, JSON.stringify(state)); } catch (e) {}

          console.log(`\n[Avvarre] Session logged. Please update these files if needed:`);
          console.log(`1. tasks.md — Mark completed tasks [x], update in-progress [/], add new tasks.`);
          console.log(`2. context.md — If project architecture, key decisions, or scope changed.`);
          console.log(`3. conventions.md — If new coding patterns were established.`);

          if (warnings.length > 0) {
            console.log(`\n⚠️  [Avvarre] Memory Rot / Drift Alerts:`);
            for (const warn of warnings) {
              console.log(`- ${warn}`);
            }
            await client.app.log({
              body: {
                service: "avvarre",
                level: "warn",
                message: `${warnings.length} gardening alert(s) detected`,
                extra: { warnings }
              }
            }).catch(() => {});
          }

          console.log(`\nThen if source code was written or changed, suggest: "Run /avvarre on changed files?"`);
        }
      }
    },
  };
};

export default AvvarrePlugin;
