import type { Plugin } from "@opencode-ai/plugin";
import fs from "fs";
import path from "path";
import os from "os";

// Generate a unique session ID for the lifetime of this process
const shortSession = Math.random().toString(36).substring(2, 10);
const startTime = new Date().toTimeString().split(' ')[0].slice(0, 5);

/**
 * Extracts list of files affected by tool arguments.
 */
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

/**
 * Queries the Avvarre SQLite dependency graph database for downstream impacts and test gaps.
 */
function queryDependencyGraph(cwd: string, changedFiles: string[]): string | null {
  const dbPath = path.join(cwd, '.avvarre', 'graph.db');
  if (!fs.existsSync(dbPath)) return null;

  let db: any;
  let queryAll: (sql: string, params: any[]) => any[];

  try {
    // Try Bun native SQLite first
    const { Database } = require("bun:sqlite");
    db = new Database(dbPath);
    queryAll = (sql, params) => db.query(sql).all(...params);
  } catch (e) {
    try {
      // Fall back to Node native SQLite
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

export const AvvarrePlugin: Plugin = async ({ project, client, $, directory, worktree }) => {
  const avvarreDir = path.join(directory, '.avvarre');

  // Startup Diagnostics
  console.log(`[Avvarre] Plugin Initialized (Session: ${shortSession})`);
  if (!fs.existsSync(avvarreDir)) {
    console.log(`[Avvarre] No .avvarre/ directory found. Run /avvarre:init to scaffold memory.`);
  }

  return {
    // Event reaction on session creation
    "session.created": async () => {
      if (!fs.existsSync(avvarreDir)) {
        await client.app.log({
          body: {
            service: "avvarre",
            level: "warn",
            message: "No .avvarre/ directory found. Memory scaffolding recommended."
          }
        });
      }
    },

    // Lifecycle Hook: Intercept edits to run Downstream Graph Warning
    "tool.execute.after": async (input, output) => {
      const isEdit = ["write", "edit", "apply_patch"].includes(input.tool);
      if (!isEdit) return;

      const affected = extractFilesFromArgs(output.args);
      if (affected.length === 0) return;

      const warning = queryDependencyGraph(directory, affected);
      if (warning && output.result) {
        // Inject the warning directly into the tool output returned to the LLM
        output.result = `${output.result.trim()}\n\n${warning}`;
      }
    },

    // Session End: Incremental log writing and gardening prompt
    "session.idle": async () => {
      if (!fs.existsSync(avvarreDir)) return;

      // 1. Fetch changed files via Git diff
      let changedFiles: string[] = [];
      try {
        const diff = await $`git diff --name-only`.text();
        const cached = await $`git diff --cached --name-only`.text();
        const untracked = await $`git ls-files --others --exclude-standard`.text();
        
        changedFiles = [
          ...diff.split('\n'),
          ...cached.split('\n'),
          ...untracked.split('\n')
        ].map(f => f.trim()).filter(Boolean);
        changedFiles = Array.from(new Set(changedFiles));
      } catch (e) {
        // Fall back to scanning files changed in the last hour
        const cutoff = Date.now() - (60 * 60 * 1000);
        const scan = (dir: string) => {
          try {
            const ents = fs.readdirSync(dir, { withFileTypes: true });
            for (const ent of ents) {
              const fp = path.join(dir, ent.name);
              if (ent.isDirectory() && !["node_modules", ".git", "dist", ".next", ".avvarre"].includes(ent.name) && !ent.name.startsWith('.')) {
                scan(fp);
              } else if (ent.isFile()) {
                const stat = fs.statSync(fp);
                if (stat.mtimeMs > cutoff) {
                  changedFiles.push(path.relative(directory, fp).replace(/\\/g, '/'));
                }
              }
            }
          } catch {}
        };
        scan(directory);
      }

      if (changedFiles.length === 0) return;

      // 2. Fetch developer username
      let dev = os.userInfo().username || 'unknown';
      try {
        const gitName = await $`git config user.name`.text();
        if (gitName.trim()) dev = gitName.trim();
      } catch {}

      // 3. Write incremental log to session-log.md
      const logPath = path.join(avvarreDir, 'session-log.md');
      const now = new Date();
      const date = now.toISOString().split('T')[0];
      const endTime = now.toTimeString().split(' ')[0].slice(0, 5);
      const timeRange = startTime === endTime ? startTime : `${startTime}–${endTime}`;

      const dateHeading = `## ${date}`;
      const sessionHeading = `### ${dev} — ${shortSession} (${timeRange})`;
      
      const fileList = changedFiles.map(f => `- \`${f}\``).join('\n');
      const sessionBlock = `${sessionHeading}\n**Changed:**\n${fileList}`;

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
      } catch {}

      // 4. Output gardening warnings to console
      const codeExtensions = new Set([
        '.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.java', '.cpp', '.c', '.h', '.hpp', '.rs', '.rb', '.php', '.cs', '.kt', '.swift'
      ]);
      const hasCodeChanges = changedFiles.some(f => codeExtensions.has(path.extname(f).toLowerCase()));

      if (hasCodeChanges) {
        const warnings = runLightweightGarden(directory);

        console.log(`\n[Avvarre] Session logged automatically. Before ending the session, please:`);
        console.log(`1. Update tasks.md (mark done [x], update in-progress [/])`);
        console.log(`2. Update context.md (if project scope or architecture shifted)`);
        console.log(`3. Update conventions.md (if new coding patterns were introduced)`);

        if (warnings.length > 0) {
          console.log(`\n⚠️  [Avvarre] Memory Rot / Drift Alerts:`);
          for (const warn of warnings) {
            console.log(`- ${warn}`);
          }
        }
      }
    },

    // TUI Slash Command execution interceptors
    "tui.command.execute": async (input, output) => {
      const command = input.command.trim();

      if (command.startsWith("/avvarre:init")) {
        output.intercepted = true;
        console.log("[Avvarre] Scaffolding .avvarre/ memory structure...");
        const res = await client.mcp.callTool({
          name: "avvarre_scaffold_avvarre",
          arguments: {}
        });
        console.log(res);
      } else if (command.startsWith("/avvarre:pr")) {
        output.intercepted = true;
        console.log("[Avvarre] Running PR quality gate on changed files...");
        const res = await client.mcp.callTool({
          name: "avvarre_avvarre_pr",
          arguments: {}
        });
        console.log(res);
      } else if (command.startsWith("/avvarre:workspace")) {
        output.intercepted = true;
        console.log("[Avvarre] Auditing the entire workspace...");
        const res = await client.mcp.callTool({
          name: "avvarre_avvarre_workspace",
          arguments: {}
        });
        console.log(res);
      } else if (command.startsWith("/avvarre:garden")) {
        output.intercepted = true;
        console.log("[Avvarre] Auditing persistent memory folders (.avvarre/)...");
        const res = await client.mcp.callTool({
          name: "avvarre_avvarre_garden",
          arguments: { workspaceRoot: directory }
        });
        console.log(res);
      } else if (command.startsWith("/avvarre:autopilot")) {
        output.intercepted = true;
        console.log("[Avvarre] Initializing refactoring autopilot loop...");
      }
    }
  };
};

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
