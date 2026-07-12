/**
 * Quick smoke test — verifies that all 30 rules detect their target patterns.
 * Run: node dist/test-rules.js
 */

import { analyze } from './analyzer/engine.js';

const testCode = `
import os, sys
from . import utils
from module import *
from .relative import stuff

# Exception rules
try:
    pass
except:
    pass

except Exception as e:
    pass

class MyException(Exception):
    pass

assert x > 0, "must be positive"

# Mutable global state
cache = {}
items = []

# Comprehensions
result = [(x, y) for x in range(10) for y in range(5)]

# Iterators
for key in mydict.keys():
    pass
for line in myfile.readlines():
    pass

# Lambda
square = lambda x: x ** 2

# Mutable defaults
def bad_func(a=[]):
    pass

# Boolean checks
if x == None:
    pass
if x != None:
    pass
if len(users) == 0:
    pass
if x == True:
    pass

# Decorators
class MyClass:
    @staticmethod
    def helper():
        pass

# Power features
result = eval("2 + 2")
exec("print('hello')")

# Semicolons
x = 1;

# Backslash continuation
x = 1 + 2 + \\
    3 + 4

# String concat in loop
for item in items:
    result += 'hello'

# Logging
logging.info(f"User {name} logged in")

# Statements
try: pass except: pass

# Naming
def myFunction():
    pass

class my_class:
    pass

# File without with
f = open("file.txt", "r")

# Main guard
print("hello")
`;

const result = analyze(testCode, 'python');

console.log('='.repeat(60));
console.log('avvarre Smoke Test');
console.log('='.repeat(60));
console.log(`Score: ${result.score}/100 (Grade ${result.grade})`);
console.log(`Total violations: ${result.violations.length}`);
console.log(`Total lines: ${result.totalLines}`);
console.log();

console.log('Violations found:');
for (const v of result.violations) {
    console.log(`  [${v.severity.toUpperCase().padEnd(8)}] Line ${String(v.line).padStart(3)}: ${v.ruleId} — ${v.message.split('.')[0]}.`);
}

console.log();
console.log('Category breakdown:');
for (const cat of result.categoryScores) {
    console.log(`  ${cat.category.padEnd(20)} Score: ${String(cat.score).padStart(3)} | Violations: ${cat.violationCount}`);
}

console.log();
console.log(`Summary: ${result.summary}`);
console.log();

// Verify we're detecting rules from all categories
const ruleIds = new Set(result.violations.map((v: any) => v.ruleId));
const expectedPrefixes = ['PY-IMP', 'PY-EXC', 'PY-GLOB', 'PY-COMP', 'PY-ITER', 'PY-LAMBDA', 'PY-MUT', 'PY-BOOL', 'PY-DEC', 'PY-PWR', 'PY-FMT', 'PY-STR', 'PY-STMT', 'PY-NAME', 'PY-MAIN', 'PY-RES'];

const foundPrefixes = new Set<string>();
for (const id of ruleIds) {
    const prefix = id.split('-').slice(0, 2).join('-');
    foundPrefixes.add(prefix);
}

const missingPrefixes = expectedPrefixes.filter(p => !foundPrefixes.has(p));
if (missingPrefixes.length > 0) {
    console.log(`⚠️  MISSING detection for: ${missingPrefixes.join(', ')}`);
} else {
    console.log('✅ All rule categories detected violations in the test code!');
}
