import * as fs from 'fs';
import { analyze } from './analyzer/engine.js';
import { Rule } from './types.js';

async function runTests() {
    console.log('--- Testing Shell Rules (Session 1) ---');

    const badCode = fs.readFileSync('codebase_test/bad_code.sh', 'utf-8');
    const result = analyze(badCode, 'shell', 'bad_code.sh');

    console.log(`Score: ${result.score} (${result.grade})`);
    console.log(`Total Violations: ${result.violations.length}`);

    const expectedRules = [
        'SH-FMT-01', // Tab / Indent
        'SH-FMT-02', // Line Length
        'SH-FMT-03', // Brace Style
        'SH-OPTS-01', // Strict Mode (3 hits expected)
        'SH-VAR-01',  // Local vars
        'SH-VAR-02',  // Quoting
        'SH-ERR-01',  // Error redirection
        'SH-NAME-01', // Constants
        'SH-ALI-01',  // Aliases
        'SH-CMD-01',  // Backticks
        'SH-COND-01', // Conditionals
        'SH-FUNC-01', // Function naming
        'SH-CMT-01',  // TODOs
        'SH-FEAT-01', // eval
        'SH-FEAT-02', // set -x
        'SH-GLOB-01', // ls glob
        'SH-FUNC-02', // main function
    ];

    const foundRules = new Set(result.violations.map((v: any) => v.ruleId));

    console.log('\nViolations per Rule:');
    expectedRules.forEach(ruleId => {
        const count = result.violations.filter((v: any) => v.ruleId === ruleId).length;
        console.log(`${ruleId}: ${count}`);
    });

    // Test SH-USE-01 with a no-shbang file
    const noShbangResult = analyze('echo "hello"', 'shell', 'no_shbang.sh');
    const hasShbangViolation = noShbangResult.violations.some((v: any) => v.ruleId === 'SH-USE-01');
    console.log(`\nSH-USE-01 (No Shbang): ${hasShbangViolation ? 'PASSED' : 'FAILED'}`);

    // Test SH-FILE-01 with a .bash file
    const bashExtResult = analyze('#!/bin/bash', 'shell', 'script.bash');
    const hasExtViolation = bashExtResult.violations.some((v: any) => v.ruleId === 'SH-FILE-01');
    console.log(`SH-FILE-01 (.bash extension): ${hasExtViolation ? 'PASSED' : 'FAILED'}`);
}

runTests().catch(console.error);
