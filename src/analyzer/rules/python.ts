/**
 * Python Rules — Google Python Style Guide
 * https://google.github.io/styleguide/pyguide.html
 *
 * Rules are added incrementally, 2 guide sections at a time.
 * Each rule is a self-contained check function.
 *
 * Current sections covered:
 *   §2.2 Imports
 *   §2.3 Packages
 */

import { Rule, Violation } from '../../types.js';

// ============================================================================
// HELPER UTILITIES
// ============================================================================

/**
 * Strip string literals and comments from Python source while preserving
 * line count and positions. This prevents regex rules from false-positive
 * matching inside comments or string literals.
 *
 * Handles:
 *   - Single-line comments: # ...
 *   - Triple-quoted strings: '''...''' or """..."""
 *   - Single-quoted strings: '...' or "..." (including escapes)
 */
export function getCleanLines(lines: string[]): string[] {
    const code = lines.join('\n');
    let cleanCode = '';

    type State = 'NORMAL' | 'COMMENT' | 'STRING_S' | 'STRING_D' | 'TRIPLE_S' | 'TRIPLE_D';
    let state: State = 'NORMAL';
    let i = 0;

    while (i < code.length) {
        const char = code[i];
        const nextChar = code[i + 1] || '';
        const next2 = code.slice(i + 1, i + 3);

        // Unconditionally preserve newlines to keep line count stable
        if (char === '\n') {
            cleanCode += '\n';
            if (state === 'COMMENT') state = 'NORMAL';
            i++;
            continue;
        }

        switch (state) {
            case 'NORMAL':
                if (char === '#') {
                    state = 'COMMENT';
                    cleanCode += ' ';
                    i++;
                } else if (char === "'" && next2 === "''") {
                    state = 'TRIPLE_S';
                    cleanCode += "'''";
                    i += 3;
                } else if (char === '"' && next2 === '""') {
                    state = 'TRIPLE_D';
                    cleanCode += '"""';
                    i += 3;
                } else if (char === "'") {
                    state = 'STRING_S';
                    cleanCode += char;
                    i++;
                } else if (char === '"') {
                    state = 'STRING_D';
                    cleanCode += char;
                    i++;
                } else {
                    cleanCode += char;
                    i++;
                }
                break;

            case 'COMMENT':
                cleanCode += ' ';
                i++;
                break;

            case 'STRING_S':
                if (char === '\\') {
                    cleanCode += '  ';
                    i += 2;
                } else if (char === "'") {
                    state = 'NORMAL';
                    cleanCode += char;
                    i++;
                } else {
                    cleanCode += ' ';
                    i++;
                }
                break;

            case 'STRING_D':
                if (char === '\\') {
                    cleanCode += '  ';
                    i += 2;
                } else if (char === '"') {
                    state = 'NORMAL';
                    cleanCode += char;
                    i++;
                } else {
                    cleanCode += ' ';
                    i++;
                }
                break;

            case 'TRIPLE_S':
                if (char === "'" && next2 === "''") {
                    state = 'NORMAL';
                    cleanCode += "'''";
                    i += 3;
                } else {
                    cleanCode += ' ';
                    i++;
                }
                break;

            case 'TRIPLE_D':
                if (char === '"' && next2 === '""') {
                    state = 'NORMAL';
                    cleanCode += '"""';
                    i += 3;
                } else {
                    cleanCode += ' ';
                    i++;
                }
                break;
        }
    }

    return cleanCode.split('\n');
}

/**
 * Check if a line is inside a string literal or comment.
 * Simple heuristic: line starts with # (comment) or is inside triple-quotes.
 * This is a basic approach; a proper parser would be needed for 100% accuracy.
 */
function isCommentLine(line: string): boolean {
    return line.trimStart().startsWith('#');
}

/**
 * Create a Violation object from a rule and match details.
 */
function createViolation(
    rule: Rule,
    line: number,
    codeSnippet: string,
    message: string,
    suggestion: string,
    column?: number,
): Violation {
    return {
        ruleId: rule.id,
        ruleName: rule.name,
        severity: rule.severity,
        line,
        column,
        message,
        suggestion,
        guideUrl: rule.guideUrl,
        codeSnippet: codeSnippet.trimEnd(),
    };
}

// ============================================================================
// §2.2 IMPORTS
// ============================================================================

/**
 * PY-IMP-01: No wildcard imports
 *
 * "Use import statements for packages and modules only, not for
 * individual types, classes, or functions."
 *
 * Wildcard imports (`from x import *`) pollute the namespace and make
 * it unclear which names are present. They can shadow other names and
 * cause hard-to-debug issues.
 *
 * Google Python Style Guide §2.2
 */
const noWildcardImports: Rule = {
    id: 'PY-IMP-01',
    name: 'No wildcard imports',
    description:
        'Wildcard imports (from x import *) pollute the namespace and make it unclear which names are available. Import specific names instead.',
    severity: 'high',
    guideSection: '§2.2',
    guideUrl: 'https://google.github.io/styleguide/pyguide.html#s2.2-imports',
    check(lines: string[], _filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        const pattern = /^(\s*from\s+\S+\s+import\s+\*)/;

        for (let i = 0; i < searchLines.length; i++) {
            const clean = searchLines[i];

            const match = clean.match(pattern);
            if (match) {
                // Extract the module name for a better suggestion
                const moduleMatch = clean.match(/from\s+(\S+)\s+import\s+\*/);
                const moduleName = moduleMatch ? moduleMatch[1] : 'module';

                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        lines[i],
                        `Wildcard import found: "${lines[i].trim()}". This imports all names from ${moduleName}, polluting the namespace.`,
                        `Import specific names instead: "from ${moduleName} import name1, name2"`,
                    ),
                );
            }
        }
        return violations;
    },
};

/**
 * PY-IMP-02: No relative imports
 *
 * "Do not use relative names in imports. Even if the module is in the
 * same package, use the full package name. This helps prevent
 * unintentionally importing a package twice."
 *
 * Google Python Style Guide §2.2.4
 */
const noRelativeImports: Rule = {
    id: 'PY-IMP-02',
    name: 'No relative imports',
    description:
        'Relative imports (from . import x or from .. import y) should not be used. Use full package paths instead to prevent accidentally importing a package twice.',
    severity: 'medium',
    guideSection: '§2.2.4',
    guideUrl: 'https://google.github.io/styleguide/pyguide.html#s2.2-imports',
    check(lines: string[], _filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        // Matches: from . import x, from .. import x, from .module import x
        const pattern = /^\s*from\s+\.\.?\s/;

        for (let i = 0; i < searchLines.length; i++) {
            const clean = searchLines[i];

            if (pattern.test(clean)) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        lines[i],
                        `Relative import found: "${lines[i].trim()}". Use the full package path instead.`,
                        `Replace with absolute import using the full package name, e.g. "from mypackage.module import name"`,
                    ),
                );
            }
        }
        return violations;
    },
};

/**
 * PY-IMP-03: No multi-module imports on a single line
 *
 * "Imports should be on separate lines."
 *
 * Google Python Style Guide §3.13
 *
 * Exception: `from typing import ...` and `from collections.abc import ...`
 * are allowed to have multiple names on one line.
 */
const noMultiImports: Rule = {
    id: 'PY-IMP-03',
    name: 'No multi-module imports',
    description:
        'Each import should be on its own line. "import os, sys" should be split into "import os" and "import sys" on separate lines.',
    severity: 'low',
    guideSection: '§3.13',
    guideUrl: 'https://google.github.io/styleguide/pyguide.html#s3.13-imports-formatting',
    check(lines: string[], _filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        // Matches: import os, sys (but NOT from x import y, z which is fine for typing)
        const pattern = /^\s*import\s+\w[\w.]*\s*,\s*\w/;

        for (let i = 0; i < searchLines.length; i++) {
            const clean = searchLines[i];

            if (pattern.test(clean)) {
                // Extract the module names
                const modulePart = lines[i].replace(/^\s*import\s+/, '').trim();
                const modules = modulePart.split(',').map(m => m.trim());

                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        lines[i],
                        `Multiple modules imported on one line: "${lines[i].trim()}".`,
                        `Put each import on its own line:\n${modules.map(m => `import ${m}`).join('\n')}`,
                    ),
                );
            }
        }
        return violations;
    },
};

// ============================================================================
// §2.3 PACKAGES
// ============================================================================

// PY-IMP-04 (full package paths) deferred to AI layer — requires project
// structure context that pattern matching alone cannot provide.

// ============================================================================
// §2.4 EXCEPTIONS
// ============================================================================

/**
 * PY-EXC-01: No bare except
 *
 * "Never use catch-all except: statements, or catch Exception or
 * StandardError, unless you are re-raising the exception, or creating
 * an isolation point in the program where exceptions are not propagated
 * but are recorded and suppressed instead."
 *
 * Bare except catches EVERYTHING including sys.exit(), Ctrl+C interrupts,
 * unittest failures, and misspelled names — things you almost never want
 * to silently swallow.
 *
 * Google Python Style Guide §2.4
 */
const noBareExcept: Rule = {
    id: 'PY-EXC-01',
    name: 'No bare except',
    description:
        'Bare except: catches everything including KeyboardInterrupt, SystemExit, and misspelled names. Always catch specific exception types.',
    severity: 'critical',
    guideSection: '§2.4',
    guideUrl: 'https://google.github.io/styleguide/pyguide.html#s2.4-exceptions',
    check(lines: string[], _filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        // Matches "except:" with nothing between except and colon
        // but NOT "except SomeError:" or "except (A, B):"
        const pattern = /^\s*except\s*:/;

        for (let i = 0; i < searchLines.length; i++) {
            if (pattern.test(searchLines[i])) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        lines[i],
                        'Bare except: catches all exceptions including KeyboardInterrupt and SystemExit.',
                        'Catch specific exceptions: "except ValueError:" or at minimum "except Exception:" if you must catch broadly (and re-raise or log).',
                    ),
                );
            }
        }
        return violations;
    },
};

/**
 * PY-EXC-02: No broad Exception/StandardError catch
 *
 * Catching broadly catches too much — including programming errors
 * that should propagate. Only acceptable if re-raising or as an
 * isolation point (e.g. thread guard).
 *
 * Google Python Style Guide §2.4
 */
const noBroadExcept: Rule = {
    id: 'PY-EXC-02',
    name: 'No broad Exception catch',
    description:
        'Catching Exception or StandardError is too broad. Catch specific exception types unless you are re-raising the exception.',
    severity: 'high',
    guideSection: '§2.4',
    guideUrl: 'https://google.github.io/styleguide/pyguide.html#s2.4-exceptions',
    check(lines: string[], _filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        // Matches: except Exception: or except Exception as e: or except StandardError:
        // Also matches except (ValueError, Exception):
        const pattern = /^\s*except\s+(\([^)]*(Exception|StandardError)[^)]*\)|Exception|StandardError)\s*(as\s+\w+\s*)?:/;

        for (let i = 0; i < searchLines.length; i++) {
            if (pattern.test(searchLines[i])) {
                // Check if the next non-empty, non-comment line is "raise" (re-raising is OK)
                let isReraising = false;
                for (let j = i + 1; j < Math.min(i + 5, searchLines.length); j++) {
                    const nextLine = searchLines[j].trimStart();
                    if (nextLine === '') continue;
                    if (nextLine.startsWith('raise')) {
                        isReraising = true;
                    }
                    break;
                }

                if (!isReraising) {
                    violations.push(
                        createViolation(
                            this,
                            i + 1,
                            lines[i],
                            `Broad exception catch: "${lines[i].trim()}". This catches too many exception types including programming errors.`,
                            'Catch specific exceptions (e.g. ValueError, IOError). If you must catch Exception, re-raise it after logging.',
                        ),
                    );
                }
            }
        }
        return violations;
    },
};

/**
 * PY-EXC-03: Exception names must end in "Error"
 *
 * "Exception names should end in Error and should not introduce
 * repetition (foo.FooError)."
 *
 * Google Python Style Guide §2.4
 */
const exceptionNaming: Rule = {
    id: 'PY-EXC-03',
    name: 'Exception names must end in Error',
    description:
        'Custom exception classes should end with "Error" (e.g. ConnectionError, not ConnectionException or ConnectionFault).',
    severity: 'medium',
    guideSection: '§2.4',
    guideUrl: 'https://google.github.io/styleguide/pyguide.html#s2.4-exceptions',
    check(lines: string[], _filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        // Matches: class FooException(Exception): or class MyFault(ValueError):
        const classPattern = /^\s*class\s+(\w+)\s*\(\s*(.*?Exception.*?|.*?Error.*?)\s*\)\s*:/;

        for (let i = 0; i < searchLines.length; i++) {
            const match = searchLines[i].match(classPattern);
            if (match) {
                const className = match[1];
                if (className.endsWith('Error')) continue;

                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        lines[i],
                        `Exception class "${className}" should end with "Error", not "Exception", "Fault", etc.`,
                        `Rename to "${className.replace(/(Exception|Fault|Problem|Failure)$/, '')}Error"`,
                    ),
                );
            }
        }
        return violations;
    },
};

/**
 * PY-EXC-04: No assert for validation
 *
 * "Do not use assert statements in place of conditionals or validating
 * preconditions. They must not be critical to the application logic.
 * assert conditionals are not guaranteed to be evaluated."
 *
 * assert statements are stripped when Python runs with -O flag, so any
 * code that depends on them for correctness will silently break.
 *
 * This rule flags assert statements that appear to be used for input
 * validation (i.e. at the beginning of functions, checking arguments).
 * Asserts in test files are excluded.
 *
 * Google Python Style Guide §2.4
 */
const noAssertForValidation: Rule = {
    id: 'PY-EXC-04',
    name: 'No assert for validation',
    description:
        'Do not use assert for input validation or enforcing preconditions. Assert statements are stripped with python -O. Use raise ValueError/TypeError instead.',
    severity: 'high',
    guideSection: '§2.4',
    guideUrl: 'https://google.github.io/styleguide/pyguide.html#s2.4-exceptions',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];

        // Skip test files — assert is expected and fine there
        if (filename && /test[_.]|_test\.py$|tests\.py$/i.test(filename)) {
            return violations;
        }

        const searchLines = cleanLines || getCleanLines(lines);
        // Matches: assert condition or assert(condition)
        const pattern = /^\s*assert[\s(]+/;

        for (let i = 0; i < searchLines.length; i++) {
            if (pattern.test(searchLines[i])) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        lines[i],
                        `Assert used: "${lines[i].trim()}". Assert statements are stripped with python -O and must not be critical to application logic.`,
                        'Use "if not condition: raise ValueError(message)" for input validation. Reserve assert for internal invariants that could be removed without breaking functionality.',
                    ),
                );
            }
        }
        return violations;
    },
};

// ============================================================================
// §2.5 MUTABLE GLOBAL STATE
// ============================================================================

/**
 * PY-GLOB-01: Avoid mutable global state
 *
 * "Avoid mutable global state."
 *
 * Module-level mutable objects (lists, dicts, sets) that get modified at
 * runtime break encapsulation, make testing hard, and can cause bugs
 * when modules are imported multiple times.
 *
 * Module-level CONSTANTS (UPPER_CASE, assigned from literals) are fine.
 * This rule flags module-level assignments of mutable objects (lists, dicts,
 * sets) that are NOT ALL_CAPS (i.e., not constants).
 *
 * Google Python Style Guide §2.5
 */
const noMutableGlobalState: Rule = {
    id: 'PY-GLOB-01',
    name: 'Avoid mutable global state',
    description:
        'Module-level mutable variables (lists, dicts, sets) should be avoided. They break encapsulation and make testing difficult. Use UPPER_CASE for constants.',
    severity: 'medium',
    guideSection: '§2.5',
    guideUrl: 'https://google.github.io/styleguide/pyguide.html#s2.5-mutable-global-state',
    check(lines: string[], _filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        // Matches: variable_name = [] or variable_name = {} or variable_name = set()
        const mutablePattern = /^([a-z_]\w*)\s*=\s*(\[\s*\]|\{\s*\}|set\(\s*\)|list\(\s*\)|dict\(\s*\))/;

        for (let i = 0; i < searchLines.length; i++) {
            const clean = searchLines[i];

            // Only flag module-level (no indentation) assignments
            if (clean.startsWith(' ') || clean.startsWith('\t')) continue;

            const match = clean.match(mutablePattern);
            if (match) {
                const varName = match[1];
                if (varName === varName.toUpperCase() && varName.length > 1) continue;

                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        lines[i],
                        `Mutable global state: "${varName}" is a module-level mutable variable. This can cause issues with testing and re-imports.`,
                        `If this is a constant, rename to UPPER_CASE (e.g. ${varName.toUpperCase()}). If it must be mutable, prefix with _ and provide access through functions.`,
                    ),
                );
            }
        }
        return violations;
    },
};

// ============================================================================
// §2.7 COMPREHENSIONS & GENERATOR EXPRESSIONS
// ============================================================================

/**
 * PY-COMP-01: No multiple for clauses in comprehensions
 *
 * "Comprehensions are allowed, however multiple for clauses or filter
 * expressions are not permitted."
 *
 * Multiple for clauses make comprehensions hard to read.
 * Use nested for loops instead.
 *
 * Google Python Style Guide §2.7.4
 */
const noMultipleForInComprehension: Rule = {
    id: 'PY-COMP-01',
    name: 'No multiple for clauses in comprehensions',
    description:
        'List/dict/set comprehensions must not have multiple "for" clauses. Use nested loops instead for complex iterations.',
    severity: 'medium',
    guideSection: '§2.7.4',
    guideUrl: 'https://google.github.io/styleguide/pyguide.html#s2.7-comprehensions',
    check(lines: string[], _filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        for (let i = 0; i < searchLines.length; i++) {
            const trimmed = searchLines[i].trim();

            const forMatches = trimmed.match(/\bfor\s+\w+/g);
            if (forMatches && forMatches.length >= 2) {
                const hasOpenBracket = /[\[({]/.test(trimmed);
                const isComprehension = hasOpenBracket && /\bfor\b.*\bfor\b/.test(trimmed);

                if (isComprehension) {
                    violations.push(
                        createViolation(
                            this,
                            i + 1,
                            lines[i],
                            `Multiple "for" clauses in comprehension. This makes comprehensions hard to read.`,
                            'Break this into nested for loops for better readability.',
                        ),
                    );
                }
            }
        }
        return violations;
    },
};

// ============================================================================
// §2.8 DEFAULT ITERATORS AND OPERATORS
// ============================================================================

/**
 * PY-ITER-01: Use default iterators — no .keys() in for loops
 *
 * "Use default iterators and operators for types that support them."
 * "for key in adict:" not "for key in adict.keys():"
 *
 * .keys() is redundant — iterating over a dict directly yields its keys.
 *
 * Google Python Style Guide §2.8.4
 */
const noKeysInForLoop: Rule = {
    id: 'PY-ITER-01',
    name: 'No .keys() in for loops',
    description:
        'Use "for key in dict:" instead of "for key in dict.keys():". Iterating over a dict directly yields its keys.',
    severity: 'low',
    guideSection: '§2.8.4',
    guideUrl: 'https://google.github.io/styleguide/pyguide.html#s2.8-default-iterators-and-operators',
    check(lines: string[], _filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        const pattern = /^\s*for\s+\w+\s+in\s+(\w[\w.]*?)\.keys\(\)\s*:/;

        for (let i = 0; i < searchLines.length; i++) {
            const match = searchLines[i].match(pattern);
            if (match) {
                const dictName = match[1];
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        lines[i],
                        `Unnecessary .keys() call: "${lines[i].trim()}". Iterating over a dict directly yields its keys.`,
                        `Use "for key in ${dictName}:" instead.`,
                    ),
                );
            }
        }
        return violations;
    },
};

/**
 * PY-ITER-02: No .readlines() in for loops
 *
 * "for line in afile:" not "for line in afile.readlines():"
 *
 * .readlines() reads the entire file into memory as a list.
 * Iterating over the file object directly is lazy and memory-efficient.
 *
 * Google Python Style Guide §2.8.4
 */
const noReadlinesInForLoop: Rule = {
    id: 'PY-ITER-02',
    name: 'No .readlines() in for loops',
    description:
        'Use "for line in file:" instead of "for line in file.readlines():". Iterating over a file directly is lazy and memory-efficient.',
    severity: 'low',
    guideSection: '§2.8.4',
    guideUrl: 'https://google.github.io/styleguide/pyguide.html#s2.8-default-iterators-and-operators',
    check(lines: string[], _filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        const pattern = /^\s*for\s+\w+\s+in\s+(\w[\w.]*?)\.readlines\(\)\s*:/;

        for (let i = 0; i < searchLines.length; i++) {
            const match = searchLines[i].match(pattern);
            if (match) {
                const fileName = match[1];
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        lines[i],
                        `Unnecessary .readlines() call: "${lines[i].trim()}". This reads the entire file into memory.`,
                        `Use "for line in ${fileName}:" instead -- it reads lazily line by line.`,
                    ),
                );
            }
        }
        return violations;
    },
};

// ============================================================================
// §2.10 LAMBDA FUNCTIONS
// ============================================================================

/**
 * PY-LAMBDA-01: No lambda assigned to a variable
 *
 * "Lambdas are allowed [for one-liners]."
 *
 * However, assigning a lambda to a name defeats the purpose of lambdas
 * (anonymous functions). It also produces worse stack traces. Use def instead.
 * This is effectively PEP 8 E731, also enforced by Google's pylintrc.
 *
 * Google Python Style Guide §2.10 + Google pylintrc
 */
const noLambdaAssignment: Rule = {
    id: 'PY-LAMBDA-01',
    name: 'No lambda assigned to a variable',
    description:
        'Do not assign a lambda expression to a variable. Use a def statement instead, which produces better stack traces and is more readable.',
    severity: 'medium',
    guideSection: '§2.10',
    guideUrl: 'https://google.github.io/styleguide/pyguide.html#s2.10-lambda-functions',
    check(lines: string[], _filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        const pattern = /^\s*(\w+)\s*=\s*lambda\b/;

        for (let i = 0; i < searchLines.length; i++) {
            const match = searchLines[i].match(pattern);
            if (match) {
                const varName = match[1];
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        lines[i],
                        `Lambda assigned to variable "${varName}". Named lambdas defeat the purpose of anonymous functions.`,
                        `Use a def statement instead: "def ${varName}(...):"`,
                    ),
                );
            }
        }
        return violations;
    },
};

// ============================================================================
// §2.12 DEFAULT ARGUMENT VALUES
// ============================================================================

/**
 * PY-MUT-01: No mutable default arguments
 *
 * "Do not use mutable objects as default values in the function or
 * method definition."
 *
 * Mutable defaults are evaluated ONCE at module load time and shared
 * across all calls. This is one of Python's most notorious gotchas.
 *
 * Google Python Style Guide §2.12.4
 */
const noMutableDefaults: Rule = {
    id: 'PY-MUT-01',
    name: 'No mutable default arguments',
    description:
        'Do not use mutable objects (lists, dicts, sets) as default values in function definitions. They are shared across all calls. Use None and create inside the function.',
    severity: 'high',
    guideSection: '§2.12.4',
    guideUrl: 'https://google.github.io/styleguide/pyguide.html#s2.12-default-argument-values',
    check(lines: string[], _filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        const defPattern = /^\s*def\s+\w+\s*\(/;
        const mutableDefaultPattern = /=\s*(\[\s*\]|\{\s*\}|set\(\s*\)|list\(\s*\)|dict\(\s*\))/;

        for (let i = 0; i < searchLines.length; i++) {
            if (defPattern.test(searchLines[i]) && mutableDefaultPattern.test(searchLines[i])) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        lines[i],
                        `Mutable default argument found: "${lines[i].trim()}". Mutable defaults are shared across all function calls.`,
                        'Use None as default and create the mutable object inside the function: def foo(a=None): if a is None: a = []',
                    ),
                );
            }
        }
        return violations;
    },
};

// ============================================================================
// §2.14 TRUE/FALSE EVALUATIONS
// ============================================================================

/**
 * PY-BOOL-01: Use "is None" not "== None"
 *
 * "Always use if foo is None: (or is not None) to check for a None value."
 *
 * == can be overridden by __eq__, but is checks identity, which is
 * the correct way to check for the None singleton.
 *
 * Google Python Style Guide §2.14.4
 */
const useIsNone: Rule = {
    id: 'PY-BOOL-01',
    name: 'Use "is None" not "== None"',
    description:
        'Use "is None" or "is not None" to check for None. "==" can be overridden by __eq__ and may produce wrong results.',
    severity: 'medium',
    guideSection: '§2.14.4',
    guideUrl: 'https://google.github.io/styleguide/pyguide.html#s2.14-truefalse-evaluations',
    check(lines: string[], _filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        const pattern = /[!=]=\s*None\b/;

        for (let i = 0; i < searchLines.length; i++) {
            if (pattern.test(searchLines[i])) {
                const isNotEqual = /!=\s*None\b/.test(searchLines[i]);
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        lines[i],
                        `Use "is${isNotEqual ? ' not' : ''} None" instead of "${isNotEqual ? '!=' : '=='} None".`,
                        `Replace "${isNotEqual ? '!= None' : '== None'}" with "${isNotEqual ? 'is not None' : 'is None'}"`,
                    ),
                );
            }
        }
        return violations;
    },
};

/**
 * PY-BOOL-02: Use implicit false for sequences — no if len()
 *
 * "For sequences (strings, lists, tuples), use the fact that empty
 * sequences are false, so if seq: and if not seq: are preferable
 * to if len(seq): and if not len(seq):"
 *
 * Google Python Style Guide §2.14.4
 */
const noIfLen: Rule = {
    id: 'PY-BOOL-02',
    name: 'No if len() for emptiness checks',
    description:
        'Use "if seq:" instead of "if len(seq):". Empty sequences are falsy in Python. Using len() is redundant.',
    severity: 'medium',
    guideSection: '§2.14.4',
    guideUrl: 'https://google.github.io/styleguide/pyguide.html#s2.14-truefalse-evaluations',
    check(lines: string[], _filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        const patterns = [
            /\bif\s+len\(/,
            /\bif\s+not\s+len\(/,
            /\blen\([^)]*\)\s*==\s*0/,
            /\blen\([^)]*\)\s*>\s*0/,
            /\blen\([^)]*\)\s*!=\s*0/,
        ];

        for (let i = 0; i < searchLines.length; i++) {
            for (const pattern of patterns) {
                if (pattern.test(searchLines[i])) {
                    violations.push(
                        createViolation(
                            this,
                            i + 1,
                            lines[i],
                            `len() used for emptiness check: "${lines[i].trim()}". Empty sequences are already falsy.`,
                            'Use "if seq:" for non-empty check or "if not seq:" for empty check.',
                        ),
                    );
                    break;
                }
            }
        }
        return violations;
    },
};

/**
 * PY-BOOL-03: No comparison to True/False with ==
 *
 * "Never compare a boolean variable to False using ==.
 * Use if not x: instead."
 *
 * Google Python Style Guide §2.14.4
 */
const noCompareTrueFalse: Rule = {
    id: 'PY-BOOL-03',
    name: 'No == True/False comparisons',
    description:
        'Use "if x:" instead of "if x == True:" and "if not x:" instead of "if x == False:". Direct boolean comparison is redundant.',
    severity: 'medium',
    guideSection: '§2.14.4',
    guideUrl: 'https://google.github.io/styleguide/pyguide.html#s2.14-truefalse-evaluations',
    check(lines: string[], _filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        const pattern = /[!=]=\s*(True|False)\b|\bis\s+(True|False)\b/;

        for (let i = 0; i < searchLines.length; i++) {
            const match = searchLines[i].match(pattern);
            if (match) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        lines[i],
                        `Direct comparison to ${match[1] || match[2]}: "${lines[i].trim()}".`,
                        'Use "if x:" for truthiness or "if not x:" for falsiness instead.',
                    ),
                );
            }
        }
        return violations;
    },
};

// ============================================================================
// §2.17 FUNCTION AND METHOD DECORATORS
// ============================================================================

/**
 * PY-DEC-01: Avoid @staticmethod
 *
 * "Never use staticmethod unless forced to in order to integrate with
 * an API defined in an existing library. Write a module-level function
 * instead."
 *
 * Google Python Style Guide §2.17.4
 */
const noStaticMethod: Rule = {
    id: 'PY-DEC-01',
    name: 'Avoid @staticmethod',
    description:
        'Do not use @staticmethod. Use a module-level function instead. staticmethod is only acceptable when integrating with an existing library API.',
    severity: 'medium',
    guideSection: '§2.17.4',
    guideUrl: 'https://google.github.io/styleguide/pyguide.html#s2.17-function-and-method-decorators',
    check(lines: string[], _filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        const pattern = /^\s*@staticmethod\s*$/;

        for (let i = 0; i < searchLines.length; i++) {
            if (pattern.test(searchLines[i])) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        lines[i],
                        '@staticmethod should not be used. It provides no benefit over a module-level function.',
                        'Move this method out of the class and make it a module-level function instead.',
                    ),
                );
            }
        }
        return violations;
    },
};

// ============================================================================
// §2.19 POWER FEATURES
// ============================================================================

/**
 * PY-PWR-01: Avoid power features (eval, exec, etc.)
 *
 * "Avoid these features."
 *
 * Python power features like eval(), exec(), __import__(), and compile()
 * are dangerous and make code harder to understand. They can also
 * introduce security vulnerabilities.
 *
 * Google Python Style Guide §2.19
 */
const noPowerFeatures: Rule = {
    id: 'PY-PWR-01',
    name: 'Avoid power features (eval, exec)',
    description:
        'Do not use eval(), exec(), __import__(), or compile(). These make code harder to read, debug, and can introduce security risks.',
    severity: 'high',
    guideSection: '§2.19',
    guideUrl: 'https://google.github.io/styleguide/pyguide.html#s2.19-power-features',
    check(lines: string[], _filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        const pattern = /\b(eval|exec|__import__|compile)\s*\(/;

        for (let i = 0; i < searchLines.length; i++) {
            const match = searchLines[i].match(pattern);
            if (match) {
                const funcName = match[1];
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        lines[i],
                        `Power feature "${funcName}()" used. These features make code harder to read and debug.`,
                        `Avoid ${funcName}(). Use safer alternatives: importlib.import_module() for dynamic imports, ast.literal_eval() for safe eval, or restructure code to avoid dynamic execution.`,
                    ),
                );
            }
        }
        return violations;
    },
};

// ============================================================================
// §3.11 FILES, SOCKETS, AND SIMILAR STATEFUL RESOURCES
// ============================================================================

/**
 * PY-RES-01: Use "with" for files and resources
 *
 * "Explicitly close files and sockets when done with them."
 * "The preferred way to manage files and similar resources is
 * using the with statement."
 *
 * Detects open() calls that are not preceded by "with".
 *
 * Google Python Style Guide §3.11
 */
const useWithForFiles: Rule = {
    id: 'PY-RES-01',
    name: 'Use "with" for files',
    description:
        'Use the "with" statement to manage files. This ensures they are properly closed even if exceptions occur. Avoid raw open() without with.',
    severity: 'medium',
    guideSection: '§3.11',
    guideUrl: 'https://google.github.io/styleguide/pyguide.html#s3.11-files-sockets-and-similar-stateful-resources',
    check(lines: string[], _filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        const assignOpenPattern = /^\s*(\w+)\s*=\s*open\s*\(/;

        for (let i = 0; i < searchLines.length; i++) {
            const clean = searchLines[i];
            if (/^\s*with\s+/.test(clean)) continue;

            const match = clean.match(assignOpenPattern);
            if (match) {
                const varName = match[1];
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        lines[i],
                        `File opened without "with" statement: "${lines[i].trim()}". The file may not be properly closed.`,
                        `Use: with open(...) as ${varName}:`,
                    ),
                );
            }
        }
        return violations;
    },
};

// ============================================================================
// §3.1 SEMICOLONS
// ============================================================================

/**
 * PY-FMT-01: No semicolons
 *
 * "Do not terminate your lines with semicolons, and do not use
 * semicolons to put two statements on the same line."
 *
 * Google Python Style Guide §3.1
 */
const noSemicolons: Rule = {
    id: 'PY-FMT-01',
    name: 'No semicolons',
    description:
        'Do not use semicolons to terminate lines or to put multiple statements on the same line.',
    severity: 'low',
    guideSection: '§3.1',
    guideUrl: 'https://google.github.io/styleguide/pyguide.html#s3.1-semicolons',
    check(lines: string[], _filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        for (let i = 0; i < searchLines.length; i++) {
            const trimmed = searchLines[i].trimEnd();
            if (trimmed.endsWith(';')) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        lines[i],
                        'Semicolon found. Python does not require semicolons.',
                        'Remove the semicolon.',
                    ),
                );
            }
        }
        return violations;
    },
};

// ============================================================================
// §3.2 LINE LENGTH
// ============================================================================

/**
 * PY-FMT-02: 80-character line limit
 *
 * "Maximum line length is 80 characters."
 *
 * Exceptions: long import statements, URLs in comments, long string
 * constants, pylint disable comments.
 *
 * Google Python Style Guide §3.2
 */
const lineLengthLimit: Rule = {
    id: 'PY-FMT-02',
    name: '80-character line limit',
    description:
        'Maximum line length is 80 characters. Exceptions: long imports, URLs in comments, and pylint disable comments.',
    severity: 'low',
    guideSection: '§3.2',
    guideUrl: 'https://google.github.io/styleguide/pyguide.html#s3.2-line-length',
    check(lines: string[]): Violation[] {
        const violations: Violation[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.length <= 80) continue;

            // Exempt: URLs in comments
            if (/^\s*#.*https?:\/\//.test(line)) continue;
            // Exempt: long imports
            if (/^\s*(import|from)\s+/.test(line)) continue;
            // Exempt: pylint/pytype disable comments
            if (/# (pylint|pytype|type):\s*(disable|ignore)/.test(line)) continue;

            violations.push(
                createViolation(
                    this,
                    i + 1,
                    line,
                    `Line is ${line.length} characters (max 80).`,
                    'Break the line using parentheses for implicit line continuation.',
                ),
            );
        }
        return violations;
    },
};

/**
 * PY-FMT-03: No backslash line continuation
 *
 * "Do not use a backslash for explicit line continuation."
 * "Instead, make use of Python's implicit line joining inside
 * parentheses, brackets and braces."
 *
 * Google Python Style Guide §3.2
 */
const noBackslashContinuation: Rule = {
    id: 'PY-FMT-03',
    name: 'No backslash line continuation',
    description:
        'Do not use backslash (\\) for line continuation. Use parentheses, brackets, or braces for implicit line joining instead.',
    severity: 'low',
    guideSection: '§3.2',
    guideUrl: 'https://google.github.io/styleguide/pyguide.html#s3.2-line-length',
    check(lines: string[], _filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        for (let i = 0; i < searchLines.length; i++) {
            // cleanLines strips strings/comments, so a trailing backslash here is a line continuation
            if (searchLines[i].trimEnd().endsWith('\\')) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        lines[i],
                        'Backslash line continuation found. Use parentheses for implicit line joining instead.',
                        'Wrap the expression in parentheses () instead of using backslash.',
                    ),
                );
            }
        }
        return violations;
    },
};

// ============================================================================
// §3.10 STRINGS
// ============================================================================

/**
 * PY-STR-01: No string concatenation with + in loops
 *
 * "Avoid using the + and += operators to accumulate a string within a loop."
 *
 * String concatenation in loops is O(n²) because each concat creates a
 * new string. Use list and join(), or io.StringIO instead.
 *
 * Google Python Style Guide §3.10
 */
const noStringConcatInLoop: Rule = {
    id: 'PY-STR-01',
    name: 'No string += in loops',
    description:
        'Do not use += to accumulate strings inside a loop. This is O(n²). Use a list and "".join() or io.StringIO instead.',
    severity: 'medium',
    guideSection: '§3.10',
    guideUrl: 'https://google.github.io/styleguide/pyguide.html#s3.10-strings',
    check(lines: string[], _filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        let inLoop = false;
        let loopIndent = 0;

        for (let i = 0; i < searchLines.length; i++) {
            const clean = searchLines[i];
            if (clean.trim() === '') continue;

            const indent = clean.length - clean.trimStart().length;

            if (/^\s*(for|while)\s+/.test(clean)) {
                inLoop = true;
                loopIndent = indent;
            } else if (inLoop && indent <= loopIndent && clean.trim() !== '') {
                inLoop = false;
            }

            if (inLoop && /\+=\s*(['"]|f['"]|str\()/.test(clean)) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        lines[i],
                        `String concatenation with += inside a loop. This creates a new string each iteration (O(n^2)).`,
                        'Collect substrings in a list and use "".join(list) after the loop.',
                    ),
                );
            }
        }
        return violations;
    },
};

/**
 * PY-STR-02: No f-strings in logging calls
 *
 * "For logging functions that expect a pattern-string (with %-placeholders)
 * as their first argument: Always call them with a string literal
 * (not an f-string!) as their first argument."
 *
 * Google Python Style Guide §3.10.1
 */
const noFStringInLogging: Rule = {
    id: 'PY-STR-02',
    name: 'No f-strings in logging',
    description:
        'Use %-style formatting in logging calls, not f-strings. Logging libraries defer string formatting and use pattern-strings for aggregation.',
    severity: 'medium',
    guideSection: '§3.10.1',
    guideUrl: 'https://google.github.io/styleguide/pyguide.html#s3.10-strings',
    check(lines: string[], _filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        const pattern = /\b([a-zA-Z0-9_]*log[a-zA-Z0-9_]*)\.(debug|info|warning|error|critical|exception|log)\s*\(\s*f['"]/i;

        for (let i = 0; i < searchLines.length; i++) {
            if (pattern.test(searchLines[i])) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        lines[i],
                        'f-string used in logging call. Use %-style formatting for log messages.',
                        'Use: logging.info("message: %s", variable) instead of logging.info(f"message: {variable}")',
                    ),
                );
            }
        }
        return violations;
    },
};

// ============================================================================
// §3.14 STATEMENTS
// ============================================================================

/**
 * PY-STMT-01: No try/except on a single line
 *
 * "Generally only one statement per line."
 * "you can never do so with try/except since the try and except
 * can't both fit on the same line"
 *
 * Google Python Style Guide §3.14
 */
const noSingleLineTryExcept: Rule = {
    id: 'PY-STMT-01',
    name: 'No single-line try/except',
    description:
        'try/except must not be on a single line. The try block and except handler must be on separate lines.',
    severity: 'low',
    guideSection: '§3.14',
    guideUrl: 'https://google.github.io/styleguide/pyguide.html#s3.14-statements',
    check(lines: string[], _filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        for (let i = 0; i < searchLines.length; i++) {
            if (/\btry\s*:.*\bexcept\b/.test(searchLines[i])) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        lines[i],
                        'try/except on a single line. These must be on separate lines.',
                        'Split try and except onto separate lines.',
                    ),
                );
            }
        }
        return violations;
    },
};

// ============================================================================
// §3.16 NAMING
// ============================================================================

/**
 * PY-NAME-01: Function and method names must be snake_case
 *
 * "function_name, method_name" — must be lower_with_under.
 *
 * Google Python Style Guide §3.16
 */
const functionSnakeCase: Rule = {
    id: 'PY-NAME-01',
    name: 'Functions must use snake_case',
    description:
        'Function and method names must use snake_case (lowercase with underscores). CamelCase or mixedCase are not allowed.',
    severity: 'medium',
    guideSection: '§3.16',
    guideUrl: 'https://google.github.io/styleguide/pyguide.html#s3.16-naming',
    check(lines: string[], _filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        const defPattern = /^\s*def\s+([a-zA-Z_]\w*)\s*\(/;

        for (let i = 0; i < searchLines.length; i++) {
            const match = searchLines[i].match(defPattern);
            if (match) {
                const funcName = match[1];

                // Skip dunder methods (__init__, __str__, etc.)
                if (funcName.startsWith('__') && funcName.endsWith('__')) continue;

                // Skip test method names (test files may use camelCase per guide 3.16.2)
                if (funcName.startsWith('test')) continue;

                // Check if name is snake_case: only lowercase, underscores, and digits
                if (!/^_?_?[a-z][a-z0-9_]*$/.test(funcName)) {
                    violations.push(
                        createViolation(
                            this,
                            i + 1,
                            lines[i],
                            `Function "${funcName}" does not use snake_case.`,
                            `Rename to "${funcName.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '')}"`,
                        ),
                    );
                }
            }
        }
        return violations;
    },
};

/**
 * PY-NAME-02: Class names must be PascalCase (CapWords)
 *
 * "ClassName" — must be CapWords.
 *
 * Google Python Style Guide §3.16
 */
const classPascalCase: Rule = {
    id: 'PY-NAME-02',
    name: 'Classes must use PascalCase',
    description:
        'Class names must use PascalCase (CapWords). snake_case or lowercase are not allowed for class names.',
    severity: 'medium',
    guideSection: '§3.16',
    guideUrl: 'https://google.github.io/styleguide/pyguide.html#s3.16-naming',
    check(lines: string[], _filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        const classPattern = /^\s*class\s+([a-zA-Z_]\w*)\s*[:(]/;

        for (let i = 0; i < searchLines.length; i++) {
            const match = searchLines[i].match(classPattern);
            if (match) {
                const className = match[1];

                if (/^[a-z]/.test(className) || /_/.test(className)) {
                    // Exception: _PrivateClass is allowed
                    if (/^_[A-Z]/.test(className)) continue;

                    violations.push(
                        createViolation(
                            this,
                            i + 1,
                            lines[i],
                            `Class "${className}" does not use PascalCase.`,
                            `Rename to "${className.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}"`,
                        ),
                    );
                }
            }
        }
        return violations;
    },
};

// ============================================================================
// §3.17 MAIN
// ============================================================================

/**
 * PY-MAIN-01: Scripts need main guard
 *
 * "If a file is meant to be used as an executable, its main
 * functionality should be in a main() function, and your code
 * should always check if __name__ == '__main__' before executing
 * your main program."
 *
 * This checks for files with top-level function calls (not just definitions)
 * that don't have an if __name__ == '__main__' guard.
 *
 * Google Python Style Guide §3.17
 */
const mainGuard: Rule = {
    id: 'PY-MAIN-01',
    name: 'Scripts need main guard',
    description:
        'Executable scripts must use if __name__ == "__main__": to guard top-level code. This prevents code from running when the module is imported.',
    severity: 'medium',
    guideSection: '§3.17',
    guideUrl: 'https://google.github.io/styleguide/pyguide.html#s3.17-main',
    check(lines: string[], _filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        let hasMainGuard = false;
        let hasTopLevelCall = false;
        let topLevelCallLine = -1;

        for (let i = 0; i < searchLines.length; i++) {
            const clean = searchLines[i];
            const trimmed = clean.trim();
            if (trimmed === '') continue;

            if (/if\s+__name__\s*==\s*['"]__main__['"]\s*:/.test(trimmed)) {
                hasMainGuard = true;
            }

            if (!clean.startsWith(' ') && !clean.startsWith('\t')) {
                const isDefinition = /^(def|class|import|from|if|elif|else|for|while|try|except|finally|with|@)/.test(trimmed);
                const isAssignment = /^\w+\s*=/.test(trimmed);
                const isFunctionCall = /^\w[\w.]*\s*\(/.test(trimmed);

                if (!isDefinition && !isAssignment && isFunctionCall && !hasTopLevelCall) {
                    hasTopLevelCall = true;
                    topLevelCallLine = i;
                }
            }
        }

        if (hasTopLevelCall && !hasMainGuard) {
            violations.push(
                createViolation(
                    this,
                    topLevelCallLine + 1,
                    lines[topLevelCallLine],
                    'Top-level function call without if __name__ == "__main__": guard.',
                    'Wrap executable code in: if __name__ == "__main__": main()',
                ),
            );
        }

        return violations;
    },
};

// ============================================================================
// §3.18 FUNCTION LENGTH
// ============================================================================

/**
 * PY-LEN-01: Functions > 40 lines
 *
 * "Prefer small and focused functions."
 * "If a function exceeds about 40 lines, think about whether it
 * can be broken up without harming the structure of the program."
 *
 * Google Python Style Guide §3.18
 */
const functionLength: Rule = {
    id: 'PY-LEN-01',
    name: 'Function too long (>40 lines)',
    description:
        'Functions should not exceed ~40 lines. Long functions are harder to read, test, and maintain. Consider breaking them up.',
    severity: 'low',
    guideSection: '§3.18',
    guideUrl: 'https://google.github.io/styleguide/pyguide.html#s3.18-function-length',
    check(lines: string[], _filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        const defPattern = /^(\s*)def\s+(\w+)\s*\(/;

        interface FuncInfo {
            name: string;
            startLine: number;
            indent: number;
        }

        const funcStack: FuncInfo[] = [];

        for (let i = 0; i < searchLines.length; i++) {
            const match = searchLines[i].match(defPattern);

            if (match) {
                const indent = match[1].length;
                const funcName = match[2];

                while (funcStack.length > 0 && funcStack[funcStack.length - 1].indent >= indent) {
                    const closed = funcStack.pop()!;
                    const funcLength = i - closed.startLine;
                    if (funcLength > 40) {
                        violations.push(
                            createViolation(
                                this,
                                closed.startLine + 1,
                                lines[closed.startLine],
                                `Function "${closed.name}" is ${funcLength} lines long (recommended max: 40).`,
                                'Consider breaking this function into smaller, focused helper functions.',
                            ),
                        );
                    }
                }

                funcStack.push({ name: funcName, startLine: i, indent });
            }
        }

        for (const func of funcStack) {
            const funcLength = lines.length - func.startLine;
            if (funcLength > 40) {
                violations.push(
                    createViolation(
                        this,
                        func.startLine + 1,
                        lines[func.startLine],
                        `Function "${func.name}" is ${funcLength} lines long (recommended max: 40).`,
                        'Consider breaking this function into smaller, focused helper functions.',
                    ),
                );
            }
        }

        return violations;
    },
};

// ============================================================================
// §3.8 COMMENTS AND DOCSTRINGS
// ============================================================================

/**
 * PY-DOC-01: Triple double quotes for docstrings
 * Google Style Guide §3.8
 */
const enforceTripleDoubleQuotes: Rule = {
    id: 'PY-DOC-01',
    name: 'Use """ for docstrings',
    description: 'Always use the three-double-quote """ format for docstrings. Single quotes \'\'\' are not permitted.',
    severity: 'low',
    guideSection: '§3.8',
    guideUrl: 'https://google.github.io/styleguide/pyguide.html#s3.8.1-docstrings',
    check(lines: string[]): Violation[] {
        const violations: Violation[] = [];
        const BAD_DOC_PATTERN = /^\s*'''/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Only care about lines that start with ''' (ignoring whitespace)
            if (BAD_DOC_PATTERN.test(line)) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        `Docstring using ''' found.`,
                        'Always use """ (three double-quotes) for docstrings.',
                    ),
                );
            }
        }
        return violations;
    },
};

/**
 * PY-DOC-02: Top-level functions/classes must have a docstring
 * Google Style Guide §3.8
 */
const requireDocstrings: Rule = {
    id: 'PY-DOC-02',
    name: 'Top-level functions/classes must have docstring',
    description: 'A docstring is mandatory for every function or class that is part of the public API.',
    severity: 'medium',
    guideSection: '§3.8',
    guideUrl: 'https://google.github.io/styleguide/pyguide.html#s3.8.3-functions-and-methods',
    check(lines: string[], _filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        for (let i = 0; i < searchLines.length - 1; i++) {
            const clean = searchLines[i];

            const match = clean.match(/^\s*(def|class)\s+[a-zA-Z_]\w*\s*[:(]/);
            if (match) {
                // Check next non-empty physical line for docstring
                let nextCodeLineIdx = i + 1;
                while (nextCodeLineIdx < lines.length && !lines[nextCodeLineIdx].trim()) {
                    nextCodeLineIdx++;
                }

                if (nextCodeLineIdx < lines.length) {
                    const nextLine = lines[nextCodeLineIdx];
                    if (!nextLine.trimStart().startsWith('"""')) {
                        const namePattern = clean.match(/(def|class)\s+([a-zA-Z_]\w*)/);
                        if (namePattern) {
                            const name = namePattern[2];
                            if (name.startsWith('_') || name.startsWith('test_')) continue;

                            violations.push(
                                createViolation(
                                    this,
                                    i + 1,
                                    lines[i],
                                    `Missing docstring for top-level "${name}".`,
                                    'Add a triple-quote docstring explaining its functionality.',
                                ),
                            );
                        }
                    }
                }
            }
        }
        return violations;
    },
};

/**
 * PY-CMT-01: Block comments should start with '# '
 * Google Style Guide §3.8.4
 */
const properBlockComments: Rule = {
    id: 'PY-CMT-01',
    name: 'Block comments should start with # ',
    description: 'Block comments generally consist of one or more paragraphs built out of complete sentences, and each line should start with a # and a single space.',
    severity: 'low',
    guideSection: '§3.8',
    guideUrl: 'https://google.github.io/styleguide/pyguide.html#s3.8.4-block-and-inline-comments',
    check(lines: string[]): Violation[] {
        const violations: Violation[] = [];
        const BAD_COMMENT = /^\s*#(?! |!|pylint:|pytype:|type:|TODO|pyright:)\S/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            if (BAD_COMMENT.test(line)) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        `Block comment format violation.`,
                        'Ensure there is a single space after the hash (# ) before comment text.',
                    ),
                );
            }
        }
        return violations;
    },
};

// ============================================================================
// §3.12 TODO COMMENTS
// ============================================================================

/**
 * PY-TODO-01: TODO comments must include a name or issue
 * Google Style Guide §3.12
 */
const todoRequiresName: Rule = {
    id: 'PY-TODO-01',
    name: 'TODO requires context',
    description: 'TODOs should include the string TODO in all caps, followed by the name, e-mail address, or other identifier of the person or issue with the best context.',
    severity: 'medium',
    guideSection: '§3.12',
    guideUrl: 'https://google.github.io/styleguide/pyguide.html#s3.12-todo-comments',
    check(lines: string[]): Violation[] {
        const violations: Violation[] = [];
        const TODO_PATTERN = /\bTODO\b(?!\s*\(.*?\))/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Only care if it's inside a comment
            if (line.includes('#') && line.indexOf('TODO') > line.indexOf('#')) {
                if (TODO_PATTERN.test(line)) {
                    violations.push(
                        createViolation(
                            this,
                            i + 1,
                            line,
                            `TODO missing owner or issue reference.`,
                            'Format as: TODO(username): description',
                        ),
                    );
                }
            }
        }
        return violations;
    },
};

// ============================================================================
// §3.7 SHEBANG LINE
// ============================================================================

/**
 * PY-ENV-01: Shebang must use env python3
 * Google Style Guide §3.7
 */
const modernShebang: Rule = {
    id: 'PY-ENV-01',
    name: 'Modern Shebang',
    description: 'If a shebang is present, it must be #!/usr/bin/env python3.',
    severity: 'low',
    guideSection: '§3.7',
    guideUrl: 'https://google.github.io/styleguide/pyguide.html#s3.7-shebang-line',
    check(lines: string[]): Violation[] {
        const violations: Violation[] = [];
        
        if (lines.length > 0 && lines[0].startsWith('#!')) {
            if (!lines[0].includes('env python3')) {
                violations.push(
                    createViolation(
                        this,
                        1,
                        lines[0],
                        `Legacy shebang detected.`,
                        'Use "#!/usr/bin/env python3" instead.',
                    ),
                );
            }
        }
        return violations;
    },
};

// ============================================================================
// §2.1 LINT DIRECTIVES
// ============================================================================

/**
 * PY-LINT-01: Lint directives must have rationale
 * Google Style Guide §2.1 Lint
 */
const lintDirectivesWithRationale: Rule = {
    id: 'PY-LINT-01',
    name: 'Lint directives must have rationale',
    description: 'When suppressing lint warnings (pylint, pytype), a TODO or explanation must be provided on the same line or nearby.',
    severity: 'low',
    guideSection: '§2.1',
    guideUrl: 'https://google.github.io/styleguide/pyguide.html#s2.1-lint',
    check(lines: string[]): Violation[] {
        const violations: Violation[] = [];
        const pattern = /#\s*(pylint|pytype|type):\s*(disable|ignore)\b/i;
        const rationalePattern = /(TODO|http|Issue|Bug|#.*\w{4,})/i;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const match = line.match(pattern);
            if (match) {
                // If it doesn't contain a rationale on the same line, flag it.
                if (!rationalePattern.test(line)) {
                    violations.push(
                        createViolation(
                            this,
                            i + 1,
                            line,
                            `Lint directive found without a clear rationale or TODO.`,
                            'Add a comment explaining why this warning is being suppressed.',
                        ),
                    );
                }
            }
        }
        return violations;
    },
};

// ============================================================================
// §2.5 GLOBAL KEYWORD
// ============================================================================

/**
 * PY-GLOB-02: Avoid global keyword
 * Google Style Guide §2.5
 */
const noGlobalKeyword: Rule = {
    id: 'PY-GLOB-02',
    name: 'Avoid global keyword',
    description: 'Using the global keyword to mutate module-level state from within a function is strongly discouraged.',
    severity: 'medium',
    guideSection: '§2.5',
    guideUrl: 'https://google.github.io/styleguide/pyguide.html#s2.5-global-variables',
    check(lines: string[], _filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        const globalPattern = /^\s*global\s+[a-zA-Z_]\w*/;

        for (let i = 0; i < searchLines.length; i++) {
            if (globalPattern.test(searchLines[i])) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        lines[i],
                        `Global keyword used: "${lines[i].trim()}".`,
                        'Avoid mutating global state from within functions. Pass arguments or use classes instead.',
                    ),
                );
            }
        }
        return violations;
    },
};

// ============================================================================
// §2.21 TYPE ANNOTATED CODE
// ============================================================================

/**
 * PY-TYPE-02: Do not use typing.Text
 * Google Style Guide §2.21
 */
const noTypingText: Rule = {
    id: 'PY-TYPE-02',
    name: 'Avoid typing.Text',
    description: 'Modern Python 3 code should use "str" instead of "typing.Text".',
    severity: 'low',
    guideSection: '§2.21',
    guideUrl: 'https://google.github.io/styleguide/pyguide.html#s2.21-type-annotated-code',
    check(lines: string[], _filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        const textPattern = /\b(typing\.Text|Text)\b/;

        const hasTyping = searchLines.some(l => /\bimport\s+typing\b|\bfrom\s+typing\s+import\b/.test(l));

        for (let i = 0; i < searchLines.length; i++) {
            if (hasTyping && textPattern.test(searchLines[i])) {
                if (/[:\->\[,]\s*(typing\.Text|Text)\b/.test(searchLines[i])) {
                    violations.push(
                        createViolation(
                            this,
                            i + 1,
                            lines[i],
                            `Usage of typing.Text found.`,
                            'Use "str" instead for modern Python 3 code.',
                        ),
                    );
                }
            }
        }
        return violations;
    },
};

// ============================================================================
// §3.3 PARENTHESES
// ============================================================================

/**
 * PY-FMT-04: No unnecessary parentheses in return/if/while
 *
 * "Use parentheses sparingly. Do not use them in return statements or
 * conditional statements unless using parentheses for implied line
 * continuation or to indicate a tuple."
 *
 * Google Python Style Guide §3.3
 */
const noUnnecessaryParentheses: Rule = {
    id: 'PY-FMT-04',
    name: 'No unnecessary parentheses',
    description:
        'Do not use parentheses in return statements or conditionals unless for line continuation or tuples.',
    severity: 'low',
    guideSection: '§3.3',
    guideUrl: 'https://google.github.io/styleguide/pyguide.html#s3.3-parentheses',
    check(lines: string[], _filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        // Matches: if (x):, while (x):, return (single_value)
        // But NOT: if (x and\n y):  (line continuation) or return (a, b) (tuple)
        const patterns = [
            { re: /^\s*if\s+\(([^,)]+)\)\s*:/, keyword: 'if' },
            { re: /^\s*while\s+\(([^,)]+)\)\s*:/, keyword: 'while' },
            { re: /^\s*return\s+\(([^,)]+)\)\s*$/, keyword: 'return' },
        ];

        for (let i = 0; i < searchLines.length; i++) {
            for (const { re, keyword } of patterns) {
                if (re.test(searchLines[i])) {
                    violations.push(
                        createViolation(
                            this,
                            i + 1,
                            lines[i],
                            `Unnecessary parentheses in "${keyword}" statement.`,
                            `Remove the outer parentheses: "${keyword} expr" instead of "${keyword} (expr)".`,
                        ),
                    );
                    break;
                }
            }
        }
        return violations;
    },
};

// ============================================================================
// §3.4 INDENTATION
// ============================================================================

/**
 * PY-FMT-05: No tabs for indentation
 *
 * "Indent your code blocks with 4 spaces. Never use tabs."
 *
 * Google Python Style Guide §3.4
 */
const noTabIndentation: Rule = {
    id: 'PY-FMT-05',
    name: 'No tab indentation',
    description:
        'Use 4 spaces for indentation. Never use tabs.',
    severity: 'medium',
    guideSection: '§3.4',
    guideUrl: 'https://google.github.io/styleguide/pyguide.html#s3.4-indentation',
    check(lines: string[]): Violation[] {
        const violations: Violation[] = [];

        for (let i = 0; i < lines.length; i++) {
            if (/^\t/.test(lines[i])) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        lines[i],
                        'Tab character used for indentation.',
                        'Use 4 spaces for indentation instead of tabs.',
                    ),
                );
            }
        }
        return violations;
    },
};

// ============================================================================
// §3.5 BLANK LINES
// ============================================================================

/**
 * PY-FMT-06: Two blank lines between top-level definitions
 *
 * "Two blank lines between top-level definitions, be they function or
 * class definitions."
 *
 * Google Python Style Guide §3.5
 */
const twoBlankLinesBetweenTopLevel: Rule = {
    id: 'PY-FMT-06',
    name: 'Two blank lines between top-level definitions',
    description:
        'There must be two blank lines between top-level function and class definitions.',
    severity: 'low',
    guideSection: '§3.5',
    guideUrl: 'https://google.github.io/styleguide/pyguide.html#s3.5-blank-lines',
    check(lines: string[], _filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        const topLevelDef = /^(def|class)\s+/;

        for (let i = 0; i < searchLines.length; i++) {
            if (topLevelDef.test(searchLines[i])) {
                // Count blank lines above (skip decorators)
                let checkIdx = i - 1;
                // Skip decorators
                while (checkIdx >= 0 && /^\s*@/.test(searchLines[checkIdx])) {
                    checkIdx--;
                }
                // Count blank lines
                let blankCount = 0;
                while (checkIdx >= 0 && lines[checkIdx].trim() === '') {
                    blankCount++;
                    checkIdx--;
                }
                // Only flag if there is a preceding non-blank, non-first line
                if (checkIdx >= 0 && blankCount < 2) {
                    // Skip if the previous content is an import or module docstring start
                    const prevTrimmed = lines[checkIdx].trim();
                    if (prevTrimmed === '' || prevTrimmed.startsWith('#')) continue;

                    violations.push(
                        createViolation(
                            this,
                            i + 1,
                            lines[i],
                            `Expected 2 blank lines before top-level definition, found ${blankCount}.`,
                            'Add blank lines so there are exactly 2 between top-level definitions.',
                        ),
                    );
                }
            }
        }
        return violations;
    },
};

// ============================================================================
// §3.6 WHITESPACE
// ============================================================================

/**
 * PY-FMT-07: No trailing whitespace
 *
 * "No trailing whitespace."
 *
 * Google Python Style Guide §3.6
 */
const noTrailingWhitespace: Rule = {
    id: 'PY-FMT-07',
    name: 'No trailing whitespace',
    description:
        'Lines must not have trailing whitespace.',
    severity: 'low',
    guideSection: '§3.6',
    guideUrl: 'https://google.github.io/styleguide/pyguide.html#s3.6-whitespace',
    check(lines: string[]): Violation[] {
        const violations: Violation[] = [];

        for (let i = 0; i < lines.length; i++) {
            if (/[ \t]+$/.test(lines[i])) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        lines[i],
                        'Trailing whitespace found.',
                        'Remove trailing spaces and tabs.',
                    ),
                );
            }
        }
        return violations;
    },
};

// ============================================================================
// §3.15 ACCESSORS
// ============================================================================

// §3.15 Accessors -- deferred to AI deep review layer (requires understanding
// of class field access patterns that regex cannot reliably detect)

// ============================================================================
// §3.16.1 NAMES TO AVOID
// ============================================================================

/**
 * PY-NAME-03: No single-character names (except allowed)
 *
 * "single character names, except for specifically allowed cases:
 * counters or iterators (e.g. i, j, k, v), e as exception identifier,
 * f as file handle in with statements"
 *
 * Google Python Style Guide §3.16.1
 */
const noSingleCharNames: Rule = {
    id: 'PY-NAME-03',
    name: 'No single-character variable names',
    description:
        'Avoid single character names except for counters (i, j, k, v), exception identifiers (e), and file handles (f).',
    severity: 'low',
    guideSection: '§3.16.1',
    guideUrl: 'https://google.github.io/styleguide/pyguide.html#s3.16.1-names-to-avoid',
    check(lines: string[], _filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        // Allowed single chars: i, j, k, v (iterators), e (exception), f (file), _ (throwaway), x, y, z (math)
        const allowed = new Set(['i', 'j', 'k', 'v', 'e', 'f', '_', 'x', 'y', 'z', 'n', 't']);
        // Match: single char = something (assignment at function level)
        const assignPattern = /^\s+([a-zA-Z])\s*=/;

        for (let i = 0; i < searchLines.length; i++) {
            const match = searchLines[i].match(assignPattern);
            if (match) {
                const name = match[1];
                if (!allowed.has(name.toLowerCase())) {
                    violations.push(
                        createViolation(
                            this,
                            i + 1,
                            lines[i],
                            `Single-character variable name "${name}". Use a descriptive name.`,
                            'Choose a meaningful name that describes the variable\'s purpose.',
                        ),
                    );
                }
            }
        }
        return violations;
    },
};

/**
 * PY-NAME-04: No dashes in module/package names
 *
 * Google Python Style Guide §3.16.3
 */
const noDashesInFilename: Rule = {
    id: 'PY-NAME-04',
    name: 'No dashes in Python filenames',
    description:
        'Python module filenames must not contain dashes. Use underscores instead.',
    severity: 'medium',
    guideSection: '§3.16.3',
    guideUrl: 'https://google.github.io/styleguide/pyguide.html#s3.16.3-file-naming',
    check(_lines: string[], filename?: string): Violation[] {
        const violations: Violation[] = [];
        if (filename) {
            const baseName = filename.replace(/^.*[\\/]/, '');
            if (baseName.endsWith('.py') && baseName.includes('-')) {
                violations.push(
                    createViolation(
                        this,
                        1,
                        '',
                        `Filename "${baseName}" contains a dash. Python modules must use underscores.`,
                        `Rename to "${baseName.replace(/-/g, '_')}"`,
                    ),
                );
            }
        }
        return violations;
    },
};

// ============================================================================
// §2.11 CONDITIONAL EXPRESSIONS
// ============================================================================

/**
 * PY-COND-01: No nested conditional expressions
 *
 * "Each portion must fit on one line: true-expression, if-expression,
 * else-expression. Not allowed when the stuff gets longer."
 *
 * Nested ternaries are hard to read. This detects x if a else y if b else z.
 *
 * Google Python Style Guide §2.11
 */
const noNestedConditionalExpr: Rule = {
    id: 'PY-COND-01',
    name: 'No nested conditional expressions',
    description:
        'Do not nest conditional expressions (ternary). Use if/elif/else statements instead.',
    severity: 'medium',
    guideSection: '§2.11',
    guideUrl: 'https://google.github.io/styleguide/pyguide.html#s2.11-conditional-expressions',
    check(lines: string[], _filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        // Matches nested ternary: ... if ... else ... if ... else ...
        const nestedTernary = /\bif\b.+\belse\b.+\bif\b.+\belse\b/;

        for (let i = 0; i < searchLines.length; i++) {
            if (nestedTernary.test(searchLines[i])) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        lines[i],
                        'Nested conditional expression found. This is hard to read.',
                        'Use if/elif/else statements instead of nested ternary expressions.',
                    ),
                );
            }
        }
        return violations;
    },
};

// ============================================================================
// §2.6 NESTED/LOCAL/INNER CLASSES AND FUNCTIONS
// ============================================================================

// §2.6 Nested/Local/Inner Classes -- deferred to AI deep review layer
// (requires understanding scope depth that regex alone cannot reliably assess)

// ============================================================================
// §2.9 GENERATORS
// ============================================================================

// §2.9 Generators -- deferred to AI deep review layer

// ============================================================================
// §2.13 PROPERTIES
// ============================================================================

// §2.13 Properties -- deferred to AI deep review layer

// ============================================================================
// §2.16 LEXICAL SCOPING
// ============================================================================

// §2.16 Lexical Scoping -- deferred to AI deep review layer

// ============================================================================
// §2.18 THREADING
// ============================================================================

// §2.18 Threading -- deferred to AI deep review layer

// ============================================================================
// §2.20 MODERN PYTHON
// ============================================================================

/**
 * PY-MOD-01: No Python 2 style print statements
 *
 * "Use Python 3 compatible syntax."
 *
 * Google Python Style Guide §2.20
 */
const noLegacyPrintStatement: Rule = {
    id: 'PY-MOD-01',
    name: 'No Python 2 print statements',
    description:
        'Use print() function, not print statement. Python 2 syntax is not allowed.',
    severity: 'high',
    guideSection: '§2.20',
    guideUrl: 'https://google.github.io/styleguide/pyguide.html#s2.20-modern-python',
    check(lines: string[], _filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        // Matches: print "hello" or print 'hello' (Python 2 style)
        // But NOT: print("hello") or print(variable) or print  # comment
        const printStmt = /^\s*print\s+["']/;

        for (let i = 0; i < searchLines.length; i++) {
            if (printStmt.test(searchLines[i])) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        lines[i],
                        'Python 2 style print statement found.',
                        'Use print() function: print("message") instead of print "message".',
                    ),
                );
            }
        }
        return violations;
    },
};

// ============================================================================
// §3.19 TYPE ANNOTATIONS
// ============================================================================

/**
 * PY-TYPE-01: Use X | None instead of Optional[X] (Python 3.10+)
 *
 * "Use explicit X | None instead of implicit."
 *
 * Google Python Style Guide §3.19.5
 */
const preferUnionSyntax: Rule = {
    id: 'PY-TYPE-01',
    name: 'Prefer X | None over Optional[X]',
    description:
        'Use X | None (PEP 604) instead of Optional[X] for modern Python 3.10+ code.',
    severity: 'low',
    guideSection: '§3.19.5',
    guideUrl: 'https://google.github.io/styleguide/pyguide.html#s3.19.5-nonetype',
    check(lines: string[], _filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        const optionalPattern = /\bOptional\s*\[/;

        for (let i = 0; i < searchLines.length; i++) {
            if (optionalPattern.test(searchLines[i])) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        lines[i],
                        'Optional[X] found. Prefer X | None syntax for Python 3.10+.',
                        'Replace Optional[X] with X | None.',
                    ),
                );
            }
        }
        return violations;
    },
};

// ============================================================================
// EXPORT ALL RULES
// ============================================================================

/**
 * All Python rules, in order of guide section.
 * New rules are appended here as more sections are implemented.
 */
export const pythonRules: Rule[] = [
    // §2.1 Lint
    lintDirectivesWithRationale,
    // §2.2 Imports
    noWildcardImports,
    noRelativeImports,
    noMultiImports,
    // §2.3 Packages -- deferred to AI layer
    // §2.4 Exceptions
    noBareExcept,
    noBroadExcept,
    exceptionNaming,
    noAssertForValidation,
    // §2.5 Mutable Global State
    noMutableGlobalState,
    noGlobalKeyword,
    // §2.6 Nested -- deferred to AI deep review layer
    // §2.7 Comprehensions
    noMultipleForInComprehension,
    // §2.8 Default Iterators
    noKeysInForLoop,
    noReadlinesInForLoop,
    // §2.9 Generators -- deferred to AI deep review layer
    // §2.10 Lambda Functions
    noLambdaAssignment,
    // §2.11 Conditional Expressions
    noNestedConditionalExpr,
    // §2.12 Default Argument Values
    noMutableDefaults,
    // §2.13 Properties -- deferred to AI deep review layer
    // §2.14 True/False Evaluations
    useIsNone,
    noIfLen,
    noCompareTrueFalse,
    // §2.16 Lexical Scoping -- deferred to AI deep review layer
    // §2.17 Decorators
    noStaticMethod,
    // §2.18 Threading -- deferred to AI deep review layer
    // §2.19 Power Features
    noPowerFeatures,
    // §2.20 Modern Python
    noLegacyPrintStatement,
    // §2.21 Type Annotated Code
    noTypingText,
    // §3.1 Semicolons
    noSemicolons,
    // §3.2 Line Length
    lineLengthLimit,
    noBackslashContinuation,
    // §3.3 Parentheses
    noUnnecessaryParentheses,
    // §3.4 Indentation
    noTabIndentation,
    // §3.5 Blank Lines
    twoBlankLinesBetweenTopLevel,
    // §3.6 Whitespace
    noTrailingWhitespace,
    // §3.7 Shebang
    modernShebang,
    // §3.8 Docstrings and Comments
    enforceTripleDoubleQuotes,
    requireDocstrings,
    properBlockComments,
    // §3.10 Strings
    noStringConcatInLoop,
    noFStringInLogging,
    // §3.11 Files/Resources
    useWithForFiles,
    // §3.12 TODOs
    todoRequiresName,
    // §3.14 Statements
    noSingleLineTryExcept,
    // §3.15 Accessors -- deferred to AI deep review layer
    // §3.16 Naming
    functionSnakeCase,
    classPascalCase,
    noSingleCharNames,
    noDashesInFilename,
    // §3.17 Main
    mainGuard,
    // §3.18 Function Length
    functionLength,
    // §3.19 Type Annotations
    preferUnionSyntax,
];
