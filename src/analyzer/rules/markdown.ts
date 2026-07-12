import { Rule, Violation } from '../../types.js';

/**
 * Markdown rules based on the Google Developer Documentation Style Guide.
 * https://developers.google.com/style/
 *
 * The tokenizer strips content inside fenced code blocks so that pattern-matching
 * rules do not fire on code examples. Whitespace / formatting rules that need the
 * literal text operate on raw `lines` instead.
 */

// ── Tokenizer ──────────────────────────────────────────────────────────

export function getMarkdownCleanLines(lines: string[]): string[] {
    const code = lines.join('\n');
    let cleanCode = '';

    let inCodeBlock = false;
    let i = 0;

    while (i < code.length) {
        const char = code[i];

        if (char === '\n') {
            cleanCode += '\n';
            i++;
            continue;
        }

        // Check for fenced code blocks (``` or ~~~)
        if ((char === '`' && code.startsWith('```', i)) ||
            (char === '~' && code.startsWith('~~~', i))) {
            const fence = code.substring(i, i + 3);
            const eol = code.indexOf('\n', i);
            if (!inCodeBlock) {
                // Opening fence: keep the line (for language-tag checks) but blank the inside
                cleanCode += code.substring(i, eol !== -1 ? eol : code.length);
                i = eol !== -1 ? eol : code.length;
                inCodeBlock = true;
                continue;
            } else {
                // Closing fence
                cleanCode += fence;
                i += 3;
                inCodeBlock = false;
                continue;
            }
        }

        if (inCodeBlock) {
            cleanCode += ' ';
            i++;
        } else {
            cleanCode += char;
            i++;
        }
    }

    return cleanCode.split('\n');
}

// ── Helpers ────────────────────────────────────────────────────────────

const GUIDE_BASE = 'https://developers.google.com/style';

const createViolation = (
    ruleId: string,
    ruleName: string,
    message: string,
    severity: 'critical' | 'high' | 'medium' | 'low',
    line: number,
    rawLines: string[],
    guideUrl: string,
    filename?: string
): Violation => ({
    ruleId,
    ruleName,
    severity,
    line,
    column: 1,
    message,
    suggestion: 'Follow the Google Developer Documentation Style Guide.',
    guideUrl,
    codeSnippet: rawLines[line - 1]?.trim() || '',
});

// ── Rules ──────────────────────────────────────────────────────────────

export const markdownRules: Rule[] = [

    // ── MD-FMT-01: ATX Headers ──
    {
        id: 'MD-FMT-01',
        name: 'ATX Headers',
        description: 'Use ATX-style headers (# Header) instead of setext-style (======).',
        severity: 'low',
        guideSection: '§Headings',
        guideUrl: `${GUIDE_BASE}/headings`,
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getMarkdownCleanLines(lines);
            searchLines.forEach((line, i) => {
                if (/^(?:={3,}|-{3,})\s*$/.test(line) && i > 0 && searchLines[i - 1].trim().length > 0) {
                    violations.push(createViolation(
                        'MD-FMT-01', 'ATX Headers',
                        'Use ATX headers (e.g., # Header) instead of setext underlining (=== or ---).',
                        'low', i + 1, lines,
                        `${GUIDE_BASE}/headings`, filename
                    ));
                }
            });
            return violations;
        }
    },

    // ── MD-FMT-02: Header Spacing ──
    {
        id: 'MD-FMT-02',
        name: 'Header Spacing',
        description: 'Headers must have a space after the hash marks.',
        severity: 'low',
        guideSection: '§Headings',
        guideUrl: `${GUIDE_BASE}/headings`,
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getMarkdownCleanLines(lines);
            searchLines.forEach((line, i) => {
                if (/^#{1,6}[^\s#]/.test(line)) {
                    violations.push(createViolation(
                        'MD-FMT-02', 'Header Spacing',
                        'Put a space after the header hashes (e.g., "## Header", not "##Header").',
                        'low', i + 1, lines,
                        `${GUIDE_BASE}/headings`, filename
                    ));
                }
            });
            return violations;
        }
    },

    // ── MD-FMT-03: Trailing Whitespace ──
    // Whitespace rule: intentionally uses raw lines.
    {
        id: 'MD-FMT-03',
        name: 'Trailing Whitespace',
        description: 'Do not leave trailing whitespace at the ends of lines.',
        severity: 'low',
        guideSection: '§Whitespace',
        guideUrl: `${GUIDE_BASE}/formatting`,
        check: (lines, filename) => {
            const violations: Violation[] = [];
            lines.forEach((line, i) => {
                if (/[ \t]+\r?$/.test(line)) {
                    violations.push(createViolation(
                        'MD-FMT-03', 'Trailing Whitespace',
                        'Remove trailing whitespace from the end of the line.',
                        'low', i + 1, lines,
                        `${GUIDE_BASE}/formatting`, filename
                    ));
                }
            });
            return violations;
        }
    },

    // ── MD-FMT-04: Blank Lines around Code Blocks ──
    {
        id: 'MD-FMT-04',
        name: 'Blank Lines around Code Blocks',
        description: 'Code blocks must be preceded by a blank line.',
        severity: 'low',
        guideSection: '§Code formatting',
        guideUrl: `${GUIDE_BASE}/code-in-text`,
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getMarkdownCleanLines(lines);
            searchLines.forEach((line, i) => {
                if (/^(`{3}|~{3})/.test(line) && i > 0) {
                    const prevLine = searchLines[i - 1].trim();
                    if (prevLine !== '' && !/^(`{3}|~{3})/.test(prevLine)) {
                        violations.push(createViolation(
                            'MD-FMT-04', 'Blank Lines around Code Blocks',
                            'Put a blank line before code blocks.',
                            'low', i + 1, lines,
                            `${GUIDE_BASE}/code-in-text`, filename
                        ));
                    }
                }
            });
            return violations;
        }
    },

    // ── MD-FMT-05: Blank Line after Heading ──
    {
        id: 'MD-FMT-05',
        name: 'Blank Line after Heading',
        description: 'Headings must be followed by a blank line before body content.',
        severity: 'low',
        guideSection: '§Headings',
        guideUrl: `${GUIDE_BASE}/headings`,
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getMarkdownCleanLines(lines);
            for (let i = 0; i < searchLines.length - 1; i++) {
                if (/^#{1,6}\s+/.test(searchLines[i])) {
                    const nextLine = searchLines[i + 1].trim();
                    if (nextLine !== '' && !/^#{1,6}\s+/.test(searchLines[i + 1])) {
                        violations.push(createViolation(
                            'MD-FMT-05', 'Blank Line after Heading',
                            'Add a blank line after headings before the body text.',
                            'low', i + 1, lines,
                            `${GUIDE_BASE}/headings`, filename
                        ));
                    }
                }
            }
            return violations;
        }
    },

    // ── MD-FMT-06: No Heading Level Skip ──
    {
        id: 'MD-FMT-06',
        name: 'No Heading Level Skip',
        description: 'Do not skip heading levels (e.g., # followed by ### with no ##).',
        severity: 'medium',
        guideSection: '§Headings',
        guideUrl: `${GUIDE_BASE}/headings`,
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getMarkdownCleanLines(lines);
            let lastLevel = 0;
            searchLines.forEach((line, i) => {
                const match = line.match(/^(#{1,6})\s+/);
                if (match) {
                    const level = match[1].length;
                    if (lastLevel > 0 && level > lastLevel + 1) {
                        violations.push(createViolation(
                            'MD-FMT-06', 'No Heading Level Skip',
                            `Heading level skipped: found h${level} after h${lastLevel}. Do not skip heading levels.`,
                            'medium', i + 1, lines,
                            `${GUIDE_BASE}/headings`, filename
                        ));
                    }
                    lastLevel = level;
                }
            });
            return violations;
        }
    },

    // ── MD-STYLE-01: List Spacing ──
    {
        id: 'MD-STYLE-01',
        name: 'List Spacing',
        description: 'List markers must have a space after the bullet or number.',
        severity: 'low',
        guideSection: '§Lists',
        guideUrl: `${GUIDE_BASE}/lists`,
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getMarkdownCleanLines(lines);
            searchLines.forEach((line, i) => {
                if (/^\s*(?:[-*+]|\d+\.)[^\s]/.test(line)) {
                    violations.push(createViolation(
                        'MD-STYLE-01', 'List Spacing',
                        'Put a space after the list marker (e.g., "- Item", not "-Item").',
                        'low', i + 1, lines,
                        `${GUIDE_BASE}/lists`, filename
                    ));
                }
            });
            return violations;
        }
    },

    // ── MD-STYLE-02: Asterisks for Emphasis ──
    {
        id: 'MD-STYLE-02',
        name: 'Asterisks for Emphasis',
        description: 'Use asterisks (*) for bold/italic instead of underscores (_).',
        severity: 'medium',
        guideSection: '§Text formatting',
        guideUrl: `${GUIDE_BASE}/text-formatting`,
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getMarkdownCleanLines(lines);
            searchLines.forEach((line, i) => {
                // Match _italic_ or __bold__ with word boundaries, but not snake_case
                if (/(^|[\s(])_{1,2}[^\s_].*?[^\s_]_{1,2}([\s,.!?;:)]|$)/.test(line)) {
                    violations.push(createViolation(
                        'MD-STYLE-02', 'Asterisks for Emphasis',
                        'Use asterisks (* or **) instead of underscores (_ or __) for emphasis.',
                        'medium', i + 1, lines,
                        `${GUIDE_BASE}/text-formatting`, filename
                    ));
                }
            });
            return violations;
        }
    },

    // ── MD-STYLE-03: Fenced Code Languages ──
    {
        id: 'MD-STYLE-03',
        name: 'Fenced Code Languages',
        description: 'Fenced code blocks must specify a language identifier.',
        severity: 'high',
        guideSection: '§Code formatting',
        guideUrl: `${GUIDE_BASE}/code-in-text`,
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getMarkdownCleanLines(lines);
            let inCodeBlock = false;
            for (let i = 0; i < searchLines.length; i++) {
                const line = searchLines[i];
                if (/^(`{3}|~{3})/.test(line)) {
                    if (!inCodeBlock) {
                        // Opening fence
                        inCodeBlock = true;
                        if (/^(`{3}|~{3})\s*$/.test(line)) {
                            violations.push(createViolation(
                                'MD-STYLE-03', 'Fenced Code Languages',
                                'Specify a language identifier for fenced code blocks (e.g., ```javascript).',
                                'high', i + 1, lines,
                                `${GUIDE_BASE}/code-in-text`, filename
                            ));
                        }
                    } else {
                        // Closing fence
                        inCodeBlock = false;
                    }
                }
            }
            return violations;
        }
    },

    // ── MD-STYLE-04: Consistent List Markers ──
    {
        id: 'MD-STYLE-04',
        name: 'Consistent List Markers',
        description: 'Use dashes (-) for unordered list markers, not asterisks (*) or plus signs (+).',
        severity: 'low',
        guideSection: '§Lists',
        guideUrl: `${GUIDE_BASE}/lists`,
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getMarkdownCleanLines(lines);
            searchLines.forEach((line, i) => {
                if (/^\s*[*+]\s+/.test(line)) {
                    violations.push(createViolation(
                        'MD-STYLE-04', 'Consistent List Markers',
                        'Use dashes (-) for unordered list markers instead of asterisks (*) or plus signs (+).',
                        'low', i + 1, lines,
                        `${GUIDE_BASE}/lists`, filename
                    ));
                }
            });
            return violations;
        }
    },

    // ── MD-STYLE-05: Lazy Numbering for Ordered Lists ──
    {
        id: 'MD-STYLE-05',
        name: 'Lazy Numbering for Ordered Lists',
        description: 'Use lazy numbering (all 1.) for ordered lists so items can be reordered freely.',
        severity: 'low',
        guideSection: '§Lists',
        guideUrl: `${GUIDE_BASE}/lists`,
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getMarkdownCleanLines(lines);
            let inOrderedList = false;
            let sawNonOne = false;
            let listStartLine = -1;
            for (let i = 0; i < searchLines.length; i++) {
                const line = searchLines[i];
                const orderedMatch = line.match(/^(\s*)(\d+)\.\s/);
                if (orderedMatch) {
                    if (!inOrderedList) {
                        inOrderedList = true;
                        sawNonOne = false;
                        listStartLine = i;
                    }
                    const num = parseInt(orderedMatch[2], 10);
                    if (num !== 1) {
                        sawNonOne = true;
                    }
                } else if (inOrderedList && line.trim() === '') {
                    // Blank line might end the list or be between items
                    continue;
                } else {
                    if (inOrderedList && sawNonOne) {
                        violations.push(createViolation(
                            'MD-STYLE-05', 'Lazy Numbering for Ordered Lists',
                            'Use lazy numbering (1. for every item) in ordered lists for easier reordering.',
                            'low', listStartLine + 1, lines,
                            `${GUIDE_BASE}/lists`, filename
                        ));
                    }
                    inOrderedList = false;
                    sawNonOne = false;
                }
            }
            // Handle list at end of file
            if (inOrderedList && sawNonOne) {
                violations.push(createViolation(
                    'MD-STYLE-05', 'Lazy Numbering for Ordered Lists',
                    'Use lazy numbering (1. for every item) in ordered lists for easier reordering.',
                    'low', listStartLine + 1, lines,
                    `${GUIDE_BASE}/lists`, filename
                ));
            }
            return violations;
        }
    },

    // ── MD-LINK-01: Descriptive Links ──
    {
        id: 'MD-LINK-01',
        name: 'Descriptive Links',
        description: 'Do not use "here", "click here", or "link" as link text.',
        severity: 'medium',
        guideSection: '§Links',
        guideUrl: `${GUIDE_BASE}/link-text`,
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getMarkdownCleanLines(lines);
            const badLinkTexts = ['here', 'click here', 'link', 'this', 'this link', 'page'];
            searchLines.forEach((line, i) => {
                const matches = line.matchAll(/\[([^\]]*)\]\(/g);
                for (const m of matches) {
                    const linkText = m[1].toLowerCase().trim();
                    if (badLinkTexts.includes(linkText)) {
                        violations.push(createViolation(
                            'MD-LINK-01', 'Descriptive Links',
                            `Use descriptive link text instead of "${m[1]}".`,
                            'medium', i + 1, lines,
                            `${GUIDE_BASE}/link-text`, filename
                        ));
                    }
                }
            });
            return violations;
        }
    },

    // ── MD-LINK-02: No Bare URLs ──
    {
        id: 'MD-LINK-02',
        name: 'No Bare URLs',
        description: 'URLs should be wrapped in angle brackets or Markdown links, not left bare.',
        severity: 'low',
        guideSection: '§Links',
        guideUrl: `${GUIDE_BASE}/link-text`,
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getMarkdownCleanLines(lines);
            searchLines.forEach((line, i) => {
                // Match bare URLs not already inside [...](url) or <url>
                // Look for http(s):// that is not preceded by ( or < or ]( or "
                if (/(?<![(<"(\[])https?:\/\/\S+/.test(line) && !/\[.*\]\(https?:\/\//.test(line) && !/<https?:\/\//.test(line)) {
                    violations.push(createViolation(
                        'MD-LINK-02', 'No Bare URLs',
                        'Wrap URLs in Markdown link syntax [text](url) or angle brackets <url>.',
                        'low', i + 1, lines,
                        `${GUIDE_BASE}/link-text`, filename
                    ));
                }
            });
            return violations;
        }
    },

    // ── MD-STRUCT-01: No Raw HTML ──
    {
        id: 'MD-STRUCT-01',
        name: 'No Raw HTML',
        description: 'Avoid using raw HTML in Markdown documents; prefer Markdown syntax.',
        severity: 'medium',
        guideSection: '§HTML',
        guideUrl: `${GUIDE_BASE}/formatting`,
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getMarkdownCleanLines(lines);
            // Common HTML tags that have Markdown equivalents
            const htmlTagPattern = /^\s*<\/?(b|i|em|strong|a|img|br|hr|h[1-6]|p|ul|ol|li|blockquote|pre|code)\b[^>]*>/i;
            searchLines.forEach((line, i) => {
                if (htmlTagPattern.test(line)) {
                    violations.push(createViolation(
                        'MD-STRUCT-01', 'No Raw HTML',
                        'Use Markdown syntax instead of raw HTML tags where possible.',
                        'medium', i + 1, lines,
                        `${GUIDE_BASE}/formatting`, filename
                    ));
                }
            });
            return violations;
        }
    },

    // ── MD-STRUCT-02: Image Alt Text ──
    {
        id: 'MD-STRUCT-02',
        name: 'Image Alt Text',
        description: 'Images must have meaningful alt text.',
        severity: 'high',
        guideSection: '§Images',
        guideUrl: `${GUIDE_BASE}/images`,
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getMarkdownCleanLines(lines);
            searchLines.forEach((line, i) => {
                // Match ![](url) or ![  ](url) -- empty or whitespace-only alt text
                if (/!\[\s*\]\(/.test(line)) {
                    violations.push(createViolation(
                        'MD-STRUCT-02', 'Image Alt Text',
                        'Images must have descriptive alt text: ![description](url).',
                        'high', i + 1, lines,
                        `${GUIDE_BASE}/images`, filename
                    ));
                }
            });
            return violations;
        }
    },

    // ── MD-STRUCT-03: Table Formatting ──
    {
        id: 'MD-STRUCT-03',
        name: 'Table Pipe Alignment',
        description: 'Table rows should begin and end with pipe characters.',
        severity: 'low',
        guideSection: '§Tables',
        guideUrl: `${GUIDE_BASE}/tables`,
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getMarkdownCleanLines(lines);
            for (let i = 0; i < searchLines.length; i++) {
                const line = searchLines[i].trim();
                // Detect table separator row
                if (/^\|?[\s-:|]+\|[\s-:|]+\|?$/.test(line) && line.includes('|')) {
                    // Check surrounding rows for missing leading/trailing pipes
                    const checkRow = (idx: number) => {
                        if (idx < 0 || idx >= searchLines.length) return;
                        const row = searchLines[idx].trim();
                        if (row.includes('|') && (!row.startsWith('|') || !row.endsWith('|'))) {
                            violations.push(createViolation(
                                'MD-STRUCT-03', 'Table Pipe Alignment',
                                'Table rows should begin and end with pipe characters (|).',
                                'low', idx + 1, lines,
                                `${GUIDE_BASE}/tables`, filename
                            ));
                        }
                    };
                    checkRow(i - 1); // header row
                    checkRow(i);     // separator row
                }
            }
            return violations;
        }
    },

    // ── MD-STRUCT-04: Line Length ──
    // Whitespace/formatting rule: intentionally uses raw lines.
    {
        id: 'MD-STRUCT-04',
        name: 'Line Length',
        description: 'Lines should not exceed 100 characters (excluding URLs and tables).',
        severity: 'low',
        guideSection: '§Line length',
        guideUrl: `${GUIDE_BASE}/formatting`,
        check: (lines, filename, cleanLines) => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getMarkdownCleanLines(lines);
            let inCodeBlock = false;
            for (let i = 0; i < lines.length; i++) {
                const raw = lines[i];
                const clean = searchLines[i] || '';
                // Track code blocks
                if (/^(`{3}|~{3})/.test(clean)) {
                    inCodeBlock = !inCodeBlock;
                    continue;
                }
                if (inCodeBlock) continue;
                // Skip table rows and lines that are mostly URLs
                if (raw.includes('|') && /\|.*\|/.test(raw)) continue;
                if (/^\s*https?:\/\//.test(raw)) continue;
                // Skip lines whose length is primarily a URL
                const withoutUrls = raw.replace(/https?:\/\/\S+/g, '');
                if (raw.length > 100 && withoutUrls.length > 100) {
                    violations.push(createViolation(
                        'MD-STRUCT-04', 'Line Length',
                        `Line is ${raw.length} characters. Prefer wrapping at 100 characters.`,
                        'low', i + 1, lines,
                        `${GUIDE_BASE}/formatting`, filename
                    ));
                }
            }
            return violations;
        }
    },

    // §Document layout / YAML front matter -- deferred to AI deep review layer
    // §Reference links vs inline links -- deferred to AI deep review layer (semantic choice)
    // §Table of contents -- deferred to AI deep review layer (whole-document analysis)
];
