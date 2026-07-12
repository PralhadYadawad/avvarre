/**
 * Universal AI Client for avvarre
 *
 * Works with ANY OpenAI-compatible API provider by accepting a configurable baseURL.
 * This includes: OpenAI, Groq, Together AI, Fireworks, Mistral, Ollama, LM Studio, etc.
 *
 * Uses the official `openai` npm package which supports custom baseURL out of the box.
 */

import OpenAI from 'openai';
import type { IAiClient } from './client.js';
import { getSystemInstruction, buildUnifiedPrompt } from './prompts.js';
import { analyze } from '../analyzer/engine.js';
import type { Language, Severity } from '../types.js';
import { calculateScore, calculateGrade } from '../analyzer/scorer.js';
import type { ActionableFinding, avvarreFileResult } from './types.js';
import { chunkCode, adjustLineNumbers, deduplicateFindings, MAX_LINES_PER_CHUNK } from './chunker.js';

export interface UniversalConfig {
    /** The base URL of the OpenAI-compatible API (e.g., https://api.groq.com/openai/v1) */
    baseURL: string;
    /** The API key for authentication */
    apiKey: string;
    /** The model identifier (e.g., openai/gpt-oss-120b, gpt-4o, llama3-70b-8192) */
    model: string;
}

export class UniversalAiClient implements IAiClient {
    private client: OpenAI;
    private model: string;
    private baseURL: string;

    constructor(config: UniversalConfig) {
        if (!config.apiKey) {
            throw new Error('AI_API_KEY is required for AI analysis.');
        }
        if (!config.baseURL) {
            throw new Error('AI_BASE_URL is required. Example: https://api.groq.com/openai/v1');
        }

        this.client = new OpenAI({
            baseURL: config.baseURL,
            apiKey: config.apiKey,
        });
        this.model = config.model;
        this.baseURL = config.baseURL;
    }

    /**
     * Unified code analysis: Regex (instant) + AI deep review (via any OpenAI-compatible API).
     * Automatically chunks large files to avoid context window limits.
     */
    async analyzeFile(
        code: string,
        language: Language,
        filename?: string,
    ): Promise<avvarreFileResult> {
        // ── Step 1: Run the fast, local Regex pattern matcher on the FULL file ──
        const patternResult = analyze(code, language);

        const regexFindings: ActionableFinding[] = patternResult.violations.map((v: any) => ({
            ruleIdOrSection: v.ruleId,
            category: "Regex Pattern Match",
            severity: v.severity,
            line: v.line,
            issue: v.message,
            actionableFix: v.suggestion,
            codeSnippet: v.codeSnippet,
            isRegexConfirmed: true,
        }));

        const meta: avvarreFileResult['meta'] = {
            modelUsed: this.model,
            tokensUsed: 0,
            regexViolationsFound: regexFindings.length,
            aiViolationsFound: 0,
        };

        // ── Step 2: AI Deep Review (with chunking if needed) ──────────
        const chunks = chunkCode(code);
        const isChunked = chunks.length > 1;

        if (isChunked) {
            meta.chunked = true;
            meta.totalChunks = chunks.length;
        }

        try {
            let allAiFindings: ActionableFinding[] = [];

            for (const chunk of chunks) {
                // Build prompt for this chunk (the prompt includes relevant regex violations for context)
                const chunkViolations = patternResult.violations.filter(
                    (v: any) => v.line >= chunk.startLine && v.line <= chunk.endLine
                );
                const chunkPrompt = buildUnifiedPrompt(chunk.code, language, filename, chunkViolations);

                // Add chunk context to the prompt if chunked
                let fullPrompt = chunkPrompt;
                if (isChunked) {
                    fullPrompt = `[NOTE: This is chunk ${chunk.chunkIndex} of ${chunk.totalChunks} (lines ${chunk.startLine}-${chunk.endLine} of the original file). Line numbers in your output should be relative to THIS chunk starting at line 1.]\n\n${chunkPrompt}`;
                }

                const completion = await this.callWithJsonFallback(fullPrompt, language);

                const content = completion.choices[0]?.message?.content || "";
                meta.tokensUsed = (meta.tokensUsed || 0) + (completion.usage?.total_tokens || 0);

                const parsed = this.parseJsonResponse<{ findings: any[]; summary?: string }>(content);

                const chunkAiFindings: ActionableFinding[] = (parsed.findings || []).map(f => ({
                    ruleIdOrSection: f.ruleIdOrSection || "Unknown",
                    category: f.category || "AI Deep Finding",
                    severity: this.normalizeSeverity(f.severity),
                    line: typeof f.line === 'number' ? f.line : 0,
                    issue: f.issue || "Issue format error",
                    actionableFix: f.actionableFix || "",
                    codeSnippet: f.codeSnippet || "",
                    isRegexConfirmed: !!f.isRegexConfirmed,
                }));

                // Adjust line numbers to match the original file
                const adjusted = adjustLineNumbers(chunkAiFindings, chunk);
                allAiFindings.push(...adjusted);
            }

            // Deduplicate findings (overlap zones + AI duplicating regex findings)
            const allFindings = deduplicateFindings([...regexFindings, ...allAiFindings]);
            meta.aiViolationsFound = allAiFindings.filter(f => !f.isRegexConfirmed).length;

            const totalLines = code.split('\n').length;
            const scorePayload = this.recalculateScore(allFindings, totalLines);

            const providerName = this.extractProviderName();

            let userNote: string | undefined;
            if (isChunked) {
                userNote = `This file (${totalLines} lines) was split into ${chunks.length} chunks of ~${MAX_LINES_PER_CHUNK} lines each for AI analysis. Regex analysis covered the entire file. All line numbers are accurate to the original file.`;
            }

            return {
                filename: filename || 'unknown',
                score: scorePayload.score,
                grade: scorePayload.grade,
                aiEnhanced: true,
                findings: allFindings,
                summary: `Analyzed with ${providerName} (${this.model}). Found ${regexFindings.length} regex + ${meta.aiViolationsFound} AI violations.`,
                userNote,
                meta,
            };

        } catch (error) {
            const providerName = this.extractProviderName();
            console.error(`[avvarre] ${providerName} model (${this.model}) failed: ${this.getErrorMessage(error)}`);

            // ── Graceful degradation: return regex-only results ────────
            return {
                filename: filename || 'unknown',
                score: patternResult.score,
                grade: patternResult.grade,
                aiEnhanced: false,
                findings: regexFindings,
                summary: `AI deep analysis failed (${providerName}): ${this.getErrorMessage(error)}. Showing Regex-only results.`,
                meta,
            };
        }
    }

    // ── Private helpers ───────────────────────────────────────────────

    /**
     * Try the API call with JSON mode first. If the provider returns a 400
     * (model doesn't support response_format), retry without it.
     * This makes the client truly universal across all models and providers.
     */
    private async callWithJsonFallback(userPrompt: string, language: Language) {
        const baseParams = {
            model: this.model,
            messages: [
                { role: "system" as const, content: getSystemInstruction(language) },
                { role: "user" as const, content: userPrompt },
            ],
            temperature: 0.1,
            max_tokens: 16384,
            top_p: 1,
            stream: false as const,
        };

        try {
            // Attempt 1: with JSON mode (preferred — guaranteed valid JSON)
            return await this.client.chat.completions.create({
                ...baseParams,
                response_format: { type: "json_object" },
            });
        } catch (jsonError: any) {
            // If the error is a 400 (bad request), the model likely doesn't support JSON mode.
            // Retry without response_format and rely on the system prompt to produce JSON.
            const status = jsonError?.status || jsonError?.statusCode || 0;
            if (status === 400) {
                console.warn(`[avvarre] JSON mode not supported by this model/provider. Retrying without response_format...`);
                return await this.client.chat.completions.create(baseParams);
            }
            // For any other error (401, 429, 500, network), throw as-is
            throw jsonError;
        }
    }

    /** Extract a human-readable provider name from the base URL */
    private extractProviderName(): string {
        try {
            const hostname = new URL(this.baseURL).hostname;
            // api.groq.com → Groq, api.openai.com → OpenAI, api.together.xyz → Together
            const parts = hostname.split('.');
            if (parts.length >= 2) {
                const name = parts[parts.length - 2];
                return name.charAt(0).toUpperCase() + name.slice(1);
            }
            return hostname;
        } catch {
            return 'Unknown Provider';
        }
    }

    private recalculateScore(allViolations: { severity: Severity }[], totalLines: number) {
        const score = calculateScore(allViolations as any[], totalLines);
        const grade = calculateGrade(score);
        return { score, grade };
    }

    private parseJsonResponse<T>(text: string): T {
        let jsonText = text.trim();

        // Strip markdown code fences if the model wraps its output
        if (jsonText.startsWith('```json')) jsonText = jsonText.slice(7);
        else if (jsonText.startsWith('```')) jsonText = jsonText.slice(3);
        if (jsonText.endsWith('```')) jsonText = jsonText.slice(0, -3);
        jsonText = jsonText.trim();

        try {
            return JSON.parse(jsonText) as T;
        } catch {
            throw new Error(
                `Failed to parse AI response as JSON. This usually indicates the output was ` +
                `truncated due to token limits. Last 200 chars: ${text.slice(-200)}`
            );
        }
    }

    private normalizeSeverity(severity: string): Severity {
        const s = (severity || '').toLowerCase().trim();
        if (['critical', 'high', 'medium', 'low'].includes(s)) return s as Severity;
        return 'medium';
    }

    private getErrorMessage(error: unknown): string {
        if (error instanceof Error) return error.message;
        if (typeof error === 'string') return error;
        return String(error);
    }
}

/**
 * Factory: create a UniversalAiClient from environment variables.
 * Returns null if the required variables are not set.
 */
export function createUniversalClientFromEnv(): UniversalAiClient | null {
    const baseURL = process.env.AI_BASE_URL?.trim();
    const apiKey = process.env.AI_API_KEY?.trim();
    const model = process.env.AI_MODEL?.trim();

    if (!baseURL || !apiKey || !model) {
        return null;
    }

    // Ignore placeholder values
    if (apiKey === 'your-api-key' || apiKey === 'your-api-key-here') {
        return null;
    }

    return new UniversalAiClient({ baseURL, apiKey, model });
}
