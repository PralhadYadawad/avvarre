import { Rule, Violation } from '../../types.js';

/** Dart Rules — Target: Effective Dart (https://dart.dev/effective-dart) */

/** Strip comments and string literals, preserving line count. */
export function getCleanLines(lines: string[]): string[] {
    const code = lines.join('\n');
    let out = '';
    type S = 'N' | 'CS' | 'CM' | 'SS' | 'SD' | 'MS' | 'MD' | 'RS' | 'RD';
    let s: S = 'N';
    let i = 0;
    while (i < code.length) {
        const c = code[i], n = code[i + 1] || '', n2 = code[i + 2] || '';
        if (c === '\n') { out += '\n'; if (s === 'CS') s = 'N'; i++; continue; }
        switch (s) {
            case 'N':
                if (c === '/' && n === '/') { s = 'CS'; out += '  '; i += 2; }
                else if (c === '/' && n === '*') { s = 'CM'; out += '  '; i += 2; }
                else if (c === 'r' && n === "'") { s = 'RS'; out += "r'"; i += 2; }
                else if (c === 'r' && n === '"') { s = 'RD'; out += 'r"'; i += 2; }
                else if (c === "'" && n === "'" && n2 === "'") { s = 'MS'; out += "'''"; i += 3; }
                else if (c === '"' && n === '"' && n2 === '"') { s = 'MD'; out += '"""'; i += 3; }
                else if (c === "'") { s = 'SS'; out += c; i++; }
                else if (c === '"') { s = 'SD'; out += c; i++; }
                else { out += c; i++; }
                break;
            case 'CS': out += ' '; i++; break;
            case 'CM':
                if (c === '*' && n === '/') { s = 'N'; out += '  '; i += 2; }
                else { out += ' '; i++; } break;
            case 'SS':
                if (c === '\\' && n === "'") { out += '  '; i += 2; }
                else if (c === "'") { s = 'N'; out += c; i++; }
                else { out += ' '; i++; } break;
            case 'SD':
                if (c === '\\' && n === '"') { out += '  '; i += 2; }
                else if (c === '"') { s = 'N'; out += c; i++; }
                else { out += ' '; i++; } break;
            case 'MS':
                if (c === "'" && n === "'" && n2 === "'") { s = 'N'; out += "'''"; i += 3; }
                else { out += ' '; i++; } break;
            case 'MD':
                if (c === '"' && n === '"' && n2 === '"') { s = 'N'; out += '"""'; i += 3; }
                else { out += ' '; i++; } break;
            case 'RS':
                if (c === "'") { s = 'N'; out += c; i++; } else { out += ' '; i++; } break;
            case 'RD':
                if (c === '"') { s = 'N'; out += c; i++; } else { out += ' '; i++; } break;
        }
    }
    return out.split('\n');
}

const createViolation = (
    rule: Rule,
    line: number,
    message: string,
    suggestion: string,
    codeSnippet: string
): Violation => ({
    ruleId: rule.id,
    ruleName: rule.name,
    severity: rule.severity,
    line,
    message,
    suggestion,
    guideUrl: rule.guideUrl,
    codeSnippet
});
// ── DT-FMT-01: Indentation (2 spaces, no tabs) ───────────────────────
const dt_fmt_01: Rule = {
    id: 'DT-FMT-01',
    name: 'Indentation',
    description: 'Use 2 spaces for indentation. No tabs.',
    severity: 'medium',
    guideSection: '§Style',
    guideUrl: 'https://dart.dev/guides/language/effective-dart/style#formatting',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        lines.forEach((line, i) => {
            if (line.includes('\t')) {
                violations.push(createViolation(
                    dt_fmt_01,
                    i + 1,
                    'Line contains tab characters.',
                    'Replace tabs with 2 spaces.',
                    line.trim()
                ));
            }
        });
        return violations;
    }
};
// ── DT-FMT-02: Line length ───────────────────────────────────────────
const dt_fmt_02: Rule = {
    id: 'DT-FMT-02',
    name: 'Line Length',
    description: 'Lines should not exceed 80 characters.',
    severity: 'low',
    guideSection: '§Style',
    guideUrl: 'https://dart.dev/guides/language/effective-dart/style#avoid-lines-longer-than-80-characters',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        lines.forEach((line, i) => {
            if (line.length > 80) {
                violations.push(createViolation(
                    dt_fmt_02,
                    i + 1,
                    `Line exceeds 80 characters (${line.length}).`,
                    'Shorten the line or wrap it.',
                    line.trim()
                ));
            }
        });
        return violations;
    }
};
// ── DT-FMT-03: Curly braces for flow control ─────────────────────────
const dt_fmt_03: Rule = {
    id: 'DT-FMT-03',
    name: 'Braces Required',
    description: 'Use curly braces for ALL flow control statements.',
    severity: 'medium',
    guideSection: '§Style',
    guideUrl: 'https://dart.dev/guides/language/effective-dart/style#do-use-curly-braces-for-all-flow-control-statements',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        linesToUse.forEach((line, i) => {
            const trimmed = line.trim();
            if (/\b(if|for|while)\s*\(.*\)$/.test(trimmed)) {
                if (i + 1 < linesToUse.length && !linesToUse[i + 1].trim().startsWith('{') && !trimmed.endsWith('{')) {
                    violations.push(createViolation(
                        dt_fmt_03,
                        i + 1,
                        'Missing braces for control structure.',
                        'Wrap the block in curly braces.',
                        lines[i].trim()
                    ));
                }
            }
        });
        return violations;
    }
};
// ── DT-FMT-04: Opening braces on same line ───────────────────────────
const dt_fmt_04: Rule = {
    id: 'DT-FMT-04',
    name: 'Brace Placement',
    description: 'Opening braces should be on the same line as the statement.',
    severity: 'low',
    guideSection: '§Style',
    guideUrl: 'https://dart.dev/guides/language/effective-dart/style#formatting',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        linesToUse.forEach((line, i) => {
            if (line.trim() === '{' && i > 0) {
                const prev = linesToUse[i - 1].trim();
                if (prev !== '' && !prev.endsWith('{') && !prev.endsWith(';')) {
                    violations.push(createViolation(
                        dt_fmt_04,
                        i + 1,
                        'Opening brace should be on the same line.',
                        'Move the brace to the previous line.',
                        lines[i].trim()
                    ));
                }
            }
        });
        return violations;
    }
};
// ── DT-NAME-01: UpperCamelCase for types ──────────────────────────────
const dt_name_01: Rule = {
    id: 'DT-NAME-01',
    name: 'Type Naming',
    description: 'Classes, enums, typedefs, and extensions should use UpperCamelCase.',
    severity: 'medium',
    guideSection: '§Style',
    guideUrl: 'https://dart.dev/guides/language/effective-dart/style#do-name-types-using-uppercamelcase',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        linesToUse.forEach((line, i) => {
            const match = /\b(?:class|enum|mixin|extension|typedef)\s+([a-z]\w*)/.exec(line);
            if (match) {
                violations.push(createViolation(
                    dt_name_01,
                    i + 1,
                    `Type '${match[1]}' should use UpperCamelCase.`,
                    `Rename to '${match[1].charAt(0).toUpperCase() + match[1].slice(1)}'.`,
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};
// ── DT-NAME-02: lowerCamelCase for methods/variables ──────────────────
const dt_name_02: Rule = {
    id: 'DT-NAME-02',
    name: 'Member Naming',
    description: 'Methods and variables should use lowerCamelCase.',
    severity: 'medium',
    guideSection: '§Style',
    guideUrl: 'https://dart.dev/guides/language/effective-dart/style#do-name-other-identifiers-using-lowercamelcase',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        linesToUse.forEach((line, i) => {
            // Check for snake_case in function/method declarations
            const match = /^\s*(?:void|int|double|String|bool|dynamic|var|final|late)\s+([a-z]\w*_\w+)\s*[=(;]/.exec(line);
            if (match) {
                violations.push(createViolation(
                    dt_name_02,
                    i + 1,
                    `Identifier '${match[1]}' should use lowerCamelCase.`,
                    'Rename to lowerCamelCase.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};
// ── DT-NAME-03: lowercase_with_underscores for files/libraries ────────
const dt_name_03: Rule = {
    id: 'DT-NAME-03',
    name: 'File Naming',
    description: 'File and library names should use lowercase_with_underscores.',
    severity: 'medium',
    guideSection: '§Style',
    guideUrl: 'https://dart.dev/guides/language/effective-dart/style#do-name-libraries-and-source-files-using-lowercase_with_underscores',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        if (filename) {
            const base = filename.replace(/^.*[/\\]/, '').replace('.dart', '');
            if (base !== base.toLowerCase() || /[A-Z]/.test(base)) {
                violations.push(createViolation(
                    dt_name_03,
                    1,
                    `Filename '${base}.dart' should use lowercase_with_underscores.`,
                    `Rename to '${base.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '')}.dart'.`,
                    filename
                ));
            }
        }
        // Also check library directives
        const linesToUse = cleanLines || lines;
        linesToUse.forEach((line, i) => {
            const match = /^\s*library\s+([\w.]+);/.exec(line);
            if (match && /[A-Z]/.test(match[1])) {
                violations.push(createViolation(
                    dt_name_03,
                    i + 1,
                    `Library name '${match[1]}' should use lowercase_with_underscores.`,
                    'Rename the library.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};
// ── DT-NAME-04: Leading underscore for private ────────────────────────
const dt_name_04: Rule = {
    id: 'DT-NAME-04',
    name: 'Private Naming',
    description: 'A leading underscore marks members as library-private. Do not use on local variables.',
    severity: 'low',
    guideSection: '§Style',
    guideUrl: 'https://dart.dev/guides/language/effective-dart/style#identifiers',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        let inFunction = false;
        let braceDepth = 0;

        linesToUse.forEach((line, i) => {
            const trimmed = line.trim();
            // Heuristic: we're in a function body if braceDepth > 1 (class:1, method:2)
            for (const ch of trimmed) {
                if (ch === '{') braceDepth++;
                if (ch === '}') braceDepth--;
            }
            inFunction = braceDepth >= 2;

            if (inFunction) {
                const match = /^\s*(?:var|final|int|double|String|bool)\s+(_\w+)/.exec(line);
                if (match) {
                    violations.push(createViolation(
                        dt_name_04,
                        i + 1,
                        `Local variable '${match[1]}' should not have a leading underscore.`,
                        'Remove the underscore prefix.',
                        lines[i].trim()
                    ));
                }
            }
        });
        return violations;
    }
};
// ── DT-NAME-05: Constant naming ──────────────────────────────────────
const dt_name_05: Rule = {
    id: 'DT-NAME-05',
    name: 'Constant Naming',
    description: 'Prefer lowerCamelCase for constant names. Avoid SCREAMING_CAPS.',
    severity: 'low',
    guideSection: '§Style',
    guideUrl: 'https://dart.dev/guides/language/effective-dart/style#prefer-using-lowercamelcase-for-constant-names',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        linesToUse.forEach((line, i) => {
            const match = /^\s*(?:static\s+)?const\s+(?:\w+\s+)?([A-Z][A-Z0-9_]+)\s*=/.exec(line);
            if (match) {
                violations.push(createViolation(
                    dt_name_05,
                    i + 1,
                    `Constant '${match[1]}' should use lowerCamelCase.`,
                    'Prefer lowerCamelCase for constants.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};
// ── DT-IMP-01: Import ordering ───────────────────────────────────────
const dt_imp_01: Rule = {
    id: 'DT-IMP-01',
    name: 'Import Order',
    description: 'Order imports: dart:, package:, then relative.',
    severity: 'low',
    guideSection: '§Style',
    guideUrl: 'https://dart.dev/guides/language/effective-dart/style#ordering',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        // Must use raw lines since cleanLines strips string content (import paths)
        let lastImportType = 0; // 1: dart:, 2: package:, 3: relative

        lines.forEach((line, i) => {
            if (/^\s*import\s+'dart:/.test(line)) {
                if (lastImportType > 1) {
                    violations.push(createViolation(
                        dt_imp_01,
                        i + 1,
                        'dart: import should come before package: and relative imports.',
                        'Move dart: imports to the top.',
                        lines[i].trim()
                    ));
                }
                lastImportType = 1;
            } else if (/^\s*import\s+'package:/.test(line)) {
                if (lastImportType > 2) {
                    violations.push(createViolation(
                        dt_imp_01,
                        i + 1,
                        'package: import should come before relative imports.',
                        'Move package: imports above relative imports.',
                        lines[i].trim()
                    ));
                }
                lastImportType = Math.max(lastImportType, 2);
            } else if (/^\s*import\s+'/.test(line)) {
                lastImportType = Math.max(lastImportType, 3);
            }
        });
        return violations;
    }
};
// ── DT-FEAT-01: Prefer final/const ──────────────────────────────────
const dt_feat_01: Rule = {
    id: 'DT-FEAT-01',
    name: 'Prefer final/const',
    description: 'Use final for variables that are never reassigned.',
    severity: 'medium',
    guideSection: '§Usage',
    guideUrl: 'https://dart.dev/guides/language/effective-dart/usage#do-follow-a-consistent-rule-for-var-and-final-on-local-variables',
    check: (lines, filename, cleanLines) => {
        // This is best checked by AI, but we can flag obvious cases
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        linesToUse.forEach((line, i) => {
            // Flag: var x = <literal>; where it's clearly immutable
            const match = /^\s*var\s+(\w+)\s*=\s*(?:\d+|true|false|null|'[^']*'|"[^"]*")\s*;/.exec(line);
            if (match) {
                violations.push(createViolation(
                    dt_feat_01,
                    i + 1,
                    `Variable '${match[1]}' is assigned a literal. Consider using 'final'.`,
                    "Use 'final' for variables that are never reassigned.",
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};
// ── DT-FEAT-02: Prefer is! ──────────────────────────────────────────
const dt_feat_02: Rule = {
    id: 'DT-FEAT-02',
    name: 'Prefer is!',
    description: "Use 'is!' instead of '!(x is T)'.",
    severity: 'low',
    guideSection: '§Usage',
    guideUrl: 'https://dart.dev/guides/language/effective-dart/usage#dont-use-not-on-is',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        linesToUse.forEach((line, i) => {
            if (/!\(\s*\w+\s+is\s+\w+\s*\)/.test(line)) {
                violations.push(createViolation(
                    dt_feat_02,
                    i + 1,
                    "Use 'is!' instead of negating 'is'.",
                    "Rewrite as 'x is! T'.",
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};
// ── DT-ERR-01: No empty catch blocks ────────────────────────────────
const dt_err_01: Rule = {
    id: 'DT-ERR-01',
    name: 'Empty Catch Block',
    description: 'Avoid empty catch blocks.',
    severity: 'high',
    guideSection: '§Usage',
    guideUrl: 'https://dart.dev/guides/language/effective-dart/usage#avoid-empty-catch-blocks',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        linesToUse.forEach((line, i) => {
            const trimmed = line.trim();
            // catch (e) {} or on Exception {}
            if (/\bcatch\s*\(.*\)\s*\{\s*\}/.test(trimmed) || /\bon\s+\w+\s*\{\s*\}/.test(trimmed)) {
                violations.push(createViolation(
                    dt_err_01,
                    i + 1,
                    'Empty catch block detected.',
                    'Add error handling or a comment explaining why the catch is empty.',
                    lines[i].trim()
                ));
            }
            // Also check multi-line empty blocks
            if (/\bcatch\s*\(.*\)$/.test(trimmed) || /\bcatch\s*\(.*\)\s*\{$/.test(trimmed)) {
                if (i + 1 < linesToUse.length && linesToUse[i + 1].trim() === '}') {
                    violations.push(createViolation(
                        dt_err_01,
                        i + 1,
                        'Empty catch block detected.',
                        'Add error handling or a comment.',
                        lines[i].trim()
                    ));
                }
            }
        });
        return violations;
    }
};
// ── DT-DOC-01: Use /// for doc comments ─────────────────────────────
const dt_doc_01: Rule = {
    id: 'DT-DOC-01',
    name: 'Doc Comment Style',
    description: 'Use /// for documentation comments instead of /* ... */.',
    severity: 'low',
    guideSection: '§Documentation',
    guideUrl: 'https://dart.dev/guides/language/effective-dart/documentation#do-use-to-document-members-and-types',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        lines.forEach((line, i) => {
            if (/^\s*\/\*\*/.test(line) && !line.includes('*/')) {
                // Javadoc-style block comment — Dart prefers ///
                violations.push(createViolation(
                    dt_doc_01,
                    i + 1,
                    'Use /// for doc comments instead of /** ... */.',
                    'Replace with /// style comments.',
                    line.trim()
                ));
            }
        });
        return violations;
    }
};
// ── DT-FMT-05: Space after keywords ─────────────────────────────────
const dt_fmt_05: Rule = {
    id: 'DT-FMT-05',
    name: 'Keyword Spacing',
    description: 'Include a space after keywords like if, for, while, and switch.',
    severity: 'low',
    guideSection: '§Style',
    guideUrl: 'https://dart.dev/guides/language/effective-dart/style#formatting',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        linesToUse.forEach((line, i) => {
            const match = /\b(if|for|while|switch|catch)\(/.exec(line);
            if (match) {
                violations.push(createViolation(
                    dt_fmt_05,
                    i + 1,
                    `Missing space after '${match[1]}'.`,
                    `Add a space after '${match[1]}'.`,
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};
// ── DT-FEAT-03: Prefer string interpolation ─────────────────────────
const dt_feat_03: Rule = {
    id: 'DT-FEAT-03',
    name: 'String Interpolation',
    description: "Prefer string interpolation over '+' concatenation.",
    severity: 'low',
    guideSection: '§Usage',
    guideUrl: 'https://dart.dev/guides/language/effective-dart/usage#do-use-interpolation-to-compose-strings-and-values',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        // Must use raw lines: cleanLines strips string content, so concat patterns won't match
        lines.forEach((line, i) => {
            // Skip lines that are comments
            const clean = (cleanLines || getCleanLines(lines))[i];
            if (clean.trim() === '') return;
            // Detect string + variable concatenation
            if (/['"][^'"]*['"]\s*\+\s*\w+/.test(line) || /\w+\s*\+\s*['"]/.test(line)) {
                violations.push(createViolation(
                    dt_feat_03,
                    i + 1,
                    'Use string interpolation instead of concatenation.',
                    "Rewrite using '${variable}' interpolation.",
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};
// ── DT-NAME-06: No prefix letters ───────────────────────────────────
const dt_name_06: Rule = {
    id: 'DT-NAME-06',
    name: 'No Prefix Letters',
    description: "Don't use prefix letters like 'k' for constants.",
    severity: 'medium',
    guideSection: '§Style/Identifiers',
    guideUrl: 'https://dart.dev/effective-dart/style#dont-use-prefix-letters',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        linesToUse.forEach((line, i) => {
            const match = /^\s*(?:static\s+)?(?:const|final)\s+(?:\w+\s+)?(k[A-Z]\w*)\s*=/.exec(line);
            if (match) {
                violations.push(createViolation(
                    dt_name_06, i + 1,
                    `Constant '${match[1]}' uses prefix letter 'k'.`,
                    'Remove the prefix letter, use lowerCamelCase.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};
// ── DT-NAME-07: Import prefix naming ────────────────────────────────
const dt_name_07: Rule = {
    id: 'DT-NAME-07',
    name: 'Import Prefix Naming',
    description: 'Import prefixes should use lowercase_with_underscores.',
    severity: 'low',
    guideSection: '§Style/Identifiers',
    guideUrl: 'https://dart.dev/effective-dart/style#do-name-import-prefixes-using-lowercase_with_underscores',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        lines.forEach((line, i) => {
            const match = /\bimport\s+['"]\S+['"]\s+as\s+(\w+)/.exec(line);
            if (match) {
                const prefix = match[1];
                if (/[A-Z]/.test(prefix)) {
                    violations.push(createViolation(
                        dt_name_07, i + 1,
                        `Import prefix '${prefix}' should be lowercase_with_underscores.`,
                        `Rename to '${prefix.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '')}'.`,
                        lines[i].trim()
                    ));
                }
            }
        });
        return violations;
    }
};
// ── DT-NAME-08: Don't name libraries ────────────────────────────────
const dt_name_08: Rule = {
    id: 'DT-NAME-08',
    name: 'No Named Libraries',
    description: "Don't explicitly name libraries.",
    severity: 'low',
    guideSection: '§Style/Identifiers',
    guideUrl: 'https://dart.dev/effective-dart/style#dont-explicitly-name-libraries',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || getCleanLines(lines);
        linesToUse.forEach((line, i) => {
            if (/^\s*library\s+\w[\w.]*\s*;/.test(line)) {
                violations.push(createViolation(
                    dt_name_08, i + 1,
                    'Avoid explicitly naming libraries.',
                    "Remove the library name or use just 'library;'.",
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};
// ── DT-IMP-02: Exports after all imports ────────────────────────────
const dt_imp_02: Rule = {
    id: 'DT-IMP-02',
    name: 'Exports After Imports',
    description: 'Specify exports in a separate section after all imports.',
    severity: 'low',
    guideSection: '§Style/Ordering',
    guideUrl: 'https://dart.dev/effective-dart/style#do-specify-exports-in-a-separate-section-after-all-imports',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        let seenExport = false;
        lines.forEach((line, i) => {
            if (/^\s*export\s+['"]/.test(line)) seenExport = true;
            if (seenExport && /^\s*import\s+['"]/.test(line)) {
                violations.push(createViolation(
                    dt_imp_02, i + 1,
                    'Import found after an export directive.',
                    'Move all exports after imports.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};
// ── DT-IMP-03: Alphabetical imports ─────────────────────────────────
const dt_imp_03: Rule = {
    id: 'DT-IMP-03',
    name: 'Alphabetical Imports',
    description: 'Sort import sections alphabetically.',
    severity: 'low',
    guideSection: '§Style/Ordering',
    guideUrl: 'https://dart.dev/effective-dart/style#do-sort-sections-alphabetically',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        let lastImportPath = '';
        lines.forEach((line, i) => {
            const match = /^\s*import\s+['"]([^'"]+)['"]/.exec(line);
            if (match) {
                const path = match[1];
                if (lastImportPath && path < lastImportPath) {
                    violations.push(createViolation(
                        dt_imp_03, i + 1,
                        `Import '${path}' is not in alphabetical order.`,
                        'Sort imports alphabetically within each section.',
                        lines[i].trim()
                    ));
                }
                lastImportPath = path;
            } else if (line.trim() === '') {
                lastImportPath = ''; // Reset on blank line (section break)
            }
        });
        return violations;
    }
};
// ── DT-NULL-01: Don't init vars to null ─────────────────────────────
const dt_null_01: Rule = {
    id: 'DT-NULL-01',
    name: 'No Explicit Null Init',
    description: "Don't explicitly initialize variables to null.",
    severity: 'low',
    guideSection: '§Usage/Null',
    guideUrl: 'https://dart.dev/effective-dart/usage#dont-explicitly-initialize-variables-to-null',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        linesToUse.forEach((line, i) => {
            if (/\w+\?\s+\w+\s*=\s*null\s*;/.test(line)) {
                violations.push(createViolation(
                    dt_null_01, i + 1,
                    'Variable explicitly initialized to null.',
                    'Remove the = null assignment.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};
// ── DT-NULL-02: Don't use == true/false ─────────────────────────────
const dt_null_02: Rule = {
    id: 'DT-NULL-02',
    name: 'No Bool Literal Comparison',
    description: "Don't use == true or == false in equality operations.",
    severity: 'medium',
    guideSection: '§Usage/Null',
    guideUrl: 'https://dart.dev/effective-dart/usage#dont-use-true-or-false-in-equality-operations',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        linesToUse.forEach((line, i) => {
            if (/==\s*true\b/.test(line) || /==\s*false\b/.test(line)) {
                violations.push(createViolation(
                    dt_null_02, i + 1,
                    'Redundant comparison to true/false.',
                    'Remove the == true/false and use the expression directly (or with !).',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};
// ── DT-STR-01: Unnecessary ${} braces ───────────────────────────────
const dt_str_01: Rule = {
    id: 'DT-STR-01',
    name: 'Unnecessary Interpolation Braces',
    description: 'Avoid using curly braces in interpolation when not needed.',
    severity: 'low',
    guideSection: '§Usage/Strings',
    guideUrl: 'https://dart.dev/effective-dart/usage#avoid-using-curly-braces-in-interpolation-when-not-needed',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        lines.forEach((line, i) => {
            // Match ${simpleIdentifier} where $simpleIdentifier would suffice
            const matches = line.matchAll(/\$\{([a-zA-Z_]\w*)\}/g);
            for (const match of matches) {
                // Check if the character after } is alphanumeric (then braces are needed)
                const endIdx = line.indexOf(match[0]) + match[0].length;
                const charAfter = line[endIdx] || '';
                if (!/[a-zA-Z0-9_]/.test(charAfter)) {
                    violations.push(createViolation(
                        dt_str_01, i + 1,
                        `Unnecessary braces in '\${${match[1]}}'. Use '\$${match[1]}' instead.`,
                        'Remove the curly braces.',
                        lines[i].trim()
                    ));
                    break; // One per line
                }
            }
        });
        return violations;
    }
};
// ── DT-COL-01: Use collection literals ──────────────────────────────
const dt_col_01: Rule = {
    id: 'DT-COL-01',
    name: 'Collection Literals',
    description: 'Use collection literals when possible instead of constructors.',
    severity: 'medium',
    guideSection: '§Usage/Collections',
    guideUrl: 'https://dart.dev/effective-dart/usage#do-use-collection-literals-when-possible',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        linesToUse.forEach((line, i) => {
            if (/\b(Map|Set)\s*(<[^>]*>)?\s*\(\s*\)/.test(line) || /\bnew\s+(Map|Set|List)\s*[<(]/.test(line)) {
                violations.push(createViolation(
                    dt_col_01, i + 1,
                    'Use collection literals ({}, [], {}) instead of constructors.',
                    'Replace with a collection literal.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};
// ── DT-COL-02: Use isEmpty/isNotEmpty ───────────────────────────────
const dt_col_02: Rule = {
    id: 'DT-COL-02',
    name: 'Use isEmpty/isNotEmpty',
    description: "Don't use .length to check if a collection is empty.",
    severity: 'medium',
    guideSection: '§Usage/Collections',
    guideUrl: 'https://dart.dev/effective-dart/usage#dont-use-length-to-see-if-a-collection-is-empty',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        linesToUse.forEach((line, i) => {
            if (/\.length\s*==\s*0/.test(line) || /\.length\s*>\s*0/.test(line) || /\.length\s*!=\s*0/.test(line)) {
                violations.push(createViolation(
                    dt_col_02, i + 1,
                    'Use .isEmpty or .isNotEmpty instead of .length comparison.',
                    'Replace with .isEmpty or .isNotEmpty.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};
// ── DT-COL-03: Avoid forEach with lambda ────────────────────────────
const dt_col_03: Rule = {
    id: 'DT-COL-03',
    name: 'Avoid forEach Lambda',
    description: 'Avoid using Iterable.forEach() with a function literal.',
    severity: 'low',
    guideSection: '§Usage/Collections',
    guideUrl: 'https://dart.dev/effective-dart/usage#avoid-using-iterable-foreach-with-a-function-literal',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        linesToUse.forEach((line, i) => {
            if (/\.forEach\s*\(\s*\(/.test(line)) {
                violations.push(createViolation(
                    dt_col_03, i + 1,
                    'Avoid .forEach() with a function literal.',
                    'Use a for-in loop instead.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};
// ── DT-FUNC-01: Function declarations over lambdas ──────────────────
const dt_func_01: Rule = {
    id: 'DT-FUNC-01',
    name: 'Function Declaration',
    description: 'Use a function declaration to bind a function to a name.',
    severity: 'low',
    guideSection: '§Usage/Functions',
    guideUrl: 'https://dart.dev/effective-dart/usage#do-use-a-function-declaration-to-bind-a-function-to-a-name',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        linesToUse.forEach((line, i) => {
            if (/^\s*(?:var|final)\s+\w+\s*=\s*\(.*\)\s*(=>|\{)/.test(line)) {
                violations.push(createViolation(
                    dt_func_01, i + 1,
                    'Use a function declaration instead of assigning a lambda to a variable.',
                    'Replace with a named function declaration.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};
// ── DT-MEM-01: Unnecessary this. ────────────────────────────────────
const dt_mem_01: Rule = {
    id: 'DT-MEM-01',
    name: 'Unnecessary this',
    description: "Don't use this. except to redirect to a named constructor or avoid shadowing.",
    severity: 'low',
    guideSection: '§Usage/Members',
    guideUrl: 'https://dart.dev/effective-dart/usage#dont-use-this-when-not-needed-to-avoid-shadowing',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || getCleanLines(lines);
        linesToUse.forEach((line, i) => {
            // Flag this.x usage outside of constructors and initializer lists
            if (/\bthis\.\w+/.test(line)) {
                const trimmed = line.trim();
                // Skip constructor parameter shorthand: MyClass(this.field) or {required this.field}
                if (/\bthis\.\w+\s*[,)}]/.test(trimmed) && /[({]/.test(trimmed)) return;
                // Skip initializer lists (lines with : before this)
                if (/^\s*:.*\bthis\./.test(line)) return;
                // Skip constructor declarations with this. params
                if (/\(.*\bthis\./.test(trimmed)) return;
                violations.push(createViolation(
                    dt_mem_01, i + 1,
                    "Unnecessary 'this.' qualifier.",
                    "Remove 'this.' unless needed to avoid shadowing.",
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};
// ── DT-CTOR-01: Don't use new ───────────────────────────────────────
const dt_ctor_01: Rule = {
    id: 'DT-CTOR-01',
    name: "Don't Use new",
    description: "The new keyword is deprecated. Don't use it.",
    severity: 'medium',
    guideSection: '§Usage/Constructors',
    guideUrl: 'https://dart.dev/effective-dart/usage#dont-use-new',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        linesToUse.forEach((line, i) => {
            if (/\bnew\s+[A-Z]/.test(line)) {
                violations.push(createViolation(
                    dt_ctor_01, i + 1,
                    "Don't use the 'new' keyword.",
                    "Remove 'new' — it is optional and deprecated.",
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};
// ── DT-CTOR-02: Use ; for empty constructor bodies ──────────────────
const dt_ctor_02: Rule = {
    id: 'DT-CTOR-02',
    name: 'Empty Constructor Body',
    description: 'Use ; instead of {} for empty constructor bodies.',
    severity: 'low',
    guideSection: '§Usage/Constructors',
    guideUrl: 'https://dart.dev/effective-dart/usage#do-use-instead-of-for-empty-constructor-bodies',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        linesToUse.forEach((line, i) => {
            // Match constructor pattern ending with {}
            if (/^\s*\w+\s*\(.*\)\s*\{\s*\}\s*$/.test(line)) {
                violations.push(createViolation(
                    dt_ctor_02, i + 1,
                    'Use ; instead of {} for empty constructor bodies.',
                    'Replace {} with ;',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};
// ── DT-ERR-02: Catch without on clause ──────────────────────────────
const dt_err_02: Rule = {
    id: 'DT-ERR-02',
    name: 'Catch Without on',
    description: 'Avoid catches without on clauses.',
    severity: 'medium',
    guideSection: '§Usage/Error handling',
    guideUrl: 'https://dart.dev/effective-dart/usage#avoid-catches-without-on-clauses',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        linesToUse.forEach((line, i) => {
            // Match } catch ( without a preceding on keyword on same line
            if (/\}\s*catch\s*\(/.test(line) && !/\bon\s+\w+/.test(line)) {
                violations.push(createViolation(
                    dt_err_02, i + 1,
                    'Catch clause without an on type filter.',
                    'Add an on clause to specify the exception type.',
                    lines[i].trim()
                ));
            }
            // Also match standalone catch at start
            if (/^\s*catch\s*\(/.test(line) && !/\bon\s+\w+/.test(line)) {
                violations.push(createViolation(
                    dt_err_02, i + 1,
                    'Catch clause without an on type filter.',
                    'Add an on clause to specify the exception type.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};
// ── DT-ERR-03: Use rethrow ─────────────────────────────────────────
const dt_err_03: Rule = {
    id: 'DT-ERR-03',
    name: 'Use rethrow',
    description: "Use rethrow to rethrow a caught exception, not 'throw e'.",
    severity: 'low',
    guideSection: '§Usage/Error handling',
    guideUrl: 'https://dart.dev/effective-dart/usage#do-use-rethrow-to-rethrow-a-caught-exception',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        let catchBraceDepth = -1; // -1 = not in catch
        let braceDepth = 0;
        linesToUse.forEach((line, i) => {
            const trimmed = line.trim();
            // Detect catch and record brace depth at that point
            if (/\bcatch\s*\(/.test(trimmed)) {
                // Count opening braces on this line to set the catch depth
                const opens = (trimmed.match(/\{/g) || []).length;
                const closes = (trimmed.match(/\}/g) || []).length;
                braceDepth += opens - closes;
                catchBraceDepth = braceDepth;
                return;
            }

            const opens = (trimmed.match(/\{/g) || []).length;
            const closes = (trimmed.match(/\}/g) || []).length;

            // Check for throw within catch block before updating depth
            if (catchBraceDepth >= 0 && /\bthrow\s+\w+\s*;/.test(trimmed)) {
                violations.push(createViolation(
                    dt_err_03, i + 1,
                    "Use 'rethrow' instead of 'throw e'.",
                    "Replace 'throw e;' with 'rethrow;'.",
                    lines[i].trim()
                ));
            }

            braceDepth += opens - closes;
            // Exit catch block when depth drops below catch entry depth
            if (catchBraceDepth >= 0 && braceDepth < catchBraceDepth) {
                catchBraceDepth = -1;
            }
        });
        return violations;
    }
};
// ── DT-DOC-02: No block comments for docs ───────────────────────────
const dt_doc_02: Rule = {
    id: 'DT-DOC-02',
    name: 'No Block Comments',
    description: "Don't use block comments (/* */) for documentation.",
    severity: 'low',
    guideSection: '§Documentation/Comments',
    guideUrl: 'https://dart.dev/effective-dart/documentation#dont-use-block-comments-for-documentation',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        lines.forEach((line, i) => {
            // Flag /* that isn't /** (doc comments caught by DT-DOC-01)
            if (/^\s*\/\*[^*]/.test(line) && !line.includes('*/')) {
                violations.push(createViolation(
                    dt_doc_02, i + 1,
                    "Don't use block comments (/* */) for documentation.",
                    'Use // for single-line comments.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};
// ── DT-COL-04: Use whereType() ──────────────────────────────────────
const dt_col_04: Rule = {
    id: 'DT-COL-04',
    name: 'Use whereType',
    description: 'Use whereType() to filter a collection by type instead of where(... is ...).',
    severity: 'low',
    guideSection: '§Usage/Collections',
    guideUrl: 'https://dart.dev/effective-dart/usage#do-use-wheretype-to-filter-a-collection-by-type',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        linesToUse.forEach((line, i) => {
            if (/\.where\s*\(\s*\(.*\)\s*=>\s*\w+\s+is\s+/.test(line)) {
                violations.push(createViolation(
                    dt_col_04, i + 1,
                    'Use .whereType<T>() instead of .where((e) => e is T).',
                    'Replace with .whereType<T>().',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};
// ── DT-COL-05: Avoid .cast() ────────────────────────────────────────
const dt_col_05: Rule = {
    id: 'DT-COL-05',
    name: 'Avoid cast()',
    description: 'Avoid using .cast<T>() on collections.',
    severity: 'low',
    guideSection: '§Usage/Collections',
    guideUrl: 'https://dart.dev/effective-dart/usage#avoid-using-cast',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        linesToUse.forEach((line, i) => {
            if (/\.cast\s*<[^>]*>\s*\(/.test(line)) {
                violations.push(createViolation(
                    dt_col_05, i + 1,
                    'Avoid using .cast<T>(). Create with the right type or use List.from().',
                    'Remove .cast() and use a typed constructor or List<T>.from().',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};
// ── DT-DSGN-01: No get prefix on methods ────────────────────────────
const dt_dsgn_01: Rule = {
    id: 'DT-DSGN-01',
    name: 'No get Prefix',
    description: 'Avoid starting a method name with get. Use a getter or a more descriptive verb.',
    severity: 'low',
    guideSection: '§Design/Names',
    guideUrl: 'https://dart.dev/effective-dart/design#avoid-starting-a-method-name-with-get',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        linesToUse.forEach((line, i) => {
            // Match method declarations starting with get (not getter syntax)
            if (/^\s*\w+[\s<].*\bget[A-Z]\w*\s*\(/.test(line) && !/^\s*\w+\s+get\s+\w+/.test(line)) {
                violations.push(createViolation(
                    dt_dsgn_01, i + 1,
                    "Avoid starting method names with 'get'. Use a getter or a more descriptive verb.",
                    'Rename the method: drop get, use a noun phrase, or a more specific verb.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};
// ── DT-DSGN-02: Don't return this ───────────────────────────────────
const dt_dsgn_02: Rule = {
    id: 'DT-DSGN-02',
    name: "Don't Return this",
    description: "Avoid returning this from methods just to enable a fluent interface. Use cascades.",
    severity: 'low',
    guideSection: '§Design/Members',
    guideUrl: 'https://dart.dev/effective-dart/design#avoid-returning-this-from-methods-just-to-enable-a-fluent-interface',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        linesToUse.forEach((line, i) => {
            if (/\breturn\s+this\s*;/.test(line)) {
                violations.push(createViolation(
                    dt_dsgn_02, i + 1,
                    "Avoid 'return this;'. Use cascade notation (..) instead.",
                    'Let callers use cascade notation instead of fluent returns.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};
// ── DT-DSGN-03: No public late final without init ───────────────────
const dt_dsgn_03: Rule = {
    id: 'DT-DSGN-03',
    name: 'No Public late final',
    description: 'Avoid public late final fields without initializers.',
    severity: 'medium',
    guideSection: '§Design/Members',
    guideUrl: 'https://dart.dev/effective-dart/design#avoid-public-late-final-fields-without-initializers',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        linesToUse.forEach((line, i) => {
            // Match: late final Type name; (no = initializer, no _ prefix)
            if (/^\s*late\s+final\s+\w+\s+([a-zA-Z]\w*)\s*;/.test(line)) {
                const match = /^\s*late\s+final\s+\w+\s+([a-zA-Z]\w*)\s*;/.exec(line);
                if (match && !match[1].startsWith('_')) {
                    violations.push(createViolation(
                        dt_dsgn_03, i + 1,
                        `Public 'late final' field '${match[1]}' has no initializer.`,
                        'Make it private, add an initializer, or use a different pattern.',
                        lines[i].trim()
                    ));
                }
            }
        });
        return violations;
    }
};
// ── DT-TYPE-01: No legacy typedef ───────────────────────────────────
const dt_type_01: Rule = {
    id: 'DT-TYPE-01',
    name: 'No Legacy typedef',
    description: "Don't use the legacy typedef syntax.",
    severity: 'medium',
    guideSection: '§Design/Types',
    guideUrl: 'https://dart.dev/effective-dart/design#dont-use-the-legacy-typedef-syntax',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        linesToUse.forEach((line, i) => {
            // Legacy: typedef ReturnType Name(params) — no = sign
            if (/^\s*typedef\s+\w+\s+\w+\s*\(/.test(line) && !/=/.test(line)) {
                violations.push(createViolation(
                    dt_type_01, i + 1,
                    'Use the new typedef syntax: typedef Name = ReturnType Function(...).',
                    'Rewrite using the modern typedef syntax with =.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};
// ── DT-TYPE-02: No return type on setters ───────────────────────────
const dt_type_02: Rule = {
    id: 'DT-TYPE-02',
    name: 'No Setter Return Type',
    description: "Don't specify a return type for a setter.",
    severity: 'low',
    guideSection: '§Design/Types',
    guideUrl: 'https://dart.dev/effective-dart/design#dont-specify-a-return-type-for-a-setter',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        linesToUse.forEach((line, i) => {
            // Match: void set foo(...) or other type before set
            if (/^\s*void\s+set\s+\w+/.test(line)) {
                violations.push(createViolation(
                    dt_type_02, i + 1,
                    "Don't specify a return type for setters. Remove 'void'.",
                    "Remove 'void' — setters always return void implicitly.",
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};
// ── DT-TYPE-03: Avoid dynamic ───────────────────────────────────────
const dt_type_03: Rule = {
    id: 'DT-TYPE-03',
    name: 'Avoid dynamic',
    description: 'Avoid using dynamic unless you want to disable static checking.',
    severity: 'medium',
    guideSection: '§Design/Types',
    guideUrl: 'https://dart.dev/effective-dart/design#avoid-using-dynamic-unless-you-want-to-disable-static-checking',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        linesToUse.forEach((line, i) => {
            // Match dynamic as a type annotation in declarations / params
            // cleanLines already strips comments, so no need for comment check
            if (/\bdynamic\b/.test(line)) {
                // Avoid flagging Map<String, dynamic> JSON patterns (common legitimate use)
                if (!/Map\s*<\s*String\s*,\s*dynamic\s*>/.test(line)) {
                    violations.push(createViolation(
                        dt_type_03, i + 1,
                        "Avoid using 'dynamic'. Use Object? or a specific type instead.",
                        'Replace dynamic with Object? or a more specific type.',
                        lines[i].trim()
                    ));
                }
            }
        });
        return violations;
    }
};
// ── DT-TYPE-04: Use Future<void> not Future<Null> ───────────────────
const dt_type_04: Rule = {
    id: 'DT-TYPE-04',
    name: 'Future<void> not Future<Null>',
    description: 'Use Future<void> as the return type, not Future<Null>.',
    severity: 'medium',
    guideSection: '§Design/Types',
    guideUrl: 'https://dart.dev/effective-dart/design#do-use-futurevoid-as-the-return-type-of-asynchronous-members-that-do-not-produce-values',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        linesToUse.forEach((line, i) => {
            if (/\bFuture\s*<\s*Null\s*>/.test(line)) {
                violations.push(createViolation(
                    dt_type_04, i + 1,
                    "Use Future<void> instead of Future<Null>.",
                    'Replace Future<Null> with Future<void>.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};
// ── DT-EQ-01: Override hashCode with == ─────────────────────────────
const dt_eq_01: Rule = {
    id: 'DT-EQ-01',
    name: 'Override hashCode with ==',
    description: 'Always override hashCode if you override ==.',
    severity: 'high',
    guideSection: '§Design/Equality',
    guideUrl: 'https://dart.dev/effective-dart/design#do-override-hashcode-if-you-override',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        const content = linesToUse.join('\n');
        // Check if there's operator == but no hashCode override
        const hasOperatorEq = /\boperator\s*==/.test(content);
        const hasHashCode = /\bget\s+hashCode\b|\bhashCode\s*=>|\bint\s+get\s+hashCode/.test(content);
        if (hasOperatorEq && !hasHashCode) {
            // Find the line with operator ==
            linesToUse.forEach((line, i) => {
                if (/\boperator\s*==/.test(line)) {
                    violations.push(createViolation(
                        dt_eq_01, i + 1,
                        'Class overrides == but does not override hashCode.',
                        'Add a hashCode getter that is consistent with your == operator.',
                        lines[i].trim()
                    ));
                }
            });
        }
        return violations;
    }
};
// ── DT-DOC-03: Doc comments before metadata ────────────────────────
const dt_doc_03: Rule = {
    id: 'DT-DOC-03',
    name: 'Doc Before Metadata',
    description: 'Put doc comments before metadata annotations.',
    severity: 'low',
    guideSection: '§Documentation',
    guideUrl: 'https://dart.dev/effective-dart/documentation#do-put-doc-comments-before-metadata-annotations',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        lines.forEach((line, i) => {
            // If a doc comment appears after an annotation
            if (/^\s*\/\/\//.test(line) && i > 0 && /^\s*@\w+/.test(lines[i - 1])) {
                violations.push(createViolation(
                    dt_doc_03, i + 1,
                    'Doc comment should come before metadata annotations.',
                    'Move the /// comment above the @annotation.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};
// §Documentation/Summary sentence -- deferred to AI deep review layer
// ── DT-FEAT-04: Prefer ?? over ternary for null ────────────────────
const dt_feat_04: Rule = {
    id: 'DT-FEAT-04',
    name: 'Prefer ?? Operator',
    description: 'Use ?? instead of ternary null checks.',
    severity: 'low',
    guideSection: '§Usage',
    guideUrl: 'https://dart.dev/effective-dart/usage#prefer-using-to-convert-null-to-a-boolean-value',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || getCleanLines(lines);
        linesToUse.forEach((line, i) => {
            // Detect: x != null ? x : default  or  x == null ? default : x
            if (/\w+\s*!=\s*null\s*\?\s*\w+\s*:/.test(line) || /\w+\s*==\s*null\s*\?/.test(line)) {
                violations.push(createViolation(
                    dt_feat_04, i + 1,
                    'Use the ?? operator instead of a null ternary check.',
                    'Rewrite as: value ?? defaultValue',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};
// §Usage/Strings: Use adjacent strings to concatenate -- deferred to AI deep review layer
// ── DT-ASYNC-01: Use async/await over raw futures ──────────────────
const dt_async_01: Rule = {
    id: 'DT-ASYNC-01',
    name: 'Prefer async/await',
    description: 'Prefer async/await over using raw futures with .then().',
    severity: 'low',
    guideSection: '§Usage/Asynchrony',
    guideUrl: 'https://dart.dev/effective-dart/usage#prefer-asyncawait-over-using-raw-futures',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || getCleanLines(lines);
        linesToUse.forEach((line, i) => {
            if (/\.then\s*\(/.test(line)) {
                violations.push(createViolation(
                    dt_async_01, i + 1,
                    'Prefer async/await over .then() chains.',
                    'Refactor to use async/await for better readability.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};
// §Usage/Asynchrony: Avoid Completer directly -- deferred to AI deep review layer
// §Design/Members: Avoid returning null from bool -- deferred to AI deep review layer
// §Design/Members: Prefer public final field over private+getter -- deferred to AI deep review layer
// ── DT-TYPE-05: Annotate public APIs ────────────────────────────────
const dt_type_05: Rule = {
    id: 'DT-TYPE-05',
    name: 'Type Annotate Public APIs',
    description: 'Type annotate fields and top-level variables for public APIs.',
    severity: 'medium',
    guideSection: '§Design/Types',
    guideUrl: 'https://dart.dev/effective-dart/design#do-type-annotate-fields-and-top-level-variables-if-the-type-isnt-obvious',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || getCleanLines(lines);
        linesToUse.forEach((line, i) => {
            // Flag top-level or class-level `var x = ...` without a type (public, no underscore)
            const match = /^\s*var\s+([a-zA-Z]\w*)\s*=/.exec(line);
            if (match && !match[1].startsWith('_')) {
                // Only flag top-level (0 indent) or class-level (2 indent) vars
                if (/^(?:\s{0,2})var\s/.test(line)) {
                    violations.push(createViolation(
                        dt_type_05, i + 1,
                        `Public variable '${match[1]}' should have an explicit type annotation.`,
                        'Add a type annotation instead of using var.',
                        lines[i].trim()
                    ));
                }
            }
        });
        return violations;
    }
};
// §Design/Types: Don't redundantly type annotate locals -- deferred to AI deep review layer
// ── DT-CTOR-03: Use initializing formals ────────────────────────────
const dt_ctor_03: Rule = {
    id: 'DT-CTOR-03',
    name: 'Use Initializing Formals',
    description: 'Use initializing formals when possible instead of assigning in the body.',
    severity: 'low',
    guideSection: '§Usage/Constructors',
    guideUrl: 'https://dart.dev/effective-dart/usage#do-use-initializing-formals-when-possible',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || getCleanLines(lines);
        linesToUse.forEach((line, i) => {
            // Detect: this.field = field; in a constructor body
            const match = /^\s*this\.(\w+)\s*=\s*(\w+)\s*;/.exec(line);
            if (match && match[1] === match[2]) {
                violations.push(createViolation(
                    dt_ctor_03, i + 1,
                    `Use an initializing formal: 'this.${match[1]}' in the constructor parameter list.`,
                    `Move 'this.${match[1]}' to the constructor parameters.`,
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};
// §Usage/Collections: Prefer for-in over indexed loops -- deferred to AI deep review layer
// §Design/Parameters: Avoid positional boolean parameters -- deferred to AI deep review layer
// §Documentation/Writing doc comments -- deferred to AI deep review layer
// §Design/Libraries -- deferred to AI deep review layer
// §Design/Classes (prefer mixin, avoid extends) -- deferred to AI deep review layer
// §Usage/Variables (DO follow consistent rule for var and final) -- partially covered by DT-FEAT-01

export const dartRules: Rule[] = [
    dt_fmt_01,
    dt_fmt_02,
    dt_fmt_03,
    dt_fmt_04,
    dt_fmt_05,
    dt_name_01,
    dt_name_02,
    dt_name_03,
    dt_name_04,
    dt_name_05,
    dt_name_06,
    dt_name_07,
    dt_name_08,
    dt_imp_01,
    dt_imp_02,
    dt_imp_03,
    dt_null_01,
    dt_null_02,
    dt_str_01,
    dt_col_01,
    dt_col_02,
    dt_col_03,
    dt_col_04,
    dt_col_05,
    dt_func_01,
    dt_mem_01,
    dt_ctor_01,
    dt_ctor_02,
    dt_ctor_03,
    dt_feat_01,
    dt_feat_02,
    dt_feat_03,
    dt_feat_04,
    dt_err_01,
    dt_err_02,
    dt_err_03,
    dt_doc_01,
    dt_doc_02,
    dt_doc_03,
    dt_dsgn_01,
    dt_dsgn_02,
    dt_dsgn_03,
    dt_type_01,
    dt_type_02,
    dt_type_03,
    dt_type_04,
    dt_type_05,
    dt_async_01,
    dt_eq_01
];
