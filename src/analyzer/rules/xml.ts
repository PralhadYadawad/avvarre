/**
 * XML Rules -- Google XML Document Format Style Guide
 * https://google.github.io/styleguide/xmlstyle.html
 *
 * Sections covered:
 *   3  Namespaces
 *   4  Names and enumerated values
 *   5  Elements (mixed content)
 *   6  Attributes
 *   7  Values
 *   9  Binary data -- deferred to AI deep review layer
 *   10 Processing instructions
 *   11 Representation of XML document instances
 *
 * Sections NOT coverable by regex (design-time guidance):
 *   1  To design or not to design
 *   2  Schemas
 *   8  Key-value pairs
 *   12 Elements vs. Attributes
 *   13 Parting words
 *
 * Rules use getCleanLines() to strip XML comments before pattern matching,
 * preventing false positives on commented-out content.
 *
 * Total rules implemented: 18
 */

import { Rule, Violation } from '../../types.js';

// ============================================================================
// HELPER UTILITIES
// ============================================================================

/**
 * Strip XML comments from lines while preserving line count and structure.
 * Replaces comment content with empty strings so line numbers stay aligned.
 *
 * Handles:
 *   - Single-line comments:  <!-- ... -->
 *   - Multi-line comments:   <!-- ... \n ... -->
 */
export function getCleanLines(lines: string[]): string[] {
    const code = lines.join('\n');
    // Remove XML comments (<!-- ... -->), replacing with equivalent newlines
    const cleaned = code.replace(/<!--[\s\S]*?-->/g, (match) => {
        // Preserve the same number of newlines so line numbers stay aligned
        return match.replace(/[^\n]/g, '');
    });
    return cleaned.split('\n');
}

// ============================================================================
// RULES
// ============================================================================

export const xmlRules: Rule[] = [
    // ========================================================================
    // Section 3: Namespaces
    // ========================================================================
    {
        id: 'XML-NAME-02',
        name: 'Namespace Prefixes',
        description: 'Namespace prefixes SHOULD be short, NOT single-letter, and contain only lower-case ASCII letters.',
        severity: 'medium',
        guideSection: '3.5 Namespace prefixes',
        guideUrl: 'https://google.github.io/styleguide/xmlstyle.html',
        check: (lines: string[], filename?: string, cleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getCleanLines(lines);
            // Only match xmlns:prefix declarations to avoid false positives
            const prefixRegex = /xmlns:([a-zA-Z0-9]+)\s*=/g;

            searchLines.forEach((line, index) => {
                let match;
                prefixRegex.lastIndex = 0;
                while ((match = prefixRegex.exec(line)) !== null) {
                    const prefix = match[1];
                    if (prefix === 'xml' || prefix === 'xmlns') continue;

                    if (prefix.length === 1) {
                        violations.push({
                            ruleId: 'XML-NAME-02',
                            ruleName: 'Namespace Prefixes',
                            severity: 'medium',
                            line: index + 1,
                            message: `Namespace prefix "${prefix}" is a single letter, which is forbidden.`,
                            suggestion: 'Use a short, descriptive lower-case word for the namespace prefix.',
                            codeSnippet: lines[index].trim(),
                            guideUrl: 'https://google.github.io/styleguide/xmlstyle.html'
                        });
                    } else if (!/^[a-z]+$/.test(prefix)) {
                        violations.push({
                            ruleId: 'XML-NAME-02',
                            ruleName: 'Namespace Prefixes',
                            severity: 'medium',
                            line: index + 1,
                            message: `Namespace prefix "${prefix}" contains uppercase letters or digits.`,
                            suggestion: 'Namespace prefixes SHOULD contain only lower-case ASCII letters.',
                            codeSnippet: lines[index].trim(),
                            guideUrl: 'https://google.github.io/styleguide/xmlstyle.html'
                        });
                    }
                }
            });
            return violations;
        }
    },
    {
        id: 'XML-NS-01',
        name: 'Default Namespace',
        description: 'Element names MUST be in a namespace. A default namespace SHOULD be used.',
        severity: 'medium',
        guideSection: '3.1 Element namespaces',
        guideUrl: 'https://google.github.io/styleguide/xmlstyle.html',
        check: (lines: string[], filename?: string, cleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getCleanLines(lines);
            const fullText = searchLines.join('\n');
            // Check if there is any xmlns= (default namespace) declaration
            if (!(/xmlns\s*=\s*["']/.test(fullText))) {
                // Only flag if this looks like a real XML document (has a root element)
                const hasRootElement = searchLines.some(l => /^\s*<[a-zA-Z]/.test(l) && !l.trim().startsWith('<?'));
                if (hasRootElement) {
                    // Find the first element line for reporting
                    const firstElemIdx = searchLines.findIndex(l => /^\s*<[a-zA-Z]/.test(l) && !l.trim().startsWith('<?'));
                    violations.push({
                        ruleId: 'XML-NS-01',
                        ruleName: 'Default Namespace',
                        severity: 'medium',
                        line: firstElemIdx >= 0 ? firstElemIdx + 1 : 1,
                        message: 'No default namespace (xmlns="...") found. Elements MUST be in a namespace.',
                        suggestion: 'Add a default namespace declaration to the root element: xmlns="https://example.com/..."',
                        codeSnippet: firstElemIdx >= 0 ? lines[firstElemIdx].trim() : '',
                        guideUrl: 'https://google.github.io/styleguide/xmlstyle.html'
                    });
                }
            }
            return violations;
        }
    },

    // ========================================================================
    // Section 4: Names and enumerated values
    // ========================================================================
    {
        id: 'XML-NAME-01',
        name: 'lowerCamelCase Names',
        description: 'All element and attribute names MUST use lowerCamelCase.',
        severity: 'high',
        guideSection: '4.1 lowerCamelCase',
        guideUrl: 'https://google.github.io/styleguide/xmlstyle.html',
        check: (lines: string[], filename?: string, cleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getCleanLines(lines);
            const elementRegex = /<\/?([a-zA-Z][a-zA-Z0-9:._-]*)/g;
            const attrRegex = /\s([a-zA-Z][a-zA-Z0-9:._-]*)\s*=/g;
            const validCamelCase = /^[a-z][a-zA-Z0-9]*$/;
            // Known standard attributes/elements that are exempt
            const exempt = new Set(['xmlns', 'xml', 'xsi', 'xsd', 'xs']);

            searchLines.forEach((line, index) => {
                if (line.trim().startsWith('<?') || line.trim() === '') return;

                let match;
                // Check element names
                elementRegex.lastIndex = 0;
                while ((match = elementRegex.exec(line)) !== null) {
                    let name = match[1];
                    if (name.includes(':')) {
                        name = name.split(':')[1];
                    }
                    if (exempt.has(name)) continue;
                    if (!validCamelCase.test(name)) {
                        violations.push({
                            ruleId: 'XML-NAME-01',
                            ruleName: 'lowerCamelCase Names',
                            severity: 'high',
                            line: index + 1,
                            message: `Element name "${name}" is not lowerCamelCase.`,
                            suggestion: 'Rename element to use lowerCamelCase (e.g. from <ElementName> to <elementName>).',
                            codeSnippet: lines[index].trim(),
                            guideUrl: 'https://google.github.io/styleguide/xmlstyle.html'
                        });
                    }
                }

                // Check attribute names
                attrRegex.lastIndex = 0;
                while ((match = attrRegex.exec(line)) !== null) {
                    let name = match[1];
                    if (name.includes(':')) {
                        const parts = name.split(':');
                        if (exempt.has(parts[0])) continue;
                        name = parts[1];
                    }
                    if (exempt.has(name)) continue;
                    if (!validCamelCase.test(name)) {
                        violations.push({
                            ruleId: 'XML-NAME-01',
                            ruleName: 'lowerCamelCase Names',
                            severity: 'high',
                            line: index + 1,
                            message: `Attribute name "${name}" is not lowerCamelCase.`,
                            suggestion: 'Rename attribute to use lowerCamelCase.',
                            codeSnippet: lines[index].trim(),
                            guideUrl: 'https://google.github.io/styleguide/xmlstyle.html'
                        });
                    }
                }
            });
            return violations;
        }
    },
    {
        id: 'XML-NAME-03',
        name: 'ASCII-Only Names',
        description: 'Names MUST contain only ASCII letters and digits.',
        severity: 'high',
        guideSection: '4.2 ASCII names',
        guideUrl: 'https://google.github.io/styleguide/xmlstyle.html',
        check: (lines: string[], filename?: string, cleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getCleanLines(lines);
            // Match element or attribute names that contain non-ASCII characters
            const elementRegex = /<\/?([a-zA-Z\u0080-\uFFFF][a-zA-Z0-9:._\u0080-\uFFFF-]*)/g;

            searchLines.forEach((line, index) => {
                if (line.trim().startsWith('<?') || line.trim() === '') return;
                let match;
                elementRegex.lastIndex = 0;
                while ((match = elementRegex.exec(line)) !== null) {
                    const name = match[1];
                    if (/[^\x00-\x7F]/.test(name)) {
                        violations.push({
                            ruleId: 'XML-NAME-03',
                            ruleName: 'ASCII-Only Names',
                            severity: 'high',
                            line: index + 1,
                            message: `Name "${name}" contains non-ASCII characters.`,
                            suggestion: 'Names MUST contain only ASCII letters and digits.',
                            codeSnippet: lines[index].trim(),
                            guideUrl: 'https://google.github.io/styleguide/xmlstyle.html'
                        });
                    }
                }
            });
            return violations;
        }
    },
    {
        id: 'XML-NAME-04',
        name: 'Name Length Limit',
        description: 'Names SHOULD NOT exceed 25 characters.',
        severity: 'low',
        guideSection: '4.3 Name length',
        guideUrl: 'https://google.github.io/styleguide/xmlstyle.html',
        check: (lines: string[], filename?: string, cleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getCleanLines(lines);
            const elementRegex = /<\/?([a-zA-Z][a-zA-Z0-9:._-]*)/g;

            searchLines.forEach((line, index) => {
                if (line.trim().startsWith('<?') || line.trim() === '') return;
                let match;
                elementRegex.lastIndex = 0;
                while ((match = elementRegex.exec(line)) !== null) {
                    let name = match[1];
                    if (name.includes(':')) {
                        name = name.split(':')[1];
                    }
                    if (name.length > 25) {
                        violations.push({
                            ruleId: 'XML-NAME-04',
                            ruleName: 'Name Length Limit',
                            severity: 'low',
                            line: index + 1,
                            message: `Name "${name}" is ${name.length} characters (exceeds 25-character guideline).`,
                            suggestion: 'Devise a concise and informative name under 25 characters.',
                            codeSnippet: lines[index].trim(),
                            guideUrl: 'https://google.github.io/styleguide/xmlstyle.html'
                        });
                    }
                }
            });
            return violations;
        }
    },
    {
        id: 'XML-NAME-05',
        name: 'Acronym CamelCase',
        description: 'Acronyms MUST be treated as words for camelCasing: informationUri, not informationURI.',
        severity: 'medium',
        guideSection: '4.4 Acronyms in names',
        guideUrl: 'https://google.github.io/styleguide/xmlstyle.html',
        check: (lines: string[], filename?: string, cleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getCleanLines(lines);
            const elementRegex = /<\/?([a-zA-Z][a-zA-Z0-9:._-]*)/g;
            const attrRegex = /\s([a-zA-Z][a-zA-Z0-9:._-]*)\s*=/g;
            // Detect 3+ consecutive uppercase letters mid-word (e.g. "getHTTPResponse", "informationURI")
            const acronymPattern = /[a-z][A-Z]{2,}[A-Z]|[A-Z]{3,}[a-z]/;
            const exempt = new Set(['xmlns', 'xml', 'xsi', 'xsd', 'xs']);

            searchLines.forEach((line, index) => {
                if (line.trim().startsWith('<?') || line.trim() === '') return;
                const names: string[] = [];
                let match;
                elementRegex.lastIndex = 0;
                while ((match = elementRegex.exec(line)) !== null) {
                    let name = match[1];
                    if (name.includes(':')) name = name.split(':')[1];
                    if (!exempt.has(name)) names.push(name);
                }
                attrRegex.lastIndex = 0;
                while ((match = attrRegex.exec(line)) !== null) {
                    let name = match[1];
                    if (name.includes(':')) {
                        const parts = name.split(':');
                        if (exempt.has(parts[0])) continue;
                        name = parts[1];
                    }
                    if (!exempt.has(name)) names.push(name);
                }

                for (const name of names) {
                    if (acronymPattern.test(name)) {
                        violations.push({
                            ruleId: 'XML-NAME-05',
                            ruleName: 'Acronym CamelCase',
                            severity: 'medium',
                            line: index + 1,
                            message: `Name "${name}" appears to contain an acronym not treated as a word.`,
                            suggestion: 'Treat acronyms as words: use "informationUri" not "informationURI".',
                            codeSnippet: lines[index].trim(),
                            guideUrl: 'https://google.github.io/styleguide/xmlstyle.html'
                        });
                    }
                }
            });
            return violations;
        }
    },

    // ========================================================================
    // Section 5: Elements -- deferred to AI deep review layer
    // Mixed content detection requires AST-level analysis
    // ========================================================================

    // ========================================================================
    // Section 6: Attributes
    // ========================================================================
    {
        id: 'XML-ATTR-01',
        name: 'Too Many Attributes',
        description: 'Elements SHOULD NOT be overloaded with too many attributes (no more than 10).',
        severity: 'medium',
        guideSection: '6.2 Attribute count',
        guideUrl: 'https://google.github.io/styleguide/xmlstyle.html',
        check: (lines: string[], filename?: string, cleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getCleanLines(lines);

            // Accumulate start-tags which may span multiple lines
            let tagBuffer = '';
            let tagStartLine = -1;

            for (let i = 0; i < searchLines.length; i++) {
                const line = searchLines[i];
                if (tagBuffer) {
                    tagBuffer += ' ' + line;
                } else if (/<[a-zA-Z]/.test(line) && !line.trim().startsWith('<?')) {
                    tagBuffer = line;
                    tagStartLine = i;
                }

                if (tagBuffer && tagBuffer.includes('>')) {
                    // Count attributes in the tag
                    const attrMatches = tagBuffer.match(/\s[a-zA-Z][a-zA-Z0-9:._-]*\s*=/g);
                    if (attrMatches && attrMatches.length > 10) {
                        violations.push({
                            ruleId: 'XML-ATTR-01',
                            ruleName: 'Too Many Attributes',
                            severity: 'medium',
                            line: tagStartLine + 1,
                            message: `Element has ${attrMatches.length} attributes (exceeds 10-attribute guideline).`,
                            suggestion: 'Use child elements to encapsulate closely related attributes.',
                            codeSnippet: lines[tagStartLine].trim(),
                            guideUrl: 'https://google.github.io/styleguide/xmlstyle.html'
                        });
                    }
                    tagBuffer = '';
                    tagStartLine = -1;
                }
            }
            return violations;
        }
    },

    // ========================================================================
    // Section 7: Values
    // ========================================================================
    {
        id: 'XML-VAL-01',
        name: 'Strict Booleans',
        description: 'Boolean values MUST be expressed as "true" or "false". The values "1" and "0" MUST NOT be used.',
        severity: 'high',
        guideSection: '7.2 Boolean values',
        guideUrl: 'https://google.github.io/styleguide/xmlstyle.html',
        check: (lines: string[], filename?: string, cleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getCleanLines(lines);
            // Match attributes with boolean-sounding names assigned "1" or "0"
            const boolAttrRegex = /\s(is[A-Z][a-zA-Z0-9]*|has[A-Z][a-zA-Z0-9]*|enabled|disabled|visible|hidden|active|checked|selected|required|optional|readonly|editable)\s*=\s*["']([01])["']/g;

            searchLines.forEach((line, index) => {
                if (line.trim().startsWith('<?')) return;
                let match;
                boolAttrRegex.lastIndex = 0;
                while ((match = boolAttrRegex.exec(line)) !== null) {
                    const attrName = match[1];
                    const val = match[2];
                    violations.push({
                        ruleId: 'XML-VAL-01',
                        ruleName: 'Strict Booleans',
                        severity: 'high',
                        line: index + 1,
                        message: `Boolean attribute "${attrName}" uses "${val}". 1/0 are forbidden.`,
                        suggestion: 'Use "true" or "false" instead of "1" or "0" for boolean values.',
                        codeSnippet: lines[index].trim(),
                        guideUrl: 'https://google.github.io/styleguide/xmlstyle.html'
                    });
                }
            });
            return violations;
        }
    },

    // ========================================================================
    // Section 10: Processing instructions
    // ========================================================================
    {
        id: 'XML-PI-01',
        name: 'No Custom Processing Instructions',
        description: 'New processing instructions MUST NOT be created. Only standard PIs (e.g. <?xml ...?>) are allowed.',
        severity: 'high',
        guideSection: '10.1 Processing instructions',
        guideUrl: 'https://google.github.io/styleguide/xmlstyle.html',
        check: (lines: string[], filename?: string, cleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getCleanLines(lines);
            // Standard PIs that are allowed
            const standardPIs = new Set(['xml', 'xml-stylesheet', 'xml-model']);
            const piRegex = /^(\s*)<\?([a-zA-Z][a-zA-Z0-9_-]*)/;

            searchLines.forEach((line, index) => {
                const match = line.match(piRegex);
                if (match) {
                    const piTarget = match[2];
                    if (!standardPIs.has(piTarget.toLowerCase())) {
                        violations.push({
                            ruleId: 'XML-PI-01',
                            ruleName: 'No Custom Processing Instructions',
                            severity: 'high',
                            line: index + 1,
                            message: `Custom processing instruction "<?${piTarget}" is not allowed.`,
                            suggestion: 'Use elements instead of processing instructions. Only standard PIs like <?xml ...?> are permitted.',
                            codeSnippet: lines[index].trim(),
                            guideUrl: 'https://google.github.io/styleguide/xmlstyle.html'
                        });
                    }
                }
            });
            return violations;
        }
    },

    // ========================================================================
    // Section 11: Representation of XML document instances
    // ========================================================================
    {
        id: 'XML-FMT-01',
        name: '2-space Indentation',
        description: 'Documents MAY be pretty-printed using 2-space indentation for child elements.',
        severity: 'low',
        guideSection: '11.7 Pretty-printing',
        guideUrl: 'https://google.github.io/styleguide/xmlstyle.html',
        check: (lines: string[], filename?: string): Violation[] => {
            // Whitespace rule: legitimately uses raw lines
            const violations: Violation[] = [];

            lines.forEach((line, index) => {
                const match = line.match(/^(\s+)</);
                if (match) {
                    const spaces = match[1];
                    if (spaces.includes('\t')) {
                        violations.push({
                            ruleId: 'XML-FMT-01',
                            ruleName: '2-space Indentation',
                            severity: 'low',
                            line: index + 1,
                            message: 'XML is indented with tabs. Google XML style prefers 2-space indentation.',
                            suggestion: 'Replace tabs with 2 spaces per indentation level.',
                            codeSnippet: line.trim(),
                            guideUrl: 'https://google.github.io/styleguide/xmlstyle.html'
                        });
                    }
                }
            });
            return violations;
        }
    },
    {
        id: 'XML-FMT-02',
        name: 'UTF-8 Encoding',
        description: 'The character encoding SHOULD be UTF-8.',
        severity: 'medium',
        guideSection: '11.1 UTF-8 encoding',
        guideUrl: 'https://google.github.io/styleguide/xmlstyle.html',
        check: (lines: string[], filename?: string): Violation[] => {
            const violations: Violation[] = [];
            // Check the XML declaration for non-UTF-8 encoding
            for (let i = 0; i < Math.min(lines.length, 5); i++) {
                const line = lines[i].trim();
                if (line.startsWith('<?xml')) {
                    const encodingMatch = line.match(/encoding\s*=\s*["']([^"']+)["']/i);
                    if (encodingMatch) {
                        const enc = encodingMatch[1].toUpperCase();
                        if (enc !== 'UTF-8') {
                            violations.push({
                                ruleId: 'XML-FMT-02',
                                ruleName: 'UTF-8 Encoding',
                                severity: 'medium',
                                line: i + 1,
                                message: `Encoding "${encodingMatch[1]}" is not UTF-8.`,
                                suggestion: 'Use encoding="UTF-8" in the XML declaration.',
                                codeSnippet: lines[i].trim(),
                                guideUrl: 'https://google.github.io/styleguide/xmlstyle.html'
                            });
                        }
                    }
                    break;
                }
            }
            return violations;
        }
    },
    {
        id: 'XML-FMT-03',
        name: 'Redundant Whitespace in Tags',
        description: 'Redundant whitespace in a tag SHOULD NOT be used. Use one space before each attribute.',
        severity: 'low',
        guideSection: '11.5 Redundant whitespace',
        guideUrl: 'https://google.github.io/styleguide/xmlstyle.html',
        check: (lines: string[], filename?: string, cleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getCleanLines(lines);
            // Detect multiple spaces between attributes or between tag name and first attribute
            const multiSpaceRegex = /<[a-zA-Z][a-zA-Z0-9:._-]*(\s{2,})[a-zA-Z]/;
            const attrMultiSpaceRegex = /["']\s{2,}[a-zA-Z]/;

            searchLines.forEach((line, index) => {
                if (line.trim().startsWith('<?') || line.trim().startsWith('<!--')) return;
                if (multiSpaceRegex.test(line) || attrMultiSpaceRegex.test(line)) {
                    violations.push({
                        ruleId: 'XML-FMT-03',
                        ruleName: 'Redundant Whitespace in Tags',
                        severity: 'low',
                        line: index + 1,
                        message: 'Multiple spaces detected in start-tag. Use exactly one space before each attribute.',
                        suggestion: 'Use a single space between the tag name and attributes, and between attributes.',
                        codeSnippet: lines[index].trim(),
                        guideUrl: 'https://google.github.io/styleguide/xmlstyle.html'
                    });
                }
            });
            return violations;
        }
    },
    {
        id: 'XML-FMT-04',
        name: 'Comment Whitespace',
        description: 'Comments SHOULD have whitespace following <!-- and preceding -->.',
        severity: 'low',
        guideSection: '11.11 Comment formatting',
        guideUrl: 'https://google.github.io/styleguide/xmlstyle.html',
        check: (lines: string[]): Violation[] => {
            // Uses raw lines since we need to inspect comments themselves
            const violations: Violation[] = [];

            lines.forEach((line, index) => {
                // Check for <!-- without trailing space (but not empty comments <!---->)
                if (/<!--[^\s>-]/.test(line)) {
                    violations.push({
                        ruleId: 'XML-FMT-04',
                        ruleName: 'Comment Whitespace',
                        severity: 'low',
                        line: index + 1,
                        message: 'Comment lacks whitespace after "<!--".',
                        suggestion: 'Add a space after "<!--": <!-- comment text -->',
                        codeSnippet: lines[index].trim(),
                        guideUrl: 'https://google.github.io/styleguide/xmlstyle.html'
                    });
                }
                // Check for --> without preceding space
                if (/[^\s-]-->/.test(line)) {
                    violations.push({
                        ruleId: 'XML-FMT-04',
                        ruleName: 'Comment Whitespace',
                        severity: 'low',
                        line: index + 1,
                        message: 'Comment lacks whitespace before "-->".',
                        suggestion: 'Add a space before "-->": <!-- comment text -->',
                        codeSnippet: lines[index].trim(),
                        guideUrl: 'https://google.github.io/styleguide/xmlstyle.html'
                    });
                }
            });
            return violations;
        }
    },
    {
        id: 'XML-FMT-05',
        name: 'No Custom Entity References',
        description: 'Entity references other than &amp;, &lt;, &gt;, &quot;, and &apos; MUST NOT be used.',
        severity: 'high',
        guideSection: '11.13 Entity references',
        guideUrl: 'https://google.github.io/styleguide/xmlstyle.html',
        check: (lines: string[], filename?: string, cleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getCleanLines(lines);
            const standardEntities = new Set(['amp', 'lt', 'gt', 'quot', 'apos']);
            // Match named entity references like &foo; (not numeric &#123; or &#x1F;)
            const entityRegex = /&([a-zA-Z][a-zA-Z0-9]*);/g;

            searchLines.forEach((line, index) => {
                if (line.trim().startsWith('<?') || line.trim().startsWith('<!DOCTYPE')) return;
                let match;
                entityRegex.lastIndex = 0;
                while ((match = entityRegex.exec(line)) !== null) {
                    const entity = match[1];
                    if (!standardEntities.has(entity)) {
                        violations.push({
                            ruleId: 'XML-FMT-05',
                            ruleName: 'No Custom Entity References',
                            severity: 'high',
                            line: index + 1,
                            message: `Custom entity reference "&${entity};" is not allowed.`,
                            suggestion: 'Use only standard XML entities: &amp;, &lt;, &gt;, &quot;, &apos;. Use actual characters or character references (&#NNN;) instead.',
                            codeSnippet: lines[index].trim(),
                            guideUrl: 'https://google.github.io/styleguide/xmlstyle.html'
                        });
                    }
                }
            });
            return violations;
        }
    },
    {
        id: 'XML-FMT-06',
        name: 'Namespace Declarations in Root',
        description: 'Namespaces SHOULD be declared in the root element wherever possible.',
        severity: 'low',
        guideSection: '11.2 Namespace in root',
        guideUrl: 'https://google.github.io/styleguide/xmlstyle.html',
        check: (lines: string[], filename?: string, cleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getCleanLines(lines);
            // Find xmlns declarations that are NOT on the root element
            let foundRootElement = false;
            let rootElementEnd = -1;

            for (let i = 0; i < searchLines.length; i++) {
                const line = searchLines[i].trim();
                if (line.startsWith('<?') || line === '' || line.startsWith('<!DOCTYPE') || line.startsWith('<!--')) continue;
                if (!foundRootElement && /^<[a-zA-Z]/.test(line)) {
                    foundRootElement = true;
                    // Root element might span multiple lines - find where it ends
                    let j = i;
                    while (j < searchLines.length && !searchLines[j].includes('>')) {
                        j++;
                    }
                    rootElementEnd = j;
                    // Skip past root element lines
                    i = j;
                    continue;
                }
                if (foundRootElement && i > rootElementEnd) {
                    const nsMatch = /xmlns(?::[a-zA-Z]+)?\s*=/.test(line);
                    if (nsMatch) {
                        violations.push({
                            ruleId: 'XML-FMT-06',
                            ruleName: 'Namespace Declarations in Root',
                            severity: 'low',
                            line: i + 1,
                            message: 'Namespace declaration found outside root element.',
                            suggestion: 'Move namespace declarations to the root element for clarity and consistency.',
                            codeSnippet: lines[i].trim(),
                            guideUrl: 'https://google.github.io/styleguide/xmlstyle.html'
                        });
                    }
                }
            }
            return violations;
        }
    },
    {
        id: 'XML-FMT-07',
        name: 'Comments Must Not Carry Data',
        description: 'Comments MUST NOT be used to carry real data.',
        severity: 'medium',
        guideSection: '11.9 Comments and data',
        guideUrl: 'https://google.github.io/styleguide/xmlstyle.html',
        check: (lines: string[]): Violation[] => {
            // Uses raw lines since we need to inspect comments
            const violations: Violation[] = [];
            const inComment: string[] = [];
            let commentStartLine = -1;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (line.includes('<!--')) {
                    commentStartLine = i;
                }
                // Detect comments that look like they contain structured data
                // (key="value" or key: value patterns inside comments)
                if (commentStartLine >= 0) {
                    inComment.push(line);
                }
                if (line.includes('-->') && commentStartLine >= 0) {
                    const commentText = inComment.join(' ');
                    // Check for XML-like content inside comments (elements or attributes with values)
                    if (/<[a-zA-Z][^>]*>/.test(commentText.replace(/<!--/, '').replace(/-->/, ''))) {
                        // Only flag if it looks like actual markup (not just a mention of a tag name)
                        const inner = commentText.replace(/<!--/, '').replace(/-->/, '').trim();
                        if (/<[a-zA-Z][^>]*\s*\/>|<[a-zA-Z][^>]*>[^<]+<\//.test(inner)) {
                            violations.push({
                                ruleId: 'XML-FMT-07',
                                ruleName: 'Comments Must Not Carry Data',
                                severity: 'medium',
                                line: commentStartLine + 1,
                                message: 'Comment appears to contain structured XML data.',
                                suggestion: 'Comments MUST NOT carry real data. Use proper elements instead, or remove commented-out code.',
                                codeSnippet: lines[commentStartLine].trim(),
                                guideUrl: 'https://google.github.io/styleguide/xmlstyle.html'
                            });
                        }
                    }
                    inComment.length = 0;
                    commentStartLine = -1;
                }
            }
            return violations;
        }
    },

    // ========================================================================
    // Section 9: Binary data -- deferred to AI deep review layer
    // Base64 detection in element content requires context beyond regex
    // ========================================================================

    // ========================================================================
    // Section 12: Elements vs Attributes -- design guidance, not checkable
    // ========================================================================
];
