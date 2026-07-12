import { analyze } from './analyzer/engine.js';
import * as fs from 'fs';

console.log('--- Testing Dart Rules ---');

const code = fs.readFileSync('codebase_test/bad_code.dart', 'utf8');
const result = analyze(code, 'dart', 'bad_code.dart');

console.log(`Score: ${result.score} (${result.grade})`);
console.log(`Total Violations: ${result.violations.length}`);

// Print all violations
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
    // §Style — Formatting
    'DT-FMT-01', 'DT-FMT-02', 'DT-FMT-03', 'DT-FMT-04', 'DT-FMT-05',
    // §Style — Naming
    'DT-NAME-01', 'DT-NAME-02', 'DT-NAME-03', 'DT-NAME-04', 'DT-NAME-05',
    'DT-NAME-06', 'DT-NAME-07', 'DT-NAME-08',
    // §Style — Imports
    'DT-IMP-01', 'DT-IMP-02', 'DT-IMP-03',
    // §Usage — Null Safety
    'DT-NULL-01', 'DT-NULL-02',
    // §Usage — Strings
    'DT-STR-01',
    // §Usage — Collections
    'DT-COL-01', 'DT-COL-02', 'DT-COL-03', 'DT-COL-04', 'DT-COL-05',
    // §Usage — Functions & Members
    'DT-FUNC-01', 'DT-MEM-01',
    // §Usage — Constructors
    'DT-CTOR-01', 'DT-CTOR-02',
    // §Usage — Features
    'DT-FEAT-01', 'DT-FEAT-02', 'DT-FEAT-03',
    // §Usage — Errors
    'DT-ERR-01', 'DT-ERR-02', 'DT-ERR-03',
    // §Documentation
    'DT-DOC-01', 'DT-DOC-02',
    // §Design
    'DT-DSGN-01', 'DT-DSGN-02', 'DT-DSGN-03',
    // §Types
    'DT-TYPE-01', 'DT-TYPE-02', 'DT-TYPE-03', 'DT-TYPE-04',
    // §Equality
    'DT-EQ-01',
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
    console.log(`\n🎉 All ${expectedRules.length} Dart rules firing correctly!`);
} else {
    console.error('\n❌ Some rules did not fire. Check above for details.');
    process.exit(1);
}
