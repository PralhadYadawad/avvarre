/**
 * Kotlin Rules -- Google Kotlin Style Guide
 * https://developer.android.com/kotlin/style-guide
 *
 * Sections covered:
 *   Source files (Naming, Special Chars, Imports, Structure)
 *   Formatting (Braces, Indentation, Line Length, Semicolons, Whitespace, Annotations, Enums)
 *   Naming (Packages, Classes, Functions, Constants, Type Variables, Backing Properties)
 *   Documentation (KDoc)
 *
 * Total rules in this file: 39
 */

import { Rule, Violation } from '../../types.js';

// ============================================================================
// HELPER UTILITIES
// ============================================================================

/**
 * Strip string literals and comments from Kotlin source while preserving
 * line count and positions. Handles:
 *   - Single-line comments:   // ...
 *   - Block comments:         /* ... * /
 *   - KDoc comments:          /** ... * /
 *   - Double-quoted strings:  "hello"
 *   - Triple-quoted strings:  """..."""
 *   - Char literals:          'a'
 *   - String templates:       "value: ${expr}"
 */
export function getCleanLines(lines: string[]): string[] {
    const result: string[] = [];

    type State = 'code' | 'block_comment' | 'triple_string' | 'string' | 'char';

    let state: State = 'code';
    let blockDepth = 0;
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        let cleanLine = '';
        let j = 0;

        while (j < line.length) {
            // -- Block/KDoc comment --
            if (state === 'block_comment') {
                if (line[j] === '*' && line[j + 1] === '/') {
                    blockDepth--;
                    if (blockDepth === 0) {
                        state = 'code';
                    }
                    cleanLine += '  ';
                    j += 2;
                } else if (line[j] === '/' && line[j + 1] === '*') {
                    blockDepth++;
                    cleanLine += '  ';
                    j += 2;
                } else {
                    cleanLine += ' ';
                    j++;
                }
                continue;
            }

            // -- Triple-quoted string --
            if (state === 'triple_string') {
                if (line[j] === '"' && line[j + 1] === '"' && line[j + 2] === '"') {
                    state = 'code';
                    cleanLine += '   ';
                    j += 3;
                } else {
                    cleanLine += ' ';
                    j++;
                }
                continue;
            }

            // -- Regular string --
            if (state === 'string') {
                if (line[j] === '\\') {
                    // Skip escape sequence
                    cleanLine += '  ';
                    j += 2;
                } else if (line[j] === '"') {
                    state = 'code';
                    cleanLine += '"';
                    j++;
                } else if (line[j] === '$' && line[j + 1] === '{') {
                    // Heuristic: string template: skip until matching }
                    cleanLine += '  ';
                    j += 2;
                } else {
                    cleanLine += ' ';
                    j++;
                }
                continue;
            }

            // -- Char literal --
            if (state === 'char') {
                if (line[j] === '\\') {
                    cleanLine += '  ';
                    j += 2;
                } else if (line[j] === '\'') {
                    state = 'code';
                    cleanLine += '\'';
                    j++;
                } else {
                    cleanLine += ' ';
                    j++;
                }
                continue;
            }

            // -- Code state --

            // Single-line comment
            if (line[j] === '/' && line[j + 1] === '/') {
                // Everything from here to end of line is a comment
                cleanLine += ' '.repeat(line.length - j);
                j = line.length;
                continue;
            }

            // Start of block/KDoc comment
            if (line[j] === '/' && line[j + 1] === '*') {
                state = 'block_comment';
                blockDepth = 1;
                cleanLine += '  ';
                j += 2;
                continue;
            }

            // Triple-quoted string
            if (line[j] === '"' && line[j + 1] === '"' && line[j + 2] === '"') {
                state = 'triple_string';
                cleanLine += '   ';
                j += 3;
                continue;
            }

            // Regular string
            if (line[j] === '"') {
                state = 'string';
                cleanLine += '"';
                j++;
                continue;
            }

            // Char literal
            if (line[j] === '\'') {
                state = 'char';
                cleanLine += '\'';
                j++;
                continue;
            }

            // Regular code character
            cleanLine += line[j];
            j++;
        }

        result.push(cleanLine);

        // Block comments and triple strings continue on the next line
        // String and char literals terminate at end of line (no multi-line support for those)
        if (state === 'string' || state === 'char') {
            state = 'code';
        }

        i++;
    }

    return result;
}

/** Returns true if the cleanLine is effectively blank (comment/whitespace only). */
function isSkippableLine(cleanLine: string): boolean {
    return cleanLine.trim() === '';
}

/** Create a Violation object. */
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
        codeSnippet: codeSnippet.slice(0, 120),
    };
}

// ============================================================================
// SOURCE FILES -- IMPORTS
// ============================================================================

/**
 * KT-SRC-01: No wildcard imports
 *
 * "Wildcard imports (of any type) are not allowed."
 *
 * Google Kotlin Style Guide -- Source files / Import statements
 */
const noWildcardImports: Rule = {
    id: 'KT-SRC-01',
    name: 'No wildcard imports',
    description:
        'Wildcard imports (of any type) are not allowed. Import each class, function, ' +
        'or property individually. Example: use `import com.example.Foo` not `import com.example.*`.',
    severity: 'high',
    guideSection: '§Source files',
    guideUrl: 'https://developer.android.com/kotlin/style-guide#import_statements',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const clean = cleanLines || getCleanLines(lines);

        for (let i = 0; i < lines.length; i++) {
            const cleanLine = clean[i];

            // Only check import lines
            if (!/^\s*import\s/.test(cleanLine)) continue;
            if (/\.\*\s*$/.test(cleanLine)) {
                violations.push(createViolation(
                    this,
                    i + 1,
                    lines[i].trim(),
                    `Wildcard import is not allowed: '${lines[i].trim()}'`,
                    'Import each class individually instead of using a wildcard.',
                ));
            }
        }
        return violations;
    },
};

// ============================================================================
// SOURCE FILES -- SPECIAL CHARACTERS
// ============================================================================

/**
 * KT-SRC-02: No tab characters for indentation
 *
 * "Tab characters are not used for indentation."
 *
 * Google Kotlin Style Guide -- Source files / Special characters
 *
 * Note: This is a whitespace rule; it legitimately uses raw lines.
 */
const noTabs: Rule = {
    id: 'KT-SRC-02',
    name: 'No tabs for indentation',
    description:
        'Tab characters (\\t) must not be used for indentation. ' +
        'Use 4 spaces per indentation level.',
    severity: 'low',
    guideSection: '§Source files',
    guideUrl: 'https://developer.android.com/kotlin/style-guide#whitespace_characters',
    check(lines: string[]): Violation[] {
        const violations: Violation[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Detect a tab at the start (indentation)
            if (/^\t/.test(line)) {
                violations.push(createViolation(
                    this,
                    i + 1,
                    line.trim().slice(0, 60),
                    'Tab character used for indentation.',
                    'Replace leading tab characters with 4 spaces per indentation level.',
                ));
            }
        }
        return violations;
    },
};

/**
 * KT-SRC-04: Use named escape sequences, not Unicode escapes
 *
 * "For any character that has a special escape sequence (\\b, \\n, \\r, \\t, \\', \",
 *  \\\\, and \\$), that sequence is used rather than the corresponding Unicode escape."
 *
 * Google Kotlin Style Guide -- Source files / Special escape sequences
 *
 * Examples:
 *   WRONG: "\u000a"  (Unicode escape for newline)
 *   OK:    "\n"      (named escape)
 */
const namedEscapeSequences: Rule = {
    id: 'KT-SRC-04',
    name: 'Use named escape sequences',
    description:
        'For characters with a special escape sequence (\\b, \\n, \\r, \\t, \\\\", \\\\\\\\, \\\\$), ' +
        'use the named escape rather than the corresponding Unicode escape (e.g. \\\\u000a).',
    severity: 'low',
    guideSection: '§Source files',
    guideUrl: 'https://developer.android.com/kotlin/style-guide#special_escape_sequences',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const clean = cleanLines || getCleanLines(lines);

        // Unicode escapes for chars that have named equivalents in Kotlin:
        // \b=\u0008, \t=\u0009, \n=\u000a, \f=\u000c, \r=\u000d
        // We search the RAW line (not cleanLine) because these escapes live inside strings,
        // which getCleanLines strips out. We do skip pure comment-only lines.
        const unicodeForNamedEscape = /\\u(0008|0009|000[aA]|000[cC]|000[dD])/i;

        for (let i = 0; i < lines.length; i++) {
            const cleanLine = clean[i];
            const rawLine = lines[i];

            // Skip lines that are ENTIRELY comments (no code at all)
            if (isSkippableLine(cleanLine)) continue;
            // If the clean line is not empty, the raw line has real code context --
            // check the raw line for the unicode escape pattern
            if (unicodeForNamedEscape.test(rawLine)) {
                violations.push(createViolation(
                    this,
                    i + 1,
                    rawLine.trim().slice(0, 80),
                    'Unicode escape used where a named escape sequence exists.',
                    'Replace the Unicode escape with the named sequence: \\b, \\t, \\n, \\r, etc.',
                ));
            }
        }
        return violations;
    },
};

// ============================================================================
// FORMATTING -- LINE LENGTH & SEMICOLONS
// ============================================================================

/**
 * KT-FMT-01: 100-character line limit
 *
 * "Code has a column limit of 100 characters."
 *
 * Exceptions: package/import statements, long URLs in KDoc.
 *
 * Google Kotlin Style Guide -- Formatting / Line wrapping
 *
 * Note: This is a whitespace/formatting rule; it legitimately uses raw lines
 * for length measurement, but uses cleanLines for exception detection.
 */
const lineLength: Rule = {
    id: 'KT-FMT-01',
    name: '100-character line limit',
    description:
        'Kotlin code has a column limit of 100 characters. Lines exceeding this limit ' +
        'must be wrapped. Exceptions: package/import statements and URLs inside KDoc.',
    severity: 'low',
    guideSection: '§Formatting',
    guideUrl: 'https://developer.android.com/kotlin/style-guide#line_wrapping',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const clean = cleanLines || getCleanLines(lines);

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = clean[i];

            if (line.length <= 100) continue;

            const trimmed = cleanLine.trim();

            // Exception: package/import statements
            if (/^(package|import)\s/.test(trimmed)) continue;

            // Exception: lines with a URL (http:// or https://)
            if (/https?:\/\//.test(line)) continue;

            violations.push(createViolation(
                this,
                i + 1,
                line.slice(0, 110) + (line.length > 110 ? '...' : ''),
                `Line is ${line.length} characters long (limit is 100).`,
                'Wrap this line to stay within the 100-character column limit.',
            ));
        }
        return violations;
    },
};

/**
 * KT-SRC-03: No semicolons
 *
 * "Each statement is followed by a line break. Semicolons are not used."
 *
 * Google Kotlin Style Guide -- Formatting / One statement per line
 */
const noSemicolons: Rule = {
    id: 'KT-SRC-03',
    name: 'No semicolons',
    description:
        'Semicolons are not used in Kotlin. Each statement should end with a newline, ' +
        'not a semicolon.',
    severity: 'low',
    guideSection: '§Formatting',
    guideUrl: 'https://developer.android.com/kotlin/style-guide#one_statement_per_line',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const clean = cleanLines || getCleanLines(lines);

        for (let i = 0; i < lines.length; i++) {
            const cleanLine = clean[i];
            if (isSkippableLine(cleanLine)) continue;

            if (/;\s*$/.test(cleanLine)) {
                violations.push(createViolation(
                    this,
                    i + 1,
                    lines[i].trim().slice(0, 80),
                    'Semicolons are not used in Kotlin.',
                    'Remove the trailing semicolon. Each statement should end with a newline.',
                ));
            }
        }
        return violations;
    },
};

// ============================================================================
// FORMATTING -- BRACES
// ============================================================================

/**
 * KT-FMT-02: K&R brace style -- opening brace on same line
 *
 * "Braces follow the Kernighan and Ritchie style ('Egyptian brackets') for
 *  nonempty blocks... No line break before the opening brace."
 *
 * Google Kotlin Style Guide -- Formatting / Braces / Non-empty blocks
 */
const openingBraceSameLine: Rule = {
    id: 'KT-FMT-02',
    name: 'Opening brace must be on same line (K&R style)',
    description:
        'Opening braces must appear at the end of the same line that starts the block, ' +
        'not on a new line. This is Kernighan & Ritchie (K&R / Egyptian brackets) style.',
    severity: 'medium',
    guideSection: '§Formatting',
    guideUrl: 'https://developer.android.com/kotlin/style-guide#nonempty_blocks',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const clean = cleanLines || getCleanLines(lines);

        for (let i = 0; i < lines.length; i++) {
            const cleanLine = clean[i];
            if (isSkippableLine(cleanLine)) continue;

            // A line that is ONLY an opening brace (possibly indented) is wrong
            if (/^\s*\{\s*$/.test(cleanLine)) {
                let prevIdx = i - 1;
                while (prevIdx >= 0 && isSkippableLine(clean[prevIdx])) prevIdx--;

                if (prevIdx >= 0) {
                    const prevClean = clean[prevIdx].trimEnd();
                    // If previous line ends with -> or = or , or (, this is likely a lambda -- skip
                    if (/[->=,(]$/.test(prevClean)) continue;
                    // If previous line ends with { already, skip (already K&R)
                    if (/\{\s*$/.test(prevClean)) continue;
                    // Flag it: opening brace is on its own line
                    violations.push(createViolation(
                        this,
                        i + 1,
                        lines[i],
                        "Opening brace '{' must be at the end of the line that starts the block, not on its own line.",
                        "Move the '{' to the end of the previous line (K&R / Egyptian brackets style).",
                    ));
                }
            }
        }
        return violations;
    },
};

/**
 * KT-FMT-03: Space before opening brace `{`
 *
 * "Before any open curly brace ({)."  (whitespace required)
 *
 * Google Kotlin Style Guide -- Formatting / Whitespace / Horizontal
 *
 * WRONG: if (list.isEmpty()){
 * OK:    if (list.isEmpty()) {
 */
const spaceBeforeBrace: Rule = {
    id: 'KT-FMT-03',
    name: 'Space required before opening brace',
    description:
        "A single space is required before every opening brace '{'. " +
        "Example: use `if (x) {` not `if (x){`.",
    severity: 'low',
    guideSection: '§Formatting',
    guideUrl: 'https://developer.android.com/kotlin/style-guide#horizontal_whitespace',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const clean = cleanLines || getCleanLines(lines);

        for (let i = 0; i < lines.length; i++) {
            const cleanLine = clean[i];
            if (isSkippableLine(cleanLine)) continue;

            // Detect non-space, non-special char immediately before {
            // Exceptions: ${ (string interpolation), @{ (annotation), beginning of line
            const match = cleanLine.match(/([^\s$@=,(\[{])\{/);
            if (match) {
                violations.push(createViolation(
                    this,
                    i + 1,
                    lines[i].trim().slice(0, 80),
                    "Missing space before '{'.",
                    "Add a space before '{', e.g. change `foo(){` to `foo() {`.",
                ));
            }
        }
        return violations;
    },
};

/**
 * KT-FMT-04: Empty catch block must not be `{}` -- must have space `{ }`
 *
 * "An empty block or block-like construct must be in K&R style."
 *
 * WRONG: catch (e: Exception) {}
 * OK:    catch (e: Exception) { }
 *
 * Google Kotlin Style Guide -- Formatting / Braces / Empty blocks
 */
const emptyBlockMustHaveSpace: Rule = {
    id: 'KT-FMT-04',
    name: 'Empty block must use { } not {}',
    description:
        'An empty block or block-like construct must use `{ }` (with a space) rather than ' +
        '`{}` (no space). Example: `catch (e: Exception) { }` not `catch (e: Exception) {}`.',
    severity: 'medium',
    guideSection: '§Formatting',
    guideUrl: 'https://developer.android.com/kotlin/style-guide#empty_blocks',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const clean = cleanLines || getCleanLines(lines);

        for (let i = 0; i < lines.length; i++) {
            const cleanLine = clean[i];
            if (isSkippableLine(cleanLine)) continue;

            // Detect `{}` (empty block with no space) that appears after a keyword or `)`
            if (/\)\s*\{\}/.test(cleanLine) || /\b(else|finally|try)\s*\{\}/.test(cleanLine)) {
                violations.push(createViolation(
                    this,
                    i + 1,
                    lines[i].trim().slice(0, 80),
                    "Empty block uses `{}` instead of `{ }`.",
                    "Change `{}` to `{ }` for empty blocks.",
                ));
            }
        }
        return violations;
    },
};

// ============================================================================
// Formatting -- Whitespace (Horizontal)
// ============================================================================

/**
 * KT-FMT-05: Space after `if`/`for`/`while`/`catch` keyword before `(`
 */
export const spaceAfterKeywordBeforeParen: Rule = {
    id: 'KT-FMT-05',
    name: 'Space after keyword before parenthesis',
    description: 'A single space is required before the opening parenthesis that follows an if, for, catch, or while keyword.',
    severity: 'low',
    guideSection: '§Formatting',
    guideUrl: 'https://developer.android.com/kotlin/style-guide#horizontal_whitespace',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const clean = cleanLines || getCleanLines(lines);
        for (let i = 0; i < clean.length; i++) {
            const match = clean[i].match(/\b(if|for|while|catch)\(/);
            if (match) {
                violations.push(createViolation(this, i + 1, lines[i].trim(), `Missing space after '${match[1]}' before '('`, `Add a space between '${match[1]}' and '('`));
            }
        }
        return violations;
    }
};

/**
 * KT-FMT-06: No space around `::` member reference
 */
export const noSpaceAroundMemberReference: Rule = {
    id: 'KT-FMT-06',
    name: 'No space around member reference operator',
    description: 'No space is allowed around the `::` member reference operator.',
    severity: 'low',
    guideSection: '§Formatting',
    guideUrl: 'https://developer.android.com/kotlin/style-guide#horizontal_whitespace',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const clean = cleanLines || getCleanLines(lines);
        for (let i = 0; i < clean.length; i++) {
            if (/(\s::|::\s)/.test(clean[i])) {
                violations.push(createViolation(this, i + 1, lines[i].trim(), "No space allowed around '::' member reference operator", "Remove spaces around '::'"));
            }
        }
        return violations;
    }
};

/**
 * KT-FMT-07: No space around `.` dot calls
 */
export const noSpaceAroundDot: Rule = {
    id: 'KT-FMT-07',
    name: 'No space around dot calls',
    description: 'No space is allowed around the `.` or `?.` operators.',
    severity: 'low',
    guideSection: '§Formatting',
    guideUrl: 'https://developer.android.com/kotlin/style-guide#horizontal_whitespace',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const clean = cleanLines || getCleanLines(lines);
        for (let i = 0; i < clean.length; i++) {
            const cleanLine = clean[i];
            // Skip lines that start with . (chained calls on continuation line)
            if (/^\s*\./.test(cleanLine)) continue;
            // Skip float literals
            if (/\d\s*\.\s*\d/.test(cleanLine)) continue;
            if (/(?<!\.)(\s\.(?!\.)|\.(?!\.)\s)/.test(cleanLine)) {
                violations.push(createViolation(this, i + 1, lines[i].trim(), "No space allowed around '.' operator", "Remove spaces around '.'"));
            }
        }
        return violations;
    }
};

/**
 * KT-FMT-08: No space around `..` range operator
 */
export const noSpaceAroundRange: Rule = {
    id: 'KT-FMT-08',
    name: 'No space around range operator',
    description: 'No space is allowed around the `..` range operator.',
    severity: 'low',
    guideSection: '§Formatting',
    guideUrl: 'https://developer.android.com/kotlin/style-guide#horizontal_whitespace',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const clean = cleanLines || getCleanLines(lines);
        for (let i = 0; i < clean.length; i++) {
            if (/(\s\.\.(?!\.)|\.\.(?!\.)\s)/.test(clean[i])) {
                violations.push(createViolation(this, i + 1, lines[i].trim(), "No space allowed around '..' range operator", "Remove spaces around '..'"));
            }
        }
        return violations;
    }
};

/**
 * KT-FMT-09: Space after `,` in argument list
 */
export const spaceAfterComma: Rule = {
    id: 'KT-FMT-09',
    name: 'Space after comma',
    description: 'A single space must follow a comma.',
    severity: 'low',
    guideSection: '§Formatting',
    guideUrl: 'https://developer.android.com/kotlin/style-guide#horizontal_whitespace',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const clean = cleanLines || getCleanLines(lines);
        for (let i = 0; i < clean.length; i++) {
            if (/,([^\s\r\n}\])])/.test(clean[i])) {
                violations.push(createViolation(this, i + 1, lines[i].trim(), "Missing space after comma", "Add a space after ','"));
            }
        }
        return violations;
    }
};

/**
 * KT-FMT-10: Space before `:` in class inheritance
 */
export const spaceBeforeColonInClass: Rule = {
    id: 'KT-FMT-10',
    name: 'Exactly one space before colon in class declaration',
    description: "Exactly one space is required before the colon when separating a class name and superclass/interfaces.",
    severity: 'medium',
    guideSection: '§Formatting',
    guideUrl: 'https://developer.android.com/kotlin/style-guide#horizontal_whitespace',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const clean = cleanLines || getCleanLines(lines);
        for (let i = 0; i < clean.length; i++) {
            const cleanLine = clean[i];
            if (/(?:class|interface)\s+\w+(?:<[^>]+>)? *:/.test(cleanLine) && !/(?:class|interface)\s+\w+(?:<[^>]+>)?\s+:/.test(cleanLine)) {
                violations.push(createViolation(this, i + 1, lines[i].trim(), "Exactly one space is required before ':'", "Add a space before ':'"));
            }
        }
        return violations;
    }
};

/**
 * KT-FMT-11: Space before `//` end-of-line comments
 *
 * BUG FIX: Now uses cleanLines-aware approach instead of homebrew string stripping.
 * We check raw lines but skip lines that are entirely comments (detected via cleanLines).
 * For end-of-line comments on code lines, we check the raw line for space before //.
 */
export const spaceBeforeEndOfLineComment: Rule = {
    id: 'KT-FMT-11',
    name: 'Space before end-of-line comments',
    description: 'End-of-line comments must be preceded by at least one space.',
    severity: 'low',
    guideSection: '§Formatting',
    guideUrl: 'https://developer.android.com/kotlin/style-guide#horizontal_whitespace',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const clean = cleanLines || getCleanLines(lines);
        for (let i = 0; i < lines.length; i++) {
            const rawLine = lines[i];
            const cleanLine = clean[i];
            // Skip full-line comments (line that starts with // after whitespace)
            if (/^\s*\/\//.test(rawLine)) continue;
            // Skip blank lines
            if (isSkippableLine(cleanLine)) continue;
            // Find position of // in cleanLine (will be blanked in string/comment context)
            // If there's code content (cleanLine not blank) and the raw line has //
            // we need to find where the comment starts
            const commentIdx = rawLine.indexOf('//');
            if (commentIdx > 0 && cleanLine[commentIdx] === ' ' && cleanLine[commentIdx + 1] === ' ') {
                // The // is inside a comment region in cleanLine (blanked to spaces)
                // meaning this is an end-of-line comment
                if (rawLine[commentIdx - 1] !== ' ' && rawLine[commentIdx - 1] !== '\t') {
                    violations.push(createViolation(this, i + 1, lines[i].trim(), "End-of-line comments must be preceded by a space", "Add a space before '//'"));
                }
            }
        }
        return violations;
    }
};

// ============================================================================
// VERTICAL WHITESPACE
// ============================================================================

/**
 * KT-FMT-12: No more than 2 consecutive blank lines
 *
 * Note: This is a whitespace rule; it legitimately uses raw lines.
 */
export const noConsecutiveBlankLines: Rule = {
    id: 'KT-FMT-12',
    name: 'No excessive blank lines',
    description: 'More than two consecutive blank lines are discouraged.',
    severity: 'low',
    guideSection: '§Formatting',
    guideUrl: 'https://developer.android.com/kotlin/style-guide#vertical_whitespace',
    check(lines: string[]): Violation[] {
        const violations: Violation[] = [];
        let blankCount = 0;

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim() === '') {
                blankCount++;
                if (blankCount === 3) {
                    violations.push(createViolation(this, i + 1, "--- empty lines ---", "More than two consecutive blank lines are not allowed.", "Remove extra blank lines."));
                }
            } else {
                blankCount = 0;
            }
        }
        return violations;
    }
};

/**
 * KT-FMT-13: Braces for multi-line conditionals
 */
export const bracesForMultiLineConditionals: Rule = {
    id: 'KT-FMT-13',
    name: 'Braces required for multi-line conditionals',
    description: 'If the body of an if, else, for, while, or when statement is on a new line, it must be enclosed in braces.',
    severity: 'medium',
    guideSection: '§Formatting',
    guideUrl: 'https://developer.android.com/kotlin/style-guide#conditionals',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const clean = cleanLines || getCleanLines(lines);
        for (let i = 0; i < clean.length - 1; i++) {
            const line = clean[i];
            if (/\b(if|for|while|else)\b/.test(line)) {
                if (/(?:\)\s*|else\s*)$/.test(line.trim())) {
                    const nextLine = clean[i + 1].trim();
                    if (nextLine !== '' && !nextLine.startsWith('{') && !nextLine.startsWith('if')) {
                        violations.push(createViolation(this, i + 1, lines[i].trim(), "Multi-line conditional body must be enclosed in braces.", "Add braces around the conditional body."));
                    }
                }
            }
        }
        return violations;
    }
};

/**
 * KT-FMT-14: Space around binary operators
 */
export const spaceAroundBinaryOperators: Rule = {
    id: 'KT-FMT-14',
    name: 'Space around binary operators',
    description: 'Binary operators must be surrounded by spaces.',
    severity: 'low',
    guideSection: '§Formatting',
    guideUrl: 'https://developer.android.com/kotlin/style-guide#horizontal_whitespace',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const clean = cleanLines || getCleanLines(lines);
        for (let i = 0; i < clean.length; i++) {
            const line = clean[i];
            if (isSkippableLine(line)) continue;

            // Check for assignment = without spaces (but not ==, !=, <=, >=, +=, -=, *=, /=, =>)
            if (/[^\s!=<>+\-*/%]=[^=>\s]/.test(line) && !/^\s*(import|package)\s/.test(line)) {
                violations.push(createViolation(this, i + 1, lines[i].trim(), "Binary operator '=' must be surrounded by spaces.", "Add spaces around the operator."));
            }
        }
        return violations;
    }
};

/**
 * KT-SRC-05: Filename matches single top-level class
 */
export const filenameMatchesClass: Rule = {
    id: 'KT-SRC-05',
    name: 'Filename matches top-level class',
    description: 'If a source file contains only a single top-level class/interface/object, its name should match the filename.',
    severity: 'medium',
    guideSection: '§Source files',
    guideUrl: 'https://developer.android.com/kotlin/style-guide#source_file_names',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        if (!filename) return violations;
        const clean = cleanLines || getCleanLines(lines);
        const topLevelNames: string[] = [];
        for (let i = 0; i < clean.length; i++) {
            // Check for class/interface/object at the start of the line (top level)
            const match = clean[i].match(/^(?:class|interface|object|enum\s+class|annotation\s+class)\s+([A-Za-z0-9_]+)/);
            if (match) {
                topLevelNames.push(match[1]);
            }
        }

        if (topLevelNames.length === 1) {
            const baseName = filename.split(/[\\\/]/).pop()?.replace('.kt', '');
            if (baseName && topLevelNames[0] !== baseName) {
                violations.push(createViolation(this, 1, `File: ${filename}`, `Filename '${baseName}.kt' should match top-level class '${topLevelNames[0]}'.`, "Rename the file or the class."));
            }
        }
        return violations;
    }
};

/**
 * KT-FMT-15: Continuation indentation
 *
 * Note: This is a whitespace/indentation rule; it legitimately uses raw lines
 * but now also uses cleanLines to skip comment-only lines.
 */
export const continuationIndentation: Rule = {
    id: 'KT-FMT-15',
    name: 'Continuation indentation (+4)',
    description: 'When a line is wrapped, each continuation line is indented at least +4 spaces from the original line.',
    severity: 'low',
    guideSection: '§Formatting',
    guideUrl: 'https://developer.android.com/kotlin/style-guide#continuation_indent',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const clean = cleanLines || getCleanLines(lines);
        for (let i = 1; i < lines.length; i++) {
            const prevLine = lines[i - 1];
            const currLine = lines[i];
            if (prevLine.trim() === '' || currLine.trim() === '') continue;
            // Skip comments
            if (isSkippableLine(clean[i]) || isSkippableLine(clean[i - 1])) continue;
            if (prevLine.trim().startsWith('import') || prevLine.trim().startsWith('package')) continue;

            // Heuristic: if prev line doesn't end in { or ; or . but curr line is indented more
            if (/[^;{,]$/.test(prevLine.trim()) && !currLine.trim().startsWith('.') && !currLine.trim().startsWith('}') && !currLine.trim().startsWith('//')) {
                const prevIndent = prevLine.search(/\S/);
                const currIndent = currLine.search(/\S/);
                if (currIndent > prevIndent && currIndent < prevIndent + 4) {
                    violations.push(createViolation(this, i + 1, currLine.trim(), "Continuation line should be indented at least +4 spaces.", "Indent the line by 4 spaces."));
                }
            }
        }
        return violations;
    }
};

// ============================================================================
// NAMING
// ============================================================================

/**
 * KT-NAME-01: Package names all lowercase, no underscores
 */
export const packageNamesAllLowercase: Rule = {
    id: 'KT-NAME-01',
    name: 'Package names all lowercase, no underscores',
    description: 'Package names must be all lowercase with consecutive words concatenated together (no underscores).',
    severity: 'medium',
    guideSection: '§Naming',
    guideUrl: 'https://developer.android.com/kotlin/style-guide#package_names',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const clean = cleanLines || getCleanLines(lines);
        for (let i = 0; i < clean.length; i++) {
            const match = clean[i].match(/^\s*package\s+([A-Za-z0-9_.]+)/);
            if (match) {
                const pkgName = match[1];
                if (pkgName !== pkgName.toLowerCase() || pkgName.includes('_')) {
                    violations.push(createViolation(this, i + 1, lines[i].trim(), "Package names must be all lowercase with no underscores", "Change package name to all lowercase"));
                }
            }
        }
        return violations;
    }
};

/**
 * KT-NAME-02: Class/interface names PascalCase
 */
export const classNamesPascalCase: Rule = {
    id: 'KT-NAME-02',
    name: 'Class/interface names must be PascalCase',
    description: 'Class and interface names are written in PascalCase.',
    severity: 'medium',
    guideSection: '§Naming',
    guideUrl: 'https://developer.android.com/kotlin/style-guide#type_names',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const clean = cleanLines || getCleanLines(lines);
        for (let i = 0; i < clean.length; i++) {
            const match = clean[i].match(/\b(?:class|interface)\s+([A-Za-z0-9_]+)/);
            if (match) {
                const className = match[1];
                if (!/^[A-Z][a-zA-Z0-9]*$/.test(className)) {
                    violations.push(createViolation(this, i + 1, lines[i].trim(), `Class/interface name '${className}' must be PascalCase`, "Rename class/interface to PascalCase"));
                }
            }
        }
        return violations;
    }
};

/**
 * KT-NAME-03: Function names lowerCamelCase
 */
export const functionNamesLowerCamelCase: Rule = {
    id: 'KT-NAME-03',
    name: 'Function names must be lowerCamelCase',
    description: 'Function names are written in lowerCamelCase.',
    severity: 'medium',
    guideSection: '§Naming',
    guideUrl: 'https://developer.android.com/kotlin/style-guide#function_names',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const clean = cleanLines || getCleanLines(lines);
        for (let i = 0; i < clean.length; i++) {
            const match = clean[i].match(/\bfun\s+(?:<[^>]+>\s+)?(?:[A-Za-z0-9_]+\.)?([A-Za-z0-9_]+)\s*\(/);
            if (match) {
                const funcName = match[1];
                // Allow backtick names (handled by KT-NAME-07)
                if (funcName.startsWith('`')) continue;
                if (!/^[a-z][a-zA-Z0-9]*$/.test(funcName)) {
                    violations.push(createViolation(this, i + 1, lines[i].trim(), `Function name '${funcName}' must be lowerCamelCase`, "Rename function to lowerCamelCase"));
                }
            }
        }
        return violations;
    }
};

/**
 * KT-NAME-04: `const val` must use UPPER_SNAKE_CASE
 */
export const constValUpperSnakeCase: Rule = {
    id: 'KT-NAME-04',
    name: 'Constant names must be UPPER_SNAKE_CASE',
    description: 'Constant names use CONSTANT_CASE: all uppercase letters, with words separated by underscores.',
    severity: 'medium',
    guideSection: '§Naming',
    guideUrl: 'https://developer.android.com/kotlin/style-guide#constant_names',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const clean = cleanLines || getCleanLines(lines);
        for (let i = 0; i < clean.length; i++) {
            const match = clean[i].match(/\bconst\s+val\s+([A-Za-z0-9_]+)\s*(?::|=)/);
            if (match) {
                const constName = match[1];
                if (!/^[A-Z][A-Z0-9_]*$/.test(constName)) {
                    violations.push(createViolation(this, i + 1, lines[i].trim(), `Constant name '${constName}' must be UPPER_SNAKE_CASE`, "Rename constant to UPPER_SNAKE_CASE"));
                }
            }
        }
        return violations;
    }
};

/**
 * KT-NAME-05: Non-constant `val`/`var` must be lowerCamelCase
 */
export const nonConstValLowerCamelCase: Rule = {
    id: 'KT-NAME-05',
    name: 'Non-constant names must be lowerCamelCase',
    description: 'Non-constant variable names use lowerCamelCase.',
    severity: 'low',
    guideSection: '§Naming',
    guideUrl: 'https://developer.android.com/kotlin/style-guide#non-constant_names',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const clean = cleanLines || getCleanLines(lines);
        for (let i = 0; i < clean.length; i++) {
            const cleanLine = clean[i];
            if (/\bconst\s+val\b/.test(cleanLine)) continue;
            const match = cleanLine.match(/\b(?:val|var)\s+([A-Za-z0-9_]+)\s*(?::|=)/);
            if (match) {
                const varName = match[1];
                // Allow underscore prefix for backing properties e.g. _name
                const nameToCheck = varName.startsWith('_') ? varName.substring(1) : varName;
                if (!/^[a-z][a-zA-Z0-9]*$/.test(nameToCheck)) {
                    violations.push(createViolation(this, i + 1, lines[i].trim(), `Non-constant name '${varName}' must be lowerCamelCase`, "Rename variable to lowerCamelCase"));
                }
            }
        }
        return violations;
    }
};

/**
 * KT-NAME-06: No Hungarian notation prefixes (`mName`, `sName`, `kName`, `name_`)
 */
export const noHungarianNotation: Rule = {
    id: 'KT-NAME-06',
    name: 'No Hungarian notation prefixes',
    description: 'Backing properties can have an underscore prefix, but Hungarian notation and other special prefixes/suffixes are not allowed.',
    severity: 'medium',
    guideSection: '§Naming',
    guideUrl: 'https://developer.android.com/kotlin/style-guide#non-constant_names',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const clean = cleanLines || getCleanLines(lines);
        for (let i = 0; i < clean.length; i++) {
            const match = clean[i].match(/\b(?:val|var|fun|class|interface|object)\s+([A-Za-z0-9_]+)\b/);
            if (match) {
                const name = match[1];
                if (/^m[A-Z]/.test(name) || /^s[A-Z]/.test(name) || /^k[A-Z]/.test(name) || name.endsWith('_')) {
                    violations.push(createViolation(this, i + 1, lines[i].trim(), `Identifier '${name}' uses forbidden Hungarian notation or underscores`, "Remove special prefixes/suffixes from the identifier"));
                }
            }
        }
        return violations;
    }
};

/**
 * KT-NAME-07: No backtick function names in non-test files
 *
 * BUG FIX: Now uses cleanLines to avoid matching backtick patterns inside
 * string literals or comments.
 */
export const noBacktickFunctions: Rule = {
    id: 'KT-NAME-07',
    name: 'No backtick function names outside tests',
    description: 'Function names with spaces enclosed in backticks are only allowed in test files.',
    severity: 'low',
    guideSection: '§Naming',
    guideUrl: 'https://developer.android.com/kotlin/style-guide#function_names',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        if (filename && /[Tt]est\.kt$/.test(filename)) return violations;

        const clean = cleanLines || getCleanLines(lines);
        for (let i = 0; i < clean.length; i++) {
            if (/\bfun\s+`[^`]+`/.test(clean[i])) {
                violations.push(createViolation(this, i + 1, lines[i].trim(), "Backtick function names are only permitted in test files", "Use lowerCamelCase function names"));
            }
        }
        return violations;
    }
};

/**
 * KT-NAME-08: Scalar properties should use const modifier if possible
 */
export const scalarPropertiesMustUseConst: Rule = {
    id: 'KT-NAME-08',
    name: 'Scalar properties should use const modifier',
    description: 'Properties that are effectively constant (primitive or string) and known at compile time should use the const modifier.',
    severity: 'medium',
    guideSection: '§Naming',
    guideUrl: 'https://developer.android.com/kotlin/style-guide#constant_names',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const clean = cleanLines || getCleanLines(lines);
        for (let i = 0; i < clean.length; i++) {
            const cleanLine = clean[i];
            // Check for top-level or object val that is a string or primitive and NOT const
            if (/^\s*(?:private\s+|public\s+|internal\s+)?val\s+[A-Z][A-Z0-9_]*\s*=\s*(?:"[^"]*"|\d+(?:\.\d+)?|true|false)\s*$/.test(cleanLine)) {
                if (!cleanLine.includes('const ')) {
                    violations.push(createViolation(this, i + 1, lines[i].trim(), "Constant-like property should use 'const' modifier.", "Add 'const' modifier."));
                }
            }
        }
        return violations;
    }
};

// ============================================================================
// DOCUMENTATION - KDoc
// ============================================================================

/**
 * KT-DOC-01: KDoc block tags must not have empty descriptions
 *
 * BUG FIX: KDoc tags live inside comment blocks, which getCleanLines strips.
 * We intentionally operate on raw lines here but must ensure we are inside
 * a KDoc block (/** ... * /) and not inside a string literal. We track
 * whether we are inside a KDoc block to avoid false positives.
 */
export const kdocNoEmptyDescriptions: Rule = {
    id: 'KT-DOC-01',
    name: 'KDoc block tags must have descriptions',
    description: 'Block tags like @param, @return, or @throws must not have an empty description.',
    severity: 'medium',
    guideSection: '§Documentation',
    guideUrl: 'https://developer.android.com/kotlin/style-guide#block_tags',
    check(lines: string[]): Violation[] {
        const violations: Violation[] = [];
        let inKdoc = false;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes('/**')) inKdoc = true;
            if (inKdoc) {
                // Match @tag [optional_name] at end of line
                const match = line.match(/\*\s*@(param|return|throws|see|property|constructor|receiver)(?:\s+[a-zA-Z0-9_]+)?\s*$/);
                if (match) {
                    if (i + 1 < lines.length) {
                        const nextLine = lines[i + 1].trim();
                        if (nextLine.startsWith('*/') || nextLine.match(/^\*\s*@/) || nextLine === '*' || nextLine === '') {
                            violations.push(createViolation(this, i + 1, line.trim(), `KDoc tag '@${match[1]}' has an empty description.`, "Add a description for the tag."));
                        }
                    }
                }
            }
            if (line.includes('*/')) inKdoc = false;
        }
        return violations;
    }
};

/**
 * KT-DOC-02: KDoc summary must not start with "This method..."
 *
 * BUG FIX: Now tracks KDoc block context to avoid matching inside strings.
 */
export const kdocNoGenericSummary: Rule = {
    id: 'KT-DOC-02',
    name: 'KDoc summary should not start with generic phrases',
    description: 'KDoc summaries should not start with generic phrases like "This method returns..." or "A [Foo] is a...".',
    severity: 'low',
    guideSection: '§Documentation',
    guideUrl: 'https://developer.android.com/kotlin/style-guide#summary_fragment',
    check(lines: string[]): Violation[] {
        const violations: Violation[] = [];
        let inKdoc = false;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes('/**')) inKdoc = true;
            if (inKdoc) {
                if (/\*(?:\*|\s+)(?:This (?:method|function|class|object|val|var|interface) |A \[[^\]]+\] is a )/i.test(line)) {
                    violations.push(createViolation(this, i + 1, line.trim(), "KDoc summary should not start with 'This method' or 'A [Foo] is a'.", "Start with a descriptive fragment instead."));
                }
            }
            if (line.includes('*/')) inKdoc = false;
        }
        return violations;
    }
};

/**
 * KT-DOC-03: KDoc block tags must be in correct order
 *
 * BUG FIX: Now tracks KDoc block context.
 */
export const kdocTagOrder: Rule = {
    id: 'KT-DOC-03',
    name: 'KDoc block tags in correct order',
    description: 'KDoc block tags must appear in the order: @constructor, @receiver, @param, @property, @return, @throws, @see.',
    severity: 'low',
    guideSection: '§Documentation',
    guideUrl: 'https://developer.android.com/kotlin/style-guide#block_tags',
    check(lines: string[]): Violation[] {
        const violations: Violation[] = [];
        const tagOrder = ['constructor', 'receiver', 'param', 'property', 'return', 'throws', 'see'];
        let currentOrderIndex = -1;
        let inKdoc = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes('/**')) {
                inKdoc = true;
                currentOrderIndex = -1; // Reset for new block
            }

            if (inKdoc) {
                const match = line.match(/\*\s*@(constructor|receiver|param|property|return|throws|see)\b/);
                if (match) {
                    const tagName = match[1];
                    const tagIndex = tagOrder.indexOf(tagName);
                    if (tagIndex < currentOrderIndex) {
                        violations.push(createViolation(this, i + 1, line.trim(), `KDoc tag '@${tagName}' is out of order.`, `Move @${tagName} to the correct position.`));
                    }
                    currentOrderIndex = tagIndex;
                }
            }
            if (line.includes('*/')) inKdoc = false;
        }
        return violations;
    }
};

// ============================================================================
// NEW RULES -- Formatting (Annotations, Enums, Return types)
// ============================================================================

/**
 * KT-FMT-16: Annotations on separate lines
 *
 * "Annotations without arguments can be placed on a single line...
 *  A single annotation without arguments may be placed on the same line
 *  as the declaration."
 * Multiple annotations should each be on their own line.
 *
 * Google Kotlin Style Guide -- Formatting / Annotations
 */
export const annotationsOnSeparateLines: Rule = {
    id: 'KT-FMT-16',
    name: 'Multiple annotations on separate lines',
    description: 'When multiple annotations are applied to a declaration, each annotation should be on its own line.',
    severity: 'low',
    guideSection: '§Formatting',
    guideUrl: 'https://developer.android.com/kotlin/style-guide#annotations',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const clean = cleanLines || getCleanLines(lines);
        for (let i = 0; i < clean.length; i++) {
            const cleanLine = clean[i].trim();
            if (isSkippableLine(cleanLine)) continue;
            // Check for multiple annotations on the same line before a declaration
            // e.g. @JvmStatic @JvmOverloads fun foo()
            const annotationMatches = cleanLine.match(/@[A-Z][a-zA-Z0-9_]*/g);
            if (annotationMatches && annotationMatches.length >= 2) {
                // Check if this line also has a declaration keyword
                if (/\b(fun|val|var|class|interface|object|typealias)\b/.test(cleanLine)) {
                    violations.push(createViolation(this, i + 1, lines[i].trim(), "Multiple annotations should each be on their own line before the declaration.", "Place each annotation on a separate line."));
                }
            }
        }
        return violations;
    }
};

/**
 * KT-FMT-17: No explicit Unit return type
 *
 * "Functions which return Unit should omit the return type."
 *
 * Google Kotlin Style Guide -- Formatting / Expression functions
 */
export const noExplicitUnitReturn: Rule = {
    id: 'KT-FMT-17',
    name: 'Omit explicit Unit return type',
    description: 'Functions which return Unit should omit the return type declaration.',
    severity: 'low',
    guideSection: '§Formatting',
    guideUrl: 'https://developer.android.com/kotlin/style-guide#expression_functions',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const clean = cleanLines || getCleanLines(lines);
        for (let i = 0; i < clean.length; i++) {
            const cleanLine = clean[i];
            if (isSkippableLine(cleanLine)) continue;
            // Match fun declarations with explicit : Unit return type
            if (/\bfun\s+[^(]+\([^)]*\)\s*:\s*Unit\b/.test(cleanLine)) {
                violations.push(createViolation(this, i + 1, lines[i].trim(), "Functions returning Unit should omit the explicit return type.", "Remove ': Unit' from the function declaration."));
            }
        }
        return violations;
    }
};

/**
 * KT-FMT-18: Enum entries formatting
 *
 * "An enum class with no properties and no documentation on its constants may
 *  optionally be formatted as a single line."
 * Each enum constant with a body must be followed by a blank line.
 *
 * Google Kotlin Style Guide -- Formatting / Enum classes
 */
export const enumEntryFormatting: Rule = {
    id: 'KT-FMT-18',
    name: 'Enum entries should end with semicolon if body follows',
    description: 'If an enum class has properties or functions, the last enum entry must be followed by a semicolon.',
    severity: 'medium',
    guideSection: '§Formatting',
    guideUrl: 'https://developer.android.com/kotlin/style-guide#enum_classes',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const clean = cleanLines || getCleanLines(lines);

        let inEnum = false;
        let enumHasBody = false;
        let lastEntryLine = -1;

        for (let i = 0; i < clean.length; i++) {
            const cleanLine = clean[i].trim();

            // Detect start of enum class
            if (/\benum\s+class\b/.test(cleanLine)) {
                inEnum = true;
                enumHasBody = false;
                lastEntryLine = -1;
                continue;
            }

            if (inEnum) {
                // Detect a fun or val/var inside the enum (meaning there is a body after entries)
                if (/^\s*(?:fun|val|var|override|abstract|companion)\b/.test(cleanLine)) {
                    enumHasBody = true;
                }
                // If we find closing brace, check if the last entry line had a semicolon
                if (/^\s*\}/.test(cleanLine)) {
                    if (enumHasBody && lastEntryLine >= 0) {
                        const entryClean = clean[lastEntryLine].trim();
                        if (!entryClean.endsWith(';') && !/;\s*$/.test(entryClean)) {
                            violations.push(createViolation(this, lastEntryLine + 1, lines[lastEntryLine].trim(), "Last enum entry must end with a semicolon when the enum has a body.", "Add a semicolon after the last enum entry."));
                        }
                    }
                    inEnum = false;
                    continue;
                }

                // Track enum entries (lines ending with , or lines that look like entries)
                if (/^[A-Z][A-Z0-9_]*/.test(cleanLine)) {
                    lastEntryLine = i;
                }
            }
        }
        return violations;
    }
};

// ============================================================================
// NEW RULES -- Naming (Type aliases, Type parameters)
// ============================================================================

/**
 * KT-NAME-09: Type alias names must be PascalCase
 *
 * "Type aliases use PascalCase."
 *
 * Google Kotlin Style Guide -- Naming / Type alias names
 */
export const typeAliasNamesPascalCase: Rule = {
    id: 'KT-NAME-09',
    name: 'Type alias names must be PascalCase',
    description: 'Type alias names are written in PascalCase.',
    severity: 'medium',
    guideSection: '§Naming',
    guideUrl: 'https://developer.android.com/kotlin/style-guide#type_names',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const clean = cleanLines || getCleanLines(lines);
        for (let i = 0; i < clean.length; i++) {
            const match = clean[i].match(/\btypealias\s+([A-Za-z0-9_]+)/);
            if (match) {
                const name = match[1];
                if (!/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
                    violations.push(createViolation(this, i + 1, lines[i].trim(), `Type alias name '${name}' must be PascalCase`, "Rename type alias to PascalCase"));
                }
            }
        }
        return violations;
    }
};

/**
 * KT-NAME-10: Type parameter names single uppercase letter or PascalCase ending in T
 *
 * "Each type parameter name is either a single uppercase letter, or PascalCase ending in T."
 *
 * Google Kotlin Style Guide -- Naming / Type variable names
 */
export const typeParameterNames: Rule = {
    id: 'KT-NAME-10',
    name: 'Type parameter names must be single letter or PascalCase ending in T',
    description: 'Type parameter names are either a single uppercase letter (e.g. T, E, K, V) or a name in PascalCase ending with T (e.g. RequestT).',
    severity: 'low',
    guideSection: '§Naming',
    guideUrl: 'https://developer.android.com/kotlin/style-guide#type_variable_names',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const clean = cleanLines || getCleanLines(lines);
        for (let i = 0; i < clean.length; i++) {
            const cleanLine = clean[i];
            // Match generic type parameter declarations: <T>, <T, U>, <out T : Comparable<T>>
            const genericMatch = cleanLine.match(/<([^>]+)>/g);
            if (!genericMatch) continue;
            // Only check declarations (fun, class, interface), not usage like List<String>
            if (!/\b(fun|class|interface)\s/.test(cleanLine)) continue;

            for (const generic of genericMatch) {
                // Extract type params, handling variance and bounds
                const params = generic.slice(1, -1).split(',');
                for (const param of params) {
                    const trimmed = param.trim();
                    // Remove variance keywords and bounds
                    const nameMatch = trimmed.match(/^(?:in|out|reified)?\s*([A-Za-z0-9_]+)/);
                    if (nameMatch) {
                        const name = nameMatch[1];
                        // Skip well-known types that aren't type params (Comparable, Any, etc.)
                        if (/^[A-Z][a-z]/.test(name) && !name.endsWith('T')) continue;
                        // Valid: single uppercase letter OR PascalCase ending in T
                        const isValid = /^[A-Z]$/.test(name) || /^[A-Z][a-zA-Z0-9]*T$/.test(name);
                        if (!isValid && /^[A-Z]/.test(name)) {
                            // Only flag things that look like they were intended as type params
                            // (single chars or short names not ending in T)
                            if (name.length <= 2) {
                                violations.push(createViolation(this, i + 1, lines[i].trim(), `Type parameter '${name}' should be a single uppercase letter or PascalCase ending in T`, "Rename type parameter"));
                            }
                        }
                    }
                }
            }
        }
        return violations;
    }
};

// ============================================================================
// NEW RULES -- Source file structure
// ============================================================================

/**
 * KT-SRC-06: Imports must be ordered (no blank lines within import block)
 *
 * "Import statements for classes, functions, and properties are grouped together
 *  in a single list and ASCII sorted."
 *
 * Google Kotlin Style Guide -- Source files / Import statements
 */
export const importsNoBlankLines: Rule = {
    id: 'KT-SRC-06',
    name: 'No blank lines within import block',
    description: 'All import statements should be in a single block with no blank lines between them, sorted by ASCII order.',
    severity: 'low',
    guideSection: '§Source files',
    guideUrl: 'https://developer.android.com/kotlin/style-guide#import_statements',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const clean = cleanLines || getCleanLines(lines);

        let inImports = false;
        let foundBlankInImports = false;

        for (let i = 0; i < clean.length; i++) {
            const trimmed = clean[i].trim();
            if (/^import\s/.test(trimmed)) {
                if (!inImports) {
                    inImports = true;
                    foundBlankInImports = false;
                }
                if (foundBlankInImports) {
                    violations.push(createViolation(this, i + 1, lines[i].trim(), "Import block should not contain blank lines.", "Remove blank lines within the import block."));
                    break; // Report once
                }
            } else if (inImports) {
                if (trimmed === '') {
                    foundBlankInImports = true;
                } else {
                    inImports = false; // Left the import block
                }
            }
        }
        return violations;
    }
};

/**
 * KT-SRC-07: UTF-8 encoding only (no non-ASCII whitespace outside strings)
 *
 * "Files are encoded in UTF-8."
 * "Aside from the line terminator sequence, the ASCII horizontal space character
 *  (0x20) is the only whitespace character..."
 *
 * Google Kotlin Style Guide -- Source files / Special characters
 */
export const noNonAsciiWhitespace: Rule = {
    id: 'KT-SRC-07',
    name: 'No non-ASCII whitespace characters',
    description: 'The only whitespace character permitted in source code is the ASCII horizontal space (0x20). Tab is handled separately.',
    severity: 'high',
    guideSection: '§Source files',
    guideUrl: 'https://developer.android.com/kotlin/style-guide#whitespace_characters',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const clean = cleanLines || getCleanLines(lines);
        // Non-breaking space (0xA0), zero-width space, etc.
        const nonAsciiWs = /[\u00A0\u2000-\u200B\u202F\u205F\u3000\uFEFF]/;
        for (let i = 0; i < clean.length; i++) {
            if (nonAsciiWs.test(clean[i])) {
                violations.push(createViolation(this, i + 1, lines[i].trim().slice(0, 80), "Non-ASCII whitespace character found in source code.", "Replace with standard ASCII space (0x20)."));
            }
        }
        return violations;
    }
};

// ============================================================================
// NEW RULES -- Documentation
// ============================================================================

/**
 * KT-DOC-04: Public declarations should have KDoc
 *
 * "At a minimum, KDoc is present for every public type, and every public or
 *  protected member of such a type."
 *
 * Google Kotlin Style Guide -- Documentation / KDoc
 */
export const publicDeclarationsNeedKdoc: Rule = {
    id: 'KT-DOC-04',
    name: 'Public declarations should have KDoc',
    description: 'Every public type and every public or protected member of such a type should have KDoc.',
    severity: 'medium',
    guideSection: '§Documentation',
    guideUrl: 'https://developer.android.com/kotlin/style-guide#where_required',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const clean = cleanLines || getCleanLines(lines);

        for (let i = 0; i < clean.length; i++) {
            const cleanLine = clean[i].trim();
            // Detect public declarations (no private/internal modifier = public by default in Kotlin)
            if (/^(?:(?:public|open|abstract|data|sealed|inline)\s+)*(?:class|interface|object|fun|enum\s+class)\s+\w+/.test(cleanLine)) {
                // Skip private/internal/protected
                if (/\b(?:private|internal)\b/.test(cleanLine)) continue;
                // Skip override (inherits docs)
                if (/\boverride\b/.test(cleanLine)) continue;

                // Check if previous non-blank line is end of KDoc (*/)
                let prevIdx = i - 1;
                while (prevIdx >= 0 && lines[prevIdx].trim() === '') prevIdx--;
                if (prevIdx >= 0) {
                    const prevTrimmed = lines[prevIdx].trim();
                    if (prevTrimmed.endsWith('*/') || prevTrimmed.startsWith('*/')) {
                        continue; // Has KDoc
                    }
                    // Single-line KDoc: /** ... */
                    if (/^\/\*\*.*\*\/$/.test(prevTrimmed)) {
                        continue;
                    }
                    // Annotation lines above -- check one more above
                    if (prevTrimmed.startsWith('@')) {
                        let annotIdx = prevIdx - 1;
                        while (annotIdx >= 0 && lines[annotIdx].trim().startsWith('@')) annotIdx--;
                        if (annotIdx >= 0 && lines[annotIdx].trim().endsWith('*/')) {
                            continue;
                        }
                    }
                }
                violations.push(createViolation(this, i + 1, lines[i].trim(), "Public declaration should have KDoc documentation.", "Add a KDoc comment above this declaration."));
            }
        }
        return violations;
    }
};

// Deferred sections (require AST for accurate detection):
// -- Expression functions vs block body preference -- deferred to AI deep review layer
// -- When expression exhaustiveness -- deferred to AI deep review layer
// -- Destructuring declarations -- deferred to AI deep review layer
// -- Lambda parameter naming (it vs explicit) -- deferred to AI deep review layer

// ============================================================================
// EXPORT
// ============================================================================

/**
 * All Kotlin rules (39 rules)
 *
 * Sections covered:
 *   Source files -- Imports, Special Characters, Naming, Structure
 *   Formatting -- Line length, Semicolons, Braces, Whitespace, Annotations, Enums
 *   Naming -- Packages, Classes, Functions, Constants, Type aliases, Type params
 *   Documentation -- KDoc
 */
export const kotlinRules: Rule[] = [
    // Source files
    noWildcardImports,       // KT-SRC-01
    noTabs,                  // KT-SRC-02
    noSemicolons,            // KT-SRC-03
    namedEscapeSequences,    // KT-SRC-04
    filenameMatchesClass,    // KT-SRC-05
    importsNoBlankLines,     // KT-SRC-06
    noNonAsciiWhitespace,    // KT-SRC-07

    // Formatting
    lineLength,              // KT-FMT-01
    openingBraceSameLine,    // KT-FMT-02
    spaceBeforeBrace,        // KT-FMT-03
    emptyBlockMustHaveSpace, // KT-FMT-04
    spaceAfterKeywordBeforeParen, // KT-FMT-05
    noSpaceAroundMemberReference, // KT-FMT-06
    noSpaceAroundDot,             // KT-FMT-07
    noSpaceAroundRange,           // KT-FMT-08
    spaceAfterComma,              // KT-FMT-09
    spaceBeforeColonInClass,      // KT-FMT-10
    spaceBeforeEndOfLineComment,  // KT-FMT-11
    noConsecutiveBlankLines,      // KT-FMT-12
    bracesForMultiLineConditionals, // KT-FMT-13
    spaceAroundBinaryOperators,     // KT-FMT-14
    continuationIndentation,        // KT-FMT-15
    annotationsOnSeparateLines,     // KT-FMT-16
    noExplicitUnitReturn,           // KT-FMT-17
    enumEntryFormatting,            // KT-FMT-18

    // Naming
    packageNamesAllLowercase,     // KT-NAME-01
    classNamesPascalCase,         // KT-NAME-02
    functionNamesLowerCamelCase,  // KT-NAME-03
    constValUpperSnakeCase,       // KT-NAME-04
    nonConstValLowerCamelCase,    // KT-NAME-05
    noHungarianNotation,          // KT-NAME-06
    noBacktickFunctions,          // KT-NAME-07
    scalarPropertiesMustUseConst, // KT-NAME-08
    typeAliasNamesPascalCase,     // KT-NAME-09
    typeParameterNames,           // KT-NAME-10

    // Documentation
    kdocNoEmptyDescriptions,      // KT-DOC-01
    kdocNoGenericSummary,         // KT-DOC-02
    kdocTagOrder,                 // KT-DOC-03
    publicDeclarationsNeedKdoc,   // KT-DOC-04
];
