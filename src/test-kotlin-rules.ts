/**
 * test-kotlin-rules.ts — Test runner for Kotlin style rules.
 *
 * Usage: npx ts-node test-kotlin-rules.ts
 *   (or: npm run build && node dist/test-kotlin-rules.js)
 *
 * Reads codebase_test/bad_code.kt and checks that:
 *   1. Every expected rule ID fires at least once.
 *   2. The total violations match the expected count (within tolerance).
 */

import * as fs from 'fs';
import * as path from 'path';
import { analyze } from './analyzer/engine.js';

// ── Expected Results (Session 1) ────────────────────────────────────────────

const expectedRules: string[] = [
    'KT-SRC-01', // No wildcard imports
    'KT-SRC-02', // No tabs
    'KT-SRC-03', // No semicolons
    'KT-SRC-04', // Named escape sequences
    'KT-FMT-01', // 100-char line limit
    'KT-FMT-02', // K&R brace style
    'KT-FMT-03', // Space before {
    'KT-FMT-04', // Empty block { }

    // Session 2
    'KT-FMT-05', // Space after keyword before (
    'KT-FMT-06', // No space around ::
    'KT-FMT-07', // No space around .
    'KT-FMT-08', // No space around ..
    'KT-FMT-09', // Space after comma
    'KT-FMT-10', // Space before colon in class
    'KT-FMT-11', // Space before EOL comment

    // Session 3
    'KT-NAME-01', // Package naming
    'KT-NAME-02', // Class naming
    'KT-NAME-03', // Function naming
    'KT-NAME-04', // Constant naming
    'KT-NAME-05', // Variable naming
    'KT-NAME-06', // Hungarian notation
    'KT-NAME-07', // Backtick functions
    'KT-NAME-08', // Scalar const val

    // Session 4
    'KT-FMT-12', // Consecutive blank lines
    'KT-DOC-01', // KDoc empty descriptions
    'KT-DOC-02', // KDoc generic summary
    'KT-DOC-03', // KDoc tag order

    // Audit & Polish
    'KT-FMT-13', // Braces for multi-line conditionals
    'KT-FMT-14', // Space around binary operators
    'KT-SRC-05', // Filename matches class
    'KT-FMT-15', // Continuation indentation
];

const expectedTotalViolations = 65; // Increased for new audit rules
const tolerance = 10;

// ── Run Analysis ─────────────────────────────────────────────────────────────

const testFile = path.join(process.cwd(), 'codebase_test', 'bad_code.kt');
const code = fs.readFileSync(testFile, 'utf-8');
const result = analyze(code, 'kotlin', 'bad_code.kt');

// Analysis for KT-SRC-05 (needs single-class file)
const code01 = fs.readFileSync(path.join(process.cwd(), 'codebase_test', 'bad01.kt'), 'utf-8');
const result01 = analyze(code01, 'kotlin', 'bad01.kt');
result.violations.push(...result01.violations);

// ── Verify Results ──────────────────────────────────────────────────────────

const firedRules = new Set(result.violations.map((v: { ruleId: string }) => v.ruleId));
let allPassed = true;

console.log('\n========================================');
console.log('  avvarre — Kotlin Rules Test Suite');
console.log('========================================\n');

// Check each expected rule fires at least once
for (const ruleId of expectedRules) {
    const fired = firedRules.has(ruleId);
    const count = result.violations.filter((v: { ruleId: string }) => v.ruleId === ruleId).length;
    const status = fired ? '✅' : '❌';
    console.log(`  ${status} ${ruleId.padEnd(14)} — ${fired ? `${count} violation(s)` : 'DID NOT FIRE'}`);
    if (!fired) allPassed = false;
}

// Check total violations
console.log('\n----------------------------------------');
console.log(`  Total violations: ${result.violations.length} (expected ~${expectedTotalViolations} ±${tolerance})`);

const withinTolerance = Math.abs(result.violations.length - expectedTotalViolations) <= tolerance;
if (!withinTolerance) {
    console.log(`  ⚠️  Total count is outside ±${tolerance} tolerance!`);
    allPassed = false;
}

// Show all violations grouped by rule
console.log('\n  === Violation Detail ===');
const byRule = new Map<string, typeof result.violations>();
for (const v of result.violations) {
    if (!byRule.has(v.ruleId)) byRule.set(v.ruleId, []);
    byRule.get(v.ruleId)!.push(v);
}
for (const [ruleId, violations] of byRule) {
    console.log(`\n  [${ruleId}]`);
    for (const v of violations) {
        console.log(`    Line ${String(v.line).padStart(3)}: ${v.message.slice(0, 70)}`);
    }
}

// Score & Grade
console.log('\n----------------------------------------');
console.log(`  Score: ${result.score}/100  Grade: ${result.grade}`);
console.log(`  Summary: ${result.summary}`);

// Final judgement
console.log('\n========================================');
if (allPassed) {
    console.log('  🎉 ALL KOTLIN SESSIONS 1-4 & AUDIT POLISH RULES PASSING');
} else {
    console.log('  ❌ SOME RULES FAILED — see above');
    process.exit(1);
}
console.log('========================================\n');
