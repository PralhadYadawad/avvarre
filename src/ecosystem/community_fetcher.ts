import * as https from 'https';

/**
 * Registry of known paths within the popular PatrickJS/awesome-cursorrules directory.
 * We map common tech stacks to the community's best-practice folders.
 */
const KNOWN_COMMUNITY_RULES: Record<string, string> = {
    'nextjs': 'rules-new/nextjs.mdc',
    'react': 'rules-new/react.mdc',
    'vue': 'rules-new/vue.mdc',
    'python': 'rules-new/python.mdc',
    'fastapi': 'rules-new/fastapi.mdc',
    'node': 'rules-new/node-express.mdc',
    'express': 'rules-new/node-express.mdc',
    'rust': 'rules-new/rust.mdc',
    'svelte': 'rules-new/svelte.mdc',
    'tailwind': 'rules-new/tailwind.mdc',
    'typescript': 'rules-new/typescript.mdc',
    'cpp': 'rules-new/cpp.mdc'
};

/**
 * Makes a native Node HTTPS GET request.
 */
function httpsGet(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
        // Use a standard generic User-Agent to prevent 403 blocks from GitHub
        const req = https.get(url, { headers: { 'User-Agent': 'avvarre-Agent' } }, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                if (res.headers.location) {
                    return resolve(httpsGet(res.headers.location));
                }
                return reject(new Error('Redirect without location header'));
            }
            
            if (res.statusCode !== 200) {
                return reject(new Error(`HTTP ${res.statusCode} from ${url}`));
            }

            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => resolve(data));
        });

        req.on('error', (e) => reject(e));
        req.end();
    });
}

/**
 * Attempts to fetch a specific `.cursorrules` file from a GitHub repository for a requested framework.
 * By default, targets the largest community list: PatrickJS/awesome-cursorrules.
 * 
 * @param framework The normalized framework string (e.g. 'nextjs', 'fastapi')
 */
export async function fetchCommunityRule(framework: string): Promise<string | null> {
    const defaultRepo = process.env.avvarre_SKILLS_REPO || 'PatrickJS/awesome-cursorrules';
    
    // Convert e.g., "PatrickJS/awesome-cursorrules" into raw GitHub URL prefix
    // E.g., https://raw.githubusercontent.com/PatrickJS/awesome-cursorrules/main/
    const repoBase = `https://raw.githubusercontent.com/${defaultRepo}/main/`;

    // See if we have a known mapping for this popular framework
    const specificPath = KNOWN_COMMUNITY_RULES[framework];
    if (!specificPath) {
        return null;
    }

    const targetUrl = `${repoBase}${specificPath}`;

    try {
        const rawContent = await httpsGet(targetUrl);
        if (rawContent && rawContent.length > 50 && !rawContent.includes('404: Not Found')) {
            return `# Community Skill: ${framework}\n\n> **Source:** [${defaultRepo}](${targetUrl})\n> **AI INSTRUCTION**: Apply these community-sourced rules when building features in this domain.\n\n${rawContent}`;
        }
        return null;
    } catch (e) {
        // Silent catch. This is a progressive enhancement. If the community repo moves or GitHub is down, 
        // we just degrade gracefully to the hardcoded blueprints.
        return null;
    }
}

/**
 * Matches user techStack string input to known community rules and fetches them concurrently.
 */
export async function fetchDynamicCommunitySkills(techStackInput: string): Promise<Record<string, string>> {
    if (!techStackInput) return {};

    const stackParts = techStackInput.toLowerCase()
        .replace(/[,.;:|]/g, ' ') // Replace punctuation with space
        .split(' ')               // Split into array
        .map(p => p.trim())
        .filter(p => p.length > 0);

    const fetchedFiles: Record<string, string> = {};

    // Standardize input tokens to match keys in KNOWN_COMMUNITY_RULES
    const lookupTokens: string[] = [];
    for (const part of stackParts) {
        if (part === 'next' || part === 'next.js') lookupTokens.push('nextjs');
        else if (part === 'react.js') lookupTokens.push('react');
        else if (part === 'vue.js' || part === 'vuejs') lookupTokens.push('vue');
        else if (part === 'node.js' || part === 'nodejs') lookupTokens.push('node');
        else if (part === 'c#' || part === '.net') lookupTokens.push('csharp');
        else if (part === 'golang') lookupTokens.push('go');
        else lookupTokens.push(part);
    }

    // Deduplicate target frameworks
    const frameworksToFetch = [...new Set(lookupTokens)].filter(tf => KNOWN_COMMUNITY_RULES[tf]);

    // Fetch in parallel
    const promises = frameworksToFetch.map(async fw => {
        const content = await fetchCommunityRule(fw);
        if (content) {
            fetchedFiles[`skills/${fw}_community_rules.md`] = content;
        }
    });

    await Promise.allSettled(promises);

    return fetchedFiles;
}
