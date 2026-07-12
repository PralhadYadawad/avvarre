import { Rule, Violation, Language } from '../../types.js';

/**
 * Swift Rules Module for avvarre.
 * 
 * Target: Google Swift Style Guide (https://google.github.io/swift/)
 */

/**
 * Strip string literals and comments from Swift source while preserving
 * line count and positions.
 */
export function getCleanLines(lines: string[]): string[] {
    const result: string[] = [];
    let inBlockComment = false;

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

            // Single-line comment
            if (line[j] === '/' && line[j + 1] === '/') {
                break;
            }

            // Block comment start
            if (line[j] === '/' && line[j + 1] === '*') {
                inBlockComment = true;
                j += 2;
                continue;
            }

            // Double-quoted string
            if (line[j] === '"') {
                clean += '""';
                j++;
                while (j < line.length && line[j] !== '"') {
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

/** SW-FMT-01: No tabs allowed */
const sw_fmt_01: Rule = {
    id: 'SW-FMT-01',
    name: 'No Tabs',
    description: 'Use only spaces for indentation.',
    severity: 'medium',
    guideSection: '§Source File Basics',
    guideUrl: 'https://google.github.io/swift/#whitespace-characters',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        lines.forEach((line, i) => {
            if (line.includes('\t')) {
                violations.push(createViolation(
                    sw_fmt_01,
                    i + 1,
                    'Line contains tab characters.',
                    'Replace tabs with spaces (2-space indentation).',
                    line.trim()
                ));
            }
        });
        return violations;
    }
};

/** SW-STMT-01: No semicolons */
const sw_stmt_01: Rule = {
    id: 'SW-STMT-01',
    name: 'No Semicolons',
    description: 'Semicolons are not used for terminating statements.',
    severity: 'medium',
    guideSection: '§Semicolons',
    guideUrl: 'https://google.github.io/swift/#semicolons',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || getCleanLines(lines);
        linesToUse.forEach((line, i) => {
            if (line.trim().endsWith(';')) {
                violations.push(createViolation(
                    sw_stmt_01,
                    i + 1,
                    'Statement ends with a semicolon.',
                    'Remove the semicolon.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

/** SW-FMT-02: 100-character line limit */
const sw_fmt_02: Rule = {
    id: 'SW-FMT-02',
    name: 'Line Length',
    description: 'Lines should not exceed 100 characters.',
    severity: 'low',
    guideSection: '§Column Limit',
    guideUrl: 'https://google.github.io/swift/#column-limit',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        lines.forEach((line, i) => {
            if (line.length > 100) {
                violations.push(createViolation(
                    sw_fmt_02,
                    i + 1,
                    `Line exceeds 100 characters (${line.length}).`,
                    'Wrap the line or shorten it.',
                    line.trim()
                ));
            }
        });
        return violations;
    }
};

/** SW-FMT-03: K&R Braces */
const sw_fmt_03: Rule = {
    id: 'SW-FMT-03',
    name: 'Brace Style',
    description: 'Use Kernighan and Ritchie (K&R) brace style.',
    severity: 'low',
    guideSection: '§Braces',
    guideUrl: 'https://google.github.io/swift/#braces',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || getCleanLines(lines);
        linesToUse.forEach((line, i) => {
            const trimmed = line.trim();
            if (trimmed === '{' && i > 0) {
                // If the previous line didn't end with { or it was a blank line, it's a violation
                const prevLine = linesToUse[i - 1].trim();
                if (prevLine !== '') {
                    violations.push(createViolation(
                        sw_fmt_03,
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

/** SW-NAME-01: lowerCamelCase for constants */
const sw_name_01: Rule = {
    id: 'SW-NAME-01',
    name: 'Constant Naming',
    description: 'Global constants should be lowerCamelCase.',
    severity: 'medium',
    guideSection: '§Global Constants',
    guideUrl: 'https://google.github.io/swift/#global-constants',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || getCleanLines(lines);
        linesToUse.forEach((line, i) => {
            const match = /let\s+([A-Z_][A-Za-z0-9_]*)\s*=/.exec(line);
            if (match && !/^[a-z]/.test(match[1])) {
                // Ignore Screaming Snake Case if it's truly a constant in common usage, 
                // but Google says "lowerCamelCase".
                violations.push(createViolation(
                    sw_name_01,
                    i + 1,
                    `Constant '${match[1]}' should use lowerCamelCase.`,
                    'Rename to lowerCamelCase.',
                    line.trim()
                ));
            }
        });
        return violations;
    }
};

/** SW-OPT-01: Avoid force-unwrapping */
const sw_opt_01: Rule = {
    id: 'SW-OPT-01',
    name: 'No Force-Unwrap',
    description: 'Force-unwrapping (!) is strongly discouraged.',
    severity: 'high',
    guideSection: '§Force Unwrapping and Force Casts',
    guideUrl: 'https://google.github.io/swift/#force-unwrapping-and-force-casts',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || getCleanLines(lines);
        linesToUse.forEach((line, i) => {
            if (line.includes('if let') || line.includes('guard let')) return;
            // Match identifier followed by ! that is a force-unwrap, not:
            //   - != (not-equal), !. used after boolean negation, as! (handled by SW-ERR-02)
            //   - try! (handled by SW-ERR-01), !isEmpty / !contains etc. (boolean negation)
            const matches = line.matchAll(/(\w+)!/g);
            for (const m of matches) {
                const afterBang = line[m.index! + m[0].length] || '';
                const beforeIdent = line[m.index! - 1] || '';
                // Skip != operator
                if (afterBang === '=') continue;
                // Skip as! (force cast — separate rule)
                if (m[1] === 'as') continue;
                // Skip try! (force try — separate rule)
                if (m[1] === 'try') continue;
                // Skip boolean negation: !identifier (the ! is before, not after)
                if (m[1] === '' || /^[(!]/.test(m[0])) continue;
                // Skip if the bang is followed by a letter (like !isEmpty — negation, not unwrap)
                if (/[a-zA-Z]/.test(afterBang)) continue;
                violations.push(createViolation(
                    sw_opt_01,
                    i + 1,
                    'Force-unwrapping detected.',
                    'Use optional binding (if let/guard let) or nil-coalescing (??).',
                    lines[i].trim()
                ));
                break; // One violation per line
            }
        });
        return violations;
    }
};

/** SW-ERR-01: No try! */
const sw_err_01: Rule = {
    id: 'SW-ERR-01',
    name: 'No Force-Try',
    description: 'Force-try! is forbidden in production code.',
    severity: 'high',
    guideSection: '§Error Types',
    guideUrl: 'https://google.github.io/swift/#error-types',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || getCleanLines(lines);
        linesToUse.forEach((line, i) => {
            if (/\btry!\s/.test(line) || /\btry!$/.test(line.trim())) {
                violations.push(createViolation(
                    sw_err_01,
                    i + 1,
                    'Force-try (!) used.',
                    'Use do-catch or try?.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

/** SW-FMT-04: Space after keywords */
const sw_fmt_04: Rule = {
    id: 'SW-FMT-04',
    name: 'Keyword Spacing',
    description: 'Provide a space after keywords like if, while, for, and switch.',
    severity: 'low',
    guideSection: '§Horizontal Whitespace',
    guideUrl: 'https://google.github.io/swift/#horizontal-whitespace',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || getCleanLines(lines);
        linesToUse.forEach((line, i) => {
            const match = /\b(if|while|for|switch)\(/.exec(line);
            if (match) {
                violations.push(createViolation(
                    sw_fmt_04,
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

/** SW-FMT-05: Space around binary operators */
const sw_fmt_05: Rule = {
    id: 'SW-FMT-05',
    name: 'Operator Spacing',
    description: 'Binary operators should be surrounded by spaces.',
    severity: 'low',
    guideSection: '§Horizontal Whitespace',
    guideUrl: 'https://google.github.io/swift/#horizontal-whitespace',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || getCleanLines(lines);
        linesToUse.forEach((line, i) => {
            // Check for missing spaces around +, -, *, /, =, ==, !=, &&, ||
            // cleanLines already strips strings/comments so no extra guard needed
            const match = /\w[+*/=]\w|\w==\w|\w!=\w|\w&&|&&\w|\w\|\||\|\|\w/.exec(line);
            if (match) {
                violations.push(createViolation(
                    sw_fmt_05,
                    i + 1,
                    'Binary operator missing surrounding spaces.',
                    'Add spaces around the operator.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

/** SW-FMT-06: Empty blocks on one line */
const sw_fmt_06: Rule = {
    id: 'SW-FMT-06',
    name: 'Empty Block Braces',
    description: 'Empty blocks may be concatenated as {} on a single line.',
    severity: 'low',
    guideSection: '§Braces',
    guideUrl: 'https://google.github.io/swift/#braces',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || getCleanLines(lines);
        linesToUse.forEach((line, i) => {
            if (line.includes('{') && line.includes('}') && line.indexOf('{') < line.indexOf('}')) {
                // Non-empty single-line block -- OK for empty blocks
            } else if (line.trim() === '{') {
                if (i + 1 < linesToUse.length && linesToUse[i + 1].trim() === '}') {
                    violations.push(createViolation(
                        sw_fmt_06,
                        i + 2,
                        'Empty block could be written as {} on a single line.',
                        'Collapse to {}.',
                        '{}'
                    ));
                }
            }
        });
        return violations;
    }
};

/** SW-FEAT-01: Discourage explicit self. */
const sw_feat_01: Rule = {
    id: 'SW-FEAT-01',
    name: 'Avoid Explicit Self',
    description: 'Avoid "self." unless required by the compiler (e.g., in closures or to disambiguate).',
    severity: 'low',
    guideSection: '§Programming Practices',
    guideUrl: 'https://google.github.io/swift/#self-usage',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || getCleanLines(lines);
        let inInit = false;
        linesToUse.forEach((line, i) => {
            if (line.includes('init(')) inInit = true;
            if (line.trim() === '}') inInit = false; // Simple heuristic

            if (!inInit && !line.includes('{') && line.includes('self.')) {
                // Heuristic: if it's not in a closure/init, it's often optional
                violations.push(createViolation(
                    sw_feat_01,
                    i + 1,
                    'Explicit "self." usage is discouraged.',
                    'Remove "self.".',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

/** SW-NAME-02: Acronyms as words */
const sw_name_02: Rule = {
    id: 'SW-NAME-02',
    name: 'Acronym Naming',
    description: 'Acronyms should be treated as words (e.g., UserId instead of USERID).',
    severity: 'medium',
    guideSection: '§Identifiers',
    guideUrl: 'https://google.github.io/swift/#identifiers',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || getCleanLines(lines);
        linesToUse.forEach((line, i) => {
            // Match standalone ALL_CAPS identifiers (3+ chars) in let/var/func/class declarations
            // Avoid matching import statements or well-known constants like URL, UI prefix
            const match = /\b(let|var|func|class|struct|enum|protocol)\s+([A-Z]{3,})\b/.exec(line);
            if (match) {
                const acronym = match[2];
                // Skip known Apple acronyms used as type names (UIKit etc.)
                violations.push(createViolation(
                    sw_name_02,
                    i + 1,
                    `Acronym '${acronym}' should be treated as a word (e.g., '${acronym.charAt(0) + acronym.slice(1).toLowerCase()}').`,
                    'Use lowerCamelCase or UpperCamelCase: treat acronyms as words.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

// ── SW-NAME-03: No Hungarian notation prefix (k, g) on constants ────────

/** SW-NAME-03: No Hungarian prefix */
const sw_name_03: Rule = {
    id: 'SW-NAME-03',
    name: 'No Hungarian Prefix',
    description: 'Global constants must not use Hungarian notation (k or g prefix). Use lowerCamelCase directly.',
    severity: 'medium',
    guideSection: '§Global Constants',
    guideUrl: 'https://google.github.io/swift/#global-constants',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || getCleanLines(lines);
        linesToUse.forEach((line, i) => {
            //  Match: let kFooBar = ... or let gSomething = ...
            // k or g followed by an uppercase letter = Hungarian notation
            const match = /^\s*(?:private\s+|internal\s+|public\s+|fileprivate\s+)?(?:static\s+)?let\s+(k[A-Z]\w*|g[A-Z]\w*)\s*[=:]/.exec(line);
            if (match) {
                const name = match[1];
                violations.push(createViolation(
                    sw_name_03,
                    i + 1,
                    `Constant '${name}' uses Hungarian notation. Drop the '${name[0]}' prefix and use lowerCamelCase.`,
                    `Rename '${name}' to '${name.charAt(1).toLowerCase() + name.slice(2)}'.`,
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

// ── SW-NAME-04: No leading underscore for identifiers ───────────────────

/** SW-NAME-04: No underscore prefix */
const sw_name_04: Rule = {
    id: 'SW-NAME-04',
    name: 'No Underscore Prefix',
    description: 'Leading underscores are not used for naming. Use access control (private/fileprivate) instead.',
    severity: 'medium',
    guideSection: '§Naming Conventions Are Not Access Control',
    guideUrl: 'https://google.github.io/swift/#naming-conventions-are-not-access-control',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || getCleanLines(lines);
        linesToUse.forEach((line, i) => {
            // Match: var _foo, let _bar, func _baz(
            // Exclude: _ as wildcard (single underscore), _: parameter labels (external ignored), __
            const match = /\b(?:var|let|func)\s+(_[a-zA-Z]\w*)\b/.exec(line);
            if (match) {
                const name = match[1];
                violations.push(createViolation(
                    sw_name_04,
                    i + 1,
                    `Identifier '${name}' has a leading underscore. Use access control (private/fileprivate) instead.`,
                    `Remove the underscore: rename '${name}' to '${name.slice(1)}'.`,
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

// ── SW-NAME-05: Type names must be UpperCamelCase ───────────────────────

/** SW-NAME-05: UpperCamelCase for types */
const sw_name_05: Rule = {
    id: 'SW-NAME-05',
    name: 'Type UpperCamelCase',
    description: 'Types (class, struct, enum, protocol, extension) must use UpperCamelCase.',
    severity: 'high',
    guideSection: '§Identifiers',
    guideUrl: 'https://google.github.io/swift/#identifiers',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || getCleanLines(lines);
        linesToUse.forEach((line, i) => {
            // Match: class/struct/enum/protocol/extension followed by name that is NOT UpperCamelCase
            const match = /^\s*(?:public\s+|private\s+|internal\s+|fileprivate\s+|open\s+|final\s+)*(?:class|struct|enum|protocol|extension)\s+([a-z]\w*)\b/.exec(line);
            if (match) {
                const name = match[1];
                violations.push(createViolation(
                    sw_name_05,
                    i + 1,
                    `Type name '${name}' must use UpperCamelCase.`,
                    `Rename to '${name.charAt(0).toUpperCase() + name.slice(1)}'.`,
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

// ── SW-DOC-01: No Javadoc-style doc comments ─────────────────────────

/** SW-DOC-01: No Javadoc block comments for docs */
const sw_doc_01: Rule = {
    id: 'SW-DOC-01',
    name: 'No Javadoc Comments',
    description: 'Documentation comments must use /// (triple-slash), not /** ... */ style.',
    severity: 'medium',
    guideSection: '§Documentation Comments',
    guideUrl: 'https://google.github.io/swift/#documentation-comments',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        for (let i = 0; i < lines.length; i++) {
            // Detect Javadoc-style opening /** -- this must check raw lines since
            // cleanLines strips comments. We verify line starts with /** to avoid
            // matching inside string literals (which would be indented).
            if (/^\s*\/\*\*/.test(lines[i]) && !lines[i].trim().startsWith('/**/')) {
                violations.push(createViolation(
                    sw_doc_01,
                    i + 1,
                    'Javadoc-style documentation comment (/** ... */) is not allowed.',
                    'Replace with triple-slash (///) documentation comments.',
                    lines[i].trim()
                ));
            }
        }
        return violations;
    }
};

// ── SW-DOC-02: Public declarations must have /// doc comments ───────────

/** SW-DOC-02: Public declarations must have doc comments */
const sw_doc_02: Rule = {
    id: 'SW-DOC-02',
    name: 'Public Declaration Missing Doc',
    description: 'Every public function, class, struct, enum, and property should have a /// doc comment.',
    severity: 'low',
    guideSection: '§Documentation Comments',
    guideUrl: 'https://google.github.io/swift/#where-to-document',
    check: (lines) => {
        const violations: Violation[] = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Match: top-level public func/class/struct/enum/var/let
            if (/^\s*public\s+(func|class|struct|enum|var|let|protocol)\b/.test(line)) {
                // Look back for a /// doc comment
                let hasDoc = false;
                for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
                    const prev = lines[j].trim();
                    if (prev.startsWith('///')) { hasDoc = true; break; }
                    if (prev !== '' && !prev.startsWith('@') && !prev.startsWith('//')) break;
                }
                if (!hasDoc) {
                    violations.push(createViolation(
                        sw_doc_02,
                        i + 1,
                        'Public declaration is missing a /// documentation comment.',
                        'Add a /// doc comment above this declaration.',
                        lines[i].trim()
                    ));
                }
            }
        }
        return violations;
    }
};

// ── SW-OPT-02: No implicitly unwrapped optional properties ──────────────

/** SW-OPT-02: No IUO property declarations */
const sw_opt_02: Rule = {
    id: 'SW-OPT-02',
    name: 'No Implicitly Unwrapped Optionals',
    description: 'Implicitly unwrapped optional properties (Type!) should be avoided.',
    severity: 'high',
    guideSection: '§Implicitly Unwrapped Optionals',
    guideUrl: 'https://google.github.io/swift/#implicitly-unwrapped-optionals',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || getCleanLines(lines);
        linesToUse.forEach((line, i) => {
            const match = /^\s*(?:private\s+|public\s+|internal\s+|fileprivate\s+|open\s+)?var\s+\w+\s*:\s*[A-Za-z][\w<>\[\]]*!/.exec(line);
            if (match && !/^\s*@IBOutlet/.test(line) && !/^\s*@IBAction/.test(line)) {
                violations.push(createViolation(
                    sw_opt_02,
                    i + 1,
                    'Implicitly unwrapped optional (!) property detected.',
                    'Use Optional (?) or refactor to ensure non-nil before use.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

// ── SW-PROP-01: Read-only computed property must omit get {} ─────────────

/** SW-PROP-01: Omit get block in read-only computed property */
const sw_prop_01: Rule = {
    id: 'SW-PROP-01',
    name: 'Omit get in Read-Only Property',
    description: 'The get block should be omitted for read-only computed properties.',
    severity: 'low',
    guideSection: '§Properties',
    guideUrl: 'https://google.github.io/swift/#properties',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || getCleanLines(lines);
        for (let i = 0; i < linesToUse.length - 1; i++) {
            if (/^\s*var\s+\w+(?::\s*[\w<>\[\]?,\s]+)?\s*\{\s*$/.test(linesToUse[i])) {
                let foundGet = false;
                let foundSet = false;
                let depth = 1;
                for (let j = i + 1; j < Math.min(linesToUse.length, i + 20); j++) {
                    const inner = linesToUse[j].trim();
                    if (/^get\s*\{/.test(inner) || inner === 'get {') foundGet = true;
                    if (/^set\b/.test(inner)) foundSet = true;
                    depth += (inner.match(/\{/g) || []).length;
                    depth -= (inner.match(/\}/g) || []).length;
                    if (depth <= 0) break;
                }
                if (foundGet && !foundSet) {
                    violations.push(createViolation(
                        sw_prop_01,
                        i + 1,
                        'Read-only computed property has an explicit get {} block.',
                        'Remove the get keyword and nest the body directly inside the property.',
                        lines[i].trim()
                    ));
                }
            }
        }
        return violations;
    }
};

// ── SW-CTRL-01: No lone fallthrough in switch ──────────────────────────────────────────────

/** SW-CTRL-01: No bare fallthrough in switch cases */
const sw_ctrl_01: Rule = {
    id: 'SW-CTRL-01',
    name: 'No Lone Fallthrough',
    description: 'A case body that contains only a fallthrough statement is not allowed. Combine cases instead.',
    severity: 'medium',
    guideSection: '§fallthrough in switch Statements',
    guideUrl: 'https://google.github.io/swift/#fallthrough-in-switch-statements',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || getCleanLines(lines);
        for (let i = 0; i < linesToUse.length; i++) {
            const line = linesToUse[i].trim();
            // The pattern: a case line, then the very next non-blank statement is 'fallthrough'
            if (/^case\s+.+:$/.test(line) || /^default:$/.test(line)) {
                // Find the next non-comment, non-blank line
                let nextCode = -1;
                for (let j = i + 1; j < Math.min(linesToUse.length, i + 5); j++) {
                    const t = linesToUse[j].trim();
                    if (t && !t.startsWith('//')) { nextCode = j; break; }
                }
                if (nextCode >= 0 && /^fallthrough\s*$/.test(linesToUse[nextCode].trim())) {
                    // Next non-blank after fallthrough should be another case (no extra code)
                    let afterFall = -1;
                    for (let j = nextCode + 1; j < Math.min(linesToUse.length, nextCode + 5); j++) {
                        const t = linesToUse[j].trim();
                        if (t && !t.startsWith('//')) { afterFall = j; break; }
                    }
                    if (afterFall >= 0 && /^(case\s|default:)/.test(linesToUse[afterFall].trim())) {
                        violations.push(createViolation(
                            sw_ctrl_01,
                            nextCode + 1,
                            'Lone fallthrough in case body is not allowed.',
                            'Combine the cases: case 1, 2: or case 1...4:',
                            lines[nextCode].trim()
                        ));
                    }
                }
            }
        }
        return violations;
    }
};

// ── SW-TYPE-01: Use shorthand type syntax ──────────────────────────────────────────────────

/** SW-TYPE-01: Use shorthand types */
const sw_type_01: Rule = {
    id: 'SW-TYPE-01',
    name: 'Use Shorthand Types',
    description: 'Use shorthand syntax: [T] instead of Array<T>, T? instead of Optional<T>, [K:V] instead of Dictionary<K,V>.',
    severity: 'medium',
    guideSection: '§Types with Shorthand Names',
    guideUrl: 'https://google.github.io/swift/#types-with-shorthand-names',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || getCleanLines(lines);
        linesToUse.forEach((line, i) => {
            // Match Array<T>, Optional<T>, Dictionary<K,V> in type position
            if (/\bArray\s*<[^>]+>/.test(line) || /\bOptional\s*<[^>]+>/.test(line) || /\bDictionary\s*<[^>]+,[^>]+>/.test(line)) {
                const what = /\bArray\s*</.test(line) ? 'Array<T>' :
                    /\bOptional\s*</.test(line) ? 'Optional<T>' : 'Dictionary<K,V>';
                const better = what === 'Array<T>' ? '[T]' : what === 'Optional<T>' ? 'T?' : '[K:V]';
                violations.push(createViolation(
                    sw_type_01,
                    i + 1,
                    `Use shorthand type '${better}' instead of '${what}'.`,
                    `Replace ${what} with its shorthand form.`,
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

// ── SW-STMT-02: One statement per line ─────────────────────────────────────────────────────

/** SW-STMT-02: One statement per line */
const sw_stmt_02: Rule = {
    id: 'SW-STMT-02',
    name: 'One Statement Per Line',
    description: 'There should be at most one statement per line.',
    severity: 'medium',
    guideSection: '§One Statement Per Line',
    guideUrl: 'https://google.github.io/swift/#one-statement-per-line',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || getCleanLines(lines);
        linesToUse.forEach((line, i) => {
            const trimmed = line.trim();
            // Count semicolons in code (not in strings — cleanLines handles that)
            // A semicolon in the middle of a line indicates multiple statements
            if (/;.+/.test(trimmed) && !trimmed.startsWith('//')) {
                violations.push(createViolation(
                    sw_stmt_02,
                    i + 1,
                    'Multiple statements on one line detected.',
                    'Put each statement on its own line.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

// ── SW-FEAT-02: No print() in production code ──────────────────────────────────────────────

/** SW-FEAT-02: No bare print() calls */
const sw_feat_02: Rule = {
    id: 'SW-FEAT-02',
    name: 'No print() in Production',
    description: 'Avoid using print() in production code. Use a proper logging framework.',
    severity: 'low',
    guideSection: '§Programming Practices',
    guideUrl: 'https://google.github.io/swift/#programming-practices',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || getCleanLines(lines);
        linesToUse.forEach((line, i) => {
            // Match print( but not inside a comment
            if (/\bprint\s*\(/.test(line)) {
                violations.push(createViolation(
                    sw_feat_02,
                    i + 1,
                    'print() call found. Prefer a structured logging framework.',
                    'Replace with os_log, Logger, or a custom logging abstraction.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

// ── SW-ERR-02: No force cast (as!) ─────────────────────────────────────────────────────────

/** SW-ERR-02: No force cast */
const sw_err_02: Rule = {
    id: 'SW-ERR-02',
    name: 'No Force Cast',
    description: 'Force casting (as!) is strongly discouraged. Use conditional casts (as?) with proper handling.',
    severity: 'high',
    guideSection: '§Force Unwrapping and Force Casts',
    guideUrl: 'https://google.github.io/swift/#force-unwrapping-and-force-casts',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || getCleanLines(lines);
        linesToUse.forEach((line, i) => {
            if (/\bas!\s/.test(line)) {
                violations.push(createViolation(
                    sw_err_02,
                    i + 1,
                    'Force cast (as!) detected. This will crash if the cast fails.',
                    'Use conditional cast (as?) with if let or guard let.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

// ── SW-ACCESS-01: No public/internal on whole extension block ──────────────────────────────

/** SW-ACCESS-01: No access modifier on extension declaration */
const sw_access_01: Rule = {
    id: 'SW-ACCESS-01',
    name: 'No Extension-Level Access Modifier',
    description: 'Specifying an explicit access level on an extension as a whole is forbidden. Annotate each member individually.',
    severity: 'high',
    guideSection: '§Access Levels',
    guideUrl: 'https://google.github.io/swift/#access-levels',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || getCleanLines(lines);
        linesToUse.forEach((line, i) => {
            // Match: public/private/internal/fileprivate extension Foo
            const match = /^\s*(public|private|internal|fileprivate|open)\s+extension\s+\w+/.exec(line);
            if (match) {
                violations.push(createViolation(
                    sw_access_01,
                    i + 1,
                    `Access level '${match[1]}' on extension block is forbidden.`,
                    'Annotate each member individually with the desired access level.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

// ── SW-FMT-07: Trailing whitespace ───────────────────────────────────────────

/** SW-FMT-07: No trailing whitespace */
const sw_fmt_07: Rule = {
    id: 'SW-FMT-07',
    name: 'No Trailing Whitespace',
    description: 'Lines must not have trailing whitespace.',
    severity: 'low',
    guideSection: '§Whitespace Characters',
    guideUrl: 'https://google.github.io/swift/#whitespace-characters',
    check: (lines) => {
        const violations: Violation[] = [];
        lines.forEach((line, i) => {
            if (/\S\s+$/.test(line) || (/^\s+$/.test(line) && line.length > 0)) {
                violations.push(createViolation(
                    sw_fmt_07,
                    i + 1,
                    'Line has trailing whitespace.',
                    'Remove trailing spaces.',
                    lines[i].trimEnd() + '<trailing>'
                ));
            }
        });
        return violations;
    }
};

// ── SW-FMT-08: No consecutive blank lines ────────────────────────────────────

/** SW-FMT-08: No multiple consecutive blank lines */
const sw_fmt_08: Rule = {
    id: 'SW-FMT-08',
    name: 'No Multiple Blank Lines',
    description: 'There must never be more than one consecutive blank line.',
    severity: 'low',
    guideSection: '§Vertical Whitespace',
    guideUrl: 'https://google.github.io/swift/#vertical-whitespace',
    check: (lines) => {
        const violations: Violation[] = [];
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim() === '' && lines[i - 1].trim() === '') {
                violations.push(createViolation(
                    sw_fmt_08,
                    i + 1,
                    'Multiple consecutive blank lines.',
                    'Use at most one blank line to separate sections.',
                    '(blank line)'
                ));
            }
        }
        return violations;
    }
};

// ── SW-FMT-09: 2-space indentation ──────────────────────────────────────────

/** SW-FMT-09: Indentation must be 2-space increments */
const sw_fmt_09: Rule = {
    id: 'SW-FMT-09',
    name: 'Two-Space Indentation',
    description: 'Indentation must use 2-space increments.',
    severity: 'low',
    guideSection: '§Indentation',
    guideUrl: 'https://google.github.io/swift/#whitespace-characters',
    check: (lines) => {
        const violations: Violation[] = [];
        lines.forEach((line, i) => {
            if (line.trim() === '') return;
            const leadingSpaces = line.match(/^( +)/);
            if (leadingSpaces) {
                const count = leadingSpaces[1].length;
                if (count % 2 !== 0) {
                    violations.push(createViolation(
                        sw_fmt_09,
                        i + 1,
                        `Indentation of ${count} spaces is not a multiple of 2.`,
                        'Use 2-space indentation increments.',
                        lines[i].trimEnd()
                    ));
                }
            }
        });
        return violations;
    }
};

// ── SW-IMP-01: Import ordering ──────────────────────────────────────────────

/** SW-IMP-01: Imports should be sorted alphabetically */
const sw_imp_01: Rule = {
    id: 'SW-IMP-01',
    name: 'Import Ordering',
    description: 'Import statements should be sorted lexicographically.',
    severity: 'low',
    guideSection: '§Import Statements',
    guideUrl: 'https://google.github.io/swift/#import-statements',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || getCleanLines(lines);
        const imports: { name: string; line: number }[] = [];
        for (let i = 0; i < linesToUse.length; i++) {
            const match = /^\s*import\s+(\w+)/.exec(linesToUse[i]);
            if (match) {
                imports.push({ name: match[1], line: i });
            } else if (linesToUse[i].trim() !== '' && imports.length > 0) {
                break; // End of import block
            }
        }
        for (let k = 1; k < imports.length; k++) {
            if (imports[k].name.localeCompare(imports[k - 1].name) < 0) {
                violations.push(createViolation(
                    sw_imp_01,
                    imports[k].line + 1,
                    `Import '${imports[k].name}' is out of order (should come before '${imports[k - 1].name}').`,
                    'Sort import statements alphabetically.',
                    lines[imports[k].line].trim()
                ));
            }
        }
        return violations;
    }
};

// ── SW-NAME-06: Enum cases must be lowerCamelCase ───────────────────────────

/** SW-NAME-06: Enum cases must be lowerCamelCase */
const sw_name_06: Rule = {
    id: 'SW-NAME-06',
    name: 'Enum Case lowerCamelCase',
    description: 'Enum cases must use lowerCamelCase.',
    severity: 'medium',
    guideSection: '§Identifiers',
    guideUrl: 'https://google.github.io/swift/#identifiers',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || getCleanLines(lines);
        linesToUse.forEach((line, i) => {
            // Match: case FooBar (starts uppercase) inside an enum
            const match = /^\s*case\s+([A-Z][a-zA-Z0-9]*)(?:\s*[=(,]|$)/.exec(line);
            if (match) {
                const name = match[1];
                // Ensure this is not a switch-case by checking context
                // switch cases have patterns like `case .foo:` or `case let x:`
                if (!/:/.test(line) && !/\./.test(line.substring(0, line.indexOf(name)))) {
                    violations.push(createViolation(
                        sw_name_06,
                        i + 1,
                        `Enum case '${name}' should use lowerCamelCase.`,
                        `Rename to '${name.charAt(0).toLowerCase() + name.slice(1)}'.`,
                        lines[i].trim()
                    ));
                }
            }
        });
        return violations;
    }
};

// ── SW-CTRL-02: Prefer guard for early exits ────────────────────────────────

/** SW-CTRL-02: Prefer guard for early exits */
const sw_ctrl_02: Rule = {
    id: 'SW-CTRL-02',
    name: 'Prefer Guard for Early Exit',
    description: 'Use guard statements for early exits instead of if-else with return/throw/break/continue.',
    severity: 'low',
    guideSection: '§Early Exits',
    guideUrl: 'https://google.github.io/swift/#early-exits',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || getCleanLines(lines);
        for (let i = 0; i < linesToUse.length; i++) {
            const line = linesToUse[i].trim();
            // Detect: if <condition> { return/throw/break/continue }
            // Single-line pattern
            if (/^\s*if\s+.+\{\s*(return|throw|break|continue)\b/.test(line)) {
                violations.push(createViolation(
                    sw_ctrl_02,
                    i + 1,
                    'Consider using guard instead of if for early exit.',
                    'Refactor to: guard <inverted condition> else { return/throw }',
                    lines[i].trim()
                ));
            }
        }
        return violations;
    }
};

// ── SW-TYPE-02: Use Void instead of () for return types ─────────────────────

/** SW-TYPE-02: Use Void not () for return types */
const sw_type_02: Rule = {
    id: 'SW-TYPE-02',
    name: 'Use Void Not Empty Tuple',
    description: 'Use Void instead of () for function return types.',
    severity: 'low',
    guideSection: '§Types with Shorthand Names',
    guideUrl: 'https://google.github.io/swift/#types-with-shorthand-names',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || getCleanLines(lines);
        linesToUse.forEach((line, i) => {
            // Match -> () but not -> (SomeType)
            if (/\)\s*->\s*\(\s*\)/.test(line)) {
                violations.push(createViolation(
                    sw_type_02,
                    i + 1,
                    'Use Void instead of () as a return type.',
                    'Replace -> () with -> Void.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

// ── SW-ACCESS-02: Prefer fileprivate over private at file scope ─────────────
// §Access Levels -- deferred to AI deep review layer (requires scope analysis)

// ── SW-FEAT-03: Use trailing closure syntax ─────────────────────────────────

/** SW-FEAT-03: Use trailing closure syntax */
const sw_feat_03: Rule = {
    id: 'SW-FEAT-03',
    name: 'Use Trailing Closure',
    description: 'When the last argument to a function is a closure, use trailing closure syntax.',
    severity: 'low',
    guideSection: '§Trailing Closures',
    guideUrl: 'https://google.github.io/swift/#trailing-closures',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || getCleanLines(lines);
        linesToUse.forEach((line, i) => {
            // Detect: someFn(arg, { ... }) -- closure as last arg inside parens
            // Pattern: closing brace followed by closing paren at end
            if (/\}\s*\)\s*$/.test(line.trim()) && /\(\s*\{/.test(line)) {
                violations.push(createViolation(
                    sw_feat_03,
                    i + 1,
                    'Closure as last argument should use trailing closure syntax.',
                    'Move the closure outside the parentheses.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

// ── SW-FEAT-04: Prefer where clause on for-in ──────────────────────────────
// §for-in Where Clauses -- deferred to AI deep review layer (requires semantic analysis)

// ── SW-NAME-07: Function/variable names must be lowerCamelCase ──────────────

/** SW-NAME-07: Functions must be lowerCamelCase */
const sw_name_07: Rule = {
    id: 'SW-NAME-07',
    name: 'Function lowerCamelCase',
    description: 'Function and method names must use lowerCamelCase.',
    severity: 'medium',
    guideSection: '§Identifiers',
    guideUrl: 'https://google.github.io/swift/#identifiers',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || getCleanLines(lines);
        linesToUse.forEach((line, i) => {
            // Match: func FooBar( -- starts with uppercase
            const match = /^\s*(?:public\s+|private\s+|internal\s+|fileprivate\s+|open\s+|override\s+|static\s+|class\s+|@\w+\s+)*func\s+([A-Z][a-zA-Z0-9]*)\s*[\(<]/.exec(line);
            if (match) {
                const name = match[1];
                violations.push(createViolation(
                    sw_name_07,
                    i + 1,
                    `Function name '${name}' should use lowerCamelCase.`,
                    `Rename to '${name.charAt(0).toLowerCase() + name.slice(1)}'.`,
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

// ── SW-ACCESS-02: Redundant internal access modifier ────────────────────────

/** SW-ACCESS-02: No redundant internal keyword */
const sw_access_02: Rule = {
    id: 'SW-ACCESS-02',
    name: 'No Redundant Internal',
    description: 'The internal access modifier is the default and should not be written explicitly.',
    severity: 'low',
    guideSection: '§Access Levels',
    guideUrl: 'https://google.github.io/swift/#access-levels',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || getCleanLines(lines);
        linesToUse.forEach((line, i) => {
            // Match: internal func/var/let/class/struct/enum/protocol at declaration level
            if (/^\s*internal\s+(func|var|let|class|struct|enum|protocol|typealias)\b/.test(line)) {
                violations.push(createViolation(
                    sw_access_02,
                    i + 1,
                    'Redundant "internal" access modifier (internal is the default).',
                    'Remove the "internal" keyword.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

// ── SW-FEAT-05: Prefer initializer over legacy NSObject init patterns ───────
// §Initializers -- deferred to AI deep review layer (requires AST)

export const swiftRules: Rule[] = [
    // §Formatting
    sw_fmt_01,    // No tabs
    sw_fmt_02,    // 100-char line limit
    sw_fmt_03,    // K&R braces
    sw_fmt_04,    // Keyword spacing
    sw_fmt_05,    // Operator spacing
    sw_fmt_06,    // Empty blocks
    sw_fmt_07,    // No trailing whitespace
    sw_fmt_08,    // No multiple blank lines
    sw_fmt_09,    // 2-space indentation
    // §Imports
    sw_imp_01,    // Import ordering
    // §Statements
    sw_stmt_01,   // No semicolons
    sw_stmt_02,   // One statement per line
    // §Naming
    sw_name_01,   // lowerCamelCase constants
    sw_name_02,   // Acronyms as words
    sw_name_03,   // No Hungarian prefix
    sw_name_04,   // No leading underscore
    sw_name_05,   // UpperCamelCase types
    sw_name_06,   // Enum case lowerCamelCase
    sw_name_07,   // Function lowerCamelCase
    // §Documentation
    sw_doc_01,    // No Javadoc comments
    sw_doc_02,    // Public decl needs ///
    // §Programming Practices
    sw_opt_01,    // No force-unwrap
    sw_opt_02,    // No IUO properties
    sw_prop_01,   // Omit get in read-only property
    sw_ctrl_01,   // No lone fallthrough
    sw_ctrl_02,   // Prefer guard for early exits
    sw_type_01,   // Use shorthand types
    sw_type_02,   // Use Void not ()
    sw_feat_01,   // Avoid explicit self
    sw_feat_02,   // No print()
    sw_feat_03,   // Use trailing closure syntax
    sw_err_01,    // No force-try
    sw_err_02,    // No force cast
    sw_access_01, // No extension-level access modifier
    sw_access_02, // No redundant internal
];
