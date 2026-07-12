/**
 * AI Client Factory
 *
 * Provides the IAiClient interface and a factory function that selects
 * the correct AI backend based on environment variables.
 *
 * Provider selection logic:
 *   1. If AI_PROVIDER=gemini → GeminiClient (uses Google's own SDK)
 *   2. If AI_BASE_URL is set → UniversalAiClient (any OpenAI-compatible API)
 *   3. Otherwise → null (regex-only mode, no AI)
 */

import type { Language } from '../types.js';
import type { avvarreFileResult } from './types.js';
import { createGeminiClientFromEnv } from './gemini.js';
import { createUniversalClientFromEnv } from './universal.js';

/**
 * Common interface for all AI backends.
 * Both GeminiClient and UniversalAiClient implement this.
 */
export interface IAiClient {
    analyzeFile(
        code: string,
        language: Language,
        filename?: string,
    ): Promise<avvarreFileResult>;
}

/**
 * Factory: instantiate the correct AI client based on environment variables.
 *
 * Priority:
 *   1. AI_PROVIDER=gemini → uses @google/generative-ai SDK
 *   2. AI_BASE_URL + AI_API_KEY + AI_MODEL → uses openai SDK with custom baseURL
 *   3. No config → returns null (graceful regex-only mode)
 */
export function createAiClientFromEnv(): IAiClient | null {
    const provider = (process.env.AI_PROVIDER || '').trim().toLowerCase();

    // Explicit Gemini selection
    if (provider === 'gemini') {
        return createGeminiClientFromEnv();
    }

    // Universal: any OpenAI-compatible provider (Groq, OpenAI, Together, etc.)
    const universalClient = createUniversalClientFromEnv();
    if (universalClient) {
        return universalClient;
    }

    // Fallback: try Gemini if GEMINI_API_KEY is set (backward compatibility)
    const geminiClient = createGeminiClientFromEnv();
    if (geminiClient) {
        return geminiClient;
    }

    // No AI configured — regex-only mode
    return null;
}
