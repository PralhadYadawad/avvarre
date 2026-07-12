/**
 * Test runner for Go rules — All Sessions (§Naming + §Imports + §Errors + §Formatting + §Language + §Documentation)
 *
 * Usage:
 *   npm run build && node dist/test-go-rules.js
 */

import * as fs from 'fs';
import * as path from 'path';
import { analyze } from './analyzer/engine.js';
import type { AnalysisResult } from './types.js';

const BAD_CODE_PATH = path.resolve('codebase_test', 'bad_code.go');
const badCode = fs.readFileSync(BAD_CODE_PATH, 'utf-8');

function runTest(name: string, result: AnalysisResult) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`TEST: ${name}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Score: ${result.score}/100  Grade: ${result.grade}`);
    console.log(`Total violations: ${result.violations.length}`);
    console.log(`Lines analyzed: ${result.totalLines}`);

    // Group by rule ID
    const byRule = new Map<string, number>();
    for (const v of result.violations) {
        byRule.set(v.ruleId, (byRule.get(v.ruleId) || 0) + 1);
    }
    console.log('\nViolations by rule:');
    for (const [ruleId, count] of [...byRule.entries()].sort()) {
        console.log(`  ${ruleId}: ${count}`);
    }

    // Print each violation
    console.log('\nAll violations:');
    for (const v of result.violations) {
        console.log(`  L${v.line} [${v.severity}] ${v.ruleId}: ${v.message}`);
    }
}

// ── Test 1: Bad Go code should trigger all 20 rules ────────────────────────

console.log('\n🔍 Running Go rules test on bad_code.go...\n');
const badResult = analyze(badCode, 'go', 'bad_code.go');
runTest('Bad Go Code (should have many violations)', badResult);

// Verify every rule fires at least once
// Verify every rule fires at least once
const expectedRules = [
    'GO-DOC-01', 'GO-DOC-02', 'GO-DOC-03',
    'GO-ERR-03', 'GO-ERR-04', 'GO-ERR-05',
    'GO-FMT-01', 'GO-FMT-02', 'GO-FMT-04',
    'GO-IMP-01', 'GO-IMP-02', 'GO-IMP-03',
    'GO-LANG-01', 'GO-LANG-02', 'GO-LANG-03',
    'GO-NAME-01', 'GO-NAME-02', 'GO-NAME-03', 'GO-NAME-04', 'GO-NAME-05', 'GO-NAME-07'
];

const firedRules = new Set(badResult.violations.map(v => v.ruleId));
const missingRules = expectedRules.filter(r => !firedRules.has(r));

console.log(`\n${'='.repeat(60)}`);
if (missingRules.length === 0) {
    console.log(`✅ ALL ${expectedRules.length} EXPECTED RULES FIRED — Go implementation complete!`);
} else {
    console.log(`❌ MISSING RULES: ${missingRules.join(', ')}`);
    process.exit(1);
}

// ── Test 2: Good Go code should have zero violations ───────────────────

const goodCode = `// Package math provides basic math utilities.
package math

import (
	"fmt"
	"math"
)

// MaxRetryCount is the maximum number of retries.
const MaxRetryCount = 5

// Calculator performs math operations.
type Calculator struct {
	precision int
}

// Add returns the sum of a and b.
func (c *Calculator) Add(a, b float64) float64 {
	return a + b
}

// ErrNotFound indicates a value was not found.
var ErrNotFound = fmt.Errorf("not found")
`;

const goodResult = analyze(goodCode, 'go', 'math.go');
runTest('Good Go Code (should have 0 violations)', goodResult);

if (goodResult.violations.length === 0) {
    console.log('\n✅ Good code passed — zero violations!');
} else {
    console.log(`\n❌ Good code has ${goodResult.violations.length} violations (expected 0)`);
    process.exit(1);
}

// ── Test 3: Python regression check ────────────────────────────────────

const pyCode = fs.readFileSync(path.resolve('codebase_test', 'bad_code.py'), 'utf-8');
const pyResult = analyze(pyCode, 'python', 'bad_code.py');
console.log(`\n${'='.repeat(60)}`);
console.log(`Python regression: ${pyResult.violations.length} violations (expected ~61)`);
if (pyResult.violations.length >= 50) {
    console.log('✅ Python regression OK');
} else {
    console.log('❌ Python regression FAILED');
    process.exit(1);
}

console.log(`\n${'='.repeat(60)}`);
console.log('🎉 All Go tests passed! 27 rules implemented.');
