import { Rule, Violation, Language } from '../../types.js';

/** Objective-C Rules — Google Objective-C Style Guide */

/** Strip string literals and comments from Obj-C source. */
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

            // Double-quoted string (Objective-C strings are @"...")
            if (line[j] === '@' && line[j + 1] === '"') {
                clean += '@""';
                j += 2;
                while (j < line.length && line[j] !== '"') {
                    if (line[j] === '\\') j++;
                    j++;
                }
                j++;
                continue;
            }

            // Standard C string
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

/** OC-FMT-01: No tabs allowed */
const oc_fmt_01: Rule = {
    id: 'OC-FMT-01',
    name: 'No Tabs',
    description: 'Use only spaces for indentation.',
    severity: 'medium',
    guideSection: '§Spaces vs. Tabs',
    guideUrl: 'https://google.github.io/styleguide/objcguide.html#spaces-vs-tabs',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        lines.forEach((line, i) => {
            if (line.includes('\t')) {
                violations.push(createViolation(
                    oc_fmt_01,
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

/** OC-FEAT-01: No +new */
const oc_feat_01: Rule = {
    id: 'OC-FEAT-01',
    name: 'No +new',
    description: 'Do not use the +new method.',
    severity: 'high',
    guideSection: '§Do Not Use +new',
    guideUrl: 'https://google.github.io/styleguide/objcguide.html#do-not-use-new',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        linesToUse.forEach((line, i) => {
            if (/\+new\b|\[\w+\s+new\]/.test(line)) {
                violations.push(createViolation(
                    oc_feat_01,
                    i + 1,
                    'Objective-C +new method used.',
                    'Use [[Class alloc] init] instead.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

/** OC-FMT-02: 100-character line limit */
const oc_fmt_02: Rule = {
    id: 'OC-FMT-02',
    name: 'Line Length',
    description: 'Lines should not exceed 100 characters.',
    severity: 'low',
    guideSection: '§Line Length',
    guideUrl: 'https://google.github.io/styleguide/objcguide.html#line-length',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        lines.forEach((line, i) => {
            if (line.length > 100) {
                violations.push(createViolation(
                    oc_fmt_02,
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

/** OC-NAME-01: Class names Uppercase */
const oc_name_01: Rule = {
    id: 'OC-NAME-01',
    name: 'Class Naming',
    description: 'Class names should start with an uppercase letter.',
    severity: 'medium',
    guideSection: '§Class Names',
    guideUrl: 'https://google.github.io/styleguide/objcguide.html#class-names',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        linesToUse.forEach((line, i) => {
            const match = /@interface\s+([a-z][A-Za-z0-9_]*)/.exec(line);
            if (match) {
                violations.push(createViolation(
                    oc_name_01,
                    i + 1,
                    `Class name '${match[1]}' should start with an uppercase letter.`,
                    'Rename to Uppercase.',
                    line.trim()
                ));
            }
        });
        return violations;
    }
};

/** OC-NAME-02: Method names lowercase */
const oc_name_02: Rule = {
    id: 'OC-NAME-02',
    name: 'Method Naming',
    description: 'Method names should start with a lowercase letter.',
    severity: 'medium',
    guideSection: '§Objective-C Method Names',
    guideUrl: 'https://google.github.io/styleguide/objcguide.html#objective-c-method-names',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        linesToUse.forEach((line, i) => {
            // Match - (type)MethodName or + (type)MethodName
            const match = /^[-+]\s*\([^)]+\)\s*([A-Z][A-Za-z0-9_]*)/.exec(line.trim());
            if (match) {
                violations.push(createViolation(
                    oc_name_02,
                    i + 1,
                    `Method name '${match[1]}' should start with a lowercase letter.`,
                    'Rename to lowercase.',
                    line.trim()
                ));
            }
        });
        return violations;
    }
};

/** OC-NAME-03: Ivars underscore prefix */
const oc_name_03: Rule = {
    id: 'OC-NAME-03',
    name: 'Ivar Naming',
    description: 'Instance variables should have an underscore prefix.',
    severity: 'low',
    guideSection: '§Variable Names',
    guideUrl: 'https://google.github.io/styleguide/objcguide.html#variable-names',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        let inInterface = false;
        linesToUse.forEach((line, i) => {
            if (line.includes('@interface')) inInterface = true;
            if (line.includes('@end')) inInterface = false;

            if (inInterface) {
                // Match ivar: Type [*]varName; -- use non-greedy type match
                const match = /^\s*\w[\w<>]*\s*\*?\s*([a-z][A-Za-z0-9_]*)\s*;/.exec(line);
                if (match && !match[0].includes('return') && !match[0].includes('static')) {
                    violations.push(createViolation(
                        oc_name_03,
                        i + 1,
                        `Instance variable '${match[1]}' should have an underscore prefix.`,
                        'Rename to _' + match[1],
                        line.trim()
                    ));
                }
            }
        });
        return violations;
    }
};

/** OC-PROP-01: No 'get' prefix for accessors */
const oc_prop_01: Rule = {
    id: 'OC-PROP-01',
    name: 'No Get Prefix',
    description: 'Accessor methods should not be prefixed with "get".',
    severity: 'medium',
    guideSection: '§Objective-C Method Names',
    guideUrl: 'https://google.github.io/styleguide/objcguide.html#objective-c-method-names',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        linesToUse.forEach((line, i) => {
            if (/^[-+]\s*\([^)]+\)\s*get[A-Z]/.test(line.trim())) {
                violations.push(createViolation(
                    oc_prop_01,
                    i + 1,
                    'Accessor name should not use "get" prefix.',
                    'Remove the "get" prefix.',
                    line.trim()
                ));
            }
        });
        return violations;
    }
};

/** OC-EXC-01: No exceptions */
const oc_exc_01: Rule = {
    id: 'OC-EXC-01',
    name: 'No Exceptions',
    description: 'Avoid throwing and catching exceptions.',
    severity: 'high',
    guideSection: '§Avoid Throwing Exceptions',
    guideUrl: 'https://google.github.io/styleguide/objcguide.html#avoid-throwing-exceptions',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        linesToUse.forEach((line, i) => {
            if (/@try|@catch|@throw/.test(line)) {
                violations.push(createViolation(
                    oc_exc_01,
                    i + 1,
                    'Objective-C exception construct used.',
                    'Use NSError for error handling instead.',
                    line.trim()
                ));
            }
        });
        return violations;
    }
};

/** OC-NAME-04: 3-letter prefix for classes */
const oc_name_04: Rule = {
    id: 'OC-NAME-04',
    name: 'Class Prefix',
    description: 'Use 3-letter prefixes for class names (Apple reserves 2-letter ones).',
    severity: 'medium',
    guideSection: '§Class Names',
    guideUrl: 'https://google.github.io/styleguide/objcguide.html#class-names',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        linesToUse.forEach((line, i) => {
            // Match @interface PrefixClassName
            // Google says use 3+ char prefixes. Apple reserves 2-char ones (e.g., NS, UI).
            // Pattern: exactly 2 uppercase (prefix) + uppercase (name start) + lowercase.
            // NSObject -> N,S + O,b -> matches (2-letter prefix, flagged).
            // GTMObject -> G,T + M,O -> no match (3-letter prefix, OK).
            const match = /@interface\s+([A-Z]{2}[A-Z][a-z]\w*)/.exec(line);
            if (match) {
                violations.push(createViolation(
                    oc_name_04,
                    i + 1,
                    `Class name '${match[1]}' uses a 2-letter prefix.`,
                    'Use a 3-letter prefix as per Google Style Guide (e.g., GTM, not GT).',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

/** OC-NAME-05: k-prefix for constants */
const oc_name_05: Rule = {
    id: 'OC-NAME-05',
    name: 'Constant Naming',
    description: 'Global constants should use a "k" prefix followed by PascalCase.',
    severity: 'medium',
    guideSection: '§Constant Names',
    guideUrl: 'https://google.github.io/styleguide/objcguide.html#constant-names',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        linesToUse.forEach((line, i) => {
            // Find global constants (not ivars)
            const match = /const\s+\w+\s+\*?\s*([A-Z_][A-Za-z0-9_]*)\s*=/.exec(line);
            if (match && !match[1].startsWith('k')) {
                violations.push(createViolation(
                    oc_name_05,
                    i + 1,
                    `Constant '${match[1]}' should start with a 'k' prefix (e.g. kMyConstant).`,
                    "Add 'k' prefix and use PascalCase.",
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

/** OC-FMT-04: Method declaration spacing */
const oc_fmt_04: Rule = {
    id: 'OC-FMT-04',
    name: 'Method Spacing',
    description: 'Space after -/+ and return type in method declarations.',
    severity: 'low',
    guideSection: '§Objective-C Method Declarations',
    guideUrl: 'https://google.github.io/styleguide/objcguide.html#objective-c-method-declarations',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            if (/^[-+]\([^)]+\)/.test(line.trim())) {
                violations.push(createViolation(
                    oc_fmt_04,
                    i + 1,
                    'Missing space after -/+ in method declaration.',
                    'Add a space after the method type indicator.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

/** OC-FMT-05: Property spacing */
const oc_fmt_05: Rule = {
    id: 'OC-FMT-05',
    name: 'Property Spacing',
    description: 'Spacing in property declarations: space after comma, no space inside parentheses.',
    severity: 'low',
    guideSection: '§Objective-C Property Declarations',
    guideUrl: 'https://google.github.io/styleguide/objcguide.html#objective-c-property-declarations',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            if (line.includes('@property')) {
                if (/\(\s|\s\)/.test(line)) {
                    violations.push(createViolation(
                        oc_fmt_05,
                        i + 1,
                        'Space found inside property parentheses.',
                        'Remove spaces inside the property attribute list.',
                        lines[i].trim()
                    ));
                }
                if (/\w,\w/.test(line)) {
                    violations.push(createViolation(
                        oc_fmt_05,
                        i + 1,
                        'Missing space after comma in property attributes.',
                        'Add a space after the comma.',
                        lines[i].trim()
                    ));
                }
            }
        });
        return violations;
    }
};

/** OC-NAME-06: Category method prefix */
const oc_name_06: Rule = {
    id: 'OC-NAME-06',
    name: 'Category Method Prefix',
    description: 'Methods in a category on a shared class should be prefixed with a lowercase prefix and an underscore.',
    severity: 'medium',
    guideSection: '§Category Naming',
    guideUrl: 'https://google.github.io/styleguide/objcguide.html#category-naming',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        let inSharedCategory = false;
        linesToUse.forEach((line, i) => {
            // Heuristic: If it looks like a category on a common class or has a prefix in the category name
            const categoryMatch = /@interface\s+\w+\s*\(([A-Z]{3,}\w*)\)/.exec(line);
            if (categoryMatch) inSharedCategory = true;
            if (line.includes('@end')) inSharedCategory = false;

            if (inSharedCategory) {
                const methodMatch = /^[-+]\s*\([^)]+\)\s*([a-z]\w*)/.exec(line.trim());
                if (methodMatch && !methodMatch[1].includes('_')) {
                    violations.push(createViolation(
                        oc_name_06,
                        i + 1,
                        `Category method '${methodMatch[1]}' missing prefix.`,
                        'Add a lowercase prefix and underscore (e.g., gtm_...).',
                        lines[i].trim()
                    ));
                }
            }
        });
        return violations;
    }
};

/** OC-NAME-07: Boolean accessor naming */
const oc_name_07: Rule = {
    id: 'OC-NAME-07',
    name: 'Boolean Accessor Naming',
    description: 'Boolean accessors should start with "is".',
    severity: 'low',
    guideSection: '§Objective-C Method Names',
    guideUrl: 'https://google.github.io/styleguide/objcguide.html#objective-c-method-names',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        linesToUse.forEach((line, i) => {
            const match = /^[-+]\s*\(\s*BOOL\s*\)\s*([a-z]\w*)/.exec(line.trim());
            if (match && !match[1].startsWith('is') && !match[1].startsWith('should') && !match[1].startsWith('has') && !match[1].startsWith('can')) {
                violations.push(createViolation(
                    oc_name_07,
                    i + 1,
                    `Boolean accessor '${match[1]}' should start with 'is'.`,
                    `Rename to 'is${match[1].charAt(0).toUpperCase() + match[1].slice(1)}'.`,
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

/** OC-NAME-08: Global function naming */
const oc_name_08: Rule = {
    id: 'OC-NAME-08',
    name: 'Global Function Naming',
    description: 'Global functions should use PascalCase and have a prefix.',
    severity: 'medium',
    guideSection: '§Function Names',
    guideUrl: 'https://google.github.io/styleguide/objcguide.html#function-names',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        linesToUse.forEach((line, i) => {
            // Match function declaration/definition: Type Name(params)
            const match = /^\w+[\s*]+([a-z]\w*)\s*\(/.exec(line);
            if (match && !line.includes('typedef') && !line.includes('return')) {
                violations.push(createViolation(
                    oc_name_08,
                    i + 1,
                    `Global function '${match[1]}' should use PascalCase with a prefix.`,
                    'Rename to GTMMyFunction style.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

/** OC-NAME-09: Global variable naming */
const oc_name_09: Rule = {
    id: 'OC-NAME-09',
    name: 'Global Variable Naming',
    description: 'File-scope or global variables should use a "g" prefix.',
    severity: 'low',
    guideSection: '§Variable Names',
    guideUrl: 'https://google.github.io/styleguide/objcguide.html#variable-names',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        linesToUse.forEach((line, i) => {
            // Only match file-scope variable declarations: Type *varName = ... or Type varName;
            // Must start at column 0 (no indentation = file scope) with a known C type pattern
            const trimmed = line.trim();
            // Skip lines inside functions/methods (indented), preprocessor, comments, includes, etc.
            if (line !== trimmed) return; // indented = not file-scope
            if (/^[@#\/{}]/.test(trimmed)) return;
            if (/^\s*(?:return|if|for|while|switch|case|break|else|typedef)\b/.test(trimmed)) return;
            // Match: Type [*]varName [= ...]; at file scope, excluding const/static
            const match = /^(?:NS\w+|id|BOOL|void|int|float|double|char|long|unsigned)\s+\*?\s*([a-zA-Z]\w*)\s*[=;]/.exec(trimmed);
            if (match && !trimmed.includes('const') && !trimmed.includes('static') && !trimmed.includes('(')) {
                if (!match[1].startsWith('g') || !match[1][1] || match[1][1] === match[1][1].toLowerCase()) {
                    violations.push(createViolation(
                        oc_name_09,
                        i + 1,
                        `Global variable '${match[1]}' should have a 'g' prefix (e.g., gMyVariable).`,
                        "Add 'g' prefix.",
                        lines[i].trim()
                    ));
                }
            }
        });
        return violations;
    }
};

/** OC-DECL-01: Declaration Order */
const oc_decl_01: Rule = {
    id: 'OC-DECL-01',
    name: 'Declaration Order',
    description: 'Recommended order: properties, class methods, initializers, then instance methods.',
    severity: 'low',
    guideSection: '§Method Declarations',
    guideUrl: 'https://google.github.io/styleguide/objcguide.html#method-declarations',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        let lastType = 0; // 1: property, 2: class method, 3: init, 4: instance method
        let inInterface = false;

        linesToUse.forEach((line, i) => {
            const trimmed = line.trim();
            if (trimmed.includes('@interface')) {
                inInterface = true;
                lastType = 0;
            }
            if (trimmed.includes('@end')) inInterface = false;

            if (inInterface) {
                let currentType = 0;
                if (trimmed.startsWith('@property')) currentType = 1;
                else if (trimmed.startsWith('+')) currentType = 2;
                else if (trimmed.startsWith('-') && (trimmed.includes('init') || trimmed.includes('initWith'))) currentType = 3;
                else if (trimmed.startsWith('-')) currentType = 4;

                if (currentType > 0) {
                    if (currentType < lastType) {
                        violations.push(createViolation(
                            oc_decl_01,
                            i + 1,
                            'Incorrect declaration order in @interface.',
                            'Reorder to: properties, class methods, initializers, instance methods.',
                            lines[i].trim()
                        ));
                    }
                    lastType = Math.max(lastType, currentType);
                }
            }
        });
        return violations;
    }
};

/** OC-TYPE-01: Avoid Unsigned Integers */
const oc_type_01: Rule = {
    id: 'OC-TYPE-01',
    name: 'Avoid Unsigned Integers',
    description: 'Avoid unsigned integers except when matching system interfaces.',
    severity: 'low',
    guideSection: '§Unsigned Integers',
    guideUrl: 'https://google.github.io/styleguide/objcguide.html#unsigned-integers',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        linesToUse.forEach((line, i) => {
            if (/\bunsigned\s+int\b|\buint(32|64)_t\b/.test(line)) {
                violations.push(createViolation(
                    oc_type_01,
                    i + 1,
                    'Unsigned integer used.',
                    'Use NSInteger or int unless matching a system API.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

/** OC-FMT-06: Braces for if-else */
const oc_fmt_06: Rule = {
    id: 'OC-FMT-06',
    name: 'Braces for if-else',
    description: 'If an if clause has an else clause, both clauses should use braces.',
    severity: 'medium',
    guideSection: '§Conditionals',
    guideUrl: 'https://google.github.io/styleguide/objcguide.html#conditionals',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        linesToUse.forEach((line, i) => {
            if (/\bif\s*\(.*\)\s*[^{;]+$/.test(line)) {
                // Check next few lines for else
                let foundElse = false;
                for (let j = i + 1; j < Math.min(i + 4, linesToUse.length); j++) {
                    if (linesToUse[j].trim().startsWith('else')) {
                        foundElse = true;
                        break;
                    }
                }
                if (foundElse) {
                    violations.push(createViolation(
                        oc_fmt_06,
                        i + 1,
                        'Missing braces in if-else structure.',
                        'Add braces to both if and else blocks.',
                        lines[i].trim()
                    ));
                }
            }
        });
        return violations;
    }
};

/** OC-FMT-07: Opening brace placement */
const oc_fmt_07: Rule = {
    id: 'OC-FMT-07',
    name: 'Brace Placement',
    description: 'The open curly brace is always on the end of the last line of the declaration/statement.',
    severity: 'low',
    guideSection: '§Conditionals',
    guideUrl: 'https://google.github.io/styleguide/objcguide.html#conditionals',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        linesToUse.forEach((line, i) => {
            if (line.trim() === '{' && i > 0) {
                const prev = linesToUse[i - 1].trim();
                if (prev !== '' && !prev.endsWith('{') && !prev.endsWith(';')) {
                    violations.push(createViolation(
                        oc_fmt_07,
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

/** OC-FMT-08: Binary operator spacing */
const oc_fmt_08: Rule = {
    id: 'OC-FMT-08',
    name: 'Operator Spacing',
    description: 'Use a space around binary operators and assignments.',
    severity: 'low',
    guideSection: '§Expressions',
    guideUrl: 'https://google.github.io/styleguide/objcguide.html#expressions',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            // Regex for common binary operators without surrounding spaces
            // Exclude common patterns like *ptr or protocol<P>
            const match = /[^\s]([+\-\/]|==|!=|>=|<=)[^\s]/.exec(line);
            if (match) {
                // Avoid matching * for pointers (very common in OC)
                if (match[1] === '*' || match[1] === '&') return;
                violations.push(createViolation(
                    oc_fmt_08,
                    i + 1,
                    `Missing spaces around operator '${match[1]}'.`,
                    'Add a space before and after the operator.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

/** OC-FEAT-02: Ivars visibility in headers */
const oc_feat_02: Rule = {
    id: 'OC-FEAT-02',
    name: 'Ivar Visibility',
    description: 'Instance variables in headers should be @protected or @private.',
    severity: 'high',
    guideSection: '§Instance Variables In Headers Should Be @protected or @private',
    guideUrl: 'https://google.github.io/styleguide/objcguide.html#instance-variables-in-headers-should-be-protected-or-private',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        if (!filename?.endsWith('.h')) return violations;

        const linesToUse = cleanLines || lines;
        let inIvarBlock = false;
        let visibilityFound = false;

        linesToUse.forEach((line, i) => {
            const trimmed = line.trim();
            if (trimmed.includes('@interface') && trimmed.includes('{')) {
                inIvarBlock = true;
            } else if (trimmed.includes('@interface')) {
                // Check if next line starts the ivar block
                if (i + 1 < linesToUse.length && linesToUse[i + 1].includes('{')) inIvarBlock = true;
            }

            if (inIvarBlock) {
                if (trimmed.includes('@protected') || trimmed.includes('@private')) visibilityFound = true;
                if (trimmed.includes('@public')) visibilityFound = false;

                if (trimmed.includes('}')) {
                    inIvarBlock = false;
                    visibilityFound = false;
                    return;
                }

                // Match ivar declaration
                const ivarMatch = /^[\w<>* ]+\s*([a-z_]\w*);/.exec(trimmed);
                if (ivarMatch && !visibilityFound) {
                    violations.push(createViolation(
                        oc_feat_02,
                        i + 1,
                        'Ivar in header should have @protected or @private visibility.',
                        'Add @private or @protected directive.',
                        lines[i].trim()
                    ));
                }
            }
        });
        return violations;
    }
};

/** OC-FEAT-03: Property access in init/dealloc */
const oc_feat_03: Rule = {
    id: 'OC-FEAT-03',
    name: 'Init/Dealloc Property Access',
    description: 'Avoid messaging the current object within initializers and -dealloc. Use ivars directly.',
    severity: 'high',
    guideSection: '§Avoid Messaging the Current Object Within Initializers and -dealloc',
    guideUrl: 'https://google.github.io/styleguide/objcguide.html#avoid-messaging-the-current-object-within-initializers-and-dealloc',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        let inForbiddenMethod = false;

        linesToUse.forEach((line, i) => {
            const trimmed = line.trim();
            if (/^[-]\s*\([^)]+\)\s*(init|dealloc)\b/.test(trimmed)) inForbiddenMethod = true;
            if (trimmed === '}' && inForbiddenMethod) inForbiddenMethod = false;

            if (inForbiddenMethod) {
                if (/self\.\w+/.test(line) || /\[self\s+set\w+/.test(line)) {
                    violations.push(createViolation(
                        oc_feat_03,
                        i + 1,
                        'Avoid using property accessors in init or dealloc.',
                        'Access the instance variable directly (e.g., _property = ...).',
                        lines[i].trim()
                    ));
                }
            }
        });
        return violations;
    }
};

/** OC-FEAT-04: Copy attribute for mutable types */
const oc_feat_04: Rule = {
    id: 'OC-FEAT-04',
    name: 'Property Copy Attribute',
    description: 'Use the copy attribute for types that have a mutable subclass (NSString, NSArray, etc.).',
    severity: 'medium',
    guideSection: '§Mutables, Copies and Ownership',
    guideUrl: 'https://google.github.io/styleguide/objcguide.html#mutables-copies-and-ownership',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        linesToUse.forEach((cl, i) => {
            if (cl.includes('@property') && (cl.includes('NSString') || cl.includes('NSArray') || cl.includes('NSDictionary'))) {
                if (!cl.includes('copy') && !cl.includes('readonly')) {
                    violations.push(createViolation(
                        oc_feat_04,
                        i + 1,
                        'Mutable-ready type should use "copy" attribute.',
                        'Add "copy" to the property attributes.',
                        lines[i].trim()
                    ));
                }
            }
        });
        return violations;
    }
};

/** OC-FEAT-05: Simple nil checks */
const oc_feat_05: Rule = {
    id: 'OC-FEAT-05',
    name: 'Simple nil Checks',
    description: 'Use simple if (obj) instead of if (obj != nil).',
    severity: 'low',
    guideSection: '§nil Checks',
    guideUrl: 'https://google.github.io/styleguide/objcguide.html#nil-checks',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        linesToUse.forEach((line, i) => {
            if (/!= nil\b|== nil\b/.test(line)) {
                violations.push(createViolation(
                    oc_feat_05,
                    i + 1,
                    'Explicit nil comparison.',
                    'Use simple boolean check: if (obj) or if (!obj).',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

/** OC-FEAT-06: BOOL pitfalls */
const oc_feat_06: Rule = {
    id: 'OC-FEAT-06',
    name: 'BOOL Comparison',
    description: 'Do not compare BOOL directly to YES or NO.',
    severity: 'low',
    guideSection: '§BOOL Pitfalls',
    guideUrl: 'https://google.github.io/styleguide/objcguide.html#bool-pitfalls',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        linesToUse.forEach((line, i) => {
            if (/== YES\b|== NO\b|!= YES\b|!= NO\b/.test(line)) {
                violations.push(createViolation(
                    oc_feat_06,
                    i + 1,
                    'Direct comparison of BOOL to YES/NO.',
                    'Use the boolean value directly.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

/** OC-DOC-01: Declaration comments */
const oc_doc_01: Rule = {
    id: 'OC-DOC-01',
    name: 'Declaration Comments',
    description: 'Use javadoc-style comments (/** ... */) for public API declarations.',
    severity: 'low',
    guideSection: '§Declaration Comments',
    guideUrl: 'https://google.github.io/styleguide/objcguide.html#declaration-comments',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        lines.forEach((rawLine, i) => {
            if (rawLine.includes('@interface') || rawLine.includes('@protocol')) {
                // Check raw lines for doc comments since cleanLines strips them
                const prev = i > 0 ? lines[i - 1].trim() : '';
                if (prev === '') {
                    // check 2 lines up
                    const prev2 = i > 1 ? lines[i - 2].trim() : '';
                    if (!prev2.startsWith('/**')) {
                        violations.push(createViolation(
                            oc_doc_01,
                            i + 1,
                            'Public declaration missing Javadoc-style comment.',
                            'Add a /** ... */ comment above the declaration.',
                            rawLine.trim()
                        ));
                    }
                } else if (!prev.startsWith('/**') && !prev.endsWith('*/')) {
                    violations.push(createViolation(
                        oc_doc_01,
                        i + 1,
                        'Public declaration missing Javadoc-style comment.',
                        'Add a /** ... */ comment above the declaration.',
                        rawLine.trim()
                    ));
                }
            }
        });
        return violations;
    }
};

/** OC-C-01: Prefer constants over #define */
const oc_c_01: Rule = {
    id: 'OC-C-01',
    name: 'Prefer Constants',
    description: 'Prefer constants (const) or inline functions over #define for values.',
    severity: 'low',
    guideSection: '§Macros',
    guideUrl: 'https://google.github.io/styleguide/objcguide.html#macros',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const linesToUse = cleanLines || lines;
        linesToUse.forEach((line, i) => {
            if (/#define\s+\w+\s+[0-9"]+/.test(line)) {
                violations.push(createViolation(
                    oc_c_01,
                    i + 1,
                    'Value macro (#define) used.',
                    'Use "static const" or "const" instead.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

/** OC-FMT-03: Trailing whitespace */
const oc_fmt_03: Rule = {
    id: 'OC-FMT-03',
    name: 'Trailing Whitespace',
    description: 'Lines should not have trailing whitespace.',
    severity: 'low',
    guideSection: '§Spaces vs. Tabs',
    guideUrl: 'https://google.github.io/styleguide/objcguide.html#spaces-vs-tabs',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        // Whitespace rule: use raw lines
        lines.forEach((line, i) => {
            if (/\S\s+$/.test(line)) {
                violations.push(createViolation(
                    oc_fmt_03,
                    i + 1,
                    'Line has trailing whitespace.',
                    'Remove trailing whitespace.',
                    line.trimEnd()
                ));
            }
        });
        return violations;
    }
};

/** OC-FMT-09: 2-space indentation */
const oc_fmt_09: Rule = {
    id: 'OC-FMT-09',
    name: 'Indentation',
    description: 'Use 2 spaces for indentation.',
    severity: 'low',
    guideSection: '§Spaces vs. Tabs',
    guideUrl: 'https://google.github.io/styleguide/objcguide.html#spaces-vs-tabs',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        // Whitespace rule: use raw lines
        lines.forEach((line, i) => {
            const leadingSpaces = line.match(/^( +)/);
            if (leadingSpaces && leadingSpaces[1].length % 2 !== 0) {
                violations.push(createViolation(
                    oc_fmt_09,
                    i + 1,
                    `Indentation of ${leadingSpaces[1].length} spaces is not a multiple of 2.`,
                    'Use 2-space indentation.',
                    line.trim()
                ));
            }
        });
        return violations;
    }
};

/** OC-IMP-01: Use #import not #include */
const oc_imp_01: Rule = {
    id: 'OC-IMP-01',
    name: 'Use #import',
    description: 'Use #import for Objective-C/Objective-C++ headers, not #include.',
    severity: 'medium',
    guideSection: '§#import and #include',
    guideUrl: 'https://google.github.io/styleguide/objcguide.html#import-and-include',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            // Flag #include of .h files in .m/.mm files (should be #import)
            if (/^#include\s+["<][^">]+\.h[">]/.test(line.trim())) {
                if (filename && /\.(m|mm)$/.test(filename)) {
                    violations.push(createViolation(
                        oc_imp_01,
                        i + 1,
                        'Use #import instead of #include for Objective-C headers.',
                        'Replace #include with #import.',
                        lines[i].trim()
                    ));
                }
            }
        });
        return violations;
    }
};

/** OC-IMP-02: Import ordering */
const oc_imp_02: Rule = {
    id: 'OC-IMP-02',
    name: 'Import Ordering',
    description: 'Imports should be ordered: related header, OS/SDK, project headers, each group separated by a blank line.',
    severity: 'low',
    guideSection: '§#import and #include',
    guideUrl: 'https://google.github.io/styleguide/objcguide.html#import-and-include',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        // Check that angle-bracket imports don't come after quoted imports
        let seenQuotedImport = false;
        searchLines.forEach((line, i) => {
            const trimmed = line.trim();
            if (/^#import\s+"/.test(trimmed)) {
                seenQuotedImport = true;
            }
            if (/^#import\s+</.test(trimmed) && seenQuotedImport) {
                violations.push(createViolation(
                    oc_imp_02,
                    i + 1,
                    'Framework import (#import <...>) appears after project import (#import "...").',
                    'Move framework imports before project imports.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

/** OC-FEAT-07: Use NS_ENUM / NS_OPTIONS */
const oc_feat_07: Rule = {
    id: 'OC-FEAT-07',
    name: 'Use NS_ENUM',
    description: 'Use NS_ENUM and NS_OPTIONS macros for enum declarations.',
    severity: 'medium',
    guideSection: '§Enumerated Types',
    guideUrl: 'https://google.github.io/styleguide/objcguide.html#enumerated-types',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            // Flag plain C enum declarations
            if (/^\s*(?:typedef\s+)?enum\s*\{/.test(line) || /^\s*(?:typedef\s+)?enum\s+\w+\s*\{/.test(line)) {
                if (!line.includes('NS_ENUM') && !line.includes('NS_OPTIONS')) {
                    violations.push(createViolation(
                        oc_feat_07,
                        i + 1,
                        'Plain C enum used instead of NS_ENUM or NS_OPTIONS.',
                        'Use typedef NS_ENUM(NSInteger, MyEnum) { ... } syntax.',
                        lines[i].trim()
                    ));
                }
            }
        });
        return violations;
    }
};

/** OC-FEAT-08: Use Objective-C literals */
const oc_feat_08: Rule = {
    id: 'OC-FEAT-08',
    name: 'Objective-C Literals',
    description: 'Use Objective-C literal syntax for NSNumber, NSArray, and NSDictionary.',
    severity: 'low',
    guideSection: '§Objective-C Literals',
    guideUrl: 'https://google.github.io/styleguide/objcguide.html#objective-c-literals',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            // Flag [NSNumber numberWithInt:], [NSArray arrayWithObjects:], [NSDictionary dictionaryWithObjectsAndKeys:]
            if (/\[NSNumber\s+numberWith(Int|Float|Double|Bool|Integer|Long):/i.test(line)) {
                violations.push(createViolation(
                    oc_feat_08,
                    i + 1,
                    'Use @() literal syntax for NSNumber.',
                    'Replace [NSNumber numberWith...] with @(...) literal.',
                    lines[i].trim()
                ));
            }
            if (/\[NSArray\s+arrayWithObjects:/.test(line)) {
                violations.push(createViolation(
                    oc_feat_08,
                    i + 1,
                    'Use @[] literal syntax for NSArray.',
                    'Replace [NSArray arrayWithObjects:...] with @[...] literal.',
                    lines[i].trim()
                ));
            }
            if (/\[NSDictionary\s+dictionaryWithObjectsAndKeys:/.test(line)) {
                violations.push(createViolation(
                    oc_feat_08,
                    i + 1,
                    'Use @{} literal syntax for NSDictionary.',
                    'Replace [NSDictionary dictionaryWithObjectsAndKeys:...] with @{...} literal.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

/** OC-FEAT-09: Avoid retain cycles in blocks */
const oc_feat_09: Rule = {
    id: 'OC-FEAT-09',
    name: 'Block Retain Cycles',
    description: 'Use __weak references to self in blocks to avoid retain cycles.',
    severity: 'high',
    guideSection: '§Blocks',
    guideUrl: 'https://google.github.io/styleguide/objcguide.html#blocks',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        let inBlock = false;
        let blockStart = -1;
        let hasWeakSelf = false;
        let braceDepth = 0;

        searchLines.forEach((line, i) => {
            // Detect block start with ^{ or ^(...)  {
            if (/\^[^{]*\{/.test(line) && !hasWeakSelf) {
                // Check if __weak typeof(self) or weakSelf exists nearby (within 3 lines before)
                hasWeakSelf = false;
                for (let j = Math.max(0, i - 3); j <= i; j++) {
                    if (/__weak\b/.test(searchLines[j]) || /weakSelf\b/.test(searchLines[j])) {
                        hasWeakSelf = true;
                        break;
                    }
                }
                if (!hasWeakSelf) {
                    inBlock = true;
                    blockStart = i;
                    braceDepth = 0;
                }
            }

            if (inBlock) {
                braceDepth += (line.match(/\{/g) || []).length;
                braceDepth -= (line.match(/\}/g) || []).length;

                if (/\bself\b/.test(line)) {
                    violations.push(createViolation(
                        oc_feat_09,
                        i + 1,
                        'Strong reference to self inside block may cause retain cycle.',
                        'Capture a __weak reference to self before the block.',
                        lines[i].trim()
                    ));
                    inBlock = false;
                }

                if (braceDepth <= 0) {
                    inBlock = false;
                    hasWeakSelf = false;
                }
            }
        });
        return violations;
    }
};

/** OC-FEAT-10: Designated initializer annotation */
const oc_feat_10: Rule = {
    id: 'OC-FEAT-10',
    name: 'Designated Initializer',
    description: 'Mark designated initializers with NS_DESIGNATED_INITIALIZER.',
    severity: 'low',
    guideSection: '§Designated Initializers',
    guideUrl: 'https://google.github.io/styleguide/objcguide.html#designated-initializers',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        if (!filename?.endsWith('.h')) return violations;
        const searchLines = cleanLines || getCleanLines(lines);
        let hasInit = false;
        let hasDesignatedAnnotation = false;

        searchLines.forEach((line, i) => {
            if (/^[-]\s*\([^)]+\)\s*init(With\w*)?\b/.test(line.trim())) {
                hasInit = true;
            }
            if (line.includes('NS_DESIGNATED_INITIALIZER')) {
                hasDesignatedAnnotation = true;
            }
        });

        if (hasInit && !hasDesignatedAnnotation) {
            violations.push(createViolation(
                oc_feat_10,
                1,
                'Header declares init methods without NS_DESIGNATED_INITIALIZER.',
                'Mark the designated initializer with NS_DESIGNATED_INITIALIZER.',
                ''
            ));
        }
        return violations;
    }
};

/** OC-PROP-02: Nonatomic property */
const oc_prop_02: Rule = {
    id: 'OC-PROP-02',
    name: 'Nonatomic Property',
    description: 'Properties should be nonatomic unless thread safety is required.',
    severity: 'low',
    guideSection: '§Objective-C Property Declarations',
    guideUrl: 'https://google.github.io/styleguide/objcguide.html#objective-c-property-declarations',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            if (/@property\s*\(/.test(line)) {
                const attrs = line.match(/@property\s*\(([^)]+)\)/);
                if (attrs && !attrs[1].includes('nonatomic') && !attrs[1].includes('atomic')) {
                    violations.push(createViolation(
                        oc_prop_02,
                        i + 1,
                        'Property missing nonatomic attribute.',
                        'Add nonatomic to property attributes unless thread safety is required.',
                        lines[i].trim()
                    ));
                }
            }
        });
        return violations;
    }
};

/** OC-DOC-02: Implementation comment */
const oc_doc_02: Rule = {
    id: 'OC-DOC-02',
    name: 'Implementation Comments',
    description: 'Non-trivial methods should have implementation comments explaining the "why".',
    severity: 'low',
    guideSection: '§Implementation Comments',
    guideUrl: 'https://google.github.io/styleguide/objcguide.html#implementation-comments',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        // This is hard to check with regex alone; check for long methods without any comments
        let methodStart = -1;
        let braceDepth = 0;
        let hasComment = false;
        let lineCount = 0;

        lines.forEach((line, i) => {
            const trimmed = line.trim();
            if (/^[-+]\s*\([^)]+\)/.test(trimmed) && trimmed.includes('{')) {
                methodStart = i;
                braceDepth = 1;
                hasComment = false;
                lineCount = 0;
            } else if (methodStart >= 0) {
                braceDepth += (line.match(/\{/g) || []).length;
                braceDepth -= (line.match(/\}/g) || []).length;
                lineCount++;

                if (trimmed.startsWith('//') || trimmed.startsWith('/*')) {
                    hasComment = true;
                }

                if (braceDepth <= 0) {
                    if (lineCount > 20 && !hasComment) {
                        violations.push(createViolation(
                            oc_doc_02,
                            methodStart + 1,
                            `Method has ${lineCount} lines without any comments.`,
                            'Add implementation comments explaining non-obvious logic.',
                            lines[methodStart].trim()
                        ));
                    }
                    methodStart = -1;
                }
            }
        });
        return violations;
    }
};

/** OC-NAME-10: Protocol naming */
const oc_name_10: Rule = {
    id: 'OC-NAME-10',
    name: 'Protocol Naming',
    description: 'Protocol names should use PascalCase and commonly end in Delegate or DataSource.',
    severity: 'low',
    guideSection: '§Protocol Names',
    guideUrl: 'https://google.github.io/styleguide/objcguide.html#protocol-names',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            const match = /@protocol\s+([a-z]\w*)/.exec(line);
            if (match) {
                violations.push(createViolation(
                    oc_name_10,
                    i + 1,
                    `Protocol name '${match[1]}' should start with an uppercase letter.`,
                    'Use PascalCase for protocol names.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

/** OC-NAME-11: Macro naming */
const oc_name_11: Rule = {
    id: 'OC-NAME-11',
    name: 'Macro Naming',
    description: 'Macro names should be ALL_CAPS_WITH_UNDERSCORES.',
    severity: 'medium',
    guideSection: '§Macro Names',
    guideUrl: 'https://google.github.io/styleguide/objcguide.html#macro-names',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        searchLines.forEach((line, i) => {
            const match = /^#define\s+([a-z]\w*)/.exec(line.trim());
            if (match) {
                violations.push(createViolation(
                    oc_name_11,
                    i + 1,
                    `Macro name '${match[1]}' should be ALL_CAPS_WITH_UNDERSCORES.`,
                    'Rename macro to ALL_CAPS style.',
                    lines[i].trim()
                ));
            }
        });
        return violations;
    }
};

/** OC-FMT-10: Dealloc placement */
const oc_fmt_10: Rule = {
    id: 'OC-FMT-10',
    name: 'Dealloc Placement',
    description: 'The -dealloc method should appear directly after the @implementation.',
    severity: 'low',
    guideSection: '§Dealloc',
    guideUrl: 'https://google.github.io/styleguide/objcguide.html#dealloc',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        const searchLines = cleanLines || getCleanLines(lines);
        let afterImpl = false;
        let foundFirstMethod = false;
        let implLine = -1;

        searchLines.forEach((line, i) => {
            const trimmed = line.trim();
            if (trimmed.startsWith('@implementation')) {
                afterImpl = true;
                foundFirstMethod = false;
                implLine = i;
            }
            if (afterImpl && /^[-+]\s*\(/.test(trimmed)) {
                if (!foundFirstMethod) {
                    foundFirstMethod = true;
                    // First method should be dealloc (if dealloc exists at all)
                } else if (trimmed.includes('dealloc') && /^[-]\s*\([^)]*\)\s*dealloc\b/.test(trimmed)) {
                    violations.push(createViolation(
                        oc_fmt_10,
                        i + 1,
                        '-dealloc should be the first method after @implementation.',
                        'Move -dealloc to directly after @implementation.',
                        lines[i].trim()
                    ));
                }
            }
            if (trimmed === '@end') {
                afterImpl = false;
            }
        });
        return violations;
    }
};

/** OC-FEAT-11: Nullability annotations */
const oc_feat_11: Rule = {
    id: 'OC-FEAT-11',
    name: 'Nullability Annotations',
    description: 'Headers should use NS_ASSUME_NONNULL_BEGIN/END or explicit nullable/nonnull annotations.',
    severity: 'medium',
    guideSection: '§Nullability',
    guideUrl: 'https://google.github.io/styleguide/objcguide.html#nullability',
    check: (lines, filename, cleanLines) => {
        const violations: Violation[] = [];
        if (!filename?.endsWith('.h')) return violations;

        let hasNullabilityRegion = false;
        let hasInterface = false;

        lines.forEach((line) => {
            if (line.includes('NS_ASSUME_NONNULL_BEGIN')) hasNullabilityRegion = true;
            if (line.includes('@interface') || line.includes('@protocol')) hasInterface = true;
        });

        if (hasInterface && !hasNullabilityRegion) {
            violations.push(createViolation(
                oc_feat_11,
                1,
                'Header missing NS_ASSUME_NONNULL_BEGIN/END.',
                'Wrap header declarations with NS_ASSUME_NONNULL_BEGIN and NS_ASSUME_NONNULL_END.',
                ''
            ));
        }
        return violations;
    }
};

// §Containers -- deferred to AI deep review layer (type checking required)
// §Autorelease Pool Blocks -- deferred to AI deep review layer
// §Protocols -- deferred to AI deep review layer (conformance semantics)
// §Properties in Protocols -- deferred to AI deep review layer

export const objcRules: Rule[] = [
    oc_fmt_01,
    oc_fmt_02,
    oc_fmt_03,
    oc_fmt_04,
    oc_fmt_05,
    oc_fmt_06,
    oc_fmt_07,
    oc_fmt_08,
    oc_fmt_09,
    oc_fmt_10,
    oc_feat_01,
    oc_feat_02,
    oc_feat_03,
    oc_feat_04,
    oc_feat_05,
    oc_feat_06,
    oc_feat_07,
    oc_feat_08,
    oc_feat_09,
    oc_feat_10,
    oc_feat_11,
    oc_name_01,
    oc_name_02,
    oc_name_03,
    oc_name_04,
    oc_name_05,
    oc_name_06,
    oc_name_07,
    oc_name_08,
    oc_name_09,
    oc_name_10,
    oc_name_11,
    oc_decl_01,
    oc_type_01,
    oc_prop_01,
    oc_prop_02,
    oc_exc_01,
    oc_doc_01,
    oc_doc_02,
    oc_imp_01,
    oc_imp_02,
    oc_c_01
];
