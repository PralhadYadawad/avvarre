import Parser from 'web-tree-sitter';
import { readFileSync, existsSync } from 'node:fs';
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
    '.sh': 'tree-sitter-bash.wasm',
    '.kt': 'tree-sitter-kotlin.wasm',
    '.swift': 'tree-sitter-swift.wasm',
    '.m': 'tree-sitter-objc.wasm',
    '.mm': 'tree-sitter-objc.wasm'
};

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
    kind: 'CALLS' | 'IMPORTS_FROM';
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
    const isTestFile = fileName.includes('.test.') || fileName.includes('.spec.') || fileName.startsWith('test_');
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

    const languageName = extensionToLanguageWasm[ext.toLowerCase()].split('-')[2].split('.')[0];
    
    // Context helper to manage parent scope naming
    const scopeStack: string[] = [filePath];

    function walk(node: any) {
        let nodeAdded = false;
        let originalScopeLength = scopeStack.length;

        const currentScope = scopeStack[scopeStack.length - 1];

        // Parse logic by language rules
        if (languageName === 'python') {
            if (node.type === 'class_definition') {
                const nameNode = node.childForFieldName('name');
                if (nameNode) {
                    const className = nameNode.text;
                    const qualifiedName = `${currentScope}::${className}`;
                    nodes.push({
                        kind: 'Class',
                        name: className,
                        qualifiedName,
                        lineStart: node.startPosition.row + 1,
                        lineEnd: node.endPosition.row + 1,
                        parentName: currentScope,
                        isTest: className.startsWith('Test') || isTestFile
                    });
                    scopeStack.push(qualifiedName);
                    nodeAdded = true;
                }
            } else if (node.type === 'function_definition') {
                const nameNode = node.childForFieldName('name');
                if (nameNode) {
                    const funcName = nameNode.text;
                    const qualifiedName = `${currentScope}::${funcName}`;
                    const isTest = funcName.startsWith('test_') || isTestFile;
                    
                    const paramsNode = node.childForFieldName('parameters');
                    const params = paramsNode ? paramsNode.text : '';

                    nodes.push({
                        kind: isTest ? 'Test' : 'Function',
                        name: funcName,
                        qualifiedName,
                        lineStart: node.startPosition.row + 1,
                        lineEnd: node.endPosition.row + 1,
                        parentName: currentScope,
                        params,
                        isTest
                    });
                    scopeStack.push(qualifiedName);
                    nodeAdded = true;
                }
            } else if (node.type === 'call') {
                const funcNode = node.childForFieldName('function');
                if (funcNode) {
                    edges.push({
                        kind: 'CALLS',
                        sourceQualified: currentScope,
                        targetQualified: funcNode.text,
                        line: node.startPosition.row + 1
                    });
                }
            }
        } else if (languageName === 'typescript' || languageName === 'javascript' || languageName === 'tsx') {
            if (node.type === 'class_declaration') {
                const nameNode = node.childForFieldName('name');
                if (nameNode) {
                    const className = nameNode.text;
                    const qualifiedName = `${currentScope}::${className}`;
                    nodes.push({
                        kind: 'Class',
                        name: className,
                        qualifiedName,
                        lineStart: node.startPosition.row + 1,
                        lineEnd: node.endPosition.row + 1,
                        parentName: currentScope,
                        isTest: className.startsWith('Test') || isTestFile
                    });
                    scopeStack.push(qualifiedName);
                    nodeAdded = true;
                }
            } else if (node.type === 'function_declaration' || node.type === 'method_definition') {
                const nameNode = node.childForFieldName('name');
                if (nameNode) {
                    const funcName = nameNode.text;
                    const qualifiedName = `${currentScope}::${funcName}`;
                    const isTest = funcName.startsWith('test') || funcName === 'it' || isTestFile;

                    const paramsNode = node.childForFieldName('parameters');
                    const params = paramsNode ? paramsNode.text : '';

                    nodes.push({
                        kind: isTest ? 'Test' : 'Function',
                        name: funcName,
                        qualifiedName,
                        lineStart: node.startPosition.row + 1,
                        lineEnd: node.endPosition.row + 1,
                        parentName: currentScope,
                        params,
                        isTest
                    });
                    scopeStack.push(qualifiedName);
                    nodeAdded = true;
                }
            } else if (node.type === 'call_expression') {
                const funcNode = node.childForFieldName('function');
                if (funcNode) {
                    edges.push({
                        kind: 'CALLS',
                        sourceQualified: currentScope,
                        targetQualified: funcNode.text,
                        line: node.startPosition.row + 1
                    });
                }
            }
        } else if (languageName === 'go') {
            if (node.type === 'function_declaration' || node.type === 'method_declaration') {
                const nameNode = node.childForFieldName('name');
                if (nameNode) {
                    const funcName = nameNode.text;
                    const qualifiedName = `${currentScope}::${funcName}`;
                    const isTest = funcName.startsWith('Test') || isTestFile;

                    const paramsNode = node.childForFieldName('parameters');
                    const params = paramsNode ? paramsNode.text : '';

                    nodes.push({
                        kind: isTest ? 'Test' : 'Function',
                        name: funcName,
                        qualifiedName,
                        lineStart: node.startPosition.row + 1,
                        lineEnd: node.endPosition.row + 1,
                        parentName: currentScope,
                        params,
                        isTest
                    });
                    scopeStack.push(qualifiedName);
                    nodeAdded = true;
                }
            } else if (node.type === 'call_expression') {
                const funcNode = node.childForFieldName('function');
                if (funcNode) {
                    edges.push({
                        kind: 'CALLS',
                        sourceQualified: currentScope,
                        targetQualified: funcNode.text,
                        line: node.startPosition.row + 1
                    });
                }
            }
        }

        // Recursively walk children
        for (let i = 0; i < node.childCount; i++) {
            walk(node.child(i));
        }

        // Restore scope when backtracking
        if (nodeAdded) {
            scopeStack.pop();
        }
    }

    walk(root);
    tree.delete();

    return { nodes, edges };
}
