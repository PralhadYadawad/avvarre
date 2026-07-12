/**
 * Quick test: run JS rules against bad_code.js
 */
import { analyze, listRules } from './analyzer/engine.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testFile = path.resolve(__dirname, '..', 'codebase_test', 'bad_code.js');
const code = fs.readFileSync(testFile, 'utf-8');

// Run analysis
const result = analyze(code, 'javascript');

console.log(`\\n=== JavaScript Rules Test ===`);
console.log(`File: bad_code.js`);
console.log(`Total violations: ${result.violations.length}`);
console.log(`Score: ${result.score}/100 (${result.grade})`);
console.log(`\\n--- Violations by rule ---`);

// Count by rule
const byRule: Record<string, number> = {};
for (const v of result.violations) {
    byRule[v.ruleId] = (byRule[v.ruleId] || 0) + 1;
}

// Sort by rule ID
const sortedRules = Object.entries(byRule).sort(([a], [b]) => a.localeCompare(b));
for (const [ruleId, count] of sortedRules) {
    console.log(`  ${ruleId}: ${count} violation(s)`);
}

// Check which rules did NOT fire
const allJsRules = listRules('javascript' as any);
const firedRuleIds = new Set(Object.keys(byRule));
const missingRules = allJsRules.filter(r => !firedRuleIds.has(r.id));

if (missingRules.length > 0) {
    console.log(`\\n--- WARNING: Rules that did NOT fire ---`);
    for (const r of missingRules) {
        console.log(`  ${r.id}: ${r.name}`);
    }
} else {
    console.log(`\\nâœ… All ${allJsRules.length} rules fired!`);
}

// Also verify Python still works
const pyFile = path.resolve(__dirname, '..', 'codebase_test', 'bad_code.py');
const pyCode = fs.readFileSync(pyFile, 'utf-8');
const pyResult = analyze(pyCode, 'python');
console.log(`\\n=== Python Regression ===`);
console.log(`Violations: ${pyResult.violations.length} (expected ~61)`);
console.log(`Score: ${pyResult.score}/100 (${pyResult.grade})`);
