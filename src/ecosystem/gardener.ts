import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { analyze } from '../analyzer/engine.js';
import type { Language } from '../types.js';

export interface GardenReport {
  staleContext: string[];
  brokenConventions: string[];
  staleTasks: string[];
  suggestions: string[];
}

const SUPPORTED_EXTENSIONS: Record<string, Language> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.py': 'python',
  '.go': 'go',
  '.java': 'java',
  '.kt': 'kotlin',
  '.swift': 'swift',
  '.rs': 'typescript', // fallback
  '.c': 'cpp',
  '.cpp': 'cpp',
  '.h': 'cpp',
  '.sh': 'shell',
  '.html': 'html',
  '.css': 'css',
  '.md': 'markdown',
  '.json': 'json',
  '.xml': 'xml',
};

/**
 * Recursively collects code files in the directory up to a max count.
 */
function collectCodeFiles(dir: string, baseDir: string, filesList: string[], maxFiles = 100): void {
  if (filesList.length >= maxFiles) return;

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const fullPath = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        const skipDirs = ['node_modules', '.git', 'dist', '.next', '.avvarre', 'build', 'out', 'bin', 'coverage', '.opencode'];
        if (skipDirs.includes(ent.name) || ent.name.startsWith('.')) continue;
        collectCodeFiles(fullPath, baseDir, filesList, maxFiles);
      } else if (ent.isFile()) {
        const ext = path.extname(ent.name).toLowerCase();
        if (SUPPORTED_EXTENSIONS[ext]) {
          filesList.push(fullPath);
        }
      }
      if (filesList.length >= maxFiles) return;
    }
  } catch {}
}

/**
 * Runs the Doc-Gardening Audit on the .avvarre/ directory.
 */
export async function runGarden(directory: string): Promise<GardenReport> {
  const staleContext: string[] = [];
  const brokenConventions: string[] = [];
  const staleTasks: string[] = [];
  const suggestions: string[] = [];

  const avvarreDir = path.join(directory, '.avvarre');
  const contextPath = path.join(avvarreDir, 'context.md');
  const conventionsPath = path.join(avvarreDir, 'conventions.md');
  const tasksPath = path.join(avvarreDir, 'tasks.md');
  const logPath = path.join(avvarreDir, 'session-log.md');

  if (!fs.existsSync(avvarreDir)) {
    return {
      staleContext: ['The `.avvarre/` directory is missing.'],
      brokenConventions: [],
      staleTasks: [],
      suggestions: ['Run `scaffold_avvarre` or `/avvarre-init` to bootstrap persistent project memory.'],
    };
  }

  const now = Date.now();

  // 1. Context Drift Detection
  if (!fs.existsSync(contextPath)) {
    staleContext.push('`context.md` is missing.');
    suggestions.push('Create `context.md` in `.avvarre/` to define the project architecture and scope.');
  } else {
    try {
      const contextText = fs.readFileSync(contextPath, 'utf-8');

      // Cross-reference package.json dependencies
      const packageJsonPath = path.join(directory, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
        
        for (const depName of Object.keys(deps)) {
          // Skip general types packages
          if (depName.startsWith('@types/')) continue;
          
          const isDocumented = contextText.toLowerCase().includes(depName.toLowerCase());
          if (!isDocumented) {
            staleContext.push(`Dependency \`${depName}\` is declared in package.json but not documented in \`context.md\`.`);
            suggestions.push(`Update \`context.md\` tech stack section to document usage of \`${depName}\`.`);
          }
        }
      }

      // Cross-reference directory structure
      const topDirs = fs.readdirSync(directory, { withFileTypes: true })
        .filter(ent => ent.isDirectory() && !ent.name.startsWith('.') && !['node_modules', 'dist', '.next', '.avvarre', 'build', '.opencode'].includes(ent.name))
        .map(ent => ent.name);

      for (const dir of topDirs) {
        const isDescribed = contextText.toLowerCase().includes(dir.toLowerCase());
        if (!isDescribed) {
          staleContext.push(`Directory \`${dir}/\` exists in the workspace but is not described in the Project Structure of \`context.md\`.`);
          suggestions.push(`Add a description for the \`${dir}/\` folder to the Project Structure section in \`context.md\`.`);
        }
      }
    } catch (e) {
      staleContext.push(`Error reading \`context.md\`: ${(e as Error).message}`);
    }
  }

  // 2. Naming & Style Conventions Drift
  if (!fs.existsSync(conventionsPath)) {
    brokenConventions.push('`conventions.md` is missing.');
    suggestions.push('Create \`conventions.md\` to define coding conventions and style rules.');
  } else {
    try {
      // Collect workspace files and sample up to 15
      const filesList: string[] = [];
      collectCodeFiles(directory, directory, filesList, 100);

      if (filesList.length > 0) {
        // Sample up to 15 files deterministically
        const sampleSize = Math.min(15, filesList.length);
        const sampledFiles: string[] = [];
        const step = Math.max(1, Math.floor(filesList.length / sampleSize));
        
        for (let i = 0; i < sampleSize; i++) {
          const index = Math.min(filesList.length - 1, i * step);
          sampledFiles.push(filesList[index]);
        }

        for (const fp of sampledFiles) {
          const ext = path.extname(fp).toLowerCase();
          const lang = SUPPORTED_EXTENSIONS[ext];
          if (!lang) continue;

          const relativePath = path.relative(directory, fp).replace(/\\/g, '/');
          const code = fs.readFileSync(fp, 'utf-8');
          const result = analyze(code, lang);

          // We check for high severity/naming violations that violate conventions
          const criticalViolations = result.violations.filter(v => v.severity === 'critical' || v.severity === 'high');
          if (criticalViolations.length > 2) {
            brokenConventions.push(`Convention drift: \`${relativePath}\` has ${criticalViolations.length} style/naming violations (e.g. ${criticalViolations.slice(0, 2).map(v => v.message).join('; ')}).`);
            suggestions.push(`Refactor \`${relativePath}\` to align with the style guide, or update \`conventions.md\` if team patterns have evolved.`);
          }
        }
      }
    } catch {}
  }

  // 3. Stale Task Detection
  if (!fs.existsSync(tasksPath)) {
    staleTasks.push('`tasks.md` is missing.');
    suggestions.push('Create \`tasks.md\` to manage active developer tasks and session handoffs.');
  } else {
    try {
      const tasksText = fs.readFileSync(tasksPath, 'utf-8');
      const lines = tasksText.split('\n');
      
      // Run git blame to detect age of each line
      let blameLines: string[] = [];
      try {
        blameLines = execSync('git blame .avvarre/tasks.md', {
          cwd: directory,
          stdio: ['pipe', 'pipe', 'ignore'],
        }).toString().split('\n');
      } catch {}

      // Fallback fallbackDate: tasks.md mtime
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

          const ageMs = now - taskDate.getTime();
          const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));

          if (isInProgress && ageDays > 7) {
            staleTasks.push(`In-progress task has stalled (active since ${taskDate.toISOString().split('T')[0]}, ${ageDays} days ago): "${taskText}"`);
            suggestions.push(`Update, complete, or archive the stalled task: "${taskText}"`);
          } else if (isTodo && ageDays > 30) {
            staleTasks.push(`Pending task is stale (unstarted since ${taskDate.toISOString().split('T')[0]}, ${ageDays} days ago): "${taskText}"`);
            suggestions.push(`Evaluate whether to clean up, split, or prioritize the stale task: "${taskText}"`);
          }
        }
      }
    } catch (e) {
      staleTasks.push(`Error checking \`tasks.md\`: ${(e as Error).message}`);
    }
  }

  // 4. Session Log Freshness
  if (!fs.existsSync(logPath)) {
    staleContext.push('`session-log.md` is missing.');
    suggestions.push('Create \`session-log.md\` to preserve project transition summaries across sessions.');
  } else {
    try {
      const logText = fs.readFileSync(logPath, 'utf-8');
      const dates = [...logText.matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g)].map(m => m[1]);
      
      if (dates.length > 0) {
        const parsedDates = dates.map(d => new Date(d).getTime());
        const latestTime = Math.max(...parsedDates);
        const ageDays = Math.floor((now - latestTime) / (24 * 60 * 60 * 1000));

        if (ageDays > 7) {
          staleContext.push(`Session log is stale (last session entry was ${ageDays} days ago on ${new Date(latestTime).toISOString().split('T')[0]}).`);
          suggestions.push('Record a quick summary of the current session in \`session-log.md\` before closing.');
        }
      } else {
        staleContext.push('No dated session log headers (`## YYYY-MM-DD`) found in `session-log.md`.');
        suggestions.push('Format your session summaries under `## YYYY-MM-DD` headers in `session-log.md`.');
      }
    } catch {}
  }

  return {
    staleContext,
    brokenConventions,
    staleTasks,
    suggestions: Array.from(new Set(suggestions)),
  };
}
