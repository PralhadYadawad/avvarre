import * as fs from 'fs';
import { analyze } from './analyzer/engine.js';

async function runTests() {
    console.log('--- Testing Markdown Rules (Phase 11.2) ---');

    const badCode = fs.readFileSync('codebase_test/bad_code.md', 'utf-8');
    const result = analyze(badCode, 'markdown', 'bad_code.md');

    console.log(`Score: ${result.score} (${result.grade})`);
    console.log(`Total Violations: ${result.violations.length}`);

    const expectedRules = [
        'MD-FMT-01',    // ATX Headers
        'MD-FMT-02',    // Header Spacing
        'MD-FMT-03',    // Trailing Whitespace
        'MD-FMT-04',    // Blank Lines around blocks
        'MD-STYLE-01',  // List Spacing
        'MD-STYLE-02',  // Asterisks for Emphasis
        'MD-STYLE-03',  // Fenced Code Languages
        'MD-LINK-01',   // Descriptive Links
        'MD-STRUCT-01', // AI Instruction Blockquotes
    ];

    let allPassed = true;

    console.log('\nViolations per Rule:');
    expectedRules.forEach(ruleId => {
        const count = result.violations.filter((v: any) => v.ruleId === ruleId).length;
        console.log(`${ruleId}: ${count}`);
        if (count === 0) allPassed = false;
    });

    console.log(`\nTest Result: ${allPassed ? 'PASSED ✅' : 'FAILED ❌'}`);
}

runTests().catch(console.error);
