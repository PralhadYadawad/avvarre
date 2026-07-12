import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { analyze } from './analyzer/engine.js';
import { Language } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '..');
const TEST_DIR = path.join(PROJECT_ROOT, 'codebase_test');

async function testLanguage(lang: Language, fileName: string, expectedRules: Set<string>) {
    console.log(`\n>>> Testing ${lang.toUpperCase()} Rules ...`);
    
    const filePath = path.join(TEST_DIR, fileName);
    if (!fs.existsSync(filePath)) {
        console.error(`❌ Test file not found: ${filePath}`);
        process.exit(1);
    }

    const code = fs.readFileSync(filePath, 'utf-8');
    const result = analyze(code, lang);

    const triggeredRules = new Set(result.violations.map((v: any) => v.ruleId));
    let allPassed = true;

    for (const rule of expectedRules) {
        if (triggeredRules.has(rule)) {
            console.log(`✅ [${rule}] is working correctly.`);
        } else {
            console.error(`❌ [${rule}] FAILED to trigger.`);
            allPassed = false;
        }
    }

    // Check for unexpected rules firing
    for (const triggered of triggeredRules) {
        if (!expectedRules.has(triggered as string)) {
            console.warn(`⚠️ Unexpected rule triggered: [${triggered}]`);
            // We don't fail the build for this in regex mode, but we flag it
        }
    }

    return { passed: allPassed, count: expectedRules.size };
}

async function runTests() {
    console.log('--------------------------------------------------');
    console.log('Testing Obscure Formats (Vimscript, Lisp, AngularJS)');
    console.log('--------------------------------------------------');

    const vimscriptExpected = new Set(['VIM-STR-01', 'VIM-CMD-01', 'VIM-CMD-02', 'VIM-VAR-01']);
    const lispExpected = new Set(['LISP-FMT-01', 'LISP-FMT-02']);
    const angularExpected = new Set(['ANG-MOD-01', 'ANG-CTRL-01']);

    const [vimResult, lispResult, angResult] = await Promise.all([
        testLanguage('vimscript', 'bad_code.vim', vimscriptExpected),
        testLanguage('lisp', 'bad_code.lisp', lispExpected),
        testLanguage('angular', 'bad_code.ng.js', angularExpected)
    ]);

    console.log('\n--------------------------------------------------');
    if (vimResult.passed && lispResult.passed && angResult.passed) {
        const total = vimResult.count + lispResult.count + angResult.count;
        console.log(`🎉 ALL Obscure rules triggered successfully! (Total: ${total})`);
        process.exit(0);
    } else {
        console.error('❌ Some rules failed to trigger. Check the output above.');
        process.exit(1);
    }
}

runTests().catch(console.error);
