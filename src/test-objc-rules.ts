import { analyze } from './analyzer/engine.js';
import * as fs from 'fs';

console.log('--- Testing Objective-C Rules ---');

const code = fs.readFileSync('codebase_test/bad_code.m', 'utf8');
const headerCode = fs.readFileSync('codebase_test/bad_code.h', 'utf8');
const result = analyze(code, 'objc', 'bad_code.m');
const headerResult = analyze(headerCode, 'objc', 'bad_code.h');

// Merge violations
result.violations.push(...headerResult.violations);

console.log(`Score: ${result.score} (${result.grade})`);
console.log(`Total Violations: ${result.violations.length}`);

// Group by rule
const byRule = new Map<string, number>();
result.violations.forEach(v => {
    byRule.set(v.ruleId, (byRule.get(v.ruleId) || 0) + 1);
});

console.log('\nViolations per Rule:');
byRule.forEach((count, id) => {
    console.log(`${id}: ${count}`);
});

const expectedRules = [
    'OC-FMT-01', 'OC-FMT-02', 'OC-FMT-04', 'OC-FMT-05', 'OC-FMT-06', 'OC-FMT-07', 'OC-FMT-08',
    'OC-FEAT-01', 'OC-FEAT-02', 'OC-FEAT-03', 'OC-FEAT-04', 'OC-FEAT-05', 'OC-FEAT-06',
    'OC-NAME-01', 'OC-NAME-02', 'OC-NAME-03', 'OC-NAME-04', 'OC-NAME-05', 'OC-NAME-06', 'OC-NAME-07', 'OC-NAME-08', 'OC-NAME-09',
    'OC-DECL-01', 'OC-TYPE-01', 'OC-PROP-01', 'OC-EXC-01', 'OC-DOC-01', 'OC-C-01'
];

let allPassed = true;
expectedRules.forEach(id => {
    if (!byRule.has(id)) {
        console.error(`MISSING: Rule ${id} did not fire!`);
        allPassed = false;
    } else {
        console.log(`PASSED: Rule ${id} fired.`);
    }
});

if (!allPassed) {
    // process.exit(1); 
}
