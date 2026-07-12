import { setVibeContext } from './ecosystem/masking.js';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testDir = path.join(__dirname, '..', 'avvarre_test_project');

import type { VibeMode } from './ecosystem/masking.js';

console.log('\n--- Testing mask: FEATURE (auth) ---');
const featureInstructions = setVibeContext(testDir, 'feature' as VibeMode, 'auth');
console.log(featureInstructions);
console.log('\n[Generated .avvarre/ignore content]');
console.log(fs.readFileSync(path.join(testDir, '.avvarre', 'ignore'), 'utf-8'));
