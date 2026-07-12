import { Rule, Violation, Language } from '../../types.js';

/**
 * Hardened tokenizer for HTML/CSS.
 * Strips comments (<!-- -->, \/* *\/), <script> block content, and preserves
 * <style> block CSS while stripping CSS comments within them.
 * This prevents CSS rules from firing on JavaScript inside <script> blocks.
 */
export function getHTMLCleanLines(lines: string[]): string[] {
    const code = lines.join('\n');
    let cleanCode = '';

    // States
    let inHtmlComment = false;
    let inCssComment = false;
    let inScript = false;
    let inStyle = false;
    let i = 0;

    while (i < code.length) {
        const char = code[i];
        const nextChar = code[i + 1] || '';
        const next2Char = code[i + 2] || '';
        const next3Char = code[i + 3] || '';

        if (char === '\n') {
            cleanCode += '\n'; // Preserve line counts
            i++;
            continue;
        }

        // --- Inside <script> block: blank everything until </script> ---
        if (inScript) {
            if (char === '<' && code.slice(i, i + 9).toLowerCase() === '</script>') {
                inScript = false;
                cleanCode += '</script>';
                i += 9;
            } else {
                cleanCode += ' ';
                i++;
            }
            continue;
        }

        // --- Inside <style> block: pass through CSS (but strip CSS comments) ---
        if (inStyle) {
            if (char === '<' && code.slice(i, i + 8).toLowerCase() === '</style>') {
                inStyle = false;
                cleanCode += '</style>';
                i += 8;
                continue;
            }
            // CSS comment inside <style>
            if (!inCssComment && char === '/' && nextChar === '*') {
                inCssComment = true;
                cleanCode += '  ';
                i += 2;
                continue;
            }
            if (inCssComment) {
                if (char === '*' && nextChar === '/') {
                    inCssComment = false;
                    cleanCode += '  ';
                    i += 2;
                } else {
                    cleanCode += ' ';
                    i++;
                }
                continue;
            }
            cleanCode += char;
            i++;
            continue;
        }

        if (!inHtmlComment && !inCssComment) {
            // Check for HTML comment start
            if (char === '<' && nextChar === '!' && next2Char === '-' && next3Char === '-') {
                inHtmlComment = true;
                cleanCode += '    ';
                i += 4;
            }
            // Check for <script> open tag
            else if (char === '<' && code.slice(i, i + 7).toLowerCase() === '<script' &&
                     /[\s>]/.test(code[i + 7] || '>')) {
                // Pass through the opening tag, then blank the body
                const tagEnd = code.indexOf('>', i);
                if (tagEnd !== -1) {
                    cleanCode += code.slice(i, tagEnd + 1);
                    i = tagEnd + 1;
                    inScript = true;
                } else {
                    cleanCode += char;
                    i++;
                }
            }
            // Check for <style> open tag
            else if (char === '<' && code.slice(i, i + 6).toLowerCase() === '<style' &&
                     /[\s>]/.test(code[i + 6] || '>')) {
                // Pass through the opening tag, then enter style mode
                const tagEnd = code.indexOf('>', i);
                if (tagEnd !== -1) {
                    cleanCode += code.slice(i, tagEnd + 1);
                    i = tagEnd + 1;
                    inStyle = true;
                } else {
                    cleanCode += char;
                    i++;
                }
            }
            // Check for CSS comment start (outside <style>, e.g. inline)
            else if (char === '/' && nextChar === '*') {
                inCssComment = true;
                cleanCode += '  ';
                i += 2;
            }
            else {
                cleanCode += char;
                i++;
            }
        } else if (inHtmlComment) {
            // Check for HTML comment end
            if (char === '-' && nextChar === '-' && next2Char === '>') {
                inHtmlComment = false;
                cleanCode += '   ';
                i += 3;
            } else {
                cleanCode += ' ';
                i++;
            }
        } else if (inCssComment) {
            // Check for CSS comment end
            if (char === '*' && nextChar === '/') {
                inCssComment = false;
                cleanCode += '  ';
                i += 2;
            } else {
                cleanCode += ' ';
                i++;
            }
        }
    }

    return cleanCode.split('\n');
}

/**
 * Create a violation object.
 * Uses raw lines for codeSnippet (user-facing display) so content is not stripped.
 */
const createViolation = (
    ruleId: string,
    message: string,
    severity: 'critical' | 'high' | 'medium' | 'low',
    line: number,
    rawLines: string[],
    filename?: string
): Violation => ({
    ruleId,
    ruleName: 'HTML Style Rule',
    severity,
    line,
    column: 1,
    message,
    suggestion: 'Follow Google HTML/CSS Style Guide.',
    guideUrl: 'https://google.github.io/styleguide/htmlcssguide.html',
    codeSnippet: rawLines[line - 1]?.trim() || '',
});

export const htmlRules: Rule[] = [
    // ════════════════════════════════════════════════════════════════════
    //  GENERAL STYLE RULES
    // ════════════════════════════════════════════════════════════════════

    // ── HC-STYLE-07: Protocol (HTTPS) ──
    {
        id: 'HC-STYLE-07',
        name: 'Protocol',
        description: 'Use HTTPS for embedded resources where possible.',
        severity: 'medium',
        guideSection: '§2.1',
        guideUrl: 'https://google.github.io/styleguide/htmlcssguide.html#Protocol',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getHTMLCleanLines(lines);
            searchLines.forEach((line, i) => {
                // Catch http:// in src="", href="", or url()
                if (/(?:src|href)\s*=\s*["']http:\/\//.test(line) ||
                    /url\(\s*['"]?http:\/\//.test(line)) {
                    violations.push(createViolation(
                        'HC-STYLE-07',
                        'Use HTTPS (https://) instead of HTTP (http://) for embedded resources.',
                        'medium',
                        i + 1,
                        lines,
                        filename
                    ));
                }
            });
            return violations;
        }
    },

    // ════════════════════════════════════════════════════════════════════
    //  GENERAL FORMATTING RULES
    // ════════════════════════════════════════════════════════════════════

    // ── HC-FMT-01: 2-space indentation (HTML & CSS) ──
    {
        id: 'HC-FMT-01',
        name: 'Indentation',
        description: 'Indent by 2 spaces at a time. Do not use tabs.',
        severity: 'low',
        guideSection: '§2.2.1',
        guideUrl: 'https://google.github.io/styleguide/htmlcssguide.html#Indentation',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            // Whitespace rule: uses raw lines intentionally
            lines.forEach((line, i) => {
                if (line.includes('\t')) {
                    violations.push(createViolation(
                        'HC-FMT-01',
                        'Tabs are forbidden; use 2 spaces for indentation.',
                        'low',
                        i + 1,
                        lines,
                        filename
                    ));
                } else {
                    const match = line.match(/^( +)\S/);
                    if (match && match[1].length % 2 !== 0) {
                        violations.push(createViolation(
                            'HC-FMT-01',
                            'Indent with 2 spaces. Found odd number of spaces.',
                            'low',
                            i + 1,
                            lines,
                            filename
                        ));
                    }
                }
            });
            return violations;
        }
    },

    // ── HC-FMT-02: Lowercase tag names and attributes ──
    {
        id: 'HC-FMT-02',
        name: 'Capitalization',
        description: 'All HTML element and attribute names, CSS selectors, properties, and property values should be lowercase.',
        severity: 'medium',
        guideSection: '§2.2.2',
        guideUrl: 'https://google.github.io/styleguide/htmlcssguide.html#Capitalization',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getHTMLCleanLines(lines);
            searchLines.forEach((line, i) => {
                // Match <TAG or </TAG (skip <!DOCTYPE)
                const tagMatch = line.match(/<\/?([A-Z][a-zA-Z0-9]*)\b/);
                if (tagMatch && !line.includes('<!DOCTYPE')) {
                    violations.push(createViolation(
                        'HC-FMT-02',
                        `HTML tag '${tagMatch[1]}' must be lowercase.`,
                        'medium',
                        i + 1,
                        lines,
                        filename
                    ));
                }

                // Uppercase HTML attributes: ATTR="..." inside tags
                const attrMatch = line.match(/<[^>]+\s([A-Z][A-Za-z0-9-]*)=["']/);
                if (attrMatch && !line.includes('<!DOCTYPE')) {
                    violations.push(createViolation(
                        'HC-FMT-02',
                        `HTML attribute '${attrMatch[1]}' must be lowercase.`,
                        'medium',
                        i + 1,
                        lines,
                        filename
                    ));
                }
            });
            return violations;
        }
    },

    // ── HC-FMT-03: Trailing Whitespace ──
    {
        id: 'HC-FMT-03',
        name: 'Trailing Whitespace',
        description: 'Remove trailing whitespace from lines.',
        severity: 'low',
        guideSection: '§2.2.3',
        guideUrl: 'https://google.github.io/styleguide/htmlcssguide.html#Trailing_Whitespace',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            // Whitespace rule: uses raw lines intentionally
            lines.forEach((line, i) => {
                if (line !== line.trimEnd() && line.trim().length > 0) {
                    violations.push(createViolation(
                        'HC-FMT-03',
                        'Remove trailing whitespace.',
                        'low',
                        i + 1,
                        lines,
                        filename
                    ));
                }
            });
            return violations;
        }
    },

    // ════════════════════════════════════════════════════════════════════
    //  GENERAL META RULES
    // ════════════════════════════════════════════════════════════════════

    // ── HC-STYLE-02: UTF-8 Encoding ──
    {
        id: 'HC-STYLE-02',
        name: 'Encoding',
        description: 'Use UTF-8 (no BOM). Specify encoding in HTML via <meta charset="utf-8">.',
        severity: 'high',
        guideSection: '§2.3.1',
        guideUrl: 'https://google.github.io/styleguide/htmlcssguide.html#Encoding',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getHTMLCleanLines(lines);
            const content = searchLines.join('\n');
            // Only enforce if it's a full document with a head
            if (content.includes('<head>') || content.includes('<head ')) {
                if (!/<meta\s+charset=["']utf-8["']\s*\/?>/i.test(content)) {
                    let headLine = 1;
                    searchLines.forEach((line, i) => {
                        if (/<head[\s>]/.test(line)) headLine = i + 1;
                    });
                    violations.push(createViolation(
                        'HC-STYLE-02',
                        'Provide <meta charset="utf-8"> within the <head> section.',
                        'high',
                        headLine,
                        lines,
                        filename
                    ));
                }
            }
            return violations;
        }
    },

    // ── HC-META-01: Action Items ──
    {
        id: 'HC-META-01',
        name: 'Action Items',
        description: 'Mark todos and action items with TODO. Append a contact (username or mailing list) in parentheses.',
        severity: 'low',
        guideSection: '§2.3.3',
        guideUrl: 'https://google.github.io/styleguide/htmlcssguide.html#Action_Items',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            // Check raw lines since TODOs appear in comments which are stripped
            lines.forEach((line, i) => {
                // Match TODO without a contact: TODO: or TODO but not TODO(contact)
                if (/\bTODO\b/.test(line) && !/\bTODO\s*\([^)]+\)/.test(line)) {
                    violations.push(createViolation(
                        'HC-META-01',
                        'TODO should include a contact in parentheses, e.g. TODO(username).',
                        'low',
                        i + 1,
                        lines,
                        filename
                    ));
                }
            });
            return violations;
        }
    },

    // ════════════════════════════════════════════════════════════════════
    //  HTML STYLE RULES
    // ════════════════════════════════════════════════════════════════════

    // ── HC-STYLE-01: Document Type (HTML5) ──
    {
        id: 'HC-STYLE-01',
        name: 'Document Type',
        description: 'Use HTML5 doctype: <!DOCTYPE html>. Do not use XML declarations.',
        severity: 'high',
        guideSection: '§3.1.1',
        guideUrl: 'https://google.github.io/styleguide/htmlcssguide.html#Document_Type',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getHTMLCleanLines(lines);
            const content = searchLines.join('\n');
            if (content.trim()) {
                const firstLine = lines.find(l => l.trim().length > 0) || '';

                if (firstLine.includes('<?xml')) {
                    violations.push(createViolation(
                        'HC-STYLE-01',
                        'Do not use XML declarations. Serve HTML as text/html.',
                        'high',
                        1,
                        lines,
                        filename
                    ));
                } else if (!/<!DOCTYPE\s+html>/i.test(firstLine) && firstLine.startsWith('<')) {
                    // Only flag if it looks like a full HTML document
                    if (content.includes('<html') || content.includes('<head>') || content.includes('<body')) {
                        violations.push(createViolation(
                            'HC-STYLE-01',
                            'Use <!DOCTYPE html> exactly at the beginning of the document.',
                            'high',
                            1,
                            lines,
                            filename
                        ));
                    }
                }
            }
            return violations;
        }
    },

    // §3.1.2 HTML Validity -- deferred to AI deep review layer (requires full HTML parsing)

    // ── HC-STYLE-10: Semantics ──
    {
        id: 'HC-STYLE-10',
        name: 'Semantics',
        description: 'Use HTML according to its purpose. Use elements for what they have been created for.',
        severity: 'high',
        guideSection: '§3.1.3',
        guideUrl: 'https://google.github.io/styleguide/htmlcssguide.html#Semantics',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getHTMLCleanLines(lines);
            searchLines.forEach((line, i) => {
                // Clickable divs or divs with button role
                if (/<div[^>]*\s+(?:onclick|ng-click|@click|v-on:click)=/i.test(line) ||
                    /<div[^>]*\s+role=["']button["']/i.test(line)) {
                    violations.push(createViolation(
                        'HC-STYLE-10',
                        'Use semantic <button> elements instead of <div> elements with click handlers or button roles.',
                        'high',
                        i + 1,
                        lines,
                        filename
                    ));
                }
                // Using <b> or <i> instead of <strong> or <em>
                if (/<(?:b|i)\b[^>]*>/i.test(line) && !/<(?:br|base|body)\b/i.test(line)) {
                    // More precise: match <b> or <i> tags specifically
                    if (/<b\s*>|<b\s+[^>]*>|<i\s*>|<i\s+[^>]*>/i.test(line)) {
                        violations.push(createViolation(
                            'HC-STYLE-10',
                            'Use <strong> instead of <b>, and <em> instead of <i> for semantic emphasis.',
                            'high',
                            i + 1,
                            lines,
                            filename
                        ));
                    }
                }
            });
            return violations;
        }
    },

    // ── HC-STYLE-04: Multimedia Fallback (Alt text) ──
    {
        id: 'HC-STYLE-04',
        name: 'Multimedia Fallback',
        description: 'Provide alt attributes for images and alternative contents for multimedia.',
        severity: 'high',
        guideSection: '§3.1.4',
        guideUrl: 'https://google.github.io/styleguide/htmlcssguide.html#Multimedia_Fallback',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getHTMLCleanLines(lines);
            searchLines.forEach((line, i) => {
                // <img> missing alt=
                if (/<img\s+[^>]*>/i.test(line) && !/\balt\s*=/i.test(line)) {
                    if (line.includes('>')) {
                        violations.push(createViolation(
                            'HC-STYLE-04',
                            '<img> tags must have an "alt" attribute for accessibility.',
                            'high',
                            i + 1,
                            lines,
                            filename
                        ));
                    }
                }
            });
            return violations;
        }
    },

    // ── HC-STYLE-08: Separation of Concerns ──
    {
        id: 'HC-STYLE-08',
        name: 'Separation of Concerns',
        description: 'Strictly keep structure (markup), presentation (styling), and behavior (scripting) apart. Use external CSS and JS.',
        severity: 'medium',
        guideSection: '§3.1.5',
        guideUrl: 'https://google.github.io/styleguide/htmlcssguide.html#Separation_of_Concerns',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getHTMLCleanLines(lines);
            searchLines.forEach((line, i) => {
                // Catch style="..." inline styles on HTML elements
                if (/<[a-z][^>]*\sstyle\s*=\s*["'][^"']+["']/i.test(line)) {
                    violations.push(createViolation(
                        'HC-STYLE-08',
                        'Avoid inline styles. Use external CSS classes instead.',
                        'medium',
                        i + 1,
                        lines,
                        filename
                    ));
                }
            });
            return violations;
        }
    },

    // ── HC-STYLE-03: Entity References ──
    {
        id: 'HC-STYLE-03',
        name: 'Entity References',
        description: 'Do not use entity references for characters safely represented in UTF-8. Exception: HTML special characters (&, <, >) and invisible characters.',
        severity: 'low',
        guideSection: '§3.1.6',
        guideUrl: 'https://google.github.io/styleguide/htmlcssguide.html#Entity_References',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getHTMLCleanLines(lines);
            searchLines.forEach((line, i) => {
                // Common forbidden entities (except reserved ones: &lt; &gt; &amp; &quot; &nbsp;)
                if (/&(?:mdash|ndash|ldquo|rdquo|lsquo|rsquo|copy|reg|trade|#\d{2,});/.test(line)) {
                    violations.push(createViolation(
                        'HC-STYLE-03',
                        'Do not use entity references for characters safely represented in UTF-8 (e.g., use the actual character instead of &mdash;).',
                        'low',
                        i + 1,
                        lines,
                        filename
                    ));
                }
            });
            return violations;
        }
    },

    // ── HC-STYLE-11: Optional Tags ──
    {
        id: 'HC-STYLE-11',
        name: 'Optional Tags',
        description: 'Consider omitting optional tags (e.g., <html>, <head>, <body>, <tbody>) for file size optimization.',
        severity: 'low',
        guideSection: '§3.1.7',
        guideUrl: 'https://google.github.io/styleguide/htmlcssguide.html#Optional_Tags',
        // This is advisory; we only flag the most detectable case: explicit </body></html> closing tags
        // in otherwise minimal documents. This is low severity and informational.
        check: (lines, filename, cleanLines) => {
            // §3.1.7 — Optional tags are a recommendation, not a hard lint.
            // Flagging omission is subjective; deferred to AI deep review layer.
            return [];
        }
    },

    // ── HC-STYLE-05: Type Attributes ──
    {
        id: 'HC-STYLE-05',
        name: 'type Attributes',
        description: 'Omit type attributes for style sheets and scripts. HTML5 implies text/css and text/javascript.',
        severity: 'low',
        guideSection: '§3.1.8',
        guideUrl: 'https://google.github.io/styleguide/htmlcssguide.html#type_Attributes',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getHTMLCleanLines(lines);
            searchLines.forEach((line, i) => {
                if (/<link[^>]+type\s*=\s*["']text\/css["'][^>]*>/i.test(line) ||
                    /<style[^>]+type\s*=\s*["']text\/css["'][^>]*>/i.test(line)) {
                    violations.push(createViolation(
                        'HC-STYLE-05',
                        'Omit type="text/css" from style and link tags.',
                        'low',
                        i + 1,
                        lines,
                        filename
                    ));
                }
                if (/<script[^>]+type\s*=\s*["']text\/javascript["'][^>]*>/i.test(line)) {
                    violations.push(createViolation(
                        'HC-STYLE-05',
                        'Omit type="text/javascript" from script tags.',
                        'low',
                        i + 1,
                        lines,
                        filename
                    ));
                }
            });
            return violations;
        }
    },

    // ════════════════════════════════════════════════════════════════════
    //  HTML FORMATTING RULES
    // ════════════════════════════════════════════════════════════════════

    // ── HC-FMT-04: HTML Line-Wrapping ──
    {
        id: 'HC-FMT-04',
        name: 'HTML Line-Wrapping',
        description: 'Break long lines for readability. While there is no column limit for HTML, consider wrapping long lines.',
        severity: 'low',
        guideSection: '§3.2.1',
        guideUrl: 'https://google.github.io/styleguide/htmlcssguide.html#General_Formatting',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            // Raw lines for length check (whitespace rule)
            lines.forEach((line, i) => {
                if (line.length > 200 && /<[a-z]/i.test(line)) {
                    violations.push(createViolation(
                        'HC-FMT-04',
                        'Consider wrapping long lines (>200 chars) for readability.',
                        'low',
                        i + 1,
                        lines,
                        filename
                    ));
                }
            });
            return violations;
        }
    },

    // ── HC-STYLE-06: Quotation Marks (HTML attributes) ──
    {
        id: 'HC-STYLE-06',
        name: 'HTML Quotation Marks',
        description: 'Use double ("") rather than single (\'\') quotation marks around attribute values.',
        severity: 'low',
        guideSection: '§3.2.2',
        guideUrl: 'https://google.github.io/styleguide/htmlcssguide.html#HTML_Quotation_Marks',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getHTMLCleanLines(lines);
            searchLines.forEach((line, i) => {
                // Match HTML attributes with single quotes: attr='value'
                // Must be inside an HTML tag (< ... >), not inside <style> or <script> content
                if (/<[a-z][^>]*\s\w+\s*='[^']*'/i.test(line)) {
                    violations.push(createViolation(
                        'HC-STYLE-06',
                        'Use double quotes ("") for HTML attribute values, not single quotes.',
                        'low',
                        i + 1,
                        lines,
                        filename
                    ));
                }
            });
            return violations;
        }
    },

    // ── HC-STYLE-09: Self-Closing Void Elements ──
    {
        id: 'HC-STYLE-09',
        name: 'Void Elements',
        description: 'Do not close void elements (e.g., use <br> not <br/>). HTML5 does not require self-closing.',
        severity: 'low',
        guideSection: '§3.1.1',
        guideUrl: 'https://google.github.io/styleguide/htmlcssguide.html#Document_Type',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getHTMLCleanLines(lines);
            const voidElements = ['br', 'hr', 'img', 'input', 'link', 'meta', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr'];
            searchLines.forEach((line, i) => {
                for (const el of voidElements) {
                    const regex = new RegExp(`<${el}\\b[^>]*/\\s*>`, 'i');
                    if (regex.test(line)) {
                        violations.push(createViolation(
                            'HC-STYLE-09',
                            `Do not self-close void element <${el}>. Use <${el}> instead of <${el} />.`,
                            'low',
                            i + 1,
                            lines,
                            filename
                        ));
                        break; // One violation per line
                    }
                }
            });
            return violations;
        }
    },

    // ════════════════════════════════════════════════════════════════════
    //  CSS STYLE RULES
    // ════════════════════════════════════════════════════════════════════

    // §4.1.1 CSS Validity -- deferred to AI deep review layer (requires CSS parser)

    // ── HC-CSS-02: ID Selectors ──
    {
        id: 'HC-CSS-02',
        name: 'ID Selectors',
        description: 'Avoid ID selectors. Prefer class selectors for styling.',
        severity: 'low',
        guideSection: '§4.1.2',
        guideUrl: 'https://google.github.io/styleguide/htmlcssguide.html#ID_Selectors',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getHTMLCleanLines(lines);
            searchLines.forEach((line, i) => {
                // Only check lines that look like CSS selectors (not HTML tags)
                if (/<[a-zA-Z]/.test(line)) return;
                // Match #id selectors, avoiding hex colors (#fff, #123456)
                const matches = line.matchAll(/(?:^|[\s,{])#([a-zA-Z][a-zA-Z0-9_-]*)\s*[{,.:\s]/g);
                for (const m of matches) {
                    // Skip if preceded by a colon (property value context like color: #red)
                    const prefix = line.slice(0, Math.max(0, line.indexOf(m[0])));
                    if (/:\s*$/.test(prefix)) continue;
                    violations.push(createViolation(
                        'HC-CSS-02',
                        `ID selector '#${m[1]}' is discouraged. Use classes instead.`,
                        'low',
                        i + 1,
                        lines,
                        filename
                    ));
                    break; // One violation per line
                }
            });
            return violations;
        }
    },

    // ── HC-CSS-01: Class Naming ──
    {
        id: 'HC-CSS-01',
        name: 'Class Naming',
        description: 'Use meaningful, generic class names. Use lowercase and separate words with hyphens.',
        severity: 'medium',
        guideSection: '§4.1.3',
        guideUrl: 'https://google.github.io/styleguide/htmlcssguide.html#ID_and_Class_Naming',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getHTMLCleanLines(lines);
            searchLines.forEach((line, i) => {
                // Only check CSS selector lines, not HTML
                if (/<[a-zA-Z]/.test(line) || /^\s*$/.test(line)) return;
                const match = line.match(/\.([A-Za-z0-9_-]+)/g);
                if (match) {
                    for (const m of match) {
                        const name = m.substring(1);
                        if (/^\d/.test(name)) continue;
                        // Check for underscores or camelCase
                        if (name !== name.toLowerCase() || name.includes('_')) {
                            violations.push(createViolation(
                                'HC-CSS-01',
                                `Class name '${name}' must be lowercase with hyphens as separators, not underscores or camelCase.`,
                                'medium',
                                i + 1,
                                lines,
                                filename
                            ));
                        }
                    }
                }
            });
            return violations;
        }
    },

    // ── HC-CSS-11: Class Name Style ──
    {
        id: 'HC-CSS-11',
        name: 'Class Name Style',
        description: 'Use class names that are as short as possible but as long as necessary. Avoid presentational or cryptic names.',
        severity: 'low',
        guideSection: '§4.1.4',
        guideUrl: 'https://google.github.io/styleguide/htmlcssguide.html#ID_and_Class_Name_Style',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getHTMLCleanLines(lines);
            // Presentational class names to flag
            const presentational = /\.(red|blue|green|yellow|left|right|big|small|bold|italic|float-left|float-right|clear)\b/i;
            searchLines.forEach((line, i) => {
                if (/<[a-zA-Z]/.test(line)) return;
                if (presentational.test(line)) {
                    const m = line.match(presentational);
                    if (m) {
                        violations.push(createViolation(
                            'HC-CSS-11',
                            `Class name '${m[1]}' appears presentational. Use functional/generic names instead.`,
                            'low',
                            i + 1,
                            lines,
                            filename
                        ));
                    }
                }
            });
            return violations;
        }
    },

    // §4.1.6 Prefixes -- deferred to AI deep review layer (project-specific check)
    // §4.1.7 Hacks -- deferred to AI deep review layer (requires broader context)

    // ════════════════════════════════════════════════════════════════════
    //  CSS FORMATTING RULES
    // ════════════════════════════════════════════════════════════════════

    // ── HC-CSS-12: Declaration Block Separation ──
    {
        id: 'HC-CSS-12',
        name: 'Declaration Block Separation',
        description: 'Use a space before the opening brace of declaration blocks. Place opening brace on same line as the last selector.',
        severity: 'low',
        guideSection: '§4.2.5',
        guideUrl: 'https://google.github.io/styleguide/htmlcssguide.html#Declaration_Block_Separation',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getHTMLCleanLines(lines);
            searchLines.forEach((line, i) => {
                // Flag missing space before {  e.g. ".foo{" should be ".foo {"
                // Only for CSS selector lines (not HTML)
                if (/<[a-zA-Z]/.test(line)) return;
                if (/\S\{/.test(line) && /^[^{}]*\{/.test(line.trim())) {
                    // Exclude lines that are pure braces or HTML
                    if (!/^\s*\{/.test(line) && !/^\s*</.test(line)) {
                        violations.push(createViolation(
                            'HC-CSS-12',
                            'Put a space before the opening brace { in CSS rule blocks.',
                            'low',
                            i + 1,
                            lines,
                            filename
                        ));
                    }
                }
            });
            return violations;
        }
    },

    // ── HC-CSS-13: Property Name Stops ──
    {
        id: 'HC-CSS-13',
        name: 'Property Name Stops',
        description: 'Use a space after a property name colon. Do not use a space before the colon.',
        severity: 'low',
        guideSection: '§4.2.4',
        guideUrl: 'https://google.github.io/styleguide/htmlcssguide.html#Property_Name_Stops',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getHTMLCleanLines(lines);
            searchLines.forEach((line, i) => {
                // Only check CSS declaration lines
                const trimmed = line.trim();
                if (!/^\s*[a-z][a-z-]*\s*:/i.test(trimmed)) return;
                if (/<[a-zA-Z]/.test(line)) return;

                // No space after colon: "color:#fff"
                if (/^\s*[a-z][a-z-]*:[^\s]/i.test(trimmed)) {
                    violations.push(createViolation(
                        'HC-CSS-13',
                        'Add a space after the colon in CSS declarations.',
                        'low',
                        i + 1,
                        lines,
                        filename
                    ));
                }
                // Space before colon: "color : #fff"
                if (/^\s*[a-z][a-z-]*\s+:/i.test(trimmed)) {
                    violations.push(createViolation(
                        'HC-CSS-13',
                        'Do not use a space before the colon in CSS declarations.',
                        'low',
                        i + 1,
                        lines,
                        filename
                    ));
                }
            });
            return violations;
        }
    },

    // ── HC-CSS-03: Selector and Declaration Separation ──
    {
        id: 'HC-CSS-03',
        name: 'Selector and Declaration Separation',
        description: 'Separate selectors and declarations by new lines. Always start a new line for each selector and declaration.',
        severity: 'low',
        guideSection: '§4.2.6',
        guideUrl: 'https://google.github.io/styleguide/htmlcssguide.html#Selector_and_Declaration_Separation',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getHTMLCleanLines(lines);
            searchLines.forEach((line, i) => {
                if (/<[a-zA-Z]/.test(line)) return;
                const trimmed = line.trim();

                // Multiple declarations on one line (2+ semicolons, not in a selector context)
                const semiCount = (trimmed.match(/;/g) || []).length;
                if (semiCount > 1 && /[a-z-]+\s*:\s*[^;]+;/.test(trimmed)) {
                    violations.push(createViolation(
                        'HC-CSS-03',
                        'Put each CSS declaration on its own line.',
                        'low',
                        i + 1,
                        lines,
                        filename
                    ));
                }

                // Multiple selectors on one line separated by comma (e.g. "h1, h2, h3 {")
                // Only flag if there's a comma and an opening brace suggesting it's a selector list
                if (/,\s*\S/.test(trimmed) && trimmed.includes('{')) {
                    violations.push(createViolation(
                        'HC-CSS-03',
                        'Put each CSS selector on its own line.',
                        'low',
                        i + 1,
                        lines,
                        filename
                    ));
                }
            });
            return violations;
        }
    },

    // ── HC-CSS-14: Rule Separation ──
    {
        id: 'HC-CSS-14',
        name: 'Rule Separation',
        description: 'Separate rules by blank lines. Put a blank line between rule blocks.',
        severity: 'low',
        guideSection: '§4.2.7',
        guideUrl: 'https://google.github.io/styleguide/htmlcssguide.html#Rule_Separation',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getHTMLCleanLines(lines);
            for (let i = 1; i < searchLines.length; i++) {
                const line = searchLines[i].trim();
                const prevLine = searchLines[i - 1].trim();
                if (/<[a-zA-Z]/.test(line)) continue;
                // A closing brace followed immediately by a selector on next line
                if (prevLine === '}' && line.length > 0 && line !== '}' && !line.startsWith('<') && /^[.#@a-z*:\[]/i.test(line)) {
                    violations.push(createViolation(
                        'HC-CSS-14',
                        'Add a blank line between CSS rule blocks.',
                        'low',
                        i + 1,
                        lines,
                        filename
                    ));
                }
            }
            return violations;
        }
    },

    // ── HC-CSS-15: CSS Quotation Marks ──
    {
        id: 'HC-CSS-15',
        name: 'CSS Quotation Marks',
        description: 'Use single (\'\') rather than double ("") quotation marks for attribute selectors and property values.',
        severity: 'low',
        guideSection: '§4.2.8',
        guideUrl: 'https://google.github.io/styleguide/htmlcssguide.html#CSS_Quotation_Marks',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getHTMLCleanLines(lines);
            searchLines.forEach((line, i) => {
                if (/<[a-zA-Z]/.test(line)) return;
                // Check for double quotes in CSS property values (font-family, content, etc.)
                // e.g. font-family: "Arial" should be font-family: 'Arial'
                if (/^\s*[a-z][a-z-]*\s*:.*"[^"]*"/.test(line)) {
                    violations.push(createViolation(
                        'HC-CSS-15',
                        'Use single quotes in CSS property values instead of double quotes.',
                        'low',
                        i + 1,
                        lines,
                        filename
                    ));
                }
                // Attribute selectors with double quotes: [type="text"] should be [type='text']
                if (/\[[^\]]*=\s*"[^"]*"\s*\]/.test(line)) {
                    violations.push(createViolation(
                        'HC-CSS-15',
                        'Use single quotes in CSS attribute selectors instead of double quotes.',
                        'low',
                        i + 1,
                        lines,
                        filename
                    ));
                }
            });
            return violations;
        }
    },

    // ── HC-CSS-08: Declaration Semicolons ──
    {
        id: 'HC-CSS-08',
        name: 'Declaration Stops',
        description: 'Use a semicolon after every CSS declaration, including the last one in a block.',
        severity: 'low',
        guideSection: '§4.2.3',
        guideUrl: 'https://google.github.io/styleguide/htmlcssguide.html#Declaration_Stops',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getHTMLCleanLines(lines);
            searchLines.forEach((line, i) => {
                const trimmed = line.trim();
                // CSS property declarations: "property: value" that don't end with ; or { or ,
                if (/^\s*[a-z][a-z-]*\s*:/.test(trimmed) &&
                    !trimmed.endsWith(';') &&
                    !trimmed.endsWith('{') &&
                    !trimmed.endsWith(',') &&
                    !/<[a-zA-Z]/.test(line)) {
                    // Check if the next non-blank line is a closing brace (last declaration)
                    const nextLine = searchLines.slice(i + 1).find(l => l.trim().length > 0);
                    if (nextLine && nextLine.trim().startsWith('}')) {
                        violations.push(createViolation(
                            'HC-CSS-08',
                            'Add a trailing semicolon after the last CSS declaration in a block.',
                            'low',
                            i + 1,
                            lines,
                            filename
                        ));
                    }
                }
            });
            return violations;
        }
    },

    // ── HC-CSS-09: Property Name Lowercase ──
    {
        id: 'HC-CSS-09',
        name: 'Property Name Lowercase',
        description: 'CSS property names must be lowercase.',
        severity: 'medium',
        guideSection: '§2.2.2',
        guideUrl: 'https://google.github.io/styleguide/htmlcssguide.html#Capitalization',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getHTMLCleanLines(lines);
            searchLines.forEach((line, i) => {
                if (/<[a-zA-Z]/.test(line)) return;
                // Match CSS property: "  Property-Name: value;"
                const match = line.match(/^\s+([A-Z][a-zA-Z-]+)\s*:/);
                if (match) {
                    violations.push(createViolation(
                        'HC-CSS-09',
                        `CSS property '${match[1]}' should be lowercase.`,
                        'medium',
                        i + 1,
                        lines,
                        filename
                    ));
                }
            });
            return violations;
        }
    },

    // ════════════════════════════════════════════════════════════════════
    //  CSS META RULES
    // ════════════════════════════════════════════════════════════════════

    // ── HC-CSS-05: Shorthand Properties ──
    {
        id: 'HC-CSS-05',
        name: 'Shorthand Properties',
        description: 'Use shorthand properties where possible (e.g., font, margin, padding, border, background).',
        severity: 'low',
        guideSection: '§4.3.1',
        guideUrl: 'https://google.github.io/styleguide/htmlcssguide.html#Shorthand_Properties',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getHTMLCleanLines(lines);
            const fullText = searchLines.join('\n');

            // Check for longhand border properties that could be shorthand
            if (fullText.includes('border-top:') && fullText.includes('border-right:') && fullText.includes('border-bottom:')) {
                const lineIndex = searchLines.findIndex(l => l.includes('border-top:'));
                violations.push(createViolation(
                    'HC-CSS-05',
                    'Use shorthand "border" instead of individual border-top/right/bottom/left properties.',
                    'low',
                    (lineIndex >= 0 ? lineIndex : 0) + 1,
                    lines,
                    filename
                ));
            }
            // Check for longhand margin properties
            if (fullText.includes('margin-top:') && fullText.includes('margin-right:') &&
                fullText.includes('margin-bottom:') && fullText.includes('margin-left:')) {
                const lineIndex = searchLines.findIndex(l => l.includes('margin-top:'));
                violations.push(createViolation(
                    'HC-CSS-05',
                    'Use shorthand "margin" instead of individual margin-top/right/bottom/left properties.',
                    'low',
                    (lineIndex >= 0 ? lineIndex : 0) + 1,
                    lines,
                    filename
                ));
            }
            // Check for longhand padding properties
            if (fullText.includes('padding-top:') && fullText.includes('padding-right:') &&
                fullText.includes('padding-bottom:') && fullText.includes('padding-left:')) {
                const lineIndex = searchLines.findIndex(l => l.includes('padding-top:'));
                violations.push(createViolation(
                    'HC-CSS-05',
                    'Use shorthand "padding" instead of individual padding-top/right/bottom/left properties.',
                    'low',
                    (lineIndex >= 0 ? lineIndex : 0) + 1,
                    lines,
                    filename
                ));
            }
            return violations;
        }
    },

    // ── HC-CSS-04: Zero Values ──
    {
        id: 'HC-CSS-04',
        name: '0 and Units',
        description: 'Omit unit specification after 0 values unless required. Always include a leading 0 for decimal values.',
        severity: 'low',
        guideSection: '§4.3.2',
        guideUrl: 'https://google.github.io/styleguide/htmlcssguide.html#0_and_Units',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getHTMLCleanLines(lines);
            searchLines.forEach((line, i) => {
                if (/<[a-zA-Z]/.test(line)) return;
                // 0px, 0em, 0rem, 0%, 0vw, 0vh etc.
                if (/\b0(?:px|em|rem|%|vw|vh|vmin|vmax|pt|cm|mm|in)\b/.test(line)) {
                    violations.push(createViolation(
                        'HC-CSS-04',
                        'Omit units after 0 values (e.g., "margin: 0" instead of "margin: 0px").',
                        'low',
                        i + 1,
                        lines,
                        filename
                    ));
                }
                // Missing leading zero: .5em should be 0.5em
                if (/(?:[\s:,])\.\d+(?:px|em|rem|%|s|ms)?\b/.test(line)) {
                    violations.push(createViolation(
                        'HC-CSS-04',
                        'Include leading zeros in decimal values (e.g., "0.5" instead of ".5").',
                        'low',
                        i + 1,
                        lines,
                        filename
                    ));
                }
            });
            return violations;
        }
    },

    // ── HC-CSS-07: Hex Color Shorthand ──
    {
        id: 'HC-CSS-07',
        name: 'Hexadecimal Notation',
        description: 'Use 3-character hexadecimal notation where possible and lowercase hex digits.',
        severity: 'low',
        guideSection: '§4.3.4',
        guideUrl: 'https://google.github.io/styleguide/htmlcssguide.html#Hexadecimal_Notation',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getHTMLCleanLines(lines);
            searchLines.forEach((line, i) => {
                if (/<[a-zA-Z]/.test(line)) return;
                // Match 6-char hex where pairs are identical: #aabbcc -> #abc
                const hexMatches = line.matchAll(/#([0-9a-fA-F]{6})\b/g);
                for (const m of hexMatches) {
                    const hex = m[1].toLowerCase();
                    if (hex[0] === hex[1] && hex[2] === hex[3] && hex[4] === hex[5]) {
                        violations.push(createViolation(
                            'HC-CSS-07',
                            `Use shorthand hex #${hex[0]}${hex[2]}${hex[4]} instead of #${hex}. Use lowercase.`,
                            'low',
                            i + 1,
                            lines,
                            filename
                        ));
                    }
                    // Also flag uppercase hex
                    if (m[1] !== m[1].toLowerCase()) {
                        violations.push(createViolation(
                            'HC-CSS-07',
                            `Use lowercase hex notation: #${m[1].toLowerCase()} instead of #${m[1]}.`,
                            'low',
                            i + 1,
                            lines,
                            filename
                        ));
                    }
                }
                // 3-char hex uppercase check
                const shortHexMatches = line.matchAll(/#([0-9a-fA-F]{3})\b(?![0-9a-fA-F])/g);
                for (const m of shortHexMatches) {
                    if (m[1] !== m[1].toLowerCase()) {
                        violations.push(createViolation(
                            'HC-CSS-07',
                            `Use lowercase hex notation: #${m[1].toLowerCase()} instead of #${m[1]}.`,
                            'low',
                            i + 1,
                            lines,
                            filename
                        ));
                    }
                }
            });
            return violations;
        }
    },

    // ── HC-CSS-06: URI Quotes ──
    {
        id: 'HC-CSS-06',
        name: 'URI Values',
        description: 'Do not use quotes in url() values.',
        severity: 'low',
        guideSection: '§4.3.6',
        guideUrl: 'https://google.github.io/styleguide/htmlcssguide.html#URI_Values',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getHTMLCleanLines(lines);
            searchLines.forEach((line, i) => {
                if (/<[a-zA-Z]/.test(line)) return;
                if (/url\(\s*(['"])[^)]*\1\s*\)/.test(line)) {
                    violations.push(createViolation(
                        'HC-CSS-06',
                        'Do not use quotes in url() values.',
                        'low',
                        i + 1,
                        lines,
                        filename
                    ));
                }
            });
            return violations;
        }
    },

    // ── HC-CSS-10: Hardcoded Colors (Extension) ──
    {
        id: 'HC-CSS-10',
        name: 'CSS Variables for Colors',
        description: 'Consider using CSS custom properties (variables) for repeated color values.',
        severity: 'low',
        guideSection: '§4.1',
        guideUrl: 'https://google.github.io/styleguide/htmlcssguide.html',
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getHTMLCleanLines(lines);
            searchLines.forEach((line, i) => {
                if (/<[a-zA-Z]/.test(line)) return;
                // Only flag CSS property declarations with hardcoded colors
                if (/^\s*[a-z][a-z-]*\s*:/.test(line.trim())) {
                    if (/(?:color|background|border)[^:]*:\s*(?:#[0-9a-fA-F]{3,6}|rgb\([^)]+\)|rgba\([^)]+\))\b/.test(line) && !line.includes('var(')) {
                        violations.push(createViolation(
                            'HC-CSS-10',
                            'Consider using CSS custom properties (e.g., var(--color-primary)) instead of hardcoded hex/rgb colors.',
                            'low',
                            i + 1,
                            lines,
                            filename
                        ));
                    }
                }
            });
            return violations;
        }
    },
];
