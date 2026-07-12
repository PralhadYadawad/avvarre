import { analyze } from './analyzer/engine.js';
import * as fs from 'fs';

console.log('--- Testing Swift Rules ---');

const code = fs.readFileSync('codebase_test/bad_code.swift', 'utf8');
const result = analyze(code, 'swift', 'bad_code.swift');

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
    // §Formatting
    'SW-FMT-01', // No tabs
    'SW-FMT-02', // 100-char line limit
    'SW-FMT-03', // K&R braces
    'SW-FMT-04', // Keyword spacing
    'SW-FMT-05', // Operator spacing
    'SW-FMT-06', // Empty blocks
    // §Statements
    'SW-STMT-01', // No semicolons
    'SW-STMT-02', // One statement per line
    // §Naming
    'SW-NAME-01', // lowerCamelCase constants
    'SW-NAME-02', // Acronyms as words
    'SW-NAME-03', // No Hungarian prefix
    'SW-NAME-04', // No leading underscore
    'SW-NAME-05', // UpperCamelCase types
    // §Documentation
    'SW-DOC-01',  // No Javadoc /** */
    'SW-DOC-02',  // Public decl needs ///
    // §Programming Practices
    'SW-OPT-01',    // No force-unwrap
    'SW-OPT-02',    // No IUO properties
    'SW-PROP-01',   // Omit get in read-only
    'SW-CTRL-01',   // No lone fallthrough
    'SW-TYPE-01',   // Use shorthand types
    'SW-FEAT-01',   // Avoid explicit self
    'SW-FEAT-02',   // No print()
    'SW-ERR-01',    // No force-try
    'SW-ERR-02',    // No force cast
    'SW-ACCESS-01', // No extension-level access modifier
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
    console.log(`\n🎉 All ${expectedRules.length} Swift rules firing correctly!`);
} else {
    console.error('\n❌ Some rules did not fire. Check above for details.');
    process.exit(1);
}
