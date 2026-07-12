/**
 * avvarre AI Types
 *
 * Types specific to the AI layer (Gemini unified analysis).
 */

import { Severity, Violation } from '../types.js';

/**
 * A perfectly structured, actionable finding meant for an IDE agent.
 */
export interface ActionableFinding {
    /** The rule ID (if from regex) or guide section (if AI-found), e.g., "PY-IMP-01" or "§2.3" */
    ruleIdOrSection: string;

    /** Category of the issue */
    category: string;

    /** Severity of the finding */
    severity: Severity;

    /** Line number where the issue occurs */
    line: number;

    /** Explanation of why this violates the Google Style Guide */
    issue: string;

    /** Exact replacement code or precise instruction for the IDE agent to apply */
    actionableFix: string;

    /** Before code (what needs replacing) */
    codeSnippet: string;

    /** Was this found by the fast regex engine (true) or Gemini (false)? */
    isRegexConfirmed: boolean;
}

/**
 * The unified payload returned to the IDE Agent by the avvarre_file tool.
 */
export interface avvarreFileResult {
    /** File being analyzed */
    filename: string;

    /** Overall score (0-100) */
    score: number;

    /** Grade (A-F) */
    grade: string;

    /** True if the AI successfully ran, false if it gracefully degraded to regex-only */
    aiEnhanced: boolean;

    /** The list of all findings (Regex + AI) with actionable fixes */
    findings: ActionableFinding[];

    /** A short summary of the file's quality intended for the developer */
    summary: string;

    /** A plain-language note explaining server decisions (chunking, skipping, etc.) for the user */
    userNote?: string;

    /** Performance and execution metadata */
    meta: {
        modelUsed?: string;
        tokensUsed?: number;
        regexViolationsFound: number;
        aiViolationsFound: number;
        /** True if the file was split into chunks for AI analysis */
        chunked?: boolean;
        /** Number of chunks the file was split into */
        totalChunks?: number;
    };
}
