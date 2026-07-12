/**
 * Analysis Engine — the language-agnostic orchestrator.
 *
 * Takes code + language, picks the right rule module,
 * runs all rules, and aggregates results via the scorer.
 */

import { Rule, Language, AnalysisResult, Violation } from '../types.js';
import { calculateScore, calculateGrade, calculateCategoryScores, generateSummary } from './scorer.js';
import { pythonRules, getCleanLines as getPythonCleanLines } from './rules/python.js';
import { javascriptRules, getCleanLines as getJsCleanLines } from './rules/javascript.js';
import { typescriptRules } from './rules/typescript.js';
import { javaRules, getCleanLines as getJavaCleanLines } from './rules/java.js';
import { goRules, getCleanLines as getGoCleanLines } from './rules/go.js';
import { cppRules, getCleanLines as getCppCleanLines } from './rules/cpp.js';
import { kotlinRules, getCleanLines as getKotlinCleanLines } from './rules/kotlin.js';
import { shellRules, getShellCleanLines } from './rules/shell.js';
import { swiftRules, getCleanLines as getSwiftCleanLines } from './rules/swift.js';
import { objcRules, getCleanLines as getObjCCleanLines } from './rules/objc.js';
import { csharpRules, getCleanLines as getCSharpCleanLines } from './rules/csharp.js';
import { dartRules, getCleanLines as getDartCleanLines } from './rules/dart.js';
import { rRules, getCleanLines as getRCleanLines } from './rules/r.js';
import { htmlRules, getHTMLCleanLines } from './rules/html.js';
import { markdownRules, getMarkdownCleanLines } from './rules/markdown.js';
import { jsonRules } from './rules/json.js';
import { xmlRules, getCleanLines as getXmlCleanLines } from './rules/xml.js';
import { vimscriptRules, getCleanLines as getVimCleanLines } from './rules/vimscript.js';
import { lispRules } from './rules/lisp.js';
import { angularjsRules, getCleanLines as getAngularCleanLines } from './rules/angularjs.js';

/** Registry of rules per language. Add new languages here. */
const LANGUAGE_RULES: Record<Language, Rule[]> = {
    python: pythonRules,
    javascript: javascriptRules,
    typescript: typescriptRules, // JS rules + TS-specific rules
    java: javaRules,
    go: goRules,
    cpp: cppRules,
    kotlin: kotlinRules,
    shell: shellRules,
    swift: swiftRules,
    objc: objcRules,
    csharp: csharpRules,
    dart: dartRules,
    r: rRules,
    html: htmlRules,
    css: htmlRules,
    markdown: markdownRules,
    json: jsonRules,
    xml: xmlRules,
    vimscript: vimscriptRules,
    lisp: lispRules,
    angular: angularjsRules
};

const TOKENIZERS: Record<string, (code: string[]) => string[]> = {
    python: getPythonCleanLines,
    javascript: getJsCleanLines,
    typescript: getJsCleanLines,
    java: getJavaCleanLines,
    go: getGoCleanLines,
    cpp: getCppCleanLines,
    kotlin: getKotlinCleanLines,
    shell: getShellCleanLines,
    swift: getSwiftCleanLines,
    objc: getObjCCleanLines,
    csharp: getCSharpCleanLines,
    dart: getDartCleanLines,
    r: getRCleanLines,
    html: getHTMLCleanLines,
    css: getHTMLCleanLines,
    markdown: getMarkdownCleanLines,
    angular: getAngularCleanLines,
    xml: getXmlCleanLines,
    vimscript: getVimCleanLines,
};

/**
 * Analyze code against Google Style Guide rules for the given language.
 *
 * @param code - The source code to analyze
 * @param language - The language to analyze for
 * @returns Complete analysis result with score, grade, violations, and summary
 */
export function analyze(code: string, language: Language, filename?: string): AnalysisResult {
    const rules = LANGUAGE_RULES[language];
    if (!rules) {
        throw new Error(`Unsupported language: ${language}. Supported: ${Object.keys(LANGUAGE_RULES).join(', ')}`);
    }

    const lines = code.split('\n');
    const violations: Violation[] = [];

    // Language-specific pre-processing (optional)
    let cleanLines: string[] | undefined;
    const getCleanLinesFn = TOKENIZERS[language];
    if (getCleanLinesFn) {
        cleanLines = getCleanLinesFn(lines);
    }

    // Run every rule against the code
    for (const rule of rules) {
        const ruleViolations = rule.check(lines, filename, cleanLines);
        violations.push(...ruleViolations);
    }

    // ── Universal Rule: File Size Guard (UNI-SIZE-01) ──
    const MAX_FILE_LINES = 1500;
    if (lines.length > MAX_FILE_LINES) {
        violations.push({
            ruleId: 'UNI-SIZE-01',
            ruleName: 'File size limit',
            severity: 'low',
            line: 1,
            message: `This file has ${lines.length} lines, exceeding the recommended limit of ${MAX_FILE_LINES}. Large files are harder for AI agents to comprehend and maintain.`,
            suggestion: 'Consider splitting this file into smaller, focused modules. Configure the limit in `.avvarre/conventions.md` if needed.',
            codeSnippet: lines[0] || '',
            guideUrl: '',
        });
    }

    violations.sort((a, b) => a.line - b.line);

    // Calculate scores with length normalization
    const score = calculateScore(violations, lines.length);
    const grade = calculateGrade(score);
    const categoryScores = calculateCategoryScores(violations, lines.length);
    const summary = generateSummary(score, grade, violations, lines.length, language);

    return {
        language,
        score,
        grade,
        totalLines: lines.length,
        violations,
        categoryScores,
        summary,
    };
}

/**
 * List all rules for a given language (or all languages if none specified).
 */
export function listRules(language?: Language): Rule[] {
    if (language) {
        return LANGUAGE_RULES[language] || [];
    }
    return Object.values(LANGUAGE_RULES).flat();
}

/**
 * Get supported languages.
 */
export function getSupportedLanguages(): Language[] {
    return Object.keys(LANGUAGE_RULES) as Language[];
}
