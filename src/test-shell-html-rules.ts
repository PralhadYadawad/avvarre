/**
 * Test runner for Shell and HTML/CSS rules.
 * Runs analysis on bad code test files and reports which rules fired.
 */

import { analyze, listRules } from './analyzer/engine.js';
import * as fs from 'fs';

function runTest(filepath: string, language: 'shell' | 'html' | 'css') {
    const code = fs.readFileSync(filepath, 'utf-8');
    const result = analyze(code, language, filepath);

    console.log(`\n${'═'.repeat(70)}`);
    console.log(`  ${language.toUpperCase()} TEST — ${filepath}`);
    console.log(`${'═'.repeat(70)}`);
    console.log(`  Score: ${result.score}/100  Grade: ${result.grade}`);
    console.log(`  Violations: ${result.violations.length}`);
    console.log(`${'─'.repeat(70)}`);

    // Group violations by rule ID
    const byRule = new Map<string, number>();
    for (const v of result.violations) {
        byRule.set(v.ruleId, (byRule.get(v.ruleId) || 0) + 1);
    }

    // Show each rule that fired
    for (const [ruleId, count] of [...byRule.entries()].sort()) {
        console.log(`  ✅ ${ruleId} — fired ${count}x`);
    }

    // Check which rules did NOT fire
    const allRules = listRules(language);
    const firedIds = new Set(byRule.keys());
    const missed = allRules.filter(r => !firedIds.has(r.id));
    if (missed.length > 0) {
        console.log(`\n  ⚠️  Rules that did NOT fire (${missed.length}):`);
        for (const r of missed) {
            console.log(`    ❌ ${r.id} — ${r.name}`);
        }
    } else {
        console.log(`\n  🎉 ALL ${allRules.length} rules fired!`);
    }

    // Show first 5 violations as sample
    console.log(`\n  Sample violations:`);
    for (const v of result.violations.slice(0, 8)) {
        console.log(`    L${v.line}: [${v.ruleId}] ${v.message}`);
    }
}

// Run tests
console.log('\n🔍 avvarre Rules Test Suite — Shell + HTML/CSS\n');

runTest('codebase_test/bad_code.sh', 'shell');
runTest('codebase_test/bad_code.html', 'html');
runTest('codebase_test/bad_code.css', 'css');

console.log(`\n${'═'.repeat(70)}`);
console.log('  DONE');
console.log(`${'═'.repeat(70)}\n`);
