import { javascriptRules } from './analyzer/rules/javascript.js';
import { typescriptRules } from './analyzer/rules/typescript.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

async function verify(filePath: string, rules: any[]) {
    console.log(`\nVerifying ${filePath}...`);
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(rootDir, filePath);
    const content = fs.readFileSync(absolutePath, 'utf8');
    const lines = content.split('\n');

    let allViolations = [];
    for (const rule of rules) {
        const violations = rule.check(lines, filePath);
        allViolations.push(...violations);
    }

    console.log(`Found ${allViolations.length} violations:`);
    allViolations.sort((a, b) => a.line - b.line);
    for (const v of allViolations) {
        console.log(`[${v.ruleId}] Line ${v.line}: ${v.message}`);
    }
}

async function run() {
    try {
        await verify('bad_code.js', javascriptRules);
        await verify('bad_code.ts', typescriptRules);
    } catch (err) {
        console.error(err);
    }
}

run();
