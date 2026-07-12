/**
 * JavaScript/TypeScript Rules -- Google JavaScript Style Guide
 * https://google.github.io/styleguide/jsguide.html
 *
 * Rules are added incrementally, 2 guide sections at a time.
 * Each rule is a self-contained check function.
 *
 * These rules apply to BOTH JavaScript and TypeScript files.
 * TypeScript-specific rules are marked as such.
 *
 * Current sections covered:
 *   §2 Source File Basics
 *   §3 Source File Structure
 *   §4 Formatting
 *   §5 Language Features
 *   §6 Naming
 *   §7 JSDoc
 */

import { Rule, Violation } from '../../types.js';

// ============================================================================
// HELPER UTILITIES
// ============================================================================

/**
 * Strip strings and comments while preserving line count/length.
 * Crucial for avoiding false positive regex matches.
 */
export function getCleanLines(lines: string[]): string[] {
    const code = lines.join('\n');
    let cleanCode = '';

    let state = 'NORMAL'; // NORMAL, STRING_S, STRING_D, STRING_T, COMMENT_S, COMMENT_M
    let i = 0;

    while (i < code.length) {
        const char = code[i];
        const nextChar = code[i + 1] || '';

        // Unconditionally preserve newlines to guarantee array length parity
        if (char === '\n') {
            cleanCode += '\n';
            if (state === 'COMMENT_S') {
                state = 'NORMAL';
            }
            i++;
            continue;
        }

        // Handle escapes
        if ((state === 'STRING_S' || state === 'STRING_D' || state === 'STRING_T') && char === '\\') {
            cleanCode += ' ';
            if (nextChar === '\n') {
                // Should not hit because of the check above, but just in case
            } else {
                cleanCode += ' '; // escaped char becomes a space
                i += 2;
                continue;
            }
        }

        switch (state) {
            case 'NORMAL':
                if (char === '/' && nextChar === '/') {
                    state = 'COMMENT_S';
                    cleanCode += '  ';
                    i += 2;
                } else if (char === '/' && nextChar === '*') {
                    state = 'COMMENT_M';
                    cleanCode += '  ';
                    i += 2;
                } else if (char === "'") {
                    state = 'STRING_S';
                    cleanCode += char;
                    i++;
                } else if (char === '"') {
                    state = 'STRING_D';
                    cleanCode += char;
                    i++;
                } else if (char === '`') {
                    state = 'STRING_T';
                    cleanCode += char;
                    i++;
                } else {
                    cleanCode += char;
                    i++;
                }
                break;

            case 'COMMENT_S':
                cleanCode += ' '; // Preserve length
                i++;
                break;

            case 'COMMENT_M':
                if (char === '*' && nextChar === '/') {
                    state = 'NORMAL';
                    cleanCode += '  ';
                    i += 2;
                } else {
                    cleanCode += ' '; // Preserve length
                    i++;
                }
                break;

            case 'STRING_S':
                if (char === "'") {
                    state = 'NORMAL';
                    cleanCode += char;
                } else {
                    cleanCode += ' ';
                }
                i++;
                break;

            case 'STRING_D':
                if (char === '"') {
                    state = 'NORMAL';
                    cleanCode += char;
                } else {
                    cleanCode += ' ';
                }
                i++;
                break;

            case 'STRING_T':
                if (char === '`') {
                    state = 'NORMAL';
                    cleanCode += char;
                } else {
                    cleanCode += ' ';
                }
                i++;
                break;
        }
    }

    return cleanCode.split('\n');
}



/**
 * Check if a line is a comment (single-line // or block comment start / *).
 */
function isCommentLine(cleanLine: string): boolean {
    return cleanLine.trim() === '';
}

/**
 * Check if a line is inside a string literal.
 * Simple heuristic: if a line starts with a quote character (after trimming),
 * backtick, or is a continuation of a template literal.
 */
function isStringLine(cleanLine: string): boolean {
    return false; // Deprecated by cleanLines logic
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
// §3 SOURCE FILE STRUCTURE
// ============================================================================

/**
 * JS-MOD-01: No default exports
 *
 * "Use named exports in all code... Do not use default exports.
 *  Importing modules must give a name to these values, which can lead
 *  to inconsistencies in naming across modules."
 *
 * Google JavaScript Style Guide §3.4.2.1
 */
const noDefaultExports: Rule = {
    id: 'JS-MOD-01',
    name: 'No default exports',
    description:
        'Do not use default exports. Named exports ensure consistent naming across all importing modules.',
    severity: 'medium',
    guideSection: '§3.4.2.1',
    guideUrl: 'https://google.github.io/styleguide/jsguide.html#named-vs-default-exports',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];
        const pattern = /^\s*export\s+default\b/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            if (pattern.test(cleanLine)) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        `Default export found: "${line.trim()}". Default exports can cause naming inconsistencies across modules.`,
                        'Use named exports instead: "export class Foo { ... }" or "export { Foo };"',
                    ),
                );
            }
        }
        return violations;
    },
};

// ============================================================================
// §4 FORMATTING
// ============================================================================

/**
 * JS-FMT-01: Semicolons are required
 *
 * "Every statement must be terminated with a semicolon.
 *  Relying on automatic semicolon insertion is forbidden."
 *
 * Google JavaScript Style Guide §4.3.2
 */
const semicolonsRequired: Rule = {
    id: 'JS-FMT-01',
    name: 'Semicolons required',
    description:
        'Every statement must be terminated with a semicolon. Relying on automatic semicolon insertion (ASI) is forbidden.',
    severity: 'low',
    guideSection: '§4.3.2',
    guideUrl: 'https://google.github.io/styleguide/jsguide.html#formatting-semicolons',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];

        const skipPatterns = [
            /^\s*$/,
            /^\s*\/\//,
            /^\s*\/?\*+/,
            /^\s*(if|else|for|while|do|switch|try|catch|finally|case|default)\b/,
            /^\s*(function|class|interface|type|enum|namespace|module)\b.*\{?\s*$/,
            /^\s*(import|export)\b/,
            /[{(,]\s*$/,
            /^\s*\}/,
            /^\s*\)/,
            /^\s*\]/,
            /[+\-*/%=&|<>?:]\s*$/,
            /^\s*\.\w/,
            /^\s*@\w/,
            /^\s*#/,
            /^\s*`/,
        ];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];

            let shouldSkip = false;
            for (const pattern of skipPatterns) {
                if (pattern.test(cleanLine)) {
                    shouldSkip = true;
                    break;
                }
            }
            if (shouldSkip) continue;

            const trimmed = cleanLine.trimEnd();
            if (trimmed.length === 0) continue;

            const lastChar = trimmed[trimmed.length - 1];
            if (lastChar !== ';' && lastChar !== '}' && lastChar !== '{') {
                const looksLikeStatement = /^\s*(const|let|var|return|throw|yield|await|break|continue|this\.|new |delete )\b/.test(cleanLine)
                    || /\)\s*$/.test(trimmed)
                    || /\]\s*$/.test(trimmed);

                if (looksLikeStatement) {
                    violations.push(
                        createViolation(
                            this,
                            i + 1,
                            line,
                            `Statement appears to be missing a semicolon: "${trimmed.trim()}"`,
                            'Add a semicolon at the end of this statement.',
                        ),
                    );
                }
            }
        }
        return violations;
    },
};

/**
 * JS-FMT-02: 80-character line limit
 *
 * "JavaScript code has a column limit of 80 characters."
 *
 * Exceptions: URLs, import/export statements, string literals.
 *
 * Google JavaScript Style Guide §4.4
 */
const lineLength: Rule = {
    id: 'JS-FMT-02',
    name: '80-character line limit',
    description:
        'Lines should not exceed 80 characters. Exceptions: URLs, import/export statements, and long string literals.',
    severity: 'low',
    guideSection: '§4.4',
    guideUrl: 'https://google.github.io/styleguide/jsguide.html#formatting-column-limit',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];
        const MAX_LENGTH = 80;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const length = line.replace(/\r$/, '').length;

            if (length <= MAX_LENGTH) continue;

            const trimmed = line.trim();
            if (/^(import|export)\s/.test(trimmed)) continue;
            if (/https?:\/\/\S+/.test(trimmed)) continue;
            if (/^['"`].*['"`][;,]?\s*$/.test(trimmed)) continue;
            if (/require\s*\(/.test(trimmed)) continue;
            if (/^\s*\/\/.*https?:\/\//.test(line)) continue;

            violations.push(
                createViolation(
                    this,
                    i + 1,
                    line,
                    `Line is ${length} characters long (max: ${MAX_LENGTH}).`,
                    'Break this line into multiple lines. Prefer breaking at higher syntactic levels.',
                ),
            );
        }
        return violations;
    },
};

/**
 * JS-FMT-03: No trailing whitespace
 *
 * "Trailing whitespace is forbidden."
 *
 * Google JavaScript Style Guide §4.6.2
 */
const noTrailingWhitespace: Rule = {
    id: 'JS-FMT-03',
    name: 'No trailing whitespace',
    description:
        'Lines must not have trailing whitespace characters (spaces or tabs at end of line).',
    severity: 'low',
    guideSection: '§4.6.2',
    guideUrl: 'https://google.github.io/styleguide/jsguide.html#formatting-horizontal-whitespace',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].replace(/\r$/, '');
            if (line.length > 0 && /\s+$/.test(line) && line.trim().length > 0) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        'Line has trailing whitespace.',
                        'Remove trailing spaces and tabs from the end of this line.',
                    ),
                );
            }
        }
        return violations;
    },
};

// ============================================================================
// §5 LANGUAGE FEATURES
// ============================================================================

// --- §5.1 Local Variable Declarations ---

/**
 * JS-VAR-01: No `var` keyword
 *
 * "Declare all local variables with either const or let.
 *  The var keyword must not be used."
 *
 * Google JavaScript Style Guide §5.1.1
 */
const noVar: Rule = {
    id: 'JS-VAR-01',
    name: 'No var keyword',
    description:
        'The var keyword must not be used. Use const (preferred) or let instead. var has confusing function-scoping behavior.',
    severity: 'high',
    guideSection: '§5.1.1',
    guideUrl: 'https://google.github.io/styleguide/jsguide.html#features-use-const-and-let',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];
        const pattern = /\bvar\s+\w/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;
            if (isStringLine(line)) continue;

            if (pattern.test(cleanLine)) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        `"var" keyword found: "${line.trim()}". var has function-scoping, not block-scoping.`,
                        'Use "const" if the variable is never reassigned, or "let" if it needs reassignment.',
                    ),
                );
            }
        }
        return violations;
    },
};

/**
 * JS-VAR-02: One variable per declaration
 *
 * "Every local variable declaration declares only one variable:
 *  declarations such as let a = 1, b = 2; are not used."
 *
 * Google JavaScript Style Guide §5.1.2
 */
const oneVarPerDeclaration: Rule = {
    id: 'JS-VAR-02',
    name: 'One variable per declaration',
    description:
        'Each variable declaration should declare only one variable. "let a = 1, b = 2;" should be split into separate declarations.',
    severity: 'low',
    guideSection: '§5.1.2',
    guideUrl: 'https://google.github.io/styleguide/jsguide.html#features-one-variable-per-declaration',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];
        const pattern = /^\s*(const|let|var)\s+\w+\s*=[^,]*,\s*\w+\s*=/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            if (pattern.test(cleanLine)) {
                const keyword = line.match(/^\s*(const|let|var)/)?.[1] || 'const';
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        `Multiple variables declared in one statement: "${line.trim()}"`,
                        `Split into separate declarations, each on its own line with "${keyword}".`,
                    ),
                );
            }
        }
        return violations;
    },
};

// --- §5.2 Array Literals ---

/**
 * JS-ARR-01: No variadic Array constructor
 *
 * "The constructor is error-prone if arguments are added or removed.
 *  Use a literal instead."
 *
 * Google JavaScript Style Guide §5.2.2
 */
const noArrayConstructor: Rule = {
    id: 'JS-ARR-01',
    name: 'No Array constructor',
    description:
        'Do not use "new Array()". The Array constructor is error-prone (new Array(3) creates an empty array of length 3, not [3]). Use array literals [] instead.',
    severity: 'medium',
    guideSection: '§5.2.2',
    guideUrl: 'https://google.github.io/styleguide/jsguide.html#features-arrays-ctor',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];
        const pattern = /\bnew\s+Array\s*\(/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            if (pattern.test(cleanLine)) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        `Array constructor found: "${line.trim()}". The Array constructor is error-prone.`,
                        'Use an array literal instead: "const a = [x1, x2, x3];"',
                    ),
                );
            }
        }
        return violations;
    },
};

// --- §5.3 Object Literals ---

/**
 * JS-OBJ-01: No Object constructor
 *
 * "While Object does not have the same problems as Array, it is still
 *  disallowed for consistency. Use an object literal ({} or {a: 0})."
 *
 * Google JavaScript Style Guide §5.3.2
 */
const noObjectConstructor: Rule = {
    id: 'JS-OBJ-01',
    name: 'No Object constructor',
    description:
        'Do not use "new Object()". Use object literals {} instead for consistency.',
    severity: 'low',
    guideSection: '§5.3.2',
    guideUrl: 'https://google.github.io/styleguide/jsguide.html#features-objects-ctor',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];
        const pattern = /\bnew\s+Object\s*\(/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            if (pattern.test(cleanLine)) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        `Object constructor found: "${line.trim()}". Use an object literal instead.`,
                        'Use "{}" or "{a: 0, b: 1}" instead of "new Object()".',
                    ),
                );
            }
        }
        return violations;
    },
};

// --- §5.5 Functions ---

/**
 * JS-FN-01: No `const self = this`
 *
 * "Prefer arrow functions over other this scoping approaches such as
 *  f.bind(this), goog.bind(f, this), and const self = this."
 *
 * Google JavaScript Style Guide §5.5.3
 */
const noSelfThis: Rule = {
    id: 'JS-FN-01',
    name: 'No self = this pattern',
    description:
        'Do not use "const self = this" or "var that = this" to capture this scope. Use arrow functions instead.',
    severity: 'medium',
    guideSection: '§5.5.3',
    guideUrl: 'https://google.github.io/styleguide/jsguide.html#features-functions-arrow-functions',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];
        const pattern = /\b(const|let|var)\s+(self|that|_this|me)\s*=\s*this\b/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            if (pattern.test(cleanLine)) {
                const varName = line.match(pattern)?.[2] || 'self';
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        `"${varName} = this" pattern found. This is an outdated approach to capturing "this" scope.`,
                        'Use arrow functions instead, which inherit "this" from the enclosing scope.',
                    ),
                );
            }
        }
        return violations;
    },
};

// --- §5.6 String Literals ---

/**
 * JS-STR-01: Use single quotes
 *
 * "Ordinary string literals are delimited with single quotes ('),
 *  rather than double quotes (\")."
 *
 * Exception: if the string itself contains a single quote.
 *
 * Google JavaScript Style Guide §5.6.1
 */
const useSingleQuotes: Rule = {
    id: 'JS-STR-01',
    name: 'Use single quotes for strings',
    description:
        'Ordinary string literals should use single quotes, not double quotes. Use template literals for strings containing single quotes.',
    severity: 'low',
    guideSection: '§5.6.1',
    guideUrl: 'https://google.github.io/styleguide/jsguide.html#features-strings-use-single-quotes',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];
        const doubleQuotePattern = /"[^"]*"/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            // Skip import/export/require lines
            if (/^\s*(import|export|require)\b/.test(cleanLine)) continue;

            // Skip JSX attributes
            if (/\w+="[^"]*"/.test(cleanLine) && /<\w/.test(cleanLine)) continue;

            const match = cleanLine.match(doubleQuotePattern);
            if (match) {
                const stringContent = match[0].slice(1, -1);
                // If the string contains a single quote, double quotes are ok
                if (stringContent.includes("'")) continue;

                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        `Double-quoted string found: ${match[0]}. Use single quotes for ordinary strings.`,
                        `Replace with single quotes: '${stringContent}'`,
                    ),
                );
            }
        }
        return violations;
    },
};

// --- §5.8 Control Structures ---

/**
 * JS-ERR-01: No empty catch blocks
 *
 * "It is very rarely correct to do nothing in response to a caught
 *  exception. When it truly is appropriate to take no action, the reason
 *  is explained in a comment."
 *
 * Google JavaScript Style Guide §5.8.2.1
 */
const noEmptyCatch: Rule = {
    id: 'JS-ERR-01',
    name: 'No empty catch blocks',
    description:
        'Catch blocks must not be empty. If no action is needed, add a comment explaining why.',
    severity: 'high',
    guideSection: '§5.8.2.1',
    guideUrl: 'https://google.github.io/styleguide/jsguide.html#features-exceptions',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            // Same-line empty catch: catch (...) { }
            if (/\bcatch\s*\([^)]*\)\s*\{\s*\}/.test(cleanLine)) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        'Empty catch block. Silently swallowing exceptions hides bugs.',
                        'Add error handling logic, or add a comment explaining why this is safe to ignore.',
                    ),
                );
                continue;
            }

            // Multi-line empty catch: catch (...) { \n }
            if (/\bcatch\s*\([^)]*\)\s*\{\s*$/.test(cleanLine)) {
                for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
                    const nextLine = searchLines[j].trim();
                    if (nextLine === '') continue;
                    if (nextLine === '}') {
                        violations.push(
                            createViolation(
                                this,
                                i + 1,
                                line,
                                'Empty catch block. Silently swallowing exceptions hides bugs.',
                                'Add error handling logic, or add a comment explaining why this is safe to ignore.',
                            ),
                        );
                    }
                    break;
                }
            }
        }
        return violations;
    },
};

/**
 * JS-ERR-02: Throw only Error objects
 *
 * "Always throw Errors or subclasses of Error: never throw string
 *  literals or other objects."
 *
 * Google JavaScript Style Guide §5.8.2
 */
const throwOnlyErrors: Rule = {
    id: 'JS-ERR-02',
    name: 'Throw only Error objects',
    description:
        'Always throw Error objects or subclasses. Do not throw string literals, numbers, or plain objects.',
    severity: 'medium',
    guideSection: '§5.8.2',
    guideUrl: 'https://google.github.io/styleguide/jsguide.html#features-exceptions',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];
        const throwStringPattern = /\bthrow\s+['"`]/;
        const throwNumberPattern = /\bthrow\s+\d/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            if (throwStringPattern.test(cleanLine)) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        `Throwing a string literal: "${line.trim()}". String throws lose stack trace information.`,
                        "Throw an Error object instead: throw new Error('message');",
                    ),
                );
            } else if (throwNumberPattern.test(cleanLine)) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        `Throwing a number: "${line.trim()}". Non-Error throws lose stack trace information.`,
                        "Throw an Error object instead: throw new Error('message');",
                    ),
                );
            }
        }
        return violations;
    },
};

// --- §5.10 Equality Checks ---

/**
 * JS-EQ-01: Use === not ==
 *
 * "Use identity operators (===/!==) except in the cases documented below."
 *
 * Exception: == null is allowed (catches both null and undefined).
 *
 * Google JavaScript Style Guide §5.10
 */
const useStrictEquality: Rule = {
    id: 'JS-EQ-01',
    name: 'Use === not ==',
    description:
        'Use strict equality (===) instead of loose equality (==). Loose equality performs type coercion.',
    severity: 'high',
    guideSection: '§5.10',
    guideUrl: 'https://google.github.io/styleguide/jsguide.html#features-equality-checks',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            // Find == that is NOT === (not preceded by ! or = and not followed by =)
            const matches = [...cleanLine.matchAll(/([^!=<>])={2}(?!=)/g)];
            for (const match of matches) {
                // Exception: == null is allowed
                const afterIdx = (match.index ?? 0) + match[0].length;
                const afterMatch = cleanLine.substring(afterIdx).trimStart();
                if (afterMatch.startsWith('null')) continue;

                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        `Loose equality (==) found: "${line.trim()}". This performs type coercion.`,
                        'Use strict equality (===). Exception: "== null" is allowed to catch both null and undefined.',
                        (match.index ?? 0) + 2,
                    ),
                );
                break; // One violation per line
            }
        }
        return violations;
    },
};

/**
 * JS-EQ-02: Use !== not !=
 *
 * Same rationale as JS-EQ-01 but for inequality.
 * Exception: != null is allowed.
 *
 * Google JavaScript Style Guide §5.10
 */
const useStrictInequality: Rule = {
    id: 'JS-EQ-02',
    name: 'Use !== not !=',
    description:
        'Use strict inequality (!==) instead of loose inequality (!=). Loose inequality performs type coercion.',
    severity: 'high',
    guideSection: '§5.10',
    guideUrl: 'https://google.github.io/styleguide/jsguide.html#features-equality-checks',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            const matches = [...cleanLine.matchAll(/!={1}(?!=)/g)];
            for (const match of matches) {
                // Exception: != null is allowed
                const afterIdx = (match.index ?? 0) + match[0].length;
                const afterMatch = cleanLine.substring(afterIdx).trimStart();
                if (afterMatch.startsWith('null')) continue;

                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        `Loose inequality (!=) found: "${line.trim()}". This performs type coercion.`,
                        'Use strict inequality (!==). Exception: "!= null" is allowed.',
                        (match.index ?? 0) + 1,
                    ),
                );
                break;
            }
        }
        return violations;
    },
};

// --- §5.11 Disallowed Features ---

/**
 * JS-DIS-01: No eval() or new Function()
 *
 * "Do not use eval or the Function(...string) constructor. These
 *  features are potentially dangerous and do not work in CSP environments."
 *
 * Google JavaScript Style Guide §5.11.2
 */
const noEval: Rule = {
    id: 'JS-DIS-01',
    name: 'No eval()',
    description:
        'eval() and new Function() are forbidden. They are dangerous (code injection risk) and break Content Security Policy.',
    severity: 'critical',
    guideSection: '§5.11.2',
    guideUrl: 'https://google.github.io/styleguide/jsguide.html#disallowed-features-dynamic-code-evaluation',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];
        const evalPattern = /\beval\s*\(/;
        const fnConstructor = /\bnew\s+Function\s*\(/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            if (evalPattern.test(cleanLine)) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        `eval() found: "${line.trim()}". eval() is a security risk and breaks CSP.`,
                        'Use JSON.parse() for data, or refactor to avoid eval() entirely.',
                    ),
                );
            } else if (fnConstructor.test(cleanLine)) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        `new Function() found: "${line.trim()}". This is equivalent to eval().`,
                        'Refactor to avoid dynamic code generation.',
                    ),
                );
            }
        }
        return violations;
    },
};

/**
 * JS-DIS-02: No `with` statement
 *
 * "Do not use the with keyword. It makes your code harder to
 *  understand and has been banned in strict mode since ES5."
 *
 * Google JavaScript Style Guide §5.11.1
 */
const noWith: Rule = {
    id: 'JS-DIS-02',
    name: 'No with statement',
    description:
        'The "with" statement is forbidden. It is banned in strict mode since ES5 and makes code ambiguous.',
    severity: 'critical',
    guideSection: '§5.11.1',
    guideUrl: 'https://google.github.io/styleguide/jsguide.html#disallowed-features-with',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];
        const pattern = /\bwith\s*\(/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            if (pattern.test(cleanLine)) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        `"with" statement found: "${line.trim()}". Banned in strict mode since ES5.`,
                        'Access properties directly: use "obj.prop" instead of "with(obj) { prop }".',
                    ),
                );
            }
        }
        return violations;
    },
};

/**
 * JS-DIS-03: No wrapper objects for primitives
 *
 * "Never use new on the primitive object wrappers (Boolean, Number, String)."
 *
 * Google JavaScript Style Guide §5.11.5
 */
const noWrapperObjects: Rule = {
    id: 'JS-DIS-03',
    name: 'No wrapper objects for primitives',
    description:
        'Never use "new Boolean()", "new Number()", or "new String()". They create wrapper objects, not primitives.',
    severity: 'medium',
    guideSection: '§5.11.5',
    guideUrl: 'https://google.github.io/styleguide/jsguide.html#disallowed-features-wrapper-objects',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];
        const pattern = /\bnew\s+(Boolean|Number|String)\s*\(/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            const match = cleanLine.match(pattern);
            if (match) {
                const typeName = match[1];
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        `Wrapper object "new ${typeName}()" found. typeof new Boolean(false) is "object" -- not what you expect!`,
                        `Use ${typeName}() without "new" for type coercion, or use the literal directly.`,
                    ),
                );
            }
        }
        return violations;
    },
};

/**
 * JS-DIS-04: No debugger statement
 *
 * debugger statements must not be left in production code.
 * Universally enforced across all major JS linters.
 */
const noDebugger: Rule = {
    id: 'JS-DIS-04',
    name: 'No debugger statement',
    description:
        'The "debugger" statement must not be left in production code. It pauses execution when dev tools are open.',
    severity: 'high',
    guideSection: '§5.11',
    guideUrl: 'https://google.github.io/styleguide/jsguide.html#disallowed-features',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];
        const pattern = /^\s*debugger\s*;?\s*$/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            if (pattern.test(cleanLine)) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        'Debugger statement found. This will pause execution in browser dev tools.',
                        'Remove the debugger statement before committing.',
                    ),
                );
            }
        }
        return violations;
    },
};

// ============================================================================
// §6 NAMING
// ============================================================================

/**
 * JS-NAME-01: Classes must use UpperCamelCase (PascalCase)
 *
 * "Class, interface, record, and typedef names are written in
 *  UpperCamelCase."
 *
 * Google JavaScript Style Guide §6.2.2
 */
const classPascalCase: Rule = {
    id: 'JS-NAME-01',
    name: 'Classes must use PascalCase',
    description:
        'Class names must be written in UpperCamelCase (PascalCase).',
    severity: 'medium',
    guideSection: '§6.2.2',
    guideUrl: 'https://google.github.io/styleguide/jsguide.html#naming-class-names',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];
        const pattern = /^\s*(?:export\s+)?(?:abstract\s+)?class\s+([a-z_]\w*)/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            const match = cleanLine.match(pattern);
            if (match) {
                const className = match[1];
                const pascal = className.charAt(0).toUpperCase() + className.slice(1);
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        `Class "${className}" does not use PascalCase.`,
                        `Rename to "${pascal}".`,
                    ),
                );
            }
        }
        return violations;
    },
};

// ============================================================================
// BEST PRACTICES
// ============================================================================

/**
 * JS-BP-01: No console.log in production code
 */
const noConsoleLog: Rule = {
    id: 'JS-BP-01',
    name: 'No console.log in production',
    description:
        'console.log/warn/error should not be left in production code.',
    severity: 'medium',
    guideSection: 'Best Practice',
    guideUrl: 'https://google.github.io/styleguide/jsguide.html',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];
        const pattern = /\bconsole\.(log|warn|error|info|debug|trace)\s*\(/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            const match = cleanLine.match(pattern);
            if (match) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        `console.${match[1]}() found. Remove before production.`,
                        'Use a proper logging library instead.',
                    ),
                );
            }
        }
        return violations;
    },
};

// ============================================================================
// ADDITIONAL AUDIT RULES (Missing 8 rules)
// ============================================================================

/**
 * JS-FMT-04: No tabs for indentation
 * 
 * "Tab characters are not used for indentation."
 * 
 * Google JavaScript Style Guide §2.3.1
 */
const noTabsForIndentation: Rule = {
    id: 'JS-FMT-04',
    name: 'No tabs for indentation',
    description: 'Tab characters are not used for indentation. Use spaces instead.',
    severity: 'low',
    guideSection: '§2.3.1',
    guideUrl: 'https://google.github.io/styleguide/jsguide.html#file-whitespace-characters',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (/^\s*\t/.test(line)) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        'Tab character used for indentation.',
                        'Replace tabs with spaces (2 spaces per indent level).',
                    ),
                );
            }
        }
        return violations;
    },
};

/**
 * JS-FMT-05: Braces required for control structures
 * 
 * "Braces are required for all control structures (i.e. if, else, for, do, while), 
 *  even if the body contains only a single statement."
 * 
 * Google JavaScript Style Guide §4.1.1
 */
const bracesForControlStructures: Rule = {
    id: 'JS-FMT-05',
    name: 'Braces required for control structures',
    description: 'Braces {} are required for all control structures (if, else, for, while, do), even for single statements.',
    severity: 'low',
    guideSection: '§4.1.1',
    guideUrl: 'https://google.github.io/styleguide/jsguide.html#formatting-braces-all',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            const multilinePattern = /^\s*(if|for|while|catch)\s*\([^)]*\)\s*$/;
            if (multilinePattern.test(cleanLine)) {
                if (i + 1 < lines.length) {
                    const nextClean = searchLines[i + 1].trim();
                    if (nextClean !== '' && !nextClean.startsWith('{') && !isCommentLine(searchLines[i + 1])) {
                        violations.push(
                            createViolation(
                                this,
                                i + 1,
                                line,
                                `Control structure "${line.trim()}" lacks opening brace.`,
                                'Always use braces {} for control structures.',
                            ),
                        );
                    }
                }
            }

            if (/^\s*else\s*$/.test(cleanLine)) {
                if (i + 1 < lines.length) {
                    const nextClean = searchLines[i + 1].trim();
                    if (nextClean !== '' && !nextClean.startsWith('{') && !nextClean.startsWith('if') && !isCommentLine(searchLines[i + 1])) {
                        violations.push(
                            createViolation(
                                this,
                                i + 1,
                                line,
                                `"else" statement lacks opening brace.`,
                                'Always use braces {} for control structures.',
                            ),
                        );
                    }
                }
            }
        }
        return violations;
    },
};

/**
 * JS-FMT-06: Opening brace on same line (K&R style)
 * 
 * "Braces follow the Kernighan and Ritchie style for nonempty blocks and block-like constructs:
 *  No line break before the opening brace."
 * 
 * Google JavaScript Style Guide §4.1.2
 */
const knrBraceStyle: Rule = {
    id: 'JS-FMT-06',
    name: 'Opening brace on same line (K&R style)',
    description: 'Opening braces { must be on the same line as the preceding statement (K&R style).',
    severity: 'low',
    guideSection: '§4.1.2',
    guideUrl: 'https://google.github.io/styleguide/jsguide.html#formatting-nonempty-blocks',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];

            if (isCommentLine(cleanLine)) continue;

            if (/^\s*\{\s*$/.test(cleanLine)) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        'Opening brace { found on its own line.',
                        'Move the opening brace to the end of the previous line (K&R style).',
                    ),
                );
            }
        }
        return violations;
    },
};

/**
 * JS-FMT-07: One statement per line
 * 
 * "Each statement is followed by a line-break."
 * 
 * Google JavaScript Style Guide §4.3.1
 */
const oneStatementPerLine: Rule = {
    id: 'JS-FMT-07',
    name: 'One statement per line',
    description: 'Each statement must be on its own line. Do not combine multiple statements on a single line.',
    severity: 'low',
    guideSection: '§4.3.1',
    guideUrl: 'https://google.github.io/styleguide/jsguide.html#formatting-statements',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            if (/;[ \t]+\w/.test(cleanLine) && !/^\s*for\s*\(/.test(cleanLine)) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        'Multiple statements found on a single line.',
                        'Split into multiple lines (one statement per line).',
                    ),
                );
            }
        }
        return violations;
    },
};

/**
 * JS-STR-02: No line continuations
 * 
 * "Do not use line continuations (that is, ending a line inside a string
 *  literal with a backslash) in either ordinary or template string literals."
 * 
 * Google JavaScript Style Guide §5.6.3
 */
const noLineContinuations: Rule = {
    id: 'JS-STR-02',
    name: 'No line continuations',
    description: 'Do not use line continuations (ending a line with a backslash) in string literals.',
    severity: 'medium',
    guideSection: '§5.6.3',
    guideUrl: 'https://google.github.io/styleguide/jsguide.html#features-strings-no-line-continuations',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];
        const pattern = /\\(\s*)$/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            if (pattern.test(line)) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        'Line continuation (backslash at end of line) found. This can lead to tricky errors.',
                        'Use string concatenation (+) or multiline template literals across separate lines instead.',
                    ),
                );
            }
        }
        return violations;
    },
};

/**
 * JS-FN-02: No arguments keyword
 * 
 * "Never name a local variable or parameter arguments... 
 *  Use a rest parameter instead of accessing arguments."
 * 
 * Google JavaScript Style Guide §5.5.5.2
 */
const noArgumentsKeyword: Rule = {
    id: 'JS-FN-02',
    name: 'No arguments keyword',
    description: 'Do not use the "arguments" keyword or name variables "arguments". Use rest parameters (...args) instead.',
    severity: 'medium',
    guideSection: '§5.5.5.2',
    guideUrl: 'https://google.github.io/styleguide/jsguide.html#features-functions-rest-parameters',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];
        const pattern = /(^|[^\w.])arguments\b/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            if (pattern.test(cleanLine)) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        '"arguments" keyword found. Using the implicitly defined arguments object is forbidden.',
                        'Use a rest parameter (...args) instead of arguments.',
                    ),
                );
            }
        }
        return violations;
    },
};

/**
 * JS-DIS-05: No constructor without parens
 * 
 * "Never invoke a constructor in a new statement without using parentheses ()."
 * 
 * Google JavaScript Style Guide §5.11.7
 */
const noConstructorWithoutParens: Rule = {
    id: 'JS-DIS-05',
    name: 'No constructor without parens',
    description: 'Never invoke a constructor in a new statement without using parentheses ().',
    severity: 'medium',
    guideSection: '§5.11.7',
    guideUrl: 'https://google.github.io/styleguide/jsguide.html#disallowed-features-new-parens',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];
        const pattern = /\bnew\s+[A-Za-z0-9_.]+\b(?!\s*[\(.\[<])/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            const match = cleanLine.match(pattern);
            if (match) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        `Constructor invoked without parentheses: "${match[0]}".`,
                        `Add parentheses: "${match[0]}()".`,
                    ),
                );
            }
        }
        return violations;
    },
};

/**
 * JS-DIS-06: No modifying builtin prototypes
 * 
 * "Never modify builtin types, either by adding methods to their
 *  constructors or to their prototypes."
 * 
 * Google JavaScript Style Guide §5.11.6
 */
const noModifyingBuiltins: Rule = {
    id: 'JS-DIS-06',
    name: 'No modifying builtin prototypes',
    description: 'Do not modify built-in prototypes (e.g., Array.prototype.foo = ...).',
    severity: 'critical',
    guideSection: '§5.11.6',
    guideUrl: 'https://google.github.io/styleguide/jsguide.html#disallowed-features-builtin-objects',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];
        const builtins = ['Object', 'Array', 'String', 'Number', 'Boolean', 'Function', 'Symbol', 'Date', 'RegExp', 'Map', 'Set', 'Promise'];
        const builtinsStr = builtins.join('|');
        const pattern = new RegExp(`\\b(${builtinsStr})\\.prototype\\b`);

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            if (pattern.test(cleanLine)) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        'Reference to built-in prototype found. Modifying built-in objects is forbidden.',
                        'Use standalone functions or classes instead of monkey-patching built-ins.',
                    ),
                );
            }
        }
        return violations;
    },
};

/**
 * JS-NAME-02: camelCase for variables/functions
 *
 * "Variable, parameter, and function names are written in lowerCamelCase."
 *
 * Google JavaScript Style Guide §6.2.1
 */
const lowerCamelCase: Rule = {
    id: 'JS-NAME-02',
    name: 'camelCase for variables/functions',
    description: 'Variables and functions should use lowerCamelCase.',
    severity: 'medium',
    guideSection: '§6.2.1',
    guideUrl: 'https://google.github.io/styleguide/jsguide.html#naming-camel-case-defined',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];
        // Match `let Foo`, `var Foo`, `function Foo` where it starts with uppercase. Exclude constants.
        const pattern = /^\s*(?:export\s+)?(?:let|var|function)\s+([A-Z]\w*)/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            const match = cleanLine.match(pattern);
            if (match) {
                const name = match[1];
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        `Variable/function "${name}" should be lowerCamelCase.`,
                        `Rename to "${name.charAt(0).toLowerCase() + name.slice(1)}".`,
                    ),
                );
            }
        }
        return violations;
    },
};

/**
 * JS-NAME-03: CONSTANT_CASE for constants
 *
 * "Constant names use CONSTANT_CASE: all uppercase letters, with words separated by underscores."
 *
 * Google JavaScript Style Guide §6.2.4
 */
const constantCase: Rule = {
    id: 'JS-NAME-03',
    name: 'CONSTANT_CASE for constants',
    description: 'Constants at module/file level should use CONSTANT_CASE.',
    severity: 'low',
    guideSection: '§6.2.4',
    guideUrl: 'https://google.github.io/styleguide/jsguide.html#naming-constant-names',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];
        // Catch `const fooBar =` -> constants should be uppercase if they are truly constants.
        // It's a heuristic, but we'll flag primitive const assignments at the top level.
        const pattern = /^\s*(?:export\s+)?const\s+([a-z]\w*)\s*=\s*(?:'[^']*'|"[^"]*"|true|false|\d+)/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            const match = cleanLine.match(pattern);
            if (match) {
                const name = match[1];
                // Don't flag if it's like `const foo = require('foo')` (not matching our primitive regex anyway)
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        `Constant "${name}" might need to be CONSTANT_CASE.`,
                        'If this is a deeply immutable constant, name it with UPPER_SNAKE_CASE.',
                    ),
                );
            }
        }
        return violations;
    },
};

/**
 * JS-NAME-04: Private naming
 *
 * "Historically, private properties and methods were named with a trailing underscore."
 * (This is relevant for non-TS code or classes not using `#`).
 *
 * Google JavaScript Style Guide §6.2.2
 */
const privateNamingTrailingUnderscore: Rule = {
    id: 'JS-NAME-04',
    name: 'No leading underscores for privates',
    description: 'Do not use leading underscores for private properties. Historically, trailing underscores were used.',
    severity: 'low',
    guideSection: '§6.2.2',
    guideUrl: 'https://google.github.io/styleguide/jsguide.html',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];
        const pattern = /\bthis\._[a-zA-Z0-9]+/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            if (pattern.test(cleanLine)) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        'Leading underscore used for simulated private property.',
                        'Use a trailing underscore instead (e.g., this.prop_), or the ES2022 #private syntax.',
                    ),
                );
            }
        }
        return violations;
    },
};

// ============================================================================
// §5 LANGUAGE FEATURES (Modern ES6+)
// ============================================================================

/**
 * JS-FEAT-01: Prefer Template Literals
 * Google JavaScript Style Guide §5.6.2
 */
const preferTemplateLiterals: Rule = {
    id: 'JS-FEAT-01',
    name: 'Prefer Template Literals',
    description: 'Use template literals over string concatenation for complex strings.',
    severity: 'low',
    guideSection: '§5.6.2',
    guideUrl: 'https://google.github.io/styleguide/jsguide.html#features-strings-template-literals',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];
        // Matches strings concatenated with variables like: "foo " + var + " bar"
        const pattern = /("[^"]*"|'[^']*')\s*\+\s*[a-zA-Z_$][\w.$]*\s*\+\s*("[^"]*"|'[^']*')/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            if (pattern.test(cleanLine)) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        'String concatenation with variables found.',
                        'Use template literals (`...`) instead of complex string concatenation.',
                    ),
                );
            }
        }
        return violations;
    },
};

/**
 * JS-FEAT-02: Prefer Arrow Functions
 * Google JavaScript Style Guide §5.5.3
 */
const preferArrowFunctions: Rule = {
    id: 'JS-FEAT-02',
    name: 'Prefer Arrow Functions',
    description: 'Use arrow functions instead of anonymous function expressions.',
    severity: 'medium',
    guideSection: '§5.5.3',
    guideUrl: 'https://google.github.io/styleguide/jsguide.html#features-functions-arrow-functions',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];
        // Matches callback style `setTimeout(function() {` etc.
        const pattern = /[([,=:=]\s*function\s*\(/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            if (pattern.test(cleanLine)) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        'Anonymous function expression found.',
                        'Use an arrow function (() => { ... }) instead of "function() { ... }".',
                    ),
                );
            }
        }
        return violations;
    },
};

/**
 * JS-FEAT-03: Prefer for...of
 * Google JavaScript Style Guide §5.2.2
 */
const preferForOf: Rule = {
    id: 'JS-FEAT-03',
    name: 'Prefer for...of over for...in',
    description: 'Use for...of for arrays, and Objects keys/values. Avoid for...in.',
    severity: 'medium',
    guideSection: '§5.2.2',
    guideUrl: 'https://google.github.io/styleguide/jsguide.html#features-loops',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];
        const pattern = /^\s*for\s*\(\s*(const|let|var)\s+\w+\s+in\s+/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            if (pattern.test(cleanLine)) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        '"for...in" loop found.',
                        'Use "for...of" (for arrays) or Object.keys() (for objects) instead of "for...in".',
                    ),
                );
            }
        }
        return violations;
    },
};

/**
 * JS-FEAT-04: ES6 Classes
 * Google JavaScript Style Guide §5.4.1
 */
const preferClasses: Rule = {
    id: 'JS-FEAT-04',
    name: 'Prefer ES6 Classes',
    description: 'Use the class keyword instead of manipulating prototype directly.',
    severity: 'medium',
    guideSection: '§5.4.1',
    guideUrl: 'https://google.github.io/styleguide/jsguide.html#features-classes',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];
        const pattern = /^[A-Z][\w.\[\]]+\.prototype\.\w+\s*=\s*(function|=>)/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            if (pattern.test(cleanLine)) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        'Prototype manipulation found.',
                        'Use ES6 "class" syntax instead of assigning functions to a prototype.',
                    ),
                );
            }
        }
        return violations;
    },
};

// ============================================================================
// §7 JSDOC & COMMENTS
// ============================================================================

/**
 * JS-DOC-01: JSDoc Format
 * Google JavaScript Style Guide §7.1.1
 */
const jsdocFormat: Rule = {
    id: 'JS-DOC-01',
    name: 'JSDoc Block Format',
    description: 'JSDoc blocks must start with /**, not /*.',
    severity: 'low',
    guideSection: '§7.1.1',
    guideUrl: 'https://google.github.io/styleguide/jsguide.html#jsdoc-general-form',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];
        const badJsdoc = /^\s*\/\*(?!\*).*\B@param/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            // We examine comments, so no `isCommentLine` skip here.

            if (badJsdoc.test(line)) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        'JSDoc-like comment starts with /* instead of /**.',
                        'Always start JSDoc blocks with /**',
                    ),
                );
            }
        }
        return violations;
    },
};

/**
 * JS-DOC-02: Required JSDoc for exports
 * Google JavaScript Style Guide §7.3
 */
const requireJsdoc: Rule = {
    id: 'JS-DOC-02',
    name: 'Required JSDoc for exports',
    description: 'Exported top-level functions and classes must have JSDoc.',
    severity: 'medium',
    guideSection: '§7.3',
    guideUrl: 'https://google.github.io/styleguide/jsguide.html#jsdoc-method-and-function-comments',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];
        const exportPattern = /^\s*export\s+(?:default\s+)?(class|function|const\s+[a-zA-Z_]\w*\s*=\s*(?:=>|function))\b/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            const match = cleanLine.match(exportPattern);
            if (match) {
                // Check if the previous non-empty line ends with */
                let hasJsdoc = false;
                for (let j = i - 1; j >= 0; j--) {
                    if (lines[j].trim() === '') continue;
                    if (lines[j].trim().endsWith('*/')) {
                        hasJsdoc = true;
                    }
                    break;
                }

                if (!hasJsdoc) {
                    violations.push(
                        createViolation(
                            this,
                            i + 1,
                            line,
                            'Exported member is missing a JSDoc comment.',
                            'Add a /** ... */ JSDoc block explaining its purpose.',
                        ),
                    );
                }
            }
        }
        return violations;
    },
};

// ============================================================================
// §4 FORMATTING (Additional)
// ============================================================================

/**
 * JS-FMT-08: 2-Space Indentation
 * Google JavaScript Style Guide §4.2
 */
const twoSpaceIndentation: Rule = {
    id: 'JS-FMT-08',
    name: '2-Space Indentation',
    description: 'Indent by 2 spaces per level. Avoid 4-space blocks.',
    severity: 'low',
    guideSection: '§4.2',
    guideUrl: 'https://google.github.io/styleguide/jsguide.html#formatting-block-indentation',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];
        
        let previousIndent = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            // Only care if line starts with spaces
            const match = line.match(/^([ ]+)\S/);
            if (match) {
                const spaceCount = match[1].length;
                if (spaceCount % 2 !== 0 && !line.includes('*')) {
                     // Odd number of spaces is definitely wrong, but 4-spaces when previous was 0 is also suspect.
                     // A simple heuristic: if it jumps by exactly 4 spaces, flag it.
                } else if (spaceCount - previousIndent === 4) {
                    violations.push(
                        createViolation(
                            this,
                            i + 1,
                            line,
                            'Indentation jumped by 4 spaces.',
                            'Use 2 spaces for block indentation.',
                        ),
                    );
                }
                previousIndent = spaceCount;
            } else if (line.trim().length > 0 && !line.startsWith(' ')) {
                previousIndent = 0;
            }
        }
        return violations;
    },
};

/**
 * JS-FMT-09: Multiple Blank Lines
 * Google JavaScript Style Guide §4.6.2
 */
const noMultipleBlankLines: Rule = {
    id: 'JS-FMT-09',
    name: 'No multiple blank lines',
    description: 'Do not use 2 or more consecutive blank lines.',
    severity: 'low',
    guideSection: '§4.6.2',
    guideUrl: 'https://google.github.io/styleguide/jsguide.html#formatting-vertical-whitespace',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        let blankCount = 0;

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim() === '') {
                blankCount++;
                if (blankCount === 2) {
                    violations.push(
                        createViolation(
                            this,
                            i + 1,
                            lines[i],
                            'Multiple consecutive blank lines found.',
                            'Remove extra blank lines to keep vertical whitespacing compact.',
                        ),
                    );
                }
            } else {
                blankCount = 0;
            }
        }
        return violations;
    },
};

// ============================================================================
// ADDITIONAL RULES -- Coverage Gaps
// ============================================================================

/**
 * JS-FILE-01: File names must be lowercase
 *
 * "File names must be all lowercase and may include underscores (_)
 *  or dashes (-), but no additional punctuation."
 *
 * Google JavaScript Style Guide §2.1
 */
const fileNameLowercase: Rule = {
    id: 'JS-FILE-01',
    name: 'Lowercase file names',
    description: 'File names must be all lowercase, may include underscores or dashes.',
    severity: 'low',
    guideSection: '§2.1',
    guideUrl: 'https://google.github.io/styleguide/jsguide.html#file-name',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        if (!filename) return violations;

        const base = filename.replace(/^.*[\\/]/, '');
        if (base !== base.toLowerCase()) {
            violations.push(
                createViolation(
                    this,
                    1,
                    lines[0] || '',
                    `File name "${base}" contains uppercase characters.`,
                    'Rename to all lowercase. Use dashes (-) or underscores (_) as separators.',
                ),
            );
        }
        return violations;
    },
};

/**
 * JS-OBJ-02: No quoted property keys when not needed
 *
 * "Do not mix quoted and unquoted keys... Only quote keys that are not
 *  valid identifiers."
 *
 * Google JavaScript Style Guide §5.3.3
 */
const noUnnecessaryQuotedKeys: Rule = {
    id: 'JS-OBJ-02',
    name: 'No unnecessary quoted property keys',
    description: 'Do not quote property keys that are valid identifiers.',
    severity: 'low',
    guideSection: '§5.3.3',
    guideUrl: 'https://google.github.io/styleguide/jsguide.html#features-objects-mixing-keys',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];
        // Matches {'foo': ..} or {"bar": ..} where the key is a valid JS identifier
        const pattern = /(['"])([a-zA-Z_$][a-zA-Z0-9_$]*)\1\s*:/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            // Match on raw line since quoted keys are string tokens blanked by cleanLines
            const match = line.match(pattern);
            if (match) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        `Quoted property key "${match[2]}" does not need quotes.`,
                        `Use unquoted key: ${match[2]}: instead of ${match[0]}`,
                    ),
                );
            }
        }
        return violations;
    },
};

/**
 * JS-OBJ-03: Use shorthand methods in objects
 *
 * "Methods can be defined on object literals using the shorthand
 *  {method() {... }} form in place of a colon immediately followed
 *  by a function or arrow function literal."
 *
 * Google JavaScript Style Guide §5.3.5
 */
const useShorthandMethods: Rule = {
    id: 'JS-OBJ-03',
    name: 'Use shorthand methods',
    description: 'Use shorthand method syntax in object literals instead of function expressions.',
    severity: 'low',
    guideSection: '§5.3.5',
    guideUrl: 'https://google.github.io/styleguide/jsguide.html#features-objects-method-shorthand',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];
        // foo: function() { or foo: function bar() {
        const pattern = /\b\w+\s*:\s*function\s*[\w]*\s*\(/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            if (pattern.test(cleanLine)) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        'Object property uses long-form function expression.',
                        'Use shorthand method syntax: method() { ... } instead of method: function() { ... }.',
                    ),
                );
            }
        }
        return violations;
    },
};

/**
 * JS-OBJ-04: Use shorthand properties
 *
 * "Shorthand properties are allowed on object literals."
 * i.e. {x, y} instead of {x: x, y: y}
 *
 * Google JavaScript Style Guide §5.3.4
 */
const useShorthandProperties: Rule = {
    id: 'JS-OBJ-04',
    name: 'Use shorthand properties',
    description: 'Use shorthand property syntax when the key name matches the value variable.',
    severity: 'low',
    guideSection: '§5.3.4',
    guideUrl: 'https://google.github.io/styleguide/jsguide.html#features-objects-shorthand-properties',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];
        // Matches foo: foo, or foo: foo}
        const pattern = /\b([a-zA-Z_$]\w*)\s*:\s*\1\s*[,}]/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            const match = cleanLine.match(pattern);
            if (match) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        `Property "${match[1]}: ${match[1]}" can use shorthand.`,
                        `Use shorthand: { ${match[1]} } instead of { ${match[1]}: ${match[1]} }.`,
                    ),
                );
            }
        }
        return violations;
    },
};

/**
 * JS-ARR-02: Use spread operator instead of Array.prototype.slice
 *
 * "Prefer spread operator [...foo] to Array.prototype.slice.call()"
 *
 * Google JavaScript Style Guide §5.2.4
 */
const preferSpreadOverSlice: Rule = {
    id: 'JS-ARR-02',
    name: 'Prefer spread over Array.prototype.slice',
    description: 'Use the spread operator [...arr] instead of Array.prototype.slice.call().',
    severity: 'low',
    guideSection: '§5.2.4',
    guideUrl: 'https://google.github.io/styleguide/jsguide.html#features-arrays-spread-operator',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];
        const pattern = /Array\.prototype\.slice\.call\s*\(/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            if (pattern.test(cleanLine)) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        'Array.prototype.slice.call() found.',
                        'Use spread operator: [...iterable] instead of Array.prototype.slice.call(iterable).',
                    ),
                );
            }
        }
        return violations;
    },
};

/**
 * JS-ARR-03: Use Array destructuring
 *
 * "Array literals may be used on the left-hand side of an assignment
 *  to perform destructuring."
 *
 * Google JavaScript Style Guide §5.2.3
 */
// §5.2.3 Destructuring -- deferred to AI deep review layer (requires AST)

/**
 * JS-FN-03: Prefer default parameters
 *
 * "Optional function parameters... use default parameter syntax in the
 *  function declaration."
 *
 * Google JavaScript Style Guide §5.5.6
 */
const preferDefaultParams: Rule = {
    id: 'JS-FN-03',
    name: 'Prefer default parameters',
    description: 'Use default parameter syntax instead of conditionally assigning defaults inside function body.',
    severity: 'low',
    guideSection: '§5.5.6',
    guideUrl: 'https://google.github.io/styleguide/jsguide.html#features-functions-default-parameters',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];
        // Matches: param = param || defaultValue or param = param ?? defaultValue
        const pattern = /(\w+)\s*=\s*\1\s*(\|\||&&|\?\?)\s*/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            const match = cleanLine.match(pattern);
            if (match) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        `Manual default parameter pattern: "${match[0].trim()}".`,
                        'Use default parameter syntax in the function signature: function(param = defaultValue).',
                    ),
                );
            }
        }
        return violations;
    },
};

/**
 * JS-DIS-07: No toString on non-objects
 *
 * "Do not use this.constructor on a switch or in a toString method
 *  for non-class types."
 *
 * Google JavaScript Style Guide §5.11.8
 */
// §5.11.8 -- deferred to AI deep review layer

/**
 * JS-DOC-03: Use @param and @return in JSDoc
 *
 * "@param and @return annotations must be used when the function
 *  does not already clearly document what it does."
 *
 * Google JavaScript Style Guide §7.8
 */
const jsdocParamReturn: Rule = {
    id: 'JS-DOC-03',
    name: 'JSDoc @param and @return tags',
    description: 'JSDoc blocks for functions should include @param and @return tags.',
    severity: 'low',
    guideSection: '§7.8',
    guideUrl: 'https://google.github.io/styleguide/jsguide.html#jsdoc-method-and-function-comments',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Find end of JSDoc block
            if (line.trim().endsWith('*/')) {
                // Look ahead to see if the next non-blank line is a function
                let nextCodeLine = -1;
                for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
                    if (lines[j].trim() !== '') {
                        nextCodeLine = j;
                        break;
                    }
                }
                if (nextCodeLine === -1) continue;

                const nextCode = lines[nextCodeLine];
                const isFn = /\b(function|async\s+function)\s+\w+\s*\(/.test(nextCode)
                    || /\b(const|let|var)\s+\w+\s*=\s*(async\s+)?(\([^)]*\)|[a-zA-Z_$]\w*)\s*=>/.test(nextCode);

                if (!isFn) continue;

                // Check if JSDoc has @param
                let hasParam = false;
                let hasReturn = false;
                for (let j = i; j >= Math.max(0, i - 30); j--) {
                    const docLine = lines[j];
                    if (/@param\b/.test(docLine)) hasParam = true;
                    if (/@returns?\b/.test(docLine)) hasReturn = true;
                    if (docLine.trim().startsWith('/**')) break;
                }

                // If function has params but JSDoc has no @param
                const params = nextCode.match(/\(([^)]+)\)/);
                if (params && params[1].trim() && !hasParam) {
                    violations.push(
                        createViolation(
                            this,
                            nextCodeLine + 1,
                            nextCode,
                            'Function has JSDoc but is missing @param tags.',
                            'Add @param {type} name - description for each parameter.',
                        ),
                    );
                }
            }
        }
        return violations;
    },
};

/**
 * JS-MOD-02: Import paths must use .js extension for ES modules
 *
 * "The .js file extension is not optional in import paths and
 *  must always be included."
 *
 * Google JavaScript Style Guide §3.4.1
 */
const importExtension: Rule = {
    id: 'JS-MOD-02',
    name: 'Import paths should include extension',
    description: 'Import paths for local modules should include the .js file extension.',
    severity: 'low',
    guideSection: '§3.4.1',
    guideUrl: 'https://google.github.io/styleguide/jsguide.html#es-module-imports',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];
        // Match relative imports without a file extension
        const pattern = /^\s*import\s+.*from\s+['"](\.[^'"]+)['"]/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            const match = cleanLine.match(pattern);
            if (match) {
                const path = match[1];
                // If path doesn't end with an extension
                if (!/\.\w+$/.test(path)) {
                    violations.push(
                        createViolation(
                            this,
                            i + 1,
                            line,
                            `Import path "${path}" is missing a file extension.`,
                            'Add .js extension to the import path.',
                        ),
                    );
                }
            }
        }
        return violations;
    },
};

/**
 * JS-CTRL-01: No fall-through in switch cases
 *
 * "Within a switch block, each statement group either terminates
 *  abruptly (with a break, return, throw or continue), or is marked
 *  with a comment to indicate that fall-through is intentional."
 *
 * Google JavaScript Style Guide §5.8.3.2
 */
const noSwitchFallthrough: Rule = {
    id: 'JS-CTRL-01',
    name: 'No switch fall-through',
    description: 'Switch cases must end with break/return/throw or a // fall through comment.',
    severity: 'high',
    guideSection: '§5.8.3.2',
    guideUrl: 'https://google.github.io/styleguide/jsguide.html#features-switch-fall-through',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];

        for (let i = 0; i < lines.length; i++) {
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            // If this is a case statement, look backwards to see if the previous
            // case terminated correctly
            if (/^\s*case\s+/.test(cleanLine) || /^\s*default\s*:/.test(cleanLine)) {
                // Walk backward to find the previous non-blank line
                let prevIdx = i - 1;
                while (prevIdx >= 0 && lines[prevIdx].trim() === '') prevIdx--;
                if (prevIdx < 0) continue;

                const prevClean = searchLines[prevIdx].trim();
                const prevRaw = lines[prevIdx].trim();
                // Skip first case
                if (/^\s*switch\s*\(/.test(prevClean) || prevClean === '{') continue;

                const terminates = /\b(break|return|throw|continue)\b/.test(prevClean)
                    || prevClean.endsWith('}')
                    || /fall[\s-]*through/i.test(prevRaw);

                if (!terminates) {
                    violations.push(
                        createViolation(
                            this,
                            i + 1,
                            lines[i],
                            'Switch case may fall through without break, return, or throw.',
                            'Add break; at the end of the previous case, or add a // fall through comment.',
                        ),
                    );
                }
            }
        }
        return violations;
    },
};

/**
 * JS-CTRL-02: Switch must have a default case
 *
 * "The default case is present in a switch statement."
 *
 * Google JavaScript Style Guide §5.8.3.3
 */
const switchDefaultCase: Rule = {
    id: 'JS-CTRL-02',
    name: 'Switch must have default case',
    description: 'Every switch statement must include a default case, even if it contains no code.',
    severity: 'medium',
    guideSection: '§5.8.3.3',
    guideUrl: 'https://google.github.io/styleguide/jsguide.html#features-switch-default-case',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];

        for (let i = 0; i < lines.length; i++) {
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            if (/^\s*switch\s*\(/.test(cleanLine)) {
                // Scan forward to find matching closing brace and check for default
                let braceDepth = 0;
                let hasDefault = false;
                let started = false;

                for (let j = i; j < lines.length; j++) {
                    const cl = searchLines[j];
                    for (const ch of cl) {
                        if (ch === '{') { braceDepth++; started = true; }
                        if (ch === '}') braceDepth--;
                    }
                    if (/^\s*default\s*:/.test(cl)) hasDefault = true;
                    if (started && braceDepth === 0) break;
                }

                if (!hasDefault) {
                    violations.push(
                        createViolation(
                            this,
                            i + 1,
                            lines[i],
                            'Switch statement missing a default case.',
                            'Add a default: case, even if it only contains a break or a comment.',
                        ),
                    );
                }
            }
        }
        return violations;
    },
};

// §4.5 Line wrapping -- deferred to AI deep review layer (requires AST)
// §5.4.3 Static methods -- deferred to AI deep review layer
// §5.7 Number literals -- deferred to AI deep review layer

// ============================================================================
// EXPORTED RULE ARRAY
// ============================================================================

/**
 * All JavaScript/TypeScript rules -- 49 total.
 * §2 (2), §3 (2), §4 (9), §5 (28), §6 (4), §7 (3), BP (1)
 */
export const javascriptRules: Rule[] = [
    // §2 Source File Basics
    fileNameLowercase,
    noTabsForIndentation,

    // §3 Source File Structure
    noDefaultExports,
    importExtension,

    // §4 Formatting
    semicolonsRequired,
    lineLength,
    noTrailingWhitespace,
    bracesForControlStructures,
    knrBraceStyle,
    oneStatementPerLine,
    twoSpaceIndentation,
    noMultipleBlankLines,

    // §5 Language Features
    noVar,
    oneVarPerDeclaration,
    noArrayConstructor,
    preferSpreadOverSlice,
    noObjectConstructor,
    noUnnecessaryQuotedKeys,
    useShorthandMethods,
    useShorthandProperties,
    noSelfThis,
    useSingleQuotes,
    noEmptyCatch,
    throwOnlyErrors,
    noSwitchFallthrough,
    switchDefaultCase,
    useStrictEquality,
    useStrictInequality,
    noEval,
    noWith,
    noWrapperObjects,
    noDebugger,
    noLineContinuations,
    noArgumentsKeyword,
    noConstructorWithoutParens,
    noModifyingBuiltins,
    preferTemplateLiterals,
    preferArrowFunctions,
    preferForOf,
    preferClasses,
    preferDefaultParams,

    // §6 Naming
    classPascalCase,
    lowerCamelCase,
    constantCase,
    privateNamingTrailingUnderscore,

    // §7 JSDoc
    jsdocFormat,
    requireJsdoc,
    jsdocParamReturn,

    // Best Practices
    noConsoleLog,
];
