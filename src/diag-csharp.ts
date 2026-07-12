// Quick diagnostic: test each rule individually to find the hang
import { csharpRules, getCleanLines } from './analyzer/rules/csharp.js';
import * as fs from 'fs';

const code = fs.readFileSync('codebase_test/bad_code.cs', 'utf8');
const lines = code.split('\n');
const cleanLines = getCleanLines(lines);

for (const rule of csharpRules) {
    process.stdout.write(`Testing ${rule.id}... `);
    const start = Date.now();
    const violations = rule.check(lines, 'bad_code.cs', cleanLines);
    const ms = Date.now() - start;
    if (ms > 1000) {
        console.log(`HANG! ${ms}ms (${violations.length} violations)`);
    } else {
        console.log(`OK (${ms}ms, ${violations.length} violations)`);
    }
}
console.log('Done!');
