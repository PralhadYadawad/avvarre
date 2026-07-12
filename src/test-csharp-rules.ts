import { analyze } from './analyzer/engine.js';
import * as fs from 'fs';

console.log('--- Testing C# Rules ---');

const code = fs.readFileSync('codebase_test/bad_code.cs', 'utf8');
const result = analyze(code, 'csharp', 'bad_code.cs');

console.log(`Score: ${result.score} (${result.grade})`);
console.log(`Total Violations: ${result.violations.length}`);

// Print all violations
console.log('\nAll Violations:');
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
    'CS-FMT-01', // No tabs
    'CS-FMT-02', // 100-char limit
    'CS-FMT-03', // Brace placement
    'CS-FMT-04', // Braces required
    'CS-FMT-05', // Keyword spacing
    'CS-FMT-06', // One statement per line
    'CS-FMT-07', // Space after comma
    // §Naming
    'CS-NAME-01', // PascalCase classes/methods
    'CS-NAME-02', // camelCase locals
    'CS-NAME-03', // _camelCase private fields
    'CS-NAME-04', // I prefix for interfaces
    'CS-NAME-05', // PascalCase enum members
    // §Organization
    'CS-ORG-01',  // System usings first
    // §Coding Guidelines
    'CS-CONST-01', // Use const/readonly
    'CS-TYPE-01',  // Avoid var for primitives
    'CS-ASYNC-01', // Async suffix on Task methods
    'CS-LINQ-01',  // Prefer LINQ method syntax
    'CS-DOC-01',   // Public XML docs
    'CS-ERR-01',   // No empty catch
    'CS-ERR-02',   // No generic Exception throw
    'CS-ERR-03',   // No silent swallowing
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
    console.log(`\n🎉 All ${expectedRules.length} C# rules firing correctly!`);
} else {
    console.error('\n❌ Some rules did not fire. Check above for details.');
    process.exit(1);
}
