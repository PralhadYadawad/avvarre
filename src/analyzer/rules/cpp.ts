/**
 * C++ Rules -- Google C++ Style Guide
 * https://google.github.io/styleguide/cppguide.html
 *
 * Sections covered: Naming, Formatting, Headers, Other Features, Comments,
 * Classes, Functions, Ownership, Scoping, RTTI, Friends, sizeof, Macros, Streams
 *
 * Deferred to AI deep review layer:
 *   Inputs and Outputs, Internal Linkage, Use of const,
 *   Type Deduction (auto), Override detection, Copyable/Movable Types
 */

import { Rule, Violation } from '../../types.js';

// ============================================================================
// HELPER UTILITIES
// ============================================================================

/** Strip string literals and comments from C++ source, preserving line count. */
export function getCleanLines(lines: string[]): string[] {
    const result: string[] = [];
    let inBlockComment = false;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let clean = '';
        let j = 0;
        while (j < line.length) {
            if (inBlockComment) {
                const endIdx = line.indexOf('*/', j);
                if (endIdx === -1) { j = line.length; } else { j = endIdx + 2; inBlockComment = false; }
                continue;
            }
            if (line[j] === '/' && line[j + 1] === '/') break;
            if (line[j] === '/' && line[j + 1] === '*') { inBlockComment = true; j += 2; continue; }
            if (line[j] === '"') {
                if (j > 0 && line[j - 1] === 'R') {
                    clean += 'R""';
                    const closeIdx = line.indexOf(')"', j + 1);
                    j = closeIdx === -1 ? line.length : closeIdx + 2;
                } else {
                    clean += '""'; j++;
                    while (j < line.length && line[j] !== '"') { if (line[j] === '\\') j++; j++; }
                    j++;
                }
                continue;
            }
            if (line[j] === "'") {
                clean += "''"; j++;
                while (j < line.length && line[j] !== "'") { if (line[j] === '\\') j++; j++; }
                j++;
                continue;
            }
            clean += line[j]; j++;
        }
        result.push(clean);
    }
    return result;
}

function isSkippableLine(cl: string): boolean { return cl.trim() === ''; }

function vio(rule: Rule, line: number, snippet: string, msg: string, sug: string): Violation {
    return { ruleId: rule.id, ruleName: rule.name, severity: rule.severity, line, message: msg, suggestion: sug, guideUrl: rule.guideUrl, codeSnippet: snippet };
}

// ============================================================================
// NAMING
// ============================================================================

/** CPP-NAME-01: Type names must be PascalCase */
const typeNamesPascalCase: Rule = {
    id: 'CPP-NAME-01', name: 'Type names must be PascalCase',
    description: 'Type names (classes, structs, enums, typedefs) must be PascalCase: MyExcitingClass.',
    severity: 'medium', guideSection: '§Type Names',
    guideUrl: 'https://google.github.io/styleguide/cppguide.html#Type_Names',
    check(lines, _fn, passedCleanLines) {
        const v: Violation[] = [], sl = passedCleanLines || getCleanLines(lines);
        const csP = /^\s*(?:class|struct)\s+([a-z_]\w*)\b/;
        const ecP = /^\s*enum\s+class\s+([a-z_]\w*)\b/;
        const epP = /^\s*enum\s+(?!class\b)([a-z_]\w*)\b/;
        const tdP = /^\s*typedef\s+\S+\s+([a-z_]\w*)\b/;
        const usP = /^\s*using\s+([a-z_]\w*)\s*=/;
        for (let i = 0; i < lines.length; i++) {
            const cl = sl[i];
            if (isSkippableLine(cl) || /^\s*#/.test(cl)) continue;
            let name: string | null = null;
            const m2 = cl.match(ecP), m2b = cl.match(epP), m3 = cl.match(tdP), m4 = cl.match(usP);
            if (m2) name = m2[1]; else if (m2b) name = m2b[1]; else if (m3) name = m3[1]; else if (m4) name = m4[1];
            else if (!/\benum\b/.test(cl)) { const m1 = cl.match(csP); if (m1) name = m1[1]; }
            if (name && !name.startsWith('__')) {
                const suggest = name.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
                v.push(vio(this, i + 1, lines[i], `Type name "${name}" should be PascalCase (e.g., "${suggest}").`, 'Use PascalCase for type names.'));
            }
        }
        return v;
    },
};

/** CPP-NAME-02: Variables must be snake_case */
const variableNamesSnakeCase: Rule = {
    id: 'CPP-NAME-02', name: 'Variables must be snake_case',
    description: 'Variable names must be all lowercase with underscores: my_variable.',
    severity: 'medium', guideSection: '§Variable Names',
    guideUrl: 'https://google.github.io/styleguide/cppguide.html#Variable_Names',
    check(lines, _fn, passedCleanLines) {
        const v: Violation[] = [], sl = passedCleanLines || getCleanLines(lines);
        const pat = /(?:(?:const|constexpr|static|extern|mutable|inline|thread_local)\s+)*(?:int|char|bool|float|double|auto|std::\w+|string|size_t|long|short|unsigned)(?:\s*\*+&*\s*|\s+&*\s*|\s+)([a-zA-Z_]\w*)\s*(?:[=;)|,\[]|$)/;
        for (let i = 0; i < lines.length; i++) {
            const cl = sl[i];
            if (isSkippableLine(cl)) continue;
            if (/^\s*(?:class|struct|enum|typedef|using|namespace|#|\/\/)/.test(cl)) continue;
            if (/^\s*return\b/.test(cl)) continue;
            if (/^\s*\w+\s+\w+\s*\(/.test(cl) && !/=/.test(cl) && !/;\s*$/.test(cl.trim())) continue;
            const m = cl.match(pat);
            if (m) {
                const name = m[1];
                if (!/^[a-z_][a-z0-9_]*$/.test(name) && !/^k[A-Z]/.test(name) && !/^[A-Z0-9_]+$/.test(name)) {
                    v.push(vio(this, i + 1, lines[i], `Variable "${name}" is not snake_case.`,
                        `Rename to "${name.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '')}".`));
                }
            }
        }
        return v;
    },
};

/** CPP-NAME-03: Constants must use kPrefixedMixedCase */
const constantsKPrefixed: Rule = {
    id: 'CPP-NAME-03', name: 'Constants must use kPrefixedMixedCase',
    description: 'Constants should be named kConstantName, not SCREAMING_SNAKE_CASE.',
    severity: 'medium', guideSection: '§Constant Names',
    guideUrl: 'https://google.github.io/styleguide/cppguide.html#Constant_Names',
    check(lines, _fn, passedCleanLines) {
        const v: Violation[] = [], sl = passedCleanLines || getCleanLines(lines);
        const pat = /^\s*(?:static\s+)?(?:const|constexpr)\s+\w+\s+([A-Z][A-Z_0-9]{2,})\s*[=;]/;
        for (let i = 0; i < lines.length; i++) {
            const cl = sl[i];
            if (isSkippableLine(cl) || /^\s*#/.test(cl)) continue;
            const m = cl.match(pat);
            if (m) {
                const name = m[1];
                const kName = 'k' + name.split('_').map((w: string) => w.charAt(0) + w.slice(1).toLowerCase()).join('');
                v.push(vio(this, i + 1, lines[i], `Constant "${name}" uses SCREAMING_SNAKE_CASE.`, `Rename to "${kName}".`));
            }
        }
        return v;
    },
};

/** CPP-NAME-04: Functions must be PascalCase */
const functionNamesPascalCase: Rule = {
    id: 'CPP-NAME-04', name: 'Functions must be PascalCase',
    description: 'Function names should be PascalCase: AddTableEntry(), not add_table_entry().',
    severity: 'medium', guideSection: '§Function Names',
    guideUrl: 'https://google.github.io/styleguide/cppguide.html#Function_Names',
    check(lines, _fn, passedCleanLines) {
        const v: Violation[] = [], sl = passedCleanLines || getCleanLines(lines);
        const pat = /^\s*(?:(?:virtual|static|inline|explicit|constexpr|const)\s+)*(?:[a-zA-Z_:]+(?:<[^>]+>)?\s+)+(?:[*&]\s*)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/;
        for (let i = 0; i < lines.length; i++) {
            const cl = sl[i];
            if (isSkippableLine(cl) || /^\s*(?:return|if|for|while|switch|catch)\b/.test(cl)) continue;
            const m = cl.match(pat);
            if (!m) continue;
            const name = m[1];
            if (name === 'main' || name.startsWith('operator') || name.startsWith('test_')) continue;
            if (/^(?:set_|get_)\w+/.test(name)) continue;
            if (!name.includes('_') && /^[a-z0-9]+$/.test(name)) continue;
            if (!/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
                const suggest = name.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
                v.push(vio(this, i + 1, lines[i], `Function "${name}" is not PascalCase.`, `Rename to "${suggest}".`));
            }
        }
        return v;
    },
};

/** CPP-NAME-05: Namespace names must be snake_case */
const namespaceNamesSnakeCase: Rule = {
    id: 'CPP-NAME-05', name: 'Namespace names must be snake_case',
    description: 'Namespace names should be all lowercase with underscores.',
    severity: 'low', guideSection: '§Namespace Names',
    guideUrl: 'https://google.github.io/styleguide/cppguide.html#Namespace_Names',
    check(lines, _fn, passedCleanLines) {
        const v: Violation[] = [], sl = passedCleanLines || getCleanLines(lines);
        for (let i = 0; i < lines.length; i++) {
            const cl = sl[i];
            if (isSkippableLine(cl)) continue;
            const m = cl.match(/^\s*namespace\s+([A-Z]\w*|[a-z]\w*[A-Z]\w*)\s*\{?/);
            if (m && m[1] !== 'std' && m[1] !== 'detail') {
                v.push(vio(this, i + 1, lines[i], `Namespace "${m[1]}" is not snake_case.`,
                    `Rename to "${m[1].replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '')}".`));
            }
        }
        return v;
    },
};

/** CPP-NAME-06: Enumerator values must be kPrefixed */
const enumeratorNamesKPrefixed: Rule = {
    id: 'CPP-NAME-06', name: 'Enumerator values must be kPrefixed',
    description: 'Enumerator values should use kEnumName style, not ENUM_NAME.',
    severity: 'medium', guideSection: '§Enumerator Names',
    guideUrl: 'https://google.github.io/styleguide/cppguide.html#Enumerator_Names',
    check(lines, _fn, passedCleanLines) {
        const v: Violation[] = [], sl = passedCleanLines || getCleanLines(lines);
        let inEnum = false, braceDepth = 0;
        for (let i = 0; i < lines.length; i++) {
            const cl = sl[i];
            if (isSkippableLine(cl)) continue;
            if (/^\s*enum\b/.test(cl)) { inEnum = true; braceDepth = 0; }
            if (inEnum) {
                for (const ch of cl) { if (ch === '{') braceDepth++; if (ch === '}') braceDepth--; }
                if (braceDepth > 0) {
                    const vals = cl.match(/\b([A-Z][A-Z_0-9]{2,})\b\s*(?:[=,}]|$)/g);
                    if (vals) for (const val of vals) {
                        const name = val.replace(/[\s=,{}]/g, '');
                        if (name.length > 2 && /^[A-Z][A-Z_0-9]+$/.test(name)) {
                            const kName = 'k' + name.split('_').map((w: string) => w.charAt(0) + w.slice(1).toLowerCase()).join('');
                            v.push(vio(this, i + 1, lines[i], `Enumerator "${name}" uses MACRO_STYLE.`, `Rename to "${kName}".`));
                        }
                    }
                }
                if (braceDepth <= 0 && cl.includes('}')) inEnum = false;
            }
        }
        return v;
    },
};

/** CPP-NAME-07: Macros must be ALL_CAPS */
const macroNamesAllCaps: Rule = {
    id: 'CPP-NAME-07', name: 'Macros must be ALL_CAPS',
    description: 'Macro names must use ALL_CAPS_WITH_UNDERSCORES.',
    severity: 'low', guideSection: '§Macro Names',
    guideUrl: 'https://google.github.io/styleguide/cppguide.html#Macro_Names',
    check(lines, _fn?, _pcl?) {
        const v: Violation[] = [];
        for (let i = 0; i < lines.length; i++) {
            const m = lines[i].match(/^\s*#\s*define\s+([a-z]\w*|[a-z][a-zA-Z]+)\b/);
            if (m && !/_H_?$/.test(m[1])) {
                v.push(vio(this, i + 1, lines[i], `Macro "${m[1]}" is not ALL_CAPS.`,
                    `Rename to "${m[1].replace(/([A-Z])/g, '_$1').toUpperCase().replace(/^_/, '')}".`));
            }
        }
        return v;
    },
};

// ============================================================================
// FORMATTING
// ============================================================================

/** CPP-FMT-01: Use spaces, not tabs */
const noTabs: Rule = {
    id: 'CPP-FMT-01', name: 'Use spaces, not tabs',
    description: 'Use only spaces for indentation. Do not use tabs.',
    severity: 'medium', guideSection: '§Spaces vs. Tabs',
    guideUrl: 'https://google.github.io/styleguide/cppguide.html#Spaces_vs._Tabs',
    check(lines) {
        const v: Violation[] = [];
        for (let i = 0; i < lines.length; i++)
            if (lines[i].includes('\t'))
                v.push(vio(this, i + 1, lines[i], 'Tab character found.', 'Replace tabs with spaces (2 per indent).'));
        return v;
    },
};

/** CPP-FMT-02: 2-space indentation */
const twoSpaceIndent: Rule = {
    id: 'CPP-FMT-02', name: '2-space indentation',
    description: 'Indent 2 spaces at a time.',
    severity: 'low', guideSection: '§Spaces vs. Tabs',
    guideUrl: 'https://google.github.io/styleguide/cppguide.html#Spaces_vs._Tabs',
    check(lines, _fn, passedCleanLines) {
        const v: Violation[] = [], sl = passedCleanLines || getCleanLines(lines);
        for (let i = 0; i < lines.length; i++) {
            if (sl[i].trim() === '' || /^\s*#/.test(lines[i])) continue;
            if (/^\s*(?:public|private|protected)\s*:/.test(sl[i])) continue;
            const m = lines[i].match(/^( +)\S/);
            if (m && m[1].length % 2 !== 0)
                v.push(vio(this, i + 1, lines[i], `Line has ${m[1].length}-space indent (odd).`, 'Use 2-space multiples.'));
        }
        return v;
    },
};

/** CPP-FMT-03: 80-character line length limit */
const lineLengthLimit: Rule = {
    id: 'CPP-FMT-03', name: '80-character line length limit',
    description: 'Lines should be at most 80 characters long.',
    severity: 'low', guideSection: '§Line Length',
    guideUrl: 'https://google.github.io/styleguide/cppguide.html#Line_Length',
    check(lines) {
        const v: Violation[] = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.length <= 80) continue;
            if (/^\s*#\s*include\b/.test(line)) continue;
            if (/^\s*#\s*(?:ifndef|define|endif)\b/.test(line)) continue;
            if (/https?:\/\//.test(line)) continue;
            if (/^\s*".*"\s*[;,]?\s*$/.test(line)) continue;
            v.push(vio(this, i + 1, line, `Line is ${line.length} chars (max 80).`, 'Break to fit within 80 characters.'));
        }
        return v;
    },
};

/** CPP-FMT-04: Braces required for control structures */
const bracesRequired: Rule = {
    id: 'CPP-FMT-04', name: 'Braces required for control structures',
    description: 'Always use braces for if, else, for, while.',
    severity: 'medium', guideSection: '§Loops and Switch Statements',
    guideUrl: 'https://google.github.io/styleguide/cppguide.html#Loops_and_Switch_Statements',
    check(lines, _fn, passedCleanLines) {
        const v: Violation[] = [], sl = passedCleanLines || getCleanLines(lines);
        for (let i = 0; i < lines.length; i++) {
            const cl = sl[i];
            if (isSkippableLine(cl)) continue;
            if (/^\s*(?:if\s*\(|else\s+if\s*\(|for\s*\(|while\s*\()/.test(cl)) {
                const next = i + 1 < lines.length ? sl[i + 1] : '';
                if (cl.includes(')') && !cl.includes('{') && !next.trim().startsWith('{'))
                    v.push(vio(this, i + 1, lines[i], 'Control structure without braces.', 'Always use braces {}.'));
            }
            if (/^\s*(?:\}\s*)?else\s*$/.test(cl)) {
                const next = i + 1 < lines.length ? sl[i + 1] : '';
                if (!cl.includes('{') && !next.trim().startsWith('{'))
                    v.push(vio(this, i + 1, lines[i], '`else` without braces.', 'Always use braces {} for else.'));
            }
        }
        return v;
    },
};

/** CPP-FMT-05: Switch must have default case */
const switchDefault: Rule = {
    id: 'CPP-FMT-05', name: 'Switch must have default case',
    description: 'Switch statements should include a default case.',
    severity: 'medium', guideSection: '§Loops and Switch Statements',
    guideUrl: 'https://google.github.io/styleguide/cppguide.html#Loops_and_Switch_Statements',
    check(lines, _fn, passedCleanLines) {
        const v: Violation[] = [], sl = passedCleanLines || getCleanLines(lines);
        let inSwitch = false, switchLine = -1, bd = 0, sbd = 0, hasDef = false;
        for (let i = 0; i < lines.length; i++) {
            const cl = sl[i];
            if (/\bswitch\s*\(/.test(cl)) {
                inSwitch = true; switchLine = i; hasDef = false;
                for (const ch of cl) { if (ch === '{') { bd++; sbd = bd; } if (ch === '}') bd--; }
                continue;
            }
            if (inSwitch) {
                if (/\bdefault\s*:/.test(cl)) hasDef = true;
                for (const ch of cl) {
                    if (ch === '{') bd++;
                    if (ch === '}') { if (bd === sbd) { if (!hasDef) v.push(vio(this, switchLine + 1, lines[switchLine], 'Switch without `default`.', 'Add a default: case.')); inSwitch = false; } bd--; }
                }
            } else { for (const ch of cl) { if (ch === '{') bd++; if (ch === '}') bd--; } }
        }
        return v;
    },
};

/** CPP-FMT-06: No trailing whitespace */
const noTrailingWhitespace: Rule = {
    id: 'CPP-FMT-06', name: 'No trailing whitespace',
    description: 'Lines should not have trailing whitespace.',
    severity: 'low', guideSection: '§Horizontal Whitespace',
    guideUrl: 'https://google.github.io/styleguide/cppguide.html#Horizontal_Whitespace',
    check(lines) {
        const v: Violation[] = [];
        for (let i = 0; i < lines.length; i++)
            if (/\S\s+$/.test(lines[i]))
                v.push(vio(this, i + 1, lines[i], 'Trailing whitespace.', 'Remove trailing whitespace.'));
        return v;
    },
};

/** CPP-FMT-07: Namespace contents not indented */
const namespaceNoIndent: Rule = {
    id: 'CPP-FMT-07', name: 'Namespace contents not indented',
    description: 'Do not indent namespace body contents.',
    severity: 'low', guideSection: '§Namespace Formatting',
    guideUrl: 'https://google.github.io/styleguide/cppguide.html#Namespace_Formatting',
    check(lines, _fn, passedCleanLines) {
        const v: Violation[] = [], sl = passedCleanLines || getCleanLines(lines);
        let inNs = false, nsBd = 0, bd = 0;
        for (let i = 0; i < lines.length; i++) {
            const cl = sl[i];
            if (isSkippableLine(cl)) continue;
            if (/^\s*namespace\b/.test(cl) && cl.includes('{')) {
                inNs = true;
                for (const ch of cl) { if (ch === '{') bd++; if (ch === '}') bd--; }
                nsBd = bd; continue;
            }
            for (const ch of cl) { if (ch === '{') bd++; if (ch === '}') { if (bd === nsBd && inNs) inNs = false; bd--; } }
            if (inNs && bd === nsBd) {
                const indent = lines[i].match(/^(\s*)/);
                if (indent && indent[1].length >= 2 && !/^\s*(?:namespace|#|\/\/)/.test(cl))
                    if (/^\s{2,}(?:class|struct|enum|void|int|bool|auto|const|static|template|using|typedef)\b/.test(cl))
                        v.push(vio(this, i + 1, lines[i], 'Namespace body is indented.', 'Do not indent namespace contents.'));
            }
        }
        return v;
    },
};

// ============================================================================
// HEADERS
// ============================================================================

/** CPP-HDR-01: Header files must have #define guards */
const headerDefineGuards: Rule = {
    id: 'CPP-HDR-01', name: 'Header files must have #define guards',
    description: 'Header files (.h/.hpp) must have #define guards.',
    severity: 'high', guideSection: '§The #define Guard',
    guideUrl: 'https://google.github.io/styleguide/cppguide.html#The__define_Guard',
    check(lines, filename) {
        const v: Violation[] = [];
        if (!filename || (!filename.endsWith('.h') && !filename.endsWith('.hpp') && !filename.endsWith('.hh'))) return v;
        let hasIfndef = false, hasDefine = false;
        for (let i = 0; i < Math.min(lines.length, 50); i++) {
            if (/^\s*#\s*ifndef\s+\w+(_H)?\b/.test(lines[i])) hasIfndef = true;
            if (/^\s*#\s*define\s+\w+(_H)?\b/.test(lines[i])) hasDefine = true;
            if (hasIfndef && hasDefine) break;
        }
        if (!hasIfndef || !hasDefine) v.push(vio(this, 1, lines[0] || '', 'Missing #define guards.', 'Add #ifndef ..._H_ / #define ..._H_.'));
        return v;
    },
};

/** CPP-HDR-02: No #pragma once */
const noPragmaOnce: Rule = {
    id: 'CPP-HDR-02', name: 'No #pragma once',
    description: 'Use standard #define guards instead of #pragma once.',
    severity: 'medium', guideSection: '§The #define Guard',
    guideUrl: 'https://google.github.io/styleguide/cppguide.html#The__define_Guard',
    check(lines, _fn?, _pcl?) {
        const v: Violation[] = [];
        for (let i = 0; i < lines.length; i++)
            if (/^\s*#\s*pragma\s+once\b/.test(lines[i]))
                v.push(vio(this, i + 1, lines[i], '#pragma once found.', 'Replace with #ifndef/#define guards.'));
        return v;
    },
};

/** CPP-HDR-03: Include order */
const includeOrder: Rule = {
    id: 'CPP-HDR-03', name: 'Include order',
    description: 'System headers (<...>) should precede project headers ("...").',
    severity: 'low', guideSection: '§Names and Order of Includes',
    guideUrl: 'https://google.github.io/styleguide/cppguide.html#Names_and_Order_of_Includes',
    check(lines) {
        const v: Violation[] = [];
        let seenProject = false, isFirst = true;
        for (let i = 0; i < lines.length; i++) {
            const m = lines[i].match(/^\s*#\s*include\s+([<"])([^>"]+)[>"]/);
            if (!m) continue;
            if (isFirst) { isFirst = false; if (m[1] === '"') seenProject = true; continue; }
            if (m[1] === '"') seenProject = true;
            else if (m[1] === '<' && seenProject) {
                v.push(vio(this, i + 1, lines[i], 'System header after project header.', 'Put system headers first.'));
                seenProject = false;
            }
        }
        return v;
    },
};

// ============================================================================
// OTHER FEATURES
// ============================================================================

/** CPP-FEAT-01: No C-style casts */
const noCStyleCasts: Rule = {
    id: 'CPP-FEAT-01', name: 'No C-style casts',
    description: 'Use static_cast, const_cast, or reinterpret_cast instead.',
    severity: 'high', guideSection: '§Casting',
    guideUrl: 'https://google.github.io/styleguide/cppguide.html#Casting',
    check(lines, _fn, passedCleanLines) {
        const v: Violation[] = [], sl = passedCleanLines || getCleanLines(lines);
        const pat = /\(\s*(?:const\s+)?(?:unsigned\s+|signed\s+)?(?:int|char|bool|float|double|long|short|void|size_t)\s*\**\s*\)\s*[\w(]/;
        for (let i = 0; i < lines.length; i++) {
            const cl = sl[i];
            if (isSkippableLine(cl) || /^\s*#/.test(cl)) continue;
            if (!/\bsizeof\s*$/.test(cl.split(pat)[0] || '')) {
                const m = cl.match(pat);
                if (m && !/^\s*\(\s*void\s*\)/.test(m[0]))
                    v.push(vio(this, i + 1, lines[i], 'C-style cast found.', 'Use static_cast/const_cast/reinterpret_cast.'));
            }
        }
        return v;
    },
};

/** CPP-FEAT-02: Use nullptr, not NULL */
const useNullptr: Rule = {
    id: 'CPP-FEAT-02', name: 'Use nullptr, not NULL',
    description: 'Use C++11 nullptr instead of NULL.',
    severity: 'medium', guideSection: '§0 and nullptr/NULL',
    guideUrl: 'https://google.github.io/styleguide/cppguide.html#0_and_nullptr_NULL',
    check(lines, _fn, passedCleanLines) {
        const v: Violation[] = [], sl = passedCleanLines || getCleanLines(lines);
        for (let i = 0; i < lines.length; i++)
            if (/\bNULL\b/.test(sl[i]) && !/^\s*#/.test(sl[i]))
                v.push(vio(this, i + 1, lines[i], 'NULL macro found.', 'Use nullptr instead.'));
        return v;
    },
};

/** CPP-FEAT-03: No using namespace */
const noUsingNamespace: Rule = {
    id: 'CPP-FEAT-03', name: 'No using namespace',
    description: 'Do not use `using namespace foo;`.',
    severity: 'high', guideSection: '§Namespaces',
    guideUrl: 'https://google.github.io/styleguide/cppguide.html#Namespaces',
    check(lines, _fn, passedCleanLines) {
        const v: Violation[] = [], sl = passedCleanLines || getCleanLines(lines);
        for (let i = 0; i < lines.length; i++)
            if (/^\s*using\s+namespace\s+/.test(sl[i]))
                v.push(vio(this, i + 1, lines[i], '`using namespace` directive.', 'Use fully qualified names or specific using declarations.'));
        return v;
    },
};

/** CPP-FEAT-04: No exceptions */
const noExceptions: Rule = {
    id: 'CPP-FEAT-04', name: 'No exceptions',
    description: 'Google Style does not allow C++ exceptions.',
    severity: 'medium', guideSection: '§Exceptions',
    guideUrl: 'https://google.github.io/styleguide/cppguide.html#Exceptions',
    check(lines, _fn, passedCleanLines) {
        const v: Violation[] = [], sl = passedCleanLines || getCleanLines(lines);
        for (let i = 0; i < lines.length; i++) {
            const cl = sl[i];
            if (isSkippableLine(cl) || /^\s*#/.test(cl)) continue;
            const m = cl.match(/\b(throw)\s+[^;]+/) || cl.match(/\b(throw)\s*;/) || cl.match(/\b(catch)\s*\(/);
            if (m) v.push(vio(this, i + 1, lines[i], `Exception keyword \`${m[1]}\` found.`, 'Use error codes or Status/StatusOr instead.'));
        }
        return v;
    },
};

/** CPP-FEAT-05: Prefer ++i in loops */
const preferPreIncrement: Rule = {
    id: 'CPP-FEAT-05', name: 'Prefer ++i in loops',
    description: 'Prefer pre-increment (++i) over post-increment (i++) in for loops.',
    severity: 'low', guideSection: '§Preincrement and Predecrement',
    guideUrl: 'https://google.github.io/styleguide/cppguide.html#Preincrement_and_Predecrement',
    check(lines, _fn, passedCleanLines) {
        const v: Violation[] = [], sl = passedCleanLines || getCleanLines(lines);
        for (let i = 0; i < lines.length; i++)
            if (/^\s*for\s*\(/.test(sl[i]) && /\b([a-zA-Z_]\w*)\+\+\s*\>*\)/.test(sl[i]))
                v.push(vio(this, i + 1, lines[i], 'Post-increment in for loop.', 'Use pre-increment (++i).'));
        return v;
    },
};

/** CPP-FEAT-06: No goto */
const noGoto: Rule = {
    id: 'CPP-FEAT-06', name: 'No goto statements',
    description: 'Do not use `goto`.',
    severity: 'high', guideSection: '§Other C++ Features',
    guideUrl: 'https://google.github.io/styleguide/cppguide.html',
    check(lines, _fn, passedCleanLines) {
        const v: Violation[] = [], sl = passedCleanLines || getCleanLines(lines);
        for (let i = 0; i < lines.length; i++)
            if (/\bgoto\s+\w+;/.test(sl[i]))
                v.push(vio(this, i + 1, lines[i], '`goto` found.', 'Refactor to avoid goto.'));
        return v;
    },
};

/** CPP-FEAT-07: Avoid C-style string functions */
const avoidCStringFunctions: Rule = {
    id: 'CPP-FEAT-07', name: 'Avoid C-style string functions',
    description: 'Do not use strcpy, strcat, sprintf, etc.',
    severity: 'low', guideSection: '§Strings',
    guideUrl: 'https://google.github.io/styleguide/cppguide.html#Strings',
    check(lines, _fn, passedCleanLines) {
        const v: Violation[] = [], sl = passedCleanLines || getCleanLines(lines);
        const funcs = ['strcpy', 'strcat', 'strncpy', 'strncat', 'sprintf', 'vsprintf'];
        for (let i = 0; i < lines.length; i++) {
            const cl = sl[i];
            if (isSkippableLine(cl) || /^\s*#/.test(cl)) continue;
            for (const f of funcs)
                if (new RegExp(`\\b${f}\\s*\\(`).test(cl))
                    v.push(vio(this, i + 1, lines[i], `C-style \`${f}\` found.`, 'Use std::string or absl::StrCat.'));
        }
        return v;
    },
};

/** CPP-FEAT-08: No RTTI (dynamic_cast, typeid) */
const noRTTI: Rule = {
    id: 'CPP-FEAT-08', name: 'No RTTI',
    description: 'Avoid dynamic_cast and typeid.',
    severity: 'medium', guideSection: '§Run-Time Type Information (RTTI)',
    guideUrl: 'https://google.github.io/styleguide/cppguide.html#Run-Time_Type_Information__RTTI_',
    check(lines, _fn, passedCleanLines) {
        const v: Violation[] = [], sl = passedCleanLines || getCleanLines(lines);
        for (let i = 0; i < lines.length; i++) {
            const cl = sl[i];
            if (isSkippableLine(cl) || /^\s*#/.test(cl)) continue;
            if (/\bdynamic_cast\s*</.test(cl)) v.push(vio(this, i + 1, lines[i], '`dynamic_cast` (RTTI).', 'Use virtual methods or visitor pattern.'));
            if (/\btypeid\s*\(/.test(cl)) v.push(vio(this, i + 1, lines[i], '`typeid` (RTTI).', 'Avoid RTTI.'));
        }
        return v;
    },
};

/** CPP-FEAT-11: Avoid friend declarations */
const avoidFriend: Rule = {
    id: 'CPP-FEAT-11', name: 'Avoid friend declarations',
    description: 'Limit use of friend classes and functions.',
    severity: 'low', guideSection: '§Friends',
    guideUrl: 'https://google.github.io/styleguide/cppguide.html#Friends',
    check(lines, _fn, passedCleanLines) {
        const v: Violation[] = [], sl = passedCleanLines || getCleanLines(lines);
        for (let i = 0; i < lines.length; i++)
            if (/^\s*friend\s+(?:class|struct|void|int|bool|auto)\b/.test(sl[i]))
                v.push(vio(this, i + 1, lines[i], '`friend` declaration.', 'Redesign to use public interfaces.'));
        return v;
    },
};

/** CPP-FEAT-12: Prefer sizeof(varname) */
const sizeofVariable: Rule = {
    id: 'CPP-FEAT-12', name: 'Prefer sizeof(varname)',
    description: 'Use sizeof(varname) instead of sizeof(type).',
    severity: 'low', guideSection: '§sizeof',
    guideUrl: 'https://google.github.io/styleguide/cppguide.html#sizeof',
    check(lines, _fn, passedCleanLines) {
        const v: Violation[] = [], sl = passedCleanLines || getCleanLines(lines);
        const pat = /\bsizeof\s*\(\s*(?:int|char|bool|float|double|long|short|unsigned|signed|size_t|int8_t|int16_t|int32_t|int64_t|uint8_t|uint16_t|uint32_t|uint64_t)\s*\)/;
        for (let i = 0; i < lines.length; i++) {
            const cl = sl[i];
            if (isSkippableLine(cl) || /^\s*#/.test(cl)) continue;
            if (pat.test(cl)) v.push(vio(this, i + 1, lines[i], 'sizeof() with type name.', 'Use sizeof(varname) instead.'));
        }
        return v;
    },
};

/** CPP-FEAT-13: Avoid preprocessor macros in headers */
const avoidMacros: Rule = {
    id: 'CPP-FEAT-13', name: 'Avoid preprocessor macros',
    description: 'Prefer inline functions, enums, and const over macros.',
    severity: 'low', guideSection: '§Preprocessor Macros',
    guideUrl: 'https://google.github.io/styleguide/cppguide.html#Preprocessor_Macros',
    check(lines, filename) {
        const v: Violation[] = [];
        if (!filename || (!filename.endsWith('.h') && !filename.endsWith('.hpp') && !filename.endsWith('.hh'))) return v;
        for (let i = 0; i < lines.length; i++) {
            const m = lines[i].match(/^\s*#\s*define\s+(\w+)/);
            if (m && !/_H_?$/.test(m[1]) && !m[1].startsWith('__'))
                v.push(vio(this, i + 1, lines[i], `Macro "${m[1]}" in header.`, 'Prefer inline functions or constexpr.'));
        }
        return v;
    },
};

/** CPP-FEAT-14: Avoid streams for I/O */
const noStreamsForIO: Rule = {
    id: 'CPP-FEAT-14', name: 'Avoid streams for I/O',
    description: 'Avoid std::cout/cerr. Use proper logging.',
    severity: 'low', guideSection: '§Streams',
    guideUrl: 'https://google.github.io/styleguide/cppguide.html#Streams',
    check(lines, _fn, passedCleanLines) {
        const v: Violation[] = [], sl = passedCleanLines || getCleanLines(lines);
        for (let i = 0; i < lines.length; i++) {
            const cl = sl[i];
            if (isSkippableLine(cl) || /^\s*#/.test(cl)) continue;
            if (/\bstd::(?:cout|cerr)\b/.test(cl))
                v.push(vio(this, i + 1, lines[i], 'std::cout/cerr found.', 'Use proper logging.'));
        }
        return v;
    },
};

// ============================================================================
// COMMENTS
// ============================================================================

/** CPP-CMT-01: TODO comments need context */
const todoComments: Rule = {
    id: 'CPP-CMT-01', name: 'TODO comments need context',
    description: 'TODO comments must include a name or bug ID in parentheses.',
    severity: 'low', guideSection: '§TODO Comments',
    guideUrl: 'https://google.github.io/styleguide/cppguide.html#TODO_Comments',
    check(lines) {
        const v: Violation[] = [];
        for (let i = 0; i < lines.length; i++)
            if (/\bTODO\b(?!\s*\()/.test(lines[i]) && /\/\//.test(lines[i]))
                v.push(vio(this, i + 1, lines[i], 'TODO without context.', 'Use // TODO(name): ...'));
        return v;
    },
};

/** CPP-CMT-02: No commented-out code */
const commentedOutCode: Rule = {
    id: 'CPP-CMT-02', name: 'No commented-out code',
    description: 'Avoid leaving commented-out code blocks.',
    severity: 'low', guideSection: '§General Comments',
    guideUrl: 'https://google.github.io/styleguide/cppguide.html#Comments',
    check(lines) {
        const v: Violation[] = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if ((/^\s*\/\/\s*(?:if\s*\(|for\s*\(|while\s*\(|switch\s*\(|\} else \{)/.test(line) ||
                /^\s*\/\/\s*[a-zA-Z_]\w*\s*\([^)]*\)\s*;\s*$/.test(line)) && !/https?:\/\//.test(line))
                v.push(vio(this, i + 1, line, 'Commented-out code.', 'Remove or convert to descriptive comment.'));
        }
        return v;
    },
};

/** CPP-CMT-03: Use // for comments */
const useSlashComments: Rule = {
    id: 'CPP-CMT-03', name: 'Use // for comments',
    description: 'Use // for inline comments, not /* */.',
    severity: 'low', guideSection: '§Comment Style',
    guideUrl: 'https://google.github.io/styleguide/cppguide.html#Comment_Style',
    check(lines) {
        const v: Violation[] = [];
        for (let i = 0; i < lines.length; i++)
            if (/\/\*/.test(lines[i]) && !/\/\*\*/.test(lines[i]) && !/\/\*.*?\*\//.test(lines[i]))
                v.push(vio(this, i + 1, lines[i], 'Block comment /* used.', 'Prefer // comments.'));
        return v;
    },
};

/** CPP-CMT-04: File comments required */
const fileComments: Rule = {
    id: 'CPP-CMT-04', name: 'File comments required',
    description: 'Each file should start with a license/copyright comment.',
    severity: 'low', guideSection: '§File Comments',
    guideUrl: 'https://google.github.io/styleguide/cppguide.html#File_Comments',
    check(lines, filename) {
        const v: Violation[] = [];
        if (!filename) return v;
        let found = false;
        for (let i = 0; i < Math.min(lines.length, 5); i++) {
            const t = lines[i].trim();
            if (t === '') continue;
            if (t.startsWith('//') || t.startsWith('/*') || t.startsWith('*')) { found = true; break; }
            break;
        }
        if (!found) v.push(vio(this, 1, lines[0] || '', 'No leading comment.', 'Add file comment with copyright info.'));
        return v;
    },
};

// ============================================================================
// CLASSES
// ============================================================================

/** CPP-CLS-01: Data members need trailing underscore */
const dataMemberTrailingUnderscore: Rule = {
    id: 'CPP-CLS-01', name: 'Data members need trailing underscore',
    description: 'Private/protected class data members must end with underscore.',
    severity: 'medium', guideSection: '§Variable Names',
    guideUrl: 'https://google.github.io/styleguide/cppguide.html#Variable_Names',
    check(lines, _fn, passedCleanLines) {
        const v: Violation[] = [], sl = passedCleanLines || getCleanLines(lines);
        let bd = 0, cd = -1, access = 'private';
        for (let i = 0; i < lines.length; i++) {
            const cl = sl[i];
            if (isSkippableLine(cl) || /^\s*#/.test(cl)) continue;
            const hasClass = /^\s*class\s+[A-Za-z_]\w*/.test(cl);
            for (const ch of cl) {
                if (ch === '{') { bd++; if (hasClass && cd === -1) { cd = bd; access = 'private'; } }
                if (ch === '}') { if (bd === cd) cd = -1; bd--; }
            }
            if (cd !== -1 && bd === cd) {
                if (/^\s*public\s*:/.test(cl)) access = 'public';
                else if (/^\s*protected\s*:/.test(cl)) access = 'protected';
                else if (/^\s*private\s*:/.test(cl)) access = 'private';
                if (access !== 'public') {
                    const m = cl.match(/^\s*(?:mutable\s+)?(?:int|char|bool|float|double|long|short|std::string|std::\w+|[A-Z]\w*)\s+([a-z_]\w*)(?:\s*[=;]|\s*\{)/);
                    if (m && !m[1].endsWith('_') && !cl.includes('('))
                        v.push(vio(this, i + 1, lines[i], `Data member "${m[1]}" lacks trailing underscore.`, `Rename to "${m[1]}_".`));
                }
            }
        }
        return v;
    },
};

/** CPP-CLS-02: Explicit single-arg constructors */
const explicitConstructors: Rule = {
    id: 'CPP-CLS-02', name: 'Explicit single-arg constructors',
    description: 'Single-argument constructors must be marked explicit.',
    severity: 'medium', guideSection: '§Implicit Conversions',
    guideUrl: 'https://google.github.io/styleguide/cppguide.html#Implicit_Conversions',
    check(lines, _fn, passedCleanLines) {
        const v: Violation[] = [], sl = passedCleanLines || getCleanLines(lines);
        let className: string | null = null;
        for (let i = 0; i < lines.length; i++) {
            const cl = sl[i];
            const cm = cl.match(/^\s*(?:class|struct)\s+([A-Z]\w*)\b/);
            if (cm) className = cm[1];
            if (className) {
                const pat = new RegExp(`^\\s*(?:explicit\\s+)?${className}\\s*\\(\\s*(?:const\\s+)?[a-zA-Z_]\\w*(?:::\\w+)*\\s*(?:[&*]\\s*)?\\w+\\s*\\)\\s*(?:[{;]|:\\s*\\w+)`);
                if (pat.test(cl) && !/^\s*explicit\b/.test(cl) && !cl.includes(`const ${className}&`) && !cl.includes(`${className}&&`))
                    v.push(vio(this, i + 1, lines[i], `Constructor for "${className}" not explicit.`, 'Add `explicit`.'));
            }
        }
        return v;
    },
};

/** CPP-CLS-03: No virtual with override */
const virtualAndOverride: Rule = {
    id: 'CPP-CLS-03', name: 'No virtual with override',
    description: 'Do not use virtual when override is specified.',
    severity: 'medium', guideSection: '§Inheritance',
    guideUrl: 'https://google.github.io/styleguide/cppguide.html#Inheritance',
    check(lines, _fn, passedCleanLines) {
        const v: Violation[] = [], sl = passedCleanLines || getCleanLines(lines);
        for (let i = 0; i < lines.length; i++)
            if (/\bvirtual\b/.test(sl[i]) && /\boverride\b/.test(sl[i]))
                v.push(vio(this, i + 1, lines[i], '`virtual` with `override`.', 'Remove `virtual`, keep `override`.'));
        return v;
    },
};

/** CPP-CLS-04: Class access control order */
const accessControlOrder: Rule = {
    id: 'CPP-CLS-04', name: 'Class access control order',
    description: 'Sections: public, then protected, then private.',
    severity: 'low', guideSection: '§Declaration Order',
    guideUrl: 'https://google.github.io/styleguide/cppguide.html#Declaration_Order',
    check(lines, _fn, passedCleanLines) {
        const v: Violation[] = [], sl = passedCleanLines || getCleanLines(lines);
        let bd = 0, cd = -1, state = 0;
        for (let i = 0; i < lines.length; i++) {
            const cl = sl[i];
            if (isSkippableLine(cl)) continue;
            const hasClass = /^\s*(?:class|struct)\s+[A-Za-z_]\w*/.test(cl);
            for (const ch of cl) {
                if (ch === '{') { bd++; if (hasClass && cd === -1) { cd = bd; state = 0; } }
                if (ch === '}') { if (bd === cd) cd = -1; bd--; }
            }
            if (cd !== -1 && bd === cd) {
                if (/^\s*public\s*:/.test(cl)) { if (state > 1) v.push(vio(this, i + 1, lines[i], 'public after protected/private.', 'Reorder: public, protected, private.')); state = 1; }
                else if (/^\s*protected\s*:/.test(cl)) { if (state > 2) v.push(vio(this, i + 1, lines[i], 'protected after private.', 'Reorder: public, protected, private.')); state = 2; }
                else if (/^\s*private\s*:/.test(cl)) state = 3;
            }
        }
        return v;
    },
};

/** CPP-CLS-05: Struct for passive data only */
const structForPassiveData: Rule = {
    id: 'CPP-CLS-05', name: 'Struct for passive data only',
    description: 'Structs should only hold passive data. Use class for invariants.',
    severity: 'medium', guideSection: '§Structs vs. Classes',
    guideUrl: 'https://google.github.io/styleguide/cppguide.html#Structs_vs._Classes',
    check(lines, _fn, passedCleanLines) {
        const v: Violation[] = [], sl = passedCleanLines || getCleanLines(lines);
        let inStruct = false, sLine = -1, sBd = 0, bd = 0, hasPP = false, hasV = false;
        for (let i = 0; i < lines.length; i++) {
            const cl = sl[i];
            if (isSkippableLine(cl)) continue;
            if (/^\s*struct\s+[A-Za-z_]\w*/.test(cl) && !inStruct) { inStruct = true; sLine = i; hasPP = false; hasV = false; }
            if (inStruct) {
                for (const ch of cl) {
                    if (ch === '{') { bd++; if (sBd === 0) sBd = bd; }
                    if (ch === '}') {
                        if (bd === sBd) {
                            if (hasPP || hasV) v.push(vio(this, sLine + 1, lines[sLine], 'Struct with private/protected or virtual.', 'Use class instead.'));
                            inStruct = false; sBd = 0;
                        }
                        bd--;
                    }
                }
                if (bd >= sBd && sBd > 0) {
                    if (/^\s*(?:private|protected)\s*:/.test(cl)) hasPP = true;
                    if (/\bvirtual\b/.test(cl)) hasV = true;
                }
            } else { for (const ch of cl) { if (ch === '{') bd++; if (ch === '}') bd--; } }
        }
        return v;
    },
};

// ============================================================================
// FUNCTIONS
// ============================================================================

// §Inputs and Outputs -- deferred to AI deep review layer

/** CPP-FUNC-02: Use const references for inputs */
const constReferences: Rule = {
    id: 'CPP-FUNC-02', name: 'Use const references for inputs',
    description: 'Input reference parameters should be const.',
    severity: 'medium', guideSection: '§Reference Parameters',
    guideUrl: 'https://google.github.io/styleguide/cppguide.html#Reference_Parameters',
    check(lines, _fn, passedCleanLines) {
        const v: Violation[] = [], sl = passedCleanLines || getCleanLines(lines);
        const pat = /\b[\w:]+(?:<[^>]+>)?\s*&\s+([a-zA-Z_]\w*)\b(?!\s*=)/;
        for (let i = 0; i < lines.length; i++) {
            const cl = sl[i];
            if (isSkippableLine(cl)) continue;
            if (/\bconst\b/.test(cl) && /\bconst\s+[\w:]+.*\s*&/.test(cl)) continue;
            const m = cl.match(pat);
            if (m && !/\b(?:return|if|for|while|switch)\b/.test(cl))
                v.push(vio(this, i + 1, lines[i], `Non-const reference "${m[1]}".`, 'Use const& for inputs, pointer for outputs.'));
        }
        return v;
    },
};

/** CPP-FUNC-03: No default arguments */
const noDefaultArguments: Rule = {
    id: 'CPP-FUNC-03', name: 'No default arguments',
    description: 'Avoid default arguments in function declarations.',
    severity: 'low', guideSection: '§Default Arguments',
    guideUrl: 'https://google.github.io/styleguide/cppguide.html#Default_Arguments',
    check(lines, _fn, passedCleanLines) {
        const v: Violation[] = [], sl = passedCleanLines || getCleanLines(lines);
        for (let i = 0; i < lines.length; i++) {
            const cl = sl[i];
            if (isSkippableLine(cl) || /^\s*#/.test(cl)) continue;
            if (/\b(?:if|for|while|return|switch|case|catch)\b/.test(cl)) continue;
            const fm = /^\s*(?:(?:virtual|static|inline|explicit|constexpr|const|extern)\s+)*(?:[a-zA-Z_:][\w:<>,\s*&]+)\s+([a-zA-Z_]\w*)\s*\(/.exec(cl);
            if (!fm) continue;
            const pc = cl.slice(cl.indexOf('(', fm.index!) + 1);
            if (/\w+\s*=[^=]/.test(pc) && !/[!=<>]=/.test(pc.replace(/\w+\s*=[^=]/, '')))
                v.push(vio(this, i + 1, lines[i], 'Default argument found.', 'Use overloading instead.'));
        }
        return v;
    },
};

/** CPP-FUNC-04: Write short functions */
const shortFunctions: Rule = {
    id: 'CPP-FUNC-04', name: 'Write short functions',
    description: 'Functions over 40 lines should be split.',
    severity: 'low', guideSection: '§Write Short Functions',
    guideUrl: 'https://google.github.io/styleguide/cppguide.html#Write_Short_Functions',
    check(lines, _fn, passedCleanLines) {
        const v: Violation[] = [], sl = passedCleanLines || getCleanLines(lines);
        const MAX = 40;
        let fStart = -1, fBd = 0, inF = false, fCount = 0;
        for (let i = 0; i < lines.length; i++) {
            const cl = sl[i];
            if (!inF && /^\s*(?:(?:virtual|static|inline|explicit|constexpr|const|extern)\s+)*(?:[a-zA-Z_:][\w:<>,\s*&]+)\s+[a-zA-Z_]\w*\s*\([^;]*\)\s*(?:const\s*)?(?:override\s*)?(?:noexcept\s*)?{/.test(cl)) {
                inF = true; fStart = i; fCount = 0; fBd = 0;
                for (const ch of cl) { if (ch === '{') fBd++; if (ch === '}') fBd--; }
                fCount++;
                if (fBd <= 0) inF = false;
                continue;
            }
            if (inF) {
                fCount++;
                for (const ch of cl) {
                    if (ch === '{') fBd++;
                    if (ch === '}') { fBd--; if (fBd <= 0) { if (fCount > MAX) v.push(vio(this, fStart + 1, lines[fStart], `Function is ${fCount} lines (max ${MAX}).`, 'Split into smaller functions.')); inF = false; } }
                }
            }
        }
        return v;
    },
};

// ============================================================================
// LANGUAGE FEATURES / OWNERSHIP / SCOPING
// ============================================================================

/** CPP-LANG-01: Initialize variables at declaration */
const declareVariablesInitialized: Rule = {
    id: 'CPP-LANG-01', name: 'Initialize variables at declaration',
    description: 'Variables should be initialized, not left uninitialized.',
    severity: 'medium', guideSection: '§Local Variables',
    guideUrl: 'https://google.github.io/styleguide/cppguide.html#Local_Variables',
    check(lines, _fn, passedCleanLines) {
        const v: Violation[] = [], sl = passedCleanLines || getCleanLines(lines);
        const pat = /^\s+(?:int|float|double|char|bool|size_t|long|short|unsigned)\s+([a-z_]\w*)\s*;/;
        for (let i = 0; i < lines.length; i++) {
            const cl = sl[i];
            if (isSkippableLine(cl) || /^\s*#/.test(cl)) continue;
            if (/^\s*(?:class|struct|enum|typedef|using|namespace)\b/.test(cl)) continue;
            const m = cl.match(pat);
            if (m) v.push(vio(this, i + 1, lines[i], `"${m[1]}" uninitialized.`, 'Initialize at declaration.'));
        }
        return v;
    },
};

/** CPP-PTR-01: Prefer smart pointers */
const preferSmartPointers: Rule = {
    id: 'CPP-PTR-01', name: 'Prefer smart pointers',
    description: 'Use unique_ptr/shared_ptr instead of raw new/delete.',
    severity: 'high', guideSection: '§Ownership and Smart Pointers',
    guideUrl: 'https://google.github.io/styleguide/cppguide.html#Ownership_and_Smart_Pointers',
    check(lines, _fn, passedCleanLines) {
        const v: Violation[] = [], sl = passedCleanLines || getCleanLines(lines);
        for (let i = 0; i < lines.length; i++) {
            const cl = sl[i];
            if (isSkippableLine(cl) || /^\s*#/.test(cl)) continue;
            if (/\bnew\s+[\w:]+/.test(cl) && !/\b(?:std::make_unique|std::make_shared|operator\s+new)\b/.test(cl))
                v.push(vio(this, i + 1, lines[i], 'Raw `new` found.', 'Use std::make_unique or std::make_shared.'));
            if ((/\bdelete\s+(?!\[)/.test(cl) || /\bdelete\s*\[\]/.test(cl)) && !/\boperator\s+delete\b/.test(cl))
                v.push(vio(this, i + 1, lines[i], 'Raw `delete` found.', 'Use smart pointers.'));
        }
        return v;
    },
};

/** CPP-SCOPE-01: No non-const global variables */
const noGlobalVariables: Rule = {
    id: 'CPP-SCOPE-01', name: 'No non-const global variables',
    description: 'Avoid non-const variables at global/namespace scope.',
    severity: 'high', guideSection: '§Static and Global Variables',
    guideUrl: 'https://google.github.io/styleguide/cppguide.html#Static_and_Global_Variables',
    check(lines, _fn, passedCleanLines) {
        const v: Violation[] = [], sl = passedCleanLines || getCleanLines(lines);
        let bd = 0;
        for (let i = 0; i < lines.length; i++) {
            const cl = sl[i];
            if (isSkippableLine(cl) || /^\s*#/.test(cl)) continue;
            for (const ch of cl) { if (ch === '{') bd++; if (ch === '}') bd--; }
            if (bd <= 1) {
                const m = cl.match(/^(?:static\s+)?(?!const\b|constexpr\b|extern\b|typedef\b|using\b|class\b|struct\b|enum\b|namespace\b|template\b|inline\b|#)(?:int|float|double|char|bool|std::\w+|string|size_t|long|short|unsigned)\s+([a-z_]\w*)\s*[=;]/);
                if (m && !/\bconst\b/.test(cl) && !/\bconstexpr\b/.test(cl))
                    v.push(vio(this, i + 1, lines[i], `Non-const global "${m[1]}".`, 'Avoid global mutable state.'));
            }
        }
        return v;
    },
};

// §Internal Linkage -- deferred to AI deep review layer
// §Use of const -- deferred to AI deep review layer
// §Type Deduction (auto) -- deferred to AI deep review layer
// §Inheritance (override detection) -- deferred to AI deep review layer

// ============================================================================
// EXPORT
// ============================================================================

export const cppRules: Rule[] = [
    // Naming
    typeNamesPascalCase,       // CPP-NAME-01
    variableNamesSnakeCase,    // CPP-NAME-02
    constantsKPrefixed,        // CPP-NAME-03
    functionNamesPascalCase,   // CPP-NAME-04
    namespaceNamesSnakeCase,   // CPP-NAME-05
    enumeratorNamesKPrefixed,  // CPP-NAME-06
    macroNamesAllCaps,         // CPP-NAME-07
    // Formatting
    noTabs,                    // CPP-FMT-01
    twoSpaceIndent,            // CPP-FMT-02
    lineLengthLimit,           // CPP-FMT-03
    bracesRequired,            // CPP-FMT-04
    switchDefault,             // CPP-FMT-05
    noTrailingWhitespace,      // CPP-FMT-06
    namespaceNoIndent,         // CPP-FMT-07
    // Headers
    headerDefineGuards,        // CPP-HDR-01
    noPragmaOnce,              // CPP-HDR-02
    includeOrder,              // CPP-HDR-03
    // Features
    noCStyleCasts,             // CPP-FEAT-01
    useNullptr,                // CPP-FEAT-02
    noUsingNamespace,          // CPP-FEAT-03
    noExceptions,              // CPP-FEAT-04
    preferPreIncrement,        // CPP-FEAT-05
    noGoto,                    // CPP-FEAT-06
    avoidCStringFunctions,     // CPP-FEAT-07
    noRTTI,                    // CPP-FEAT-08
    avoidFriend,               // CPP-FEAT-11
    sizeofVariable,            // CPP-FEAT-12
    avoidMacros,               // CPP-FEAT-13
    noStreamsForIO,             // CPP-FEAT-14
    // Comments
    todoComments,              // CPP-CMT-01
    commentedOutCode,          // CPP-CMT-02
    useSlashComments,          // CPP-CMT-03
    fileComments,              // CPP-CMT-04
    // Classes
    dataMemberTrailingUnderscore, // CPP-CLS-01
    explicitConstructors,         // CPP-CLS-02
    virtualAndOverride,           // CPP-CLS-03
    accessControlOrder,           // CPP-CLS-04
    structForPassiveData,         // CPP-CLS-05
    // Functions
    constReferences,           // CPP-FUNC-02
    noDefaultArguments,        // CPP-FUNC-03
    shortFunctions,            // CPP-FUNC-04
    // Language / Ownership / Scoping
    declareVariablesInitialized, // CPP-LANG-01
    preferSmartPointers,       // CPP-PTR-01
    noGlobalVariables,         // CPP-SCOPE-01
];
