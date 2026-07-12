import Parser from 'web-tree-sitter';
import { join } from 'node:path';

async function test() {
    console.log('Initializing parser...');
    await Parser.init();
    console.log('Parser initialized successfully!');
    
    const { Language } = Parser;

    const wasmPath = join(
        process.cwd(),
        'node_modules',
        'tree-sitter-wasms',
        'out',
        'tree-sitter-javascript.wasm'
    );
    console.log('Loading Javascript WASM from:', wasmPath);
    const Lang = await Language.load(wasmPath);
    
    const parser = new Parser();
    parser.setLanguage(Lang);
    console.log('Language loaded successfully!');

    const code = 'function hello() { console.log("world"); }';
    const tree = parser.parse(code);
    console.log('AST Root Type:', tree.rootNode.type);
    console.log('AST String:', tree.rootNode.toString());
}

test().catch(e => {
    console.error('Test caught error:', e);
});
