/**
 * Test: Analyze the codebase_test/bad_code.py file using the engine.
 * Run: node dist/test-bad-code.js
 */

import { readFileSync } from 'fs';
import { analyze } from './analyzer/engine.js';

const code = readFileSync('codebase_test/bad_code.py', 'utf-8');
const result = analyze(code, 'python');

console.log('='.repeat(70));
console.log('  avvarre — Analysis of codebase_test/bad_code.py');
console.log('='.repeat(70));
console.log(`  Score: ${result.score}/100  |  Grade: ${result.grade}`);
console.log(`  Total Lines: ${result.totalLines}  |  Violations: ${result.violations.length}`);
console.log('='.repeat(70));
console.log();

for (const v of result.violations) {
    console.log(`  [${v.severity.toUpperCase().padEnd(8)}] Line ${String(v.line).padStart(3)}: ${v.ruleId}`);
    console.log(`           ${v.message}`);
    console.log();
}

console.log('-'.repeat(70));
console.log('Category Breakdown:');
console.log('-'.repeat(70));
for (const cat of result.categoryScores) {
    console.log(`  ${cat.category.padEnd(20)} Score: ${String(cat.score).padStart(3)} | Violations: ${cat.violationCount}`);
}

console.log();
console.log(`Summary: ${result.summary}`);

// Check which rule IDs fired
const ruleIds = new Set(result.violations.map((v: any) => v.ruleId));
const expectedRules = [
    'PY-IMP-01', 'PY-IMP-02', 'PY-IMP-03',
    'PY-EXC-01', 'PY-EXC-02', 'PY-EXC-03', 'PY-EXC-04',
    'PY-GLOB-01',
    'PY-COMP-01',
    'PY-ITER-01', 'PY-ITER-02',
    'PY-LAMBDA-01',
    'PY-MUT-01',
    'PY-BOOL-01', 'PY-BOOL-02', 'PY-BOOL-03',
    'PY-DEC-01',
    'PY-PWR-01',
    'PY-FMT-01', 'PY-FMT-02', 'PY-FMT-03',
    'PY-STR-01', 'PY-STR-02',
    'PY-RES-01',
    'PY-STMT-01',
    'PY-NAME-01', 'PY-NAME-02',
    'PY-MAIN-01',
    'PY-LEN-01',
];

console.log();
console.log('Rule Coverage:');
const missing = expectedRules.filter(r => !ruleIds.has(r));
const found = expectedRules.filter(r => ruleIds.has(r));
console.log(`  Found: ${found.length}/${expectedRules.length} rules triggered`);
if (missing.length > 0) {
    console.log(`  MISSING: ${missing.join(', ')}`);
} else {
    console.log('  ✅ ALL 30 rules triggered!');
}
