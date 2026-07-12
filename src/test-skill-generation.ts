import { generateDynamicSkills } from './ecosystem/skill_generator.js';
import { fetchDynamicCommunitySkills } from './ecosystem/community_fetcher.js';

async function runTests() {
    console.log('--- TEST 1: React & Node Stack (Local Heuristics) ---');
    const frontendStack = generateDynamicSkills({
        techStack: 'React, Node.js, Express, Postgres Database',
        keyFeatures: ['User Login Flow', 'Dashboard']
    });
    console.log(Object.keys(frontendStack));

    console.log('\n--- TEST 2: Python / Vue Stack (Local Heuristics) ---');
    const pythonStack = generateDynamicSkills({
        techStack: 'Vue, FastAPI backend, MongoDB',
        keyFeatures: []
    });
    console.log(Object.keys(pythonStack));

    console.log('\n--- TEST 3: Community API Fetcher (HTTPS to GitHub) ---');
    const communityStack = await fetchDynamicCommunitySkills('Next.js, Tailwind, Postgres');
    console.log("Found remote community rules:");
    console.log(Object.keys(communityStack));
    
    if (communityStack['skills/nextjs_community_rules.md']) {
        console.log("\nSample of Next.js Remote Rule:");
        console.log(communityStack['skills/nextjs_community_rules.md'].substring(0, 250) + "...");
    }
}

runTests();
