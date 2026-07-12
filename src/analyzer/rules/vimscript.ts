/**
 * Vimscript Rules -- Google Vimscript Style Guide
 * https://google.github.io/styleguide/vimscriptguide.xml
 *
 * Current sections covered:
 *   Portability > Strings (single-quoted preference)
 *   Portability > Matching Strings (explicit =~# / =~?)
 *   Portability > Regular Expressions (prefix \m\C)
 *   Portability > Dangerous commands (avoid :substitute)
 *   Portability > Fragile commands (normal! over normal)
 *   Portability > Catching Exceptions (match error codes)
 *   General Guidelines > Type checking (is# operator)
 *   General Guidelines > Other Languages (avoid ruby/lua/perl)
 *   General Guidelines > Functions ([!] and [abort])
 *   General Guidelines > Autocommands (augroups)
 *   General Guidelines > Settings (setlocal)
 *   Style > Whitespace (2-space indent, no tabs, 80 cols, trailing whitespace)
 *   Style > Naming (variable prefixes, function naming)
 *
 * Sections deferred to AI deep review layer:
 *   // General Guidelines > Messaging -- deferred to AI deep review layer
 *   // General Guidelines > Python (use sparingly) -- deferred to AI deep review layer
 *   // General Guidelines > Boilerplate (maktaba) -- deferred to AI deep review layer
 *   // General Guidelines > Plugin layout -- deferred to AI deep review layer
 *   // General Guidelines > Commands (no [!]) -- deferred to AI deep review layer
 *   // General Guidelines > Mappings -- deferred to AI deep review layer
 *   // Style > Naming (FunctionNamesLikeThis) -- partially covered, full CamelCase deferred
 */

import { Rule, Violation } from '../../types.js';

// ============================================================================
// HELPER UTILITIES
// ============================================================================

const GUIDE_BASE = 'https://google.github.io/styleguide/vimscriptguide.xml';

/**
 * Strip string literals and comments from Vimscript source while
 * preserving line count and positions. Handles:
 *   - Line comments:    " ... (when " starts or follows whitespace in command context)
 *   - Single-quoted strings:  'hello'  (no escapes except '')
 *   - Double-quoted strings:  "hello"  (with backslash escapes)
 *
 * Vimscript comment detection is context-sensitive. We use a heuristic:
 * a double-quote that starts the trimmed line is always a comment.
 * Otherwise, we strip string literals but cannot perfectly distinguish
 * inline comments from string arguments without a full parser.
 */
export function getCleanLines(lines: string[]): string[] {
    const result: string[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Full-line comment: line starts with "
        if (trimmed.startsWith('"')) {
            result.push('');
            continue;
        }

        let clean = '';
        let j = 0;

        while (j < line.length) {
            // Single-quoted string: 'text' (only escape is '' for literal ')
            if (line[j] === "'") {
                clean += "'";
                j++;
                while (j < line.length) {
                    if (line[j] === "'" && j + 1 < line.length && line[j + 1] === "'") {
                        j += 2; // skip ''
                        continue;
                    }
                    if (line[j] === "'") {
                        break;
                    }
                    j++;
                }
                if (j < line.length) {
                    clean += "'";
                    j++; // skip closing quote
                }
                continue;
            }

            // Double-quoted string: "text" (with backslash escapes)
            if (line[j] === '"') {
                // Heuristic: if preceded only by whitespace/operators, might be comment
                // We keep it as string removal for safety
                clean += '"';
                j++;
                while (j < line.length && line[j] !== '"') {
                    if (line[j] === '\\') {
                        j++; // skip escaped char
                    }
                    j++;
                }
                if (j < line.length) {
                    clean += '"';
                    j++; // skip closing quote
                }
                continue;
            }

            clean += line[j];
            j++;
        }

        result.push(clean);
    }

    return result;
}

// ============================================================================
// PORTABILITY RULES
// ============================================================================

export const vimscriptRules: Rule[] = [
    {
        id: 'VIM-STR-01',
        name: 'Explicit Regex Matchers',
        description: 'The matching behavior of `=~` and `!~` depends on user ignorecase/smartcase settings. Use explicitly `=~#`, `=~?`, `!~#`, or `!~?`.',
        severity: 'high',
        guideSection: 'Portability > Matching Strings',
        guideUrl: `${GUIDE_BASE}#Matching_Strings`,
        check: (lines: string[], _filename?: string, passedCleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = passedCleanLines || getCleanLines(lines);
            searchLines.forEach((clean, index) => {
                // Match =~ or !~ that is NOT followed by # or ?
                // Handles end-of-line case and both =~ and !~ families
                if (/[=!]~(?![#?])/.test(clean)) {
                    violations.push({
                        ruleId: 'VIM-STR-01',
                        ruleName: 'Explicit Regex Matchers',
                        severity: 'high',
                        line: index + 1,
                        message: 'Avoid relying on user settings (ignorecase) for string matching. Use `=~#` or `=~?` instead of `=~`.',
                        suggestion: 'Change `=~` to `=~#` (match case) or `=~?` (ignore case). Same for `!~`.',
                        codeSnippet: lines[index].trim(),
                        guideUrl: `${GUIDE_BASE}#Matching_Strings`
                    });
                }
            });
            return violations;
        }
    },
    {
        id: 'VIM-STR-02',
        name: 'Prefer Single Quoted Strings',
        description: 'Double quoted strings are semantically different in vimscript and break regexes. Prefer single quoted strings unless you need escape sequences.',
        severity: 'low',
        guideSection: 'Portability > Strings',
        guideUrl: `${GUIDE_BASE}#Strings`,
        check: (lines: string[], _filename?: string, passedCleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = passedCleanLines || getCleanLines(lines);
            searchLines.forEach((clean, index) => {
                // Flag double-quoted strings that do not contain escape sequences
                // Look for "..." where content has no backslash escapes
                const matches = lines[index].match(/"([^"\\]*)"/g);
                if (matches && clean.trim().length > 0) {
                    for (const m of matches) {
                        // Skip empty strings and strings that look like comments
                        if (m === '""') continue;
                        const content = m.slice(1, -1);
                        // If no escape sequences, single quotes would work
                        if (!content.includes('\\') && !content.includes("'")) {
                            violations.push({
                                ruleId: 'VIM-STR-02',
                                ruleName: 'Prefer Single Quoted Strings',
                                severity: 'low',
                                line: index + 1,
                                message: 'Double quoted string does not contain escape sequences. Prefer single quotes.',
                                suggestion: `Change ${m} to '${content}'.`,
                                codeSnippet: lines[index].trim(),
                                guideUrl: `${GUIDE_BASE}#Strings`
                            });
                            break; // one violation per line
                        }
                    }
                }
            });
            return violations;
        }
    },
    {
        id: 'VIM-STR-03',
        name: 'Regex Prefix \\m\\C',
        description: 'Regex behavior depends on the user\'s nomagic and ignorecase settings. Prepend all regexes with \\m\\C to ensure consistent behavior.',
        severity: 'medium',
        guideSection: 'Portability > Regular Expressions',
        guideUrl: `${GUIDE_BASE}#Regular_Expressions`,
        check: (lines: string[], _filename?: string, passedCleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = passedCleanLines || getCleanLines(lines);
            searchLines.forEach((clean, index) => {
                // Detect regex usage: =~# 'pattern' or =~? 'pattern' or =~ 'pattern'
                // Also match() / search() / substitute() calls with string args
                const regexCallPattern = /(?:[=!]~[#?]?\s+|(?:match|search|substitute|matchstr|matchlist)\s*\()\s*'/;
                if (regexCallPattern.test(clean)) {
                    // Check if the string argument starts with \m\C or \v\C or \M\C etc.
                    const afterMatch = clean.match(/(?:[=!]~[#?]?\s+|(?:match|search|substitute|matchstr|matchlist)\s*\()\s*'([^']*)'/);
                    if (afterMatch) {
                        const pattern = afterMatch[1];
                        // Check for explicit magic/case prefix
                        if (!/^\\[mMvV]\\[cC]/.test(pattern) && !/^\\[cC]\\[mMvV]/.test(pattern)) {
                            // Allow patterns that explicitly set both magic and case
                            if (pattern.length > 0) {
                                violations.push({
                                    ruleId: 'VIM-STR-03',
                                    ruleName: 'Regex Prefix \\m\\C',
                                    severity: 'medium',
                                    line: index + 1,
                                    message: 'Regex pattern should be prefixed with \\m\\C to avoid dependency on user magic/case settings.',
                                    suggestion: 'Prepend the regex pattern with \\m\\C (or \\v\\C if using very-magic).',
                                    codeSnippet: lines[index].trim(),
                                    guideUrl: `${GUIDE_BASE}#Regular_Expressions`
                                });
                            }
                        }
                    }
                }
            });
            return violations;
        }
    },
    {
        id: 'VIM-CMD-01',
        name: 'Avoid substitute command',
        description: 'Avoid using :s[ubstitute] as it moves the cursor, prints error messages, and its behavior depends upon local settings.',
        severity: 'medium',
        guideSection: 'Portability > Dangerous commands',
        guideUrl: `${GUIDE_BASE}#Dangerous_commands`,
        check: (lines: string[], _filename?: string, passedCleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = passedCleanLines || getCleanLines(lines);
            searchLines.forEach((clean, index) => {
                // Match :s/ or :substitute/ or standalone s/ at start of statement
                if (/(^|\s):?(s|substitute)\/.+\//.test(clean)) {
                    violations.push({
                        ruleId: 'VIM-CMD-01',
                        ruleName: 'Avoid substitute command',
                        severity: 'medium',
                        line: index + 1,
                        message: 'Avoid using `:s[ubstitute]` in scripts because its behavior is dependent on user settings and it creates side-effects.',
                        suggestion: 'Prefer functions (such as `search()`) which are better suited to scripts.',
                        codeSnippet: lines[index].trim(),
                        guideUrl: `${GUIDE_BASE}#Dangerous_commands`
                    });
                }
            });
            return violations;
        }
    },
    {
        id: 'VIM-CMD-02',
        name: 'Use normal! instead of normal',
        description: 'Always use normal! instead of normal. The latter depends upon the user\'s key mappings and could do anything.',
        severity: 'high',
        guideSection: 'Portability > Fragile commands',
        guideUrl: `${GUIDE_BASE}#Fragile_commands`,
        check: (lines: string[], _filename?: string, passedCleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = passedCleanLines || getCleanLines(lines);
            searchLines.forEach((clean, index) => {
                // Look for 'normal' or 'norm' followed by space but not '!'
                // Must be a command, not part of a longer word
                if (/\b(?:normal|norm)\s+[^!]/.test(clean)) {
                    violations.push({
                        ruleId: 'VIM-CMD-02',
                        ruleName: 'Use normal! instead of normal',
                        severity: 'high',
                        line: index + 1,
                        message: 'Using `normal` without `!` will execute user-defined remaps, leading to unpredictable script behavior.',
                        suggestion: 'Change `normal` to `normal!`.',
                        codeSnippet: lines[index].trim(),
                        guideUrl: `${GUIDE_BASE}#Fragile_commands`
                    });
                }
            });
            return violations;
        }
    },
    {
        id: 'VIM-CMD-03',
        name: 'Catch Error Codes Not Text',
        description: 'When catching exceptions, match error codes (e.g. E482) rather than error text, which may be locale dependent.',
        severity: 'high',
        guideSection: 'Portability > Catching Exceptions',
        guideUrl: `${GUIDE_BASE}#Catching_Exceptions`,
        check: (lines: string[], _filename?: string, passedCleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = passedCleanLines || getCleanLines(lines);
            searchLines.forEach((clean, index) => {
                // Detect catch with a string pattern that does not look like an error code
                // catch /pattern/ where pattern doesn't start with E followed by digits
                const catchMatch = clean.match(/\bcatch\s+\/([^/]+)\//);
                if (catchMatch) {
                    const pattern = catchMatch[1];
                    // If pattern does not contain an error code like E123, flag it
                    if (!/E\d+/.test(pattern)) {
                        violations.push({
                            ruleId: 'VIM-CMD-03',
                            ruleName: 'Catch Error Codes Not Text',
                            severity: 'high',
                            line: index + 1,
                            message: 'Catch pattern uses text instead of error code. Error text may be locale dependent.',
                            suggestion: 'Use error codes (e.g. catch /E482/) instead of text patterns.',
                            codeSnippet: lines[index].trim(),
                            guideUrl: `${GUIDE_BASE}#Catching_Exceptions`
                        });
                    }
                }
            });
            return violations;
        }
    },

    // ========================================================================
    // GENERAL GUIDELINES RULES
    // ========================================================================

    {
        id: 'VIM-GEN-01',
        name: 'Use Strict String Comparison',
        description: 'Vimscript has unsafe type coercion (0 == "foo" is true). Use `is#` for string comparisons and `==#` / `!=#` for explicit case-sensitive checks.',
        severity: 'high',
        guideSection: 'General Guidelines > Type checking',
        guideUrl: `${GUIDE_BASE}#Type_checking`,
        check: (lines: string[], _filename?: string, passedCleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = passedCleanLines || getCleanLines(lines);
            searchLines.forEach((clean, index) => {
                // Flag == or != that are not ==#/==?/!=#/!=? (case-ambiguous comparisons)
                // Must not match =~, and must be preceded by something (not inside a comment)
                if (/[^=!]==[^=#?]/.test(clean) || /[^!]!=[^=#?]/.test(clean)) {
                    violations.push({
                        ruleId: 'VIM-GEN-01',
                        ruleName: 'Use Strict String Comparison',
                        severity: 'high',
                        line: index + 1,
                        message: 'Using `==` or `!=` depends on user ignorecase setting. Use `==#`/`!=#` or `==?`/`!=?` for explicit behavior.',
                        suggestion: 'Change `==` to `==#` (case-sensitive) or `==?` (case-insensitive). Same for `!=`.',
                        codeSnippet: lines[index].trim(),
                        guideUrl: `${GUIDE_BASE}#Type_checking`
                    });
                }
            });
            return violations;
        }
    },
    {
        id: 'VIM-GEN-02',
        name: 'Avoid Other Scripting Languages',
        description: 'Avoid using ruby, lua, perl, or tcl in vimscript plugins. The end user\'s vim may not have been compiled with support for these.',
        severity: 'medium',
        guideSection: 'General Guidelines > Other Languages',
        guideUrl: `${GUIDE_BASE}#Other_Languages`,
        check: (lines: string[], _filename?: string, passedCleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = passedCleanLines || getCleanLines(lines);
            searchLines.forEach((clean, index) => {
                // Detect ruby, lua, perl, tcl command blocks
                if (/^\s*(?:ruby|rubydo|rubyfile|lua|luado|luafile|perl|perldo|tcl|tcldo|tclfile)\b/.test(clean)) {
                    violations.push({
                        ruleId: 'VIM-GEN-02',
                        ruleName: 'Avoid Other Scripting Languages',
                        severity: 'medium',
                        line: index + 1,
                        message: 'Using non-vimscript languages (ruby, lua, perl, tcl). The end user may not have support for these.',
                        suggestion: 'Rewrite in vimscript. Use python only when it provides critical functionality like threading.',
                        codeSnippet: lines[index].trim(),
                        guideUrl: `${GUIDE_BASE}#Other_Languages`
                    });
                }
            });
            return violations;
        }
    },
    {
        id: 'VIM-GEN-03',
        name: 'Functions Should Use [!] and [abort]',
        description: 'Define functions with `function!` (allows reload) and `abort` (halts on error). Functions should be in autoload/ directory.',
        severity: 'high',
        guideSection: 'General Guidelines > Functions',
        guideUrl: `${GUIDE_BASE}#Functions`,
        check: (lines: string[], _filename?: string, passedCleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = passedCleanLines || getCleanLines(lines);
            searchLines.forEach((clean, index) => {
                // Match function definitions
                const funcMatch = clean.match(/^\s*(function)\s+/);
                if (funcMatch) {
                    // Check for missing !
                    if (!/^\s*function!\s/.test(clean)) {
                        violations.push({
                            ruleId: 'VIM-GEN-03',
                            ruleName: 'Functions Should Use [!] and [abort]',
                            severity: 'high',
                            line: index + 1,
                            message: 'Function defined without `!`. Use `function!` to allow reloading without errors.',
                            suggestion: 'Change `function` to `function!`.',
                            codeSnippet: lines[index].trim(),
                            guideUrl: `${GUIDE_BASE}#Functions`
                        });
                    }
                    // Check for missing abort keyword
                    if (/^\s*function!?\s+\S+\s*\([^)]*\)\s*$/.test(clean)) {
                        violations.push({
                            ruleId: 'VIM-GEN-03',
                            ruleName: 'Functions Should Use [!] and [abort]',
                            severity: 'high',
                            line: index + 1,
                            message: 'Function defined without `abort`. Functions should halt on errors.',
                            suggestion: 'Add `abort` after the parameter list: `function! Name(...) abort`.',
                            codeSnippet: lines[index].trim(),
                            guideUrl: `${GUIDE_BASE}#Functions`
                        });
                    }
                }
            });
            return violations;
        }
    },
    {
        id: 'VIM-GEN-04',
        name: 'Autocommands Must Use augroups',
        description: 'All autocommands should be placed within augroups. The augroup should be cleared with autocmd! before defining new autocommands.',
        severity: 'high',
        guideSection: 'General Guidelines > Autocommands',
        guideUrl: `${GUIDE_BASE}#Autocommands`,
        check: (lines: string[], _filename?: string, passedCleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = passedCleanLines || getCleanLines(lines);
            let inAugroup = false;
            searchLines.forEach((clean, index) => {
                if (/^\s*augroup\s+\S/.test(clean) && !/^\s*augroup\s+END/i.test(clean)) {
                    inAugroup = true;
                    return;
                }
                if (/^\s*augroup\s+END/i.test(clean)) {
                    inAugroup = false;
                    return;
                }
                // Flag autocmd outside of augroup
                if (/^\s*autocmd\s/.test(clean) && !inAugroup) {
                    violations.push({
                        ruleId: 'VIM-GEN-04',
                        ruleName: 'Autocommands Must Use augroups',
                        severity: 'high',
                        line: index + 1,
                        message: 'Autocommand defined outside of an augroup. All autocommands should be inside augroups for re-entrancy.',
                        suggestion: 'Wrap autocommands in an augroup block with `autocmd!` to clear previous definitions.',
                        codeSnippet: lines[index].trim(),
                        guideUrl: `${GUIDE_BASE}#Autocommands`
                    });
                }
            });
            return violations;
        }
    },
    {
        id: 'VIM-GEN-05',
        name: 'Use setlocal Instead of set',
        description: 'Use `:setlocal` and `&l:` instead of `:set` and `&` unless you have explicit reason to set options globally.',
        severity: 'medium',
        guideSection: 'General Guidelines > Settings',
        guideUrl: `${GUIDE_BASE}#Settings`,
        check: (lines: string[], _filename?: string, passedCleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = passedCleanLines || getCleanLines(lines);
            searchLines.forEach((clean, index) => {
                // Match :set or set at the start of a command (not setlocal, not inside comment)
                if (/^\s*set\s+(?!filetype)/.test(clean) && !/^\s*setlocal\b/.test(clean)) {
                    violations.push({
                        ruleId: 'VIM-GEN-05',
                        ruleName: 'Use setlocal Instead of set',
                        severity: 'medium',
                        line: index + 1,
                        message: 'Using `:set` changes settings globally. Prefer `:setlocal` for buffer/window-local settings.',
                        suggestion: 'Change `set` to `setlocal` unless global scope is intentional.',
                        codeSnippet: lines[index].trim(),
                        guideUrl: `${GUIDE_BASE}#Settings`
                    });
                }
            });
            return violations;
        }
    },

    // ========================================================================
    // NAMING RULES
    // ========================================================================

    {
        id: 'VIM-VAR-01',
        name: 'Prefix Variables',
        description: 'Always prefix variables with their scope (g:, s:, a:, l:, v:, b:).',
        severity: 'medium',
        guideSection: 'Style > Naming',
        guideUrl: `${GUIDE_BASE}#Naming`,
        check: (lines: string[], _filename?: string, passedCleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = passedCleanLines || getCleanLines(lines);
            searchLines.forEach((clean, index) => {
                // Look for `let name = ...` where name does not have a prefix like g: or s:
                const match = clean.match(/^\s*let\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*[=+\-.*]/);
                if (match) {
                    const varName = match[1];
                    // Skip vim options like &option and environment vars $VAR
                    if (varName.startsWith('&') || varName.startsWith('$')) return;
                    violations.push({
                        ruleId: 'VIM-VAR-01',
                        ruleName: 'Prefix Variables',
                        severity: 'medium',
                        line: index + 1,
                        message: `Variable "${varName}" is missing a scope prefix (e.g. s:, g:, l:).`,
                        suggestion: `Prefix the variable with its scope, e.g., \`let s:${varName} = ...\`.`,
                        codeSnippet: lines[index].trim(),
                        guideUrl: `${GUIDE_BASE}#Naming`
                    });
                }
            });
            return violations;
        }
    },
    {
        id: 'VIM-VAR-02',
        name: 'Variable Names Use snake_case',
        description: 'Variable names (including augroup names) should use snake_case, e.g. variable_names_like_this.',
        severity: 'low',
        guideSection: 'Style > Naming',
        guideUrl: `${GUIDE_BASE}#Naming`,
        check: (lines: string[], _filename?: string, passedCleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = passedCleanLines || getCleanLines(lines);
            searchLines.forEach((clean, index) => {
                // Match let scope:varName = ...
                const match = clean.match(/^\s*let\s+[gsablvw]:([\w]+)\s*[=+\-.*]/);
                if (match) {
                    const varName = match[1];
                    // Flag camelCase or PascalCase (has uppercase after lowercase)
                    if (/[a-z][A-Z]/.test(varName)) {
                        violations.push({
                            ruleId: 'VIM-VAR-02',
                            ruleName: 'Variable Names Use snake_case',
                            severity: 'low',
                            line: index + 1,
                            message: `Variable "${varName}" uses camelCase. Vimscript variables should use snake_case.`,
                            suggestion: `Rename to snake_case, e.g., "${varName.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase()}".`,
                            codeSnippet: lines[index].trim(),
                            guideUrl: `${GUIDE_BASE}#Naming`
                        });
                    }
                }
            });
            return violations;
        }
    },

    // ========================================================================
    // STYLE / WHITESPACE RULES
    // ========================================================================

    {
        id: 'VIM-FMT-01',
        name: 'No Tabs',
        description: 'Do not use tabs in vimscript. Use two spaces for indentation.',
        severity: 'high',
        guideSection: 'Style > Whitespace',
        guideUrl: `${GUIDE_BASE}#Whitespace`,
        // Whitespace rule: legitimately uses raw lines
        check: (lines: string[], _filename?: string): Violation[] => {
            const violations: Violation[] = [];
            lines.forEach((line, index) => {
                if (line.includes('\t')) {
                    violations.push({
                        ruleId: 'VIM-FMT-01',
                        ruleName: 'No Tabs',
                        severity: 'high',
                        line: index + 1,
                        message: 'Line contains tab characters. Use two spaces for indentation.',
                        suggestion: 'Replace tabs with two spaces.',
                        codeSnippet: line.trim(),
                        guideUrl: `${GUIDE_BASE}#Whitespace`
                    });
                }
            });
            return violations;
        }
    },
    {
        id: 'VIM-FMT-02',
        name: '80 Column Limit',
        description: 'Restrict lines to 80 columns wide.',
        severity: 'low',
        guideSection: 'Style > Whitespace',
        guideUrl: `${GUIDE_BASE}#Whitespace`,
        // Whitespace rule: legitimately uses raw lines
        check: (lines: string[], _filename?: string): Violation[] => {
            const violations: Violation[] = [];
            lines.forEach((line, index) => {
                if (line.length > 80) {
                    violations.push({
                        ruleId: 'VIM-FMT-02',
                        ruleName: '80 Column Limit',
                        severity: 'low',
                        line: index + 1,
                        message: `Line exceeds 80 characters (found ${line.length} characters).`,
                        suggestion: 'Wrap the line to stay under the 80 character limit. Indent continued lines by four spaces.',
                        codeSnippet: line.substring(0, 80) + '...',
                        guideUrl: `${GUIDE_BASE}#Whitespace`
                    });
                }
            });
            return violations;
        }
    },
    {
        id: 'VIM-FMT-03',
        name: 'Two Space Indentation',
        description: 'Use two spaces for indentation in vimscript.',
        severity: 'low',
        guideSection: 'Style > Whitespace',
        guideUrl: `${GUIDE_BASE}#Whitespace`,
        // Whitespace rule: legitimately uses raw lines
        check: (lines: string[], _filename?: string): Violation[] => {
            const violations: Violation[] = [];
            lines.forEach((line, index) => {
                // Check leading whitespace: should be multiple of 2 spaces
                // Skip empty lines and continuation lines (starting with \)
                const leadingMatch = line.match(/^( +)\S/);
                if (leadingMatch) {
                    const spaces = leadingMatch[1].length;
                    // Odd number of leading spaces is always wrong for 2-space indent
                    if (spaces % 2 !== 0) {
                        violations.push({
                            ruleId: 'VIM-FMT-03',
                            ruleName: 'Two Space Indentation',
                            severity: 'low',
                            line: index + 1,
                            message: `Line has ${spaces} leading spaces. Indentation should be a multiple of 2.`,
                            suggestion: 'Use two spaces per indentation level.',
                            codeSnippet: lines[index].trim(),
                            guideUrl: `${GUIDE_BASE}#Whitespace`
                        });
                    }
                }
            });
            return violations;
        }
    },
    {
        id: 'VIM-FMT-04',
        name: 'No Trailing Whitespace',
        description: 'Do not introduce trailing whitespace.',
        severity: 'low',
        guideSection: 'Style > Whitespace',
        guideUrl: `${GUIDE_BASE}#Whitespace`,
        // Whitespace rule: legitimately uses raw lines
        check: (lines: string[], _filename?: string): Violation[] => {
            const violations: Violation[] = [];
            lines.forEach((line, index) => {
                if (line !== line.trimEnd() && line.trimEnd().length > 0) {
                    violations.push({
                        ruleId: 'VIM-FMT-04',
                        ruleName: 'No Trailing Whitespace',
                        severity: 'low',
                        line: index + 1,
                        message: 'Line has trailing whitespace.',
                        suggestion: 'Remove trailing spaces.',
                        codeSnippet: lines[index].trimEnd(),
                        guideUrl: `${GUIDE_BASE}#Whitespace`
                    });
                }
            });
            return violations;
        }
    },
    {
        id: 'VIM-FMT-05',
        name: 'Spaces Around Operators',
        description: 'Use spaces around operators in vimscript assignments and expressions.',
        severity: 'low',
        guideSection: 'Style > Whitespace',
        guideUrl: `${GUIDE_BASE}#Whitespace`,
        check: (lines: string[], _filename?: string, passedCleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = passedCleanLines || getCleanLines(lines);
            searchLines.forEach((clean, index) => {
                // Check for let var=value (no spaces around =)
                // Only flag in let/set statements to reduce false positives
                if (/^\s*let\s+\S+=[^\s=]/.test(clean) && !/^\s*let\s+\S+==#/.test(clean)) {
                    violations.push({
                        ruleId: 'VIM-FMT-05',
                        ruleName: 'Spaces Around Operators',
                        severity: 'low',
                        line: index + 1,
                        message: 'Missing spaces around operator in assignment.',
                        suggestion: 'Add spaces around the `=` operator: `let var = value`.',
                        codeSnippet: lines[index].trim(),
                        guideUrl: `${GUIDE_BASE}#Whitespace`
                    });
                }
            });
            return violations;
        }
    },

    // ========================================================================
    // FUNCTION NAMING RULES
    // ========================================================================

    {
        id: 'VIM-NAM-01',
        name: 'No Global Functions',
        description: 'Do not create global functions. Use autoloaded functions (with # namespace) or script-local (s:) functions.',
        severity: 'high',
        guideSection: 'Style > Naming > FunctionNamesLikeThis',
        guideUrl: `${GUIDE_BASE}#Naming`,
        check: (lines: string[], _filename?: string, passedCleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = passedCleanLines || getCleanLines(lines);
            searchLines.forEach((clean, index) => {
                // Match function! FuncName() -- global function (no s: or # namespace)
                const match = clean.match(/^\s*function!?\s+([A-Z][a-zA-Z0-9_]*)\s*\(/);
                if (match) {
                    const funcName = match[1];
                    // If it doesn't contain # (autoload) and doesn't start with s: it's global
                    if (!funcName.includes('#')) {
                        violations.push({
                            ruleId: 'VIM-NAM-01',
                            ruleName: 'No Global Functions',
                            severity: 'high',
                            line: index + 1,
                            message: `Function "${funcName}" is a global function. Use autoloaded functions or script-local (s:) functions.`,
                            suggestion: `Move to autoload/ and use a namespaced name like "myplugin#${funcName}", or prefix with "s:".`,
                            codeSnippet: lines[index].trim(),
                            guideUrl: `${GUIDE_BASE}#Naming`
                        });
                    }
                }
            });
            return violations;
        }
    }
];
