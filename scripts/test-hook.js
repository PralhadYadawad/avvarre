import { getDatabase } from '../dist/db/connection.js';
import { indexFile } from '../dist/graph/index.js';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const cwd = process.cwd();

console.log('Initializing database...');
const db = getDatabase(cwd);

console.log('Indexing files to populate the graph...');
// Let's index parser.ts first
await indexFile(db, path.resolve(cwd, 'src/graph/parser.ts'));
// Let's index index.ts which imports parser.ts
await indexFile(db, path.resolve(cwd, 'src/graph/index.ts'));
// Let's index server.ts which imports both
await indexFile(db, path.resolve(cwd, 'src/server.ts'));

console.log('Graph database populated successfully!');

// Let's prepare a test payload for PreToolUse hook
const hookPayload = {
    cwd: cwd,
    hookEventName: 'PreToolUse',
    tool_name: 'editFiles',
    tool_input: {
        files: [path.resolve(cwd, 'src/graph/parser.ts')]
    }
};

console.log('Spawning hook script...');
const hookProcess = spawn('node', [path.resolve(cwd, 'scripts/hook-impact-warn.cjs')], {
    stdio: ['pipe', 'pipe', 'inherit']
});

let stdoutData = '';
hookProcess.stdout.on('data', (data) => {
    stdoutData += data.toString();
});

hookProcess.on('close', (code) => {
    console.log(`Hook process exited with code ${code}`);
    console.log('--- Hook Output ---');
    try {
        const parsedOutput = JSON.parse(stdoutData);
        console.log(JSON.stringify(parsedOutput, null, 2));
    } catch (e) {
        console.log('Raw output:', stdoutData);
    }
    process.exit(0);
});

hookProcess.stdin.write(JSON.stringify(hookPayload));
hookProcess.stdin.end();
