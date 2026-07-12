import { Rule, Violation, Language } from '../../types.js';

/**
 * C# Rules Module for avvarre.
 *
 * Target: Google C# Style Guide (https://google.github.io/styleguide/csharp-style.html)
 */

/**
 * Strip string literals and comments from C# source while preserving
 * line count and positions.
 */
export function getCleanLines(lines: string[]): string[] {
    const code = lines.join('\n');
    let cleanCode = '';

    type State = 'NORMAL' | 'COMMENT_S' | 'COMMENT_M' | 'STRING' | 'VERBATIM_STRING' | 'CHAR';
    let state: State = 'NORMAL';
    let i = 0;

    while (i < code.length) {
        const char = code[i];
        const nextChar = code[i + 1] || '';

        // Preserve newlines to keep line count stable
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
                } else if (char === '@' && nextChar === '"') {
                    state = 'VERBATIM_STRING';
                    cleanCode += '@@';
                    i += 2;
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
                if (char === '\\' && nextChar === '"') {
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

            case 'VERBATIM_STRING':
                if (char === '"' && nextChar === '"') {
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
                if (char === '\\' && nextChar === "'") {
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
        }
    }

    return cleanCode.split('\n');
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

// ── §Whitespace / Formatting Rules ─────────────────────────────────────────

/** CS-FMT-01: No tabs allowed */
const cs_fmt_01: Rule = {
    id: 'CS-FMT-01',
    name: 'No Tabs',
    description: 'Use spaces for indentation. Tabs are not allowed.',
    severity: 'medium',
    guideSection: '§Whitespace rules',
    guideUrl: 'https://google.github.io/styleguide/csharp-style.html#whitespace-rules',
    check: (lines, _filename, _cleanLines) => {
        // Whitespace rule: intentionally uses raw lines
        const violations: Violation[] = [];
        lines.forEach((line, i) => {
            if (line.includes('\t')) {
                violations.push(createViolation(
                    cs_fmt_01,
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

/** CS-FMT-02: 100-character column limit */
const cs_fmt_02: Rule = {
    id: 'CS-FMT-02',
    name: 'Column Limit',
    description: 'Lines should not exceed 100 characters.',
    severity: 'low',
    guideSection: '§Whitespace rules',
    guideUrl: 'https://google.github.io/styleguide/csharp-style.html#whitespace-rules',
    check: (lines, _filename, _cleanLines) => {
        // Whitespace rule: intentionally uses raw lines
        const violations: Violation[] = [];
        lines.forEach((line, i) => {
            if (line.length > 100) {
                violations.push(createViolation(
                    cs_fmt_02,
                    i + 1,
                    `Line exceeds 100 characters (${line.length}).`,
                    'Shorten the line or wrap it.',
                    line.trim()
                ));
            }
        });
        return violations;
    }
};

/** CS-FMT-03: Opening braces on the same line */
const cs_fmt_03: Rule = {
    id: 'CS-FMT-03',
    name: 'Brace Placement',
    description: 'Opening braces should be on the same line as the statement (no line break before opening brace).',
    severity: 'low',
    guideSection: '§Whitespace rules',
    guideUrl: 'https://google.github.io/styleguide/csharp-style.html#whitespace-rules',
    check: (lines, _filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            if (line.trim() === '{' && i > 0) {
                const prev = searchLines[i - 1].trim();
                // Only flag if the previous line is a statement (not empty, not another brace,
                // not a comment-only line, not an attribute)
                if (prev !== '' && !prev.endsWith('{') && !prev.endsWith(',')
                    && !prev.startsWith('[') && prev !== '}') {
                    violations.push(createViolation(
                        cs_fmt_03,
                        i + 1,
                        'Opening brace should be on the same line as the statement.',
                        'Move the brace to the previous line.',
                        lines[i].trim()
                    ));
                }
            }
        });
        return violations;
    }
};

/** CS-FMT-04: Braces required even when optional */
const cs_fmt_04: Rule = {
    id: 'CS-FMT-04',
    name: 'Braces Required',
    description: 'Braces should always be used, even when optional.',
    severity: 'medium',
    guideSection: '§Whitespace rules',
    guideUrl: 'https://google.github.io/styleguide/csharp-style.html#whitespace-rules',
    check: (lines, _filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            const trimmed = line.trim();
            if (/\b(if|for|while|foreach)\s*\(.*\)$/.test(trimmed)) {
                if (i + 1 < searchLines.length && !searchLines[i + 1].trim().startsWith('{') && !trimmed.endsWith('{')) {
                    violations.push(createViolation(
                        cs_fmt_04,
                        i + 1,
                        'Missing braces for control structure.',
                        'Wrap the block in braces.',
                        lines[i].trim()
                    ));
                }
            }
        });
        return violations;
    }
};

/** CS-FMT-05: Space after keywords */
const cs_fmt_05: Rule = {
    id: 'CS-FMT-05',
    name: 'Keyword Spacing',
    description: 'Include a space after keywords like if, for, while, and switch.',
    severity: 'low',
    guideSection: '§Whitespace rules',
    guideUrl: 'https://google.github.io/styleguide/csharp-style.html#whitespace-rules',
    check: (lines, _filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            const match = /\b(if|for|while|switch|foreach)\(/.exec(line);
            if (match) {
                violations.push(createViolation(
                    cs_fmt_05,
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

/** CS-FMT-06: One statement per line */
const cs_fmt_06: Rule = {
    id: 'CS-FMT-06',
    name: 'One Statement Per Line',
    description: 'A maximum of one statement per line.',
    severity: 'medium',
    guideSection: '§Whitespace rules',
    guideUrl: 'https://google.github.io/styleguide/csharp-style.html#whitespace-rules',
    check: (lines, _filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            const trimmed = line.trim();
            if (/^for\s*\(/.test(trimmed)) return;
            const semicolonCount = (line.match(/;/g) || []).length;
            if (semicolonCount >= 2) {
                violations.push(createViolation(
                    cs_fmt_06,
                    i + 1,
                    'Multiple statements on one line detected.',
                    'Place each statement on its own line.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

/** CS-FMT-07: Space after commas */
const cs_fmt_07: Rule = {
    id: 'CS-FMT-07',
    name: 'Space After Comma',
    description: 'A space must follow each comma in argument lists, parameter lists, and array initializers.',
    severity: 'low',
    guideSection: '§Whitespace rules',
    guideUrl: 'https://google.github.io/styleguide/csharp-style.html#whitespace-rules',
    check: (lines, _filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            if (/,[^ \n\r]/.test(line)) {
                violations.push(createViolation(
                    cs_fmt_07,
                    i + 1,
                    'Missing space after comma.',
                    'Add a space after each comma.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

/** CS-FMT-08: No line break between closing brace and else */
const cs_fmt_08: Rule = {
    id: 'CS-FMT-08',
    name: 'Else on Same Line as Brace',
    description: 'No line break between closing brace and else/else if/catch/finally.',
    severity: 'low',
    guideSection: '§Whitespace rules',
    guideUrl: 'https://google.github.io/styleguide/csharp-style.html#whitespace-rules',
    check: (lines, _filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            const trimmed = line.trim();
            // Line starts with else/catch/finally but previous line ends with }
            if (/^(else|catch|finally)\b/.test(trimmed) && i > 0) {
                const prevTrimmed = searchLines[i - 1].trim();
                if (prevTrimmed === '}') {
                    violations.push(createViolation(
                        cs_fmt_08,
                        i + 1,
                        `'${trimmed.split(/\s/)[0]}' should be on the same line as the closing brace.`,
                        `Place '} ${trimmed.split(/\s/)[0]}' on one line.`,
                        lines[i].trim()
                    ));
                }
            }
        });
        return violations;
    }
};

/** CS-FMT-09: No space after opening paren or before closing paren */
const cs_fmt_09: Rule = {
    id: 'CS-FMT-09',
    name: 'No Paren Padding',
    description: 'No space after an opening parenthesis or before a closing parenthesis.',
    severity: 'low',
    guideSection: '§Whitespace rules',
    guideUrl: 'https://google.github.io/styleguide/csharp-style.html#whitespace-rules',
    check: (lines, _filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            // "( " at start of parens or " )" at end -- but not empty parens "()"
            if (/\(\s+[^ )]/.test(line) || /[^ (]\s+\)/.test(line)) {
                // Exclude lines that are just continuation/wrapping (common in long arg lists)
                const trimmed = line.trim();
                if (!trimmed.startsWith(')') && !trimmed.endsWith('(')) {
                    violations.push(createViolation(
                        cs_fmt_09,
                        i + 1,
                        'No space after opening parenthesis or before closing parenthesis.',
                        'Remove padding spaces inside parentheses.',
                        lines[i].trim()
                    ));
                }
            }
        });
        return violations;
    }
};

/** CS-FMT-10: One assignment per statement */
const cs_fmt_10: Rule = {
    id: 'CS-FMT-10',
    name: 'One Assignment Per Statement',
    description: 'A maximum of one assignment per statement.',
    severity: 'medium',
    guideSection: '§Whitespace rules',
    guideUrl: 'https://google.github.io/styleguide/csharp-style.html#whitespace-rules',
    check: (lines, _filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            const trimmed = line.trim();
            // Skip declarations, for loops, and property accessors
            if (/^for\s*\(/.test(trimmed)) return;
            // Count standalone = signs (not ==, !=, <=, >=, =>)
            const assignments = trimmed.match(/(?<![=!<>])=(?!=|>)/g);
            if (assignments && assignments.length >= 2) {
                violations.push(createViolation(
                    cs_fmt_10,
                    i + 1,
                    'Multiple assignments on one line. Use one assignment per statement.',
                    'Split into separate statements.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

// ── §Naming Rules ──────────────────────────────────────────────────────────

/** CS-NAME-01: PascalCase for Classes, Methods, Properties */
const cs_name_01: Rule = {
    id: 'CS-NAME-01',
    name: 'PascalCase Naming',
    description: 'Classes, methods, enumerations, public fields, public properties, and namespaces should use PascalCase.',
    severity: 'medium',
    guideSection: '§Naming rules',
    guideUrl: 'https://google.github.io/styleguide/csharp-style.html#naming-rules',
    check: (lines, _filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            const trimmed = line.trim();
            // Only check lines that start with known modifiers or type keywords
            if (!/^(?:public|private|protected|internal|static|abstract|virtual|override|sealed|readonly|extern|unsafe)/.test(trimmed)) return;

            // Class, struct, interface declarations with lowercase name
            const classMatch = /\b(?:class|struct)\s+([a-z][\w]*)\b/.exec(trimmed);
            if (classMatch) {
                violations.push(createViolation(cs_name_01, i + 1,
                    `'${classMatch[1]}' should use PascalCase.`, 'Rename to PascalCase.', lines[i].trim()));
                return;
            }
            // Method declarations
            const methodMatch = /\b(?:void|string|int|bool|long|double|float|decimal|Task|IEnumerable|List|[A-Z]\w*)\s+([a-z][\w]*)\s*[<(]/.exec(trimmed);
            if (methodMatch) {
                const name = methodMatch[1];
                if (!['var', 'as', 'is', 'new', 'in', 'on', 'from', 'where', 'select', 'value', 'get', 'set', 'nameof'].includes(name)) {
                    violations.push(createViolation(cs_name_01, i + 1,
                        `Method or property '${name}' should use PascalCase.`, 'Rename to PascalCase.', lines[i].trim()));
                }
            }
        });
        return violations;
    }
};

/** CS-NAME-02: camelCase for local variables and parameters */
const cs_name_02: Rule = {
    id: 'CS-NAME-02',
    name: 'camelCase Locals',
    description: 'Local variables and method parameters must use camelCase (not PascalCase or snake_case).',
    severity: 'medium',
    guideSection: '§Naming rules',
    guideUrl: 'https://google.github.io/styleguide/csharp-style.html#naming-rules',
    check: (lines, _filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            const match = /^\s+(?:var|string|int|bool|long|double|float|decimal|object|char|byte)\s+([A-Z]\w*)\s*[=;]/.exec(line);
            if (match) {
                const name = match[1];
                violations.push(createViolation(
                    cs_name_02,
                    i + 1,
                    `Local variable '${name}' should use camelCase, not PascalCase.`,
                    `Rename to '${name.charAt(0).toLowerCase() + name.slice(1)}'.`,
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

/** CS-NAME-03: _camelCase for Private Fields */
const cs_name_03: Rule = {
    id: 'CS-NAME-03',
    name: 'Private Field Naming',
    description: 'Private, protected, internal fields and properties should use _camelCase.',
    severity: 'medium',
    guideSection: '§Naming rules',
    guideUrl: 'https://google.github.io/styleguide/csharp-style.html#naming-rules',
    check: (lines, _filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            const match = /\b(?:private|protected|internal)\s+(?:static\s+)?(?:readonly\s+)?(?:const\s+)?\w+\s+([a-zA-Z]\w*)\s*(?:;|=)/.exec(line);
            if (match && !match[1].startsWith('_')) {
                violations.push(createViolation(
                    cs_name_03,
                    i + 1,
                    `Private/protected field '${match[1]}' should start with an underscore.`,
                    `Rename to '_${match[1]}'.`,
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

/** CS-NAME-04: Interface naming */
const cs_name_04: Rule = {
    id: 'CS-NAME-04',
    name: 'Interface Naming',
    description: 'Interface names should start with an I prefix.',
    severity: 'medium',
    guideSection: '§Naming rules',
    guideUrl: 'https://google.github.io/styleguide/csharp-style.html#naming-rules',
    check: (lines, _filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            const match = /\binterface\s+(\w+)/.exec(line);
            if (match && !match[1].startsWith('I')) {
                violations.push(createViolation(
                    cs_name_04,
                    i + 1,
                    `Interface '${match[1]}' should start with an 'I' prefix.`,
                    `Rename to 'I${match[1]}'.`,
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

/** CS-NAME-05: Enum members use PascalCase */
const cs_name_05: Rule = {
    id: 'CS-NAME-05',
    name: 'Enum Member PascalCase',
    description: 'Enum members should use PascalCase.',
    severity: 'medium',
    guideSection: '§Naming rules',
    guideUrl: 'https://google.github.io/styleguide/csharp-style.html#naming-rules',
    check: (lines, _filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        let inEnum = false;
        let depth = 0;
        searchLines.forEach((line, i) => {
            const trimmed = line.trim();
            if (/^(?:public\s+|private\s+|internal\s+|protected\s+)?enum\s+\w+/.test(trimmed)) {
                inEnum = true;
                depth = 0;
            }
            if (inEnum) {
                depth += (trimmed.match(/\{/g) || []).length;
                depth -= (trimmed.match(/\}/g) || []).length;
                if (depth <= 0 && trimmed.includes('}')) { inEnum = false; return; }
                if (inEnum && depth > 0) {
                    const memberMatch = /^([a-z]\w*)\s*(?:=|,|$)/.exec(trimmed);
                    if (memberMatch) {
                        violations.push(createViolation(
                            cs_name_05,
                            i + 1,
                            `Enum member '${memberMatch[1]}' should use PascalCase.`,
                            `Rename to '${memberMatch[1].charAt(0).toUpperCase() + memberMatch[1].slice(1)}'.`,
                            lines[i].trim()
                        ));
                    }
                    const capsMatch = /^([A-Z][A-Z0-9_]{2,})\s*(?:=|,|$)/.exec(trimmed);
                    if (capsMatch) {
                        violations.push(createViolation(
                            cs_name_05,
                            i + 1,
                            `Enum member '${capsMatch[1]}' uses ALL_CAPS. Use PascalCase instead.`,
                            `Rename to PascalCase.`,
                            lines[i].trim()
                        ));
                    }
                }
            }
        });
        return violations;
    }
};

/** CS-NAME-06: Acronyms in names should be treated as words (MyRpc not MyRPC) */
const cs_name_06: Rule = {
    id: 'CS-NAME-06',
    name: 'Acronym Casing',
    description: 'Acronyms in identifiers should be treated as words: e.g. MyRpc instead of MyRPC.',
    severity: 'low',
    guideSection: '§Naming rules',
    guideUrl: 'https://google.github.io/styleguide/csharp-style.html#naming-rules',
    check: (lines, _filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            const trimmed = line.trim();
            // Match class/interface/struct/method declarations with acronym-style names
            const declMatch = /\b(?:class|struct|interface|enum)\s+(\w+)/.exec(trimmed);
            if (declMatch) {
                const name = declMatch[1];
                // Check for 3+ consecutive uppercase letters (sign of un-word-ified acronym)
                if (/[A-Z]{3,}/.test(name) && !/^I[A-Z]{2}[a-z]/.test(name)) {
                    violations.push(createViolation(
                        cs_name_06,
                        i + 1,
                        `'${name}' contains consecutive uppercase letters. Treat acronyms as words (e.g. MyRpc not MyRPC).`,
                        'Use PascalCase treating each acronym as a single word.',
                        lines[i].trim()
                    ));
                }
            }
        });
        return violations;
    }
};

/** CS-NAME-07: Namespace naming — PascalCase */
const cs_name_07: Rule = {
    id: 'CS-NAME-07',
    name: 'Namespace PascalCase',
    description: 'Namespaces should use PascalCase.',
    severity: 'medium',
    guideSection: '§Naming rules',
    guideUrl: 'https://google.github.io/styleguide/csharp-style.html#naming-rules',
    check: (lines, _filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            const match = /^\s*namespace\s+([\w.]+)/.exec(line);
            if (match) {
                const parts = match[1].split('.');
                for (const part of parts) {
                    if (part.length > 0 && /^[a-z]/.test(part)) {
                        violations.push(createViolation(
                            cs_name_07,
                            i + 1,
                            `Namespace part '${part}' should use PascalCase.`,
                            'Capitalize the first letter of each namespace segment.',
                            lines[i].trim()
                        ));
                        break;
                    }
                }
            }
        });
        return violations;
    }
};

/** CS-NAME-08: Filenames should be PascalCase */
const cs_name_08: Rule = {
    id: 'CS-NAME-08',
    name: 'PascalCase Filename',
    description: 'C# filenames should be PascalCase, e.g. MyFile.cs.',
    severity: 'low',
    guideSection: '§Files',
    guideUrl: 'https://google.github.io/styleguide/csharp-style.html#files',
    check: (_lines, filename, _cleanLines) => {
        const violations: Violation[] = [];
        if (!filename) return violations;
        // Extract just the filename part without extension
        const parts = filename.replace(/\\/g, '/').split('/');
        const baseName = parts[parts.length - 1].replace(/\.cs$/, '');
        if (baseName.length > 0 && /^[a-z]/.test(baseName)) {
            violations.push(createViolation(
                cs_name_08,
                1,
                `Filename '${parts[parts.length - 1]}' should use PascalCase.`,
                `Rename to '${baseName.charAt(0).toUpperCase() + baseName.slice(1)}.cs'.`,
                parts[parts.length - 1]
            ));
        }
        return violations;
    }
};

// ── §Organization ──────────────────────────────────────────────────────────

/** CS-ORG-01: System usings must come first */
const cs_org_01: Rule = {
    id: 'CS-ORG-01',
    name: 'System Usings First',
    description: 'using System imports must appear before other using declarations.',
    severity: 'low',
    guideSection: '§Organization',
    guideUrl: 'https://google.github.io/styleguide/csharp-style.html#organization',
    check: (lines, _filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        let seenNonSystem = false;
        for (let i = 0; i < searchLines.length; i++) {
            const trimmed = searchLines[i].trim();
            if (trimmed.startsWith('using ') && !trimmed.startsWith('using static') && !trimmed.includes('(')) {
                const isSystem = /^using System[.;]/.test(trimmed);
                if (!isSystem && trimmed !== '') seenNonSystem = true;
                if (isSystem && seenNonSystem) {
                    violations.push(createViolation(
                        cs_org_01,
                        i + 1,
                        'System using appears after a non-System using.',
                        'Move all System.* using directives to the top of the using block.',
                        lines[i].trim()
                    ));
                }
            }
        }
        return violations;
    }
};

/** CS-ORG-02: Modifier order */
const cs_org_02: Rule = {
    id: 'CS-ORG-02',
    name: 'Modifier Order',
    description: 'Modifiers should occur in the order: public protected internal private new abstract virtual override sealed static readonly extern unsafe volatile async.',
    severity: 'low',
    guideSection: '§Organization',
    guideUrl: 'https://google.github.io/styleguide/csharp-style.html#organization',
    check: (lines, _filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        const modifierOrder = [
            'public', 'protected', 'internal', 'private',
            'new', 'abstract', 'virtual', 'override', 'sealed',
            'static', 'readonly', 'extern', 'unsafe', 'volatile', 'async'
        ];
        searchLines.forEach((line, i) => {
            const trimmed = line.trim();
            // Extract leading modifiers
            const words = trimmed.split(/\s+/);
            const foundModifiers: string[] = [];
            for (const w of words) {
                if (modifierOrder.includes(w)) {
                    foundModifiers.push(w);
                } else {
                    break;
                }
            }
            if (foundModifiers.length < 2) return;
            // Check order
            const indices = foundModifiers.map(m => modifierOrder.indexOf(m));
            for (let j = 1; j < indices.length; j++) {
                if (indices[j] < indices[j - 1]) {
                    violations.push(createViolation(
                        cs_org_02,
                        i + 1,
                        `Modifiers '${foundModifiers.join(' ')}' are not in the recommended order.`,
                        `Reorder to: ${foundModifiers.slice().sort((a, b) => modifierOrder.indexOf(a) - modifierOrder.indexOf(b)).join(' ')}`,
                        lines[i].trim()
                    ));
                    break;
                }
            }
        });
        return violations;
    }
};

// ── §C# Coding Guidelines ─────────────────────────────────────────────────

/** CS-CONST-01: Use const or readonly for invariant values */
const cs_const_01: Rule = {
    id: 'CS-CONST-01',
    name: 'Use const/readonly',
    description: 'Variables and fields that can be const should always be made const. Otherwise use readonly.',
    severity: 'low',
    guideSection: '§Constants',
    guideUrl: 'https://google.github.io/styleguide/csharp-style.html#constants',
    check: (lines, _filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            // Match: access-modifier static Type Name = literal; (not const, not readonly)
            if (/^\s*(?:public|private|protected|internal)\s+(?!const\b)(?!readonly\b)static\s+(?:int|string|bool|long|double|float|decimal|char|byte)\s+\w+\s*=\s*(?:\d|"|true\b|false\b)/.test(line)) {
                violations.push(createViolation(
                    cs_const_01,
                    i + 1,
                    'Static field initialized with a literal. Consider using const or readonly.',
                    'Change to const or readonly.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

/** CS-TYPE-01: Don't use var for basic types */
const cs_type_01: Rule = {
    id: 'CS-TYPE-01',
    name: 'Avoid var for Primitive Types',
    description: 'Avoid var when working with basic types (int, string, bool, etc.) -- the type is not obvious.',
    severity: 'low',
    guideSection: '§The var keyword',
    guideUrl: 'https://google.github.io/styleguide/csharp-style.html#the-var-keyword',
    check: (lines, _filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            // Detect: var x = true; var x = 42; (basic type literals)
            // Use original lines for the literal value check (cleanLines replaces string content)
            if (/\bvar\s+\w+\s*=\s*(?:true|false|\d+)\s*;/.test(lines[i])) {
                violations.push(createViolation(
                    cs_type_01,
                    i + 1,
                    'Avoid var for basic type literals. Use the explicit type instead.',
                    'Replace var with the explicit type name.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

/** CS-ASYNC-01: Async methods must end with "Async" suffix */
const cs_async_01: Rule = {
    id: 'CS-ASYNC-01',
    name: 'Async Method Naming',
    description: 'Methods that return Task or Task<T> (async methods) must have an Async suffix.',
    severity: 'medium',
    guideSection: '§Naming rules',
    guideUrl: 'https://google.github.io/styleguide/csharp-style.html#naming-rules',
    check: (lines, _filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            const match = /^\s*(?:(?:public|private|protected|internal|static|async|override|virtual|sealed)\s+)+Task(?:<[^>]+>)?\s+(\w+)\s*\(/.exec(line);
            if (match) {
                const methodName = match[1];
                if (!methodName.endsWith('Async') && methodName !== 'Main') {
                    violations.push(createViolation(
                        cs_async_01,
                        i + 1,
                        `Async method '${methodName}' should have an 'Async' suffix.`,
                        `Rename to '${methodName}Async'.`,
                        lines[i].trim()
                    ));
                }
            }
        });
        return violations;
    }
};

/** CS-LINQ-01: Prefer method syntax over query syntax */
const cs_linq_01: Rule = {
    id: 'CS-LINQ-01',
    name: 'Prefer LINQ Method Syntax',
    description: 'Prefer member extension method syntax (myList.Where(x)) over SQL-style LINQ query keywords.',
    severity: 'low',
    guideSection: '§LINQ',
    guideUrl: 'https://google.github.io/styleguide/csharp-style.html#linq',
    check: (lines, _filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            if (/\bfrom\s+\w+\s+in\s+\w+/.test(line)) {
                violations.push(createViolation(
                    cs_linq_01,
                    i + 1,
                    'SQL-style LINQ query syntax detected.',
                    'Prefer method syntax: e.g. myList.Where(x => ...).Select(x => ...)',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

/** CS-LINQ-02: Avoid Container.ForEach for multi-statement bodies */
const cs_linq_02: Rule = {
    id: 'CS-LINQ-02',
    name: 'Avoid ForEach Extension',
    description: 'Avoid Container.ForEach(...) for anything longer than a single statement.',
    severity: 'low',
    guideSection: '§LINQ',
    guideUrl: 'https://google.github.io/styleguide/csharp-style.html#linq',
    check: (lines, _filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            // Detect .ForEach( with a multi-line lambda (opening brace on same line)
            if (/\.ForEach\s*\([^)]*\{/.test(line)) {
                violations.push(createViolation(
                    cs_linq_02,
                    i + 1,
                    'Container.ForEach() with multi-statement body detected.',
                    'Use a regular foreach loop for multi-statement bodies.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

/** CS-DOC-01: Public members must have XML doc comments */
const cs_doc_01: Rule = {
    id: 'CS-DOC-01',
    name: 'Public Member XML Documentation',
    description: 'Public classes, methods, and properties should have XML documentation comments (/// <summary>).',
    severity: 'low',
    guideSection: '§Naming rules',
    guideUrl: 'https://google.github.io/styleguide/csharp-style.html',
    check: (lines, _filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        for (let i = 0; i < searchLines.length; i++) {
            const line = searchLines[i];
            if (/^\s*public\s+(?:class|interface|void|string|int|bool|Task|static|abstract|override)\b/.test(line)) {
                let hasDoc = false;
                for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
                    const prev = lines[j].trim(); // Check raw lines for /// comments
                    if (prev.startsWith('///')) { hasDoc = true; break; }
                    if (prev !== '' && !prev.startsWith('[') && !prev.startsWith('//')) break;
                }
                if (!hasDoc) {
                    violations.push(createViolation(
                        cs_doc_01,
                        i + 1,
                        'Public declaration is missing XML documentation comment (///).',
                        'Add /// <summary>...</summary> above this declaration.',
                        lines[i].trim()
                    ));
                }
            }
        }
        return violations;
    }
};

/** CS-ERR-01: No empty catch blocks */
const cs_err_01: Rule = {
    id: 'CS-ERR-01',
    name: 'Empty Catch Block',
    description: 'Avoid empty catch blocks.',
    severity: 'high',
    guideSection: '§Whitespace rules',
    guideUrl: 'https://google.github.io/styleguide/csharp-style.html',
    check: (lines, _filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        for (let i = 0; i < searchLines.length; i++) {
            const line = searchLines[i].trim();
            // catch (...) { } on one line
            if (/\bcatch\s*(?:\([^)]*\))?\s*\{\s*\}/.test(line)) {
                violations.push(createViolation(
                    cs_err_01,
                    i + 1,
                    'Empty catch block detected.',
                    'Add error handling or a comment explaining why the catch is empty.',
                    lines[i].trim()
                ));
                continue;
            }
            // catch (...) { on one line, then } on next
            if (/\bcatch\s*(?:\([^)]*\))?\s*\{?\s*$/.test(line)) {
                // Look for the opening brace
                let braceIdx = i;
                if (line.endsWith('{')) {
                    braceIdx = i;
                } else if (i + 1 < searchLines.length && searchLines[i + 1].trim() === '{') {
                    braceIdx = i + 1;
                } else {
                    continue;
                }
                // Check if the line after the opening brace is just '}'
                if (braceIdx + 1 < searchLines.length && searchLines[braceIdx + 1].trim() === '}') {
                    violations.push(createViolation(
                        cs_err_01,
                        i + 1,
                        'Empty catch block detected.',
                        'Add error handling or a comment explaining why the catch is empty.',
                        lines[i].trim()
                    ));
                }
            }
        }
        return violations;
    }
};

/** CS-ERR-02: Don't throw generic System.Exception */
const cs_err_02: Rule = {
    id: 'CS-ERR-02',
    name: 'No Generic Exception Throw',
    description: 'Avoid throwing System.Exception directly. Use or create a specific exception type.',
    severity: 'high',
    guideSection: '§Naming rules',
    guideUrl: 'https://google.github.io/styleguide/csharp-style.html',
    check: (lines, _filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            if (/\bthrow\s+new\s+(?:Exception|ApplicationException|SystemException)\s*\(/.test(line)) {
                violations.push(createViolation(
                    cs_err_02,
                    i + 1,
                    'Do not throw generic Exception. Use a specific exception type.',
                    'Create or use a domain-specific exception (e.g. InvalidOperationException, ArgumentException).',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

/** CS-ERR-03: catch(Exception) must not silently swallow */
const cs_err_03: Rule = {
    id: 'CS-ERR-03',
    name: 'No Silent Exception Swallowing',
    description: 'Catch blocks that catch generic Exception should always log, rethrow, or handle the exception.',
    severity: 'high',
    guideSection: '§Naming rules',
    guideUrl: 'https://google.github.io/styleguide/csharp-style.html',
    check: (lines, _filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        for (let i = 0; i < searchLines.length; i++) {
            const line = searchLines[i].trim();
            if (/\bcatch\s*\(\s*Exception\b/.test(line)) {
                let hasHandling = false;
                for (let j = i + 1; j < Math.min(searchLines.length, i + 10); j++) {
                    const inner = searchLines[j].trim();
                    if (/\b(throw|return|log|Log|logger|Logger|Console|Debug|Trace)\b/.test(inner)) {
                        hasHandling = true;
                        break;
                    }
                    if (/^\}/.test(inner)) break;
                }
                if (!hasHandling) {
                    violations.push(createViolation(
                        cs_err_03,
                        i + 1,
                        'catch(Exception) block has no error handling (no throw, log, or return).',
                        'Log the exception, rethrow it, or handle it explicitly.',
                        lines[i].trim()
                    ));
                }
            }
        }
        return violations;
    }
};

// ── §Property and Expression Body ──────────────────────────────────────────

/** CS-PROP-01: Don't use expression body syntax on method definitions */
const cs_prop_01: Rule = {
    id: 'CS-PROP-01',
    name: 'No Expression Body Methods',
    description: 'Do not use expression body syntax (=>) on method definitions. Use it for properties and lambdas only.',
    severity: 'low',
    guideSection: '§Expression body syntax',
    guideUrl: 'https://google.github.io/styleguide/csharp-style.html#expression-body-syntax',
    check: (lines, _filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            const trimmed = line.trim();
            // Method declaration with => (expression body method)
            // Pattern: access-modifiers returnType MethodName(params) => expr;
            if (/^\s*(?:(?:public|private|protected|internal|static|override|virtual|sealed|async)\s+)+(?:void|string|int|bool|long|double|float|decimal|Task|[A-Z]\w*)\s+\w+\s*\([^)]*\)\s*=>/.test(line)) {
                violations.push(createViolation(
                    cs_prop_01,
                    i + 1,
                    'Expression body syntax (=>) should not be used on method definitions.',
                    'Use a regular method body with braces instead.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

// ── §using aliases ─────────────────────────────────────────────────────────

/** CS-USING-01: Don't alias long typenames with using */
const cs_using_01: Rule = {
    id: 'CS-USING-01',
    name: 'No Using Type Aliases',
    description: 'Generally, do not alias long typenames with using. Often this is a sign that a Tuple<> needs to be a class.',
    severity: 'low',
    guideSection: '§using',
    guideUrl: 'https://google.github.io/styleguide/csharp-style.html#using',
    check: (lines, _filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            // using Alias = SomeType;
            if (/^\s*using\s+\w+\s*=\s*\w/.test(line)) {
                violations.push(createViolation(
                    cs_using_01,
                    i + 1,
                    'Type alias via using detected. Consider using a named class instead.',
                    'Replace the using alias with a named class or struct.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

// ── §Tuple return types ────────────────────────────────────────────────────

/** CS-TUPLE-01: Prefer named class over Tuple<> return */
const cs_tuple_01: Rule = {
    id: 'CS-TUPLE-01',
    name: 'Avoid Tuple Return Types',
    description: 'In general, prefer a named class type over Tuple<>, particularly when returning complex types.',
    severity: 'low',
    guideSection: '§Use of tuple as a return type',
    guideUrl: 'https://google.github.io/styleguide/csharp-style.html#use-of-tuple-as-a-return-type',
    check: (lines, _filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            // Match method signatures returning Tuple<...>
            if (/\bTuple<[^>]+>\s+\w+\s*\(/.test(line)) {
                violations.push(createViolation(
                    cs_tuple_01,
                    i + 1,
                    'Method returns Tuple<>. Prefer a named class type for complex return values.',
                    'Define a class or struct to hold the return values.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

// ── §Delegates ─────────────────────────────────────────────────────────────

/** CS-DEL-01: Use Invoke() and null-conditional for delegate calls */
const cs_del_01: Rule = {
    id: 'CS-DEL-01',
    name: 'Delegate Invoke Pattern',
    description: 'When calling a delegate, use Invoke() with the null conditional operator, e.g. SomeDelegate?.Invoke().',
    severity: 'low',
    guideSection: '§Calling delegates',
    guideUrl: 'https://google.github.io/styleguide/csharp-style.html#calling-delegates',
    check: (lines, _filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            // Detect: if (someDelegate != null) someDelegate(...) pattern
            if (/if\s*\(\s*\w+\s*!=\s*null\s*\)/.test(line)) {
                // Check if next few lines call the delegate directly (without ?.Invoke)
                for (let j = i; j < Math.min(searchLines.length, i + 3); j++) {
                    const inner = searchLines[j];
                    // Looks for direct delegate call without Invoke
                    if (/\w+\s*\([^)]*\)\s*;/.test(inner) && !/\.Invoke\s*\(/.test(inner) && !/\?\s*\./.test(inner)) {
                        // This is heuristic; skip if it's obviously not a delegate
                    }
                }
            }
        });
        return violations;
    }
};

// ── §Attributes ────────────────────────────────────────────────────────────

/** CS-ATTR-01: Attributes on separate lines */
const cs_attr_01: Rule = {
    id: 'CS-ATTR-01',
    name: 'Attributes on Separate Lines',
    description: 'Attributes should appear on the line above the member they are associated with.',
    severity: 'low',
    guideSection: '§Attributes',
    guideUrl: 'https://google.github.io/styleguide/csharp-style.html#attributes',
    check: (lines, _filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            const trimmed = line.trim();
            // Attribute followed by a declaration on the same line
            // e.g. [Obsolete] public void Foo()
            if (/^\[[\w.,\s()="]+\]\s+(?:public|private|protected|internal|static|class|void|int|string|bool)\b/.test(trimmed)) {
                violations.push(createViolation(
                    cs_attr_01,
                    i + 1,
                    'Attribute should be on its own line, above the member it decorates.',
                    'Move the attribute to the line above.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

/** CS-ATTR-02: Multiple attributes on separate lines */
const cs_attr_02: Rule = {
    id: 'CS-ATTR-02',
    name: 'One Attribute Per Line',
    description: 'Multiple attributes should be separated by newlines, not combined on one line.',
    severity: 'low',
    guideSection: '§Attributes',
    guideUrl: 'https://google.github.io/styleguide/csharp-style.html#attributes',
    check: (lines, _filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            const trimmed = line.trim();
            // Multiple [Attr] on same line: [Foo][Bar] or [Foo] [Bar]
            if (/\]\s*\[/.test(trimmed) && trimmed.startsWith('[')) {
                violations.push(createViolation(
                    cs_attr_02,
                    i + 1,
                    'Multiple attributes on one line. Place each attribute on its own line.',
                    'Separate each attribute onto its own line.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

// ── §Namespace depth ───────────────────────────────────────────────────────

/** CS-NS-01: Namespaces should be no more than 2 levels deep */
const cs_ns_01: Rule = {
    id: 'CS-NS-01',
    name: 'Namespace Depth',
    description: 'In general, namespaces should be no more than 2 levels deep.',
    severity: 'low',
    guideSection: '§Namespace naming',
    guideUrl: 'https://google.github.io/styleguide/csharp-style.html#namespace-naming',
    check: (lines, _filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            const match = /^\s*namespace\s+([\w.]+)/.exec(line);
            if (match) {
                const depth = match[1].split('.').length;
                if (depth > 2) {
                    violations.push(createViolation(
                        cs_ns_01,
                        i + 1,
                        `Namespace '${match[1]}' is ${depth} levels deep. Prefer at most 2.`,
                        'Flatten the namespace hierarchy.',
                        lines[i].trim()
                    ));
                }
            }
        });
        return violations;
    }
};

// ── §ref/out ───────────────────────────────────────────────────────────────

/** CS-REF-01: ref should be used rarely */
const cs_ref_01: Rule = {
    id: 'CS-REF-01',
    name: 'Rare ref Usage',
    description: 'ref should be used rarely, only when mutating an input is necessary.',
    severity: 'low',
    guideSection: '§ref and out',
    guideUrl: 'https://google.github.io/styleguide/csharp-style.html#ref-and-out',
    check: (lines, _filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            // Match ref in method parameter declarations
            if (/\(\s*(?:.*,\s*)?ref\s+\w+/.test(line) && /\)\s*[{:]?\s*$/.test(line.trim())) {
                violations.push(createViolation(
                    cs_ref_01,
                    i + 1,
                    'ref parameter detected. ref should be used rarely.',
                    'Consider if the parameter truly needs to be passed by ref.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

// Deferred sections (require AST-level analysis):
// §IEnumerable vs IList vs IReadOnlyList -- deferred to AI deep review layer
// §Generators vs containers -- deferred to AI deep review layer
// §Structs and classes -- deferred to AI deep review layer
// §Lambdas vs named methods -- deferred to AI deep review layer
// §Field initializers -- deferred to AI deep review layer
// §Extension methods -- deferred to AI deep review layer
// §Array vs List -- deferred to AI deep review layer
// §Folders and file locations -- deferred to AI deep review layer
// §String interpolation vs String.Format -- deferred to AI deep review layer
// §Object Initializer syntax -- deferred to AI deep review layer
// §Default values/null returns for structs -- deferred to AI deep review layer
// §Removing from containers while iterating -- deferred to AI deep review layer
// §Argument naming -- deferred to AI deep review layer

export const csharpRules: Rule[] = [
    // §Whitespace / Formatting
    cs_fmt_01,   // No tabs
    cs_fmt_02,   // 100-char limit
    cs_fmt_03,   // Brace placement (no line break before opening brace)
    cs_fmt_04,   // Braces required even when optional
    cs_fmt_05,   // Keyword spacing
    cs_fmt_06,   // One statement per line
    cs_fmt_07,   // Space after comma
    cs_fmt_08,   // No line break between } and else
    cs_fmt_09,   // No paren padding
    cs_fmt_10,   // One assignment per statement
    // §Naming
    cs_name_01,  // PascalCase classes/methods/properties
    cs_name_02,  // camelCase locals
    cs_name_03,  // _camelCase private fields
    cs_name_04,  // I prefix for interfaces
    cs_name_05,  // PascalCase enum members
    cs_name_06,  // Acronym casing (MyRpc not MyRPC)
    cs_name_07,  // Namespace PascalCase
    cs_name_08,  // PascalCase filenames
    // §Organization
    cs_org_01,   // System usings first
    cs_org_02,   // Modifier order
    // §Coding Guidelines
    cs_const_01, // Use const/readonly
    cs_type_01,  // Avoid var for primitives
    cs_async_01, // Async suffix on Task methods
    cs_linq_01,  // Prefer LINQ method syntax
    cs_linq_02,  // Avoid .ForEach() for multi-statement
    cs_doc_01,   // Public XML docs
    cs_err_01,   // No empty catch
    cs_err_02,   // No generic Exception throw
    cs_err_03,   // No silent exception swallowing
    cs_prop_01,  // No expression body on methods
    cs_using_01, // No using type aliases
    cs_tuple_01, // Avoid Tuple<> return types
    cs_del_01,   // Delegate Invoke pattern
    cs_attr_01,  // Attributes on separate lines
    cs_attr_02,  // One attribute per line
    cs_ns_01,    // Namespace depth <= 2
    cs_ref_01,   // ref used rarely
];
