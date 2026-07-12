/**
 * Java Rules — Google Java Style Guide
 * https://google.github.io/styleguide/javaguide.html
 *
 * Rules are added incrementally, 2 guide sections at a time.
 * Each rule is a self-contained, exhaustive check function.
 *
 * Current sections covered:
 *   §2 Source File Basics
 *   §3 Source File Structure
 *   §4.1–§4.4 Formatting (Braces, Indentation, Statements, Column Limit)
 *
 * Rules use a getCleanLines() tokenizer to strip string literals and comments
 * before pattern matching, preventing false positives on embedded content.
 *
 * Total rules implemented: 39
 */

import { Rule, Violation } from '../../types.js';

// ============================================================================
// HELPER UTILITIES
// ============================================================================

/**
 * Strip string literals and comments from Java source while preserving
 * line count and positions. This prevents regex rules from false-positive
 * matching inside comments or string literals.
 *
 * Handles:
 *   - Single-line comments:   // ...
 *   - Block comments:         /* ... *\/
 *   - Javadoc comments:       /** ... *\/
 *   - Single-quoted chars:    'a', '\n'
 *   - Double-quoted strings:  "hello"
 *   - Text blocks (Java 13+): """..."""
 */
export function getCleanLines(lines: string[]): string[] {
    const code = lines.join('\n');
    let cleanCode = '';

    type State = 'NORMAL' | 'COMMENT_S' | 'COMMENT_M' | 'STRING' | 'CHAR' | 'TEXT_BLOCK';
    let state: State = 'NORMAL';
    let i = 0;

    while (i < code.length) {
        const char = code[i];
        const nextChar = code[i + 1] || '';
        const next2 = code.slice(i + 1, i + 3);

        // Unconditionally preserve newlines to keep line count stable
        if (char === '\n') {
            cleanCode += '\n';
            if (state === 'COMMENT_S') state = 'NORMAL';
            i++;
            continue;
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
                } else if (char === '"' && next2 === '""') {
                    // Java 13+ text blocks start with """
                    state = 'TEXT_BLOCK';
                    cleanCode += '"""';
                    i += 3;
                } else if (char === '"') {
                    state = 'STRING';
                    cleanCode += char;
                    i++;
                } else if (char === "'") {
                    state = 'CHAR';
                    cleanCode += char;
                    i++;
                } else {
                    cleanCode += char;
                    i++;
                }
                break;

            case 'COMMENT_S':
                cleanCode += ' ';
                i++;
                break;

            case 'COMMENT_M':
                if (char === '*' && nextChar === '/') {
                    state = 'NORMAL';
                    cleanCode += '  ';
                    i += 2;
                } else {
                    cleanCode += ' ';
                    i++;
                }
                break;

            case 'STRING':
                if (char === '\\') {
                    // Escaped character — skip both chars
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

            case 'CHAR':
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

            case 'TEXT_BLOCK':
                if (char === '"' && nextChar === '"' && code[i + 2] === '"') {
                    state = 'NORMAL';
                    cleanCode += '"""';
                    i += 3;
                } else {
                    // Preserve newlines inside text blocks for line count
                    cleanCode += ' ';
                    i++;
                }
                break;
        }
    }

    return cleanCode.split('\n');
}

/**
 * Returns true if the cleanLine (comment/string stripped) is effectively blank
 * (i.e. would have been a comment-only or whitespace-only line in the original).
 */
function isSkippableLine(cleanLine: string): boolean {
    return cleanLine.trim() === '';
}

/**
 * Create a Violation object.
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
// §2 SOURCE FILE BASICS
// ============================================================================

/**
 * JAVA-SRC-01: File name must match the top-level public class name
 *
 * "The file name consists of the case-sensitive name of the top-level class,
 *  plus the .java extension."
 *
 * Google Java Style Guide §2.1
 */
const fileNameMatchesClass: Rule = {
    id: 'JAVA-SRC-01',
    name: 'File name must match top-level class',
    description:
        'The Java source file name must match the top-level public class or interface name (case-sensitive) plus .java.',
    severity: 'critical',
    guideSection: '§2.1',
    guideUrl: 'https://google.github.io/styleguide/javaguide.html#s2.1-file-name',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        if (!filename) return violations;

        // Extract base name without extension
        const baseName = filename.replace(/\.java$/i, '').split('/').pop()?.split('\\').pop();
        if (!baseName) return violations;

        const searchLines = cleanLines || getCleanLines(lines);

        // Find the first public class/interface/enum/record declaration
        const topLevelPattern = /^\s*(?:public\s+)?(?:(?:abstract|sealed|non-sealed|final)\s+)*(?:class|interface|enum|record)\s+(\w+)/;

        for (let i = 0; i < lines.length; i++) {
            const cleanLine = searchLines[i];
            if (isSkippableLine(cleanLine)) continue;

            const match = cleanLine.match(topLevelPattern);
            if (match) {
                const className = match[1];
                if (className !== baseName) {
                    violations.push(
                        createViolation(
                            this,
                            i + 1,
                            lines[i],
                            `Top-level class "${className}" does not match file name "${baseName}".`,
                            `Rename the file to "${className}.java" or rename the class to "${baseName}".`,
                        ),
                    );
                }
                break; // Only check the first found class declaration
            }
        }

        return violations;
    },
};

/**
 * JAVA-FMT-01: No tab characters for indentation
 *
 * "Tab characters are not used for indentation."
 *
 * Google Java Style Guide §2.3.1
 */
const noTabs: Rule = {
    id: 'JAVA-FMT-01',
    name: 'No tabs for indentation',
    description:
        'Tab characters (\\t) must not be used for indentation. Use spaces instead (2 spaces per level).',
    severity: 'low',
    guideSection: '§2.3.1',
    guideUrl: 'https://google.github.io/styleguide/javaguide.html#s2.3.1-whitespace-characters',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Check at line start only — tabs in strings/comments are filtered by the raw line check
            if (/^\t/.test(line) || /^ *\t/.test(line)) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        'Tab character used for indentation.',
                        'Replace tabs with spaces (2 spaces per indent level per Google Java Style).',
                    ),
                );
            }
        }

        return violations;
    },
};

/**
 * JAVA-STR-01: Use named escape sequences, not octal or Unicode escapes
 *
 * "For any character that has a special escape sequence (\\b, \\t, \\n, \\f, \\r,
 *  \\s, \", \', \\\\), that sequence is used rather than the corresponding octal
 *  (e.g. \\012) or Unicode (e.g. \\u000a) escape."
 *
 * Google Java Style Guide §2.3.2
 */
const namedEscapeSequences: Rule = {
    id: 'JAVA-STR-01',
    name: 'Use named escape sequences',
    description:
        'Use named escape sequences (\\t, \\n, \\r, etc.) instead of octal (\\012) or Unicode (\\u000a) escapes when a named form exists.',
    severity: 'low',
    guideSection: '§2.3.2',
    guideUrl: 'https://google.github.io/styleguide/javaguide.html#s2.3.2-special-escape-sequences',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        // Octal escapes that have named alternatives: \\007, \\010, \\012, \\013, \\014, \\015, \\042, \\047, \\134
        // Named equivalents: \a(none), \b, \n, \v(none), \f, \r, ", ', \\
        const octalForNamed: { pattern: RegExp; name: string; replacement: string }[] = [
            { pattern: /\\010/, name: '\\010', replacement: '\\b (backspace)' },
            { pattern: /\\011/, name: '\\011', replacement: '\\t (tab)' },
            { pattern: /\\012/, name: '\\012', replacement: '\\n (newline)' },
            { pattern: /\\014/, name: '\\014', replacement: '\\f (form feed)' },
            { pattern: /\\015/, name: '\\015', replacement: '\\r (carriage return)' },
            { pattern: /\\042/, name: '\\042', replacement: '\\" (double quote)' },
            { pattern: /\\047/, name: '\\047', replacement: "\\' (single quote)" },
            { pattern: /\\134/, name: '\\134', replacement: '\\\\ (backslash)' },
        ];

        // Unicode escapes that have named alternatives
        const unicodeForNamed: { pattern: RegExp; name: string; replacement: string }[] = [
            { pattern: /\\u0008/, name: '\\u0008', replacement: '\\b' },
            { pattern: /\\u0009/, name: '\\u0009', replacement: '\\t' },
            { pattern: /\\u000a/i, name: '\\u000a', replacement: '\\n' },
            { pattern: /\\u000c/i, name: '\\u000c', replacement: '\\f' },
            { pattern: /\\u000d/i, name: '\\u000d', replacement: '\\r' },
            { pattern: /\\u0022/, name: '\\u0022', replacement: '\\"' },
            { pattern: /\\u0027/, name: '\\u0027', replacement: "\\'" },
            { pattern: /\\u005c/i, name: '\\u005c', replacement: '\\\\' },
        ];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isSkippableLine(cleanLine)) continue;

            for (const { pattern, name, replacement } of octalForNamed) {
                if (pattern.test(cleanLine)) {
                    violations.push(
                        createViolation(
                            this,
                            i + 1,
                            line,
                            `Octal escape "${name}" has a named equivalent.`,
                            `Replace "${name}" with the named escape sequence "${replacement}".`,
                        ),
                    );
                }
            }

            for (const { pattern, name, replacement } of unicodeForNamed) {
                if (pattern.test(cleanLine)) {
                    violations.push(
                        createViolation(
                            this,
                            i + 1,
                            line,
                            `Unicode escape "${name}" has a named equivalent.`,
                            `Replace "${name}" with the named escape sequence "${replacement}".`,
                        ),
                    );
                }
            }
        }

        return violations;
    },
};

// ============================================================================
// §3 SOURCE FILE STRUCTURE
// ============================================================================

/**
 * JAVA-SRC-02: Package declaration must not be line-wrapped
 *
 * "The package declaration is not line-wrapped."
 *
 * Google Java Style Guide §3.2
 *
 * In practice: package declarations should fit on a single line. A wrapped
 * package statement is impossible in legal Java syntax, but we can detect if
 * something like "package com." appears without the full identifier, which
 * would indicate a truncated/broken package line.
 *
 * More practically: we flag any package declaration line that ends with a dot,
 * indicating it was wrapped improperly.
 */
const packageNotWrapped: Rule = {
    id: 'JAVA-SRC-02',
    name: 'Package declaration must not be wrapped',
    description:
        'Package declarations must appear on a single line. Line-wrapping of package statements is not permitted.',
    severity: 'critical',
    guideSection: '§3.2',
    guideUrl: 'https://google.github.io/styleguide/javaguide.html#s3.2-package-statement',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];

            // A package declaration line ending with a dot or backslash line-continuation
            if (/^\s*package\s+/.test(cleanLine)) {
                if (/\.\s*$/.test(cleanLine) || /\\\s*$/.test(cleanLine)) {
                    violations.push(
                        createViolation(
                            this,
                            i + 1,
                            line,
                            'Package declaration appears to be line-wrapped (ends with "." or "\\").',
                            'Package declarations must be on a single line.',
                        ),
                    );
                }
            }
        }

        return violations;
    },
};

/**
 * JAVA-IMP-01: No wildcard imports
 *
 * "Wildcard imports, static or otherwise, are not used."
 *
 * Google Java Style Guide §3.3.1
 */
const noWildcardImports: Rule = {
    id: 'JAVA-IMP-01',
    name: 'No wildcard imports',
    description:
        'Wildcard (on-demand) imports such as "import java.util.*" are not allowed. Import each type individually.',
    severity: 'high',
    guideSection: '§3.3.1',
    guideUrl: 'https://google.github.io/styleguide/javaguide.html#s3.3.1-no-wildcard-imports',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isSkippableLine(cleanLine)) continue;

            // Matches: import foo.bar.*; or import static foo.bar.*;
            if (/^\s*import\s+(static\s+)?[\w.]+\.\*\s*;/.test(cleanLine)) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        `Wildcard import found: "${line.trim()}"`,
                        'Replace with explicit imports for each class used.',
                    ),
                );
            }
        }

        return violations;
    },
};

/**
 * JAVA-IMP-02: Static imports must appear before non-static imports
 *
 * "All static imports in a single group [first].
 *  All non-static imports in a single group [second]."
 *
 * Google Java Style Guide §3.3.3
 *
 * Strategy: scan the import block. If we see a non-static import, then later
 * see a static import, that's a violation.
 */
const staticImportsFirst: Rule = {
    id: 'JAVA-IMP-02',
    name: 'Static imports before non-static imports',
    description:
        'All static imports must appear in a single group before all non-static imports.',
    severity: 'low',
    guideSection: '§3.3.3',
    guideUrl: 'https://google.github.io/styleguide/javaguide.html#s3.3.3-import-ordering-and-spacing',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        let seenNonStatic = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isSkippableLine(cleanLine)) continue;

            const isStaticImport = /^\s*import\s+static\s+/.test(cleanLine);
            const isNonStaticImport =
                /^\s*import\s+(?!static\s)/.test(cleanLine);

            if (isNonStaticImport) {
                seenNonStatic = true;
            }

            if (isStaticImport && seenNonStatic) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        `Static import appears after non-static import: "${line.trim()}"`,
                        'Move all static imports to the top of the import block, before any non-static imports.',
                    ),
                );
            }

            // Stop scanning after the import block (first non-import, non-blank line
            // after imports started)
            if (
                !isStaticImport &&
                !isNonStaticImport &&
                seenNonStatic &&
                !/^\s*$/.test(cleanLine)
            ) {
                break;
            }
        }

        return violations;
    },
};

/**
 * JAVA-SRC-03: Exactly one top-level class per source file
 *
 * "Each top-level class resides in a source file of its own."
 *
 * Google Java Style Guide §3.4.1
 *
 * Strategy: Count top-level class/interface/enum/record declarations at
 * indent level 0. If more than one is found, it's a violation.
 *
 * We exclude inner classes (which are indented) and annotations.
 */
const oneTopLevelClass: Rule = {
    id: 'JAVA-SRC-03',
    name: 'Exactly one top-level class',
    description:
        'Each Java source file must contain exactly one top-level class, interface, enum, or record declaration.',
    severity: 'critical',
    guideSection: '§3.4.1',
    guideUrl: 'https://google.github.io/styleguide/javaguide.html#s3.4.1-one-top-level-class',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        // Matches top-level declarations: class/interface/enum/record at the start of a line
        // (possibly preceded by modifiers, but NOT by indentation beyond package-level)
        const topLevelPattern =
            /^(?:(?:public|protected|private|abstract|final|sealed|non-sealed|strictfp)\s+)*(?:class|interface|enum|record)\s+(\w+)/;

        const topLevelDeclarations: { line: number; name: string }[] = [];

        for (let i = 0; i < lines.length; i++) {
            const cleanLine = searchLines[i];
            if (isSkippableLine(cleanLine)) continue;

            // Only consider lines that are NOT indented (top-level scope)
            // Lines starting with whitespace are assumed to be nested
            if (/^\s/.test(cleanLine)) continue;

            const match = cleanLine.match(topLevelPattern);
            if (match) {
                topLevelDeclarations.push({ line: i + 1, name: match[1] });
            }
        }

        // The first one is fine; report violations starting at the second
        for (let j = 1; j < topLevelDeclarations.length; j++) {
            const decl = topLevelDeclarations[j];
            violations.push(
                createViolation(
                    this,
                    decl.line,
                    lines[decl.line - 1],
                    `Multiple top-level type declarations found. Second declaration: "${decl.name}".`,
                    'Move each top-level class/interface/enum/record into its own .java file.',
                ),
            );
        }

        return violations;
    },
};

// ============================================================================
// §4.1 BRACES
// ============================================================================

/**
 * JAVA-FMT-02: Braces required for all control structures
 *
 * "Braces are used with if, else, for, do and while statements, even when the
 *  body is empty or contains only a single statement."
 *
 * Google Java Style Guide §4.1.1
 *
 * Strategy: Detect control structure keywords whose body is NOT followed by
 * a '{' on the same line. We look for lines ending with a closing paren ')'
 * (indicating a complete condition) where the next non-blank line doesn't
 * start with '{'.
 *
 * Edge-cases handled:
 *   - for/while/if/else/do — all checked
 *   - Inline single-statement bodies like: if (x) doSomething();
 *   - else-if chains: else if (y)
 *   - do-while: do { } while (cond); — braces already required by loop body
 */
const bracesRequired: Rule = {
    id: 'JAVA-FMT-02',
    name: 'Braces required for control structures',
    description:
        'Braces are required for if, else, for, do, and while statements, even when the body contains only a single statement.',
    severity: 'high',
    guideSection: '§4.1.1',
    guideUrl: 'https://google.github.io/styleguide/javaguide.html#s4.1.1-use-of-optional-braces',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        // Pattern: control keyword + condition + NO opening brace at end of same line
        // Matches lines like: if (cond)   /   else if (cond)   /   for (...)   /   while (...)
        // that do NOT end with '{' (meaning the body is not an inline block)
        const controlPattern = /^\s*(?:if|else\s+if|for|while)\s*\(.*\)\s*(?:\/\/.*)?$/;
        const elseAlonePattern = /^\s*else\s*(?:\/\/.*)? *$/;
        const doPattern = /^\s*do\s*(?:\/\/.*)?$/;

        for (let i = 0; i < lines.length; i++) {
            const cleanLine = searchLines[i];
            if (isSkippableLine(cleanLine)) continue;

            const isBraceless =
                controlPattern.test(cleanLine) ||
                elseAlonePattern.test(cleanLine) ||
                doPattern.test(cleanLine);

            if (!isBraceless) continue;

            // Check: does the CURRENT line itself end with '{'?
            if (/\{\s*(?:\/\/.*)?$/.test(cleanLine)) continue;

            // Check: the next non-blank line should start with '{'
            let nextIdx = i + 1;
            while (nextIdx < lines.length && searchLines[nextIdx].trim() === '') nextIdx++;

            if (nextIdx < lines.length) {
                const nextClean = searchLines[nextIdx].trim();
                if (!nextClean.startsWith('{')) {
                    violations.push(
                        createViolation(
                            this,
                            i + 1,
                            lines[i],
                            `Control structure lacks braces: "${lines[i].trim()}"`,
                            'Add curly braces {} around the body, even for single-statement bodies.',
                        ),
                    );
                }
            }
        }

        return violations;
    },
};

/**
 * JAVA-FMT-03: Opening brace must be on the same line (K&R style)
 *
 * "No line break before the opening brace."
 *
 * Google Java Style Guide §4.1.2
 *
 * Strategy: Detect lines that contain ONLY an opening brace '{' (possibly
 * with whitespace/comments). This indicates the brace was placed on its own
 * line instead of at the end of the previous line.
 */
const knrBraceStyle: Rule = {
    id: 'JAVA-FMT-03',
    name: 'Opening brace on same line (K&R style)',
    description:
        'Opening brace { must be placed at the end of the line that begins the block, not on its own line.',
    severity: 'low',
    guideSection: '§4.1.2',
    guideUrl: 'https://google.github.io/styleguide/javaguide.html#s4.1.2-blocks-k-r-style',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        for (let i = 0; i < lines.length; i++) {
            const cleanLine = searchLines[i];

            // Line is ONLY a '{' — brace is on its own line
            if (/^\s*\{\s*(?:\/\/.*)?$/.test(cleanLine)) {
                // Make sure previous non-blank line isn't a block comment or annotation
                let prevIdx = i - 1;
                while (prevIdx >= 0 && searchLines[prevIdx].trim() === '') prevIdx--;

                if (prevIdx >= 0) {
                    const prevClean = searchLines[prevIdx].trim();
                    // Skip if previous line is a block comment end, or annotation-only line
                    const isAfterAnnotation = /^@\w+/.test(prevClean);
                    const isAfterBlockCommentEnd = prevClean.endsWith('*/');
                    // Also skip standalone 'else' / 'do' / try/catch which can't have inline brace
                    const isAfterKeywordAlone = /^(?:else|do|try|finally|catch\s*\(.+\))\s*$/.test(prevClean);

                    if (!isAfterAnnotation && !isAfterBlockCommentEnd && !isAfterKeywordAlone) {
                        violations.push(
                            createViolation(
                                this,
                                i + 1,
                                lines[i],
                                'Opening brace { is on its own line.',
                                'Move the opening brace to the end of the previous line (K&R style).',
                            ),
                        );
                    }
                }
            }
        }

        return violations;
    },
};

// ============================================================================
// §4.2 BLOCK INDENTATION: +2 SPACES
// ============================================================================

/**
 * JAVA-FMT-04: Block indentation must be +2 spaces
 *
 * "Each time a new block or block-like construct is opened, the indent
 *  increases by two spaces."
 *
 * Google Java Style Guide §4.2
 *
 * Strategy: Detect lines indented by an odd number of spaces, OR indented
 * with 4 spaces (which is the common C/Java-IDE default that Google explicitly
 * rejects). We can't fully validate 2-space indentation without tracking
 * block depth, but we CAN reliably flag:
 *   1. Lines with 4-space indentation at the first indent level (the most
 *      common violation when someone uses the wrong IDE setting)
 *   2. Lines where indentation is not a multiple of 2
 *
 * Note: We skip blank lines and comment-only lines.
 */
const twoSpaceIndentation: Rule = {
    id: 'JAVA-FMT-04',
    name: '2-space block indentation',
    description:
        'Block indentation must increase by 2 spaces per level. Indentation that is not a multiple of 2 is a violation.',
    severity: 'low',
    guideSection: '§4.2',
    guideUrl: 'https://google.github.io/styleguide/javaguide.html#s4.2-block-indentation',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];

            // Skip blank lines and pure comment/annotation lines
            if (isSkippableLine(cleanLine)) continue;
            if (/^\s*[/*@]/.test(cleanLine)) continue;

            // Count leading spaces (not tabs — tabs are caught by JAVA-FMT-01)
            const match = line.match(/^( +)/);
            if (!match) continue; // top-level line, no indentation

            const spaces = match[1].length;

            // Flag if indentation is not a multiple of 2
            if (spaces % 2 !== 0) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        `Indentation is ${spaces} space(s), which is not a multiple of 2.`,
                        'Use 2 spaces per indentation level per Google Java Style Guide.',
                    ),
                );
            }
        }

        return violations;
    },
};

// ============================================================================
// §4.3 ONE STATEMENT PER LINE
// ============================================================================

/**
 * JAVA-FMT-05: One statement per line
 *
 * "Each statement is followed by a line break."
 *
 * Google Java Style Guide §4.3
 *
 * Strategy: Detect lines that contain two or more complete statements —
 * identified by a semicolon followed by non-comment code on the same line.
 * Exception: for-loop headers are allowed (they have two semicolons in the
 * parenthesized header).
 */
const oneStatementPerLine: Rule = {
    id: 'JAVA-FMT-05',
    name: 'One statement per line',
    description:
        'Each statement must be on its own line. Do not combine multiple statements on a single line.',
    severity: 'medium',
    guideSection: '§4.3',
    guideUrl: 'https://google.github.io/styleguide/javaguide.html#s4.3-one-statement-per-line',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isSkippableLine(cleanLine)) continue;

            // Skip for-loop headers: for (int i = 0; i < n; i++) — two semicolons OK
            if (/^\s*for\s*\(/.test(cleanLine)) continue;

            // Look for a semicolon followed by a non-closing-bracket character.
            // This catches: int a = 1; int b = 2;
            // But NOT:      void doNothing() { return; }  <-- closing brace is valid
            // The character after ';' must be an identifier start or keyword (not '}' or ')')
            if (/;\s*[^}\s)\/]/.test(cleanLine)) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        `Multiple statements on one line: "${line.trim()}"`,
                        'Place each statement on its own line.',
                    ),
                );
            }
        }

        return violations;
    },
};

// ============================================================================
// §4.4 COLUMN LIMIT: 100 CHARACTERS
// ============================================================================

/**
 * JAVA-FMT-06: Column limit is 100 characters
 *
 * "Java code has a column limit of 100 characters."
 *
 * Google Java Style Guide §4.4
 *
 * Exceptions (per spec):
 *   1. Lines where obeying the column limit is not possible (e.g. long URL in Javadoc)
 *   2. package and import statements
 *   3. Text block content
 *   4. Command lines in comments (to be copy-pasted into shell)
 *
 * Strategy: Flag any non-import, non-package source line that exceeds 100 chars.
 * We check raw lines (not cleanLines) because length matters on the raw chars.
 */
const columnLimit: Rule = {
    id: 'JAVA-FMT-06',
    name: 'Column limit: 100 characters',
    description:
        'Lines must not exceed 100 characters. Exceptions: imports, package declarations, and lines that cannot be wrapped (e.g. long URLs).',
    severity: 'low',
    guideSection: '§4.4',
    guideUrl: 'https://google.github.io/styleguide/javaguide.html#s4.4-column-limit',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const LIMIT = 100;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trimEnd();

            if (trimmed.length <= LIMIT) continue;

            // Exception: package and import lines (they are explicitly exempted)
            if (/^\s*(?:package|import)\s/.test(trimmed)) continue;

            // Exception: lines that contain only a URL (//... https://...) or embedded URL
            if (/https?:\/\/\S+$/.test(trimmed)) continue;

            // Exception: lines that are inside text blocks are harder to detect;
            // we skip lines that look like they're content-only (no code constructs)
            // We don't skip them — this is conservative and intentional.

            violations.push(
                createViolation(
                    this,
                    i + 1,
                    trimmed,
                    `Line exceeds 100-character column limit (${trimmed.length} chars).`,
                    'Break this line into multiple lines to stay within the 100-character limit.',
                ),
            );
        }

        return violations;
    },
};


// §4.6 WHITESPACE
// ============================================================================

/**
 * JAVA-FMT-07: No more than one consecutive blank line
 *
 * "Multiple consecutive blank lines are permitted, but never required
 *  (or encouraged)."
 *
 * Google Java Style Guide §4.6.1
 *
 * While the spec says "permitted", Google-internal linters typically flag
 * more than one consecutive blank line as unnecessary. We flag 2+ consecutive
 * blank lines as a style violation.
 */
const noMultipleBlankLines: Rule = {
    id: 'JAVA-FMT-07',
    name: 'No multiple consecutive blank lines',
    description:
        'Multiple consecutive blank lines are not required or encouraged. Use a single blank line to separate logical sections.',
    severity: 'low',
    guideSection: '§4.6.1',
    guideUrl: 'https://google.github.io/styleguide/javaguide.html#s4.6.1-vertical-whitespace',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        let blankCount = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.trim() === '') {
                blankCount++;
                if (blankCount === 2) {
                    // Report at the second blank line
                    violations.push(
                        createViolation(
                            this,
                            i + 1,
                            line,
                            'Two or more consecutive blank lines found.',
                            'Use a single blank line to separate sections.',
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

/**
 * JAVA-FMT-08: Single space required before opening brace {
 *
 * "Before any open curly brace ({), with two exceptions:
 *   @SomeAnnotation({a, b}) — no space
 *   String[][] x = {{"foo"}}; — no space required between {{"
 *
 * Google Java Style Guide §4.6.2 item 3
 *
 * Strategy: Detect non-annotation, non-array-initializer lines where '{' is
 * directly preceded by a non-space character (i.e., missing space before '{').
 */
const spaceBeforeBrace: Rule = {
    id: 'JAVA-FMT-08',
    name: 'Space required before opening brace',
    description:
        'A single space must appear before any opening brace {, except in annotations (@X({a,b})) and nested array initializers ({{).',
    severity: 'low',
    guideSection: '§4.6.2',
    guideUrl: 'https://google.github.io/styleguide/javaguide.html#s4.6.2-horizontal-whitespace',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isSkippableLine(cleanLine)) continue;

            // Skip annotation lines: @Something({...}), @Override, etc.
            if (/^\s*@/.test(cleanLine)) continue;

            // Find '{' directly preceded by a non-space, non-open-brace character
            // Negative lookbehind: not space, not '(', not '{', not '='
            // Captures: doSomething{  or  keyword{
            if (/[^\s({=@'"]\{/.test(cleanLine)) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        `Missing space before '{'.`,
                        'Add a single space before the opening brace.',
                    ),
                );
            }
        }

        return violations;
    },
};

/**
 * JAVA-FMT-09: No space between method/constructor name and open parenthesis
 *
 * "A method, constructor, or record-class name stays attached to the open
 *  parenthesis (() that follows it."
 *
 * Google Java Style Guide §4.5.1 (line-wrapping) + §4.6.2
 *
 * Strategy: Detect method/constructor/call patterns where the name is
 * followed by a space and then '(' — e.g., "myMethod (arg)".
 */
const noSpaceBeforeParen: Rule = {
    id: 'JAVA-FMT-09',
    name: 'No space between method name and parenthesis',
    description:
        'Method names, constructor names, and method calls must NOT have a space between the name and the opening parenthesis.',
    severity: 'low',
    guideSection: '§4.6.2',
    guideUrl: 'https://google.github.io/styleguide/javaguide.html#s4.6.2-horizontal-whitespace',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isSkippableLine(cleanLine)) continue;

            // Detect identifier followed by space(s) then '('
            // BUT NOT: control keywords (if, for, while, catch, switch, return, throw, new)
            //          which SHOULD have a space before '('
            const controlKeywords = /^\s*(?:if|for|while|do|switch|catch|return|throw|new|assert)\s*\(/;
            if (controlKeywords.test(cleanLine)) continue;

            // Match: word followed by spaces then '(' — excluding the keyword-followed forms
            if (/\b(?!if|for|while|do|switch|catch|return|throw|new|assert\b)\w+\s+\(/.test(cleanLine)) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        `Space found between identifier and parenthesis: "${line.trim()}"`,
                        'Remove the space between the method/constructor name and the opening parenthesis.',
                    ),
                );
            }
        }

        return violations;
    },
};

// ============================================================================
// §4.8.2 VARIABLE DECLARATIONS
// ============================================================================

/**
 * JAVA-FMT-10: One variable per declaration
 *
 * "Every variable declaration (field or local) declares only one variable:
 *  declarations such as int a, b; are not used."
 *
 * Exception: Multiple variable declarations are acceptable in for-loop headers.
 *
 * Google Java Style Guide §4.8.2.1
 *
 * Strategy: Detect lines with a primitive or class type followed by
 * a comma-separated list of identifiers (int a, b;).
 */
const oneVariablePerDeclaration: Rule = {
    id: 'JAVA-FMT-10',
    name: 'One variable per declaration',
    description:
        'Each variable declaration must declare only one variable. Declarations like "int a, b;" are not allowed.',
    severity: 'medium',
    guideSection: '§4.8.2.1',
    guideUrl: 'https://google.github.io/styleguide/javaguide.html#s4.8.2.1-one-variable-per-declaration',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        // Primitive types and common Java types
        const typePattern = /\b(?:int|long|short|byte|char|float|double|boolean|String|var|Object)\b/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isSkippableLine(cleanLine)) continue;

            // Skip for-loop headers — multiple declarations allowed there
            if (/^\s*for\s*\(/.test(cleanLine)) continue;

            // Match: type followed by identifiers separated by commas, ending in ;
            // e.g., int a, b;   or   String x, y, z;
            if (typePattern.test(cleanLine) && /\w+\s+\w+\s*,\s*\w+/.test(cleanLine)) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        `Multiple variables declared on one line: "${line.trim()}"`,
                        'Declare each variable on its own line.',
                    ),
                );
            }
        }

        return violations;
    },
};

// ============================================================================
// §4.8.3 ARRAYS
// ============================================================================

/**
 * JAVA-FMT-11: No C-style array declarations
 *
 * "The square brackets form a part of the type, not the variable:
 *  String[] args, not String args[]."
 *
 * Google Java Style Guide §4.8.3.2
 *
 * Strategy: Detect variable/parameter declarations where [] appears after
 * the identifier name rather than after the type.
 *
 * Catches: String args[]    int nums[]    void process(byte data[])
 * Allows:  String[] args    int[] nums    void process(byte[] data)
 */
const noCStyleArrayDeclarations: Rule = {
    id: 'JAVA-FMT-11',
    name: 'No C-style array declarations',
    description:
        'Array brackets must be part of the type, not the variable name. Use "String[] args" not "String args[]".',
    severity: 'medium',
    guideSection: '§4.8.3.2',
    guideUrl: 'https://google.github.io/styleguide/javaguide.html#s4.8.3.2-no-c-style-array-declarations',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isSkippableLine(cleanLine)) continue;

            // Matches: identifier followed by [] (with optional spaces) then ; , ) or end
            // This indicates the brackets are on the variable name side
            // Pattern: word[] where word is preceded by a type name (not a method call)
            if (/\b\w+\s*\[\s*\]\s*[;,)]/.test(cleanLine)) {
                // Disambiguate: this must be a variable declaration, not an access like arr[i]
                // C-style: String name[] — two identifiers, second one has []
                // NOT C-style: arr[i] — single identifier with index
                // Heuristic: match type-name (word) space(s) name[] pattern
                if (/\b\w+\s+\w+\s*\[\s*\]/.test(cleanLine)) {
                    violations.push(
                        createViolation(
                            this,
                            i + 1,
                            line,
                            `C-style array declaration found: "${line.trim()}"`,
                            'Move the array brackets to the type: e.g., "String[] args" instead of "String args[]".',
                        ),
                    );
                }
            }
        }

        return violations;
    },
};

// ============================================================================
// §4.8.4 SWITCH STATEMENTS
// ============================================================================

/**
 * JAVA-FMT-12: Switch fall-through must be commented
 *
 * "Each statement group either terminates abruptly, or is marked with a
 *  comment to indicate that execution will or might continue into the next
 *  statement group."
 *
 * Google Java Style Guide §4.8.4.2
 *
 * Strategy: In old-style switch blocks, detect `case X:` labels that are
 * followed by code that does NOT end with break/continue/return/throw and
 * also does NOT have a fall-through comment before the next case.
 *
 * Note: new-style switch (->), exhaustiveness, and empty fall-through
 * case groups (e.g., case 1: case 2:) are exempt.
 */
const switchFallThroughCommented: Rule = {
    id: 'JAVA-FMT-12',
    name: 'Switch fall-through must be commented',
    description:
        'In old-style switch statements, each case block must either terminate (break/return/continue/throw) or have a "// fall through" comment before the next case.',
    severity: 'medium',
    guideSection: '§4.8.4.2',
    guideUrl: 'https://google.github.io/styleguide/javaguide.html#s4.8.4.2-switch-fall-through',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        // Find old-style case labels (case X: — not case X ->)
        const oldStyleCasePattern = /^\s*(?:case\s+\S.*?|default)\s*:\s*(?!.*->)/;
        const terminatorPattern = /^\s*(?:break|return|continue|throw)\b/;
        const fallThroughCommentPattern = /\/\/\s*falls?\s*(?:through|thru)\b/i;
        const newCasePattern = /^\s*(?:case\s|default\s*:)/;

        // Collect all case label line indices (old-style only)
        const caseLabelLines: number[] = [];
        for (let i = 0; i < lines.length; i++) {
            const cleanLine = searchLines[i];
            if (isSkippableLine(cleanLine)) continue;
            // Old-style: has ':' not followed by '->'
            if (oldStyleCasePattern.test(cleanLine) && !/->/.test(cleanLine)) {
                caseLabelLines.push(i);
            }
        }

        // For each case, check the lines BETWEEN it and the next case/end of switch
        for (let ci = 0; ci < caseLabelLines.length - 1; ci++) {
            const caseStart = caseLabelLines[ci];
            const nextCase = caseLabelLines[ci + 1];

            // Lines inside this case group: from caseStart+1 to nextCase-1
            let hasTerminator = false;
            let hasFallThroughComment = false;
            let hasAnyCode = false;

            for (let li = caseStart + 1; li < nextCase; li++) {
                const rawLine = lines[li];
                const cleanLine = searchLines[li];

                if (cleanLine.trim() === '') continue;

                hasAnyCode = true;

                if (terminatorPattern.test(cleanLine)) {
                    hasTerminator = true;
                }

                // Check raw line for fall-through comment (not stripped by cleanLines)
                if (fallThroughCommentPattern.test(rawLine)) {
                    hasFallThroughComment = true;
                }
            }

            // If the case has code (is not an empty fall-through group like `case 1:`)
            // and does NOT terminate or have a comment — it's a violation
            if (hasAnyCode && !hasTerminator && !hasFallThroughComment) {
                violations.push(
                    createViolation(
                        this,
                        caseStart + 1,
                        lines[caseStart],
                        `Switch case falls through without a terminator or "// fall through" comment.`,
                        'Add a break/return/continue/throw statement, or add a "// fall through" comment before the next case.',
                    ),
                );
            }
        }

        return violations;
    },
};

/**
 * JAVA-FMT-13: Switch must have a default label
 *
 * "Google Style requires every switch to be exhaustive, even those where the
 *  language itself does not require it. This may require adding a default label,
 *  even if it contains no code."
 *
 * Google Java Style Guide §4.8.4.3
 *
 * Strategy: Detect switch statements (old-style: switch (x) { case ...: })
 * that do not contain a `default:` label anywhere in their block.
 */
const switchHasDefault: Rule = {
    id: 'JAVA-FMT-13',
    name: 'Switch must have default label',
    description:
        'Every switch statement must have a default label to ensure exhaustive handling.',
    severity: 'medium',
    guideSection: '§4.8.4.3',
    guideUrl: 'https://google.github.io/styleguide/javaguide.html#s4.8.4.3-switch-default',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        // Find switch statement starts
        for (let i = 0; i < lines.length; i++) {
            const cleanLine = searchLines[i];
            if (isSkippableLine(cleanLine)) continue;

            // Detect old-style switch start: switch (expr) {
            if (!/\bswitch\s*\(/.test(cleanLine)) continue;
            if (!/\{/.test(cleanLine)) continue; // Switch must open on same or next line

            // Determine the switch block — track brace depth
            let depth = 0;
            let switchStart = i;
            let hasDefault = false;
            let j = i;

            // Count braces to find the matching closing brace
            for (j = i; j < lines.length; j++) {
                const cj = searchLines[j];
                for (const ch of cj) {
                    if (ch === '{') depth++;
                    if (ch === '}') {
                        depth--;
                        if (depth === 0) break;
                    }
                }

                // Check for default: or default -> inside the switch block
                if (/^\s*default\s*[:{]/.test(cj) || /^\s*default\s*->/.test(cj)) {
                    hasDefault = true;
                }

                if (depth === 0) break;
            }

            if (!hasDefault) {
                violations.push(
                    createViolation(
                        this,
                        switchStart + 1,
                        lines[switchStart],
                        'Switch statement has no default label.',
                        'Add a default: label (even if empty) to make the switch exhaustive.',
                    ),
                );
            }
        }

        return violations;
    },
};


// ============================================================================
// §5 NAMING CONVENTIONS
// ============================================================================

/**
 * JAVA-NAME-01: No special prefixes or suffixes
 *
 * "Special prefixes or suffixes are not used. For example, these names are not
 *  Google Style: name_, mName, s_name and kName."
 *
 * Google Java Style Guide §5.1
 *
 * Strategy: Check variable/field names (e.g. from local declarations and field
 * declarations) for matching known prefixes/suffixes like trailing underscore,
 * 'm' or 's' followed by an uppercase letter. Note: "mName" / "sName" are
 * Android/C++ conventions.
 */
const noSpecialPrefixesSuffixes: Rule = {
    id: 'JAVA-NAME-01',
    name: 'No special prefixes or suffixes',
    description:
        'Variables and fields must not use special prefixes (e.g., mName, sName, kName) or trailing underscores (name_).',
    severity: 'medium',
    guideSection: '§5.1',
    guideUrl: 'https://google.github.io/styleguide/javaguide.html#s5.1-rules-common-to-all-identifiers',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        const varDeclPattern = /\b(?:int|long|short|byte|char|float|double|boolean|String|var|Object|\w+)[<>\[\]]*\s+([A-Za-z0-9_]+)\s*(?:=|;|,|\))/;

        for (let i = 0; i < lines.length; i++) {
            const cleanLine = searchLines[i];
            if (isSkippableLine(cleanLine)) continue;

            // Skip method declarations, class declarations, loops
            if (/^\s*(?:if|for|while|do|switch|catch|return|throw|new|class|interface|record|enum)\b/.test(cleanLine)) continue;
            if (/\{/.test(cleanLine) && !/=\s*\{/.test(cleanLine)) continue;

            let match;
            const regex = new RegExp(varDeclPattern.source, 'g');
            while ((match = regex.exec(cleanLine)) !== null) {
                const varName = match[1];

                // Skip all-uppercase constants — they can have underscores
                if (/^[A-Z0-9_]+$/.test(varName) && varName.includes('_')) continue;

                // Check for trailing underscore
                const hasTrailingUnderscore = /_+$/.test(varName);

                // Check for m/s/k prefix: single lowercase m/s/k followed by an uppercase letter
                // (Must be strictly 'm', 's', 'k' - avoiding matching variable 'masterNode')
                const hasPrefix = /^[msk][A-Z]/.test(varName);

                if (hasTrailingUnderscore || hasPrefix) {
                    violations.push(
                        createViolation(
                            this,
                            i + 1,
                            lines[i],
                            `Variable "${varName}" uses a special prefix/suffix (e.g., mName, name_).`,
                            'Remove the special prefix or suffix. Use standard lowerCamelCase.',
                        ),
                    );
                }
            }
        }

        return violations;
    },
};

/**
 * JAVA-NAME-02: Package names are lowercase
 *
 * "Package names are all lowercase, with consecutive words simply concatenated
 *  together (no underscores). For example, com.example.deepspace, not
 *  com.example.deepSpace or com.example.deep_space."
 *
 * Google Java Style Guide §5.2.1
 */
const packageNamesLowercase: Rule = {
    id: 'JAVA-NAME-02',
    name: 'Package names are all lowercase',
    description:
        'Package names must be entirely lowercase and contain no underscores.',
    severity: 'medium',
    guideSection: '§5.2.1',
    guideUrl: 'https://google.github.io/styleguide/javaguide.html#s5.2.1-package-names',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        for (let i = 0; i < lines.length; i++) {
            const cleanLine = searchLines[i];
            const match = cleanLine.match(/^\s*package\s+([A-Za-z0-9_.]+)\s*;/);
            if (match) {
                const pkgName = match[1];
                if (pkgName !== pkgName.toLowerCase() || pkgName.includes('_')) {
                    violations.push(
                        createViolation(
                            this,
                            i + 1,
                            lines[i],
                            `Package name "${pkgName}" contains uppercase letters or underscores.`,
                            'Change the package name to be completely lowercase with no underscores.',
                        ),
                    );
                }
            }
        }

        return violations;
    },
};

/**
 * JAVA-NAME-03: Class names are UpperCamelCase
 *
 * "Class names are written in UpperCamelCase."
 *
 * Google Java Style Guide §5.2.2
 */
const classNamesUpperCamelCase: Rule = {
    id: 'JAVA-NAME-03',
    name: 'Class names are UpperCamelCase',
    description:
        'Class, interface, record, and enum names must be written in UpperCamelCase.',
    severity: 'medium',
    guideSection: '§5.2.2',
    guideUrl: 'https://google.github.io/styleguide/javaguide.html#s5.2.2-class-names',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        const classPattern = /\b(?:class|interface|enum|record)\s+([A-Za-z0-9_]+)/;

        for (let i = 0; i < lines.length; i++) {
            const cleanLine = searchLines[i];
            if (isSkippableLine(cleanLine)) continue;

            const match = cleanLine.match(classPattern);
            if (match) {
                const className = match[1];

                // UpperCamelCase basically means: starts with A-Z, contains no underscores
                if (!/^[A-Z][A-Za-z0-9]*$/.test(className)) {
                    violations.push(
                        createViolation(
                            this,
                            i + 1,
                            lines[i],
                            `Class name "${className}" is not UpperCamelCase.`,
                            'Rename the class/interface/enum/record to use UpperCamelCase.',
                        ),
                    );
                }
            }
        }

        return violations;
    },
};

/**
 * JAVA-NAME-04: Method names are lowerCamelCase
 *
 * "Method names are written in lowerCamelCase."
 *
 * JUnit test methods may contain underscores, e.g. test<MethodUnderTest>_<state>.
 * Google Java Style Guide §5.2.3
 */
const methodNamesLowerCamelCase: Rule = {
    id: 'JAVA-NAME-04',
    name: 'Method names are lowerCamelCase',
    description:
        'Method names must be written in lowerCamelCase. JUnit test methods are the only exception allowing underscores.',
    severity: 'medium',
    guideSection: '§5.2.3',
    guideUrl: 'https://google.github.io/styleguide/javaguide.html#s5.2.3-method-names',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        // A loose detector for method declarations. We generally look for:
        // Optional modifiers, return type, name, open paren.
        // The negative lookahead prevents backtracking from treating 'public' as a return type (which matched constructors).
        const methodPattern = /^\s*(?:(?:public|protected|private|static|final|abstract|synchronized|native|strictfp)\s+)*(?:(?!(?:public|protected|private|static|final|abstract|synchronized|native|strictfp)\b)[\w<>\[\]]+)\s+([A-Za-z0-9_]+)\s*\(/;

        for (let i = 0; i < lines.length; i++) {
            const cleanLine = searchLines[i];
            if (isSkippableLine(cleanLine)) continue;

            // Skip control structures (they look like method calls)
            if (/^\s*(?:if|for|while|switch|catch)\b/.test(cleanLine)) continue;

            // Optional: check if previous line had @Test (allow underscores for JUnit)
            let isTest = false;
            let prev = i - 1;
            while (prev >= 0 && searchLines[prev].trim() === '') prev--;
            if (prev >= 0 && searchLines[prev].includes('@Test')) {
                isTest = true;
            }

            const match = cleanLine.match(methodPattern);
            if (match) {
                const methodName = match[1];

                // Constructors look like methods but start with an uppercase letter
                // They shouldn't have a return type, but our regex might catch them.
                // We'll skip if the name matches the expected filename (it's a constructor)
                if (filename) {
                    const baseName = filename.replace(/\.java$/i, '').split('/').pop()?.split('\\').pop();
                    if (baseName && methodName === baseName) continue;
                }

                // If it starts with uppercase, it might be a constructor or generic return type.
                // Let's assume UpperCamelCase implies Constructor (handled by JAVA-NAME-03 if it was the class name).
                // Actually, if it starts with Uppercase, but wasn't skipped above, it's either a badly named method or constructor.
                // We'll flag it unless it looks like a constructor name (starts with uppercase) inside the class, but we don't have AST.
                // We will just enforce lowerCamelCase for anything that definitely looks like a method.
                // Better heuristic: if it has lowerCamelCase it's OK.
                // If it contains underscores, it's BAD unless isTest.
                // If it starts with an uppercase letter, it's BAD (methods shouldn't).

                const lowerCamelCase = /^[a-z][A-Za-z0-9]*$/;

                if (!lowerCamelCase.test(methodName)) {
                    // Exception for test methods
                    if (isTest && methodName.startsWith('test') && methodName.includes('_')) continue;

                    violations.push(
                        createViolation(
                            this,
                            i + 1,
                            lines[i],
                            `Method name "${methodName}" should be lowerCamelCase.`,
                            'Rename the method to lowerCamelCase.',
                        ),
                    );
                }
            }
        }

        return violations;
    },
};

/**
 * JAVA-NAME-05: Constant names use CONSTANT_CASE
 *
 * "Constant names use CONSTANT_CASE: all uppercase letters, with words separated
 *  by underscores. ... Constants are static final fields whose contents are deeply
 *  immutable and whose methods have no detectable side effects."
 *
 * Google Java Style Guide §5.2.4
 */
const constantNamesConstantCase: Rule = {
    id: 'JAVA-NAME-05',
    name: 'Constant names are CONSTANT_CASE',
    description:
        'Constants (static final fields) must use CONSTANT_CASE: all uppercase with words separated by underscores.',
    severity: 'medium',
    guideSection: '§5.2.4',
    guideUrl: 'https://google.github.io/styleguide/javaguide.html#s5.2.4-constant-names',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        const constantPattern = /\bstatic\s+final\s+(?:[\w<>\[\]]+)\s+([A-Za-z0-9_]+)\s*=/;

        for (let i = 0; i < lines.length; i++) {
            const cleanLine = searchLines[i];
            if (isSkippableLine(cleanLine)) continue;

            const match = cleanLine.match(constantPattern);
            if (match) {
                const constName = match[1];

                // Constant case means: all uppercase letters, digits, and underscores.
                // It shouldn't contain lowercase letters.
                if (/[a-z]/.test(constName)) {
                    violations.push(
                        createViolation(
                            this,
                            i + 1,
                            lines[i],
                            `Constant "${constName}" must be in CONSTANT_CASE (all uppercase with underscores).`,
                            'Rename the constant to use UPPER_SNAKE_CASE.',
                        ),
                    );
                }
            }
        }

        return violations;
    },
};

/**
 * JAVA-TYPE-01: Type variable names
 *
 * "Each type variable is named in one of two styles:
 *  - A single capital letter, optionally followed by a single numeral (such as E, T, X, T2)
 *  - A name in the form used for classes, followed by the capital letter T (examples: RequestT, FooBarT)."
 *
 * Google Java Style Guide §5.2.8
 */
const typeVariableNames: Rule = {
    id: 'JAVA-TYPE-01',
    name: 'Type variable names',
    description:
        'Type variables must be a single capital letter (e.g., T) or ClassNameT (e.g., RequestT).',
    severity: 'low',
    guideSection: '§5.2.8',
    guideUrl: 'https://google.github.io/styleguide/javaguide.html#s5.2.8-type-variable-names',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        // A loose detector for class/interface declarations with generics: 
        // class MyClass<T, U> or interface Foo<ReqT extends Number>
        const genericDeclarationPattern = /\b(?:class|interface|record)\s+\w+\s*<([^>]+)>/;

        for (let i = 0; i < lines.length; i++) {
            const cleanLine = searchLines[i];
            if (isSkippableLine(cleanLine)) continue;

            const match = cleanLine.match(genericDeclarationPattern);
            if (match) {
                // match[1] contains the type parameters, e.g., "T, ReqT extends Something"
                const typeParams = match[1].split(',');

                for (const param of typeParams) {
                    // Extract just the parameter name (ignore 'extends XYZ')
                    const typeName = param.trim().split(/\s+/)[0];
                    if (!typeName) continue;

                    // 1. Single capital letter + optional numeral: ^[A-Z][0-9]?$
                    // 2. ClassNameT: ^[A-Z][a-zA-Z0-9]*T$
                    const isValid = /^[A-Z][0-9]?$/.test(typeName) || /^[A-Z][a-zA-Z0-9]*T$/.test(typeName);

                    if (!isValid) {
                        violations.push(
                            createViolation(
                                this,
                                i + 1,
                                lines[i],
                                `Type variable "${typeName}" does not follow naming conventions.`,
                                'Use a single capital letter (e.g., T) or ClassNameT (e.g., RequestT).',
                            ),
                        );
                    }
                }
            }
        }

        return violations;
    },
};

// ============================================================================
// §6 PROGRAMMING PRACTICES
// ============================================================================

/**
 * JAVA-ERR-01: Caught exceptions not silently ignored
 *
 * "Except as noted below, it is very rarely correct to do nothing in response
 *  to a caught exception... When it truly is appropriate to take no action...
 *  the reason this is justified is explained in a comment."
 *  Exception: In tests, a caught exception may be ignored without comment if
 *  its name is or begins with 'expected'.
 *
 * Google Java Style Guide §6.2
 */
const caughtExceptionsNotIgnored: Rule = {
    id: 'JAVA-ERR-01',
    name: 'Caught exceptions not silently ignored',
    description:
        'Caught exceptions must not be silently ignored. Empty catch blocks must contain a comment explaining why, or the exception variable must be named "expected".',
    severity: 'high',
    guideSection: '§6.2',
    guideUrl: 'https://google.github.io/styleguide/javaguide.html#s6.2-caught-exceptions',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        for (let i = 0; i < lines.length; i++) {
            const cleanLine = searchLines[i];
            if (isSkippableLine(cleanLine)) continue;

            // Detect case where `catch (Exception e) {`
            const catchMatch = cleanLine.match(/\bcatch\s*\(\s*[\w<>\[\]|.\s]+\s+([A-Za-z0-9_]+)\s*\)\s*\{/);
            if (catchMatch) {
                const exceptionVarName = catchMatch[1];

                // If exception is named "expected", it's allowed to be empty
                if (exceptionVarName.toLowerCase().startsWith('expected')) continue;

                // Check contents of the block
                let hasCode = false;
                let hasComment = false;
                let blockEnded = false;

                // Search standard lines (to see comments)
                for (let j = i; j < lines.length; j++) {
                    // Check if block ends on this line
                    // Since it opens on line i with `{` we search for closing `}`

                    // Actually, a simpler heuristic: look at the next few lines until `}`
                    const rawLine = lines[j];
                    const clean = searchLines[j];

                    if (j > i) {
                        if (clean.includes('}')) {
                            blockEnded = true;
                            break;
                        }
                        if (clean.trim() !== '') {
                            hasCode = true;
                        }
                        // If there's a comment here (raw line vs clean line difference or explicit // /*)
                        if (rawLine.includes('//') || rawLine.includes('/*')) {
                            hasComment = true;
                        }
                    }

                    // If it's a single line catch block `catch (e) {}` or `catch (e) { /* ignored */ }`
                    if (j === i) {
                        // find substring after `{`
                        const afterBraceRaw = rawLine.substring(rawLine.indexOf('{') + 1);
                        const afterBraceClean = clean.substring(clean.indexOf('{') + 1);

                        if (afterBraceClean.includes('}')) {
                            const contentsBeforeClose = afterBraceClean.split('}')[0].trim();
                            if (contentsBeforeClose !== '') hasCode = true;

                            const rawBeforeClose = afterBraceRaw.split('}')[0];
                            if (rawBeforeClose.includes('//') || rawBeforeClose.includes('/*')) {
                                hasComment = true;
                            }
                            blockEnded = true;
                            break;
                        } else {
                            if (afterBraceClean.trim() !== '') hasCode = true;
                            if (afterBraceRaw.includes('//') || afterBraceRaw.includes('/*')) hasComment = true;
                        }
                    }
                }

                if (blockEnded && !hasCode && !hasComment) {
                    violations.push(
                        createViolation(
                            this,
                            i + 1,
                            lines[i],
                            `Empty catch block for exception "${exceptionVarName}" must contain a comment or the variable must be named "expected".`,
                            'Add a comment explaining why the exception is ignored, or rename it to "expected".',
                        ),
                    );
                }
            }
        }

        return violations;
    },
};

/**
 * JAVA-ERR-02: Finalizers are not used
 *
 * "It is extremely rare to override Object.finalize. Tip: Don't do it."
 *
 * Google Java Style Guide §6.4
 */
const noFinalizers: Rule = {
    id: 'JAVA-ERR-02',
    name: 'Finalizers are not used',
    description:
        'Overriding Object.finalize() is highly discouraged. Tip: Don\'t do it.',
    severity: 'high',
    guideSection: '§6.4',
    guideUrl: 'https://google.github.io/styleguide/javaguide.html#s6.4-finalizers',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        const finalizePattern = /^\s*(?:protected|public)\s+(?:void|Object)\s+finalize\s*\(/;

        for (let i = 0; i < lines.length; i++) {
            const cleanLine = searchLines[i];
            if (isSkippableLine(cleanLine)) continue;

            if (finalizePattern.test(cleanLine)) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        lines[i],
                        'Overriding finalize() is prohibited.',
                        'Remove the finalize() method. Use Cleaner or try-with-resources instead.',
                    ),
                );
            }
        }

        return violations;
    },
};

/**
 * JAVA-PRACTICE-01: @Override always used
 *
 * "A method is marked with the @Override annotation whenever it is legal...
 *  Exception: @Override may be omitted when the parent method is @Deprecated."
 *
 * Google Java Style Guide §6.1
 */
const overrideAlwaysUsed: Rule = {
    id: 'JAVA-PRACTICE-01',
    name: '@Override always used',
    description:
        'A method must be marked with @Override when overriding a superclass method. Methods with {@inheritDoc} must have @Override.',
    severity: 'medium',
    guideSection: '§6.1',
    guideUrl: 'https://google.github.io/styleguide/javaguide.html#s6.1-override-annotation',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        // A reliable heuristic without an AST: If a method has {@inheritDoc} in its javadoc
        // or a comment explicitly saying it overrides something, it MUST have @Override.
        for (let i = 0; i < lines.length; i++) {
            const rawLine = lines[i];
            
            if (rawLine.includes('{@inheritDoc}') || /overrides?\s+[\w.]+/i.test(rawLine)) {
                // If it's inside a comment, let's scan forward for the method declaration
                // and see if @Override is present before the method signature begins.
                let hasOverride = false;
                let foundMethod = false;
                
                for (let j = i; j < lines.length; j++) {
                    const nextClean = searchLines[j];
                    
                    if (nextClean.includes('@Override') || nextClean.includes('@Deprecated')) {
                        hasOverride = true;
                        break;
                    }
                    
                    // Stop if we hit a method signature (access modifier + return type + name + parens)
                    // or a class/interface boundary
                    if (/(?:public|protected|private|abstract|final|\s)*\b\w+(?:<\w+>)?\s+\w+\s*\(/.test(nextClean)) {
                        foundMethod = true;
                        break;
                    }
                    if (/\b(?:class|interface|enum|record)\b/.test(nextClean)) {
                        break;
                    }
                }

                if (foundMethod && !hasOverride) {
                    violations.push(
                        createViolation(
                            this,
                            i + 1,
                            lines[i],
                            'Method appears to override a parent method but lacks the @Override annotation.',
                            'Add @Override before the method signature.',
                        ),
                    );
                }
            }
        }

        return violations;
    },
};

/**
 * JAVA-PRACTICE-02: Static members qualified using class
 *
 * "When a reference to a static class member must be qualified, it is qualified
 *  with that class's name, not with a reference or expression of that class's type."
 *
 * Google Java Style Guide §6.3
 */
const staticMembersQualifiedByClass: Rule = {
    id: 'JAVA-PRACTICE-02',
    name: 'Static members qualified using class',
    description:
        'Static members must be qualified by the class name, not by an instance reference (e.g., avoid this.SOME_CONSTANT).',
    severity: 'medium',
    guideSection: '§6.3',
    guideUrl: 'https://google.github.io/styleguide/javaguide.html#s6.3-static-members',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        // Catching a very specific, common anti-pattern: `this.UPPER_SNAKE_CASE`
        // Constants are static by definition, so qualifying them with `this` is a violation of 6.3.
        const thisConstantPattern = /\bthis\.([A-Z][A-Z0-9_]*)\b/;

        for (let i = 0; i < lines.length; i++) {
            const cleanLine = searchLines[i];
            if (isSkippableLine(cleanLine)) continue;

            const match = cleanLine.match(thisConstantPattern);
            if (match) {
                const constantName = match[1];
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        lines[i],
                        `Static constant "${constantName}" is qualified with "this" instance reference.`,
                        `Qualify static members with the ClassName, not with an instance reference like "this".`,
                    ),
                );
            }
        }

        return violations;
    },
};

// ============================================================================
// §7 JAVADOC
// ============================================================================

/**
 * JAVA-DOC-01: Javadoc block tags ordering
 *
 * "The standard block tags appear in the order @param, @return, @throws,
 *  @deprecated, and these four types never appear with an empty description."
 *
 * Google Java Style Guide §7.1.3
 */
const javadocBlockTagsOrder: Rule = {
    id: 'JAVA-DOC-01',
    name: 'Javadoc block tags ordering',
    description:
        'Standard Javadoc block tags must appear in this order: @param, @return, @throws, @deprecated.',
    severity: 'medium',
    guideSection: '§7.1.3',
    guideUrl: 'https://google.github.io/styleguide/javaguide.html#s7.1.3-block-tags',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];

        // Allowed order: param -> return -> throws -> deprecated
        const orderMap = {
            '@param': 1,
            '@return': 2,
            '@throws': 3,
            '@deprecated': 4,
        };

        let currentHighestTag = 0;
        let inJavadoc = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (line.startsWith('/**')) {
                inJavadoc = true;
                currentHighestTag = 0;
            }

            if (inJavadoc) {
                // Find any of the standard tags on this line
                const match = line.match(/(@param|@return|@throws|@deprecated)\b/);
                if (match) {
                    const tag = match[1] as keyof typeof orderMap;
                    const tagValue = orderMap[tag];

                    if (tagValue < currentHighestTag) {
                        violations.push(
                            createViolation(
                                this,
                                i + 1,
                                lines[i],
                                `Javadoc tag ${tag} is out of order.`,
                                'Order block tags as: @param, @return, @throws, @deprecated.',
                            ),
                        );
                    } else {
                        currentHighestTag = tagValue;
                    }
                }

                if (line.endsWith('*/')) {
                    inJavadoc = false;
                }
            }
        }

        return violations;
    },
};

/**
 * JAVA-DOC-02: Summary fragment starts correctly
 *
 * "It is not a complete sentence... Furthermore, it does not begin with 'A',
 *  'An', or 'This method returns'..."
 *
 * Google Java Style Guide §7.2
 */
const summaryFragmentStartsCorrectly: Rule = {
    id: 'JAVA-DOC-02',
    name: 'Summary fragment starts correctly',
    description:
        'Javadoc summary fragments must not start with "This method returns".',
    severity: 'low',
    guideSection: '§7.2',
    guideUrl: 'https://google.github.io/styleguide/javaguide.html#s7.2-summary-fragment',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Look for the first line of content in a javadoc block
            if (line.startsWith('/**')) {
                // Check if the summary starts on the same line
                let summaryLine = line.replace('/**', '').trim();
                let summaryNum = i;

                // If it's an empty "/**", look at the next line
                if (summaryLine === '' && i + 1 < lines.length) {
                    summaryLine = lines[i + 1].trim().replace(/^\*\s*/, '').trim();
                    summaryNum = i + 1;
                }

                // If it starts with block tag, there is no summary
                if (summaryLine.startsWith('@')) continue;

                // Check for prohibited phrases (case-insensitive)
                if (/^this method returns\b/i.test(summaryLine)) {
                    violations.push(
                        createViolation(
                            this,
                            summaryNum + 1,
                            lines[summaryNum],
                            `Javadoc summary fragment incorrectly starts with "This method returns".`,
                            'Rewrite the summary fragment as a third-person verb phrase (e.g., "Returns...").',
                        ),
                    );
                }
            }
        }

        return violations;
    },
};

// ============================================================================
// §3.3.2 IMPORT LINE-WRAPPING
// ============================================================================

/**
 * JAVA-IMP-03: Import statements must not be line-wrapped
 *
 * "Import statements are not line-wrapped. The column limit does not apply
 *  to import statements."
 *
 * Google Java Style Guide §3.3.2
 */
const importsNotWrapped: Rule = {
    id: 'JAVA-IMP-03',
    name: 'Import statements must not be line-wrapped',
    description:
        'Import statements must not be line-wrapped. The column limit does not apply to imports.',
    severity: 'low',
    guideSection: '§3.3.2',
    guideUrl: 'https://google.github.io/styleguide/javaguide.html#s3.3.2-import-line-wrapping',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        for (let i = 0; i < lines.length; i++) {
            const cleanLine = searchLines[i];
            if (isSkippableLine(cleanLine)) continue;

            // An import line ending with a dot (wrapped) or not ending with ;
            if (/^\s*import\s+/.test(cleanLine) && !/;\s*$/.test(cleanLine)) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        lines[i],
                        'Import statement appears to be line-wrapped (missing trailing semicolon).',
                        'Import statements must appear on a single line.',
                    ),
                );
            }
        }

        return violations;
    },
};

// ============================================================================
// §4.1.3 EMPTY BLOCKS
// ============================================================================

/**
 * JAVA-FMT-14: Empty blocks may be concise
 *
 * "An empty block or block-like construct may be in K&R style... It may also
 *  be closed immediately after it is opened, with no characters or line break
 *  in between ({}), unless it is part of a multi-block statement."
 *
 * Google Java Style Guide §4.1.3
 *
 * Strategy: Detect empty blocks that are part of multi-block statements
 * (if/else, try/catch/finally) -- these must NOT use the concise {} form.
 */
const emptyBlocksMultiBlock: Rule = {
    id: 'JAVA-FMT-14',
    name: 'Empty blocks in multi-block statements',
    description:
        'Empty blocks in multi-block statements (if/else, try/catch/finally) must not use the concise {} form; they must be K&R style with a line break.',
    severity: 'low',
    guideSection: '§4.1.3',
    guideUrl: 'https://google.github.io/styleguide/javaguide.html#s4.1.3-braces-empty-blocks',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        for (let i = 0; i < lines.length; i++) {
            const cleanLine = searchLines[i];
            if (isSkippableLine(cleanLine)) continue;

            // Detect multi-block keywords with empty body: if (...) {} else, try {} catch, catch (...) {} finally
            if (/\b(?:if|else|try|catch|finally)\b.*\{\}\s*(?:else|catch|finally)\b/.test(cleanLine)) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        lines[i],
                        'Empty block in multi-block statement uses concise {} form.',
                        'Use K&R style with a line break inside the empty block for multi-block statements.',
                    ),
                );
            }
        }

        return violations;
    },
};

// ============================================================================
// §4.8.5 ANNOTATIONS
// ============================================================================

/**
 * JAVA-FMT-15: Annotations on separate lines
 *
 * "Each annotation applied to a class, method, or constructor appears on its
 *  own line."
 *
 * Google Java Style Guide §4.8.5
 *
 * Strategy: Detect lines where a type/method annotation is on the same line
 * as the declaration (e.g., @Override public void foo()).
 */
const annotationsOnSeparateLines: Rule = {
    id: 'JAVA-FMT-15',
    name: 'Annotations on separate lines',
    description:
        'Each annotation applied to a class, method, or constructor must appear on its own line.',
    severity: 'low',
    guideSection: '§4.8.5',
    guideUrl: 'https://google.github.io/styleguide/javaguide.html#s4.8.5-annotations',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        for (let i = 0; i < lines.length; i++) {
            const cleanLine = searchLines[i];
            if (isSkippableLine(cleanLine)) continue;

            // Detect annotation followed by a declaration keyword on the same line
            // e.g., @Override public void foo()
            // But NOT parameter annotations: void foo(@Nullable String s)
            if (/^\s*@\w+(?:\([^)]*\))?\s+(?:public|protected|private|static|final|abstract|synchronized|class|interface|enum|record|void|int|long|short|byte|char|float|double|boolean|String)\b/.test(cleanLine)) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        lines[i],
                        'Annotation appears on the same line as the declaration.',
                        'Place each annotation on its own line, above the declaration.',
                    ),
                );
            }
        }

        return violations;
    },
};

// ============================================================================
// §4.8.7 MODIFIERS ORDER
// ============================================================================

/**
 * JAVA-FMT-16: Modifiers in recommended order
 *
 * "Class and member modifiers, when present, appear in the order recommended
 *  by the Java Language Specification:
 *  public protected private abstract default static final transient volatile
 *  synchronized native strictfp"
 *
 * Google Java Style Guide §4.8.7
 */
const modifiersOrder: Rule = {
    id: 'JAVA-FMT-16',
    name: 'Modifiers in recommended order',
    description:
        'Modifiers must appear in the JLS-recommended order: public protected private abstract default static final transient volatile synchronized native strictfp.',
    severity: 'low',
    guideSection: '§4.8.7',
    guideUrl: 'https://google.github.io/styleguide/javaguide.html#s4.8.7-modifiers',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        const modifierOrder = [
            'public', 'protected', 'private', 'abstract', 'default', 'static',
            'final', 'transient', 'volatile', 'synchronized', 'native', 'strictfp',
        ];

        const modifierSet = new Set(modifierOrder);

        for (let i = 0; i < lines.length; i++) {
            const cleanLine = searchLines[i];
            if (isSkippableLine(cleanLine)) continue;

            // Extract leading modifiers from a declaration line
            const words = cleanLine.trim().split(/\s+/);
            const foundModifiers: string[] = [];
            for (const word of words) {
                if (modifierSet.has(word)) {
                    foundModifiers.push(word);
                } else {
                    break; // Stop at first non-modifier word
                }
            }

            if (foundModifiers.length < 2) continue;

            // Check if the found modifiers are in the correct relative order
            const indices = foundModifiers.map(m => modifierOrder.indexOf(m));
            for (let j = 1; j < indices.length; j++) {
                if (indices[j] < indices[j - 1]) {
                    violations.push(
                        createViolation(
                            this,
                            i + 1,
                            lines[i],
                            `Modifiers are not in the recommended order: "${foundModifiers.join(' ')}".`,
                            `Reorder to: ${foundModifiers.sort((a, b) => modifierOrder.indexOf(a) - modifierOrder.indexOf(b)).join(' ')}`,
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
// §4.8.8 NUMERIC LITERALS
// ============================================================================

/**
 * JAVA-FMT-17: Long-valued integer literals use uppercase L suffix
 *
 * "A long-valued integer literal uses an uppercase L suffix, never lowercase."
 *
 * Google Java Style Guide §4.8.8
 */
const longLiteralUppercaseL: Rule = {
    id: 'JAVA-FMT-17',
    name: 'Long literals use uppercase L',
    description:
        'Long-valued integer literals must use an uppercase L suffix, not lowercase l (which is easily confused with 1).',
    severity: 'medium',
    guideSection: '§4.8.8',
    guideUrl: 'https://google.github.io/styleguide/javaguide.html#s4.8.8-numeric-literals',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        for (let i = 0; i < lines.length; i++) {
            const cleanLine = searchLines[i];
            if (isSkippableLine(cleanLine)) continue;

            // Match numeric literal ending with lowercase l: 123l, 0x1Fl, 0b101l
            if (/\b(?:0[xXbB])?[\da-fA-F_]+l\b/.test(cleanLine)) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        lines[i],
                        'Long literal uses lowercase "l" suffix.',
                        'Use uppercase "L" suffix for long literals (e.g., 3000000000L instead of 3000000000l).',
                    ),
                );
            }
        }

        return violations;
    },
};

// ============================================================================
// §5.2.5 NON-CONSTANT FIELD NAMES
// ============================================================================

/**
 * JAVA-NAME-06: Non-constant field names are lowerCamelCase
 *
 * "Non-constant field names (static or otherwise) are written in lowerCamelCase."
 *
 * Google Java Style Guide §5.2.5
 */
const nonConstantFieldNamesLowerCamelCase: Rule = {
    id: 'JAVA-NAME-06',
    name: 'Non-constant field names are lowerCamelCase',
    description:
        'Non-constant field names (instance and non-final static fields) must be written in lowerCamelCase.',
    severity: 'medium',
    guideSection: '§5.2.5',
    guideUrl: 'https://google.github.io/styleguide/javaguide.html#s5.2.5-non-constant-field-names',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        // Match field declarations: access-modifier type fieldName (=|;)
        // Skip static final (constants, covered by JAVA-NAME-05)
        const fieldPattern = /^\s*(?:(?:public|protected|private)\s+)?(?!.*\bstatic\s+final\b)(?:(?:static|final|transient|volatile)\s+)*(?:[\w<>\[\].]+)\s+([a-zA-Z_]\w*)\s*[=;,]/;

        for (let i = 0; i < lines.length; i++) {
            const cleanLine = searchLines[i];
            if (isSkippableLine(cleanLine)) continue;

            // Skip local variables inside methods (indented more than field level)
            // Skip lines that are method declarations (have parentheses)
            if (/\(/.test(cleanLine)) continue;
            // Skip class/interface/enum declarations
            if (/\b(?:class|interface|enum|record|return|throw|new|import|package)\b/.test(cleanLine)) continue;

            const match = cleanLine.match(fieldPattern);
            if (match) {
                const fieldName = match[1];
                // Skip CONSTANT_CASE (handled by JAVA-NAME-05)
                if (/^[A-Z][A-Z0-9_]*$/.test(fieldName)) continue;
                // Skip single-letter names
                if (fieldName.length === 1) continue;

                // Must be lowerCamelCase: starts with lowercase, no underscores
                if (!/^[a-z][a-zA-Z0-9]*$/.test(fieldName)) {
                    violations.push(
                        createViolation(
                            this,
                            i + 1,
                            lines[i],
                            `Field name "${fieldName}" is not lowerCamelCase.`,
                            'Rename the field to use lowerCamelCase (e.g., "myField" not "my_field" or "MyField").',
                        ),
                    );
                }
            }
        }

        return violations;
    },
};

// ============================================================================
// §7.1.2 JAVADOC PARAGRAPHS
// ============================================================================

/**
 * JAVA-DOC-03: Javadoc paragraphs use <p> tag
 *
 * "Each paragraph but the first has <p> immediately before the first word,
 *  with no space after."
 *
 * Google Java Style Guide §7.1.2
 */
const javadocParagraphs: Rule = {
    id: 'JAVA-DOC-03',
    name: 'Javadoc paragraphs use <p> tag',
    description:
        'In Javadoc, each paragraph after the first must begin with <p> immediately before the first word, with no space after the tag.',
    severity: 'low',
    guideSection: '§7.1.2',
    guideUrl: 'https://google.github.io/styleguide/javaguide.html#s7.1.2-javadoc-paragraphs',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];

        let inJavadoc = false;
        let seenContent = false;
        let prevBlank = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (line.startsWith('/**')) {
                inJavadoc = true;
                seenContent = false;
                prevBlank = false;
            }

            if (inJavadoc) {
                // Strip leading * and whitespace
                const content = line.replace(/^\/?\*+\/?/, '').trim();

                if (content === '' || content === '/') {
                    if (seenContent) prevBlank = true;
                } else if (!content.startsWith('@')) {
                    if (prevBlank && !content.startsWith('<p>')) {
                        violations.push(
                            createViolation(
                                this,
                                i + 1,
                                lines[i],
                                'Javadoc paragraph after blank line does not begin with <p>.',
                                'Add <p> immediately before the first word of each subsequent paragraph.',
                            ),
                        );
                    }
                    seenContent = true;
                    prevBlank = false;
                }

                if (line.endsWith('*/')) {
                    inJavadoc = false;
                }
            }
        }

        return violations;
    },
};

// ============================================================================
// §7.3 WHERE JAVADOC IS USED
// ============================================================================

/**
 * JAVA-DOC-04: Public types and members require Javadoc
 *
 * "At the minimum, Javadoc is present for every public class, and every public
 *  or protected member of such a class."
 *
 * Google Java Style Guide §7.3.1
 *
 * Strategy: Detect public class/method/field declarations that are not preceded
 * by a Javadoc comment (/** ... *\/).
 */
const publicMembersHaveJavadoc: Rule = {
    id: 'JAVA-DOC-04',
    name: 'Public types and members require Javadoc',
    description:
        'Every public class and every public or protected member of such a class must have Javadoc.',
    severity: 'medium',
    guideSection: '§7.3.1',
    guideUrl: 'https://google.github.io/styleguide/javaguide.html#s7.3.1-javadoc-where-required',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        // Pattern for public/protected declarations at class level
        const publicDeclPattern = /^\s*(?:public|protected)\s+(?:(?:static|final|abstract|synchronized|native|strictfp|default)\s+)*(?:class|interface|enum|record|void|int|long|short|byte|char|float|double|boolean|String|[\w<>\[\].]+)\s+\w+/;

        for (let i = 0; i < lines.length; i++) {
            const cleanLine = searchLines[i];
            if (isSkippableLine(cleanLine)) continue;

            if (!publicDeclPattern.test(cleanLine)) continue;

            // Skip import/package lines
            if (/^\s*(?:import|package)\s/.test(cleanLine)) continue;

            // Look backwards for Javadoc comment ending with */
            let hasJavadoc = false;
            let j = i - 1;

            // Skip blank lines and annotations
            while (j >= 0) {
                const prevRaw = lines[j].trim();
                if (prevRaw === '') { j--; continue; }
                if (prevRaw.startsWith('@') && !prevRaw.startsWith('/**')) { j--; continue; }
                break;
            }

            // Check if the line we stopped at ends a Javadoc block
            if (j >= 0 && lines[j].trim().endsWith('*/')) {
                // Verify it was a Javadoc (/**) not a regular block comment (/*)
                for (let k = j; k >= 0; k--) {
                    const trimmed = lines[k].trim();
                    if (trimmed.startsWith('/**')) {
                        hasJavadoc = true;
                        break;
                    }
                    if (trimmed.startsWith('/*') && !trimmed.startsWith('/**')) {
                        break;
                    }
                }
            }

            if (!hasJavadoc) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        lines[i],
                        'Public/protected member lacks Javadoc.',
                        'Add a Javadoc comment (/** ... */) before the declaration.',
                    ),
                );
            }
        }

        return violations;
    },
};

// §4.5.1 — deferred to AI deep review layer (line-wrapping break points require AST)
// §4.5.2 — deferred to AI deep review layer (continuation indent +4 requires block depth tracking)
// §4.6.3 — deferred to AI deep review layer (horizontal alignment detection requires AST)
// §4.8.2.2 — deferred to AI deep review layer (declared-when-needed requires data flow analysis)

// ============================================================================
// EXPORT
// ============================================================================

/**
 * All Java rules implemented.
 *
 * Sections covered:
 *   §2 Source File Basics (§2.1, §2.3.1, §2.3.2)
 *   §3 Source File Structure (§3.2, §3.3.1, §3.3.2, §3.3.3, §3.4.1)
 *   §4 Formatting (§4.1.1, §4.1.2, §4.1.3, §4.2, §4.3, §4.4, §4.6.1, §4.6.2, §4.8.2.1, §4.8.3.2, §4.8.4.2, §4.8.4.3, §4.8.5, §4.8.7, §4.8.8)
 *   §5 Naming (§5.1, §5.2.1, §5.2.2, §5.2.3, §5.2.4, §5.2.5, §5.2.8)
 *   §6 Programming Practices (§6.1, §6.2, §6.3, §6.4)
 *   §7 Javadoc (§7.1.2, §7.1.3, §7.2, §7.3.1)
 *
 * Total: 39 rules
 */
export const javaRules: Rule[] = [
    // §2 Source File Basics
    fileNameMatchesClass,       // JAVA-SRC-01
    noTabs,                     // JAVA-FMT-01
    namedEscapeSequences,       // JAVA-STR-01

    // §3 Source File Structure
    packageNotWrapped,          // JAVA-SRC-02
    noWildcardImports,          // JAVA-IMP-01
    staticImportsFirst,         // JAVA-IMP-02
    importsNotWrapped,          // JAVA-IMP-03
    oneTopLevelClass,           // JAVA-SRC-03

    // §4.1 Braces
    bracesRequired,             // JAVA-FMT-02
    knrBraceStyle,              // JAVA-FMT-03
    emptyBlocksMultiBlock,      // JAVA-FMT-14

    // §4.2–§4.4 Formatting
    twoSpaceIndentation,        // JAVA-FMT-04
    oneStatementPerLine,        // JAVA-FMT-05
    columnLimit,                // JAVA-FMT-06

    // §4.6 Whitespace
    noMultipleBlankLines,       // JAVA-FMT-07
    spaceBeforeBrace,           // JAVA-FMT-08
    noSpaceBeforeParen,         // JAVA-FMT-09

    // §4.8 Specific Constructs
    oneVariablePerDeclaration,  // JAVA-FMT-10
    noCStyleArrayDeclarations,  // JAVA-FMT-11
    switchFallThroughCommented, // JAVA-FMT-12
    switchHasDefault,           // JAVA-FMT-13
    annotationsOnSeparateLines, // JAVA-FMT-15
    modifiersOrder,             // JAVA-FMT-16
    longLiteralUppercaseL,      // JAVA-FMT-17

    // §5 Naming Conventions
    noSpecialPrefixesSuffixes,  // JAVA-NAME-01
    packageNamesLowercase,      // JAVA-NAME-02
    classNamesUpperCamelCase,   // JAVA-NAME-03
    methodNamesLowerCamelCase,  // JAVA-NAME-04
    constantNamesConstantCase,  // JAVA-NAME-05
    nonConstantFieldNamesLowerCamelCase, // JAVA-NAME-06

    // §6 Programming Practices
    caughtExceptionsNotIgnored, // JAVA-ERR-01
    noFinalizers,               // JAVA-ERR-02
    overrideAlwaysUsed,           // JAVA-PRACTICE-01
    staticMembersQualifiedByClass, // JAVA-PRACTICE-02

    // §7 Javadoc
    javadocBlockTagsOrder,      // JAVA-DOC-01
    summaryFragmentStartsCorrectly, // JAVA-DOC-02
    javadocParagraphs,          // JAVA-DOC-03
    publicMembersHaveJavadoc,   // JAVA-DOC-04

    // Advanced Naming
    typeVariableNames,          // JAVA-TYPE-01
];
