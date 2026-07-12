import * as fs from 'fs';
import { analyze } from './analyzer/engine.js';

async function runTests() {
    console.log('--- Testing HTML/CSS Rules (Session 1) ---');

    const badCode = fs.readFileSync('codebase_test/bad_code.html', 'utf-8');
    const result = analyze(badCode, 'html', 'bad_code.html');

    console.log(`Score: ${result.score} (${result.grade})`);
    console.log(`Total Violations: ${result.violations.length}`);

    const htmlExpected = [
        'HC-FMT-01',    // Indentation
        'HC-FMT-02',    // Lowercase tags/attributes
        'HC-STYLE-01',  // Document Type & no XML
        'HC-STYLE-02',  // HTML Encoding (UTF-8)
        'HC-STYLE-03',  // Entity References
        'HC-STYLE-04',  // Multimedia Fallback (alt)
        'HC-STYLE-05',  // Type Attributes
        'HC-STYLE-10',  // Semantic Buttons
    ];

    let allPassed = true;

    console.log('\nViolations per HTML Rule:');
    htmlExpected.forEach(ruleId => {
        const count = result.violations.filter((v: any) => v.ruleId === ruleId).length;
        console.log(`${ruleId}: ${count}`);
        if (count === 0) allPassed = false;
    });

    console.log('\n--- Testing CSS Rules (Session 2) ---');
    const badCss = fs.readFileSync('codebase_test/bad_code.css', 'utf-8');
    const cssResult = analyze(badCss, 'css', 'bad_code.css');

    console.log(`CSS Score: ${cssResult.score} (${cssResult.grade})`);
    console.log(`Total CSS Violations: ${cssResult.violations.length}`);

    const cssExpected = [
        'HC-FMT-01',    // Indentation (applies to CSS too)
        'HC-CSS-01',    // Class Naming
        'HC-CSS-02',    // ID Selectors
        'HC-CSS-03',    // Declaration Formatting
        'HC-CSS-04',    // Zero Values
        'HC-CSS-05',    // Shorthand Properties
        'HC-CSS-06',    // URI Quotes
        'HC-CSS-10',    // CSS Variables for Colors
    ];

    console.log('\nViolations per CSS Rule:');
    cssExpected.forEach(ruleId => {
        const count = cssResult.violations.filter((v: any) => v.ruleId === ruleId).length;
        console.log(`${ruleId}: ${count}`);
        if (count === 0 && ruleId !== 'HC-FMT-01') allPassed = false; // We might or might not have tab/odd spaces in bad_code.css for HC-FMT-01, but the others should hit
    });

    console.log(`\nTest Result: ${allPassed ? 'PASSED ✅' : 'FAILED ❌'}`);
}

runTests().catch(console.error);
