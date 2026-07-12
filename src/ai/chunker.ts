/**
 * Code Chunker for avvarre
 *
 * Splits large source files into smaller chunks for AI analysis,
 * then merges the results back together with corrected line numbers.
 *
 * Design decisions:
 *   - Regex analysis always runs on the FULL file (it's instant).
 *   - Only the AI layer uses chunking (it has context window limits).
 *   - Chunks overlap by a few lines to avoid cutting functions mid-body.
 *   - Line numbers in AI findings are adjusted to match the original file.
 *   - Duplicate findings (same ruleId + same line) are removed.
 */

import type { ActionableFinding } from './types.js';

/**
 * Configurable limits.
 * MAX_LINES_PER_CHUNK is conservative — most LLMs can handle 500 lines of
 * code comfortably within their context window alongside the system prompt.
 */
export const MAX_LINES_PER_CHUNK = 500;

/**
 * Number of overlapping lines between chunks.
 * This helps the AI understand context at chunk boundaries (e.g., a function
 * that starts near the end of one chunk continues into the next).
 */
const OVERLAP_LINES = 20;

/**
 * Represents a single chunk of code ready for AI analysis.
 */
export interface CodeChunk {
    /** The source code for this chunk */
    code: string;
    /** 1-indexed start line number in the original file */
    startLine: number;
    /** 1-indexed end line number in the original file (inclusive) */
    endLine: number;
    /** Which chunk this is (1-indexed) */
    chunkIndex: number;
    /** Total number of chunks */
    totalChunks: number;
}

/**
 * Split source code into manageable chunks for AI analysis.
 *
 * If the file is within MAX_LINES_PER_CHUNK, returns a single chunk (no splitting).
 * Otherwise, splits with overlap to preserve context at boundaries.
 */
export function chunkCode(code: string): CodeChunk[] {
    const lines = code.split('\n');
    const totalLines = lines.length;

    // No chunking needed for small files
    if (totalLines <= MAX_LINES_PER_CHUNK) {
        return [{
            code,
            startLine: 1,
            endLine: totalLines,
            chunkIndex: 1,
            totalChunks: 1,
        }];
    }

    const chunks: CodeChunk[] = [];
    let currentStart = 0; // 0-indexed position in the lines array

    while (currentStart < totalLines) {
        const currentEnd = Math.min(currentStart + MAX_LINES_PER_CHUNK, totalLines);
        const chunkLines = lines.slice(currentStart, currentEnd);

        chunks.push({
            code: chunkLines.join('\n'),
            startLine: currentStart + 1, // Convert to 1-indexed
            endLine: currentEnd,          // Already correct (exclusive end becomes inclusive)
            chunkIndex: chunks.length + 1,
            totalChunks: 0, // Will be set after all chunks are created
        });

        // Move forward, accounting for overlap
        // If we're at the end, stop. Otherwise, step back by overlap amount.
        if (currentEnd >= totalLines) {
            break;
        }
        currentStart = currentEnd - OVERLAP_LINES;
    }

    // Set totalChunks on all chunks
    for (const chunk of chunks) {
        chunk.totalChunks = chunks.length;
    }

    return chunks;
}

/**
 * Adjust the line numbers of AI findings from a chunk to match the original file.
 *
 * @param findings - The AI findings from analyzing a single chunk
 * @param chunk - The chunk metadata (contains startLine offset)
 * @returns The same findings with corrected line numbers
 */
export function adjustLineNumbers(
    findings: ActionableFinding[],
    chunk: CodeChunk,
): ActionableFinding[] {
    // If startLine is 1 (first chunk or no chunking), no adjustment needed
    if (chunk.startLine === 1) {
        return findings;
    }

    const offset = chunk.startLine - 1;

    return findings.map(f => ({
        ...f,
        line: f.line > 0 ? f.line + offset : f.line,
    }));
}

/**
 * Deduplicate findings that appear in multiple chunks (due to overlap)
 * or that the AI reports duplicates of regex findings.
 *
 * Two findings are considered duplicates if they share the same
 * ruleIdOrSection AND the same line number.
 */
export function deduplicateFindings(findings: ActionableFinding[]): ActionableFinding[] {
    const seen = new Set<string>();
    const result: ActionableFinding[] = [];

    for (const finding of findings) {
        const key = `${finding.ruleIdOrSection}::${finding.line}`;
        if (!seen.has(key)) {
            seen.add(key);
            result.push(finding);
        }
        // If a duplicate exists, prefer the one already in the result
        // (which is typically the regex finding that came first)
    }

    return result;
}

/**
 * Check whether a file needs chunking.
 */
export function needsChunking(code: string): boolean {
    return code.split('\n').length > MAX_LINES_PER_CHUNK;
}
