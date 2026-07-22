/**
 * Gemini AI Client for avvarre
 *
 * Wraps @google/generative-ai SDK to run the unified avvarre analysis.
 * Produces structured JSON meant for IDE agent consumption.
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { ActionableFinding, avvarreFileResult } from './types.js';
import { getSystemInstruction, buildUnifiedPrompt } from './prompts.js';
import { analyze } from '../analyzer/engine.js';
import type { Language, Severity } from '../types.js';
import type { IAiClient } from './client.js';
import { chunkCodeAST, adjustLineNumbers, deduplicateFindings, MAX_LINES_PER_CHUNK } from './chunker.js';
import { calculateScore, calculateGrade } from '../analyzer/scorer.js';

const DEFAULT_MODEL = 'gemini-2.0-flash';
const FALLBACK_MODEL = 'gemini-2.0-flash';

export interface GeminiConfig {
    apiKey: string;
    model?: string;
    temperature?: number;
    maxOutputTokens?: number;
    thinkingLevel?: string;
    useGoogleSearch?: boolean;
}

export class GeminiClient implements IAiClient {
    private ai: GoogleGenerativeAI;
    private modelName: string;
    private config: GeminiConfig;

    constructor(config: GeminiConfig) {
        if (!config.apiKey) {
            throw new Error(
                'GEMINI_API_KEY is required for deep analysis. ' +
                'Get one at https://aistudio.google.com/apikey'
            );
        }
        this.ai = new GoogleGenerativeAI(config.apiKey);
        this.modelName = config.model || DEFAULT_MODEL;
        this.config = config;
    }

    private getModelInstance(modelName: string, temp: number, tokens: number, language: Language): GenerativeModel {
        const generationConfig: any = {
            temperature: temp,
            maxOutputTokens: tokens,
            responseMimeType: 'application/json',
        };

        if (this.config.thinkingLevel) {
            // @ts-ignore - Some versions of the TS SDK don't have thinkingConfig typed yet
            generationConfig.thinkingConfig = {
                thinkingLevel: this.config.thinkingLevel,
            };
        }

        const tools: any[] = [];
        if (this.config.useGoogleSearch) {
            tools.push({
                googleSearch: {}
            });
        }

        return this.ai.getGenerativeModel({
            model: modelName,
            systemInstruction: getSystemInstruction(language),
            generationConfig,
            tools: tools.length > 0 ? tools : undefined,
        }, { apiVersion: 'v1alpha' });
    }

    /**
     * The unified code analysis method.
     * 1. Runs the fast Regex pattern matcher.
     * 2. Feeds Regex results + Code into Gemini.
     * 3. Gemini returns a structured JSON payload of actionable fixes.
     */
    async analyzeFile(
        code: string,
        language: Language,
        filename?: string,
    ): Promise<avvarreFileResult> {
        // Step 1: Layer 1 Regex Analysis
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
            modelUsed: this.modelName,
            tokensUsed: 0,
            regexViolationsFound: regexFindings.length,
            aiViolationsFound: 0,
        };

        // Step 2: Layer 2 AI Deep Review + Fix Suggestions (with AST chunking)
        const chunks = await chunkCodeAST(code, filename);
        const isChunked = chunks.length > 1;

        if (isChunked) {
            meta.chunked = true;
            meta.totalChunks = chunks.length;
        }

        try {
            let allAiFindings: ActionableFinding[] = [];

            for (const chunk of chunks) {
                // Build prompt for this chunk (includes relevant regex violations for context)
                const chunkViolations = patternResult.violations.filter(
                    (v: any) => v.line >= chunk.startLine && v.line <= chunk.endLine
                );
                const chunkPrompt = buildUnifiedPrompt(chunk.code, language, filename, chunkViolations);

                // Add chunk context to the prompt if chunked
                let fullPrompt = chunkPrompt;
                if (isChunked) {
                    fullPrompt = `[NOTE: This is chunk ${chunk.chunkIndex} of ${chunk.totalChunks} (lines ${chunk.startLine}-${chunk.endLine} of the original file). Line numbers in your output should be relative to THIS chunk starting at line 1.]\n\n${chunkPrompt}`;
                }

                const model = this.getModelInstance(this.modelName, 0.2, 8192, language);
                const result = await model.generateContent(fullPrompt);
                const response = result.response;
                const text = response.text();

                const parsed = this.parseJsonResponse<{
                    findings: Array<{
                        ruleIdOrSection: string;
                        category: string;
                        severity: string;
                        line: number;
                        issue: string;
                        actionableFix: string;
                        codeSnippet: string;
                        isRegexConfirmed: boolean;
                    }>;
                    summary: string;
                }>(text);

                const chunkAiFindings: ActionableFinding[] = (parsed.findings || []).map(f => ({
                    ruleIdOrSection: f.ruleIdOrSection || 'Unknown',
                    category: f.category || 'General',
                    severity: this.normalizeSeverity(f.severity),
                    line: typeof f.line === 'number' ? f.line : 0,
                    issue: f.issue || 'No description provided',
                    actionableFix: f.actionableFix || '',
                    codeSnippet: f.codeSnippet || '',
                    isRegexConfirmed: !!f.isRegexConfirmed,
                }));

                const adjusted = adjustLineNumbers(chunkAiFindings, chunk);
                allAiFindings.push(...adjusted);

                const usage = response.usageMetadata;
                meta.tokensUsed = (meta.tokensUsed || 0) + (usage?.totalTokenCount || 0);
            }

            const allFindings = deduplicateFindings([...regexFindings, ...allAiFindings]);
            meta.aiViolationsFound = allAiFindings.filter(f => !f.isRegexConfirmed).length;

            const totalLines = code.split('\n').length;
            const score = calculateScore(allFindings as any[], totalLines);
            const grade = calculateGrade(score);

            let userNote: string | undefined;
            if (isChunked) {
                userNote = `This file (${totalLines} lines) was split into ${chunks.length} chunks of ~${MAX_LINES_PER_CHUNK} lines each for AI analysis. Regex analysis covered the entire file. All line numbers are accurate to the original file.`;
            }

            return {
                filename: filename || 'unknown',
                score,
                grade,
                aiEnhanced: true,
                findings: allFindings,
                summary: `AI deep analysis completed. Found ${regexFindings.length} regex + ${meta.aiViolationsFound} AI violations.`,
                userNote,
                meta
            };

        } catch (error) {
            // Fast fail fallback attempt
            if (this.modelName !== FALLBACK_MODEL) {
                console.error(`Primary model (${this.modelName}) failed with error: ${this.getErrorMessage(error)}. Trying fallback (${FALLBACK_MODEL})...`);
                this.modelName = FALLBACK_MODEL;
                return this.analyzeFile(code, language, filename);
            }

            // Graceful degradation: If AI completely fails, return at least the regex pattern fixes.
            return {
                filename: filename || 'unknown',
                score: patternResult.score,
                grade: patternResult.grade,
                aiEnhanced: false,
                findings: regexFindings,
                summary: `AI deep analysis failed: ${this.getErrorMessage(error)}. Showing Regex-only results.`,
                meta
            };
        }
    }

    private parseJsonResponse<T>(text: string): T {
        let jsonText = text.trim();
        if (jsonText.startsWith('```json')) {
            jsonText = jsonText.slice(7);
        } else if (jsonText.startsWith('```')) {
            jsonText = jsonText.slice(3);
        }
        if (jsonText.endsWith('```')) {
            jsonText = jsonText.slice(0, -3);
        }
        jsonText = jsonText.trim();
        try {
            return JSON.parse(jsonText) as T;
        } catch (parseError) {
            throw new Error(`Failed to parse AI response as JSON. Raw response: ${text.slice(0, 500)}`);
        }
    }

    private normalizeSeverity(severity: string): Severity {
        const s = (severity || '').toLowerCase().trim();
        if (['critical', 'high', 'medium', 'low'].includes(s)) {
            return s as Severity;
        }
        return 'medium';
    }

    private getErrorMessage(error: unknown): string {
        if (error instanceof Error) return error.message;
        if (typeof error === 'string') return error;
        return String(error);
    }
}

export function createGeminiClientFromEnv(): GeminiClient | null {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey || apiKey === 'your-gemini-api-key-here') {
        return null;
    }

    return new GeminiClient({
        apiKey,
        model: process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL,
        thinkingLevel: process.env.GEMINI_THINKING_LEVEL?.trim() || undefined,
        useGoogleSearch: process.env.GEMINI_USE_GOOGLE_SEARCH?.trim() === 'true',
    });
}
