import * as fs from 'fs';
import * as path from 'path';
import { jsonRules } from './analyzer/rules/json.js';
import { xmlRules } from './analyzer/rules/xml.js';
import { Violation } from './types.js';

console.log('--------------------------------------------------');
console.log('Testing JSON & XML Rules (Regex Pattern Matching)');
console.log('--------------------------------------------------');

// 1. Test JSON
console.log('\n>>> Testing JSON Rules ...');
const jsonPath = path.join(process.cwd(), 'codebase_test', 'bad_code.json');
const jsonLines = fs.readFileSync(jsonPath, 'utf8').split('\n');

const jsonViolations: Violation[] = [];
for (const rule of jsonRules) {
    jsonViolations.push(...rule.check(jsonLines, 'bad_code.json'));
}

const expectedJsonRules = [
    'JSON-NAME-01', // User_Name (not camelCase)
    'JSON-NAME-02', // class (reserved keyword)
    'JSON-STR-01'   // Both data and error present
];

let jsonMissing = 0;
for (const ruleId of expectedJsonRules) {
    const found = jsonViolations.some(v => v.ruleId === ruleId);
    if (found) {
        console.log(`✅ [${ruleId}] is working correctly.`);
    } else {
        console.error(`❌ [${ruleId}] FAILED: Did not trigger on bad_code.json`);
        jsonMissing++;
    }
}

// 2. Test XML
console.log('\n>>> Testing XML Rules ...');
const xmlPath = path.join(process.cwd(), 'codebase_test', 'bad_code.xml');
const xmlLines = fs.readFileSync(xmlPath, 'utf8').split('\n');

const xmlViolations: Violation[] = [];
for (const rule of xmlRules) {
    xmlViolations.push(...rule.check(xmlLines, 'bad_code.xml'));
}

// XML-NAME-01 should trigger multiple times (RootNode, User_Profile, First_Name, InvalidIndent, WayTooManySpaces)
const expectedXmlRules = [
    'XML-NAME-01', // multiple tags
    'XML-NAME-02', // g: and MyNamespace:
    'XML-VAL-01',  // isEnabled="1" and hasAccess="0"
    'XML-FMT-01'   // Tabs and 7 spaces
];

let xmlMissing = 0;
for (const ruleId of expectedXmlRules) {
    const found = xmlViolations.some(v => v.ruleId === ruleId);
    if (found) {
        console.log(`✅ [${ruleId}] is working correctly.`);
    } else {
        console.error(`❌ [${ruleId}] FAILED: Did not trigger on bad_code.xml`);
        xmlMissing++;
    }
}

console.log('\n--------------------------------------------------');
if (jsonMissing === 0 && xmlMissing === 0) {
    console.log(`🎉 ALL JSON/XML rules triggered successfully! (JSON: ${jsonRules.length}, XML: ${xmlRules.length})`);
    process.exit(0);
} else {
    console.error(`⚠️  Missing triggers: ${jsonMissing} JSON, ${xmlMissing} XML`);
    process.exit(1);
}
