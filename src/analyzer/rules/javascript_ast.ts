import * as ts from 'typescript';
import * as fs from 'fs';

/**
 * Native JS/TS AST Runner for avvarre.
 * Uses the TypeScript Compiler API to identify style violations.
 */

interface Violation {
    ruleId: string;
    ruleName: string;
    line: number;
    message: string;
    suggestion: string;
}

function analyze(code: string, filename: string): Violation[] {
    const sourceFile = ts.createSourceFile(
        filename,
        code,
        ts.ScriptTarget.Latest,
        true
    );

    const violations: Violation[] = [];
    const isTypescript = /\.(ts|tsx|mts|cts)$/i.test(filename);

    function report(id: string, name: string, node: ts.Node, msg: string, sug: string) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        violations.push({
            ruleId: id,
            ruleName: name,
            line: line + 1,
            message: msg,
            suggestion: sug
        });
    }

    function visit(node: ts.Node) {
        // node.forEachChild(visit) is at the end
        // console.error(`Visiting node: ${ts.SyntaxKind[node.kind]} at ${sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1}`);

        // --- 1. Variable Declarations ---
        if (ts.isVariableDeclarationList(node)) {
            // JS-VAR-01: No var
            const isLet = !!(node.flags & ts.NodeFlags.Let);
            const isConst = !!(node.flags & ts.NodeFlags.Const);
            if (!isLet && !isConst) {
                report('JS-VAR-01', 'No var keyword', node, 'The "var" keyword must not be used.', 'Use "const" or "let" instead.');
            }
            // JS-VAR-02: One variable per declaration
            if (node.declarations.length > 1) {
                report('JS-VAR-02', 'One variable per declaration', node, 'Multiple variables declared in one statement.', 'Split into separate declarations.');
            }

            // TS-MOD-03: No mutable exports
            if (isLet && ts.isSourceFile(node.parent.parent)) {
                const part = node.parent as ts.VariableStatement;
                if (part.modifiers && part.modifiers.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
                    report('TS-MOD-03', 'No mutable exports', node, 'Mutable exports (export let) are disallowed.', 'Use export const or a getter function.');
                }
            }
        }

        // --- 2. Imports/Exports ---
        if (ts.isExportAssignment(node) && node.isExportEquals === false) {
            // JS-MOD-01 / TS-MOD-05: No default exports
            const id = isTypescript ? 'TS-MOD-05' : 'JS-MOD-01';
            report(id, 'No default exports', node, 'Default exports are disallowed.', 'Use named exports instead.');
        }

        // Catch "export default function/class ..."
        if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) {
            const modifiers = ts.getCombinedModifierFlags(node);
            const isExport = !!(modifiers & ts.ModifierFlags.Export);
            const isDefault = !!(modifiers & ts.ModifierFlags.Default);
            if (isExport && isDefault) {
                const id = isTypescript ? 'TS-MOD-05' : 'JS-MOD-01';
                report(id, 'No default exports', node, 'Default exports are disallowed.', 'Use named exports instead.');
            }
        }

        if (ts.isImportEqualsDeclaration(node)) {
            // TS-MOD-02: import x = require(...)
            report('TS-MOD-02', 'No require imports', node, 'import x = require() is disallowed.', 'Use ES6 import syntax instead.');
        }

        if (isTypescript) {
            // TS-MOD-01: No namespaces
            if (ts.isModuleDeclaration(node) && !ts.isStringLiteral(node.name)) {
                if (!(node.flags & ts.NodeFlags.Namespace)) {
                    const text = node.getText(sourceFile);
                    if (text.trim().startsWith('namespace') || text.trim().startsWith('module')) {
                        report('TS-MOD-01', 'No namespace declarations', node, 'TypeScript namespaces are disallowed.', 'Use ES6 modules (import/export) instead.');
                    }
                }
            }
            // TS-MOD-04: No const enum
            if (ts.isEnumDeclaration(node)) {
                const flags = ts.getCombinedModifierFlags(node);
                if (flags & ts.ModifierFlags.Const) {
                    report('TS-MOD-04', 'No const enum', node, '"const enum" is disallowed.', 'Use plain "enum" instead.');
                }
            }
            // TS-NAME-01: No I prefix
            if (ts.isInterfaceDeclaration(node)) {
                const name = node.name.text;
                if (/^I[A-Z]/.test(name)) {
                    report('TS-NAME-01', 'No I prefix on interfaces', node.name, `Interface name "${name}" has an "I" prefix.`, 'Remove the "I" prefix.');
                }
            }
            // TS-TYPE-02: Prefer interface over type alias for objects
            if (ts.isTypeAliasDeclaration(node)) {
                if (ts.isTypeLiteralNode(node.type)) {
                    report('TS-TYPE-02', 'Prefer interface over type literal', node, 'Use "interface" for object types instead of "type" alias.', 'Convert to an interface.');
                }
                // TS-TYPE-04: No nullable type aliases
                if (ts.isUnionTypeNode(node.type)) {
                    const isNullable = node.type.types.some(t => t.kind === ts.SyntaxKind.NullKeyword || t.kind === ts.SyntaxKind.UndefinedKeyword);
                    if (isNullable) {
                        report('TS-TYPE-04', 'No nullable type aliases', node, 'Type aliases should not include null or undefined.', 'Add nullability at the usage site.');
                    }
                }
            }
            // TS-TYPE-03: Array sugar
            if (ts.isTypeReferenceNode(node)) {
                const typeName = node.typeName.getText(sourceFile);
                if (typeName === 'Array' || typeName === 'ReadonlyArray') {
                    if (node.typeArguments && node.typeArguments.length === 1) {
                        const inner = node.typeArguments[0];
                        // Simple check: if it's a primitive or a simple identifier
                        if (inner.kind === ts.SyntaxKind.StringKeyword || inner.kind === ts.SyntaxKind.NumberKeyword || inner.kind === ts.SyntaxKind.BooleanKeyword || ts.isTypeReferenceNode(inner)) {
                            report('TS-TYPE-03', 'Use T[] for simple arrays', node, `Use syntax sugar for ${typeName}.`, `Use ${inner.getText()}[] instead.`);
                        }
                    }
                }
            }
            // TS-CLASS-01: No #private
            if (ts.isPropertyDeclaration(node) || ts.isMethodDeclaration(node)) {
                if (node.name.kind === ts.SyntaxKind.PrivateIdentifier) {
                    report('TS-CLASS-01', 'No #private fields', node.name, 'ES private fields (#) are disallowed.', 'Use "private" visibility modifier instead.');
                }
            }
        }

        // --- 3. Exceptions ---
        if (ts.isCatchClause(node)) {
            // JS-ERR-01: No empty catch
            if (node.block.statements.length === 0) {
                // Check for explanatory comment
                const fullText = sourceFile.text;
                const ranges = ts.getTrailingCommentRanges(fullText, node.block.pos);
                const hasComment = (ranges && ranges.length > 0) || node.block.getFullText().includes('//') || node.block.getFullText().includes('/*');
                if (!hasComment) {
                    report('JS-ERR-01', 'No empty catch blocks', node, 'Empty catch block found.', 'Add error handling or a comment explaining why it is safe to ignore.');
                }
            }
        }
        if (ts.isThrowStatement(node)) {
            // JS-ERR-02: Throw only Error objects
            const expr = node.expression;
            if (ts.isStringLiteral(expr) || ts.isNumericLiteral(expr) || ts.isObjectLiteralExpression(expr)) {
                report('JS-ERR-02', 'Throw only Error objects', node, 'Throwing literals is discouraged.', 'Throw a new Error() instead.');
            }
        }

        // --- 4. Language Features ---
        if (ts.isNewExpression(node)) {
            const expr = node.expression;
            const name = expr.getText(sourceFile);
            // JS-ARR-01: No Array constructor
            if (name === 'Array') {
                report('JS-ARR-01', 'No Array constructor', node, 'The Array constructor is error-prone.', 'Use array literals [] instead.');
            }
            // JS-OBJ-01: No Object constructor
            if (name === 'Object') {
                report('JS-OBJ-01', 'No Object constructor', node, 'The Object constructor is discouraged for consistency.', 'Use object literals {} instead.');
            }
            // JS-DIS-03 / TS-TYPE-01: Primitive wrappers
            if (['Boolean', 'Number', 'String'].includes(name)) {
                report('JS-DIS-03', 'No wrapper objects', node, `new ${name}() creates a wrapper object, not a primitive.`, `Use ${name}() without "new" or use a literal.`);
            }
            // JS-DIS-05 / TS-CLASS-03: New with parens
            if (!node.arguments) {
                const id = isTypescript ? 'TS-CLASS-03' : 'JS-DIS-05';
                report(id, 'Constructor calls must use parentheses', node, 'Constructor invoked without parentheses.', 'Add () to the constructor call.');
            }
        }

        // JS-DIS-06: No modifying builtin prototypes
        if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
            const left = node.left;
            if (ts.isPropertyAccessExpression(left)) {
                const text = left.getText(sourceFile);
                if (/\b(Object|Array|String|Number|Boolean|Function|Symbol|Date|RegExp|Map|Set|Promise)\.prototype\b/.test(text)) {
                    report('JS-DIS-06', 'No modifying builtin prototypes', node, 'Modifying built-in prototypes is forbidden.', 'Use standalone functions or subclasses.');
                }
            }
        }

        // JS-FMT-01: Semicolons are required
        if (ts.isVariableStatement(node) || ts.isExpressionStatement(node) || ts.isReturnStatement(node) || ts.isBreakStatement(node) || ts.isContinueStatement(node) || ts.isThrowStatement(node) || ts.isImportDeclaration(node) || ts.isExportDeclaration(node) || ts.isExportAssignment(node)) {
            const text = node.getText(sourceFile);
            // console.error(`Checking semicolon for ${ts.SyntaxKind[node.kind]} at ${sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1}: [${text}]`);
            if (!text.trimEnd().endsWith(';')) {
                report('JS-FMT-01', 'Semicolons required', node, 'Statement lacks a semicolon.', 'Add a semicolon ; at the end of the statement.');
            }
        }

        if (ts.isBinaryExpression(node)) {
            // JS-EQ-01/02: Strict equality
            if (node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsToken || node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsToken) {
                const rightText = node.right.getText(sourceFile);
                if (rightText !== 'null') {
                    const id = (node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsToken) ? 'JS-EQ-01' : 'JS-EQ-02';
                    report(id, 'Use strict equality', node, `Loose equality (${node.operatorToken.getText()}) found.`, 'Use strict equality (=== or !==). Exception: "== null" is allowed.');
                }
            }
        }

        if (ts.isCallExpression(node)) {
            const name = node.expression.getText(sourceFile);
            if (name === 'require') {
                // JS-MOD-02 / TS-MOD-02: No require
                const id = isTypescript ? 'TS-MOD-02' : 'JS-MOD-02';
                report(id, 'No require()', node, 'require() is disallowed.', 'Use ES6 import syntax instead.');
            }
            // JS-DIS-01: No eval
            if (name === 'eval') {
                report('JS-DIS-01', 'No eval()', node, 'eval() is forbidden for security and performance.', 'Refactor to avoid eval().');
            }
            // JS-BP-01: console.log
            if (name.startsWith('console.')) {
                report('JS-BP-01', 'No console in production', node, 'console logs should be removed before production.', 'Use a proper logging library.');
            }
        }

        // --- 5. Formatting (Nested) ---
        // JS-FMT-05: Braces for control structures
        if (ts.isIfStatement(node) || ts.isForStatement(node) || ts.isForOfStatement(node) || ts.isForInStatement(node) || ts.isWhileStatement(node) || ts.isDoStatement(node)) {
            const stmt = (node as any).thenStatement || (node as any).statement;
            if (stmt && !ts.isBlock(stmt)) {
                report('JS-FMT-05', 'Braces required', node, 'Control structure lacks opening brace.', 'Always use braces {} for control structures.');
            }
            if (ts.isIfStatement(node) && node.elseStatement && !ts.isBlock(node.elseStatement) && !ts.isIfStatement(node.elseStatement)) {
                report('JS-FMT-05', 'Braces required', node.elseStatement, 'Else statement lacks opening brace.', 'Always use braces {} for control structures.');
            }
        }

        // --- 6. TypeScript-specific (Inherited) ---

        // TS-TS-01: No any type
        if (isTypescript) {
            // TS-TYPE-01: Wrapper types
            if (ts.isTypeReferenceNode(node)) {
                const typeName = node.typeName.getText(sourceFile);
                if (['String', 'Boolean', 'Number', 'Object'].includes(typeName)) {
                    report('TS-TYPE-01', 'No wrapper types', node, `Do not use "${typeName}" as a type.`, `Use "${typeName.toLowerCase()}" instead.`);
                }
            }

            if (ts.isTypeReferenceNode(node) || ts.isParameter(node) || ts.isVariableDeclaration(node) || ts.isPropertyDeclaration(node)) {
                const typeNode = (node as any).type;
                if (typeNode && typeNode.kind === ts.SyntaxKind.AnyKeyword) {
                    report('JS-TS-01', 'No any type', typeNode, 'The "any" type disables type checking.', 'Use a specific type or "unknown".');
                }
            }
            if (ts.isAsExpression(node)) {
                if (node.type.kind === ts.SyntaxKind.AnyKeyword) {
                    report('JS-TS-01', 'No any type', node.type, 'Type assertion to "any" found.', 'Use a safer type or "unknown".');
                }
            }
        }

        node.forEachChild(visit);
    }

    visit(sourceFile);
    return violations;
}

function checkFormatting(code: string, filename: string): Violation[] {
    const lines = code.split(/\r?\n/);
    const violations: Violation[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // JS-FMT-02: Line length
        if (line.length > 80) {
            // Basic exceptions
            if (!line.includes('http') && !line.includes('import ') && !line.includes('export ')) {
                violations.push({
                    ruleId: 'JS-FMT-02',
                    ruleName: '80-char limit',
                    line: i + 1,
                    message: `Line is ${line.length} chars (max 80).`,
                    suggestion: 'Break the line.'
                });
            }
        }
        // JS-FMT-03: Trailing whitespace
        if (/\s+$/.test(line)) {
            violations.push({
                ruleId: 'JS-FMT-03',
                ruleName: 'No trailing whitespace',
                line: i + 1,
                message: 'Line has trailing whitespace.',
                suggestion: 'Remove it.'
            });
        }
        // JS-FMT-04: No tabs
        if (/^\s*\t/.test(line)) {
            violations.push({
                ruleId: 'JS-FMT-04',
                ruleName: 'No tabs',
                line: i + 1,
                message: 'Tab used for indentation.',
                suggestion: 'Use spaces.'
            });
        }
        // JS-FMT-06: Opening brace on same line (K&R)
        if (/^\s*\{(?!\s*[\/]|\s*$)/.test(line)) {
            // Basic check: if a line starts with { and isn't just a comment or block start
            // This is a bit simplified but catches most cases where { is alone on a line.
            // Actually, the guide says: "No line break before the opening brace."
            // So if we find a line that is JUST { or starts with { after whitespace.
            if (/^\s*\{\s*$/.test(line)) {
                violations.push({
                    ruleId: 'JS-FMT-06',
                    ruleName: 'K&R Braces',
                    line: i + 1,
                    message: 'Opening brace { found on its own line.',
                    suggestion: 'Move it to the end of the previous line.'
                });
            }
        }
        // JS-FMT-07: One statement per line
        if (line.includes(';') && /;\s*[^\s\/]/.test(line)) {
            // Check if there is another statement after the semicolon (not a comment)
            // But skip "for (;;)"
            if (!line.includes('for (') && !line.includes('for(')) {
                violations.push({
                    ruleId: 'JS-FMT-07',
                    ruleName: 'One statement per line',
                    line: i + 1,
                    message: 'Multiple statements on one line.',
                    suggestion: 'Split into separate lines.'
                });
            }
        }
        // JS-STR-02: Line continuations
        if (line.endsWith('\\')) {
            violations.push({
                ruleId: 'JS-STR-02',
                ruleName: 'No line continuations',
                line: i + 1,
                message: 'Line continuation (backslash) in string literal.',
                suggestion: 'Use string concatenation (+) or template literals.'
            });
        }
    }
    return violations;
}

// MAIN
const code = fs.readFileSync(0, 'utf8');
const filename = process.argv[2] || 'test.ts';

const astViolations = analyze(code, filename);
const fmtViolations = checkFormatting(code, filename);

// Merge: only keep one violation per rule per line
const all = [...astViolations, ...fmtViolations];
const seen = new Set<string>();
const unique = all.filter(v => {
    const key = `${v.ruleId}:${v.line}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
});

process.stdout.write(JSON.stringify(unique, null, 2));
