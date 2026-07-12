import { appendHistory, getHistoryTrends, HistoryEntry } from './ecosystem/history.js';
import * as fs from 'fs';
import * as path from 'path';

const testWorkspace = path.join(process.cwd(), '.test_avvarre_workspace_history');
const trackingDir = path.join(testWorkspace, '.avvarre');
const trackingFile = path.join(trackingDir, 'history.json');

// Setup
if (fs.existsSync(testWorkspace)) {
    fs.rmSync(testWorkspace, { recursive: true, force: true });
}
fs.mkdirSync(trackingDir, { recursive: true });

console.log('Testing History Tracking...');

// 1. Initial append
appendHistory(testWorkspace, 'src/test1.ts', 'typescript', 60, 'D', 10);
appendHistory(testWorkspace, 'src/test2.ts', 'typescript', 95, 'A', 2);

const content1 = JSON.parse(fs.readFileSync(trackingFile, 'utf-8')) as HistoryEntry[];
if (content1.length !== 2) throw new Error('Failed to append initial history');
console.log('✅ Initial append works (2 records)');

// 2. Wait a tiny bit and append an improvement
setTimeout(() => {
    appendHistory(testWorkspace, 'src/test1.ts', 'typescript', 85, 'B', 4);

    // 3. Test trends output
    const fileTrend = getHistoryTrends(testWorkspace, 'src/test1.ts');
    console.log('\n--- File Trend ---');
    console.log(fileTrend);
    if (!fileTrend.includes('+25 points')) throw new Error('Trend calculation incorrect');
    console.log('✅ File trend calculation works');

    const projTrend = getHistoryTrends(testWorkspace);
    console.log('\n--- Project Trend ---');
    console.log(projTrend);
    if (!projTrend.includes("Average score: 90/100")) throw new Error('Project trend calculation incorrect');
    console.log('✅ Project trend calculation works');

    // Setup cleanup
    fs.rmSync(testWorkspace, { recursive: true, force: true });
    console.log('\n🎉 All History tests passed!\n');
}, 100);
