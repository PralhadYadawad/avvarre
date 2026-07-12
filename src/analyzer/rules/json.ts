import { Rule, Violation } from '../../types.js';

/**
 * JSON rules based on the Google JSON Style Guide.
 * https://google.github.io/styleguide/jsoncstyleguide.xml
 *
 * JSON has no comments by spec, so there is no getCleanLines tokenizer.
 * String values can contain patterns that look like keys; where practical,
 * rules use a lightweight nesting-aware key extractor to reduce false positives.
 */

const GUIDE_BASE = 'https://google.github.io/styleguide/jsoncstyleguide.xml';

// ── helpers ──────────────────────────────────────────────────────────

/**
 * Extract top-level-ish JSON property keys from raw lines.
 * Returns an array of { key, lineIndex } objects.
 * Uses a simple brace/bracket depth tracker to avoid matching keys
 * that appear inside string *values* on the same line.
 */
interface KeyInfo {
    key: string;
    lineIndex: number;
    depth: number;
}

function extractKeys(lines: string[]): KeyInfo[] {
    const results: KeyInfo[] = [];
    let depth = 0;
    const keyRegex = /^(\s*)"([^"]+)"\s*:/;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Record depth at the start of the line (before any braces on this line)
        const depthAtLineStart = depth;
        // Strip string values to avoid counting braces inside strings
        const stripped = line.replace(/"(?:[^"\\]|\\.)*"/g, '""');
        for (const ch of stripped) {
            if (ch === '{' || ch === '[') depth++;
            if (ch === '}' || ch === ']') depth--;
        }
        const m = line.match(keyRegex);
        if (m) {
            // The key sits at the depth after any opening brace on the same line
            // but for our purposes, the "nesting level" of the key is best captured
            // by how many braces are open *including* any { preceding the key on this line.
            // For `"error": {` the key "error" is at depthAtLineStart + 1 (inside root).
            // For `  "code": 404` inside error, depth is depthAtLineStart which is 2 (root { + error {).
            // We use depthAtLineStart as the key's container depth.
            results.push({ key: m[2], lineIndex: i, depth: depthAtLineStart });
        }
    }
    return results;
}

/**
 * Reserved JavaScript keywords from ECMAScript 5th Edition
 * (as listed in the Google JSON Style Guide Appendix A).
 */
const RESERVED_JS_KEYWORDS = new Set([
    'abstract',
    'boolean', 'break', 'byte',
    'case', 'catch', 'char', 'class', 'const', 'continue',
    'debugger', 'default', 'delete', 'do', 'double',
    'else', 'enum', 'export', 'extends',
    'false', 'final', 'finally', 'float', 'for', 'function',
    'goto',
    'if', 'implements', 'import', 'in', 'instanceof', 'int', 'interface',
    'let', 'long',
    'native', 'new', 'null',
    'package', 'private', 'protected', 'public',
    'return',
    'short', 'static', 'super', 'switch', 'synchronized',
    'this', 'throw', 'throws', 'transient', 'true', 'try', 'typeof',
    'var', 'volatile', 'void',
    'while', 'with',
    'yield',
]);

// ── rules ────────────────────────────────────────────────────────────

export const jsonRules: Rule[] = [

    // ─── Property Name Guidelines ────────────────────────────────────

    {
        id: 'JSON-NAME-01',
        name: 'camelCase Property Names',
        description: 'Property names must be camel-cased, ASCII strings. The first character must be a letter, an underscore (_) or a dollar sign ($).',
        severity: 'high',
        guideSection: 'Property Name Format',
        guideUrl: `${GUIDE_BASE}#Property_Name_Format`,
        check: (lines: string[]): Violation[] => {
            const violations: Violation[] = [];
            const validNameRegex = /^[a-z_$][a-zA-Z0-9_$]*$/;

            for (const { key, lineIndex } of extractKeys(lines)) {
                if (!validNameRegex.test(key)) {
                    violations.push({
                        ruleId: 'JSON-NAME-01',
                        ruleName: 'camelCase Property Names',
                        severity: 'high',
                        line: lineIndex + 1,
                        message: `Property name "${key}" is not lowerCamelCase or contains invalid characters.`,
                        suggestion: `Rename "${key}" to use lowerCamelCase starting with a letter, _, or $.`,
                        codeSnippet: lines[lineIndex].trim(),
                        guideUrl: `${GUIDE_BASE}#Property_Name_Format`,
                    });
                }
            }
            return violations;
        },
    },

    {
        id: 'JSON-NAME-02',
        name: 'No Reserved JS Keywords',
        description: 'Reserved JavaScript keywords should be avoided for property names to allow dot-notation access.',
        severity: 'medium',
        guideSection: 'Property Name Format',
        guideUrl: `${GUIDE_BASE}#Property_Name_Format`,
        check: (lines: string[]): Violation[] => {
            const violations: Violation[] = [];

            for (const { key, lineIndex } of extractKeys(lines)) {
                if (RESERVED_JS_KEYWORDS.has(key)) {
                    violations.push({
                        ruleId: 'JSON-NAME-02',
                        ruleName: 'No Reserved JS Keywords',
                        severity: 'medium',
                        line: lineIndex + 1,
                        message: `Property name "${key}" is a reserved JavaScript keyword.`,
                        suggestion: `Choose a different property name that does not conflict with JavaScript keywords.`,
                        codeSnippet: lines[lineIndex].trim(),
                        guideUrl: `${GUIDE_BASE}#Property_Name_Format`,
                    });
                }
            }
            return violations;
        },
    },

    // ─── JSON Structure ──────────────────────────────────────────────

    {
        id: 'JSON-STR-01',
        name: 'Data or Error',
        description: 'A JSON response should contain either a data object or an error object, but not both.',
        severity: 'high',
        guideSection: 'JSON Structure & Reserved Property Names',
        guideUrl: `${GUIDE_BASE}#JSON_Structure__Reserved_Property_Names`,
        check: (lines: string[]): Violation[] => {
            const violations: Violation[] = [];
            let dataLine = -1;
            let errorLine = -1;

            // Only match top-level "data" and "error" keys (depth 1 inside root object)
            for (const { key, lineIndex, depth } of extractKeys(lines)) {
                if (key === 'data' && depth <= 2 && dataLine === -1) {
                    dataLine = lineIndex;
                }
                if (key === 'error' && depth <= 2 && errorLine === -1) {
                    errorLine = lineIndex;
                }
            }

            if (dataLine !== -1 && errorLine !== -1) {
                const reportLine = Math.max(dataLine, errorLine);
                violations.push({
                    ruleId: 'JSON-STR-01',
                    ruleName: 'Data or Error',
                    severity: 'high',
                    line: reportLine + 1,
                    message: `JSON contains both "data" (line ${dataLine + 1}) and "error" (line ${errorLine + 1}) properties. They should be mutually exclusive.`,
                    suggestion: `Return either a data object for success or an error object for failure, never both.`,
                    codeSnippet: lines[reportLine].trim(),
                    guideUrl: `${GUIDE_BASE}#JSON_Structure__Reserved_Property_Names`,
                });
            }
            return violations;
        },
    },

    // ─── General Guidelines ──────────────────────────────────────────

    {
        id: 'JSON-FMT-01',
        name: 'No Comments in JSON',
        description: 'JSON objects must not contain comments. Comments are not part of the JSON specification.',
        severity: 'critical',
        guideSection: 'General Guidelines > Comments',
        guideUrl: `${GUIDE_BASE}#Comments`,
        check: (lines: string[]): Violation[] => {
            const violations: Violation[] = [];
            // Detect // and /* style comments outside of string values.
            // A line whose non-string content contains // or /* is flagged.
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                // Strip string values to avoid false positives on URLs etc.
                const stripped = line.replace(/"(?:[^"\\]|\\.)*"/g, '""');
                if (/\/\/|\/\*/.test(stripped)) {
                    violations.push({
                        ruleId: 'JSON-FMT-01',
                        ruleName: 'No Comments in JSON',
                        severity: 'critical',
                        line: i + 1,
                        message: `Comments are not allowed in JSON.`,
                        suggestion: `Remove the comment. If documentation is needed, use a separate file or a "_comment" property (discouraged).`,
                        codeSnippet: lines[i].trim(),
                        guideUrl: `${GUIDE_BASE}#Comments`,
                    });
                }
            }
            return violations;
        },
    },

    {
        id: 'JSON-FMT-02',
        name: 'Double Quotes Required',
        description: 'All property names and string values must use double quotes. Single quotes are not valid JSON.',
        severity: 'critical',
        guideSection: 'General Guidelines > Double Quotes',
        guideUrl: `${GUIDE_BASE}#Double_Quotes`,
        check: (lines: string[]): Violation[] => {
            const violations: Violation[] = [];
            // Detect single-quoted keys or values: `'key':` or `: 'value'`
            // This catches common JSON5 / relaxed-JSON mistakes.
            const singleQuoteKey = /^\s*'[^']*'\s*:/;
            const singleQuoteValue = /:\s*'[^']*'\s*[,}\]]*\s*$/;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (singleQuoteKey.test(line) || singleQuoteValue.test(line)) {
                    violations.push({
                        ruleId: 'JSON-FMT-02',
                        ruleName: 'Double Quotes Required',
                        severity: 'critical',
                        line: i + 1,
                        message: `Single quotes detected. JSON requires double quotes for property names and string values.`,
                        suggestion: `Replace single quotes with double quotes.`,
                        codeSnippet: lines[i].trim(),
                        guideUrl: `${GUIDE_BASE}#Double_Quotes`,
                    });
                }
            }
            return violations;
        },
    },

    // ─── Property Value Guidelines ───────────────────────────────────

    {
        id: 'JSON-VAL-01',
        name: 'No Null Property Values',
        description: 'Consider removing properties with null values unless there is a strong semantic reason for their existence.',
        severity: 'low',
        guideSection: 'Property Value Guidelines > Empty/Null Property Values',
        guideUrl: `${GUIDE_BASE}#Empty/Null_Property_Values`,
        check: (lines: string[]): Violation[] => {
            const violations: Violation[] = [];
            const nullValueRegex = /^\s*"[^"]+"\s*:\s*null\s*[,}]?\s*$/;

            for (let i = 0; i < lines.length; i++) {
                if (nullValueRegex.test(lines[i])) {
                    violations.push({
                        ruleId: 'JSON-VAL-01',
                        ruleName: 'No Null Property Values',
                        severity: 'low',
                        line: i + 1,
                        message: `Property has a null value. Consider omitting the property entirely.`,
                        suggestion: `Remove this property if it is optional, or provide a meaningful default value.`,
                        codeSnippet: lines[i].trim(),
                        guideUrl: `${GUIDE_BASE}#Empty/Null_Property_Values`,
                    });
                }
            }
            return violations;
        },
    },

    {
        id: 'JSON-VAL-02',
        name: 'Empty String Values',
        description: 'Consider removing properties with empty string values unless there is a strong semantic reason.',
        severity: 'low',
        guideSection: 'Property Value Guidelines > Empty/Null Property Values',
        guideUrl: `${GUIDE_BASE}#Empty/Null_Property_Values`,
        check: (lines: string[]): Violation[] => {
            const violations: Violation[] = [];
            const emptyStringRegex = /^\s*"[^"]+"\s*:\s*""\s*[,}]?\s*$/;

            for (let i = 0; i < lines.length; i++) {
                if (emptyStringRegex.test(lines[i])) {
                    violations.push({
                        ruleId: 'JSON-VAL-02',
                        ruleName: 'Empty String Values',
                        severity: 'low',
                        line: i + 1,
                        message: `Property has an empty string value. Consider omitting the property if it is optional.`,
                        suggestion: `Remove this property if it carries no meaningful information.`,
                        codeSnippet: lines[i].trim(),
                        guideUrl: `${GUIDE_BASE}#Empty/Null_Property_Values`,
                    });
                }
            }
            return violations;
        },
    },

    // ─── Property Ordering ───────────────────────────────────────────

    {
        id: 'JSON-ORD-01',
        name: 'Kind Property Should Be First',
        description: 'When present, the "kind" property should be the first property in its parent object for efficient parsing.',
        severity: 'medium',
        guideSection: 'Property Ordering > Kind Property',
        guideUrl: `${GUIDE_BASE}#Kind_Property`,
        check: (lines: string[]): Violation[] => {
            const violations: Violation[] = [];
            const keys = extractKeys(lines);

            // For each "kind" key, check if a sibling at the same depth appears before it
            for (let k = 0; k < keys.length; k++) {
                if (keys[k].key !== 'kind') continue;
                const kindDepth = keys[k].depth;
                // Look backward for a sibling at the same depth
                let hasPriorSibling = false;
                for (let j = k - 1; j >= 0; j--) {
                    if (keys[j].depth === kindDepth) {
                        hasPriorSibling = true;
                        break;
                    }
                    if (keys[j].depth < kindDepth) break; // left the parent scope
                }
                if (hasPriorSibling) {
                    violations.push({
                        ruleId: 'JSON-ORD-01',
                        ruleName: 'Kind Property Should Be First',
                        severity: 'medium',
                        line: keys[k].lineIndex + 1,
                        message: `The "kind" property should be the first property in its parent object.`,
                        suggestion: `Move "kind" to be the first property in this object for efficient pull-parser consumption.`,
                        codeSnippet: lines[keys[k].lineIndex].trim(),
                        guideUrl: `${GUIDE_BASE}#Kind_Property`,
                    });
                }
            }
            return violations;
        },
    },

    {
        id: 'JSON-ORD-02',
        name: 'Items Property Should Be Last',
        description: 'The "items" array should be the last property in the "data" object so metadata is parsed first.',
        severity: 'medium',
        guideSection: 'Property Ordering > Items Property',
        guideUrl: `${GUIDE_BASE}#Items_Property`,
        check: (lines: string[]): Violation[] => {
            const violations: Violation[] = [];
            // Find "items" key and check if any sibling keys follow it at the same depth
            const keys = extractKeys(lines);
            let itemsIdx = -1;
            let itemsDepth = -1;

            for (let k = 0; k < keys.length; k++) {
                if (keys[k].key === 'items') {
                    itemsIdx = k;
                    itemsDepth = keys[k].depth;
                }
            }

            if (itemsIdx !== -1) {
                // Check if any sibling key at same depth follows
                for (let k = itemsIdx + 1; k < keys.length; k++) {
                    if (keys[k].depth === itemsDepth) {
                        violations.push({
                            ruleId: 'JSON-ORD-02',
                            ruleName: 'Items Property Should Be Last',
                            severity: 'medium',
                            line: keys[itemsIdx].lineIndex + 1,
                            message: `The "items" property should be the last property in the "data" object, but "${keys[k].key}" follows it.`,
                            suggestion: `Move "items" to be the last property in "data" so collection metadata is parsed first.`,
                            codeSnippet: lines[keys[itemsIdx].lineIndex].trim(),
                            guideUrl: `${GUIDE_BASE}#Items_Property`,
                        });
                        break; // one violation is enough
                    }
                }
            }
            return violations;
        },
    },

    // ─── Error Object Structure ──────────────────────────────────────

    {
        id: 'JSON-ERR-01',
        name: 'Error Object Should Have Code',
        description: 'The error object should contain a numeric "code" property representing the HTTP response code.',
        severity: 'high',
        guideSection: 'Reserved Property Names in the error object > error.code',
        guideUrl: `${GUIDE_BASE}#error.code`,
        check: (lines: string[]): Violation[] => {
            const violations: Violation[] = [];
            const keys = extractKeys(lines);

            // Check if there is an "error" key
            const errorKey = keys.find(k => k.key === 'error');
            if (!errorKey) return violations;

            // Look for "code" at a deeper depth than the error key
            const hasCode = keys.some(k => k.key === 'code' && k.depth > errorKey.depth);
            if (!hasCode) {
                violations.push({
                    ruleId: 'JSON-ERR-01',
                    ruleName: 'Error Object Should Have Code',
                    severity: 'high',
                    line: errorKey.lineIndex + 1,
                    message: `The "error" object should include a "code" property (typically the HTTP status code).`,
                    suggestion: `Add a "code" property inside the error object, e.g. "code": 404.`,
                    codeSnippet: lines[errorKey.lineIndex].trim(),
                    guideUrl: `${GUIDE_BASE}#error.code`,
                });
            }
            return violations;
        },
    },

    {
        id: 'JSON-ERR-02',
        name: 'Error Object Should Have Message',
        description: 'The error object should contain a "message" property with a human-readable error description.',
        severity: 'high',
        guideSection: 'Reserved Property Names in the error object > error.message',
        guideUrl: `${GUIDE_BASE}#error.message`,
        check: (lines: string[]): Violation[] => {
            const violations: Violation[] = [];
            const keys = extractKeys(lines);

            const errorKey = keys.find(k => k.key === 'error');
            if (!errorKey) return violations;

            const hasMessage = keys.some(k => k.key === 'message' && k.depth > errorKey.depth);
            if (!hasMessage) {
                violations.push({
                    ruleId: 'JSON-ERR-02',
                    ruleName: 'Error Object Should Have Message',
                    severity: 'high',
                    line: errorKey.lineIndex + 1,
                    message: `The "error" object should include a "message" property with a human-readable error description.`,
                    suggestion: `Add a "message" property inside the error object, e.g. "message": "File Not Found".`,
                    codeSnippet: lines[errorKey.lineIndex].trim(),
                    guideUrl: `${GUIDE_BASE}#error.message`,
                });
            }
            return violations;
        },
    },

    // ─── Top-Level Reserved Properties ───────────────────────────────

    {
        id: 'JSON-API-01',
        name: 'API Version Recommended',
        description: 'The "apiVersion" property should always be present in JSON API responses to indicate the service API version.',
        severity: 'low',
        guideSection: 'Top-Level Reserved Property Names > apiVersion',
        guideUrl: `${GUIDE_BASE}#apiVersion`,
        check: (lines: string[], filename?: string): Violation[] => {
            const violations: Violation[] = [];
            // Only flag for files that look like API responses (have "data" or "error")
            const keys = extractKeys(lines);
            const hasData = keys.some(k => k.key === 'data');
            const hasError = keys.some(k => k.key === 'error');
            const hasApiVersion = keys.some(k => k.key === 'apiVersion');

            if ((hasData || hasError) && !hasApiVersion) {
                violations.push({
                    ruleId: 'JSON-API-01',
                    ruleName: 'API Version Recommended',
                    severity: 'low',
                    line: 1,
                    message: `JSON API response should include an "apiVersion" property.`,
                    suggestion: `Add "apiVersion": "1.0" (or the appropriate version) as a top-level property.`,
                    codeSnippet: lines[0]?.trim() || '',
                    guideUrl: `${GUIDE_BASE}#apiVersion`,
                });
            }
            return violations;
        },
    },

    // ─── Plural Array Names ──────────────────────────────────────────

    {
        id: 'JSON-NAME-03',
        name: 'Plural Property Names for Arrays',
        description: 'Properties whose values are arrays should use plural names.',
        severity: 'low',
        guideSection: 'Property Name Guidelines > Singular vs Plural Property Names',
        guideUrl: `${GUIDE_BASE}#Singular_vs_Plural_Property_Names`,
        check: (lines: string[]): Violation[] => {
            const violations: Violation[] = [];
            const keyWithArrayRegex = /^\s*"([^"]+)"\s*:\s*\[/;

            // Common singular suffixes that should be plural when pointing to arrays
            // We flag names that clearly end in a singular noun and are followed by [
            const singularPattern = /^[a-z][a-zA-Z]*(?:(?<!s|es|ies|data|info|metadata))$/;

            for (let i = 0; i < lines.length; i++) {
                const m = lines[i].match(keyWithArrayRegex);
                if (m) {
                    const key = m[1];
                    // Skip well-known keys and keys already plural
                    if (key.endsWith('s') || key.endsWith('List') || key.endsWith('Array') || key === 'data') continue;
                    // Only flag very obvious singular names (single English word, no trailing 's')
                    if (/^[a-z][a-zA-Z]*[^s]$/.test(key) && key.length > 2) {
                        violations.push({
                            ruleId: 'JSON-NAME-03',
                            ruleName: 'Plural Property Names for Arrays',
                            severity: 'low',
                            line: i + 1,
                            message: `Array property "${key}" should use a plural name.`,
                            suggestion: `Rename "${key}" to "${key}s" or another appropriate plural form.`,
                            codeSnippet: lines[i].trim(),
                            guideUrl: `${GUIDE_BASE}#Singular_vs_Plural_Property_Names`,
                        });
                    }
                }
            }
            return violations;
        },
    },

    // ─── Date Format ─────────────────────────────────────────────────

    {
        id: 'JSON-VAL-03',
        name: 'Date Values Should Use RFC 3339',
        description: 'Date property values should be strings formatted as RFC 3339 (e.g., "2007-11-06T16:34:41.000Z").',
        severity: 'medium',
        guideSection: 'Property Value Data Types > Date Property Values',
        guideUrl: `${GUIDE_BASE}#Date_Property_Values`,
        check: (lines: string[]): Violation[] => {
            const violations: Violation[] = [];
            // Common date-related property names
            const datePropNames = /(?:date|created|updated|modified|timestamp|time|at|expired|published|lastUpdate|startDate|endDate)/i;
            const keyValueRegex = /^\s*"([^"]+)"\s*:\s*"([^"]+)"/;
            // RFC 3339: YYYY-MM-DDTHH:MM:SS with optional fractional seconds and timezone
            const rfc3339Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
            // Common non-RFC date formats to flag
            const badDateRegex = /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$|^\d{4}[\/]\d{2}[\/]\d{2}$|^\w{3,9}\s+\d{1,2},?\s+\d{4}$/;

            for (let i = 0; i < lines.length; i++) {
                const m = lines[i].match(keyValueRegex);
                if (m) {
                    const key = m[1];
                    const value = m[2];
                    if (datePropNames.test(key) && !rfc3339Regex.test(value) && badDateRegex.test(value)) {
                        violations.push({
                            ruleId: 'JSON-VAL-03',
                            ruleName: 'Date Values Should Use RFC 3339',
                            severity: 'medium',
                            line: i + 1,
                            message: `Date property "${key}" has value "${value}" which does not follow RFC 3339 format.`,
                            suggestion: `Format dates as RFC 3339: "YYYY-MM-DDTHH:MM:SS.sssZ" (e.g., "2007-11-06T16:34:41.000Z").`,
                            codeSnippet: lines[i].trim(),
                            guideUrl: `${GUIDE_BASE}#Date_Property_Values`,
                        });
                    }
                }
            }
            return violations;
        },
    },

    // ─── Trailing Comma ──────────────────────────────────────────────

    {
        id: 'JSON-FMT-03',
        name: 'No Trailing Commas',
        description: 'Trailing commas are not valid JSON. They appear before a closing } or ].',
        severity: 'critical',
        guideSection: 'General Guidelines',
        guideUrl: GUIDE_BASE,
        check: (lines: string[]): Violation[] => {
            const violations: Violation[] = [];
            // Look for lines ending in a comma where the next non-blank line starts with } or ]
            for (let i = 0; i < lines.length; i++) {
                const trimmed = lines[i].trimEnd();
                if (trimmed.endsWith(',')) {
                    // Find next non-blank line
                    for (let j = i + 1; j < lines.length; j++) {
                        const nextTrimmed = lines[j].trim();
                        if (nextTrimmed.length === 0) continue;
                        if (nextTrimmed.startsWith('}') || nextTrimmed.startsWith(']')) {
                            violations.push({
                                ruleId: 'JSON-FMT-03',
                                ruleName: 'No Trailing Commas',
                                severity: 'critical',
                                line: i + 1,
                                message: `Trailing comma before closing "${nextTrimmed[0]}" is not valid JSON.`,
                                suggestion: `Remove the trailing comma on this line.`,
                                codeSnippet: lines[i].trim(),
                                guideUrl: GUIDE_BASE,
                            });
                        }
                        break;
                    }
                }
            }
            return violations;
        },
    },

    // ─── Duplicate Keys ──────────────────────────────────────────────

    {
        id: 'JSON-FMT-04',
        name: 'No Duplicate Keys',
        description: 'Duplicate property names within the same object are a source of bugs. The last value silently wins.',
        severity: 'high',
        guideSection: 'General Guidelines',
        guideUrl: GUIDE_BASE,
        check: (lines: string[]): Violation[] => {
            const violations: Violation[] = [];
            const keys = extractKeys(lines);

            // Group by depth and detect duplicates at each depth level
            // This is approximate -- a full parse would be needed for nested same-depth objects
            const seen = new Map<string, number>(); // "depth:key" -> first line
            for (const { key, lineIndex, depth } of keys) {
                const mapKey = `${depth}:${key}`;
                if (seen.has(mapKey)) {
                    violations.push({
                        ruleId: 'JSON-FMT-04',
                        ruleName: 'No Duplicate Keys',
                        severity: 'high',
                        line: lineIndex + 1,
                        message: `Duplicate property name "${key}" (first seen at line ${(seen.get(mapKey) ?? 0) + 1}). The last value silently wins.`,
                        suggestion: `Remove the duplicate or rename one of the "${key}" properties.`,
                        codeSnippet: lines[lineIndex].trim(),
                        guideUrl: GUIDE_BASE,
                    });
                } else {
                    seen.set(mapKey, lineIndex);
                }
            }
            return violations;
        },
    },

    // §Flattened data vs Structured Hierarchy -- deferred to AI deep review layer
    // (requires semantic understanding of data relationships, not regex-checkable)

    // §Enum Values -- deferred to AI deep review layer
    // (requires knowing which properties are enums; not determinable from JSON alone)

    // §Time Duration Property Values -- deferred to AI deep review layer
    // (requires knowing which properties represent durations)

    // §Latitude/Longitude Property Values -- deferred to AI deep review layer
    // (requires knowing which properties represent coordinates)
];
