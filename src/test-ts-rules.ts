/**
 * TypeScript Rules Test
 * Tests all TS-specific rules against bad_code.ts
 * Also runs regression checks on JS and Python rules.
 */

import * as fs from 'fs';
import { analyze } from './analyzer/engine.js';

const BAD_TS = fs.readFileSync('./codebase_test/bad_code.ts', 'utf-8');

function runTest(label: string, code: string, language: 'typescript' | 'javascript' | 'python', filename?: string) {
    const result = analyze(code, language, filename);
    console.log(`\n=== ${label} ===`);
    console.log(`Violations: ${result.violations.length}, Score: ${result.score}/100 (${result.grade})`);
    const byRule: Record<string, number> = {};
    for (const v of result.violations) {
        byRule[v.ruleId] = (byRule[v.ruleId] || 0) + 1;
    }
    return { result, byRule };
}

// --- Test TS rules ---
console.log('╔══════════════════════════════════════════════════════╗');
console.log('║   TypeScript Rules Test (Phase 6 Sessions 1 & 2)    ║');
console.log('╚══════════════════════════════════════════════════════╝');

const { result: tsResult, byRule: tsRules } = runTest('BAD TypeScript CODE', BAD_TS, 'typescript', 'bad_code.ts');

// Print all violations grouped by rule
const ruleGroups: Record<string, Array<{ line: number, message: string }>> = {};
for (const v of tsResult.violations) {
    if (!ruleGroups[v.ruleId]) ruleGroups[v.ruleId] = [];
    ruleGroups[v.ruleId].push({ line: v.line, message: v.message });
}

console.log('\n--- Violations by rule ---');
for (const [ruleId, violations] of Object.entries(ruleGroups).sort()) {
    console.log(`\n  ${ruleId} (${violations.length} hit${violations.length > 1 ? 's' : ''}):`);
    for (const v of violations) {
        console.log(`    Line ${v.line}: ${v.message}`);
    }
}

// Check TS-specific rules fired
const expectedTsRules = [
    'TS-MOD-01', // No namespaces
    'TS-MOD-02', // No require
    'TS-MOD-03', // No mutable exports
    'TS-MOD-04', // No const enum
    'TS-TYPE-01', // No wrapper types
    'TS-TYPE-02', // Prefer interface
    'TS-TYPE-03', // Use T[] syntax
    'TS-TYPE-04', // No nullable type aliases
    'TS-TYPE-05', // No any type
    'TS-TYPE-06', // No empty object type
    'TS-TYPE-07', // Prefer Tuple Types
    'TS-CLASS-01', // No #private fields
    'TS-CLASS-02', // No empty constructors
    'TS-CLASS-03', // Constructor calls must use parentheses
    'TS-NAME-01', // No I prefix on interfaces
    'TS-NAME-02', // No _ prefix/suffix on identifiers
    'TS-DIS-02',  // No @ts-ignore
];

console.log('\n=== TS Rule Coverage ===');
const missing: string[] = [];
for (const r of expectedTsRules) {
    const fired = !!tsRules[r];
    console.log(`  ${fired ? '✅' : '❌'} ${r}: ${fired ? `${tsRules[r]} hit(s)` : 'NOT FIRED'}`);
    if (!fired) missing.push(r);
}

if (missing.length === 0) {
    console.log('\n✅ All TS rules fired correctly!');
} else {
    console.log(`\n⚠️  Missing rules: ${missing.join(', ')}`);
}

// Check specific expected counts
console.log('\n=== Expected Counts ===');
const expectedCounts: Record<string, number> = {
    'TS-MOD-01': 3,  // BadNamespace, AnotherBadNamespace, LegacyModule
    'TS-MOD-02': 3,  // import http = require, const path = require, let lodash = require
    'TS-MOD-03': 2,  // export let mutableCounter, export let mutableName
    'TS-MOD-04': 2,  // const enum Direction, export const enum Color
    'TS-TYPE-01': 3,  // String, Boolean+Number (on same line counted once), Object
    'TS-TYPE-02': 3,  // type UserConfig = {, export type ApiResponse = {, type Pair
    'TS-TYPE-03': 5,  // Array<string>, Array<number>, ReadonlyArray<string>, Array<MyType>, Array<any>
    'TS-TYPE-04': 4,  // NullableResponse, MaybeValue, ComplexNullable, ApiResponse (has |null in body)
    'TS-TYPE-05': 3,  // No any type
    'TS-TYPE-06': 2,  // No empty object type (arg: {}, return {})
    'TS-TYPE-07': 2,  // Prefer tuple types
    'TS-CLASS-01': 4,  // #secretValue, #name, #id, #doSomething
    'TS-CLASS-02': 2,  // BadEmptyDefault, BadEmptyPublic
    'TS-CLASS-03': 2,  // a = new BadEmptyDefault, b = new BadEmptyPublic
    'TS-NAME-01': 2,  // IUserService, IConfigParams
    'TS-NAME-02': 4,  // _privateCounter, MAX_SIZE_, _timestamp, _getOldTimestamp
    'TS-DIS-02': 2,   // No @ts-ignore (2 instances total)
};
for (const [ruleId, expected] of Object.entries(expectedCounts)) {
    const actual = tsRules[ruleId] || 0;
    const ok = actual === expected;
    console.log(`  ${ok ? '✅' : '❌'} ${ruleId}: expected ${expected}, got ${actual}`);
}

// --- Regression checks ---
console.log('\n=== JS Regression ===');
const jsCode = fs.readFileSync('./codebase_test/bad_code.js', 'utf-8');
const jsResult = analyze(jsCode, 'javascript', 'bad_code.js');
console.log(`JS violations: ${jsResult.violations.length} (expected ~60)`);

console.log('\n=== Python Regression ===');
const pyCode = fs.readFileSync('./codebase_test/bad_code.py', 'utf-8');
const pyResult = analyze(pyCode, 'python');
console.log(`Python violations: ${pyResult.violations.length} (expected ~61)`);
