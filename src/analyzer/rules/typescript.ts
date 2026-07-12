/**
 * TypeScript-Specific Rules -- Google TypeScript Style Guide
 * https://google.github.io/styleguide/tsguide.html
 *
 * These rules ADD to the existing JavaScript rules (which TypeScript inherits).
 * They target TypeScript-only constructs that the JavaScript rules don't cover.
 *
 * Current sections covered:
 *   Source File Structure -- Imports & Exports
 *   Language Features -- Namespaces, Const enums, Private fields, Decorators
 *   Type System -- Wrapper types, Interfaces vs types, Arrays, Nullable aliases,
 *                  Any, Empty object, Tuples, Type assertions, Non-null assertion
 *   Classes -- Constructors, Visibility, Parameter properties
 *   Naming -- Interface prefix, Underscore prefix/suffix
 *   Disallowed Features -- @ts-ignore
 */

import { Rule, Violation } from '../../types.js';
import { javascriptRules, getCleanLines } from './javascript.js';

// ============================================================================
// HELPER UTILITIES
// ============================================================================

/**
 * Check if a cleaned line is a comment (all whitespace after stripping).
 */
function isCommentLine(cleanLine: string): boolean {
    return cleanLine.trim() === '';
}

/**
 * Create a Violation object from a rule and match details.
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
// Source File Structure -- IMPORTS
// ============================================================================

/**
 * TS-MOD-01: No namespace declarations
 *
 * "TypeScript supports two methods to organize code: namespaces and modules,
 *  but namespaces are disallowed."
 *
 * Catches:
 *   namespace Foo { ... }
 *   module Foo { ... }         (legacy namespace syntax)
 *   export namespace Foo { ... }
 *   export module Foo { ... }
 *
 * Does NOT flag:
 *   - "namespace" inside strings or comments (handled by cleanLines)
 *   - declare module '...' (ambient module augmentations, which are valid)
 *   - declare namespace ... (ambient declarations for .d.ts, which are valid)
 *
 * Google TypeScript Style Guide -- Source File Structure (Use modules not namespaces)
 */
const noNamespaces: Rule = {
    id: 'TS-MOD-01',
    name: 'No namespace declarations',
    description:
        'TypeScript namespaces are disallowed. Use ES6 modules (import/export) to organize code instead.',
    severity: 'high',
    guideSection: 'Source File Structure',
    guideUrl: 'https://google.github.io/styleguide/tsguide.html#namespaces-vs-modules',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];

        // Only apply to .ts/.tsx files
        if (filename && !/\.(ts|tsx|mts|cts)$/i.test(filename)) {
            return violations;
        }

        // Match: optional "export" + "namespace" or "module" + identifier + "{"
        // But NOT: "declare namespace" or "declare module" (ambient declarations are valid)
        const pattern = /^\s*(export\s+)?(namespace|module)\s+([A-Za-z_$][\w$.]*)\s*\{/;
        const declarePattern = /^\s*declare\s+(namespace|module)\s+/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            // Skip ambient declarations (declare namespace/module)
            if (declarePattern.test(cleanLine)) continue;

            const match = cleanLine.match(pattern);
            if (match) {
                const keyword = match[2]; // "namespace" or "module"
                const name = match[3];
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        `${keyword} "${name}" declaration found. Namespaces are disallowed.`,
                        'Use ES6 modules (import/export) instead of namespaces to organize code.',
                    ),
                );
            }
        }
        return violations;
    },
};

/**
 * TS-MOD-02: No require() imports
 *
 * "Code must not use require (as in import x = require('...');) for imports."
 *
 * Catches:
 *   import x = require('...');
 *   import foo = require("bar");
 *   const x = require('...');
 *   let x = require('...');
 *   var x = require('...');
 *
 * Does NOT flag:
 *   - require() inside strings or comments (handled by cleanLines)
 *   - Dynamic import() expressions (those are valid ES6)
 *
 * Google TypeScript Style Guide -- Source File Structure (Use modules not namespaces)
 */
const noRequireImports: Rule = {
    id: 'TS-MOD-02',
    name: 'No require() imports',
    description:
        'Do not use require() for imports. Use ES6 module syntax (import/export) instead.',
    severity: 'high',
    guideSection: 'Source File Structure',
    guideUrl: 'https://google.github.io/styleguide/tsguide.html#namespaces-vs-modules',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];

        // Only apply to .ts/.tsx files
        if (filename && !/\.(ts|tsx|mts|cts)$/i.test(filename)) {
            return violations;
        }

        // Pattern 1: import x = require('...')
        const tsRequirePattern = /^\s*import\s+\w+\s*=\s*require\s*\(/;
        // Pattern 2: const/let/var x = require('...')
        const jsRequirePattern = /^\s*(const|let|var)\s+.*=\s*require\s*\(/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            if (tsRequirePattern.test(cleanLine)) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        `TypeScript require import found: "${line.trim()}". Use ES6 import syntax.`,
                        'Replace with: import { something } from \'module\'; or import * as name from \'module\';',
                    ),
                );
            } else if (jsRequirePattern.test(cleanLine)) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        `require() import found: "${line.trim()}". Use ES6 import syntax in TypeScript.`,
                        'Replace with: import { something } from \'module\'; or import * as name from \'module\';',
                    ),
                );
            }
        }
        return violations;
    },
};

// ============================================================================
// Source File Structure -- EXPORTS
// ============================================================================

/**
 * TS-MOD-03: No mutable exports (export let)
 *
 * "Mutable exports can create hard to understand and debug code...
 *  One way to paraphrase this style point is that export let is not allowed."
 *
 * Catches:
 *   export let foo = 3;
 *   export let bar: string;
 *
 * Does NOT flag:
 *   - export const (immutable, correct)
 *   - export function / export class (correct)
 *   - let without export (not an export issue)
 *
 * Google TypeScript Style Guide -- Source File Structure (Mutable exports)
 */
const noMutableExports: Rule = {
    id: 'TS-MOD-03',
    name: 'No mutable exports (export let)',
    description:
        'Do not use "export let". Mutable exports create hard-to-debug code. Use export const or export a getter function instead.',
    severity: 'medium',
    guideSection: 'Source File Structure',
    guideUrl: 'https://google.github.io/styleguide/tsguide.html#exports',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];

        // Only apply to .ts/.tsx files
        if (filename && !/\.(ts|tsx|mts|cts)$/i.test(filename)) {
            return violations;
        }

        // Match: "export let" at statement level
        const pattern = /^\s*export\s+let\s+/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            if (pattern.test(cleanLine)) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        `Mutable export found: "${line.trim()}". "export let" is not allowed.`,
                        'Use "export const" for immutable values, or export a getter function for mutable state.',
                    ),
                );
            }
        }
        return violations;
    },
};

/**
 * TS-MOD-04: No const enum
 *
 * "Code must not use const enum; use plain enum instead."
 *
 * const enum is a TypeScript-specific optimization that makes the enum
 * invisible to JavaScript consumers and causes issues with isolatedModules.
 *
 * Catches:
 *   const enum Foo { ... }
 *   export const enum Bar { ... }
 *
 * Does NOT flag:
 *   - Regular enum declarations (correct)
 *   - "const" on its own (not an enum)
 *
 * Google TypeScript Style Guide -- Language Features (Const enums)
 */
const noConstEnum: Rule = {
    id: 'TS-MOD-04',
    name: 'No const enum',
    description:
        'Do not use "const enum". It makes the enum invisible to JavaScript consumers and causes issues with isolatedModules. Use plain "enum" instead.',
    severity: 'medium',
    guideSection: 'Language Features',
    guideUrl: 'https://google.github.io/styleguide/tsguide.html#const-enums',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];

        // Only apply to .ts/.tsx files
        if (filename && !/\.(ts|tsx|mts|cts)$/i.test(filename)) {
            return violations;
        }

        // Match: optional "export" + "const enum" + identifier
        const pattern = /^\s*(export\s+)?const\s+enum\s+([A-Za-z_$]\w*)/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            const match = cleanLine.match(pattern);
            if (match) {
                const enumName = match[2];
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        `"const enum ${enumName}" found. const enum is disallowed.`,
                        `Use "enum ${enumName}" instead. const enum causes issues with isolatedModules and is invisible to JS consumers.`,
                    ),
                );
            }
        }
        return violations;
    },
};

// ============================================================================
// Type System (Part 1)
// ============================================================================

/**
 * TS-TYPE-01: No wrapper types in type annotations
 *
 * "There are a few types related to JavaScript primitives that should
 *  not ever be used: String, Boolean, and Number have slightly different
 *  meaning from the corresponding primitive types string, boolean, and number.
 *  Always use the lowercase version."
 *
 * This is DIFFERENT from JS-DIS-03 which catches `new Boolean()` etc.
 * This rule catches using the TYPES as annotations: `: String`, `: Boolean`, etc.
 *
 * Catches:
 *   let x: String = 'hello';
 *   function foo(x: Boolean): Number { ... }
 *   const arr: Array<String> = [];
 *   param: Object
 *
 * Does NOT flag:
 *   - lowercase types: string, boolean, number (correct)
 *   - String() / Boolean() / Number() as function calls (handled by JS rules)
 *   - String/Boolean/Number in comments/strings (handled by cleanLines)
 *   - Use as values, e.g. typeof x === String (not a type position)
 *
 * Google TypeScript Style Guide -- Type System (Wrapper types)
 */
const noWrapperTypes: Rule = {
    id: 'TS-TYPE-01',
    name: 'No wrapper types in type annotations',
    description:
        'Do not use String, Boolean, Number, or Object as types. Use the lowercase primitives: string, boolean, number, object.',
    severity: 'medium',
    guideSection: 'Type System',
    guideUrl: 'https://google.github.io/styleguide/tsguide.html#wrapper-types',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];

        // Only apply to .ts/.tsx files
        if (filename && !/\.(ts|tsx|mts|cts)$/i.test(filename)) {
            return violations;
        }

        const wrapperTypes = ['String', 'Boolean', 'Number', 'Object'];
        const wrapperPattern = new RegExp(
            // After colon (type annotation): `: String` but not `String.` or `String(`
            `(?::\\s*)(${wrapperTypes.join('|')})\\b(?!\\s*[.(])` +
            '|' +
            // Inside angle brackets (generic): `<String>` or `<String,`
            `(?:<\\s*)(${wrapperTypes.join('|')})\\b` +
            '|' +
            // After 'as' (type assertion): `as String`
            `(?:\\bas\\s+)(${wrapperTypes.join('|')})\\b`
        );

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            // Skip import statements
            if (/^\s*import\s/.test(cleanLine)) continue;

            const match = cleanLine.match(wrapperPattern);
            if (match) {
                // Find which wrapper type matched
                const typeName = match[1] || match[2] || match[3];
                if (typeName) {
                    const lowercase = typeName.toLowerCase();
                    violations.push(
                        createViolation(
                            this,
                            i + 1,
                            line,
                            `Wrapper type "${typeName}" used in type annotation. Use the primitive type instead.`,
                            `Replace "${typeName}" with "${lowercase}".`,
                        ),
                    );
                }
            }
        }
        return violations;
    },
};

/**
 * TS-TYPE-02: Prefer interface over type alias for object types
 *
 * "When declaring types for objects, use interfaces instead of
 *  a type alias for the object literal expression."
 *
 * Catches:
 *   type Foo = { ... }
 *   export type Baz = { ... }
 *
 * Does NOT flag:
 *   - type Foo = string | number (union types -- correct use of type alias)
 *   - type Foo = string (simple alias -- correct use of type alias)
 *   - type Foo = [string, number] (tuple -- correct use of type alias)
 *   - type Foo = SomeType & OtherType (intersection -- acceptable)
 *   - interface Foo { ... } (correct)
 *
 * Google TypeScript Style Guide -- Type System (Prefer interfaces over type literal aliases)
 */
const preferInterfaceOverType: Rule = {
    id: 'TS-TYPE-02',
    name: 'Prefer interface over type alias for objects',
    description:
        'Use "interface" instead of "type" alias when defining object types. Interfaces provide better error messages and performance.',
    severity: 'low',
    guideSection: 'Type System',
    guideUrl: 'https://google.github.io/styleguide/tsguide.html#prefer-interfaces-over-type-literal-aliases',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];

        // Only apply to .ts/.tsx files
        if (filename && !/\.(ts|tsx|mts|cts)$/i.test(filename)) {
            return violations;
        }

        // Pattern: "type Foo = {" on same line
        const sameLinePattern = /^\s*(export\s+)?type\s+([A-Za-z_$]\w*)\s*(<[^>]*>)?\s*=\s*\{/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            const match = cleanLine.match(sameLinePattern);
            if (match) {
                const typeName = match[2];
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        `Type alias "${typeName}" defines an object type. Use "interface" instead.`,
                        `Replace "type ${typeName} = { ... }" with "interface ${typeName} { ... }".`,
                    ),
                );
            }
        }
        return violations;
    },
};

/**
 * TS-TYPE-03: Use T[] for simple array types
 *
 * "For simple types (containing just alphanumeric characters and dot),
 *  use the syntax sugar for arrays, T[] or readonly T[], rather than
 *  the longer form Array<T> or ReadonlyArray<T>."
 *
 * Catches:
 *   Array<string>
 *   Array<number>
 *   ReadonlyArray<string>
 *
 * Does NOT flag:
 *   - Array<{n: number}> (complex type -- correct to use Array<>)
 *   - Array<string | number> (union -- correct to use Array<>)
 *   - new Array() (caught by JS-ARR-01, different rule)
 *
 * Google TypeScript Style Guide -- Type System (Array<T> Type)
 */
const useArraySyntaxSugar: Rule = {
    id: 'TS-TYPE-03',
    name: 'Use T[] for simple array types',
    description:
        'For simple types, use T[] instead of Array<T>. Use Array<T> only for complex types (unions, objects, functions).',
    severity: 'low',
    guideSection: 'Type System',
    guideUrl: 'https://google.github.io/styleguide/tsguide.html#arrayt-type',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];

        // Only apply to .ts/.tsx files
        if (filename && !/\.(ts|tsx|mts|cts)$/i.test(filename)) {
            return violations;
        }

        // Match Array<SimpleType> or ReadonlyArray<SimpleType>
        const pattern = /\b(Array|ReadonlyArray)<([A-Za-z_$][\w.]*)\s*>/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            // Skip import statements
            if (/^\s*import\s/.test(cleanLine)) continue;

            // Skip lines with "new Array" (different rule JS-ARR-01)
            if (/\bnew\s+Array/.test(cleanLine)) continue;

            const match = cleanLine.match(pattern);
            if (match) {
                const arrayType = match[1]; // "Array" or "ReadonlyArray"
                const innerType = match[2]; // e.g., "string", "MyType", "ns.MyObj"

                // Only flag simple types (alphanumeric + dot)
                if (/^[A-Za-z_$][\w.]*$/.test(innerType)) {
                    if (arrayType === 'ReadonlyArray') {
                        violations.push(
                            createViolation(
                                this,
                                i + 1,
                                line,
                                `"ReadonlyArray<${innerType}>" found. Use syntax sugar for simple types.`,
                                `Replace with "readonly ${innerType}[]".`,
                            ),
                        );
                    } else {
                        violations.push(
                            createViolation(
                                this,
                                i + 1,
                                line,
                                `"Array<${innerType}>" found. Use syntax sugar for simple types.`,
                                `Replace with "${innerType}[]".`,
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
// Type System (Part 2)
// ============================================================================

/**
 * TS-TYPE-04: No nullable type aliases
 *
 * "Type aliases must not include |null or |undefined in a union type.
 *  Nullable aliases typically indicate that null values are being passed
 *  around through too many layers of an application."
 *
 * Catches:
 *   type Foo = Bar | null;
 *   type Baz = string | undefined;
 *
 * Does NOT flag:
 *   - Function return types: (): string | null (correct)
 *   - Variable types: let x: string | null (correct)
 *   - Parameter types: (x: Foo | null) (correct)
 *   - type Foo = string | number (no null/undefined)
 *
 * Google TypeScript Style Guide -- Type System (Nullable/undefined type aliases)
 */
const noNullableTypeAliases: Rule = {
    id: 'TS-TYPE-04',
    name: 'No nullable type aliases',
    description:
        'Type aliases must not include |null or |undefined. Add nullability at the usage site instead.',
    severity: 'medium',
    guideSection: 'Type System',
    guideUrl: 'https://google.github.io/styleguide/tsguide.html#nullable-undefined-type-aliases',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];

        // Only apply to .ts/.tsx files
        if (filename && !/\.(ts|tsx|mts|cts)$/i.test(filename)) {
            return violations;
        }

        const typeAliasStart = /^\s*(export\s+)?type\s+[A-Za-z_$]\w*\s*(<[^>]*>)?\s*=/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            // Check if this line starts a type alias
            if (typeAliasStart.test(cleanLine)) {
                const afterEquals = cleanLine.split('=').slice(1).join('=');
                let fullType = afterEquals;

                // If the line doesn't end with ; check next lines too
                if (!cleanLine.trimEnd().endsWith(';')) {
                    for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
                        const nextClean = searchLines[j];
                        fullType += ' ' + nextClean;
                        if (nextClean.trimEnd().endsWith(';') || nextClean.trimEnd().endsWith('}')) {
                            break;
                        }
                    }
                }

                // Check for |null or |undefined in the type expression
                const hasNull = /\|\s*null\b/.test(fullType);
                const hasUndef = /\|\s*undefined\b/.test(fullType);

                if (hasNull || hasUndef) {
                    const what = hasNull && hasUndef ? '|null and |undefined' :
                        hasNull ? '|null' : '|undefined';
                    violations.push(
                        createViolation(
                            this,
                            i + 1,
                            line,
                            `Type alias includes ${what}. Nullable type aliases are disallowed.`,
                            'Remove the nullability from the type alias and add it at the usage site instead.',
                        ),
                    );
                }
            }
        }
        return violations;
    },
};

// ============================================================================
// Classes
// ============================================================================

/**
 * TS-CLASS-01: No #private fields (ES private fields)
 *
 * "Do not use private fields (also known as private identifiers).
 *  Instead, use TypeScript's visibility annotations."
 *
 * #private fields cause substantial emit size and performance regressions
 * when down-leveled by TypeScript and are unsupported before ES2015.
 *
 * Catches:
 *   #privateField = 1;
 *   #count: number;
 *   readonly #value = 'x';
 *   #doSomething() { }
 *
 * Does NOT flag:
 *   - private field: string; (correct TypeScript visibility)
 *   - # in comments or strings (handled by cleanLines)
 *
 * Google TypeScript Style Guide -- Language Features (No #private fields)
 */
const noEsPrivateFields: Rule = {
    id: 'TS-CLASS-01',
    name: 'No #private fields',
    description:
        'Do not use ES #private fields. Use TypeScript\'s "private" keyword instead for better performance and compatibility.',
    severity: 'medium',
    guideSection: 'Language Features',
    guideUrl: 'https://google.github.io/styleguide/tsguide.html#private-fields',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];

        // Only apply to .ts/.tsx files
        if (filename && !/\.(ts|tsx|mts|cts)$/i.test(filename)) {
            return violations;
        }

        // Match class member declarations with # prefix.
        const pattern = /^\s+(static\s+)?(readonly\s+)?#([A-Za-z_$]\w*)/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            const match = cleanLine.match(pattern);
            if (match) {
                const fieldName = match[3];
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        `ES private field "#${fieldName}" found. Use TypeScript's "private" keyword instead.`,
                        `Replace "#${fieldName}" with "private ${fieldName}".`,
                    ),
                );
            }
        }
        return violations;
    },
};

/**
 * TS-CLASS-02: No empty constructors
 *
 * "It is unnecessary to provide an empty constructor or one that simply delegates
 *  into its parent class because ES2015 provides a default class constructor if one
 *  is not specified."
 *
 * Catches:
 *   constructor() {}
 *   public constructor() { }
 *
 * Does NOT flag:
 *   - constructor(private foo: Foo) {} (Parameter properties are fine)
 *   - private constructor() {} (Used to prevent instantiation)
 *
 * Google TypeScript Style Guide -- Classes (Constructors)
 */
const noEmptyConstructors: Rule = {
    id: 'TS-CLASS-02',
    name: 'No empty constructors',
    description:
        'It is unnecessary to provide an empty constructor. ES2015 provides a default constructor automatically.',
    severity: 'low',
    guideSection: 'Classes',
    guideUrl: 'https://google.github.io/styleguide/tsguide.html#constructors',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];

        // Only apply to .ts/.tsx files
        if (filename && !/\.(ts|tsx|mts|cts)$/i.test(filename)) {
            return violations;
        }

        // Match public or implicit constructor with no params and empty body
        const pattern = /^\s*(?:public\s+)?constructor\s*\(\s*\)\s*\{\s*\}/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            if (pattern.test(cleanLine)) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        'Empty constructor found. ES2015 provides a default constructor automatically.',
                        'Remove the unnecessary empty constructor. Note: parameter properties or private constructors are exceptions.',
                    ),
                );
            }
        }
        return violations;
    },
};

/**
 * TS-CLASS-03: Constructor calls must use parentheses
 *
 * "Constructor calls must use parentheses, even when no arguments are passed:
 *  const x = new Foo; // BAD
 *  const x = new Foo(); // GOOD"
 *
 * Google TypeScript Style Guide -- Classes (Constructors)
 */
const newWithParentheses: Rule = {
    id: 'TS-CLASS-03',
    name: 'Constructor calls must use parentheses',
    description:
        'Constructor calls must always use parentheses, even when no arguments are passed (e.g., "new Foo()").',
    severity: 'low',
    guideSection: 'Classes',
    guideUrl: 'https://google.github.io/styleguide/tsguide.html#constructors',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];

        if (filename && !/\.(ts|tsx|mts|cts)$/i.test(filename)) {
            return violations;
        }

        const pattern = /\bnew\s+([A-Za-z0-9_$]+(?:\.[A-Za-z0-9_$]+)*)(\s*[^\sA-Za-z0-9_$])?/g;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            const matches = [...cleanLine.matchAll(pattern)];
            for (const match of matches) {
                const className = match[1];
                const nextCharObj = match[2];
                const nextChar = nextCharObj ? nextCharObj.trim()[0] : '';

                // If the next character is not '(' and not '<' (for generics), parens are missing.
                if (nextChar !== '(' && nextChar !== '<') {
                    violations.push(
                        createViolation(
                            this,
                            i + 1,
                            line,
                            `Constructor call "new ${className}" is missing parentheses.`,
                            `Use "new ${className}()" instead of "new ${className}".`,
                        ),
                    );
                    break; // Only report once per line for this rule
                }
            }
        }
        return violations;
    },
};

// ============================================================================
// Type System (Continued)
// ============================================================================

/**
 * TS-TYPE-05: No `any` type
 *
 * "Avoid any -- it disables type checking. Use unknown instead."
 *
 * Google TypeScript Style Guide -- Type System (any Type)
 */
const noAnyType: Rule = {
    id: 'TS-TYPE-05',
    name: 'No any type',
    description:
        'Avoid "any" -- it disables type checking. Use "unknown" instead.',
    severity: 'medium',
    guideSection: 'Type System',
    guideUrl: 'https://google.github.io/styleguide/tsguide.html#any-type',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];
        if (filename && !/\.(ts|tsx|mts|cts)$/i.test(filename)) {
            return violations;
        }

        const patterns = [/:\s*any\b/, /\bas\s+any\b/, /<\s*any\s*>/];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;
            if (/^\s*import\s+type\b/.test(cleanLine)) continue;

            for (const pattern of patterns) {
                if (pattern.test(cleanLine)) {
                    violations.push(
                        createViolation(
                            this,
                            i + 1,
                            line,
                            `"any" type found: "${line.trim()}"`,
                            'Use a specific type or "unknown" instead of "any".',
                        ),
                    );
                    break;
                }
            }
        }
        return violations;
    },
};

/**
 * TS-TYPE-06: No empty object type `{}`
 *
 * "The {} type represents an interface with no properties...
 *  Google3 code should not use {} for most use cases."
 *
 * Google TypeScript Style Guide -- Type System ({} Type)
 */
const noEmptyObjectType: Rule = {
    id: 'TS-TYPE-06',
    name: 'No empty object type',
    description:
        'Do not use the empty object type "{}". It accepts almost anything. Use "unknown", "object", or "Record<string, unknown>".',
    severity: 'medium',
    guideSection: 'Type System',
    guideUrl: 'https://google.github.io/styleguide/tsguide.html#empty-object-type',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];
        if (filename && !/\.(ts|tsx|mts|cts)$/i.test(filename)) {
            return violations;
        }

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            const matches = cleanLine.match(/:\s*\{\s*\}/g);
            if (matches) {
                for (const _ of matches) {
                    violations.push(
                        createViolation(
                            this,
                            i + 1,
                            line,
                            'Empty object type "{}" found.',
                            'Use "unknown", "object", or "Record<string, unknown>" instead of "{}".',
                        ),
                    );
                }
            }

            const genericsMatches = cleanLine.match(/<\s*\{\s*\}\s*>/g);
            if (genericsMatches) {
                 for (const _ of genericsMatches) {
                    violations.push(
                        createViolation(
                            this,
                            i + 1,
                            line,
                            'Empty object type "{}" found in generics.',
                            'Use "unknown", "object", or "Record<string, unknown>" instead of "{}".',
                        ),
                    );
                }
            }
        }
        return violations;
    },
};

/**
 * TS-TYPE-07: Prefer Tuple Types over Pairs
 *
 * "If you are tempted to create a Pair type, instead use a tuple type."
 *
 * Google TypeScript Style Guide -- Type System (Tuple types)
 */
const preferTupleTypes: Rule = {
    id: 'TS-TYPE-07',
    name: 'Prefer Tuple Types',
    description:
        'Avoid creating "Pair" object returned types. Use tuple types like `[string, number]` instead.',
    severity: 'low',
    guideSection: 'Type System',
    guideUrl: 'https://google.github.io/styleguide/tsguide.html#tuple-types',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];
        if (filename && !/\.(ts|tsx|mts|cts)$/i.test(filename)) {
            return violations;
        }

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            if (/\b(?:type|interface)\s+Pair\b/.test(cleanLine) || /:\s*Pair[\s<]/.test(cleanLine)) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        '"Pair" type structure detected.',
                        'Use a tuple type like "[TypeA, TypeB]" or an inline object type.',
                    ),
                );
            }
        }
        return violations;
    },
};

// ============================================================================
// Naming
// ============================================================================

/**
 * TS-NAME-01: No "I" prefix for interfaces
 *
 * "Do not use the I prefix on interfaces (e.g., IUserService)."
 *
 * Catches:
 *   interface IUserService { ... }
 *   export interface IConfig { ... }
 *
 * Does NOT flag:
 *   - interface Iterator { ... } (Starts with I, but followed by lowercase)
 *   - interface Identity { ... }
 *
 * Google TypeScript Style Guide -- Naming (Type and Context)
 */
const noInterfaceIPrefix: Rule = {
    id: 'TS-NAME-01',
    name: 'No "I" prefix on interfaces',
    description:
        'Do not use the "I" prefix on interfaces. TypeScript interfaces should be named like classes.',
    severity: 'low',
    guideSection: 'Naming',
    guideUrl: 'https://google.github.io/styleguide/tsguide.html#naming',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];

        // Only apply to .ts/.tsx files
        if (filename && !/\.(ts|tsx|mts|cts)$/i.test(filename)) {
            return violations;
        }

        // Match "interface I<UppercaseLetter><Anything>"
        const pattern = /^\s*(export\s+)?interface\s+(I[A-Z]\w*)/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            const match = cleanLine.match(pattern);
            if (match) {
                const interfaceName = match[2];
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        `Interface "${interfaceName}" has an "I" prefix.`,
                        `Rename to "${interfaceName.substring(1)}".`,
                    ),
                );
            }
        }
        return violations;
    },
};

/**
 * TS-NAME-02: No _ prefix or suffix on identifiers
 *
 * "Identifiers must not use _ as a prefix or suffix.
 *  Exception: unused parameters may be named _ or start with _."
 *
 * Catches:
 *   private _name: string;
 *   let _value = 1;
 *   const MAX_OUT_ = 10;
 *
 * Does NOT flag:
 *   - SNAKE_CASE_VARIABLES (internal underscores are fine)
 *   - function(_unused) (unused params are allowed)
 *   - __dirname (Node.js global)
 *
 * Google TypeScript Style Guide -- Naming (Underscores)
 */
const noUnderscorePrefixSuffix: Rule = {
    id: 'TS-NAME-02',
    name: 'No _ prefix/suffix on identifiers',
    description:
        'Do not use the "_" prefix or suffix to indicate properties or methods are private. Use the "private" visibility modifier instead.',
    severity: 'medium',
    guideSection: 'Naming',
    guideUrl: 'https://google.github.io/styleguide/tsguide.html#naming',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];

        // Only apply to .ts/.tsx files
        if (filename && !/\.(ts|tsx|mts|cts)$/i.test(filename)) {
            return violations;
        }

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            // Skip __dirname and __filename
            if (/\b(?:__dirname|__filename)\b/.test(cleanLine)) continue;

            let identifier: string | undefined;

            // 1. let/const/var name
            const varMatch = cleanLine.match(/^\s*(?:export\s+)?(?:let|const|var)\s+([A-Za-z0-9_$]+)/);
            if (varMatch) identifier = varMatch[1];

            if (!identifier) {
                // 2. class properties/methods
                const classMatch = cleanLine.match(/^\s*(?:private\s+|protected\s+|public\s+|static\s+|readonly\s+|get\s+|set\s+)?([A-Za-z0-9_$]+)\s*(?::|\(|=\s*[^>])/);
                if (classMatch) {
                    const isControlFlow = /^(?:return|if|else|switch|for|while|catch|throw)\b/.test(cleanLine.trim());
                    if (!isControlFlow) {
                        identifier = classMatch[1];
                    }
                }
            }

            if (!identifier) {
                // 3. function name()
                const funcMatch = cleanLine.match(/^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/);
                if (funcMatch) identifier = funcMatch[1];
            }

            if (identifier) {
                // If it's literally just "_", it's fine (common unused param convention)
                if (identifier === '_') continue;

                if (identifier.startsWith('_') || identifier.endsWith('_')) {
                    violations.push(
                        createViolation(
                            this,
                            i + 1,
                            line,
                            `Identifier "${identifier}" has an underscore prefix or suffix.`,
                            'Identifiers must not use _ as a prefix or suffix. Use accessibility modifiers (private) instead.',
                        ),
                    );
                }
            }
        }
        return violations;
    },
};

// ============================================================================
// Disallowed Features
// ============================================================================

/**
 * TS-DIS-02: No @ts-ignore
 *
 * "@ts-ignore suppresses ALL errors on the next line."
 * Use @ts-expect-error instead which fails if there is no error.
 *
 * Note: This intentionally searches raw lines since @ts-ignore is a comment directive.
 *
 * Google TypeScript Style Guide -- @ts-ignore
 */
const noTsIgnore: Rule = {
    id: 'TS-DIS-02',
    name: 'No @ts-ignore',
    description:
        'Use @ts-expect-error with an explanation instead of @ts-ignore.',
    severity: 'medium',
    guideSection: 'Type System',
    guideUrl: 'https://google.github.io/styleguide/tsguide.html#type-assertions',
    check(lines: string[], filename?: string): Violation[] {
        const violations: Violation[] = [];
        if (filename && !/\.(ts|tsx|mts|cts)$/i.test(filename)) {
            return violations;
        }

        // Intentionally searches raw lines: @ts-ignore is a comment directive
        for (let i = 0; i < lines.length; i++) {
            if (/@ts-ignore/.test(lines[i])) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        lines[i],
                        '@ts-ignore suppresses ALL errors on the next line.',
                        'Use @ts-expect-error with an explanation.',
                    ),
                );
            }
        }
        return violations;
    },
};

// ============================================================================
// NEW RULES -- Type System additions
// ============================================================================

/**
 * TS-TYPE-08: Prefer `as T` over angle-bracket type assertions
 *
 * "TypeScript provides two syntaxes for type assertions... The angle bracket
 *  syntax is ambiguous with generics in TSX/JSX. Always use `as` syntax."
 *
 * Catches:
 *   const x = <string>value;
 *   const y = <MyType>someObj;
 *
 * Does NOT flag:
 *   - Generic function calls: foo<string>(x)
 *   - JSX/TSX elements: <div>, <Component>
 *   - Generic type declarations: class Foo<T>
 *
 * Google TypeScript Style Guide -- Type System (Type assertions syntax)
 */
const preferAsTypeAssertion: Rule = {
    id: 'TS-TYPE-08',
    name: 'Prefer as T over angle bracket assertions',
    description:
        'Use "value as Type" syntax instead of "<Type>value" for type assertions. Angle bracket syntax is ambiguous with JSX.',
    severity: 'low',
    guideSection: 'Type System',
    guideUrl: 'https://google.github.io/styleguide/tsguide.html#type-assertions-syntax',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];
        if (filename && !/\.(ts|tsx|mts|cts)$/i.test(filename)) {
            return violations;
        }

        // Match angle bracket assertion: = <Type>expr or (<Type>expr)
        // Key insight: a type assertion <Foo> is preceded by = or ( or , or return
        // and followed by a non-< char (to distinguish from <Foo>(args) generic calls)
        const pattern = /(?:=|return|\(|,)\s*<([A-Za-z_$][\w.]*(?:<[^>]*>)?)>(?!\s*\()/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;
            // Skip import/export lines
            if (/^\s*(?:import|export)\s/.test(cleanLine)) continue;

            const match = cleanLine.match(pattern);
            if (match) {
                const typeName = match[1];
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        `Angle bracket type assertion "<${typeName}>" found.`,
                        `Use "expr as ${typeName}" instead of "<${typeName}>expr".`,
                    ),
                );
            }
        }
        return violations;
    },
};

/**
 * TS-TYPE-09: No non-null assertion operator (!)
 *
 * "Do not use the non-null assertion operator !. It erases type safety.
 *  Instead, use explicit null checks."
 *
 * Catches:
 *   foo!.bar
 *   getValue()!
 *   arr[0]!.prop
 *
 * Does NOT flag:
 *   - !== or != (comparison operators)
 *   - !foo (logical NOT)
 *   - !! (double negation)
 *
 * Google TypeScript Style Guide -- Type System (Type assertions and non-null assertion)
 */
const noNonNullAssertion: Rule = {
    id: 'TS-TYPE-09',
    name: 'No non-null assertion operator',
    description:
        'Do not use the non-null assertion operator (!.). Use explicit null checks or optional chaining instead.',
    severity: 'medium',
    guideSection: 'Type System',
    guideUrl: 'https://google.github.io/styleguide/tsguide.html#type-assertions',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];
        if (filename && !/\.(ts|tsx|mts|cts)$/i.test(filename)) {
            return violations;
        }

        // Match non-null assertion: identifier! followed by . or [ or )
        // Excludes: !==, !=, !! (double negation), logical NOT (!foo)
        const pattern = /[A-Za-z0-9_$)\]]\s*!\s*\./;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            if (pattern.test(cleanLine)) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        'Non-null assertion operator (!) found.',
                        'Use explicit null checks (if/else), optional chaining (?.), or nullish coalescing (??) instead.',
                    ),
                );
            }
        }
        return violations;
    },
};

/**
 * TS-TYPE-10: Prefer type declaration over type assertion for object literals
 *
 * "Use type annotations (: Foo) instead of type assertions (as Foo) on
 *  object literals. Type annotations check that the assigned value
 *  actually fulfills the contract."
 *
 * Catches:
 *   const x = { name: 'foo' } as Config;
 *   return { ... } as MyType;
 *
 * Does NOT flag:
 *   - const x: Config = { name: 'foo' }; (correct)
 *   - variable as Type (not an object literal)
 *
 * Google TypeScript Style Guide -- Type System (Type assertion vs declaration)
 */
const preferTypeDeclaration: Rule = {
    id: 'TS-TYPE-10',
    name: 'Prefer type declaration over assertion for objects',
    description:
        'Use type annotations (: Type) instead of type assertions (as Type) on object literals. Annotations check assignability at definition time.',
    severity: 'low',
    guideSection: 'Type System',
    guideUrl: 'https://google.github.io/styleguide/tsguide.html#type-assertions',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];
        if (filename && !/\.(ts|tsx|mts|cts)$/i.test(filename)) {
            return violations;
        }

        // Match: } as Type at end of line or before ;
        const pattern = /\}\s+as\s+([A-Za-z_$][\w.]*)/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            const match = cleanLine.match(pattern);
            if (match) {
                const typeName = match[1];
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        `Object literal asserted "as ${typeName}". Use a type annotation instead.`,
                        `Annotate the variable with ": ${typeName}" instead of using "as ${typeName}" on the object literal.`,
                    ),
                );
            }
        }
        return violations;
    },
};

// ============================================================================
// NEW RULES -- Visibility and class features
// ============================================================================

/**
 * TS-CLASS-04: Use the narrowest visibility
 *
 * "Restrict the visibility of properties, methods, and types as needed.
 *  Prefer private visibility. Public is the default in TypeScript, so
 *  explicitly mark members as public only if that is the intended contract."
 *
 * This rule flags class members that have no visibility modifier and are
 * not constructor, static, abstract, or override members (which have their
 * own patterns). It is a heuristic for "you probably forgot to add private".
 *
 * Google TypeScript Style Guide -- Classes (Visibility)
 *
 * NOTE: Deferred -- accurately detecting class scope vs top-level scope is
 * an AST-level check. Adding a comment for coverage tracking.
 */
// Visibility -- deferred to AI deep review layer

/**
 * TS-CLASS-05: No parameter properties with public
 *
 * "Parameter properties should only use readonly or private/protected readonly."
 * Marking constructor params as public is redundant (public is the default).
 *
 * Catches:
 *   constructor(public name: string)
 *
 * Does NOT flag:
 *   - constructor(private name: string) (correct)
 *   - constructor(protected name: string) (correct)
 *   - constructor(readonly name: string) (correct)
 *   - constructor(private readonly name: string) (correct)
 *
 * Google TypeScript Style Guide -- Classes (Parameter properties)
 */
const noPublicParameterProperties: Rule = {
    id: 'TS-CLASS-05',
    name: 'No public parameter properties',
    description:
        'Avoid "public" on constructor parameter properties. Public is the default; use "private", "protected", or "readonly" instead.',
    severity: 'low',
    guideSection: 'Classes',
    guideUrl: 'https://google.github.io/styleguide/tsguide.html#parameter-properties',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];
        if (filename && !/\.(ts|tsx|mts|cts)$/i.test(filename)) {
            return violations;
        }

        // We look for "public" without "readonly" in constructor params
        // Pattern: inside constructor(..., public paramName: Type, ...)
        // Heuristic: line contains "constructor" OR is inside a constructor param list
        // and has "public" not preceded by "private" or "protected"
        const constructorLine = /constructor\s*\(/;
        const publicParam = /\bpublic\s+(?!readonly\b)([A-Za-z_$]\w*)/;

        let inConstructor = false;
        let parenDepth = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            if (constructorLine.test(cleanLine)) {
                inConstructor = true;
                parenDepth = 0;
            }

            if (inConstructor) {
                for (const ch of cleanLine) {
                    if (ch === '(') parenDepth++;
                    if (ch === ')') parenDepth--;
                }

                const match = cleanLine.match(publicParam);
                if (match && parenDepth >= 0) {
                    const paramName = match[1];
                    violations.push(
                        createViolation(
                            this,
                            i + 1,
                            line,
                            `Public parameter property "${paramName}" in constructor. "public" is redundant.`,
                            `Use "private readonly ${paramName}" or "readonly ${paramName}" instead.`,
                        ),
                    );
                }

                if (parenDepth <= 0 && cleanLine.includes(')')) {
                    inConstructor = false;
                }
            }
        }
        return violations;
    },
};

// ============================================================================
// NEW RULES -- Language features
// ============================================================================

/**
 * TS-DIS-03: No decorators on class expressions
 *
 * "TypeScript allows class and method decorators. Do not define new decorators
 *  unless forced to by a framework."
 *
 * This is more of a guideline check: flag custom @decorator definitions
 * (decorator factories returning ClassDecorator/MethodDecorator/etc).
 *
 * Deferred -- decorator detection is better handled at the AST level.
 */
// Decorators -- deferred to AI deep review layer

/**
 * TS-DIS-04: No member access via bracket notation for known properties
 *
 * "Do not use obj['propName'] when obj.propName would work.
 *  Exception: when the property name is not a valid identifier."
 *
 * Catches:
 *   foo['bar']
 *   this['method']
 *
 * Does NOT flag:
 *   - foo[variable] (computed access, correct)
 *   - foo['some-property'] (hyphenated property, correct)
 *   - foo['123start'] (invalid identifier, correct)
 *
 * Google TypeScript Style Guide -- Optimization compatibility
 */
const noBracketAccessForProperties: Rule = {
    id: 'TS-DIS-04',
    name: 'No bracket notation for known properties',
    description:
        'Use dot notation (obj.prop) instead of bracket notation (obj["prop"]) for known properties.',
    severity: 'low',
    guideSection: 'Language Features',
    guideUrl: 'https://google.github.io/styleguide/tsguide.html#optimization-compatibility-for-property-access',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];
        if (filename && !/\.(ts|tsx|mts|cts)$/i.test(filename)) {
            return violations;
        }

        // Match: identifier['validJsIdentifier'] or identifier["validJsIdentifier"]
        // A valid JS identifier starts with a letter/_ /$ and contains only those + digits
        const pattern = /\[(['"])([A-Za-z_$][A-Za-z0-9_$]*)\1\]/g;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            const matches = [...cleanLine.matchAll(pattern)];
            for (const match of matches) {
                const propName = match[2];
                // Skip if it looks like a reserved word used as key in object literal
                if (/^\s*['"]/.test(cleanLine.trimStart())) continue;
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        `Bracket notation ["${propName}"] used for a valid identifier.`,
                        `Use dot notation .${propName} instead of ["${propName}"].`,
                    ),
                );
                break; // one per line
            }
        }
        return violations;
    },
};

/**
 * TS-DIS-05: No type aliases for simple unions/intersections that should be interfaces
 *
 * "Do not use type aliases just to give a name to an intersection type."
 *
 * Catches:
 *   type Foo = Bar & Baz & { ... }
 *
 * This is hard to reliably detect with regex. Deferred.
 */
// Intersection type aliases -- deferred to AI deep review layer

/**
 * TS-MOD-05: No default exports
 *
 * "Do not use default exports. Named exports are better for tooling."
 *
 * Catches:
 *   export default class ...
 *   export default function ...
 *   export default ...
 *
 * Does NOT flag:
 *   - Named exports (correct)
 *
 * Google TypeScript Style Guide -- Source File Structure (Export visibility)
 */
const noDefaultExports: Rule = {
    id: 'TS-MOD-05',
    name: 'No default exports',
    description:
        'Do not use default exports. Use named exports for better refactoring support and IDE tooling.',
    severity: 'low',
    guideSection: 'Source File Structure',
    guideUrl: 'https://google.github.io/styleguide/tsguide.html#exports',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];
        if (filename && !/\.(ts|tsx|mts|cts)$/i.test(filename)) {
            return violations;
        }

        const pattern = /^\s*export\s+default\b/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            if (pattern.test(cleanLine)) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        'Default export found. Default exports are disallowed.',
                        'Use a named export instead: export const/function/class Name = ...',
                    ),
                );
            }
        }
        return violations;
    },
};

/**
 * TS-TYPE-11: Return type must be narrowest practical type
 *
 * "Prefer returning the most specific type possible. Do not return
 *  Promise<any> or observable<any>."
 *
 * Catches:
 *   ): Promise<any>
 *   ): Observable<any>
 *
 * Note: This overlaps slightly with TS-TYPE-05 (no any type) but is
 * specific to return type positions for emphasis.
 *
 * Google TypeScript Style Guide -- Type System (Return types)
 */
// Return type any -- covered by TS-TYPE-05

/**
 * TS-DIS-06: Prefer for-of over index-based for loops for arrays
 *
 * "Use for...of loops when possible. Use Array.forEach for side-effect-only
 *  iterations. Do not use for-in on arrays."
 *
 * Catches:
 *   for (const key in someArray)
 *
 * Does NOT flag:
 *   - for (const key in someObject) (correct for objects)
 *   - for (const item of someArray) (correct)
 *
 * Google TypeScript Style Guide -- Iterating containers
 */
const noForInOnArrays: Rule = {
    id: 'TS-DIS-06',
    name: 'No for-in on arrays',
    description:
        'Do not use for-in to iterate arrays. Use for-of or Array methods instead.',
    severity: 'medium',
    guideSection: 'Language Features',
    guideUrl: 'https://google.github.io/styleguide/tsguide.html#iterating-containers',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];
        if (filename && !/\.(ts|tsx|mts|cts)$/i.test(filename)) {
            return violations;
        }

        // Heuristic: for (... in ...Array/...arr/...list/...items)
        // Also catches variable names ending in 's' (common plural pattern for arrays)
        const pattern = /\bfor\s*\(\s*(?:const|let|var)\s+\w+\s+in\s+(\w+)\)/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            const match = cleanLine.match(pattern);
            if (match) {
                const varName = match[1].toLowerCase();
                // Heuristic: flag if the iterated variable name suggests an array
                if (/(?:arr|array|list|items|elements|results|values|entries|records|rows|cols|nodes|children)$/i.test(varName)) {
                    violations.push(
                        createViolation(
                            this,
                            i + 1,
                            line,
                            `for-in loop on "${match[1]}" which appears to be an array.`,
                            'Use for-of to iterate arrays, or Array.forEach() for side-effect-only iterations.',
                        ),
                    );
                }
            }
        }
        return violations;
    },
};

/**
 * TS-DIS-07: No switch fall-through without comment
 *
 * Already covered by JS-CTRL-02. No separate TS rule needed.
 */

/**
 * TS-TYPE-12: Do not use return type `object`
 *
 * "Do not use the return type object. It means 'any non-primitive type'
 *  which is too broad. Use a specific interface or type instead."
 *
 * Catches:
 *   function foo(): object { ... }
 *   const fn = (): object => { ... }
 *
 * Does NOT flag:
 *   - parameter: object (sometimes acceptable for constraints)
 *   - typeof x === 'object' (comparison, not type annotation)
 *
 * Google TypeScript Style Guide -- Type System (Return types)
 */
const noReturnTypeObject: Rule = {
    id: 'TS-TYPE-12',
    name: 'No return type object',
    description:
        'Do not use "object" as a return type. It is too broad. Use a specific interface, type, or Record<string, unknown>.',
    severity: 'low',
    guideSection: 'Type System',
    guideUrl: 'https://google.github.io/styleguide/tsguide.html#return-types',
    check(lines: string[], filename?: string, cleanLines?: string[]): Violation[] {
        const searchLines = cleanLines || getCleanLines(lines);
        const violations: Violation[] = [];
        if (filename && !/\.(ts|tsx|mts|cts)$/i.test(filename)) {
            return violations;
        }

        // Match: ): object { or ): object =>
        const pattern = /\)\s*:\s*object\s*(?:\{|=>|$)/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cleanLine = searchLines[i];
            if (isCommentLine(cleanLine)) continue;

            if (pattern.test(cleanLine)) {
                violations.push(
                    createViolation(
                        this,
                        i + 1,
                        line,
                        'Return type "object" is too broad.',
                        'Use a specific interface, type alias, or Record<string, unknown> instead of "object".',
                    ),
                );
            }
        }
        return violations;
    },
};

/**
 * TS-MOD-06: Import type for type-only imports
 *
 * "Use import type when importing only types, to ensure the import
 *  is erased at runtime."
 *
 * This is hard to detect accurately without AST (we can't tell if a symbol
 * is used only as a type). Deferred.
 */
// Import type -- deferred to AI deep review layer

/**
 * TS-DIS-08: No enum merging (multiple enum declarations with same name)
 *
 * Hard to detect with single-pass regex. Deferred.
 */
// Enum merging -- deferred to AI deep review layer

// ============================================================================
// EXPORTED RULE ARRAY
// ============================================================================

/**
 * TypeScript-specific rules only (added on top of JS rules).
 */
export const typescriptOnlyRules: Rule[] = [
    // Source File Structure -- Imports & Exports
    noNamespaces,
    noRequireImports,
    noMutableExports,
    noConstEnum,
    noDefaultExports,

    // Type System
    noWrapperTypes,
    preferInterfaceOverType,
    useArraySyntaxSugar,
    noNullableTypeAliases,
    noAnyType,
    noEmptyObjectType,
    preferTupleTypes,
    preferAsTypeAssertion,
    noNonNullAssertion,
    preferTypeDeclaration,
    noReturnTypeObject,

    // Classes
    noEsPrivateFields,
    noEmptyConstructors,
    newWithParentheses,
    noPublicParameterProperties,

    // Naming
    noInterfaceIPrefix,
    noUnderscorePrefixSuffix,

    // Language Features / Disallowed
    noTsIgnore,
    noBracketAccessForProperties,
    noForInOnArrays,
];

/**
 * All TypeScript rules = all JavaScript rules + TypeScript-specific rules.
 * This is the array registered in engine.ts for language: 'typescript'.
 */
export const typescriptRules: Rule[] = [
    ...javascriptRules,
    ...typescriptOnlyRules,
];
