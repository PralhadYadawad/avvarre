import Parser from 'web-tree-sitter';
import { existsSync } from 'node:fs';
import { join, dirname, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Find the node_modules folder relative to this file (handles both nested and flat layouts)
let wasmDir = join(__dirname, '..', '..', 'node_modules', 'tree-sitter-wasms', 'out');
if (!existsSync(wasmDir)) {
    // Try flat layout fallback: node_modules/tree-sitter-wasms
    const flatPath = join(__dirname, '..', '..', '..', 'tree-sitter-wasms', 'out');
    if (existsSync(flatPath)) {
        wasmDir = flatPath;
    }
}

// Map extensions to their grammar wasm names
const extensionToLanguageWasm: Record<string, string> = {
    '.js': 'tree-sitter-javascript.wasm',
    '.jsx': 'tree-sitter-javascript.wasm',
    '.ts': 'tree-sitter-typescript.wasm',
    '.tsx': 'tree-sitter-tsx.wasm',
    '.py': 'tree-sitter-python.wasm',
    '.go': 'tree-sitter-go.wasm',
    '.java': 'tree-sitter-java.wasm',
    '.cs': 'tree-sitter-c_sharp.wasm',
    '.cpp': 'tree-sitter-cpp.wasm',
    '.cc': 'tree-sitter-cpp.wasm',
    '.h': 'tree-sitter-cpp.wasm',
    '.hpp': 'tree-sitter-cpp.wasm',
    '.sh': 'tree-sitter-bash.wasm',
    '.bash': 'tree-sitter-bash.wasm',
    '.kt': 'tree-sitter-kotlin.wasm',
    '.kts': 'tree-sitter-kotlin.wasm',
    '.swift': 'tree-sitter-swift.wasm',
    '.m': 'tree-sitter-objc.wasm',
    '.mm': 'tree-sitter-objc.wasm'
};

/**
 * Canonical language key per extension. Derived explicitly instead of by
 * string-splitting the wasm filename, so the extraction switch below is stable
 * and every grammar we load also has a matching extraction branch.
 */
const extensionToLangKey: Record<string, LangKey> = {
    '.js': 'js', '.jsx': 'js',
    '.ts': 'ts', '.tsx': 'ts',
    '.py': 'python',
    '.go': 'go',
    '.java': 'java',
    '.cs': 'csharp',
    '.cpp': 'cpp', '.cc': 'cpp', '.h': 'cpp', '.hpp': 'cpp',
    '.sh': 'bash', '.bash': 'bash',
    '.kt': 'kotlin', '.kts': 'kotlin',
    '.swift': 'swift',
    '.m': 'objc', '.mm': 'objc'
};

type LangKey =
    | 'python' | 'js' | 'ts' | 'go' | 'java' | 'csharp'
    | 'cpp' | 'bash' | 'kotlin' | 'swift' | 'objc';

export interface ParsedNode {
    kind: 'File' | 'Class' | 'Function' | 'Test';
    name: string;
    qualifiedName: string;
    lineStart: number;
    lineEnd: number;
    parentName?: string;
    params?: string;
    returnType?: string;
    isTest: boolean;
}

export interface ParsedEdge {
    kind: 'CALLS' | 'IMPORTS_FROM' | 'INHERITS';
    sourceQualified: string;
    targetQualified: string;
    line: number;
}

export interface ParseResult {
    nodes: ParsedNode[];
    edges: ParsedEdge[];
}

let parserInitialized = false;
const loadedLanguages: Record<string, any> = {};
let parserInstance: Parser | null = null;

/**
 * Initializes web-tree-sitter if it has not been initialized.
 */
async function ensureInitialized() {
    if (!parserInitialized) {
        await Parser.init();
        parserInstance = new Parser();
        parserInitialized = true;
    }
}

/**
 * Retrieves or loads the tree-sitter language grammar for a given file extension.
 */
async function getLanguageForExtension(ext: string) {
    await ensureInitialized();
    const wasmName = extensionToLanguageWasm[ext.toLowerCase()];
    if (!wasmName) return null;

    if (loadedLanguages[wasmName]) {
        return loadedLanguages[wasmName];
    }

    const wasmPath = join(wasmDir, wasmName);
    if (!existsSync(wasmPath)) {
        return null;
    }

    try {
        const { Language } = Parser as any;
        const Lang = await Language.load(wasmPath);
        loadedLanguages[wasmName] = Lang;
        return Lang;
    } catch (error) {
        console.error(`[Avvarre Parser] Failed to load language WASM for ${ext}:`, error);
        return null;
    }
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

/**
 * Extracts the simple callee name from a call target's text.
 *
 * Grammars hand us either a bare identifier (`greet`) or a member/selector
 * expression (`obj.doIt`, `this.world`, `fmt.Println`). We store only the final
 * identifier so that the impact query's `qualified_name LIKE '%::' || target`
 * join can actually match a stored node — a stored qualified name ends in
 * `::doIt`, never `::obj.doIt`.
 */
function extractCallName(raw: string | undefined | null): string {
    if (!raw) return '';
    // Drop any argument list and everything after it.
    const head = raw.split('(')[0];
    // Take the trailing identifier of a dotted / arrow / scoped chain.
    const match = head.match(/([A-Za-z_$][A-Za-z0-9_$]*)\s*$/);
    return match ? match[1] : head.trim();
}

/** Returns the first named child of the given type, or null. */
function firstChildOfType(node: any, type: string): any | null {
    for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child && child.type === type) return child;
    }
    return null;
}

/** Returns the text of the `name` field, or a fallback child type's text. */
function nameOf(node: any, fallbackTypes: string[] = []): string | null {
    const nameField = node.childForFieldName ? node.childForFieldName('name') : null;
    if (nameField) return nameField.text;
    for (const t of fallbackTypes) {
        const c = firstChildOfType(node, t);
        if (c) return c.text;
    }
    return null;
}

// ──────────────────────────────────────────────────────────────────────────
// Parse
// ──────────────────────────────────────────────────────────────────────────

/**
 * Parse source code of a file and extract AST nodes and edges.
 * Fallbacks to a basic file-level node if the language is unsupported.
 */
export async function parseFile(filePath: string, sourceCode: string): Promise<ParseResult> {
    const ext = extname(filePath);
    const fileName = basename(filePath);
    const nodes: ParsedNode[] = [];
    const edges: ParsedEdge[] = [];

    // Always create a File level node first
    const isTestFile = fileName.includes('.test.') || fileName.includes('.spec.') ||
        fileName.startsWith('test_') || fileName.endsWith('_test.go') || fileName.includes('Test');
    const fileNode: ParsedNode = {
        kind: 'File',
        name: fileName,
        qualifiedName: filePath,
        lineStart: 1,
        lineEnd: sourceCode.split('\n').length || 1,
        isTest: isTestFile
    };
    nodes.push(fileNode);

    const lang = await getLanguageForExtension(ext);
    if (!lang) {
        // Fallback for unsupported languages: just the File node
        return { nodes, edges };
    }

    parserInstance!.setLanguage(lang);
    const tree = parserInstance!.parse(sourceCode);
    const root = tree.rootNode;

    const langKey = extensionToLangKey[ext.toLowerCase()];

    // Context helper to manage parent scope naming
    const scopeStack: string[] = [filePath];

    /** Records a Class/Function/Test node and pushes its scope. */
    function addNode(
        kind: ParsedNode['kind'],
        name: string,
        node: any,
        isTest: boolean,
        params?: string
    ): void {
        const currentScope = scopeStack[scopeStack.length - 1];
        const qualifiedName = `${currentScope}::${name}`;
        nodes.push({
            kind,
            name,
            qualifiedName,
            lineStart: node.startPosition.row + 1,
            lineEnd: node.endPosition.row + 1,
            parentName: currentScope,
            params,
            isTest
        });
        scopeStack.push(qualifiedName);
    }

    /** Records a CALLS edge from the current scope to a simple callee name. */
    function addCall(rawTarget: string | undefined | null, node: any): void {
        const target = extractCallName(rawTarget);
        if (!target) return;
        edges.push({
            kind: 'CALLS',
            sourceQualified: scopeStack[scopeStack.length - 1],
            targetQualified: target,
            line: node.startPosition.row + 1
        });
    }

    /** Records an INHERITS edge from a class qualified name to a base name. */
    function addInherits(classQn: string, baseName: string, node: any): void {
        const base = extractCallName(baseName);
        if (!base) return;
        edges.push({
            kind: 'INHERITS',
            sourceQualified: classQn,
            targetQualified: base,
            line: node.startPosition.row + 1
        });
    }

    /** Records an IMPORTS_FROM edge from the file to a module path. */
    function addImport(moduleRaw: string | undefined | null, node: any): void {
        if (!moduleRaw) return;
        const target = moduleRaw.replace(/['"`]/g, '').trim();
        if (!target) return;
        edges.push({
            kind: 'IMPORTS_FROM',
            sourceQualified: filePath,
            targetQualified: target,
            line: node.startPosition.row + 1
        });
    }

    const testNamePrefixes = (name: string): boolean =>
        name.startsWith('test_') || name.startsWith('test') || name.startsWith('Test') || name === 'it';

    function walk(node: any) {
        let pushedScope = false;
        const t = node.type;

        switch (langKey) {
            case 'python': {
                if (t === 'class_definition') {
                    const name = nameOf(node);
                    if (name) {
                        const scope = scopeStack[scopeStack.length - 1];
                        addNode('Class', name, node, name.startsWith('Test') || isTestFile);
                        pushedScope = true;
                        const bases = node.childForFieldName('superclasses');
                        if (bases) {
                            for (let i = 0; i < bases.namedChildCount; i++) {
                                addInherits(`${scope}::${name}`, bases.namedChild(i).text, node);
                            }
                        }
                    }
                } else if (t === 'function_definition') {
                    const name = nameOf(node);
                    if (name) {
                        const isTest = name.startsWith('test_') || isTestFile;
                        const params = node.childForFieldName('parameters')?.text ?? '';
                        addNode(isTest ? 'Test' : 'Function', name, node, isTest, params);
                        pushedScope = true;
                    }
                } else if (t === 'call') {
                    addCall(node.childForFieldName('function')?.text, node);
                } else if (t === 'import_statement' || t === 'import_from_statement') {
                    const mod = node.childForFieldName('module_name')?.text
                        ?? node.childForFieldName('name')?.text;
                    addImport(mod, node);
                }
                break;
            }

            case 'js':
            case 'ts': {
                if (t === 'class_declaration') {
                    const name = nameOf(node);
                    if (name) {
                        const scope = scopeStack[scopeStack.length - 1];
                        addNode('Class', name, node, name.startsWith('Test') || isTestFile);
                        pushedScope = true;
                        const heritage = firstChildOfType(node, 'class_heritage');
                        if (heritage) {
                            const baseId = firstChildOfType(heritage, 'identifier')
                                ?? firstChildOfType(heritage, 'member_expression');
                            if (baseId) addInherits(`${scope}::${name}`, baseId.text, node);
                        }
                    }
                } else if (t === 'function_declaration' || t === 'method_definition') {
                    const name = nameOf(node);
                    if (name) {
                        const isTest = name.startsWith('test') || name === 'it' || isTestFile;
                        const params = node.childForFieldName('parameters')?.text ?? '';
                        addNode(isTest ? 'Test' : 'Function', name, node, isTest, params);
                        pushedScope = true;
                    }
                } else if (t === 'call_expression') {
                    addCall(node.childForFieldName('function')?.text, node);
                } else if (t === 'import_statement') {
                    addImport(node.childForFieldName('source')?.text, node);
                }
                break;
            }

            case 'go': {
                if (t === 'function_declaration' || t === 'method_declaration') {
                    const name = nameOf(node);
                    if (name) {
                        const isTest = name.startsWith('Test') || name.startsWith('Benchmark') || isTestFile;
                        const params = node.childForFieldName('parameters')?.text ?? '';
                        addNode(isTest ? 'Test' : 'Function', name, node, isTest, params);
                        pushedScope = true;
                    }
                } else if (t === 'call_expression') {
                    addCall(node.childForFieldName('function')?.text, node);
                } else if (t === 'import_spec') {
                    addImport(node.childForFieldName('path')?.text, node);
                }
                break;
            }

            case 'java': {
                if (t === 'class_declaration' || t === 'interface_declaration' || t === 'enum_declaration') {
                    const name = nameOf(node);
                    if (name) {
                        const scope = scopeStack[scopeStack.length - 1];
                        addNode('Class', name, node, name.includes('Test') || isTestFile);
                        pushedScope = true;
                        const superclass = firstChildOfType(node, 'superclass');
                        if (superclass) {
                            const ti = firstChildOfType(superclass, 'type_identifier');
                            if (ti) addInherits(`${scope}::${name}`, ti.text, node);
                        }
                        const ifaces = firstChildOfType(node, 'super_interfaces');
                        if (ifaces) {
                            const list = firstChildOfType(ifaces, 'type_list');
                            if (list) {
                                for (let i = 0; i < list.namedChildCount; i++) {
                                    addInherits(`${scope}::${name}`, list.namedChild(i).text, node);
                                }
                            }
                        }
                    }
                } else if (t === 'method_declaration' || t === 'constructor_declaration') {
                    const name = nameOf(node);
                    if (name) {
                        const isTest = name.startsWith('test') || isTestFile;
                        const params = node.childForFieldName('parameters')?.text ?? '';
                        addNode(isTest ? 'Test' : 'Function', name, node, isTest, params);
                        pushedScope = true;
                    }
                } else if (t === 'method_invocation') {
                    // Java exposes the callee as a `name` field directly.
                    addCall(node.childForFieldName('name')?.text ?? node.text, node);
                } else if (t === 'import_declaration') {
                    const scoped = firstChildOfType(node, 'scoped_identifier');
                    addImport(scoped?.text, node);
                }
                break;
            }

            case 'csharp': {
                if (t === 'class_declaration' || t === 'interface_declaration' ||
                    t === 'struct_declaration' || t === 'record_declaration') {
                    const name = nameOf(node);
                    if (name) {
                        const scope = scopeStack[scopeStack.length - 1];
                        addNode('Class', name, node, name.includes('Test') || isTestFile);
                        pushedScope = true;
                        const baseList = firstChildOfType(node, 'base_list');
                        if (baseList) {
                            for (let i = 0; i < baseList.namedChildCount; i++) {
                                addInherits(`${scope}::${name}`, baseList.namedChild(i).text, node);
                            }
                        }
                    }
                } else if (t === 'method_declaration' || t === 'constructor_declaration' ||
                    t === 'local_function_statement') {
                    const name = nameOf(node);
                    if (name) {
                        const isTest = name.startsWith('Test') || name.endsWith('Test') || isTestFile;
                        const params = node.childForFieldName('parameters')?.text ?? '';
                        addNode(isTest ? 'Test' : 'Function', name, node, isTest, params);
                        pushedScope = true;
                    }
                } else if (t === 'invocation_expression') {
                    const fn = node.childForFieldName('function');
                    // member_access_expression exposes the callee via its `name` field.
                    const callee = fn?.childForFieldName?.('name')?.text ?? fn?.text;
                    addCall(callee, node);
                } else if (t === 'using_directive') {
                    const id = firstChildOfType(node, 'qualified_name')
                        ?? firstChildOfType(node, 'identifier');
                    addImport(id?.text, node);
                }
                break;
            }

            case 'cpp': {
                if (t === 'class_specifier' || t === 'struct_specifier') {
                    const name = nameOf(node, ['type_identifier']);
                    if (name) {
                        const scope = scopeStack[scopeStack.length - 1];
                        addNode('Class', name, node, name.includes('Test') || isTestFile);
                        pushedScope = true;
                        const baseClause = firstChildOfType(node, 'base_class_clause');
                        if (baseClause) {
                            const ti = firstChildOfType(baseClause, 'type_identifier');
                            if (ti) addInherits(`${scope}::${name}`, ti.text, node);
                        }
                    }
                } else if (t === 'function_definition') {
                    // function_definition -> declarator: function_declarator -> declarator: identifier
                    const declarator = node.childForFieldName('declarator');
                    let fnDeclarator = declarator;
                    // Some declarators are wrapped (pointer/reference); descend to a function_declarator.
                    if (fnDeclarator && fnDeclarator.type !== 'function_declarator') {
                        fnDeclarator = firstChildOfType(fnDeclarator, 'function_declarator') ?? fnDeclarator;
                    }
                    const idNode = fnDeclarator
                        ? (fnDeclarator.childForFieldName?.('declarator')
                            ?? firstChildOfType(fnDeclarator, 'identifier')
                            ?? firstChildOfType(fnDeclarator, 'field_identifier'))
                        : null;
                    const name = idNode?.text;
                    if (name) {
                        const isTest = name.startsWith('Test') || name.startsWith('TEST') || isTestFile;
                        const params = fnDeclarator?.childForFieldName?.('parameters')?.text ?? '';
                        addNode(isTest ? 'Test' : 'Function', name, node, isTest, params);
                        pushedScope = true;
                    }
                } else if (t === 'call_expression') {
                    addCall(node.childForFieldName('function')?.text, node);
                } else if (t === 'preproc_include') {
                    const path = firstChildOfType(node, 'system_lib_string')
                        ?? firstChildOfType(node, 'string_literal');
                    addImport(path?.text?.replace(/[<>]/g, ''), node);
                }
                break;
            }

            case 'bash': {
                if (t === 'function_definition') {
                    const name = nameOf(node, ['word']);
                    if (name) {
                        addNode('Function', name, node, isTestFile);
                        pushedScope = true;
                    }
                } else if (t === 'command') {
                    const cmdName = node.childForFieldName('name')?.text;
                    if (cmdName === 'source' || cmdName === '.') {
                        // `source file` / `. file` — treat as an import of the first argument.
                        const argWord = firstChildOfType(node, 'word');
                        addImport(argWord?.text, node);
                    } else if (cmdName) {
                        addCall(cmdName, node);
                    }
                }
                break;
            }

            case 'kotlin': {
                if (t === 'class_declaration' || t === 'object_declaration') {
                    const name = nameOf(node, ['type_identifier']);
                    if (name) {
                        const scope = scopeStack[scopeStack.length - 1];
                        addNode('Class', name, node, name.includes('Test') || isTestFile);
                        pushedScope = true;
                        const delegation = firstChildOfType(node, 'delegation_specifier');
                        if (delegation) {
                            const ctor = firstChildOfType(delegation, 'constructor_invocation');
                            const userType = ctor
                                ? firstChildOfType(ctor, 'user_type')
                                : firstChildOfType(delegation, 'user_type');
                            if (userType) addInherits(`${scope}::${name}`, userType.text, node);
                        }
                    }
                } else if (t === 'function_declaration') {
                    const name = nameOf(node, ['simple_identifier']);
                    if (name) {
                        const isTest = name.startsWith('test') || name.includes('Test') || isTestFile;
                        const params = firstChildOfType(node, 'function_value_parameters')?.text ?? '';
                        addNode(isTest ? 'Test' : 'Function', name, node, isTest, params);
                        pushedScope = true;
                    }
                } else if (t === 'call_expression') {
                    const idChild = firstChildOfType(node, 'simple_identifier')
                        ?? firstChildOfType(node, 'navigation_expression');
                    addCall(idChild?.text, node);
                } else if (t === 'import_header') {
                    const id = firstChildOfType(node, 'identifier');
                    addImport(id?.text, node);
                }
                break;
            }

            case 'swift': {
                if (t === 'class_declaration' || t === 'protocol_declaration') {
                    const name = nameOf(node, ['type_identifier']);
                    if (name) {
                        const scope = scopeStack[scopeStack.length - 1];
                        addNode('Class', name, node, name.includes('Test') || isTestFile);
                        pushedScope = true;
                        const inh = firstChildOfType(node, 'inheritance_specifier');
                        if (inh) {
                            const ut = firstChildOfType(inh, 'user_type');
                            if (ut) addInherits(`${scope}::${name}`, ut.text, node);
                        }
                    }
                } else if (t === 'function_declaration') {
                    const name = nameOf(node, ['simple_identifier']);
                    if (name) {
                        const isTest = name.startsWith('test') || isTestFile;
                        addNode(isTest ? 'Test' : 'Function', name, node, isTest);
                        pushedScope = true;
                    }
                } else if (t === 'call_expression') {
                    const idChild = firstChildOfType(node, 'simple_identifier')
                        ?? firstChildOfType(node, 'navigation_expression');
                    addCall(idChild?.text, node);
                } else if (t === 'import_declaration') {
                    const id = firstChildOfType(node, 'identifier');
                    addImport(id?.text, node);
                }
                break;
            }

            case 'objc': {
                if (t === 'class_interface' || t === 'class_implementation') {
                    const idNode = firstChildOfType(node, 'identifier');
                    const name = idNode?.text;
                    if (name) {
                        const scope = scopeStack[scopeStack.length - 1];
                        addNode('Class', name, node, name.includes('Test') || isTestFile);
                        pushedScope = true;
                        const superclass = node.childForFieldName('superclass');
                        if (superclass) addInherits(`${scope}::${name}`, superclass.text, node);
                    }
                } else if (t === 'method_definition') {
                    const idNode = firstChildOfType(node, 'identifier');
                    const name = idNode?.text;
                    if (name) {
                        const isTest = name.startsWith('test') || isTestFile;
                        addNode(isTest ? 'Test' : 'Function', name, node, isTest);
                        pushedScope = true;
                    }
                } else if (t === 'message_expression') {
                    const method = node.childForFieldName('method')
                        ?? firstChildOfType(node, 'identifier');
                    addCall(method?.text, node);
                } else if (t === 'preproc_import') {
                    const path = firstChildOfType(node, 'system_lib_string')
                        ?? firstChildOfType(node, 'string_literal');
                    addImport(path?.text?.replace(/[<>]/g, ''), node);
                }
                break;
            }
        }

        // Recursively walk children
        for (let i = 0; i < node.childCount; i++) {
            walk(node.child(i));
        }

        // Restore scope when backtracking
        if (pushedScope) {
            scopeStack.pop();
        }
    }

    walk(root);
    tree.delete();

    return { nodes, edges };
}
