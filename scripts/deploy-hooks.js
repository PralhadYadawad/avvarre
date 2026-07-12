import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const src = path.join(__dirname, 'hook-session-end.cjs');
const dests = [
    'antigravity-plugin/scripts/hook-session-end.cjs',
    '.agents/plugins/avvarre/scripts/hook-session-end.cjs',
    'awesome-copilot/hooks/avvarre/hook-session-end.cjs',
    'claude-plugin/hooks/hook-session-end.cjs',
    'marketing/awesome-copilot/hooks/avvarre/hook-session-end.cjs',
    'submission/claude-code/hooks/hook-session-end.cjs',
    'submission/copilot-github/hooks/avvarre/hook-session-end.cjs',
    'avvarre/awesome-copilot/hooks/avvarre/hook-session-end.cjs',
    'avvarre/claude-plugin/hooks/hook-session-end.cjs',
    'avvarre/scripts/hook-session-end.cjs'
];

dests.forEach(destRel => {
    const dest = path.resolve(__dirname, '..', destRel);
    if (fs.existsSync(path.dirname(dest))) {
        fs.copyFileSync(src, dest);
        console.log(`Copied hook to: ${destRel}`);
    } else {
        console.log(`Skipped (dir not found): ${destRel}`);
    }
});

// Also copy Cursor specific hook
const cursorSrc = path.join(__dirname, '..', 'cursor-plugin/scripts/hook-session-end.cjs');
const cursorDest = path.join(__dirname, '..', 'submission/cursor/scripts/hook-session-end.cjs');
if (fs.existsSync(path.dirname(cursorDest))) {
    fs.copyFileSync(cursorSrc, cursorDest);
    console.log(`Copied Cursor hook to: submission/cursor/scripts/hook-session-end.cjs`);
}
