/**
 * Common Lisp Rules -- Google Common Lisp Style Guide
 * https://google.github.io/styleguide/lispguide.xml
 *
 * Current sections covered:
 *   Formatting (tabs, line length, horizontal whitespace, vertical whitespace)
 *   Documentation (comment semicolons, TODO format)
 *   Naming (earmuffs, plus-constants, lowercase symbols)
 *   Language Usage (EVAL, INTERN/UNINTERN, SIGNAL, THROW/CATCH, IGNORE-ERRORS)
 *   Meta-language (EVAL-WHEN forms)
 *   Proper Forms (CASE quoting, NCONC)
 *   Packages (double-colon access)
 *   Pitfalls (#'FUN vs 'FUN)
 *
 * Sections deferred to AI deep review layer:
 *   // Mostly Functional Style -- deferred to AI deep review layer
 *   // Recursion vs Iteration -- deferred to AI deep review layer
 *   // CLOS usage -- deferred to AI deep review layer
 *   // Macro hygiene -- deferred to AI deep review layer
 *   // Data Representation (lists vs structures) -- deferred to AI deep review layer
 *   // DYNAMIC-EXTENT -- deferred to AI deep review layer
 *   // REDUCE vs APPLY -- deferred to AI deep review layer
 *   // Unsafe Operations -- deferred to AI deep review layer
 *   // SATISFIES pitfalls -- deferred to AI deep review layer
 *   // Pathnames -- deferred to AI deep review layer
 *   // Spelling and Abbreviations -- deferred to AI deep review layer
 *   // Indentation (requires Emacs-style analysis) -- deferred to AI deep review layer
 *   // File Header (in-package) -- partially covered, rest deferred
 *   // Defining Functions (&optional/&key) -- deferred to AI deep review layer
 *   // Conditional Expressions (when/unless/if/cond) -- deferred to AI deep review layer
 *   // Identity/Equality (EQ vs EQL) -- deferred to AI deep review layer
 *   // Defining Constants (defconstant for non-EQL) -- deferred to AI deep review layer
 */

import { Rule, Violation } from '../../types.js';

// ============================================================================
// HELPER UTILITIES
// ============================================================================

/**
 * Strip string literals and comments from Common Lisp source while
 * preserving line count and positions. Handles:
 *   - Line comments:     ; ...
 *   - Block comments:    #| ... |#  (nestable)
 *   - Double-quoted strings: "hello"
 */
export function getCleanLines(lines: string[]): string[] {
    const result: string[] = [];
    let blockCommentDepth = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let clean = '';
        let j = 0;

        while (j < line.length) {
            if (blockCommentDepth > 0) {
                // Check for nested #|
                if (line[j] === '#' && j + 1 < line.length && line[j + 1] === '|') {
                    blockCommentDepth++;
                    j += 2;
                    continue;
                }
                // Check for closing |#
                if (line[j] === '|' && j + 1 < line.length && line[j + 1] === '#') {
                    blockCommentDepth--;
                    j += 2;
                    continue;
                }
                j++;
                continue;
            }

            // Block comment start: #|
            if (line[j] === '#' && j + 1 < line.length && line[j + 1] === '|') {
                blockCommentDepth++;
                j += 2;
                continue;
            }

            // Line comment: ;
            if (line[j] === ';') {
                // Rest of line is comment
                j = line.length;
                continue;
            }

            // String literal
            if (line[j] === '"') {
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
// FORMATTING RULES
// ============================================================================

const GUIDE_BASE = 'https://google.github.io/styleguide/lispguide.xml';

export const lispRules: Rule[] = [
    {
        id: 'LISP-FMT-01',
        name: 'No Tabs',
        description: 'Tabs are strictly forbidden in Google Common Lisp source files. Use spaces for indentation.',
        severity: 'high',
        guideSection: 'Formatting > Horizontal white space',
        guideUrl: `${GUIDE_BASE}#Horizontal_white_space`,
        check: (lines: string[], _filename?: string): Violation[] => {
            const violations: Violation[] = [];
            lines.forEach((line, index) => {
                if (line.includes('\t')) {
                    violations.push({
                        ruleId: 'LISP-FMT-01',
                        ruleName: 'No Tabs',
                        severity: 'high',
                        line: index + 1,
                        message: 'Line contains tab characters. Use spaces for indentation.',
                        suggestion: 'Replace tabs with spaces.',
                        codeSnippet: line.trim(),
                        guideUrl: `${GUIDE_BASE}#Horizontal_white_space`
                    });
                }
            });
            return violations;
        }
    },
    {
        id: 'LISP-FMT-02',
        name: '100 Column Limit',
        description: 'Lines should not exceed 100 columns per the Google Common Lisp Style Guide.',
        severity: 'low',
        guideSection: 'Formatting > Line length',
        guideUrl: `${GUIDE_BASE}#Line_length`,
        check: (lines: string[], _filename?: string): Violation[] => {
            const violations: Violation[] = [];
            lines.forEach((line, index) => {
                if (line.length > 100) {
                    violations.push({
                        ruleId: 'LISP-FMT-02',
                        ruleName: '100 Column Limit',
                        severity: 'low',
                        line: index + 1,
                        message: `Line exceeds 100 characters (found ${line.length} characters).`,
                        suggestion: 'Wrap the line to stay under the 100 character limit.',
                        codeSnippet: line.substring(0, 100) + '...',
                        guideUrl: `${GUIDE_BASE}#Line_length`
                    });
                }
            });
            return violations;
        }
    },
    {
        id: 'LISP-FMT-03',
        name: 'No Space Inside Parentheses',
        description: 'You must not include extra horizontal whitespace before or after parentheses.',
        severity: 'medium',
        guideSection: 'Formatting > Horizontal white space',
        guideUrl: `${GUIDE_BASE}#Horizontal_white_space`,
        check: (lines: string[], _filename?: string, passedCleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = passedCleanLines || getCleanLines(lines);
            searchLines.forEach((clean, index) => {
                // Space after opening paren: ( foo
                if (/\(\s+\S/.test(clean)) {
                    violations.push({
                        ruleId: 'LISP-FMT-03',
                        ruleName: 'No Space Inside Parentheses',
                        severity: 'medium',
                        line: index + 1,
                        message: 'Extra whitespace after opening parenthesis.',
                        suggestion: 'Remove space after "(".',
                        codeSnippet: lines[index].trim(),
                        guideUrl: `${GUIDE_BASE}#Horizontal_white_space`
                    });
                }
                // Space before closing paren: foo )
                if (/\S\s+\)/.test(clean)) {
                    violations.push({
                        ruleId: 'LISP-FMT-03',
                        ruleName: 'No Space Inside Parentheses',
                        severity: 'medium',
                        line: index + 1,
                        message: 'Extra whitespace before closing parenthesis.',
                        suggestion: 'Remove space before ")".',
                        codeSnippet: lines[index].trim(),
                        guideUrl: `${GUIDE_BASE}#Horizontal_white_space`
                    });
                }
            });
            return violations;
        }
    },
    {
        id: 'LISP-FMT-04',
        name: 'No Lonely Closing Parentheses',
        description: 'You must not place right parentheses by themselves on a line. Trailing parentheses must appear on the same line.',
        severity: 'medium',
        guideSection: 'Formatting > Horizontal white space',
        guideUrl: `${GUIDE_BASE}#Horizontal_white_space`,
        check: (lines: string[], _filename?: string, passedCleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = passedCleanLines || getCleanLines(lines);
            searchLines.forEach((clean, index) => {
                // Line is only whitespace and closing parens (possibly with ; eval-when comment)
                const stripped = clean.trim();
                if (/^\)+$/.test(stripped)) {
                    violations.push({
                        ruleId: 'LISP-FMT-04',
                        ruleName: 'No Lonely Closing Parentheses',
                        severity: 'medium',
                        line: index + 1,
                        message: 'Closing parentheses should not be on their own line.',
                        suggestion: 'Move closing parentheses to the end of the preceding line.',
                        codeSnippet: lines[index].trim(),
                        guideUrl: `${GUIDE_BASE}#Horizontal_white_space`
                    });
                }
            });
            return violations;
        }
    },

    // ========================================================================
    // DOCUMENTATION RULES
    // ========================================================================

    {
        id: 'LISP-DOC-01',
        name: 'Comment Semicolons Convention',
        description: 'Use four semicolons (;;;;) for file headers, three (;;;) for top-level groups, two (;;) for in-function comments, and one (;) for end-of-line remarks.',
        severity: 'low',
        guideSection: 'Documentation > Comment semicolons',
        guideUrl: `${GUIDE_BASE}#Comment_semicolons`,
        check: (lines: string[], _filename?: string): Violation[] => {
            const violations: Violation[] = [];
            lines.forEach((line, index) => {
                const trimmed = line.trim();
                // Detect 5+ semicolons starting a comment
                if (/^;{5,}/.test(trimmed)) {
                    violations.push({
                        ruleId: 'LISP-DOC-01',
                        ruleName: 'Comment Semicolons Convention',
                        severity: 'low',
                        line: index + 1,
                        message: 'Too many semicolons. Use at most four (;;;;) for file-level comments.',
                        suggestion: 'Use ;;;; for file headers, ;;; for section comments, ;; for code comments, ; for inline remarks.',
                        codeSnippet: trimmed,
                        guideUrl: `${GUIDE_BASE}#Comment_semicolons`
                    });
                }
            });
            return violations;
        }
    },
    {
        id: 'LISP-DOC-02',
        name: 'Space After Semicolon',
        description: 'You should include a space between the semicolon and the text of the comment.',
        severity: 'low',
        guideSection: 'Documentation > Comment semicolons',
        guideUrl: `${GUIDE_BASE}#Comment_semicolons`,
        check: (lines: string[], _filename?: string): Violation[] => {
            const violations: Violation[] = [];
            lines.forEach((line, index) => {
                // Match a comment that has no space after the last semicolon
                // but does have text (not just semicolons or empty)
                const match = line.match(/;+([\S])/);
                if (match && match[1] !== ';' && match[1] !== '|') {
                    // Exclude #| block comment openers and shebang lines
                    const beforeMatch = line.substring(0, line.indexOf(match[0]));
                    // Make sure this semicolon is actually the start of a comment
                    // (not inside a string) - crude check: no odd quotes before it
                    const quoteCount = (beforeMatch.match(/"/g) || []).length;
                    if (quoteCount % 2 === 0) {
                        violations.push({
                            ruleId: 'LISP-DOC-02',
                            ruleName: 'Space After Semicolon',
                            severity: 'low',
                            line: index + 1,
                            message: 'Missing space between semicolon and comment text.',
                            suggestion: 'Add a space after the semicolon(s).',
                            codeSnippet: line.trim(),
                            guideUrl: `${GUIDE_BASE}#Comment_semicolons`
                        });
                    }
                }
            });
            return violations;
        }
    },
    {
        id: 'LISP-DOC-03',
        name: 'TODO Format',
        description: 'TODO comments must follow the format: TODO(username) or TODO(email) with a description.',
        severity: 'medium',
        guideSection: 'Documentation > Attention Required',
        guideUrl: `${GUIDE_BASE}#Attention_Required`,
        check: (lines: string[], _filename?: string): Violation[] => {
            const violations: Violation[] = [];
            lines.forEach((line, index) => {
                // Look for TODO in comments (after semicolons)
                const commentMatch = line.match(/;.*\bTODO\b/i);
                if (commentMatch) {
                    // Check if it follows TODO(name) pattern
                    if (!/TODO\([^\)]+\)/.test(line)) {
                        violations.push({
                            ruleId: 'LISP-DOC-03',
                            ruleName: 'TODO Format',
                            severity: 'medium',
                            line: index + 1,
                            message: 'TODO comment should include a name or email, e.g. TODO(username).',
                            suggestion: 'Use the format: TODO(name@example.com): description.',
                            codeSnippet: line.trim(),
                            guideUrl: `${GUIDE_BASE}#Attention_Required`
                        });
                    }
                }
            });
            return violations;
        }
    },

    // ========================================================================
    // NAMING RULES
    // ========================================================================

    {
        id: 'LISP-NAM-01',
        name: 'Global Variable Earmuffs',
        description: 'Global variable names (defvar, defparameter) must start and end with asterisks (*earmuffs*).',
        severity: 'high',
        guideSection: 'Naming > Global variables and constants',
        guideUrl: `${GUIDE_BASE}#Global_variables_and_constants`,
        check: (lines: string[], _filename?: string, passedCleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = passedCleanLines || getCleanLines(lines);
            searchLines.forEach((clean, index) => {
                // Match (defvar name or (defparameter name
                const match = clean.match(/\(\s*(?:defvar|defparameter)\s+([\S]+)/i);
                if (match) {
                    const name = match[1];
                    if (!(/^\*.*\*$/.test(name))) {
                        violations.push({
                            ruleId: 'LISP-NAM-01',
                            ruleName: 'Global Variable Earmuffs',
                            severity: 'high',
                            line: index + 1,
                            message: `Global variable "${name}" should be surrounded by asterisks (*earmuffs*).`,
                            suggestion: `Rename to *${name.replace(/^\*|\*$/g, '')}*.`,
                            codeSnippet: lines[index].trim(),
                            guideUrl: `${GUIDE_BASE}#Global_variables_and_constants`
                        });
                    }
                }
            });
            return violations;
        }
    },
    {
        id: 'LISP-NAM-02',
        name: 'Constant Plus Convention',
        description: 'Global constant names (defconstant) must start and end with plus characters (+name+).',
        severity: 'high',
        guideSection: 'Naming > Global variables and constants',
        guideUrl: `${GUIDE_BASE}#Global_variables_and_constants`,
        check: (lines: string[], _filename?: string, passedCleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = passedCleanLines || getCleanLines(lines);
            searchLines.forEach((clean, index) => {
                const match = clean.match(/\(\s*defconstant\s+([\S]+)/i);
                if (match) {
                    const name = match[1];
                    if (!(/^\+.*\+$/.test(name))) {
                        violations.push({
                            ruleId: 'LISP-NAM-02',
                            ruleName: 'Constant Plus Convention',
                            severity: 'high',
                            line: index + 1,
                            message: `Constant "${name}" should be surrounded by plus signs (+name+).`,
                            suggestion: `Rename to +${name.replace(/^\+|\+$/g, '')}+.`,
                            codeSnippet: lines[index].trim(),
                            guideUrl: `${GUIDE_BASE}#Global_variables_and_constants`
                        });
                    }
                }
            });
            return violations;
        }
    },
    {
        id: 'LISP-NAM-03',
        name: 'Lowercase Symbols',
        description: 'Use lower case for all symbols. Uppercase in definitions signals a style violation.',
        severity: 'medium',
        guideSection: 'Naming > Symbol guidelines',
        guideUrl: `${GUIDE_BASE}#Symbol_guidelines`,
        check: (lines: string[], _filename?: string, passedCleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = passedCleanLines || getCleanLines(lines);
            // Check defun/defvar/defparameter/defmacro/defgeneric/defmethod/defclass names for uppercase
            const defPattern = /\(\s*(?:defun|defmacro|defgeneric|defmethod|defclass|defstruct|deftype)\s+([\S]+)/i;
            searchLines.forEach((clean, index) => {
                const match = clean.match(defPattern);
                if (match) {
                    const name = match[1];
                    // Skip if the name is all special chars (like +name+ or *name*)
                    const coreName = name.replace(/^[+*]|[+*]$/g, '');
                    if (coreName && /[A-Z]/.test(coreName)) {
                        violations.push({
                            ruleId: 'LISP-NAM-03',
                            ruleName: 'Lowercase Symbols',
                            severity: 'medium',
                            line: index + 1,
                            message: `Symbol "${name}" contains uppercase letters. Use lowercase for all symbols.`,
                            suggestion: `Rename to ${name.toLowerCase()}.`,
                            codeSnippet: lines[index].trim(),
                            guideUrl: `${GUIDE_BASE}#Symbol_guidelines`
                        });
                    }
                }
            });
            return violations;
        }
    },

    // ========================================================================
    // LANGUAGE USAGE RULES
    // ========================================================================

    {
        id: 'LISP-LNG-01',
        name: 'No Runtime EVAL',
        description: 'You must not use EVAL at runtime. It is easily misused and rarely appropriate.',
        severity: 'critical',
        guideSection: 'Meta-language guidelines > EVAL',
        guideUrl: `${GUIDE_BASE}#EVAL`,
        check: (lines: string[], _filename?: string, passedCleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = passedCleanLines || getCleanLines(lines);
            searchLines.forEach((clean, index) => {
                // Match (eval ...) as a function call - not inside a defmacro context
                // which we can't fully determine, so flag all uses
                if (/\(\s*eval\s/i.test(clean)) {
                    violations.push({
                        ruleId: 'LISP-LNG-01',
                        ruleName: 'No Runtime EVAL',
                        severity: 'critical',
                        line: index + 1,
                        message: 'Use of EVAL detected. EVAL must not be used at runtime.',
                        suggestion: 'Consider using a macro, SYMBOL-VALUE, or a special-purpose evaluator instead.',
                        codeSnippet: lines[index].trim(),
                        guideUrl: `${GUIDE_BASE}#EVAL`
                    });
                }
            });
            return violations;
        }
    },
    {
        id: 'LISP-LNG-02',
        name: 'No Runtime INTERN',
        description: 'You must not use INTERN or UNINTERN at runtime. They create memory leaks and security risks.',
        severity: 'critical',
        guideSection: 'Meta-language guidelines > INTERN and UNINTERN',
        guideUrl: `${GUIDE_BASE}#INTERN_and_UNINTERN`,
        check: (lines: string[], _filename?: string, passedCleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = passedCleanLines || getCleanLines(lines);
            searchLines.forEach((clean, index) => {
                if (/\(\s*(?:intern|unintern)\s/i.test(clean)) {
                    violations.push({
                        ruleId: 'LISP-LNG-02',
                        ruleName: 'No Runtime INTERN',
                        severity: 'critical',
                        line: index + 1,
                        message: 'Use of INTERN/UNINTERN detected. Must not be used at runtime.',
                        suggestion: 'Use STRING= or STRING-EQUAL for comparisons instead of interning.',
                        codeSnippet: lines[index].trim(),
                        guideUrl: `${GUIDE_BASE}#INTERN_and_UNINTERN`
                    });
                }
            });
            return violations;
        }
    },
    {
        id: 'LISP-LNG-03',
        name: 'No SIGNAL',
        description: 'Code must not call SIGNAL. Use ERROR or ASSERT instead.',
        severity: 'high',
        guideSection: 'Language usage guidelines > Assertions and Conditions',
        guideUrl: `${GUIDE_BASE}#Assertions_and_Conditions`,
        check: (lines: string[], _filename?: string, passedCleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = passedCleanLines || getCleanLines(lines);
            searchLines.forEach((clean, index) => {
                if (/\(\s*signal\s/i.test(clean)) {
                    violations.push({
                        ruleId: 'LISP-LNG-03',
                        ruleName: 'No SIGNAL',
                        severity: 'high',
                        line: index + 1,
                        message: 'Use of SIGNAL detected. Use ERROR or ASSERT instead.',
                        suggestion: 'Replace SIGNAL with ERROR for real errors or ASSERT for invariant checks.',
                        codeSnippet: lines[index].trim(),
                        guideUrl: `${GUIDE_BASE}#Assertions_and_Conditions`
                    });
                }
            });
            return violations;
        }
    },
    {
        id: 'LISP-LNG-04',
        name: 'No THROW/CATCH',
        description: 'Code should not use THROW and CATCH. Use the restart facility instead.',
        severity: 'medium',
        guideSection: 'Language usage guidelines > Assertions and Conditions',
        guideUrl: `${GUIDE_BASE}#Assertions_and_Conditions`,
        check: (lines: string[], _filename?: string, passedCleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = passedCleanLines || getCleanLines(lines);
            searchLines.forEach((clean, index) => {
                if (/\(\s*(?:throw|catch)\s/i.test(clean)) {
                    violations.push({
                        ruleId: 'LISP-LNG-04',
                        ruleName: 'No THROW/CATCH',
                        severity: 'medium',
                        line: index + 1,
                        message: 'Use of THROW/CATCH detected. Use the restart facility instead.',
                        suggestion: 'Replace THROW/CATCH with HANDLER-CASE, HANDLER-BIND, and restarts.',
                        codeSnippet: lines[index].trim(),
                        guideUrl: `${GUIDE_BASE}#Assertions_and_Conditions`
                    });
                }
            });
            return violations;
        }
    },
    {
        id: 'LISP-LNG-05',
        name: 'No IGNORE-ERRORS',
        description: 'Code should not generically handle all conditions or use IGNORE-ERRORS.',
        severity: 'high',
        guideSection: 'Language usage guidelines > Assertions and Conditions',
        guideUrl: `${GUIDE_BASE}#Assertions_and_Conditions`,
        check: (lines: string[], _filename?: string, passedCleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = passedCleanLines || getCleanLines(lines);
            searchLines.forEach((clean, index) => {
                if (/\(\s*ignore-errors\s/i.test(clean)) {
                    violations.push({
                        ruleId: 'LISP-LNG-05',
                        ruleName: 'No IGNORE-ERRORS',
                        severity: 'high',
                        line: index + 1,
                        message: 'Use of IGNORE-ERRORS detected. Do not generically handle all conditions.',
                        suggestion: 'Handle specific condition types with HANDLER-CASE or HANDLER-BIND.',
                        codeSnippet: lines[index].trim(),
                        guideUrl: `${GUIDE_BASE}#Assertions_and_Conditions`
                    });
                }
            });
            return violations;
        }
    },
    {
        id: 'LISP-LNG-06',
        name: 'ERROR Must Use Condition Type',
        description: 'ERROR should always be called with an explicit condition type, never with just a string.',
        severity: 'high',
        guideSection: 'Language usage guidelines > Assertions and Conditions',
        guideUrl: `${GUIDE_BASE}#Assertions_and_Conditions`,
        check: (lines: string[], _filename?: string, passedCleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = passedCleanLines || getCleanLines(lines);
            searchLines.forEach((clean, index) => {
                // Match (error "string...) -- error called with a string directly
                if (/\(\s*error\s+"/.test(clean)) {
                    violations.push({
                        ruleId: 'LISP-LNG-06',
                        ruleName: 'ERROR Must Use Condition Type',
                        severity: 'high',
                        line: index + 1,
                        message: 'ERROR called with a string instead of a condition type.',
                        suggestion: 'Use (error \'condition-type ...) with an explicit condition class.',
                        codeSnippet: lines[index].trim(),
                        guideUrl: `${GUIDE_BASE}#Assertions_and_Conditions`
                    });
                }
            });
            return violations;
        }
    },

    // ========================================================================
    // PACKAGE RULES
    // ========================================================================

    {
        id: 'LISP-PKG-01',
        name: 'No Double-Colon Package Access',
        description: 'You should never use the double-colon (::) construct to access internal symbols of another package.',
        severity: 'high',
        guideSection: 'Naming > Packages',
        guideUrl: `${GUIDE_BASE}#Packages`,
        check: (lines: string[], _filename?: string, passedCleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = passedCleanLines || getCleanLines(lines);
            searchLines.forEach((clean, index) => {
                // Match package::symbol pattern (not in-package declarations)
                if (/\b[a-zA-Z][\w-]*::[a-zA-Z]/.test(clean)) {
                    violations.push({
                        ruleId: 'LISP-PKG-01',
                        ruleName: 'No Double-Colon Package Access',
                        severity: 'high',
                        line: index + 1,
                        message: 'Double-colon (::) package access detected. Internal symbols should not be accessed from other packages.',
                        suggestion: 'Export the symbol or use a single colon for external access.',
                        codeSnippet: lines[index].trim(),
                        guideUrl: `${GUIDE_BASE}#Packages`
                    });
                }
            });
            return violations;
        }
    },

    // ========================================================================
    // META-LANGUAGE RULES
    // ========================================================================

    {
        id: 'LISP-META-01',
        name: 'EVAL-WHEN Completeness',
        description: 'EVAL-WHEN should almost always use all of (:compile-toplevel :load-toplevel :execute).',
        severity: 'medium',
        guideSection: 'Meta-language guidelines > EVAL-WHEN',
        guideUrl: `${GUIDE_BASE}#EVAL-WHEN`,
        check: (lines: string[], _filename?: string, passedCleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = passedCleanLines || getCleanLines(lines);
            searchLines.forEach((clean, index) => {
                const match = clean.match(/\(\s*eval-when\s+\(([^)]*)\)/i);
                if (match) {
                    const situations = match[1].toLowerCase();
                    const hasCompile = situations.includes(':compile-toplevel');
                    const hasLoad = situations.includes(':load-toplevel');
                    const hasExecute = situations.includes(':execute');
                    if (!(hasCompile && hasLoad && hasExecute)) {
                        const missing: string[] = [];
                        if (!hasCompile) missing.push(':compile-toplevel');
                        if (!hasLoad) missing.push(':load-toplevel');
                        if (!hasExecute) missing.push(':execute');
                        violations.push({
                            ruleId: 'LISP-META-01',
                            ruleName: 'EVAL-WHEN Completeness',
                            severity: 'medium',
                            line: index + 1,
                            message: `EVAL-WHEN is missing: ${missing.join(', ')}. Almost always all three situations should be included.`,
                            suggestion: 'Use (eval-when (:compile-toplevel :load-toplevel :execute) ...).',
                            codeSnippet: lines[index].trim(),
                            guideUrl: `${GUIDE_BASE}#EVAL-WHEN`
                        });
                    }
                }
            });
            return violations;
        }
    },

    // ========================================================================
    // PROPER FORMS RULES
    // ========================================================================

    {
        id: 'LISP-FORM-01',
        name: 'No Quoted Keys in CASE',
        description: 'You must not use single quotes in CASE forms. \'BAR is (QUOTE BAR), which matches QUOTE, not BAR.',
        severity: 'high',
        guideSection: 'Proper Forms > Conditional Expressions',
        guideUrl: `${GUIDE_BASE}#Conditional_Expressions`,
        check: (lines: string[], _filename?: string, passedCleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = passedCleanLines || getCleanLines(lines);
            let inCase = false;
            let caseDepth = 0;

            searchLines.forEach((clean, index) => {
                // Simple detection: look for (case or (ecase or (ccase
                if (/\(\s*(?:e?case|ccase|typecase|etypecase|ctypecase)\s/i.test(clean)) {
                    inCase = true;
                    caseDepth = 0;
                }

                if (inCase) {
                    // Look for quoted keys like ('foo or ('bar
                    if (/\(\s*'[a-zA-Z]/.test(clean)) {
                        violations.push({
                            ruleId: 'LISP-FORM-01',
                            ruleName: 'No Quoted Keys in CASE',
                            severity: 'high',
                            line: index + 1,
                            message: 'Quoted key in CASE clause. \'FOO matches QUOTE, not FOO.',
                            suggestion: 'Use ((foo) ...) instead of (\'foo ...).',
                            codeSnippet: lines[index].trim(),
                            guideUrl: `${GUIDE_BASE}#Conditional_Expressions`
                        });
                    }
                }

                // Rough tracking of case form end
                for (const ch of clean) {
                    if (ch === '(') caseDepth++;
                    if (ch === ')') caseDepth--;
                }
                if (inCase && caseDepth <= 0) {
                    inCase = false;
                }
            });
            return violations;
        }
    },
    {
        id: 'LISP-FORM-02',
        name: 'Avoid NCONC',
        description: 'You should not use NCONC. Use APPEND instead, or better data structures.',
        severity: 'medium',
        guideSection: 'Optimization > Avoid NCONC',
        guideUrl: `${GUIDE_BASE}#Avoid_NCONC`,
        check: (lines: string[], _filename?: string, passedCleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = passedCleanLines || getCleanLines(lines);
            searchLines.forEach((clean, index) => {
                // Match (nconc ...) or (mapcan ...)
                if (/\(\s*(?:nconc|mapcan)\s/i.test(clean)) {
                    violations.push({
                        ruleId: 'LISP-FORM-02',
                        ruleName: 'Avoid NCONC',
                        severity: 'medium',
                        line: index + 1,
                        message: 'Use of NCONC or MAPCAN detected. These are rarely appropriate.',
                        suggestion: 'Use APPEND or ALEXANDRIA:MAPPEND instead.',
                        codeSnippet: lines[index].trim(),
                        guideUrl: `${GUIDE_BASE}#Avoid_NCONC`
                    });
                }
            });
            return violations;
        }
    },
    {
        id: 'LISP-FORM-03',
        name: 'No &ALLOW-OTHER-KEYS',
        description: 'You should avoid &ALLOW-OTHER-KEYS as it blurs the contract of a function.',
        severity: 'medium',
        guideSection: 'Proper Forms > Defining Functions',
        guideUrl: `${GUIDE_BASE}#Defining_Functions`,
        check: (lines: string[], _filename?: string, passedCleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = passedCleanLines || getCleanLines(lines);
            searchLines.forEach((clean, index) => {
                if (/&allow-other-keys/i.test(clean)) {
                    violations.push({
                        ruleId: 'LISP-FORM-03',
                        ruleName: 'No &ALLOW-OTHER-KEYS',
                        severity: 'medium',
                        line: index + 1,
                        message: '&ALLOW-OTHER-KEYS detected. This disables keyword argument checking.',
                        suggestion: 'Explicitly list all keyword arguments instead of using &ALLOW-OTHER-KEYS.',
                        codeSnippet: lines[index].trim(),
                        guideUrl: `${GUIDE_BASE}#Defining_Functions`
                    });
                }
            });
            return violations;
        }
    },

    // ========================================================================
    // PITFALL RULES
    // ========================================================================

    {
        id: 'LISP-PIT-01',
        name: "Prefer #'FUN over 'FUN",
        description: "When passing functions as arguments, use #'fun (FUNCTION) not 'fun (QUOTE) for lexical scoping.",
        severity: 'low',
        guideSection: "Pitfalls > #'FUN vs. 'FUN",
        guideUrl: `${GUIDE_BASE}`,
        check: (lines: string[], _filename?: string, passedCleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = passedCleanLines || getCleanLines(lines);
            searchLines.forEach((clean, index) => {
                // Detect common HOF calls using 'symbol instead of #'symbol
                // e.g., (mapcar 'foo ...) instead of (mapcar #'foo ...)
                const hofPattern = /\(\s*(?:mapcar|mapcan|mapc|maplist|mapl|remove-if|remove-if-not|find-if|find-if-not|count-if|count-if-not|every|some|notevery|notany|sort|stable-sort|reduce|funcall|apply)\s+'[a-zA-Z]/i;
                if (hofPattern.test(clean)) {
                    violations.push({
                        ruleId: 'LISP-PIT-01',
                        ruleName: "Prefer #'FUN over 'FUN",
                        severity: 'low',
                        line: index + 1,
                        message: "Function passed as 'symbol instead of #'symbol. Use #' for lexical scoping.",
                        suggestion: "Replace 'function-name with #'function-name.",
                        codeSnippet: lines[index].trim(),
                        guideUrl: `${GUIDE_BASE}`
                    });
                }
            });
            return violations;
        }
    },
    {
        id: 'LISP-PIT-02',
        name: 'No SLOT-VALUE Outside Special Methods',
        description: 'Avoid SLOT-VALUE and WITH-SLOTS; use accessors instead unless in INITIALIZE-INSTANCE or PRINT-OBJECT.',
        severity: 'low',
        guideSection: 'Language usage guidelines > CLOS',
        guideUrl: `${GUIDE_BASE}#CLOS`,
        check: (lines: string[], _filename?: string, passedCleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = passedCleanLines || getCleanLines(lines);
            searchLines.forEach((clean, index) => {
                if (/\(\s*(?:slot-value|with-slots)\s/i.test(clean)) {
                    violations.push({
                        ruleId: 'LISP-PIT-02',
                        ruleName: 'No SLOT-VALUE Outside Special Methods',
                        severity: 'low',
                        line: index + 1,
                        message: 'Use of SLOT-VALUE or WITH-SLOTS detected. Prefer accessors.',
                        suggestion: 'Use accessor methods instead, unless inside INITIALIZE-INSTANCE or PRINT-OBJECT.',
                        codeSnippet: lines[index].trim(),
                        guideUrl: `${GUIDE_BASE}#CLOS`
                    });
                }
            });
            return violations;
        }
    },
    {
        id: 'LISP-PIT-03',
        name: 'No CCASE/CTYPECASE',
        description: 'You should not use CCASE or CTYPECASE, especially in server processes.',
        severity: 'medium',
        guideSection: 'Proper Forms > Conditional Expressions',
        guideUrl: `${GUIDE_BASE}#Conditional_Expressions`,
        check: (lines: string[], _filename?: string, passedCleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = passedCleanLines || getCleanLines(lines);
            searchLines.forEach((clean, index) => {
                if (/\(\s*(?:ccase|ctypecase)\s/i.test(clean)) {
                    violations.push({
                        ruleId: 'LISP-PIT-03',
                        ruleName: 'No CCASE/CTYPECASE',
                        severity: 'medium',
                        line: index + 1,
                        message: 'Use of CCASE/CTYPECASE detected. These are meant for interactive use only.',
                        suggestion: 'Use ECASE or ETYPECASE instead.',
                        codeSnippet: lines[index].trim(),
                        guideUrl: `${GUIDE_BASE}#Conditional_Expressions`
                    });
                }
            });
            return violations;
        }
    },

    // ========================================================================
    // DOCUMENTATION REQUIREMENTS
    // ========================================================================

    {
        id: 'LISP-DOC-04',
        name: 'Defun Should Have Docstring',
        description: 'Top-level functions should have documentation strings describing their contract.',
        severity: 'low',
        guideSection: 'Documentation > Document everything',
        guideUrl: `${GUIDE_BASE}#Document_everything`,
        check: (lines: string[], _filename?: string, passedCleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = passedCleanLines || getCleanLines(lines);
            for (let i = 0; i < searchLines.length; i++) {
                const clean = searchLines[i];
                // Match (defun name (args) at beginning of line (top-level)
                const match = clean.match(/^\s*\(\s*(?:defun|defgeneric|defmacro)\s+([\S]+)\s/i);
                if (match) {
                    // Look at next few non-empty lines for a docstring (a line starting with ")
                    let hasDocstring = false;
                    for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
                        const nextLine = lines[j].trim();
                        if (nextLine.startsWith('"')) {
                            hasDocstring = true;
                            break;
                        }
                        // If we hit a non-declaration form, stop looking
                        if (nextLine.startsWith('(') && !/^\(\s*declare\b/i.test(nextLine)) {
                            break;
                        }
                    }
                    if (!hasDocstring) {
                        violations.push({
                            ruleId: 'LISP-DOC-04',
                            ruleName: 'Defun Should Have Docstring',
                            severity: 'low',
                            line: i + 1,
                            message: `Function "${match[1]}" is missing a documentation string.`,
                            suggestion: 'Add a docstring describing the function\'s contract, arguments, and return values.',
                            codeSnippet: lines[i].trim(),
                            guideUrl: `${GUIDE_BASE}#Document_everything`
                        });
                    }
                }
            }
            return violations;
        }
    },
    {
        id: 'LISP-FMT-05',
        name: 'No Trailing Whitespace',
        description: 'Lines should not have trailing whitespace.',
        severity: 'low',
        guideSection: 'Formatting > Horizontal white space',
        guideUrl: `${GUIDE_BASE}#Horizontal_white_space`,
        check: (lines: string[], _filename?: string): Violation[] => {
            const violations: Violation[] = [];
            lines.forEach((line, index) => {
                if (line !== line.trimEnd() && line.trimEnd().length > 0) {
                    violations.push({
                        ruleId: 'LISP-FMT-05',
                        ruleName: 'No Trailing Whitespace',
                        severity: 'low',
                        line: index + 1,
                        message: 'Line has trailing whitespace.',
                        suggestion: 'Remove trailing spaces.',
                        codeSnippet: lines[index].trimEnd(),
                        guideUrl: `${GUIDE_BASE}#Horizontal_white_space`
                    });
                }
            });
            return violations;
        }
    }
];
