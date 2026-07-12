import { analyze } from './analyzer/engine.js';
import * as fs from 'fs';
import * as path from 'path';

// Tricky Python code with multi-line strings and comments
const trickyPython = `
"""
Multi-line string starts here
import os # Should NOT be caught (inside string)
def badCamelCase(): # Should NOT be caught (inside string)
    pass
"""

import math, sys # PY-IMP-03: Multi-module import

# Comment with import os (should not be caught)

def badCamelCase(): # PY-NAME-01: Snake case violation
    x = 1; # PY-FMT-01: Semicolon
    y = [] # PY-GLOB-01: Mutable global (if at top level)
    return x

'''
Another triple quote
except: # Should NOT be caught (inside string)
'''

class MyFault(Exception): # PY-EXC-03: Naming
    pass

try:
    print("test")
except: # PY-EXC-01: Bare except
    pass

data = [x for x in range(10) for y in range(5)] # PY-COMP-01: Multiple for clauses
`;

const tempFile = path.join(process.cwd(), 'temp_test.py');
fs.writeFileSync(tempFile, trickyPython);

console.log('--- Testing Hardened Python Analysis ---');
const result = analyze(trickyPython, 'python', 'temp_test.py');

console.log(`Grade: ${result.grade} (${result.score})`);
console.log(`Total Violations: ${result.violations.length}`);

result.violations.forEach(v => {
    console.log(`[${v.ruleId}] Line ${v.line}: ${v.message}`);
});

// Cleanup
fs.unlinkSync(tempFile);

// Expected violations:
// 1. PY-IMP-03 (math, sys)
// 2. PY-NAME-01 (badCamelCase)
// 3. PY-FMT-01 (semicolon)
// 4. PY-EXC-03 (MyFault)
// 5. PY-EXC-01 (Bare except)
// 6. PY-COMP-01 (Multiple for)
// Note: PY-GLOB-01 won't trigger for 'y' because it's inside a function now.
// If badCamelCase was at top level, it would.

const expectedIds = ['PY-IMP-03', 'PY-NAME-01', 'PY-FMT-01', 'PY-EXC-03', 'PY-EXC-01', 'PY-COMP-01', 'PY-FMT-02', 'PY-DOC-01', 'PY-DOC-02'];
const foundIds = result.violations.map((v: any) => v.ruleId);

const missing = expectedIds.filter(id => !foundIds.includes(id));
const extra = foundIds.filter(id => !expectedIds.includes(id));

if (missing.length === 0 && extra.length === 0) {
    console.log('\n✅ Verification SUCCESS: All expected rules triggered correctly and no false positives found.');
} else {
    console.log('\n❌ Verification FAILED:');
    if (missing.length > 0) console.log(`Missing: ${missing.join(', ')}`);
    if (extra.length > 0) console.log(`Extra: ${extra.join(', ')}`);
}
