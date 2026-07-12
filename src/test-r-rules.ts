import { analyze } from './analyzer/engine.js';
import * as fs from 'fs';

console.log('--- Testing R Rules ---');

const code = fs.readFileSync('codebase_test/bad_code.R', 'utf8');
const result = analyze(code, 'r', 'bad_code.R');

console.log(`Score: ${result.score} (${result.grade})`);
console.log(`Total Violations: ${result.violations.length}`);

// Print all violations for debugging
result.violations.forEach(v => {
    console.log(`  L${v.line} [${v.severity}] ${v.ruleId}: ${v.message}`);
});

// Group by rule
const byRule = new Map<string, number>();
result.violations.forEach(v => {
    byRule.set(v.ruleId, (byRule.get(v.ruleId) || 0) + 1);
});

console.log('\nViolations per Rule:');
byRule.forEach((count, id) => {
    console.log(`  ${id}: ${count}`);
});

const expectedRules = [
    'R-FMT-01', 'R-FMT-02', 'R-FMT-03', 'R-FMT-04', 'R-FMT-05', 'R-FMT-06',
    'R-NAME-01', 'R-NAME-02', 'R-NAME-03', 'R-NAME-04',
    'R-ASGN-01', 'R-ASGN-02', 'R-ASGN-03',
    'R-FUNC-01', 'R-FUNC-02',
    'R-STY-01', 'R-STY-02', 'R-STY-03', 'R-STY-04',
    'R-CTRL-01', 'R-CTRL-02',
    'R-NS-01',
    'R-PIPE-01', 'R-PIPE-02',
    'R-DOC-01', 'R-DOC-02', 'R-DOC-03',
];

console.log('\n--- Rule Check ---');
let allPassed = true;
expectedRules.forEach(id => {
    if (!byRule.has(id)) {
        console.error(`❌ MISSING: Rule ${id} did not fire!`);
        allPassed = false;
    } else {
        console.log(`✅ PASSED: Rule ${id} fired (${byRule.get(id)}x).`);
    }
});

if (allPassed) {
    console.log(`\n🎉 All ${expectedRules.length} R rules firing correctly!`);
} else {
    console.error('\n❌ Some rules did not fire. Check above for details.');
    process.exit(1);
}

