/**
 * Core type definitions for avvarre MCP Server.
 *
 * These types define the contract for the entire analysis system.
 * Every language module exports rules conforming to these interfaces.
 */

/** Severity levels for violations, from most to least severe. */
export type Severity = 'critical' | 'high' | 'medium' | 'low';

/** Supported languages. Expand this union as new languages are added. */
export type Language = 'python' | 'javascript' | 'typescript' | 'java' | 'go' | 'cpp' | 'kotlin' | 'shell' | 'swift' | 'objc' | 'csharp' | 'dart' | 'r' | 'html' | 'css' | 'markdown' | 'json' | 'xml' | 'vimscript' | 'lisp' | 'angular';

/**
 * A single analysis rule.
 *
 * Each rule is a self-contained check that scans code lines
 * and returns any violations found. Rules are grouped by language.
 */
export interface Rule {
    /** Unique identifier, e.g. "PY-EXC-01" */
    id: string;

    /** Short human-readable name, e.g. "No bare except" */
    name: string;

    /** Full description of what the rule checks and why */
    description: string;

    /** How severe a violation of this rule is */
    severity: Severity;

    /** The Google Style Guide section, e.g. "§2.4.4" */
    guideSection: string;

    /** Full URL to the relevant section of the guide */
    guideUrl: string;

    /**
     * The check function. Takes an array of code lines and an optional
     * filename, and returns all violations found.
     * Optionally takes an array of clean lines (comments/strings stripped) for regex-safe matching.
     */
    check: (lines: string[], filename?: string, cleanLines?: string[]) => Violation[];
}

/**
 * A single violation found in the code.
 */
export interface Violation {
    /** The rule ID that was violated, e.g. "PY-EXC-01" */
    ruleId: string;

    /** Short rule name */
    ruleName: string;

    /** Severity of this violation */
    severity: Severity;

    /** 1-indexed line number where the violation was found */
    line: number;

    /** Optional 1-indexed column number */
    column?: number;

    /** Human-readable message explaining the violation */
    message: string;

    /** Suggestion for how to fix the violation */
    suggestion: string;

    /** URL to the Google Style Guide section for this rule */
    guideUrl: string;

    /** The offending line of code */
    codeSnippet: string;
}

/**
 * Category-level score breakdown.
 */
export interface CategoryScore {
    /** Category name, e.g. "Imports", "Exceptions", "Naming" */
    category: string;

    /** Score 0-100 for this category */
    score: number;

    /** Number of violations in this category */
    violationCount: number;
}

/**
 * The complete result of analyzing a piece of code.
 */
export interface AnalysisResult {
    /** Language that was analyzed */
    language: Language;

    /** Overall score 0-100 */
    score: number;

    /** Letter grade: A, B, C, D, or F */
    grade: string;

    /** Total lines of code analyzed */
    totalLines: number;

    /** All violations found */
    violations: Violation[];

    /** Score breakdown by category */
    categoryScores: CategoryScore[];

    /** Human-readable summary of the analysis */
    summary: string;
}

/**
 * Penalty points per severity level.
 */
export const SEVERITY_PENALTIES: Record<Severity, number> = {
    critical: 15,
    high: 10,
    medium: 5,
    low: 2,
};
