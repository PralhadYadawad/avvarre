import { Rule, Violation, Language } from '../../types.js';

/**
 * Hardened tokenizer for Shell (Bash).
 * Strips comments (#), string literals, and heredocs while preserving line count.
 */
export function getShellCleanLines(lines: string[]): string[] {
    const cleanLines: string[] = [];
    let inHeredoc = false;
    let heredocMarker = '';

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // 1. Handle Heredocs
        if (inHeredoc) {
            if (line.trim() === heredocMarker) {
                inHeredoc = false;
                cleanLines.push(' '.repeat(line.length)); // Keep line for count
                continue;
            }
            cleanLines.push(' '.repeat(line.length));
            continue;
        }

        const heredocMatch = line.match(/<<-?\s*["']?([a-zA-Z0-9_]+)["']?/);
        if (heredocMatch) {
            inHeredoc = true;
            heredocMarker = heredocMatch[1];
            // We keep the first line of heredoc but strip everything after the marker
            const pos = line.indexOf('<<');
            const prefix = line.substring(0, pos);
            cleanLines.push(prefix + ' '.repeat(line.length - pos));
            continue;
        }

        // 2. Strip comments starting with # (but not #! in first line)
        if (i === 0 && line.startsWith('#!')) {
            // Keep shebang
        } else {
            line = line.replace(/(^|[^\\])#.*$/, '$1');
        }

        // 3. Strip string literals ("..." and '...')
        line = line.replace(/"[^"\\]*(?:\\.[^"\\]*)*"/g, (match) => ' '.repeat(match.length));
        line = line.replace(/'[^'\\]*(?:\\.[^'\\]*)*'/g, (match) => ' '.repeat(match.length));

        cleanLines.push(line);
    }

    return cleanLines;
}

/**
 * Helper to create a Violation object.
 * Always uses raw lines for codeSnippet display.
 */
const createViolation = (
    ruleId: string,
    message: string,
    severity: 'critical' | 'high' | 'medium' | 'low',
    line: number,
    rawLines: string[],
    filename?: string
): Violation => ({
    ruleId,
    ruleName: 'Shell Style Rule',
    severity,
    line,
    column: 1,
    message,
    suggestion: 'Follow Google Shell Style Guide.',
    guideUrl: 'https://google.github.io/styleguide/shellguide.html',
    codeSnippet: rawLines[line - 1]?.trim() || '',
});

// Helper: get clean lines with fallback
function ensureClean(lines: string[], cleanLines?: string[]): string[] {
    return cleanLines || getShellCleanLines(lines);
}

export const shellRules: Rule[] = [
    // -----------------------------------------------------------------------
    // Section 1: Background
    // -----------------------------------------------------------------------
    {
        id: 'SH-USE-01',
        name: 'Bash Shebang',
        description: 'Executables must start with #!/bin/bash',
        severity: 'high',
        guideSection: '§1.1',
        guideUrl: 'https://google.github.io/styleguide/shellguide.html#s1.1-which-shell-to-use',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const firstLine = lines[0] || '';
            if (!firstLine.startsWith('#!/bin/bash')) {
                violations.push(createViolation(
                    'SH-USE-01',
                    'Scripts must begin with #!/bin/bash.',
                    'high',
                    1,
                    lines,
                    filename
                ));
            }
            return violations;
        }
    },

    // -----------------------------------------------------------------------
    // Section 2: Shell Files and Interpreter Invocation
    // -----------------------------------------------------------------------
    {
        id: 'SH-FILE-01',
        name: 'File Extension',
        description: 'Executables should have no extension; libraries must have .sh extension.',
        severity: 'low',
        guideSection: '§2.1',
        guideUrl: 'https://google.github.io/styleguide/shellguide.html#s2.1-file-extensions',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            if (filename) {
                const parts = filename.split('.');
                if (parts.length > 1) {
                    const ext = parts.pop();
                    if (ext === 'bash' || ext === 'zsh' || ext === 'ksh') {
                        violations.push(createViolation(
                            'SH-FILE-01',
                            'Use .sh extension for libraries, no extension for executables. Avoid .bash/.zsh/.ksh.',
                            'low',
                            1,
                            lines,
                            filename
                        ));
                    }
                }
            }
            return violations;
        }
    },

    // -----------------------------------------------------------------------
    // Section 3: Environment -- STDOUT vs STDERR
    // -----------------------------------------------------------------------
    {
        id: 'SH-ERR-01',
        name: 'Error Redirection',
        description: 'All error messages should go to STDERR.',
        severity: 'medium',
        guideSection: '§3',
        guideUrl: 'https://google.github.io/styleguide/shellguide.html#s3-environment',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const search = ensureClean(lines, cleanLines);

            // We check cleanLines for the echo command structure, but match
            // error keywords against raw lines (since strings are stripped in cleanLines).
            // Strategy: find echo lines in cleanLines, then check raw lines for error keywords.
            search.forEach((cl, i) => {
                if (cl.match(/\becho\b/) || cl.match(/\bprintf\b/)) {
                    const raw = lines[i];
                    if (raw.match(/\b(error|fail|failed|fatal|broken|missing|abort|cannot|unable)\b/i)
                        && !raw.includes('>&2')
                        && !raw.includes('1>&2')
                        && !raw.includes('2>/dev/null')) {
                        violations.push(createViolation(
                            'SH-ERR-01',
                            'Error messages should be sent to STDERR (>&2).',
                            'medium',
                            i + 1,
                            lines,
                            filename
                        ));
                    }
                }
            });
            return violations;
        }
    },

    // -----------------------------------------------------------------------
    // Section 4: Comments
    // -----------------------------------------------------------------------
    {
        id: 'SH-CMT-01',
        name: 'File Header',
        description: 'Every file must have a top-level comment describing its contents.',
        severity: 'medium',
        guideSection: '§4.1',
        guideUrl: 'https://google.github.io/styleguide/shellguide.html#s4.1-file-header',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            // After shebang, the next non-empty lines should be comments
            let foundComment = false;
            for (let i = 1; i < Math.min(lines.length, 10); i++) {
                const trimmed = lines[i].trim();
                if (trimmed === '') continue;
                if (trimmed.startsWith('#')) {
                    foundComment = true;
                    break;
                }
                break; // First non-empty, non-comment line
            }
            if (!foundComment && lines.length > 5) {
                violations.push(createViolation(
                    'SH-CMT-01',
                    'File should start with a comment describing its contents (after shebang).',
                    'medium',
                    2,
                    lines,
                    filename
                ));
            }
            return violations;
        }
    },
    {
        id: 'SH-CMT-02',
        name: 'Function Comments',
        description: 'All functions must have a comment describing their purpose.',
        severity: 'medium',
        guideSection: '§4.2',
        guideUrl: 'https://google.github.io/styleguide/shellguide.html#s4.2-function-comments',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const search = ensureClean(lines, cleanLines);

            search.forEach((line, i) => {
                const isFuncDecl = line.match(/^\s*(function\s+\w+|[\w_]+\s*\(\s*\))/) && line.includes('{');
                if (isFuncDecl) {
                    // Check previous non-empty line for a comment
                    let hasComment = false;
                    for (let j = i - 1; j >= 0 && j >= i - 3; j--) {
                        const prev = lines[j].trim();
                        if (prev === '') continue;
                        if (prev.startsWith('#')) {
                            hasComment = true;
                        }
                        break;
                    }
                    if (!hasComment) {
                        violations.push(createViolation(
                            'SH-CMT-02',
                            'Functions should have a comment describing their purpose.',
                            'medium',
                            i + 1,
                            lines,
                            filename
                        ));
                    }
                }
            });
            return violations;
        }
    },
    {
        id: 'SH-CMT-03',
        name: 'TODO Format',
        description: 'TODO format: # TODO(user): description',
        severity: 'low',
        guideSection: '§4.4',
        guideUrl: 'https://google.github.io/styleguide/shellguide.html#s4.4-todo-comments',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            // Check raw lines since TODOs are in comments
            lines.forEach((line, i) => {
                if (line.match(/#.*\bTODO\b/) && !line.match(/#\s*TODO(\([a-zA-Z0-9._-]+\))?:\s+.+/)) {
                    violations.push(createViolation(
                        'SH-CMT-03',
                        'Use format: # TODO(username): description.',
                        'low',
                        i + 1,
                        lines,
                        filename
                    ));
                }
            });
            return violations;
        }
    },

    // -----------------------------------------------------------------------
    // Section 5: Formatting
    // -----------------------------------------------------------------------
    {
        id: 'SH-FMT-01',
        name: 'Indentation',
        description: 'Indent with 2 spaces. No tabs.',
        severity: 'low',
        guideSection: '§5.1',
        guideUrl: 'https://google.github.io/styleguide/shellguide.html#s5.1-indentation',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            // Whitespace rule: uses raw lines intentionally
            lines.forEach((line, i) => {
                if (line.includes('\t')) {
                    violations.push(createViolation(
                        'SH-FMT-01',
                        'Tabs are forbidden; use 2 spaces for indentation.',
                        'low',
                        i + 1,
                        lines,
                        filename
                    ));
                } else {
                    const match = line.match(/^( +)\S/);
                    if (match && match[1].length % 2 !== 0) {
                        violations.push(createViolation(
                            'SH-FMT-01',
                            'Indent with 2 spaces (odd indent detected).',
                            'low',
                            i + 1,
                            lines,
                            filename
                        ));
                    }
                }
            });
            return violations;
        }
    },
    {
        id: 'SH-FMT-02',
        name: 'Line Length',
        description: 'Maximum line length is 80 characters.',
        severity: 'low',
        guideSection: '§5.2',
        guideUrl: 'https://google.github.io/styleguide/shellguide.html#s5.2-line-length-and-long-strings',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            // Line-length rule: uses raw lines intentionally
            lines.forEach((line, i) => {
                if (line.length > 80) {
                    violations.push(createViolation(
                        'SH-FMT-02',
                        `Line exceeds 80 characters (${line.length}).`,
                        'low',
                        i + 1,
                        lines,
                        filename
                    ));
                }
            });
            return violations;
        }
    },
    {
        id: 'SH-PIPE-01',
        name: 'Pipeline Formatting',
        description: 'Long pipes should be split one per line with | on the new line.',
        severity: 'low',
        guideSection: '§5.3',
        guideUrl: 'https://google.github.io/styleguide/shellguide.html#s5.3-pipelines',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const search = ensureClean(lines, cleanLines);

            search.forEach((line, i) => {
                // Count pipes in a single line (3+ pipes on a long line means it should be split)
                const pipeCount = (line.match(/\|(?!\|)/g) || []).length;
                if (pipeCount >= 3 && lines[i].length > 60) {
                    violations.push(createViolation(
                        'SH-PIPE-01',
                        'Long pipelines (3+ pipes) should be split with one pipe per line.',
                        'low',
                        i + 1,
                        lines,
                        filename
                    ));
                }
            });
            return violations;
        }
    },
    {
        id: 'SH-FMT-03',
        name: 'Loop Formatting',
        description: 'Put ; do and ; then on the same line as while/for/if.',
        severity: 'low',
        guideSection: '§5.4',
        guideUrl: 'https://google.github.io/styleguide/shellguide.html#s5.4-loops',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const search = ensureClean(lines, cleanLines);

            search.forEach((line, i) => {
                const trimmed = line.trim();
                // "do" or "then" alone on a line (should be on same line as for/while/if)
                if (trimmed === 'do' || trimmed === 'then') {
                    violations.push(createViolation(
                        'SH-FMT-03',
                        `"${trimmed}" should be on the same line as the loop/conditional (e.g., "for ...; do").`,
                        'low',
                        i + 1,
                        lines,
                        filename
                    ));
                }
            });
            return violations;
        }
    },
    {
        id: 'SH-FMT-04',
        name: 'Case Statement Formatting',
        description: 'Case patterns should be indented one level; actions another.',
        severity: 'low',
        guideSection: '§5.5',
        guideUrl: 'https://google.github.io/styleguide/shellguide.html#s5.5-case-statement',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const search = ensureClean(lines, cleanLines);
            let inCase = false;

            search.forEach((line, i) => {
                const trimmed = line.trim();
                if (trimmed.match(/^\bcase\b/)) {
                    inCase = true;
                } else if (trimmed === 'esac') {
                    inCase = false;
                }
                // Inside case: check for ;;& or ;& (fall-through) -- just flag unindented patterns
                if (inCase && trimmed.match(/^[a-zA-Z0-9_*"'|\-]+\)/) && !line.match(/^\s{2,}/)) {
                    violations.push(createViolation(
                        'SH-FMT-04',
                        'Case patterns should be indented one level from "case".',
                        'low',
                        i + 1,
                        lines,
                        filename
                    ));
                }
            });
            return violations;
        }
    },
    {
        id: 'SH-FMT-05',
        name: 'Brace Style',
        description: 'Opening brace should be on the same line as the function.',
        severity: 'low',
        guideSection: '§5.4',
        guideUrl: 'https://google.github.io/styleguide/shellguide.html#s5.4-loops',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const search = ensureClean(lines, cleanLines);

            search.forEach((line, i) => {
                if (line.trim() === '{' && i > 0) {
                    violations.push(createViolation(
                        'SH-FMT-05',
                        'Place opening brace "{" on the same line as the function/command.',
                        'low',
                        i + 1,
                        lines,
                        filename
                    ));
                }
            });
            return violations;
        }
    },
    {
        id: 'SH-FMT-06',
        name: 'Variable Expansion Braces',
        description: 'Use ${var} instead of $var for clarity in complex contexts.',
        severity: 'low',
        guideSection: '§5.6',
        guideUrl: 'https://google.github.io/styleguide/shellguide.html#s5.6-variable-expansion',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const search = ensureClean(lines, cleanLines);

            search.forEach((line, i) => {
                // Check for $var immediately followed by alphanumeric (ambiguous expansion)
                const match = line.match(/\$([a-zA-Z_]\w*)[a-zA-Z0-9_]/);
                if (match && !line.includes('${' + match[1] + '}')) {
                    violations.push(createViolation(
                        'SH-FMT-06',
                        `Use \${${match[1]}} instead of $${match[1]} when followed by other characters.`,
                        'low',
                        i + 1,
                        lines,
                        filename
                    ));
                }
            });
            return violations;
        }
    },

    // -----------------------------------------------------------------------
    // Section 5.7: Quoting
    // -----------------------------------------------------------------------
    {
        id: 'SH-VAR-02',
        name: 'Quoted Expansions',
        description: 'Always quote variable expansions "$foo".',
        severity: 'medium',
        guideSection: '§5.7',
        guideUrl: 'https://google.github.io/styleguide/shellguide.html#s5.7-quoting',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const search = ensureClean(lines, cleanLines);

            search.forEach((line, i) => {
                // Ignore segments within [[ ... ]] and $(( ... )) as they are safe
                let sanitizedLine = line.replace(/\[\[.*?\]\]/g, '[]');
                sanitizedLine = sanitizedLine.replace(/\$\(\(.*?\)\)/g, '$()');

                if (sanitizedLine.match(/(^|[^"\\$])(\$[a-zA-Z_][a-zA-Z0-9_]*|\$\{[a-zA-Z_][a-zA-Z0-9_]*\})/)) {
                    violations.push(createViolation(
                        'SH-VAR-02',
                        'Variable expansions must be quoted, e.g., "${foo}".',
                        'medium',
                        i + 1,
                        lines,
                        filename
                    ));
                }
            });
            return violations;
        }
    },

    // -----------------------------------------------------------------------
    // Section 6: Features and Bugs
    // -----------------------------------------------------------------------
    {
        id: 'SH-CMD-01',
        name: 'Command Substitution',
        description: 'Use $(...) instead of backticks.',
        severity: 'medium',
        guideSection: '§6.2',
        guideUrl: 'https://google.github.io/styleguide/shellguide.html#s6.2-command-substitution',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const search = ensureClean(lines, cleanLines);

            search.forEach((line, i) => {
                if (line.includes('`')) {
                    violations.push(createViolation(
                        'SH-CMD-01',
                        'Use $(command) instead of `command`.',
                        'medium',
                        i + 1,
                        lines,
                        filename
                    ));
                }
            });
            return violations;
        }
    },
    {
        id: 'SH-COND-01',
        name: 'Test/Conditionals',
        description: 'Prefer [[ ... ]] over [ ... ] or test.',
        severity: 'medium',
        guideSection: '§6.3',
        guideUrl: 'https://google.github.io/styleguide/shellguide.html#s6.3-test',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const search = ensureClean(lines, cleanLines);

            search.forEach((line, i) => {
                const trimmed = line.trim();
                // Single bracket [ ... ] but not [[ ... ]]
                if (trimmed.match(/(^|\s)\[\s(?!\[)/) || trimmed.match(/^\s*test\s+/)) {
                    violations.push(createViolation(
                        'SH-COND-01',
                        'Prefer [[ ... ]] over [ ... ] or test.',
                        'medium',
                        i + 1,
                        lines,
                        filename
                    ));
                }
            });
            return violations;
        }
    },
    {
        id: 'SH-COND-02',
        name: 'Testing Strings',
        description: 'Use quotes rather than filler characters for testing empty strings.',
        severity: 'low',
        guideSection: '§6.4',
        guideUrl: 'https://google.github.io/styleguide/shellguide.html#s6.4-testing-strings',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const search = ensureClean(lines, cleanLines);

            search.forEach((line, i) => {
                // Detect archaic patterns: [ x"${var}" = x"value" ] or [ -z "${var}" ] with filler x
                if (line.match(/\[\s*x["$]/) || line.match(/=\s*x["$]/)) {
                    violations.push(createViolation(
                        'SH-COND-02',
                        'Use [[ -z "${var}" ]] instead of filler characters for empty string checks.',
                        'low',
                        i + 1,
                        lines,
                        filename
                    ));
                }
            });
            return violations;
        }
    },
    {
        id: 'SH-GLOB-01',
        name: 'Wildcard Expansion',
        description: 'Do not use ls for wildcard expansion; use globbing or find.',
        severity: 'medium',
        guideSection: '§6.5',
        guideUrl: 'https://google.github.io/styleguide/shellguide.html#s6.5-wildcard-expansion-of-filenames',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const search = ensureClean(lines, cleanLines);

            search.forEach((line, i) => {
                // Catch "for f in $(ls ...)" or "files=$(ls ...)"
                if (line.match(/(for\s+\w+\s+in\s+\$\(ls|[\w_]+=\$\(ls)/)) {
                    violations.push(createViolation(
                        'SH-GLOB-01',
                        'Use globbing or find instead of "ls" for wildcard expansion.',
                        'medium',
                        i + 1,
                        lines,
                        filename
                    ));
                }
            });
            return violations;
        }
    },
    {
        id: 'SH-FEAT-01',
        name: 'No Eval',
        description: 'Avoid using eval; it is often unsafe.',
        severity: 'high',
        guideSection: '§6.6',
        guideUrl: 'https://google.github.io/styleguide/shellguide.html#s6.6-eval',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const search = ensureClean(lines, cleanLines);

            search.forEach((line, i) => {
                if (line.match(/\beval\b/)) {
                    violations.push(createViolation(
                        'SH-FEAT-01',
                        'Avoid using "eval". It is dangerous and usually unnecessary.',
                        'high',
                        i + 1,
                        lines,
                        filename
                    ));
                }
            });
            return violations;
        }
    },
    {
        id: 'SH-ARR-01',
        name: 'Arrays for Lists',
        description: 'Use arrays for lists of elements to avoid quoting complications.',
        severity: 'medium',
        guideSection: '§6.7',
        guideUrl: 'https://google.github.io/styleguide/shellguide.html#s6.7-arrays',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const search = ensureClean(lines, cleanLines);

            search.forEach((line, i) => {
                // Detect space-separated lists assigned to a plain variable (not an array)
                // e.g., files="one two three" instead of files=(one two three)
                // Heuristic: variable assigned a string with 3+ space-separated words
                const match = line.match(/^(\s*\w+)=["'](\S+\s+\S+\s+\S+.*)["']/);
                if (match && !line.includes('=(')) {
                    violations.push(createViolation(
                        'SH-ARR-01',
                        'Use arrays for lists of elements instead of space-separated strings.',
                        'medium',
                        i + 1,
                        lines,
                        filename
                    ));
                }
            });
            return violations;
        }
    },
    {
        id: 'SH-PIPE-02',
        name: 'Pipes to While',
        description: 'Use process substitution or for loops rather than piping to while.',
        severity: 'medium',
        guideSection: '§6.8',
        guideUrl: 'https://google.github.io/styleguide/shellguide.html#s6.8-pipes-to-while',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const search = ensureClean(lines, cleanLines);

            search.forEach((line, i) => {
                // Detect "| while read" pattern
                if (line.match(/\|\s*while\b/)) {
                    violations.push(createViolation(
                        'SH-PIPE-02',
                        'Prefer process substitution "while read ...; do ...; done < <(cmd)" over piping to while.',
                        'medium',
                        i + 1,
                        lines,
                        filename
                    ));
                }
            });
            return violations;
        }
    },
    {
        id: 'SH-ARITH-01',
        name: 'Arithmetic Syntax',
        description: 'Use $((...)) for arithmetic, not $[...] or let.',
        severity: 'medium',
        guideSection: '§6.9',
        guideUrl: 'https://google.github.io/styleguide/shellguide.html#s6.9-arithmetic',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const search = ensureClean(lines, cleanLines);

            search.forEach((line, i) => {
                if (line.match(/\$\[/) || line.match(/\blet\s+/)) {
                    violations.push(createViolation(
                        'SH-ARITH-01',
                        'Use $((...)) for arithmetic. Avoid $[...] and "let".',
                        'medium',
                        i + 1,
                        lines,
                        filename
                    ));
                }
            });
            return violations;
        }
    },

    // -----------------------------------------------------------------------
    // Section 7: Naming Conventions
    // -----------------------------------------------------------------------
    {
        id: 'SH-FUNC-01',
        name: 'Function Naming',
        description: 'Function names must be lower_case_with_underscores.',
        severity: 'low',
        guideSection: '§7.1',
        guideUrl: 'https://google.github.io/styleguide/shellguide.html#s7.1-function-names',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const search = ensureClean(lines, cleanLines);

            search.forEach((line, i) => {
                // Detect camelCase or PascalCase function names
                const match = line.match(/^\s*function\s+([A-Z][a-zA-Z0-9_]*)/) ||
                    line.match(/^\s*([A-Z][a-zA-Z0-9_]*)\s*\(\s*\)/);
                if (match) {
                    violations.push(createViolation(
                        'SH-FUNC-01',
                        `Function name "${match[1]}" should be lowercase with underscores.`,
                        'low',
                        i + 1,
                        lines,
                        filename
                    ));
                }
            });
            return violations;
        }
    },
    {
        id: 'SH-NAME-01',
        name: 'Variable Naming',
        description: 'Variable names should be lower_snake_case for locals.',
        severity: 'low',
        guideSection: '§7.2',
        guideUrl: 'https://google.github.io/styleguide/shellguide.html#s7.2-variable-names',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const search = ensureClean(lines, cleanLines);
            let inFunction = false;

            search.forEach((line, i) => {
                const trimmed = line.trim();
                if (trimmed.match(/^\s*(function\s+\w+|\w+\s*\(\s*\))/) && trimmed.includes('{')) {
                    inFunction = true;
                } else if (trimmed === '}') {
                    inFunction = false;
                }

                // Inside functions, local variables should be lowercase
                if (inFunction) {
                    const varMatch = trimmed.match(/^local\s+([A-Z][A-Z0-9_]*[a-z]+\w*)=/);
                    if (varMatch) {
                        violations.push(createViolation(
                            'SH-NAME-01',
                            `Local variable "${varMatch[1]}" should be lower_snake_case.`,
                            'low',
                            i + 1,
                            lines,
                            filename
                        ));
                    }
                }
            });
            return violations;
        }
    },
    {
        id: 'SH-NAME-02',
        name: 'Constant Naming',
        description: 'Constants and environment variable names must be UPPER_SNAKE_CASE.',
        severity: 'low',
        guideSection: '§7.3',
        guideUrl: 'https://google.github.io/styleguide/shellguide.html#s7.3-constants-and-environment-variable-names',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const search = ensureClean(lines, cleanLines);

            search.forEach((line, i) => {
                const trimmed = line.trim();
                // readonly or declare -r with lowercase name
                const roMatch = trimmed.match(/^(readonly|declare\s+-r)\s+([a-z][a-z0-9_]*)=/);
                if (roMatch) {
                    violations.push(createViolation(
                        'SH-NAME-02',
                        `Constant "${roMatch[2]}" should be UPPER_SNAKE_CASE.`,
                        'low',
                        i + 1,
                        lines,
                        filename
                    ));
                }
            });
            return violations;
        }
    },
    {
        id: 'SH-NAME-03',
        name: 'Read-only Variables',
        description: 'Use readonly or declare -r to ensure constants are not modified.',
        severity: 'low',
        guideSection: '§7.5',
        guideUrl: 'https://google.github.io/styleguide/shellguide.html#s7.5-read-only-variables',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const search = ensureClean(lines, cleanLines);

            search.forEach((line, i) => {
                const trimmed = line.trim();
                // Detect UPPER_CASE assignments without readonly
                const match = trimmed.match(/^([A-Z][A-Z0-9_]{2,})=/);
                if (match
                    && !trimmed.startsWith('readonly ')
                    && !trimmed.startsWith('declare ')
                    && !trimmed.startsWith('export ')
                    && !trimmed.startsWith('local ')) {
                    violations.push(createViolation(
                        'SH-NAME-03',
                        `Consider using "readonly ${match[1]}=..." or "declare -r" for constants.`,
                        'low',
                        i + 1,
                        lines,
                        filename
                    ));
                }
            });
            return violations;
        }
    },
    {
        id: 'SH-VAR-01',
        name: 'Local Variables',
        description: 'Always use local for variables in functions.',
        severity: 'medium',
        guideSection: '§7.6',
        guideUrl: 'https://google.github.io/styleguide/shellguide.html#s7.6-use-local-variables',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const search = ensureClean(lines, cleanLines);
            let inFunction = false;
            let braceDepth = 0;

            search.forEach((line, i) => {
                const trimmed = line.trim();
                if (trimmed.match(/^\s*(function\s+\w+|\w+\s*\(\s*\))/) && trimmed.includes('{')) {
                    inFunction = true;
                    braceDepth = 1;
                } else if (inFunction) {
                    if (trimmed.includes('{')) braceDepth++;
                    if (trimmed.includes('}')) braceDepth--;
                    if (braceDepth <= 0) {
                        inFunction = false;
                        braceDepth = 0;
                    }
                }

                if (inFunction) {
                    // Look for assignments like "foo=bar" that don't start with "local " or "readonly "
                    // and are not setting environment variables (ALL_CAPS)
                    if (trimmed.match(/^[a-z_][a-z0-9_]*=/)
                        && !trimmed.startsWith('local ')
                        && !trimmed.startsWith('readonly ')
                        && !trimmed.startsWith('declare ')
                        && !trimmed.startsWith('export ')) {
                        violations.push(createViolation(
                            'SH-VAR-01',
                            'Variable assignment in function must use "local".',
                            'medium',
                            i + 1,
                            lines,
                            filename
                        ));
                    }
                }
            });
            return violations;
        }
    },
    {
        id: 'SH-FUNC-02',
        name: 'Function Location',
        description: 'Put all functions together below constants; do not hide functions between executable statements.',
        severity: 'low',
        guideSection: '§7.7',
        guideUrl: 'https://google.github.io/styleguide/shellguide.html#s7.7-function-location',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const search = ensureClean(lines, cleanLines);
            let lastFuncLine = -1;
            let firstExecLine = -1;

            search.forEach((line, i) => {
                const trimmed = line.trim();
                const isFuncDecl = trimmed.match(/^\s*(function\s+\w+|\w+\s*\(\s*\))/) && trimmed.includes('{');
                const isExecStatement = trimmed !== '' && !trimmed.startsWith('#')
                    && !isFuncDecl && !trimmed.startsWith('source ')
                    && !trimmed.startsWith('. ') && !trimmed.startsWith('readonly ')
                    && !trimmed.startsWith('declare ') && !trimmed.startsWith('export ')
                    && !trimmed.match(/^[A-Z_]+=/) && trimmed !== '}'
                    && !trimmed.startsWith('#!');

                if (isFuncDecl) {
                    if (firstExecLine !== -1 && i > firstExecLine) {
                        if (lastFuncLine === -1 || i > lastFuncLine + 5) {
                            violations.push(createViolation(
                                'SH-FUNC-02',
                                'Functions should be declared together, before executable statements.',
                                'low',
                                i + 1,
                                lines,
                                filename
                            ));
                        }
                    }
                    lastFuncLine = i;
                } else if (isExecStatement && firstExecLine === -1) {
                    firstExecLine = i;
                }
            });
            return violations;
        }
    },
    {
        id: 'SH-FUNC-03',
        name: 'Main Function',
        description: 'Scripts should have a main function called at the bottom.',
        severity: 'low',
        guideSection: '§7.8',
        guideUrl: 'https://google.github.io/styleguide/shellguide.html#s7.8-main',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            if (lines.length > 100) {
                const search = ensureClean(lines, cleanLines);
                const hasMain = search.some(l =>
                    l.trim().match(/^main\s*\(\s*\)/) ||
                    l.trim().match(/^function\s+main\b/)
                );
                if (!hasMain) {
                    violations.push(createViolation(
                        'SH-FUNC-03',
                        'Scripts over 100 lines should implement a "main" function.',
                        'low',
                        1,
                        lines,
                        filename
                    ));
                }
            }
            return violations;
        }
    },
    {
        id: 'SH-FUNC-04',
        name: 'Function Keyword Style',
        description: 'Use function keyword without parentheses, or name() without function keyword.',
        severity: 'low',
        guideSection: '§7.1',
        guideUrl: 'https://google.github.io/styleguide/shellguide.html#s7.1-function-names',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const search = ensureClean(lines, cleanLines);

            search.forEach((line, i) => {
                // Catch mixing both: "function foo()" -- pick one style
                if (line.match(/^\s*function\s+\w+\s*\(\s*\)/)) {
                    violations.push(createViolation(
                        'SH-FUNC-04',
                        'Use "function foo { ... }" or "foo() { ... }" -- do not combine both.',
                        'low',
                        i + 1,
                        lines,
                        filename
                    ));
                }
            });
            return violations;
        }
    },

    // -----------------------------------------------------------------------
    // Section 8: Calling Commands
    // -----------------------------------------------------------------------
    {
        id: 'SH-RET-01',
        name: 'Checking Return Values',
        description: 'Use return for function exit status, not exit.',
        severity: 'medium',
        guideSection: '§8.1',
        guideUrl: 'https://google.github.io/styleguide/shellguide.html#s8.1-checking-return-values',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const search = ensureClean(lines, cleanLines);
            let inFunction = false;
            let braceDepth = 0;

            search.forEach((line, i) => {
                const trimmed = line.trim();
                if (trimmed.match(/^\s*(function\s+\w+|\w+\s*\(\s*\))/) && trimmed.includes('{')) {
                    inFunction = true;
                    braceDepth = 1;
                } else if (inFunction) {
                    if (trimmed.includes('{')) braceDepth++;
                    if (trimmed.includes('}')) braceDepth--;
                    if (braceDepth <= 0) {
                        inFunction = false;
                        braceDepth = 0;
                    }
                }

                if (inFunction && trimmed.match(/\bexit\s+[0-9]/)) {
                    violations.push(createViolation(
                        'SH-RET-01',
                        'Use "return" instead of "exit" inside functions.',
                        'medium',
                        i + 1,
                        lines,
                        filename
                    ));
                }
            });
            return violations;
        }
    },
    {
        id: 'SH-RET-02',
        name: 'Builtin Commands',
        description: 'Prefer builtin commands over external processes where possible.',
        severity: 'low',
        guideSection: '§8.2',
        guideUrl: 'https://google.github.io/styleguide/shellguide.html#s8.2-builtin-commands-vs-external-commands',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const search = ensureClean(lines, cleanLines);

            search.forEach((line, i) => {
                const trimmed = line.trim();
                // Common anti-patterns: using external cat/sed where builtins suffice
                // e.g., "cat file | grep" instead of "grep < file"
                if (trimmed.match(/\bcat\s+\S+\s*\|\s*\w+/)) {
                    violations.push(createViolation(
                        'SH-RET-02',
                        'Avoid useless "cat file | cmd"; use redirection "cmd < file" instead.',
                        'low',
                        i + 1,
                        lines,
                        filename
                    ));
                }
            });
            return violations;
        }
    },

    // -----------------------------------------------------------------------
    // Additional best-practice rules
    // -----------------------------------------------------------------------
    {
        id: 'SH-ALI-01',
        name: 'No Aliases',
        description: 'Aliases are forbidden in scripts; use functions.',
        severity: 'medium',
        guideSection: '§6.2',
        guideUrl: 'https://google.github.io/styleguide/shellguide.html#s6.2-command-substitution',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const search = ensureClean(lines, cleanLines);

            search.forEach((line, i) => {
                if (line.trim().match(/^\s*alias\s+/)) {
                    violations.push(createViolation(
                        'SH-ALI-01',
                        'Aliases are forbidden in scripts; use functions instead.',
                        'medium',
                        i + 1,
                        lines,
                        filename
                    ));
                }
            });
            return violations;
        }
    },
    {
        id: 'SH-OPTS-01',
        name: 'Strict Mode',
        description: 'Use set -e, set -u, and set -o pipefail for robustness.',
        severity: 'medium',
        guideSection: '§1.1',
        guideUrl: 'https://google.github.io/styleguide/shellguide.html#s1.1-which-shell-to-use',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const search = ensureClean(lines, cleanLines);
            const headerCode = search.slice(0, 20).join('\n');

            const hasE = /set\s+-[^ ]*e/.test(headerCode) || headerCode.includes('set -o errexit');
            const hasU = /set\s+-[^ ]*u/.test(headerCode) || headerCode.includes('set -o nounset');
            const hasPipefail = /pipefail/.test(headerCode);

            if (!hasE) {
                violations.push(createViolation('SH-OPTS-01', 'Missing "set -e" (errexit) in script header.', 'medium', 1, lines, filename));
            }
            if (!hasU) {
                violations.push(createViolation('SH-OPTS-01', 'Missing "set -u" (nounset) in script header.', 'medium', 1, lines, filename));
            }
            if (!hasPipefail) {
                violations.push(createViolation('SH-OPTS-01', 'Missing "set -o pipefail" in script header.', 'medium', 1, lines, filename));
            }
            return violations;
        }
    },
    {
        id: 'SH-FEAT-02',
        name: 'No Debug in Production',
        description: 'Avoid using set -x in production scripts.',
        severity: 'low',
        guideSection: '§1.1',
        guideUrl: 'https://google.github.io/styleguide/shellguide.html#s1.1-which-shell-to-use',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const search = ensureClean(lines, cleanLines);

            search.forEach((line, i) => {
                if (line.match(/\bset\s+-[^ ]*x/)) {
                    violations.push(createViolation(
                        'SH-FEAT-02',
                        'Remove "set -x" from production scripts.',
                        'low',
                        i + 1,
                        lines,
                        filename
                    ));
                }
            });
            return violations;
        }
    },
    {
        id: 'SH-HEREDOC-01',
        name: 'Heredoc Indentation',
        description: 'Use <<- for indented heredocs inside functions.',
        severity: 'low',
        guideSection: '§5.2',
        guideUrl: 'https://google.github.io/styleguide/shellguide.html#s5.2-line-length-and-long-strings',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const search = ensureClean(lines, cleanLines);

            search.forEach((line, i) => {
                // If a heredoc starts with << (not <<-) inside indented code
                if (line.match(/^\s{2,}.*<<\s*[A-Z]/) && !line.includes('<<-')) {
                    violations.push(createViolation(
                        'SH-HEREDOC-01',
                        'Use <<- for heredocs inside indented code (allows tab stripping).',
                        'low',
                        i + 1,
                        lines,
                        filename
                    ));
                }
            });
            return violations;
        }
    },
    {
        id: 'SH-PROC-01',
        name: 'Process Substitution',
        description: 'Prefer process substitution <(...) over creating temp files.',
        severity: 'low',
        guideSection: '§6.2',
        guideUrl: 'https://google.github.io/styleguide/shellguide.html#s6.2-command-substitution',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const search = ensureClean(lines, cleanLines);

            search.forEach((line, i) => {
                // Catch common patterns: cmd > /tmp/file && other_cmd < /tmp/file
                if (line.match(/>\s*\/tmp\/\w+/) && !line.includes('>>')) {
                    const nextLines = search.slice(i + 1, i + 4).join(' ');
                    if (nextLines.match(/<\s*\/tmp\/\w+/)) {
                        violations.push(createViolation(
                            'SH-PROC-01',
                            'Consider using process substitution <(...) instead of temp files.',
                            'low',
                            i + 1,
                            lines,
                            filename
                        ));
                    }
                }
            });
            return violations;
        }
    },
    // §6.1 ShellCheck -- deferred to AI deep review layer (requires external tool)
    // §4.3 Implementation Comments -- deferred to AI deep review layer (semantic analysis needed)
];
