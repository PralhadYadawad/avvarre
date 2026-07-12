/**
 * Java Rules Test — Session 1 (§2 + §3)
 * Tests all 7 rules implemented: JAVA-SRC-01 through JAVA-SRC-03 + JAVA-IMP-01/02 + JAVA-FMT-01 + JAVA-STR-01
 */

import * as fs from 'fs';
import { analyze } from './analyzer/engine.js';

const BAD_JAVA = fs.readFileSync('./codebase_test/bad_code.java', 'utf-8');
const GOOD_JAVA_SRC03 = `
import java.util.List;

public class MyClass {
    public void greet() { System.out.println("Hi"); }
}
`;

function runTest(label: string, code: string, filename?: string) {
    const result = analyze(code, 'java', filename);
    console.log(`\n=== ${label} ===`);
    console.log(`Violations: ${result.violations.length}, Score: ${result.score}/100 (${result.grade})`);
    const byRule: Record<string, number> = {};
    for (const v of result.violations) {
        byRule[v.ruleId] = (byRule[v.ruleId] || 0) + 1;
        console.log(`  [${v.ruleId}] Line ${v.line}: ${v.message}`);
    }
    return byRule;
}

const badRules = runTest('BAD CODE (bad_code.java)', BAD_JAVA, 'bad_code.java');
const goodRules = runTest('GOOD CODE (snapshot test: no violations expected)', GOOD_JAVA_SRC03, 'MyClass.java');

// Summary
const expectedRules = [
    'JAVA-SRC-01', 'JAVA-FMT-01', 'JAVA-STR-01',
    'JAVA-IMP-01', 'JAVA-IMP-02', 'JAVA-SRC-03',
    'JAVA-FMT-02', 'JAVA-FMT-03', 'JAVA-FMT-04',
    'JAVA-FMT-05', 'JAVA-FMT-06',
    'JAVA-FMT-07', 'JAVA-FMT-08', 'JAVA-FMT-09',
    'JAVA-FMT-10', 'JAVA-FMT-11', 'JAVA-FMT-12',
    'JAVA-FMT-13',
    'JAVA-NAME-01', 'JAVA-NAME-02', 'JAVA-NAME-03',
    'JAVA-NAME-04', 'JAVA-NAME-05',
    'JAVA-ERR-01', 'JAVA-ERR-02',
    'JAVA-DOC-01', 'JAVA-DOC-02',
    'JAVA-PRACTICE-01', 'JAVA-PRACTICE-02', 'JAVA-TYPE-01'
];
const missing = expectedRules.filter(r => !badRules[r]);

console.log('\n=== Rule Coverage Summary ===');
for (const r of expectedRules) {
    const fired = !!badRules[r];
    console.log(`  ${fired ? '✅' : '❌'} ${r}: ${fired ? `${badRules[r]} hit(s)` : 'NOT FIRED'}`);
}

if (missing.length === 0) {
    console.log('\n✅ All 7 Java rules fired correctly!');
} else {
    console.log(`\n⚠️  Missing rules: ${missing.join(', ')}`);
}

// JAVA-SRC-02 is hard to trigger via bad_code.java (can't syntactically wrap package in legal Java)
// so we test it separately
const wrappedPackage = `package com.example.\n// broken
public class Test {}`;
const wrappedResult = analyze(wrappedPackage, 'java', 'Test.java');
const wrappedHit = wrappedResult.violations.some((v: any) => v.ruleId === 'JAVA-SRC-02');
console.log(`  ${wrappedHit ? '✅' : '❌'} JAVA-SRC-02 (wrapped package): ${wrappedHit ? 'fired' : 'NOT FIRED'}`);

console.log('\n=== Python Regression ===');
const pyCode = fs.readFileSync('./codebase_test/bad_code.py', 'utf-8');
const pyResult = analyze(pyCode, 'python');
console.log(`Python violations: ${pyResult.violations.length} (expected ~61)`);
