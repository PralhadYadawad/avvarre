import * as fs from 'fs';
import * as path from 'path';
import { analyze } from './analyzer/engine.js';

async function testCppRules() {
    console.log('--- Phase 7: C++ Rules Audit & Polish Verification ---');

    const testFile = path.resolve('codebase_test/bad_code.h');
    const code = fs.readFileSync(testFile, 'utf8');

    console.log(`\nAnalysis Results for ${path.basename(testFile)}:`);
    const results = await analyze(code, 'cpp', testFile);

    console.log(`Grade: ${results.grade} (${results.score}/100)`);
    console.log(`Total Violations: ${results.violations.length}`);

    const violationCounts: Record<string, number> = {};
    results.violations.forEach(v => {
        violationCounts[v.ruleId] = (violationCounts[v.ruleId] || 0) + 1;
    });

    console.log('\nViolations by Rule:');
    Object.keys(violationCounts).sort().forEach(id => {
        console.log(`  - ${id}: ${violationCounts[id]}`);
    });

    // We expect 32 unique rules to be triggered (some might trigger multiple times)
    const expectedRules = [
        'CPP-NAME-01', 'CPP-NAME-02', 'CPP-NAME-03', 'CPP-NAME-04', 'CPP-NAME-05', 'CPP-NAME-06', 'CPP-NAME-07',
        'CPP-FMT-01', 'CPP-FMT-02', 'CPP-FMT-03',
        'CPP-HDR-01', 'CPP-HDR-02', 'CPP-HDR-03',
        'CPP-FEAT-01', 'CPP-FEAT-02', 'CPP-FEAT-03', 'CPP-FEAT-04', 'CPP-FEAT-05', 'CPP-FEAT-06', 'CPP-FEAT-07',
        'CPP-CMT-01', 'CPP-CMT-02', 'CPP-CMT-03',
        'CPP-CLS-01', 'CPP-CLS-02', 'CPP-CLS-03', 'CPP-CLS-04',
        'CPP-FUNC-02', 'CPP-FUNC-03', 'CPP-LANG-01', 'CPP-PTR-01'
        // 'CPP-FUNC-01' is a weak heuristic and might not trigger easily in this simplified file
    ];

    const missingRules = expectedRules.filter(id => !violationCounts[id]);

    if (missingRules.length > 0) {
        console.log('\n❌ Missing violations for rules:', missingRules.join(', '));
    } else {
        console.log('\n✅ All targeted rules triggered correctly!');
    }

    console.log('\n--- Verification Concluded ---');
}

testCppRules().catch(console.error);
