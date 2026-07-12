import { javascriptRules } from './analyzer/rules/javascript.js';
import * as fs from 'fs';

const noTabs = javascriptRules.find(r => r.id === 'JS-FMT-04')!;
const noBrace = javascriptRules.find(r => r.id === 'JS-FMT-06')!;

const code = `
// test
	const hasTabs = true;
function myFunc() 
{
    return 1;
}
`;

const lines = code.split('\n');
console.log('NoTabs violations:', noTabs.check(lines).length);
console.log('NoBrace violations:', noBrace.check(lines).length);

// Also check bad_code.js
const badCode = fs.readFileSync('codebase_test/bad_code.js', 'utf8').split('\n');
console.log('NoTabs on bad_code:', noTabs.check(badCode).length);
console.log('NoBrace on bad_code:', noBrace.check(badCode).length);
