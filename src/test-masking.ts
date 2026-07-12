import { setVibeContext } from './ecosystem/masking.js';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testDir = path.join(__dirname, '..', 'avvarre_test_project');
console.log('--- Testing mask: FRONTEND ---');
const frontendInstructions = setVibeContext(testDir, 'frontend');
console.log(frontendInstructions);
console.log(fs.readFileSync(path.join(testDir, '.avvarre', 'ignore'), 'utf-8'));

console.log('\n--- Testing mask: BACKEND ---');
const backendInstructions = setVibeContext(testDir, 'backend');
console.log(backendInstructions);
console.log(fs.readFileSync(path.join(testDir, '.avvarre', 'ignore'), 'utf-8'));

console.log('\n--- Testing mask: FULL ---');
const fullInstructions = setVibeContext(testDir, 'full');
console.log(fullInstructions);
console.log(fs.readFileSync(path.join(testDir, '.avvarre', 'ignore'), 'utf-8'));
