import { execSync } from 'child_process';
import { Violation } from '../../types.js';

/**
 * Result of a native AST runner execution.
 */
export interface NativeViolation {
    ruleId: string;
    ruleName: string;
    line: number;
    message: string;
    suggestion: string;
}

/**
 * Result of a native AST runner execution before being enriched by TS rule metadata.
 */
export interface PartialViolation extends NativeViolation {
    codeSnippet: string;
}

/**
 * Shared runner for native AST scripts (Python, Go, Dart, etc.)
 * Handles child process execution, stdin piping, and result caching.
 */
export class AstRunner {
    private cache = new Map<string, PartialViolation[]>();

    /**
     * Runs a native script and caches the result.
     * @param command The command to run (e.g. 'python script.py')
     * @param code The source code to analyze (sent via stdin)
     * @param lines Original source lines for snippet extraction
     * @param filename Optional filename for cache keying
     */
    public getViolations(
        command: string,
        code: string,
        lines: string[],
        filename?: string
    ): PartialViolation[] {
        // Simple cache key: filename if available + code
        const cacheKey = filename || code;

        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey)!;
        }

        try {
            const output = execSync(command, {
                input: code,
                encoding: 'utf-8',
                maxBuffer: 10 * 1024 * 1024, // 10MB
            });

            const rawViolations: NativeViolation[] = JSON.parse(output);

            const violations: PartialViolation[] = rawViolations.map((v) => ({
                ...v,
                codeSnippet: lines[v.line - 1]?.trim() || '',
            }));

            this.cache.set(cacheKey, violations);
            return violations;
        } catch (error: any) {
            console.error(`Failed to run AST runner (${command}):`, error.message);
            return [];
        }
    }

    /**
     * Clears the analysis cache.
     */
    public clearCache() {
        this.cache.clear();
    }
}

/**
 * Global instance for shared use if needed, though language-specific 
 * instances are usually preferred to avoid cache collisions.
 */
export const globalAstRunner = new AstRunner();
