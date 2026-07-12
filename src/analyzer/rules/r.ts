import { Rule, Violation } from '../../types.js';

/**
 * R Rules Module for avvarre.
 *
 * Target: Google R Style Guide (Tidyverse fork)
 * https://google.github.io/styleguide/Rguide.html
 * https://style.tidyverse.org/syntax.html
 */

/**
 * Strip comments and string literals from R source while preserving
 * line count. Handles:
 * - Single-line comments (#)
 * - Double-quoted strings ("...")
 * - Single-quoted strings ('...')
 */
export function getCleanLines(lines: string[]): string[] {
    return lines.map(line => {
        let clean = '';
        let inString: string | null = null;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (inString) {
                if (ch === '\\') { clean += '  '; i++; continue; }
                if (ch === inString) { clean += ' '; inString = null; continue; }
                clean += ' ';
            } else {
                if (ch === '#') { break; } // rest is comment
                if (ch === '"' || ch === "'") { inString = ch; clean += ' '; continue; }
                clean += ch;
            }
        }
        return clean;
    });
}

function createViolation(
    rule: Rule, line: number, message: string, suggestion: string, snippet: string
): Violation {
    return {
        ruleId: rule.id,
        ruleName: rule.name,
        severity: rule.severity,
        line,
        message,
        suggestion,
        codeSnippet: snippet,
        guideUrl: rule.guideUrl || '',
    };
}

// ── R-FMT-01: No tabs ──────────────────────────────────────────────

const r_fmt_01: Rule = {
    id: 'R-FMT-01',
    name: 'No Tabs',
    description: 'Use spaces (2) for indentation, not tabs.',
    severity: 'medium',
    guideSection: '§Syntax/Spacing',
    guideUrl: 'https://style.tidyverse.org/syntax.html#spacing',
    check: (lines) => {
        const violations: Violation[] = [];
        lines.forEach((line, i) => {
            if (line.includes('\t')) {
                violations.push(createViolation(
                    r_fmt_01, i + 1,
                    'Tab character found. Use 2 spaces for indentation.',
                    'Replace tabs with 2 spaces.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

// ── R-FMT-02: Line length ──────────────────────────────────────────

const r_fmt_02: Rule = {
    id: 'R-FMT-02',
    name: 'Line Length',
    description: 'Lines should not exceed 80 characters.',
    severity: 'low',
    guideSection: '§Files/Length',
    guideUrl: 'https://style.tidyverse.org/files.html',
    check: (lines) => {
        const violations: Violation[] = [];
        lines.forEach((line, i) => {
            if (line.replace(/\r$/, '').length > 80) {
                violations.push(createViolation(
                    r_fmt_02, i + 1,
                    `Line exceeds 80 characters (${line.replace(/\r$/, '').length}).`,
                    'Break long lines.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

// ── R-FMT-03: Brace placement ──────────────────────────────────────

const r_fmt_03: Rule = {
    id: 'R-FMT-03',
    name: 'Brace Placement',
    description: '{ should be the last character on its line.',
    severity: 'medium',
    guideSection: '§Syntax/Braces',
    guideUrl: 'https://style.tidyverse.org/syntax.html#braced-expressions',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            const trimmed = line.trim();
            // { should not appear at the start of a new line (should be on prev line)
            if (/^\{$/.test(trimmed)) {
                violations.push(createViolation(
                    r_fmt_03, i + 1,
                    '{ should be on the same line as if/for/while/function, not a new line.',
                    'Move { to the end of the previous line.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

// ── R-FMT-04: Comma spacing ────────────────────────────────────────

const r_fmt_04: Rule = {
    id: 'R-FMT-04',
    name: 'Comma Spacing',
    description: 'Always put a space after a comma, never before.',
    severity: 'low',
    guideSection: '§Syntax/Spacing',
    guideUrl: 'https://style.tidyverse.org/syntax.html#commas',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            if (/,[^\s]/.test(line) && !/,\s*$/.test(line)) {
                violations.push(createViolation(
                    r_fmt_04, i + 1,
                    'Missing space after comma.',
                    'Add a space after each comma.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

// ── R-FMT-05: Infix operator spacing ───────────────────────────────

const r_fmt_05: Rule = {
    id: 'R-FMT-05',
    name: 'Operator Spacing',
    description: 'Infix operators (<-, ==, +, etc.) should be surrounded by spaces.',
    severity: 'low',
    guideSection: '§Syntax/Spacing',
    guideUrl: 'https://style.tidyverse.org/syntax.html#infix-operators',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            // Check for <-without spaces
            if (/\w<-\w/.test(line) || /\w<-$/.test(line)) {
                violations.push(createViolation(
                    r_fmt_05, i + 1,
                    'Missing spaces around <- operator.',
                    'Add spaces: x <- value.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

// ── R-FMT-06: Space before { ───────────────────────────────────────

const r_fmt_06: Rule = {
    id: 'R-FMT-06',
    name: 'Space Before Brace',
    description: 'Place a space before { in if/for/while/function.',
    severity: 'low',
    guideSection: '§Syntax/Spacing',
    guideUrl: 'https://style.tidyverse.org/syntax.html#parentheses',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            if (/\)\{/.test(line)) {
                violations.push(createViolation(
                    r_fmt_06, i + 1,
                    'Missing space before {.',
                    'Add a space: ) {',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

// ── R-NAME-01: Function naming (BigCamelCase) ──────────────────────

const r_name_01: Rule = {
    id: 'R-NAME-01',
    name: 'Function BigCamelCase',
    description: 'Functions should use BigCamelCase (Google R Style).',
    severity: 'medium',
    guideSection: '§Syntax/Naming',
    guideUrl: 'https://google.github.io/styleguide/Rguide.html#naming-conventions',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            // Match: funcName <- function(
            const match = /^\s*(\w+)\s*<-\s*function\s*\(/.exec(line);
            if (match) {
                const name = match[1];
                // BigCamelCase: starts with uppercase, no underscores
                if (!/^[A-Z][a-zA-Z0-9]*$/.test(name) && !/^\./.test(name)) {
                    violations.push(createViolation(
                        r_name_01, i + 1,
                        `Function '${name}' should use BigCamelCase.`,
                        `Rename to '${name.split(/[_.]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}'.`,
                        lines[i].trim()
                    ));
                }
            }
        });
        return violations;
    }
};

// ── R-NAME-02: Variable naming (snake_case) ────────────────────────

const r_name_02: Rule = {
    id: 'R-NAME-02',
    name: 'Variable snake_case',
    description: 'Variables and objects should use snake_case.',
    severity: 'low',
    guideSection: '§Syntax/Naming',
    guideUrl: 'https://style.tidyverse.org/syntax.html#object-names',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            // Match variable assignment (not function)
            const match = /^\s*(\w+)\s*<-\s*(?!function)/.exec(line);
            if (match) {
                const name = match[1];
                // Bad: camelCase or dot.case (but skip single letter and SHOUTING)
                if (/[A-Z]/.test(name) && name.length > 1 && !/^[A-Z_]+$/.test(name)) {
                    violations.push(createViolation(
                        r_name_02, i + 1,
                        `Variable '${name}' should use snake_case.`,
                        'Use lowercase_with_underscores.',
                        lines[i].trim()
                    ));
                }
            }
        });
        return violations;
    }
};

// ── R-NAME-03: Avoid single-letter names ────────────────────────────

const r_name_03: Rule = {
    id: 'R-NAME-03',
    name: 'Avoid Single-Letter Names',
    description: 'Avoid single-letter variable names except in short loops.',
    severity: 'low',
    guideSection: '§Syntax/Naming',
    guideUrl: 'https://style.tidyverse.org/syntax.html#object-names',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            const match = /^\s*([a-zA-Z])\s*<-/.exec(line);
            if (match && !/for\s*\(/.test(line)) {
                violations.push(createViolation(
                    r_name_03, i + 1,
                    `Single-letter variable name '${match[1]}'. Use descriptive names.`,
                    'Use a meaningful name.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

// ── R-ASGN-01: Use <- not = ────────────────────────────────────────

const r_asgn_01: Rule = {
    id: 'R-ASGN-01',
    name: 'Use <- for Assignment',
    description: 'Use <- not = for assignment.',
    severity: 'medium',
    guideSection: '§Syntax/Assignment',
    guideUrl: 'https://style.tidyverse.org/syntax.html#assignment',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            const trimmed = line.trim();
            // Match: name = value (top-level assignment with =)
            // Exclude: named args in function calls, ==, !=, <=, >=
            if (/^\s*\w+\s*=[^=<>!]/.test(trimmed) && !/^\s*\w+\s*=\s*\w+\s*,/.test(trimmed)
                && !/function\s*\(/.test(trimmed) && !/\(.*=/.test(trimmed)) {
                violations.push(createViolation(
                    r_asgn_01, i + 1,
                    "Use '<-' for assignment, not '='.",
                    'Replace = with <-.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

// ── R-ASGN-02: No right-hand assignment ─────────────────────────────

const r_asgn_02: Rule = {
    id: 'R-ASGN-02',
    name: 'No Right-hand Assignment',
    description: 'Do not use right-hand assignment (->).',
    severity: 'medium',
    guideSection: '§Pipes/Assignment',
    guideUrl: 'https://google.github.io/styleguide/Rguide.html#right-hand-assignment',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            // Match -> used as right-hand assignment (not inside %>% or |>)
            if (/\s->\s+\w/.test(line) || /\s->\s*$/.test(line)) {
                violations.push(createViolation(
                    r_asgn_02, i + 1,
                    "Don't use right-hand assignment (->).",
                    'Use left-hand assignment: result <- expression.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

// ── R-ASGN-03: No semicolons ───────────────────────────────────────

const r_asgn_03: Rule = {
    id: 'R-ASGN-03',
    name: 'No Semicolons',
    description: 'Do not use semicolons to separate commands.',
    severity: 'medium',
    guideSection: '§Syntax/Semicolons',
    guideUrl: 'https://style.tidyverse.org/syntax.html#semicolons',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            if (/;/.test(line)) {
                violations.push(createViolation(
                    r_asgn_03, i + 1,
                    'Semicolons should not be used in R.',
                    'Put each command on its own line.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

// ── R-FUNC-01: Explicit return() ────────────────────────────────────

const r_func_01: Rule = {
    id: 'R-FUNC-01',
    name: 'Explicit return()',
    description: 'Use explicit return() in function bodies.',
    severity: 'medium',
    guideSection: '§Pipes/Returns',
    guideUrl: 'https://google.github.io/styleguide/Rguide.html#use-explicit-returns',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        let inFunction = false;
        let braceDepth = 0;
        let funcStartLine = 0;
        let lastExprLine = -1;
        let lastExprText = '';
        let hasReturn = false;

        searchLines.forEach((line, i) => {
            const trimmed = line.trim();
            if (/\bfunction\s*\(/.test(trimmed)) {
                inFunction = true;
                hasReturn = false;
                funcStartLine = i;
            }
            if (inFunction) {
                const opens = (trimmed.match(/\{/g) || []).length;
                const closes = (trimmed.match(/\}/g) || []).length;
                braceDepth += opens - closes;

                if (/\breturn\s*\(/.test(trimmed)) hasReturn = true;

                if (trimmed && !/^\s*[#{}]/.test(trimmed) && !/^\s*\)/.test(trimmed)) {
                    lastExprLine = i;
                    lastExprText = trimmed;
                }

                if (braceDepth <= 0 && inFunction && i > funcStartLine) {
                    if (!hasReturn && lastExprLine >= 0 && lastExprText) {
                        violations.push(createViolation(
                            r_func_01, lastExprLine + 1,
                            'Missing explicit return(). Use return() for clarity.',
                            'Wrap the last expression in return().',
                            lines[lastExprLine].trim()
                        ));
                    }
                    inFunction = false;
                    braceDepth = 0;
                    lastExprLine = -1;
                    lastExprText = '';
                }
            }
        });
        return violations;
    }
};

// ── R-FUNC-02: No attach() ─────────────────────────────────────────

const r_func_02: Rule = {
    id: 'R-FUNC-02',
    name: "Don't Use attach()",
    description: "Don't use attach(). It creates error-prone environments.",
    severity: 'high',
    guideSection: '§Syntax/Attach',
    guideUrl: 'https://google.github.io/styleguide/Rguide.html#dont-use-attach',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            if (/\battach\s*\(/.test(line)) {
                violations.push(createViolation(
                    r_func_02, i + 1,
                    "Don't use attach(). Use with() or direct $ access.",
                    'Replace with data$column or with(data, expr).',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

// ── R-STY-01: TRUE/FALSE not T/F ───────────────────────────────────

const r_sty_01: Rule = {
    id: 'R-STY-01',
    name: 'Use TRUE/FALSE',
    description: 'Use TRUE and FALSE, not T and F.',
    severity: 'medium',
    guideSection: '§Syntax/Logical',
    guideUrl: 'https://style.tidyverse.org/syntax.html#logical-vectors',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            // Match standalone T or F used as logical values
            if (/(?:^|[\s,=(])T(?:[\s,)\]]|$)/.test(line) && !/TRUE/.test(line) && !/\bT\s*<-/.test(line)) {
                violations.push(createViolation(
                    r_sty_01, i + 1,
                    "Use TRUE instead of T. T can be overwritten.",
                    'Replace T with TRUE.',
                    lines[i].trim()
                ));
            }
            if (/(?:^|[\s,=(])F(?:[\s,)\]]|$)/.test(line) && !/FALSE/.test(line) && !/\bF\s*<-/.test(line)) {
                violations.push(createViolation(
                    r_sty_01, i + 1,
                    "Use FALSE instead of F. F can be overwritten.",
                    'Replace F with FALSE.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

// ── R-STY-02: Use double quotes ─────────────────────────────────────

const r_sty_02: Rule = {
    id: 'R-STY-02',
    name: 'Use Double Quotes',
    description: 'Use " for strings, not \'.',
    severity: 'low',
    guideSection: '§Syntax/Strings',
    guideUrl: 'https://style.tidyverse.org/syntax.html#character-vectors',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        // We check raw lines for string quotes, but skip comment lines
        const searchLines = cleanLines || getCleanLines(lines);
        lines.forEach((line, i) => {
            // Skip lines that are entirely comments
            if (searchLines[i].trim() === '' && /^\s*#/.test(line)) return;
            const beforeComment = line.split('#')[0];
            // Match single-quoted strings (not containing double quotes)
            if (/'[^"]*'/.test(beforeComment) && !/"/.test(beforeComment)) {
                violations.push(createViolation(
                    r_sty_02, i + 1,
                    'Use double quotes " for strings, not single quotes \'.',
                    "Replace ' with \".",
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

// ── R-STY-03: Comment format ────────────────────────────────────────

const r_sty_03: Rule = {
    id: 'R-STY-03',
    name: 'Comment Format',
    description: 'Comments should start with # followed by a space.',
    severity: 'low',
    guideSection: '§Syntax/Comments',
    guideUrl: 'https://style.tidyverse.org/syntax.html#comments',
    check: (lines) => {
        const violations: Violation[] = [];
        lines.forEach((line, i) => {
            const match = /^\s*#[^ #!\n\r]/.exec(line);
            if (match) {
                violations.push(createViolation(
                    r_sty_03, i + 1,
                    'Comments should start with # followed by a space.',
                    'Add a space: # comment.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

// ── R-CTRL-01: Space before ( in control flow ───────────────────────

const r_ctrl_01: Rule = {
    id: 'R-CTRL-01',
    name: 'Control Flow Spacing',
    description: 'Place a space before ( in if/for/while.',
    severity: 'low',
    guideSection: '§Syntax/Spacing',
    guideUrl: 'https://style.tidyverse.org/syntax.html#parentheses',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            if (/\b(if|for|while)\(/.test(line)) {
                violations.push(createViolation(
                    r_ctrl_01, i + 1,
                    'Missing space before ( in control flow statement.',
                    'Add a space: if (...), for (...), while (...).',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

// ── R-CTRL-02: else on same line as } ───────────────────────────────

const r_ctrl_02: Rule = {
    id: 'R-CTRL-02',
    name: 'else Placement',
    description: 'else should be on the same line as the closing }.',
    severity: 'medium',
    guideSection: '§Syntax/ControlFlow',
    guideUrl: 'https://style.tidyverse.org/syntax.html#if-statements',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        for (let i = 1; i < searchLines.length; i++) {
            const line = searchLines[i];
            // Flag any 'else' that starts its own line
            if (/^\s*else\b/.test(line)) {
                // Find previous non-empty line
                let prevIdx = i - 1;
                while (prevIdx >= 0 && searchLines[prevIdx].trim() === '') prevIdx--;
                const prevLine = prevIdx >= 0 ? searchLines[prevIdx].trim() : '';
                // Violation if previous non-blank line does NOT end with }
                if (!prevLine.endsWith('}')) {
                    violations.push(createViolation(
                        r_ctrl_02, i + 1,
                        "'else' should be on the same line as the closing '}'.",
                        'Write: } else { on the same line.',
                        lines[i].trim()
                    ));
                }
            }
        }
        return violations;
    }
};

// ── R-NS-01: Qualify namespaces ─────────────────────────────────────

const r_ns_01: Rule = {
    id: 'R-NS-01',
    name: 'Qualify Namespaces',
    description: 'Use :: to qualify external package functions.',
    severity: 'low',
    guideSection: '§Syntax/Namespaces',
    guideUrl: 'https://google.github.io/styleguide/Rguide.html#qualifying-namespaces',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            // Check for library() calls which load entire namespaces
            if (/\blibrary\s*\(/.test(line) && !/^\s*#/.test(line)) {
                violations.push(createViolation(
                    r_ns_01, i + 1,
                    'Prefer :: namespace qualification over library() loading.',
                    'Use pkg::func() instead of library(pkg).',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

// ── R-NAME-04: No dot.case naming ─────────────────────────────────

const r_name_04: Rule = {
    id: 'R-NAME-04',
    name: 'No dot.case Names',
    description: 'Avoid dot.case naming (e.g. my.variable). Use snake_case instead.',
    severity: 'low',
    guideSection: '§Syntax/Naming',
    guideUrl: 'https://google.github.io/styleguide/Rguide.html#naming-conventions',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            // Match assignment of a dot.case variable (e.g. my.var <- )
            // Exclude: function calls like data.frame(), class methods, built-ins
            const m = /^\s*([a-z][a-zA-Z0-9]*\.[a-z][a-zA-Z0-9.]*)\s*<-/.exec(line);
            if (m) {
                const name = m[1];
                // Skip common R built-in dot names and S3 generics
                if (/^(data\.frame|read\.csv|write\.csv|read\.table|write\.table|is\.|as\.|t\.test|wilcox\.test|var\.test|cor\.test|n\.obs)/.test(name)) return;
                violations.push(createViolation(
                    r_name_04, i + 1,
                    `Variable '${name}' uses dot.case naming. Use snake_case instead.`,
                    `Rename to '${name.replace(/\./g, '_')}'.`,
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

// ── R-STY-04: No trailing whitespace ───────────────────────────────

const r_sty_04: Rule = {
    id: 'R-STY-04',
    name: 'No Trailing Whitespace',
    description: 'Lines should not have trailing whitespace.',
    severity: 'low',
    guideSection: '§Syntax/Whitespace',
    guideUrl: 'https://style.tidyverse.org/syntax.html#spacing',
    check: (lines) => {
        const violations: Violation[] = [];
        lines.forEach((line, i) => {
            if (/[ \t]+\r?$/.test(line) && line.trim() !== '') {
                violations.push(createViolation(
                    r_sty_04, i + 1,
                    'Trailing whitespace found.',
                    'Remove trailing whitespace from this line.',
                    lines[i]
                ));
            }
        });
        return violations;
    }
};

// ── R-PIPE-01: Space before pipe operator ──────────────────────────

const r_pipe_01: Rule = {
    id: 'R-PIPE-01',
    name: 'Pipe Spacing',
    description: 'Pipe operators (%>% and |>) should have a space before and after.',
    severity: 'low',
    guideSection: '§Pipes',
    guideUrl: 'https://style.tidyverse.org/pipes.html',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            // Detect %>% or |> without space before
            if (/\S%>%|\S\|>/.test(line)) {
                violations.push(createViolation(
                    r_pipe_01, i + 1,
                    'Missing space before pipe operator (%>% or |>).',
                    'Add a space before the pipe: x %>% f().',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

// ── R-PIPE-02: Pipe on end of line ─────────────────────────────────

const r_pipe_02: Rule = {
    id: 'R-PIPE-02',
    name: 'Pipe Line Break',
    description: 'In multi-step pipes, the pipe operator should be the last token on the line (not the first).',
    severity: 'low',
    guideSection: '§Pipes',
    guideUrl: 'https://style.tidyverse.org/pipes.html#long-lines',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            // Flag: line starts with a pipe operator
            if (/^\s*(%>%|\|>)/.test(line)) {
                violations.push(createViolation(
                    r_pipe_02, i + 1,
                    'Pipe operator should be at the end of the previous line, not the start of this line.',
                    'Move the pipe operator to the end of the previous line: x %>%',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

// ── R-DOC-01: Exported functions need Roxygen ──────────────────────

const r_doc_01: Rule = {
    id: 'R-DOC-01',
    name: 'Exported Functions Need Roxygen',
    description: 'Public (exported) functions should have Roxygen2 documentation.',
    severity: 'medium',
    guideSection: '§Documentation',
    guideUrl: 'https://google.github.io/styleguide/Rguide.html#function-documentation',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        for (let i = 0; i < searchLines.length; i++) {
            const clean = searchLines[i];
            // Find a top-level function assignment (BigCamelCase = exported)
            if (/^[A-Z]\w*\s*<-\s*function\s*\(/.test(clean.trim())) {
                // Look backwards for a Roxygen block
                let hasRoxygen = false;
                for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
                    if (lines[j].trim().startsWith("#'")) { hasRoxygen = true; break; }
                    if (lines[j].trim() !== '' && !lines[j].trim().startsWith('#')) break;
                }
                if (!hasRoxygen) {
                    violations.push(createViolation(
                        r_doc_01, i + 1,
                        `Public function is missing Roxygen2 documentation.`,
                        "Add #' @description, @param, and @return above the function.",
                        lines[i].trim()
                    ));
                }
            }
        }
        return violations;
    }
};

// ── R-DOC-02: @param for every parameter ───────────────────────────

const r_doc_02: Rule = {
    id: 'R-DOC-02',
    name: 'Roxygen @param Required',
    description: 'Every function parameter should be documented with @param.',
    severity: 'low',
    guideSection: '§Documentation',
    guideUrl: 'https://google.github.io/styleguide/Rguide.html#function-documentation',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        for (let i = 0; i < searchLines.length; i++) {
            const line = searchLines[i];
            // Match a function definition with named params (not empty)
            const fnMatch = /^[A-Za-z_\.][\w\.]*\s*<-\s*function\s*\(([^)]+)\)/.exec(line.trim());
            if (!fnMatch) continue;

            const paramStr = fnMatch[1];
            const params = paramStr.split(',').map(p => p.trim().split(/[=\s]/)[0]).filter(p => p && p !== '...');
            if (params.length === 0) continue;

            // Collect the Roxygen block above
            const docLines: string[] = [];
            for (let j = i - 1; j >= Math.max(0, i - 20); j--) {
                const t = lines[j].trim();
                if (t.startsWith("#'")) docLines.push(t);
                else if (t === '' || t.startsWith('#')) continue;
                else break;
            }

            if (docLines.length === 0) continue; // R-DOC-01 handles no Roxygen

            const documentedParams = docLines.filter(l => /^#'\s*@param\s+(\w+)/.test(l))
                .map(l => l.match(/^#'\s*@param\s+(\w+)/)![1]);

            for (const param of params) {
                if (!documentedParams.includes(param)) {
                    violations.push(createViolation(
                        r_doc_02, i + 1,
                        `Parameter '${param}' is not documented with @param.`,
                        `Add: #' @param ${param} Description.`,
                        lines[i].trim()
                    ));
                }
            }
        }
        return violations;
    }
};

// ── R-DOC-03: @return required ─────────────────────────────────────

const r_doc_03: Rule = {
    id: 'R-DOC-03',
    name: 'Roxygen @return Required',
    description: 'Functions with a return value should document it with @return.',
    severity: 'low',
    guideSection: '§Documentation',
    guideUrl: 'https://google.github.io/styleguide/Rguide.html#function-documentation',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        for (let i = 0; i < searchLines.length; i++) {
            const line = searchLines[i];
            if (!/^[A-Za-z_\.][\w\.]*\s*<-\s*function\s*\(/.test(line.trim())) continue;

            // Check for Roxygen block above
            const docLines: string[] = [];
            for (let j = i - 1; j >= Math.max(0, i - 20); j--) {
                const t = lines[j].trim();
                if (t.startsWith("#'")) docLines.push(t);
                else if (t === '' || t.startsWith('#')) continue;
                else break;
            }

            if (docLines.length === 0) continue; // R-DOC-01 handles no Roxygen

            const hasReturn = docLines.some(l => /^#'\s*@return\b/.test(l));
            const hasInvisible = docLines.some(l => /^#'\s*@return.*invisible/.test(l));

            // Check if function body has a return() call
            let hasReturnExpr = false;
            for (let j = i + 1; j < Math.min(searchLines.length, i + 25); j++) {
                if (/\breturn\s*\(/.test(searchLines[j])) { hasReturnExpr = true; break; }
                if (/^[A-Za-z].*<-\s*function/.test(searchLines[j].trim())) break;
            }

            if (hasReturnExpr && !hasReturn && !hasInvisible) {
                violations.push(createViolation(
                    r_doc_03, i + 1,
                    'Function is missing @return in Roxygen documentation.',
                    "Add: #' @return Description of return value.",
                    lines[i].trim()
                ));
            }
        }
        return violations;
    }
};

// ── R-FMT-07: Indentation (2 spaces) ──────────────────────────────

const r_fmt_07: Rule = {
    id: 'R-FMT-07',
    name: 'Two-Space Indentation',
    description: 'Use 2 spaces for indentation. Avoid 4 or other widths.',
    severity: 'low',
    guideSection: '§Syntax/Indenting',
    guideUrl: 'https://google.github.io/styleguide/Rguide.html#indenting',
    check: (lines) => {
        const violations: Violation[] = [];
        lines.forEach((line, i) => {
            // Check for odd indentation (1, 3, 5, 7 spaces at line start)
            const m = /^( +)\S/.exec(line);
            if (m && m[1].length % 2 !== 0) {
                violations.push(createViolation(
                    r_fmt_07, i + 1,
                    `Indentation of ${m[1].length} spaces is not a multiple of 2.`,
                    'Use 2-space indentation increments.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

// ── R-NAME-05: kConstantCase for constants ────────────────────────

const r_name_05: Rule = {
    id: 'R-NAME-05',
    name: 'kConstant Naming',
    description: 'Constants should use kConstantStyle naming.',
    severity: 'low',
    guideSection: '§Syntax/Naming',
    guideUrl: 'https://google.github.io/styleguide/Rguide.html#naming-conventions',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            // Match SHOUTING_CASE constant assignments (should be kConstant)
            const m = /^\s*([A-Z][A-Z_0-9]{2,})\s*<-\s*(?!function)/.exec(line);
            if (m) {
                const name = m[1];
                violations.push(createViolation(
                    r_name_05, i + 1,
                    `Constant '${name}' should use kConstantStyle (e.g., kMaxSize).`,
                    `Rename to 'k${name.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join('')}'.`,
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

// ── R-NAME-06: File naming (snake_case.R) ─────────────────────────

const r_name_06: Rule = {
    id: 'R-NAME-06',
    name: 'File Naming',
    description: 'R source files should use snake_case naming and end in .R.',
    severity: 'low',
    guideSection: '§Syntax/Naming',
    guideUrl: 'https://google.github.io/styleguide/Rguide.html#naming-conventions',
    check: (lines, filename) => {
        const violations: Violation[] = [];
        if (!filename) return violations;
        const basename = filename.replace(/^.*[\\/]/, '');
        // Check: should end in .R (not .r), and name should be snake_case
        if (/\.r$/.test(basename)) {
            violations.push(createViolation(
                r_name_06, 1,
                `File '${basename}' uses .r extension. Use .R instead.`,
                'Rename the file to use .R extension.',
                ''
            ));
        }
        // Check for non-snake_case names (excluding .R extension)
        const nameOnly = basename.replace(/\.[Rr]$/, '');
        if (nameOnly && /[A-Z]/.test(nameOnly)) {
            violations.push(createViolation(
                r_name_06, 1,
                `File '${basename}' should use snake_case naming.`,
                `Rename to '${nameOnly.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '')}.R'.`,
                ''
            ));
        }
        return violations;
    }
};

// ── R-ASGN-04: No global assignment (<<-) ─────────────────────────

const r_asgn_04: Rule = {
    id: 'R-ASGN-04',
    name: 'No Global Assignment',
    description: 'Avoid using <<- for global assignment. It makes code harder to understand.',
    severity: 'high',
    guideSection: '§Syntax/Assignment',
    guideUrl: 'https://google.github.io/styleguide/Rguide.html#assignment',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            if (/<<-/.test(line)) {
                violations.push(createViolation(
                    r_asgn_04, i + 1,
                    'Avoid global assignment with <<-. It modifies parent environments.',
                    'Restructure code to avoid <<-. Return values instead.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

// ── R-FUNC-03: No setwd() ─────────────────────────────────────────

const r_func_03: Rule = {
    id: 'R-FUNC-03',
    name: 'No setwd()',
    description: 'Avoid setwd(). It changes global state and makes scripts non-reproducible.',
    severity: 'high',
    guideSection: '§Syntax/Attach',
    guideUrl: 'https://google.github.io/styleguide/Rguide.html',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            if (/\bsetwd\s*\(/.test(line)) {
                violations.push(createViolation(
                    r_func_03, i + 1,
                    'Avoid setwd(). It changes global state and reduces reproducibility.',
                    'Use file.path() or here::here() for path construction.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

// ── R-FUNC-04: Use vapply over sapply ──────────────────────────────

const r_func_04: Rule = {
    id: 'R-FUNC-04',
    name: 'Use vapply Not sapply',
    description: 'Use vapply() instead of sapply(). vapply has a predictable return type.',
    severity: 'medium',
    guideSection: '§Syntax/FunctionCalls',
    guideUrl: 'https://google.github.io/styleguide/Rguide.html',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            if (/\bsapply\s*\(/.test(line)) {
                violations.push(createViolation(
                    r_func_04, i + 1,
                    'Use vapply() instead of sapply(). sapply() has unpredictable return type.',
                    'Replace sapply(...) with vapply(..., FUN.VALUE = <type>).',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

// ── R-STY-05: TODO format ──────────────────────────────────────────

const r_sty_05: Rule = {
    id: 'R-STY-05',
    name: 'TODO Format',
    description: 'TODOs should follow the format TODO(username): description.',
    severity: 'low',
    guideSection: '§Syntax/TODO',
    guideUrl: 'https://google.github.io/styleguide/Rguide.html#todo-style',
    check: (lines) => {
        const violations: Violation[] = [];
        lines.forEach((line, i) => {
            // Match TODO not followed by (username)
            if (/\bTODO\b/.test(line) && !/\bTODO\s*\(\w+\)/.test(line)) {
                violations.push(createViolation(
                    r_sty_05, i + 1,
                    'TODO should include a username: TODO(username): description.',
                    'Use format: # TODO(username): Fix this issue.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

// ── R-FUNC-05: No source() ────────────────────────────────────────

const r_func_05: Rule = {
    id: 'R-FUNC-05',
    name: 'Avoid source()',
    description: 'Avoid source(). Use packages or proper module systems instead.',
    severity: 'medium',
    guideSection: '§Syntax/Attach',
    guideUrl: 'https://google.github.io/styleguide/Rguide.html',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            if (/\bsource\s*\(/.test(line)) {
                violations.push(createViolation(
                    r_func_05, i + 1,
                    'Avoid source(). It pollutes the global namespace.',
                    'Organize code into packages or use box::use() for modules.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

// ── R-CTRL-03: No nested ifelse() deeply ───────────────────────────

const r_ctrl_03: Rule = {
    id: 'R-CTRL-03',
    name: 'No Deeply Nested ifelse',
    description: 'Avoid deeply nested ifelse() calls. Use dplyr::case_when() instead.',
    severity: 'medium',
    guideSection: '§Syntax/ControlFlow',
    guideUrl: 'https://google.github.io/styleguide/Rguide.html',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            // Detect nested ifelse: ifelse(...ifelse(
            if (/\bifelse\s*\(.*\bifelse\s*\(/.test(line)) {
                violations.push(createViolation(
                    r_ctrl_03, i + 1,
                    'Nested ifelse() calls are hard to read.',
                    'Use dplyr::case_when() for multiple conditions.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

// §Organization/Layout — deferred to AI deep review layer (function ordering, section breaks)
// §Documentation/PackageLevel — deferred to AI deep review layer (DESCRIPTION, NAMESPACE)

export const rRules: Rule[] = [
    r_fmt_01,
    r_fmt_02,
    r_fmt_03,
    r_fmt_04,
    r_fmt_05,
    r_fmt_06,
    r_fmt_07,
    r_name_01,
    r_name_02,
    r_name_03,
    r_name_04,
    r_name_05,
    r_name_06,
    r_asgn_01,
    r_asgn_02,
    r_asgn_03,
    r_asgn_04,
    r_func_01,
    r_func_02,
    r_func_03,
    r_func_04,
    r_func_05,
    r_sty_01,
    r_sty_02,
    r_sty_03,
    r_sty_04,
    r_sty_05,
    r_ctrl_01,
    r_ctrl_02,
    r_ctrl_03,
    r_ns_01,
    r_pipe_01,
    r_pipe_02,
    r_doc_01,
    r_doc_02,
    r_doc_03,
];
