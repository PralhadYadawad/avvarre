import { scaffoldavvarre } from './ecosystem/scaffold.js';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testDir = path.join(__dirname, '..', 'avvarre_test_project');
console.log('Generating dummy project at:', testDir);

const result = scaffoldavvarre(testDir, { projectName: 'Skill Router Test' });
console.log('Scaffold Result:', result);
