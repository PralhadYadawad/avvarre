/**
 * Test script to run the unified AI layer directly.
 * Simulates exactly what an IDE AI Agent receives when calling avvarre_file.
 * 
 * Run with: node --env-file=.env dist/test-ai-layer.js
 */

import * as fs from 'fs';
import { createAiClientFromEnv } from './ai/client.js';

async function main() {
    console.log("Initializing Gemini Client...");
    const aiClient = createAiClientFromEnv();

    if (!aiClient) {
        console.warn("⚠️ AI_PROVIDER / API key not set in environment. Skipping AI analysis test.");
        return;
    }

    console.log("🚀 Starting AI Deep Analysis layer test...\n");

    console.log("Loading codebase_test/bad_code.py...");
    const code = fs.readFileSync('codebase_test/bad_code.py', 'utf-8');

    console.log("Running avvarre File Unified Analysis (Regex + Gemini AI)...");
    console.log("This may take 10-20 seconds for a full AI deep review...\n");

    const startTime = Date.now();
    try {
        const result = await aiClient.analyzeFile(code, 'python', 'bad_code.py');
        const durationMs = Date.now() - startTime;

        console.log('='.repeat(80));
        console.log('  avvarre: UNIFIED AI ANALYSIS RESULT (JSON PAYLOAD)');
        console.log('='.repeat(80));

        // Output exactly what the MCP server would send back to the IDE AI Agent
        console.log(JSON.stringify(result, null, 2));

        console.log('='.repeat(80));
        console.log(`✅ Analysis Complete in ${Math.round(durationMs / 1000)} seconds.`);
        console.log(`- Findings Sent to Agent: ${result.findings.length}`);
        console.log(`- Base Regex Found:       ${result.meta.regexViolationsFound}`);
        console.log(`- AI Exclusively Found:   ${result.meta.aiViolationsFound}`);
        console.log(`- Tokens Used:            ${result.meta.tokensUsed}`);

    } catch (error) {
        console.error("❌ AI Analysis Failed:", error);
    }
}

main();
