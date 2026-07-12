/**
 * Go Rules — Google Go Style Guide
 * https://google.github.io/styleguide/go/guide
 * https://google.github.io/styleguide/go/decisions
 *
 * Rules are added incrementally, 2 guide sections at a time.
 * Each rule is a self-contained check function.
 *
 * Current sections covered:
 *   §Naming (MixedCaps, packages, receivers, getters, errors, acronyms, constants, repetition, error types)
 *   §Imports (dot imports, blank imports, import renaming, import grouping)
 *   §Errors (error strings, panic, discarded errors, return types)
 *   §Formatting (semicolons, braces, trailing whitespace, unnecessary else, empty bodies, line length)
 *   §Language (init, interface{}, context, %q, naked returns, goroutine defer)
 *   §Documentation (exported doc comments, comment format, package comments)
 *
 * Deferred to AI deep review layer:
 *   // §Synchronous functions — deferred to AI deep review layer
 *   // §Global state — deferred to AI deep review layer
 *   // §Goroutine lifetimes (full analysis) — deferred to AI deep review layer
 */

import { Rule, Violation } from '../../types.js';

// ============================================================================
// HELPER UTILITIES
// ============================================================================

/**
 * Strip string literals and comments from Go source while preserving
 * line count and positions. Handles:
 *   - Single-line comments:   // ...
 *   - Block comments:         /* ... *​/
 *   - Double-quoted strings:  "hello"
 *   - Raw string literals:    `hello`
 *   - Rune literals:          'a', '\n'
 */
export function getCleanLines(lines: string[]): string[] {
    const result: string[] = [];
    let inBlockComment = false;
    let inRawString = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let clean = '';
        let j = 0;

        while (j < line.length) {
            if (inBlockComment) {
                const endIdx = line.indexOf('*/', j);
                if (endIdx === -1) {
                    j = line.length;
                } else {
                    j = endIdx + 2;
                    inBlockComment = false;
                }
                continue;
            }

            if (inRawString) {
                const endIdx = line.indexOf('`', j);
                if (endIdx === -1) {
                    j = line.length;
                } else {
                    j = endIdx + 1;
                    inRawString = false;
                }
                continue;
            }

            // Line comment
            if (j + 1 < line.length && line[j] === '/' && line[j + 1] === '/') {
                break;
            }

            // Block comment start
            if (j + 1 < line.length && line[j] === '/' && line[j + 1] === '*') {
                inBlockComment = true;
                j += 2;
                continue;
            }

            // Raw string literal (backtick)
            if (line[j] === '`') {
                inRawString = true;
                j++;
                continue;
            }

            // Double-quoted string
            if (line[j] === '"') {
                j++;
                while (j < line.length && line[j] !== '"') {
                    if (line[j] === '\\') j++;
                    j++;
                }
                j++; // skip closing quote
                continue;
            }

            // Single-quoted rune literal
            if (line[j] === "'") {
                j++;
                while (j < line.length && line[j] !== "'") {
                    if (line[j] === '\\') j++;
                    j++;
                }
                j++;
                continue;
            }

            clean += line[j];
            j++;
        }

        result.push(clean);
    }
    return result;
}

/**
 * Returns true if the cleanLine is effectively blank.
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
// §NAMING — MixedCaps, packages, receivers, getters, errors, acronyms
// ============================================================================

/**
 * GO-NAME-01: Exported names must use MixedCaps (no underscores)
 *
 * "Go source code uses MixedCaps or mixedCaps (camel case) rather than
 *  underscores (snake case) when writing multi-word names."
 *
 * Google Go Style Guide §MixedCaps
 */
const noSnakeCaseExported: Rule = {
    id: 'GO-NAME-01',
    name: 'Exported names must use MixedCaps',
    description:
        'Go uses MixedCaps (camelCase/PascalCase) for multi-word names. Snake_case is not idiomatic Go.',
    severity: 'medium',
    guideSection: '§MixedCaps',
    guideUrl: 'https://google.github.io/styleguide/go/guide#mixed-caps',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        // Skip test files — test functions use underscores by convention
        if (filename && /_test\.go$/.test(filename)) return violations;

        const patterns = [
            /^\s*func\s+([A-Z][A-Za-z0-9]*_[A-Za-z0-9_]*)\s*\(/,
            /^\s*type\s+([A-Z][A-Za-z0-9]*_[A-Za-z0-9_]*)\s/,
        ];

        for (let i = 0; i < lines.length; i++) {
            const cl = searchLines[i];
            if (isSkippableLine(cl)) continue;

            for (const pat of patterns) {
                const m = cl.match(pat);
                if (m) {
                    const name = m[1];
                    const suggested = name
                        .replace(/_([a-zA-Z])/g, (_, c: string) => c.toUpperCase())
                        .replace(/_/g, '');

                    violations.push(createViolation(this, i + 1, lines[i],
                        `Exported name "${name}" uses underscores. Go uses MixedCaps.`,
                        `Rename to "${suggested}".`,
                    ));
                }
            }
        }
        return violations;
    },
};

/**
 * GO-NAME-02: Package names must be lowercase
 *
 * "Go package names must be concise and use only lowercase letters and
 *  numbers. Multi-word package names should remain unbroken and in all
 *  lowercase."
 *
 * Google Go Style Decisions §Package names
 */
const packageNameLowercase: Rule = {
    id: 'GO-NAME-02',
    name: 'Package names must be lowercase',
    description:
        'Go package names must be all lowercase with no underscores or MixedCaps.',
    severity: 'medium',
    guideSection: '§Package names',
    guideUrl: 'https://google.github.io/styleguide/go/decisions#package-names',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        for (let i = 0; i < lines.length; i++) {
            const cl = searchLines[i];
            const m = cl.match(/^\s*package\s+(\w+)/);
            if (m) {
                const pkg = m[1];
                // Allow _test suffix for test packages
                const base = pkg.replace(/_test$/, '');
                if (base !== base.toLowerCase() || base.includes('_')) {
                    violations.push(createViolation(this, i + 1, lines[i],
                        `Package name "${pkg}" contains uppercase letters or underscores.`,
                        'Package names must be all lowercase with no underscores.',
                    ));
                }
                break; // Only one package declaration per file
            }
        }
        return violations;
    },
};

/**
 * GO-NAME-03: No SCREAMING_SNAKE_CASE constants
 *
 * "A constant is MaxLength (not MAX_LENGTH) if exported and maxLength
 *  (not max_length) if unexported."
 *
 * Google Go Style Guide §MixedCaps
 */
const noScreamingSnakeConstants: Rule = {
    id: 'GO-NAME-03',
    name: 'No SCREAMING_SNAKE_CASE constants',
    description:
        'In Go, constants use MixedCaps (e.g., MaxLength), not SCREAMING_SNAKE_CASE (e.g., MAX_LENGTH).',
    severity: 'medium',
    guideSection: '§MixedCaps',
    guideUrl: 'https://google.github.io/styleguide/go/guide#mixed-caps',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        let inConstBlock = false;

        for (let i = 0; i < lines.length; i++) {
            const cl = searchLines[i];
            if (isSkippableLine(cl)) continue;

            if (/^\s*const\s*\(/.test(cl)) { inConstBlock = true; continue; }
            if (inConstBlock && /^\s*\)/.test(cl)) { inConstBlock = false; continue; }

            const isConstLine = inConstBlock || /^\s*const\s+/.test(cl);
            if (!isConstLine) continue;

            const m = cl.match(/([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)/);
            if (m) {
                const name = m[1];
                const suggested = name.split('_')
                    .map(w => w.charAt(0) + w.slice(1).toLowerCase())
                    .join('');

                violations.push(createViolation(this, i + 1, lines[i],
                    `Constant "${name}" uses SCREAMING_SNAKE_CASE.`,
                    `Use MixedCaps instead: "${suggested}".`,
                ));
            }
        }
        return violations;
    },
};

/**
 * GO-NAME-04: Receiver names must be short (1-2 chars, no this/self)
 *
 * "Receiver variable names must be short (conventionally one or two
 *  letters). Do not name method receivers 'this' or 'self'."
 *
 * Google Go Style Decisions §Receiver names
 */
const receiverNameShort: Rule = {
    id: 'GO-NAME-04',
    name: 'Receiver names must be short',
    description:
        'Method receiver names should be 1-2 characters and must not be "this" or "self".',
    severity: 'medium',
    guideSection: '§Receiver names',
    guideUrl: 'https://google.github.io/styleguide/go/decisions#receiver-names',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        const pattern = /^\s*func\s+\(\s*(\w+)\s+\*?\w+\s*\)/;

        for (let i = 0; i < lines.length; i++) {
            const cl = searchLines[i];
            if (isSkippableLine(cl)) continue;

            const m = cl.match(pattern);
            if (m) {
                const recv = m[1];
                if (recv === 'this' || recv === 'self') {
                    violations.push(createViolation(this, i + 1, lines[i],
                        `Receiver name "${recv}" is not idiomatic Go.`,
                        'Use a short abbreviation (1-2 chars) of the type name.',
                    ));
                } else if (recv.length > 3) {
                    violations.push(createViolation(this, i + 1, lines[i],
                        `Receiver name "${recv}" is too long (${recv.length} chars).`,
                        'Receiver names should be 1-2 characters.',
                    ));
                }
            }
        }
        return violations;
    },
};

/**
 * GO-NAME-05: No "Get" prefix on getters
 *
 * "It is not idiomatic in Go to put a Get prefix on a getter function."
 *
 * Google Go Style Decisions §Getters
 */
const noGetPrefix: Rule = {
    id: 'GO-NAME-05',
    name: 'No "Get" prefix on getters',
    description:
        'In Go, getter methods do not use a "Get" prefix. Use Name() not GetName().',
    severity: 'low',
    guideSection: '§Getters',
    guideUrl: 'https://google.github.io/styleguide/go/decisions#getters',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        const pattern = /^\s*func\s+\(\s*\w+\s+\*?\w+\s*\)\s+(Get[A-Z]\w*)\s*\(/;

        for (let i = 0; i < lines.length; i++) {
            const cl = searchLines[i];
            if (isSkippableLine(cl)) continue;

            const m = cl.match(pattern);
            if (m) {
                const name = m[1];
                violations.push(createViolation(this, i + 1, lines[i],
                    `Getter "${name}" has a "Get" prefix.`,
                    `Rename to "${name.replace(/^Get/, '')}".`,
                ));
            }
        }
        return violations;
    },
};

/**
 * GO-NAME-06: Error sentinel variables must use Err prefix
 *
 * Google Go Style Decisions §Naming
 */
const errorVarNaming: Rule = {
    id: 'GO-NAME-06',
    name: 'Error variables must use Err prefix',
    description:
        'Exported error sentinel values should be named with an "Err" prefix (e.g., ErrNotFound).',
    severity: 'low',
    guideSection: '§Naming',
    guideUrl: 'https://google.github.io/styleguide/go/decisions#naming',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        const pattern = /^\s*(?:var\s+)?([A-Z]\w*)\s*=\s*(?:errors\.New|fmt\.Errorf)\s*\(/;

        for (let i = 0; i < lines.length; i++) {
            const cl = searchLines[i];
            if (isSkippableLine(cl)) continue;

            const m = cl.match(pattern);
            if (m) {
                const name = m[1];
                if (!name.startsWith('Err')) {
                    violations.push(createViolation(this, i + 1, lines[i],
                        `Error variable "${name}" should start with "Err" prefix.`,
                        `Rename to "Err${name.replace(/Error$/, '')}".`,
                    ));
                }
            }
        }
        return violations;
    },
};

/**
 * GO-NAME-07: Acronyms must be consistently cased
 *
 * "URL should appear as URL or url, never Url."
 *
 * Google Go Style Decisions §Initialisms
 */
const acronymCasing: Rule = {
    id: 'GO-NAME-07',
    name: 'Acronyms must be consistently cased',
    description:
        'Initialisms like HTTP, URL, ID should be all-caps in exports (e.g., HTTPServer not HttpServer).',
    severity: 'low',
    guideSection: '§Initialisms',
    guideUrl: 'https://google.github.io/styleguide/go/decisions#initialisms',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        const badPatterns: [RegExp, string][] = [
            [/Http(?=[A-Z]|$|\()/, 'HTTP'],
            [/Url(?=[A-Z]|$|\()/, 'URL'],
            [/Xml(?=[A-Z]|$|\()/, 'XML'],
            [/Json(?=[A-Z]|$|\()/, 'JSON'],
            [/Sql(?=[A-Z]|$|\()/, 'SQL'],
            [/Api(?=[A-Z]|$|\()/, 'API'],
        ];

        const namePattern = /(?:func|type|var|const)\s+(?:\(\s*\w+\s+\*?\w+\s*\)\s+)?([A-Z]\w+)/;

        for (let i = 0; i < lines.length; i++) {
            const cl = searchLines[i];
            if (isSkippableLine(cl)) continue;

            const nm = cl.match(namePattern);
            if (!nm) continue;
            const name = nm[1];

            for (const [bp, correct] of badPatterns) {
                if (bp.test(name)) {
                    const found = name.match(bp)?.[0] || '';
                    violations.push(createViolation(this, i + 1, lines[i],
                        `Name "${name}" uses "${found}" — should be "${correct}".`,
                        `Use "${name.replace(bp, correct)}" instead.`,
                    ));
                    break;
                }
            }
        }
        return violations;
    },
};

/**
 * GO-NAME-08: Avoid repetitive naming (stuttering)
 *
 * "Avoid redundant naming by not repeating the package name in
 *  exported identifiers. For example, use widget.New() not widget.NewWidget()."
 *
 * Google Go Style Decisions §Repetition
 */
const noRepetitiveNaming: Rule = {
    id: 'GO-NAME-08',
    name: 'Avoid repetitive naming (stuttering)',
    description:
        'Do not repeat the package name in exported identifiers (e.g., widget.NewWidget should be widget.New).',
    severity: 'low',
    guideSection: '§Repetition',
    guideUrl: 'https://google.github.io/styleguide/go/decisions#repetition',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        let pkgName = '';
        for (const cl of searchLines) {
            const m = cl.match(/^\s*package\s+(\w+)/);
            if (m) { pkgName = m[1]; break; }
        }
        if (!pkgName || pkgName === 'main') return violations;

        const pkgUpper = pkgName.charAt(0).toUpperCase() + pkgName.slice(1);
        const exportedPattern = /^\s*(?:func|type|var|const)\s+(?:\(\s*\w+\s+\*?\w+\s*\)\s+)?([A-Z]\w*)/;

        for (let i = 0; i < lines.length; i++) {
            const cl = searchLines[i];
            if (isSkippableLine(cl)) continue;
            const m = cl.match(exportedPattern);
            if (m) {
                const name = m[1];
                // Check if the exported name ends with the package name (e.g., NewWidget in package widget)
                if (name.length > pkgUpper.length && name.endsWith(pkgUpper)) {
                    violations.push(createViolation(this, i + 1, lines[i],
                        `Name "${name}" repeats package name "${pkgName}" (stuttering).`,
                        `Consider renaming to "${name.slice(0, name.length - pkgUpper.length)}" since callers will use ${pkgName}.${name.slice(0, name.length - pkgUpper.length)}.`,
                    ));
                }
            }
        }
        return violations;
    },
};

/**
 * GO-NAME-09: Custom error types must end in Error
 *
 * "Custom error types should be named with an Error suffix."
 *
 * Google Go Style Decisions §Naming
 */
const errorTypeNaming: Rule = {
    id: 'GO-NAME-09',
    name: 'Custom error types should end in Error',
    description:
        'Custom error types that implement the error interface should have names ending in "Error".',
    severity: 'low',
    guideSection: '§Naming',
    guideUrl: 'https://google.github.io/styleguide/go/decisions#naming',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        // Find types that have an Error() string method — collect type names
        const errorMethodTypes = new Set<string>();
        const methodPattern = /^\s*func\s+\(\s*\w+\s+\*?(\w+)\s*\)\s+Error\s*\(\s*\)\s+string\b/;
        for (const cl of searchLines) {
            const m = cl.match(methodPattern);
            if (m) errorMethodTypes.add(m[1]);
        }

        // Check if those type names end with Error
        const typePattern = /^\s*type\s+([A-Z]\w*)\s+struct\b/;
        for (let i = 0; i < lines.length; i++) {
            const cl = searchLines[i];
            if (isSkippableLine(cl)) continue;
            const m = cl.match(typePattern);
            if (m) {
                const name = m[1];
                if (errorMethodTypes.has(name) && !name.endsWith('Error')) {
                    violations.push(createViolation(this, i + 1, lines[i],
                        `Error type "${name}" does not end with "Error".`,
                        `Rename to "${name}Error".`,
                    ));
                }
            }
        }
        return violations;
    },
};

// ============================================================================
// §IMPORTS — dot imports, blank imports, import renaming, import grouping
// ============================================================================

/**
 * GO-IMP-01: No dot imports
 *
 * Google Go Style Decisions §Import dot
 */
const noDotImport: Rule = {
    id: 'GO-IMP-01',
    name: 'No dot imports',
    description:
        'Do not use dot imports (import . "pkg"). They obscure where names come from.',
    severity: 'high',
    guideSection: '§Import dot',
    guideUrl: 'https://google.github.io/styleguide/go/decisions#import-dot',
    // Import blocks use raw lines — string content is needed and import blocks
    // are structurally unambiguous (not inside comments/strings).
    check(lines: string[]): Violation[] {
        const violations: Violation[] = [];
        let inImportBlock = false;

        for (let i = 0; i < lines.length; i++) {
            const trimmed = lines[i].trim();
            if (/^import\s*\(/.test(trimmed)) { inImportBlock = true; continue; }
            if (inImportBlock && trimmed === ')') { inImportBlock = false; continue; }

            if (/^import\s+\.\s+"/.test(trimmed) || (inImportBlock && /^\.\s+"/.test(trimmed))) {
                violations.push(createViolation(this, i + 1, lines[i],
                    `Dot import found: "${trimmed}".`,
                    'Use a regular import and qualify names with the package prefix.',
                ));
            }
        }
        return violations;
    },
};

/**
 * GO-IMP-02: Blank imports only in main/test packages
 *
 * Google Go Style Decisions §Import blank
 */
const blankImportOnlyInMain: Rule = {
    id: 'GO-IMP-02',
    name: 'Blank imports only in main/test',
    description:
        'Blank imports (import _ "pkg") should only be in main packages or tests.',
    severity: 'medium',
    guideSection: '§Import blank',
    guideUrl: 'https://google.github.io/styleguide/go/decisions#import-blank',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        let isMainOrTest = false;
        for (const cl of searchLines) {
            const m = cl.match(/^\s*package\s+(\w+)/);
            if (m) {
                isMainOrTest = m[1] === 'main' || m[1].endsWith('_test');
                break;
            }
        }
        if (isMainOrTest) return violations;

        let inImportBlock = false;
        for (let i = 0; i < lines.length; i++) {
            const trimmed = lines[i].trim();
            if (/^import\s*\(/.test(trimmed)) { inImportBlock = true; continue; }
            if (inImportBlock && trimmed === ')') { inImportBlock = false; continue; }

            if (/^import\s+_\s+"/.test(trimmed) || (inImportBlock && /^_\s+"/.test(trimmed))) {
                violations.push(createViolation(this, i + 1, lines[i],
                    `Blank import in non-main package: "${trimmed}".`,
                    'Blank imports should only be in main packages or tests.',
                ));
            }
        }
        return violations;
    },
};

/**
 * GO-IMP-03: Import aliases must be lowercase with no underscores
 *
 * Google Go Style Decisions §Import renaming
 */
const importRenameLowercase: Rule = {
    id: 'GO-IMP-03',
    name: 'Import aliases must be lowercase',
    description:
        'Import rename aliases must be all lowercase with no underscores.',
    severity: 'low',
    guideSection: '§Import renaming',
    guideUrl: 'https://google.github.io/styleguide/go/decisions#import-renaming',
    // Import blocks use raw lines — see GO-IMP-01 comment.
    check(lines: string[]): Violation[] {
        const violations: Violation[] = [];
        let inImportBlock = false;

        for (let i = 0; i < lines.length; i++) {
            const trimmed = lines[i].trim();
            if (/^import\s*\(/.test(trimmed)) { inImportBlock = true; continue; }
            if (inImportBlock && trimmed === ')') { inImportBlock = false; continue; }
            if (!inImportBlock) continue;
            if (trimmed.startsWith('_') || trimmed.startsWith('.') || trimmed.startsWith('"')) continue;

            const m = trimmed.match(/^([a-zA-Z_]\w*)\s+"[^"]+"/);
            if (m) {
                const alias = m[1];
                if (alias !== alias.toLowerCase() || alias.includes('_')) {
                    violations.push(createViolation(this, i + 1, lines[i],
                        `Import alias "${alias}" contains uppercase or underscores.`,
                        'Import aliases must be all lowercase with no underscores.',
                    ));
                }
            }
        }
        return violations;
    },
};

/**
 * GO-IMP-04: Import grouping (stdlib, third-party, internal)
 *
 * "goimports groups imports into two or three groups: standard library,
 *  and everything else (with optional separate group for internal)."
 *
 * Google Go Style Decisions §Import grouping
 */
const importGrouping: Rule = {
    id: 'GO-IMP-04',
    name: 'Imports should be grouped',
    description:
        'Imports should be grouped: standard library, then third-party, separated by blank lines.',
    severity: 'low',
    guideSection: '§Import grouping',
    guideUrl: 'https://google.github.io/styleguide/go/decisions#import-group',
    // Import blocks use raw lines — see GO-IMP-01 comment.
    check(lines: string[]): Violation[] {
        const violations: Violation[] = [];

        let inImportBlock = false;
        let importStart = -1;
        let hasStdlib = false;
        let hasThirdParty = false;
        let hasBlankSeparator = false;

        for (let i = 0; i < lines.length; i++) {
            const trimmed = lines[i].trim();
            if (/^import\s*\(/.test(trimmed)) {
                inImportBlock = true;
                importStart = i;
                continue;
            }
            if (inImportBlock && trimmed === ')') {
                // If we have both stdlib and third-party but no blank separator, flag it
                if (hasStdlib && hasThirdParty && !hasBlankSeparator) {
                    violations.push(createViolation(this, importStart + 1, lines[importStart],
                        'Import block mixes standard library and third-party imports without blank line separator.',
                        'Separate standard library imports from third-party imports with a blank line.',
                    ));
                }
                inImportBlock = false;
                hasStdlib = false;
                hasThirdParty = false;
                hasBlankSeparator = false;
                continue;
            }
            if (!inImportBlock) continue;

            if (trimmed === '') {
                hasBlankSeparator = true;
                continue;
            }

            // Extract the import path
            const pathMatch = trimmed.match(/"([^"]+)"/);
            if (pathMatch) {
                const importPath = pathMatch[1];
                // Stdlib imports don't contain a dot in first path segment
                const firstSeg = importPath.split('/')[0];
                if (!firstSeg.includes('.')) {
                    hasStdlib = true;
                } else {
                    hasThirdParty = true;
                }
            }
        }
        return violations;
    },
};

// ============================================================================
// §ERRORS — error strings, panic, discarded errors, return types
// ============================================================================

/**
 * GO-ERR-01: Error strings must not be capitalized
 *
 * "Error strings should not be capitalized (unless beginning with an
 *  exported name, a proper noun or an acronym) and should not end
 *  with punctuation."
 *
 * Google Go Style Decisions §Error strings
 */
const errorStringLowercase: Rule = {
    id: 'GO-ERR-01',
    name: 'Error strings must not be capitalized',
    description:
        'Error strings should not start with a capital letter (unless they begin with an exported name).',
    severity: 'medium',
    guideSection: '§Error strings',
    guideUrl: 'https://google.github.io/styleguide/go/decisions#error-strings',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        // Use cleanLines to confirm this is real code (not inside a comment),
        // but extract the string content from raw lines since cleanLines strips strings.
        const pattern = /(?:errors\.New|fmt\.Errorf)\s*\(/;
        const rawPattern = /(?:errors\.New|fmt\.Errorf)\s*\(\s*"([A-Z][^"]*)"/;

        for (let i = 0; i < lines.length; i++) {
            const cl = searchLines[i];
            if (isSkippableLine(cl)) continue;
            // Confirm errors.New/fmt.Errorf exists in clean code
            if (!pattern.test(cl)) continue;
            // Extract string content from raw line
            const m = lines[i].match(rawPattern);
            if (m) {
                const errMsg = m[1];
                // Flag if it starts with a common lowercase-expected word capitalized
                if (/^[A-Z][a-z]/.test(errMsg)) {
                    violations.push(createViolation(this, i + 1, lines[i],
                        `Error string starts with capital letter: "${errMsg.substring(0, 40)}...".`,
                        'Error strings should be lowercase (they appear in other context when printed).',
                    ));
                }
            }
        }
        return violations;
    },
};

/**
 * GO-ERR-02: Error strings must not end with punctuation
 *
 * Google Go Style Decisions §Error strings
 */
const errorStringNoPunctuation: Rule = {
    id: 'GO-ERR-02',
    name: 'Error strings must not end with punctuation',
    description:
        'Error strings should not end with periods, exclamation marks, or other punctuation.',
    severity: 'low',
    guideSection: '§Error strings',
    guideUrl: 'https://google.github.io/styleguide/go/decisions#error-strings',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        const codePattern = /(?:errors\.New|fmt\.Errorf)\s*\(/;
        const rawPattern = /(?:errors\.New|fmt\.Errorf)\s*\(\s*"([^"]*[.!])"\s*\)/;

        for (let i = 0; i < lines.length; i++) {
            const cl = searchLines[i];
            if (isSkippableLine(cl)) continue;
            if (!codePattern.test(cl)) continue;

            const m = lines[i].match(rawPattern);
            if (m) {
                violations.push(createViolation(this, i + 1, lines[i],
                    `Error string ends with punctuation: "...${m[1].slice(-20)}".`,
                    'Error strings should not end with punctuation.',
                ));
            }
        }
        return violations;
    },
};

/**
 * GO-ERR-03: Don't use panic() for normal error handling
 *
 * "Do not use panic for normal error handling. Instead, use error
 *  and multiple return values."
 *
 * Google Go Style Decisions §Don't panic
 */
const noPanic: Rule = {
    id: 'GO-ERR-03',
    name: 'No panic for error handling',
    description:
        'Do not use panic() for normal error handling. Use error and multiple return values.',
    severity: 'high',
    guideSection: "§Don't panic",
    guideUrl: 'https://google.github.io/styleguide/go/decisions#dont-panic',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        // Skip test files
        if (filename && /_test\.go$/.test(filename)) return violations;

        for (let i = 0; i < lines.length; i++) {
            const cl = searchLines[i];
            if (isSkippableLine(cl)) continue;
            if (/\bpanic\s*\(/.test(cl)) {
                violations.push(createViolation(this, i + 1, lines[i],
                    'panic() found. Do not use panic for normal error handling.',
                    'Return an error instead. Use panic only for truly unrecoverable situations.',
                ));
            }
        }
        return violations;
    },
};

/**
 * GO-ERR-04: Don't discard errors without a comment
 *
 * "It is not usually appropriate to discard errors using _ variables.
 *  If a function returns an error, do one of the following: Handle it,
 *  return it, or call log.Fatal."
 *
 * Google Go Style Decisions §Handle errors
 */
const noDiscardedErrors: Rule = {
    id: 'GO-ERR-04',
    name: "Don't discard errors without comment",
    description:
        'Do not discard errors with _ without an explaining comment.',
    severity: 'high',
    guideSection: '§Handle errors',
    guideUrl: 'https://google.github.io/styleguide/go/decisions#handle-errors',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        // Match: val, _ := someFunc(...) or val, _ = someFunc(...)
        const pattern = /,\s*_\s*(?::=|=)\s*\w+.*\(/;

        for (let i = 0; i < lines.length; i++) {
            const cl = searchLines[i];
            if (isSkippableLine(cl)) continue;
            if (pattern.test(cl)) {
                // Check if there's an explaining comment on same or previous line
                // Use raw lines for comment check since cleanLines strips comments
                const hasComment = /\/\//.test(lines[i]) ||
                    (i > 0 && /\/\//.test(lines[i - 1]));
                if (!hasComment) {
                    violations.push(createViolation(this, i + 1, lines[i],
                        `Error discarded with "_": "${lines[i].trim()}".`,
                        'Handle the error, return it, or add a comment explaining why it is safe to ignore.',
                    ));
                }
            }
        }
        return violations;
    },
};

/**
 * GO-ERR-05: Exported functions should return error interface, not concrete type
 *
 * "Exported functions that return errors should return them using the
 *  error type. Concrete error types are susceptible to subtle bugs."
 *
 * Google Go Style Decisions §Returning errors
 */
const returnErrorInterface: Rule = {
    id: 'GO-ERR-05',
    name: 'Return error interface, not concrete type',
    description:
        'Exported functions should return the error interface, not a concrete error type like *SomeError.',
    severity: 'medium',
    guideSection: '§Returning errors',
    guideUrl: 'https://google.github.io/styleguide/go/decisions#returning-errors',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        // Match exported func returning *SomeError instead of error
        const pattern = /^\s*func\s+(?:\(\s*\w+\s+\*?\w+\s*\)\s+)?[A-Z]\w*\s*\([^)]*\)\s*(?:\([^)]*)?\*\w*Error\b/;

        for (let i = 0; i < lines.length; i++) {
            const cl = searchLines[i];
            if (isSkippableLine(cl)) continue;
            const m = cl.match(pattern);
            if (m) {
                violations.push(createViolation(this, i + 1, lines[i],
                    'Function returns concrete error type instead of error interface.',
                    'Return the "error" interface type instead of a concrete error pointer.',
                ));
            }
        }
        return violations;
    },
};

// ============================================================================
// §FORMATTING — semicolons, braces, trailing whitespace, else, empty bodies, line length
// ============================================================================

/**
 * GO-FMT-01: No semicolons as statement terminators
 *
 * "Go does not require semicolons to terminate statements. They are
 *  inserted automatically by the lexer."
 *
 * Google Go Style Guide §Formatting
 */
const noSemicolons: Rule = {
    id: 'GO-FMT-01',
    name: 'No semicolons as statement terminators',
    description:
        'Go does not use semicolons to terminate statements. They are inserted automatically.',
    severity: 'low',
    guideSection: '§Formatting',
    guideUrl: 'https://google.github.io/styleguide/go/guide#formatting',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        for (let i = 0; i < lines.length; i++) {
            const cl = searchLines[i].trimEnd();
            if (isSkippableLine(cl)) continue;
            // Skip for-loop headers and if-init statements (legitimate semicolons)
            if (/^\s*for\b/.test(cl)) continue;
            if (/^\s*if\b.*;\s*\w/.test(cl)) continue;
            if (cl.endsWith(';') && !cl.endsWith('};')) {
                violations.push(createViolation(this, i + 1, lines[i],
                    'Unnecessary semicolon at end of statement.',
                    'Remove the trailing semicolon. Go inserts them automatically.',
                ));
            }
        }
        return violations;
    },
};

/**
 * GO-FMT-02: Opening brace must be on the same line
 *
 * "All Go source files must conform to the format outputted by the gofmt tool."
 * gofmt enforces K&R-style braces (opening brace on same line).
 *
 * Google Go Style Guide §Formatting
 */
const braceOnSameLine: Rule = {
    id: 'GO-FMT-02',
    name: 'Opening brace on same line',
    description:
        'Opening braces must be on the same line as the statement (K&R style, enforced by gofmt).',
    severity: 'medium',
    guideSection: '§Formatting',
    guideUrl: 'https://google.github.io/styleguide/go/guide#formatting',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        for (let i = 0; i < lines.length; i++) {
            const cl = searchLines[i];
            // Lone opening brace on a line
            if (/^\s*\{\s*$/.test(cl)) {
                let prev = i - 1;
                while (prev >= 0 && isSkippableLine(searchLines[prev])) prev--;
                if (prev >= 0 && /\b(?:func|if|else|for|switch|case|type|struct|interface)\b/.test(searchLines[prev])) {
                    violations.push(createViolation(this, i + 1, lines[i],
                        'Opening brace { found on its own line.',
                        'Move the opening brace to the end of the previous line (K&R style).',
                    ));
                }
            }
        }
        return violations;
    },
};

/**
 * GO-FMT-03: No trailing whitespace
 *
 * gofmt removes trailing whitespace.
 *
 * Google Go Style Guide §Formatting
 */
const noTrailingWhitespace: Rule = {
    id: 'GO-FMT-03',
    name: 'No trailing whitespace',
    description: 'Lines must not have trailing whitespace.',
    severity: 'low',
    guideSection: '§Formatting',
    guideUrl: 'https://google.github.io/styleguide/go/guide#formatting',
    // Whitespace rule: legitimately uses raw lines
    check(lines: string[]): Violation[] {
        const violations: Violation[] = [];
        for (let i = 0; i < lines.length; i++) {
            if (/[ \t]+$/.test(lines[i]) && lines[i].trim() !== '') {
                violations.push(createViolation(this, i + 1, lines[i],
                    'Trailing whitespace found.',
                    'Remove trailing spaces and tabs.',
                ));
            }
        }
        return violations;
    },
};

/**
 * GO-FMT-04: No unnecessary else after return
 *
 * "If a block ends with a return/continue/break, the else is unnecessary."
 *
 * Google Go Style Decisions §Indent error flow
 */
const noUnnecessaryElse: Rule = {
    id: 'GO-FMT-04',
    name: 'No unnecessary else after return',
    description:
        'If a block ends with return/continue/break, the else branch is unnecessary.',
    severity: 'low',
    guideSection: '§Indent error flow',
    guideUrl: 'https://google.github.io/styleguide/go/decisions#indent-error-flow',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        for (let i = 0; i < lines.length; i++) {
            const cl = searchLines[i];
            if (isSkippableLine(cl)) continue;
            if (/^\s*\}\s*else\s*\{/.test(cl)) {
                // Check if previous non-empty line is return/continue/break
                let j = i - 1;
                while (j >= 0 && isSkippableLine(searchLines[j])) j--;
                if (j >= 0 && /^\s*(?:return|continue|break)\b/.test(searchLines[j])) {
                    violations.push(createViolation(this, i + 1, lines[i],
                        'Unnecessary else after return/continue/break.',
                        'Remove the else and dedent the code. The if block already exits.',
                    ));
                }
            }
        }
        return violations;
    },
};

/**
 * GO-FMT-05: No empty control structure bodies
 *
 * Google Go Style Guide §Formatting
 */
const noEmptyBody: Rule = {
    id: 'GO-FMT-05',
    name: 'No empty if/for/switch body',
    description: 'Empty control structure bodies indicate missing implementation.',
    severity: 'medium',
    guideSection: '§Formatting',
    guideUrl: 'https://google.github.io/styleguide/go/guide#formatting',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        for (let i = 0; i < lines.length; i++) {
            const cl = searchLines[i];
            if (isSkippableLine(cl)) continue;
            if (/^\s*(?:if|for|switch)\b.*\{\s*\}\s*$/.test(cl)) {
                violations.push(createViolation(this, i + 1, lines[i],
                    `Empty control structure body: "${lines[i].trim()}".`,
                    'Add the missing implementation or remove the empty block.',
                ));
            }
        }
        return violations;
    },
};

/**
 * GO-FMT-06: Line length should not exceed 99 characters
 *
 * "Go has no strict line length limit, but avoid lines that feel
 *  uncomfortably long. Similarly, don't add line breaks to keep lines
 *  short when they are more readable long."
 *
 * Google Go Style Guide §Line length
 */
const lineLength: Rule = {
    id: 'GO-FMT-06',
    name: 'Lines should not exceed 99 characters',
    description:
        'While Go has no strict limit, lines over 99 characters are often hard to read. Consider wrapping.',
    severity: 'low',
    guideSection: '§Line length',
    guideUrl: 'https://google.github.io/styleguide/go/guide#line-length',
    // Line length rule: legitimately uses raw lines
    check(lines: string[]): Violation[] {
        const violations: Violation[] = [];
        const limit = 120; // Use 120 as a generous limit; Google says "avoid uncomfortably long"
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].length > limit && lines[i].trim() !== '') {
                // Skip long import lines and long string literals
                if (/^\s*import\b/.test(lines[i])) continue;
                if (/^\s*"/.test(lines[i].trim())) continue;
                if (/^\s*\/\//.test(lines[i])) continue; // skip long comments
                violations.push(createViolation(this, i + 1, lines[i],
                    `Line is ${lines[i].length} characters long (limit: ${limit}).`,
                    'Consider breaking this line for readability.',
                ));
            }
        }
        return violations;
    },
};

// ============================================================================
// §LANGUAGE — init, interface{}, context, %q, naked returns, goroutine defer
// ============================================================================

/**
 * GO-LANG-01: Avoid init() outside main package
 *
 * "init() functions should be avoided outside of main packages.
 *  They are hard to test and reason about."
 *
 * Google Go Style Decisions §init
 */
const noInitOutsideMain: Rule = {
    id: 'GO-LANG-01',
    name: 'Avoid init() outside main package',
    description:
        'init() functions should be avoided outside of main packages. They are hard to test.',
    severity: 'medium',
    guideSection: '§init',
    guideUrl: 'https://google.github.io/styleguide/go/decisions#init',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        let isMain = false;
        for (const cl of searchLines) {
            const m = cl.match(/^\s*package\s+(\w+)/);
            if (m) { isMain = m[1] === 'main'; break; }
        }
        if (isMain) return violations;

        for (let i = 0; i < lines.length; i++) {
            const cl = searchLines[i];
            if (/^\s*func\s+init\s*\(\s*\)\s*\{/.test(cl)) {
                violations.push(createViolation(this, i + 1, lines[i],
                    'init() function found in non-main package.',
                    'Avoid init(). Use explicit initialization functions that can be tested.',
                ));
            }
        }
        return violations;
    },
};

/**
 * GO-LANG-02: Prefer any over interface{}
 *
 * "Use the 'any' type alias instead of 'interface{}' for the empty interface."
 *
 * Google Go Style Decisions §Use any
 */
const preferAnyOverEmptyInterface: Rule = {
    id: 'GO-LANG-02',
    name: 'Prefer any over interface{}',
    description:
        'Use the "any" type alias instead of "interface{}" for the empty interface (Go 1.18+).',
    severity: 'low',
    guideSection: '§Use any',
    guideUrl: 'https://google.github.io/styleguide/go/decisions#use-any',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        for (let i = 0; i < lines.length; i++) {
            const cl = searchLines[i];
            if (isSkippableLine(cl)) continue;
            if (/\binterface\s*\{\s*\}/.test(cl)) {
                violations.push(createViolation(this, i + 1, lines[i],
                    '"interface{}" found. Use "any" instead (Go 1.18+).',
                    'Replace "interface{}" with "any".',
                ));
            }
        }
        return violations;
    },
};

/**
 * GO-LANG-03: context.Context should be the first parameter
 *
 * "Functions taking a context.Context should accept it as the first parameter."
 *
 * Google Go Style Decisions §Contexts
 */
const contextFirstParam: Rule = {
    id: 'GO-LANG-03',
    name: 'context.Context should be first parameter',
    description:
        'Functions taking a context.Context should accept it as the first parameter.',
    severity: 'low',
    guideSection: '§Contexts',
    guideUrl: 'https://google.github.io/styleguide/go/decisions#contexts',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        // Match func declarations with parameters
        const pattern = /^\s*func\s+(?:\(\s*\w+\s+\*?\w+\s*\)\s+)?\w+\s*\(([^)]+)\)/;

        for (let i = 0; i < lines.length; i++) {
            const cl = searchLines[i];
            if (isSkippableLine(cl)) continue;
            const m = cl.match(pattern);
            if (m) {
                const params = m[1];
                if (/context\.Context/.test(params) && !/^\s*(?:ctx|c)\s+context\.Context/.test(params.trim())) {
                    violations.push(createViolation(this, i + 1, lines[i],
                        'context.Context is not the first parameter.',
                        'Move context.Context to be the first parameter: func Foo(ctx context.Context, ...)',
                    ));
                }
            }
        }
        return violations;
    },
};

/**
 * GO-LANG-04: Use %q for string values in error messages
 *
 * "Use %q instead of manually quoting strings with %s in error messages."
 *
 * Google Go Style Decisions §Use %q
 */
const usePercentQ: Rule = {
    id: 'GO-LANG-04',
    name: 'Use %q for string values in errors',
    description:
        'Use %q instead of manually quoting strings with \"%s\" in error messages.',
    severity: 'low',
    guideSection: '§Use %q',
    guideUrl: 'https://google.github.io/styleguide/go/decisions#use-q',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        for (let i = 0; i < lines.length; i++) {
            const cl = searchLines[i];
            if (isSkippableLine(cl)) continue;
            // Confirm fmt.Errorf exists in clean code
            if (!/fmt\.Errorf\s*\(/.test(cl)) continue;
            // Check raw line for manually quoted strings
            if (/fmt\.Errorf\s*\(.*\\"%s\\"/.test(lines[i])) {
                violations.push(createViolation(this, i + 1, lines[i],
                    'Manually quoted %s in error format string. Use %q instead.',
                    'Replace \\"%s\\" with %q for automatic quoting.',
                ));
            }
        }
        return violations;
    },
};

/**
 * GO-LANG-05: Avoid naked returns in long functions
 *
 * "Naked returns (return without arguments in a function with named
 *  return values) are acceptable only in short functions. In longer
 *  functions, be explicit about what you are returning."
 *
 * Google Go Style Decisions §Named result parameters
 */
const noNakedReturns: Rule = {
    id: 'GO-LANG-05',
    name: 'Avoid naked returns in long functions',
    description:
        'Naked returns in functions with named return values should be avoided in functions longer than a few lines.',
    severity: 'low',
    guideSection: '§Named result parameters',
    guideUrl: 'https://google.github.io/styleguide/go/decisions#named-result-parameters',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        // Find functions with named return values and check for naked returns
        const funcPattern = /^\s*func\s+(?:\(\s*\w+\s+\*?\w+\s*\)\s+)?\w+\s*\([^)]*\)\s*\(\s*\w+\s+\w+/;
        let inNamedReturnFunc = false;
        let funcStartLine = 0;
        let braceDepth = 0;

        for (let i = 0; i < lines.length; i++) {
            const cl = searchLines[i];

            if (!inNamedReturnFunc && funcPattern.test(cl)) {
                inNamedReturnFunc = true;
                funcStartLine = i;
                braceDepth = 0;
            }

            if (inNamedReturnFunc) {
                // Count braces
                for (const ch of cl) {
                    if (ch === '{') braceDepth++;
                    if (ch === '}') braceDepth--;
                }

                // Check for naked return (more than 10 lines into function)
                if (i - funcStartLine > 10 && /^\s*return\s*$/.test(cl)) {
                    violations.push(createViolation(this, i + 1, lines[i],
                        'Naked return in a long function with named return values.',
                        'Use explicit return values for clarity in longer functions.',
                    ));
                }

                if (braceDepth <= 0 && i > funcStartLine) {
                    inNamedReturnFunc = false;
                }
            }
        }
        return violations;
    },
};

/**
 * GO-LANG-06: Goroutines should use defer for cleanup
 *
 * "When spawning goroutines, make it clear when — or whether — the
 *  goroutine will exit. Goroutines can leak by blocking on channel
 *  sends or receives."
 *
 * Google Go Style Decisions §Goroutine lifetimes
 */
const goroutineDefer: Rule = {
    id: 'GO-LANG-06',
    name: 'Goroutine closures should capture loop variables safely',
    description:
        'When launching goroutines in loops, ensure loop variables are not captured by reference.',
    severity: 'medium',
    guideSection: '§Goroutine lifetimes',
    guideUrl: 'https://google.github.io/styleguide/go/decisions#goroutine-lifetimes',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        let inForLoop = false;
        let forDepth = 0;

        for (let i = 0; i < lines.length; i++) {
            const cl = searchLines[i];
            if (isSkippableLine(cl)) continue;

            if (/^\s*for\b/.test(cl)) {
                inForLoop = true;
                forDepth = 0;
            }

            if (inForLoop) {
                for (const ch of cl) {
                    if (ch === '{') forDepth++;
                    if (ch === '}') forDepth--;
                }

                // Detect go func() inside a for loop
                if (/\bgo\s+func\s*\(/.test(cl)) {
                    violations.push(createViolation(this, i + 1, lines[i],
                        'Goroutine launched with closure inside a loop.',
                        'Pass loop variables as function arguments to avoid capture-by-reference bugs.',
                    ));
                }

                if (forDepth <= 0 && i > 0) {
                    inForLoop = false;
                }
            }
        }
        return violations;
    },
};

// ============================================================================
// §DOCUMENTATION — exported doc comments, comment format, package comments
// ============================================================================

/**
 * GO-DOC-01: Exported symbols must have doc comments
 *
 * "Every exported function, type, variable, or constant must have a
 *  documentation comment."
 *
 * Google Go Style Decisions §Doc comments
 */
const exportedMustHaveDoc: Rule = {
    id: 'GO-DOC-01',
    name: 'Exported symbols must have doc comments',
    description:
        'All exported functions, types, variables, and constants must have a doc comment.',
    severity: 'medium',
    guideSection: '§Doc comments',
    guideUrl: 'https://google.github.io/styleguide/go/decisions#doc-comments',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        const exportedPattern = /^\s*(?:func|type|var|const)\s+(?:\(\s*\w+\s+\*?\w+\s*\)\s+)?([A-Z]\w*)/;

        for (let i = 0; i < lines.length; i++) {
            const cl = searchLines[i];
            if (isSkippableLine(cl)) continue;
            const m = cl.match(exportedPattern);
            if (m) {
                // Check if previous non-blank line is a comment
                let prev = i - 1;
                while (prev >= 0 && lines[prev].trim() === '') prev--;
                if (prev < 0 || !lines[prev].trim().startsWith('//')) {
                    violations.push(createViolation(this, i + 1, lines[i],
                        `Exported symbol "${m[1]}" is missing a doc comment.`,
                        `Add a comment: // ${m[1]} ...`,
                    ));
                }
            }
        }
        return violations;
    },
};

/**
 * GO-DOC-02: Doc comments must start with the symbol name
 *
 * "Doc comments for exported symbols must begin with the name of the
 *  symbol they describe."
 *
 * Google Go Style Decisions §Comment sentences
 */
const docCommentStartsWithName: Rule = {
    id: 'GO-DOC-02',
    name: 'Doc comments must start with the symbol name',
    description:
        'Doc comments for exported symbols must start with the name of the symbol.',
    severity: 'low',
    guideSection: '§Comment sentences',
    guideUrl: 'https://google.github.io/styleguide/go/decisions#comment-sentences',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        const exportedPattern = /^\s*(?:func|type|var|const)\s+(?:\(\s*\w+\s+\*?\w+\s*\)\s+)?([A-Z]\w*)/;

        for (let i = 0; i < lines.length; i++) {
            const cl = searchLines[i];
            if (isSkippableLine(cl)) continue;
            const m = cl.match(exportedPattern);
            if (m) {
                const name = m[1];
                let prev = i - 1;
                while (prev >= 0 && lines[prev].trim() === '') prev--;
                if (prev >= 0 && lines[prev].trim().startsWith('//')) {
                    const comment = lines[prev].trim().replace(/^\/\/\s*/, '');
                    if (comment && !comment.startsWith(name)) {
                        violations.push(createViolation(this, prev + 1, lines[prev],
                            `Doc comment does not start with "${name}".`,
                            `Start the comment with: // ${name} ...`,
                        ));
                    }
                }
            }
        }
        return violations;
    },
};

/**
 * GO-DOC-03: Package must have a package comment
 *
 * "Every package must have a package-level comment."
 *
 * Google Go Style Decisions §Package comments
 */
const packageComment: Rule = {
    id: 'GO-DOC-03',
    name: 'Package must have a package comment',
    description:
        'Every package must have a package comment (// Package name ...).',
    severity: 'low',
    guideSection: '§Package comments',
    guideUrl: 'https://google.github.io/styleguide/go/decisions#package-comments',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);

        for (let i = 0; i < lines.length; i++) {
            const cl = searchLines[i];
            if (/^\s*package\s+\w+/.test(cl)) {
                let prev = i - 1;
                while (prev >= 0 && lines[prev].trim() === '') prev--;
                if (prev < 0 || (!lines[prev].trim().startsWith('//') && !lines[prev].trim().startsWith('/*'))) {
                    const pkgName = cl.match(/^\s*package\s+(\w+)/)?.[1] || '';
                    violations.push(createViolation(this, i + 1, lines[i],
                        'Package declaration is missing a package comment.',
                        `Add: // Package ${pkgName} ...`,
                    ));
                }
                break;
            }
        }
        return violations;
    },
};

// ============================================================================
// EXPORT — All rules: 33 rules
// ============================================================================

export const goRules: Rule[] = [
    // §Naming
    noSnakeCaseExported,       // GO-NAME-01
    packageNameLowercase,      // GO-NAME-02
    noScreamingSnakeConstants, // GO-NAME-03
    receiverNameShort,         // GO-NAME-04
    noGetPrefix,               // GO-NAME-05
    errorVarNaming,            // GO-NAME-06
    acronymCasing,             // GO-NAME-07
    noRepetitiveNaming,        // GO-NAME-08
    errorTypeNaming,           // GO-NAME-09

    // §Imports
    noDotImport,               // GO-IMP-01
    blankImportOnlyInMain,     // GO-IMP-02
    importRenameLowercase,     // GO-IMP-03
    importGrouping,            // GO-IMP-04

    // §Errors
    errorStringLowercase,      // GO-ERR-01
    errorStringNoPunctuation,  // GO-ERR-02
    noPanic,                   // GO-ERR-03
    noDiscardedErrors,         // GO-ERR-04
    returnErrorInterface,      // GO-ERR-05

    // §Formatting
    noSemicolons,              // GO-FMT-01
    braceOnSameLine,           // GO-FMT-02
    noTrailingWhitespace,      // GO-FMT-03
    noUnnecessaryElse,         // GO-FMT-04
    noEmptyBody,               // GO-FMT-05
    lineLength,                // GO-FMT-06

    // §Language
    noInitOutsideMain,         // GO-LANG-01
    preferAnyOverEmptyInterface, // GO-LANG-02
    contextFirstParam,         // GO-LANG-03
    usePercentQ,               // GO-LANG-04
    noNakedReturns,            // GO-LANG-05
    goroutineDefer,            // GO-LANG-06

    // §Documentation
    exportedMustHaveDoc,       // GO-DOC-01
    docCommentStartsWithName,  // GO-DOC-02
    packageComment,            // GO-DOC-03
];
