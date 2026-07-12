/**
 * AngularJS Rules -- Google AngularJS Style Guide
 * https://google.github.io/styleguide/angularjs-google-style.html
 *
 * Sections covered:
 *   - Modules (referencing via .name)
 *   - Controllers and Scopes (prototype methods, controllerAs)
 *   - Directives (restrict, isolated scope)
 *   - Services (module.service vs module.factory)
 *   - Dependency Injection (@ngInject / $inject)
 *   - Filters (avoid custom filters)
 *   - Templates (complex expressions)
 *   - Naming (controller suffix, directive prefix)
 *   - File Organization (one component per file)
 */

import { Rule, Violation } from '../../types.js';

// ============================================================================
// HELPER UTILITIES
// ============================================================================

/**
 * Strip strings and comments while preserving line count/length.
 * AngularJS is JavaScript, so we use JS-style tokenization.
 */
export function getCleanLines(lines: string[]): string[] {
    const code = lines.join('\n');
    let cleanCode = '';

    let state = 'NORMAL'; // NORMAL, STRING_S, STRING_D, STRING_T, COMMENT_S, COMMENT_M
    let i = 0;

    while (i < code.length) {
        const char = code[i];
        const nextChar = code[i + 1] || '';

        if (char === '\n') {
            cleanCode += '\n';
            if (state === 'COMMENT_S') {
                state = 'NORMAL';
            }
            i++;
            continue;
        }

        if ((state === 'STRING_S' || state === 'STRING_D' || state === 'STRING_T') && char === '\\') {
            cleanCode += ' ';
            if (nextChar !== '\n') {
                cleanCode += ' ';
                i += 2;
                continue;
            }
        }

        switch (state) {
            case 'NORMAL':
                if (char === '/' && nextChar === '/') {
                    state = 'COMMENT_S';
                    cleanCode += '  ';
                    i += 2;
                } else if (char === '/' && nextChar === '*') {
                    state = 'COMMENT_M';
                    cleanCode += '  ';
                    i += 2;
                } else if (char === "'") {
                    state = 'STRING_S';
                    cleanCode += char;
                    i++;
                } else if (char === '"') {
                    state = 'STRING_D';
                    cleanCode += char;
                    i++;
                } else if (char === '`') {
                    state = 'STRING_T';
                    cleanCode += char;
                    i++;
                } else {
                    cleanCode += char;
                    i++;
                }
                break;

            case 'COMMENT_S':
                cleanCode += ' ';
                i++;
                break;

            case 'COMMENT_M':
                if (char === '*' && nextChar === '/') {
                    state = 'NORMAL';
                    cleanCode += '  ';
                    i += 2;
                } else {
                    cleanCode += ' ';
                    i++;
                }
                break;

            case 'STRING_S':
                if (char === "'") {
                    state = 'NORMAL';
                    cleanCode += char;
                } else {
                    cleanCode += ' ';
                }
                i++;
                break;

            case 'STRING_D':
                if (char === '"') {
                    state = 'NORMAL';
                    cleanCode += char;
                } else {
                    cleanCode += ' ';
                }
                i++;
                break;

            case 'STRING_T':
                if (char === '`') {
                    state = 'NORMAL';
                    cleanCode += char;
                } else {
                    cleanCode += ' ';
                }
                i++;
                break;
        }
    }

    return cleanCode.split('\n');
}

// ============================================================================
// BASE URL
// ============================================================================

const GUIDE_URL = 'https://google.github.io/styleguide/angularjs-google-style.html';

// ============================================================================
// RULES
// ============================================================================

export const angularjsRules: Rule[] = [
    // ── Modules ──────────────────────────────────────────────────────────

    {
        id: 'ANG-MOD-01',
        name: 'Module Names via Property',
        description: 'Modules should reference other modules using the Angular module .name property, not raw strings.',
        severity: 'medium',
        guideSection: 'Modules',
        guideUrl: GUIDE_URL + '#modules',
        check: (lines: string[], filename?: string, cleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getCleanLines(lines);
            // Structural check on cleanLines, value extraction on raw lines
            const structRegex = /angular\.module\(/;
            const modRegex = /angular\.module\([^,]+,\s*\[\s*['"]([\w.]+)['"]/;

            searchLines.forEach((line, index) => {
                if (!structRegex.test(line)) return;
                // Extract the actual dependency name from the raw line
                const match = lines[index].match(modRegex);
                if (match) {
                    const depName = match[1];
                    if (depName.includes('.')) {
                        violations.push({
                            ruleId: 'ANG-MOD-01',
                            ruleName: 'Module Names via Property',
                            severity: 'medium',
                            line: index + 1,
                            message: 'Avoid duplicating strings to reference other modules. Use the `.name` property instead.',
                            suggestion: `Use \`[${depName}.name]\` instead of \`['${depName}']\`.`,
                            codeSnippet: lines[index].trim(),
                            guideUrl: GUIDE_URL + '#modules'
                        });
                    }
                }
            });
            return violations;
        }
    },

    // ── Controllers and Scopes ───────────────────────────────────────────

    {
        id: 'ANG-CTRL-01',
        name: 'Methods on Prototype',
        description: 'Controllers are classes. Methods should be defined on the prototype, not attached to $scope inside the constructor.',
        severity: 'high',
        guideSection: 'Controllers and Scopes',
        guideUrl: GUIDE_URL + '#controllers-and-scopes',
        check: (lines: string[], filename?: string, cleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getCleanLines(lines);
            const scopeFuncRegex = /\$scope\.([a-zA-Z0-9_]+)\s*=\s*function\b/;

            searchLines.forEach((line, index) => {
                const match = line.match(scopeFuncRegex);
                if (match) {
                    violations.push({
                        ruleId: 'ANG-CTRL-01',
                        ruleName: 'Methods on Prototype',
                        severity: 'high',
                        line: index + 1,
                        message: `Function "${match[1]}" is attached directly to $scope. Methods should be on the controller prototype.`,
                        suggestion: `Define as \`MyCtrl.prototype.${match[1]} = function()\` instead.`,
                        codeSnippet: lines[index].trim(),
                        guideUrl: GUIDE_URL + '#controllers-and-scopes'
                    });
                }
            });
            return violations;
        }
    },

    {
        id: 'ANG-CTRL-02',
        name: 'Avoid $scope Injection',
        description: 'Do not inject $scope into controllers. Use controllerAs syntax with "this" to expose data to templates.',
        severity: 'high',
        guideSection: 'Controllers and Scopes',
        guideUrl: GUIDE_URL + '#controllers-and-scopes',
        check: (lines: string[], filename?: string, cleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getCleanLines(lines);
            // Detect $scope as a constructor parameter in a controller function
            // e.g., function MyCtrl($scope, ...) or .controller('Name', function($scope)
            const scopeInjectRegex = /(?:function\s+\w*Ctrl|function\s+\w*Controller|\.controller\s*\([^,]+,\s*(?:\[.*?)?function)\s*\([^)]*\$scope\b/;

            searchLines.forEach((line, index) => {
                if (scopeInjectRegex.test(line)) {
                    violations.push({
                        ruleId: 'ANG-CTRL-02',
                        ruleName: 'Avoid $scope Injection',
                        severity: 'high',
                        line: index + 1,
                        message: 'Do not inject $scope into controllers. Use "controllerAs" syntax instead.',
                        suggestion: 'Use `controllerAs: "ctrl"` in the directive/route config and bind properties to `this` in the controller.',
                        codeSnippet: lines[index].trim(),
                        guideUrl: GUIDE_URL + '#controllers-and-scopes'
                    });
                }
            });
            return violations;
        }
    },

    {
        id: 'ANG-CTRL-03',
        name: 'Properties on Prototype',
        description: 'Assign default property values on the controller prototype, not inside the constructor.',
        severity: 'medium',
        guideSection: 'Controllers and Scopes',
        guideUrl: GUIDE_URL + '#controllers-and-scopes',
        check: (lines: string[], filename?: string, cleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getCleanLines(lines);
            // Detect $scope.prop = value (exclude function assignments caught by CTRL-01)
            const scopeFuncCheck = /\$scope\.[a-zA-Z0-9_]+\s*=\s*function\b/;
            const scopePropRegex = /\$scope\.([a-zA-Z0-9_]+)\s*=/;

            searchLines.forEach((line, index) => {
                if (scopeFuncCheck.test(line)) return; // Skip function assignments (handled by CTRL-01)
                const match = line.match(scopePropRegex);
                if (match) {
                    violations.push({
                        ruleId: 'ANG-CTRL-03',
                        ruleName: 'Properties on Prototype',
                        severity: 'medium',
                        line: index + 1,
                        message: `Property "${match[1]}" is attached directly to $scope. Use prototype properties or controllerAs.`,
                        suggestion: `Define as \`MyCtrl.prototype.${match[1]} = value;\` or use controllerAs with \`this.${match[1]}\`.`,
                        codeSnippet: lines[index].trim(),
                        guideUrl: GUIDE_URL + '#controllers-and-scopes'
                    });
                }
            });
            return violations;
        }
    },

    // ── Directives ───────────────────────────────────────────────────────

    {
        id: 'ANG-DIR-01',
        name: 'Directive Restrict to E or A',
        description: 'Directives should restrict to element (E) or attribute (A). Avoid class (C) or comment (M) restrictions.',
        severity: 'medium',
        guideSection: 'Directives',
        guideUrl: GUIDE_URL + '#directives',
        check: (lines: string[], filename?: string, cleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getCleanLines(lines);
            // Match restrict: 'C' or restrict: 'M' or restrict: 'CM' etc
            const restrictRegex = /restrict\s*:\s*['"]([^'"]+)['"]/;

            searchLines.forEach((line, index) => {
                const match = line.match(restrictRegex);
                if (match) {
                    const val = match[1];
                    if (val.includes('C') || val.includes('M')) {
                        violations.push({
                            ruleId: 'ANG-DIR-01',
                            ruleName: 'Directive Restrict to E or A',
                            severity: 'medium',
                            line: index + 1,
                            message: `Directive restriction "${val}" includes class (C) or comment (M). Use only E (element) or A (attribute).`,
                            suggestion: "Use `restrict: 'E'` for component directives or `restrict: 'A'` for decorating directives.",
                            codeSnippet: lines[index].trim(),
                            guideUrl: GUIDE_URL + '#directives'
                        });
                    }
                }
            });
            return violations;
        }
    },

    {
        id: 'ANG-DIR-02',
        name: 'Use Isolated Scope',
        description: 'Directives should use an isolated scope (scope: {}) rather than inheriting or sharing the parent scope.',
        severity: 'medium',
        guideSection: 'Directives',
        guideUrl: GUIDE_URL + '#directives',
        check: (lines: string[], filename?: string, cleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getCleanLines(lines);
            // scope: true means prototypal inheritance (not isolated)
            const scopeTrueRegex = /scope\s*:\s*true\b/;

            searchLines.forEach((line, index) => {
                if (scopeTrueRegex.test(line)) {
                    violations.push({
                        ruleId: 'ANG-DIR-02',
                        ruleName: 'Use Isolated Scope',
                        severity: 'medium',
                        line: index + 1,
                        message: 'Directive uses `scope: true` (prototypal inheritance). Prefer isolated scope `scope: {}`.',
                        suggestion: 'Use `scope: {}` and pass data via explicit bindings (`@`, `=`, `&`).',
                        codeSnippet: lines[index].trim(),
                        guideUrl: GUIDE_URL + '#directives'
                    });
                }
            });
            return violations;
        }
    },

    // ── Services ─────────────────────────────────────────────────────────

    {
        id: 'ANG-SVC-01',
        name: 'Use module.service Not module.factory',
        description: 'Use module.service to define services with a class constructor, not module.factory.',
        severity: 'high',
        guideSection: 'Services',
        guideUrl: GUIDE_URL + '#services',
        check: (lines: string[], filename?: string, cleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getCleanLines(lines);
            const factoryRegex = /\.factory\s*\(/;

            searchLines.forEach((line, index) => {
                if (factoryRegex.test(line)) {
                    violations.push({
                        ruleId: 'ANG-SVC-01',
                        ruleName: 'Use module.service Not module.factory',
                        severity: 'high',
                        line: index + 1,
                        message: 'Prefer `module.service()` over `module.factory()`. Services are classes in Google style.',
                        suggestion: 'Rewrite as `module.service(\'ServiceName\', ServiceClass)` using a class constructor.',
                        codeSnippet: lines[index].trim(),
                        guideUrl: GUIDE_URL + '#services'
                    });
                }
            });
            return violations;
        }
    },

    // ── Dependency Injection ─────────────────────────────────────────────

    {
        id: 'ANG-DI-01',
        name: 'Use @ngInject or $inject',
        description: 'Use the @ngInject JSDoc annotation or the static $inject property for dependency injection. Do not use inline array annotation.',
        severity: 'high',
        guideSection: 'Dependency Injection',
        guideUrl: GUIDE_URL + '#dependency-injection',
        check: (lines: string[], filename?: string, cleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getCleanLines(lines);
            // Structural check: component registration followed by array bracket
            const structRegex = /\.(controller|service|factory|directive|filter|config|run)\s*\(.*,\s*\[/;
            // Full match on raw lines to confirm inline array DI pattern
            const inlineArrayRegex = /\.(controller|service|factory|directive|filter|config|run)\s*\(\s*['"][^'"]+['"]\s*,\s*\[/;

            searchLines.forEach((line, index) => {
                if (structRegex.test(line) && inlineArrayRegex.test(lines[index])) {
                    violations.push({
                        ruleId: 'ANG-DI-01',
                        ruleName: 'Use @ngInject or $inject',
                        severity: 'high',
                        line: index + 1,
                        message: 'Inline array annotation detected. Use `@ngInject` or `$inject` property instead.',
                        suggestion: 'Add `/** @ngInject */` before the function or set `MyClass.$inject = [\'dep1\', \'dep2\'];`.',
                        codeSnippet: lines[index].trim(),
                        guideUrl: GUIDE_URL + '#dependency-injection'
                    });
                }
            });
            return violations;
        }
    },

    // ── Filters ──────────────────────────────────────────────────────────

    {
        id: 'ANG-FLT-01',
        name: 'Avoid Custom Filters',
        description: 'Avoid registering custom filters. Filters run on every digest cycle and can cause performance issues.',
        severity: 'medium',
        guideSection: 'Filters',
        guideUrl: GUIDE_URL + '#filters',
        check: (lines: string[], filename?: string, cleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getCleanLines(lines);
            const filterRegex = /\.filter\s*\(\s*['"]/;

            searchLines.forEach((line, index) => {
                if (filterRegex.test(line)) {
                    violations.push({
                        ruleId: 'ANG-FLT-01',
                        ruleName: 'Avoid Custom Filters',
                        severity: 'medium',
                        line: index + 1,
                        message: 'Custom filter registration detected. Filters run every digest cycle and hurt performance.',
                        suggestion: 'Compute values in the controller and expose them as properties instead of using a filter.',
                        codeSnippet: lines[index].trim(),
                        guideUrl: GUIDE_URL + '#filters'
                    });
                }
            });
            return violations;
        }
    },

    // ── Templates ────────────────────────────────────────────────────────

    {
        id: 'ANG-TPL-01',
        name: 'No Complex Template Expressions',
        description: 'Avoid complex expressions in templates. Logic should be in the controller, not in template bindings.',
        severity: 'medium',
        guideSection: 'Templates',
        guideUrl: GUIDE_URL + '#templates',
        check: (lines: string[], filename?: string, cleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            // This rule checks .html files for complex Angular expressions
            if (filename && !/\.html?$/i.test(filename)) {
                return violations;
            }
            // Match {{ expr }} where expr contains ternary (?:), function calls with multiple args, or chained &&/||
            const complexExprRegex = /\{\{\s*[^}]*(\?|&&.*&&|\|\|.*\|\|)[^}]*\}\}/;

            lines.forEach((line, index) => {
                if (complexExprRegex.test(line)) {
                    violations.push({
                        ruleId: 'ANG-TPL-01',
                        ruleName: 'No Complex Template Expressions',
                        severity: 'medium',
                        line: index + 1,
                        message: 'Complex expression detected in template binding. Move logic into the controller.',
                        suggestion: 'Compute the value in the controller and bind the result to a simple property.',
                        codeSnippet: lines[index].trim(),
                        guideUrl: GUIDE_URL + '#templates'
                    });
                }
            });
            return violations;
        }
    },

    {
        id: 'ANG-TPL-02',
        name: 'Use templateUrl Not Inline Template',
        description: 'For non-trivial templates, use templateUrl to reference an external HTML file instead of inline template strings.',
        severity: 'low',
        guideSection: 'Templates',
        guideUrl: GUIDE_URL + '#templates',
        check: (lines: string[], filename?: string, cleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getCleanLines(lines);
            // Detect multi-line template strings assigned to template property
            // template: '...' with HTML tags
            const inlineTemplateRegex = /template\s*:\s*['"`].*<\w+/;

            searchLines.forEach((line, index) => {
                if (inlineTemplateRegex.test(line)) {
                    violations.push({
                        ruleId: 'ANG-TPL-02',
                        ruleName: 'Use templateUrl Not Inline Template',
                        severity: 'low',
                        line: index + 1,
                        message: 'Inline template with HTML detected. Use `templateUrl` for non-trivial templates.',
                        suggestion: 'Move the template to a separate `.html` file and use `templateUrl` to reference it.',
                        codeSnippet: lines[index].trim(),
                        guideUrl: GUIDE_URL + '#templates'
                    });
                }
            });
            return violations;
        }
    },

    // ── Naming ───────────────────────────────────────────────────────────

    {
        id: 'ANG-NAM-01',
        name: 'Controller Naming Convention',
        description: 'Controller names should be UpperCamelCase and suffixed with "Ctrl" or "Controller".',
        severity: 'low',
        guideSection: 'Naming',
        guideUrl: GUIDE_URL + '#naming',
        check: (lines: string[], filename?: string, cleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getCleanLines(lines);
            // Structural check on cleanLines, name extraction on raw lines
            const structRegex = /\.controller\s*\(/;
            const ctrlNameRegex = /\.controller\s*\(\s*['"]([^'"]+)['"]/;

            searchLines.forEach((line, index) => {
                if (!structRegex.test(line)) return;
                // Extract name from raw line (cleanLines strips string contents)
                const match = lines[index].match(ctrlNameRegex);
                if (match) {
                    const name = match[1];
                    if (!/^[A-Z]/.test(name)) {
                        violations.push({
                            ruleId: 'ANG-NAM-01',
                            ruleName: 'Controller Naming Convention',
                            severity: 'low',
                            line: index + 1,
                            message: `Controller "${name}" does not start with an uppercase letter. Use UpperCamelCase.`,
                            suggestion: `Rename to "${name.charAt(0).toUpperCase() + name.slice(1)}".`,
                            codeSnippet: lines[index].trim(),
                            guideUrl: GUIDE_URL + '#naming'
                        });
                    }
                    if (!/(?:Ctrl|Controller)$/.test(name)) {
                        violations.push({
                            ruleId: 'ANG-NAM-01',
                            ruleName: 'Controller Naming Convention',
                            severity: 'low',
                            line: index + 1,
                            message: `Controller "${name}" should be suffixed with "Ctrl" or "Controller".`,
                            suggestion: `Rename to "${name}Ctrl" or "${name}Controller".`,
                            codeSnippet: lines[index].trim(),
                            guideUrl: GUIDE_URL + '#naming'
                        });
                    }
                }
            });
            return violations;
        }
    },

    // ── File Organization ────────────────────────────────────────────────

    {
        id: 'ANG-ORG-01',
        name: 'One Component Per File',
        description: 'Each file should define at most one Angular component (controller, directive, service, or filter).',
        severity: 'medium',
        guideSection: 'File Organization',
        guideUrl: GUIDE_URL + '#file-organization',
        check: (lines: string[], filename?: string, cleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getCleanLines(lines);
            const componentRegex = /\.(controller|directive|service|factory|filter)\s*\(/g;
            let count = 0;
            let firstLine = -1;

            searchLines.forEach((line, index) => {
                const matches = line.match(componentRegex);
                if (matches) {
                    count += matches.length;
                    if (firstLine === -1) {
                        firstLine = index;
                    }
                }
            });

            if (count > 1) {
                violations.push({
                    ruleId: 'ANG-ORG-01',
                    ruleName: 'One Component Per File',
                    severity: 'medium',
                    line: firstLine + 1,
                    message: `File defines ${count} Angular components. Each file should define only one component.`,
                    suggestion: 'Split each controller, directive, service, or filter into its own file.',
                    codeSnippet: lines[firstLine].trim(),
                    guideUrl: GUIDE_URL + '#file-organization'
                });
            }
            return violations;
        }
    },

    // ── Scopes ───────────────────────────────────────────────────────────

    {
        id: 'ANG-SCP-01',
        name: 'No $scope.$watch',
        description: 'Avoid using $scope.$watch. It is difficult to test and usually indicates logic that belongs in a directive or service.',
        severity: 'medium',
        guideSection: 'Controllers and Scopes',
        guideUrl: GUIDE_URL + '#controllers-and-scopes',
        check: (lines: string[], filename?: string, cleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getCleanLines(lines);
            const watchRegex = /\$scope\.\$watch\s*\(/;

            searchLines.forEach((line, index) => {
                if (watchRegex.test(line)) {
                    violations.push({
                        ruleId: 'ANG-SCP-01',
                        ruleName: 'No $scope.$watch',
                        severity: 'medium',
                        line: index + 1,
                        message: '`$scope.$watch` detected. Watchers are hard to test and usually belong in a directive.',
                        suggestion: 'Move watch logic into a directive link function or use `ng-change` on inputs.',
                        codeSnippet: lines[index].trim(),
                        guideUrl: GUIDE_URL + '#controllers-and-scopes'
                    });
                }
            });
            return violations;
        }
    },

    {
        id: 'ANG-SCP-02',
        name: 'No $scope.$on in Controllers',
        description: 'Avoid using $scope.$on for event handling in controllers. Use a service or directive instead.',
        severity: 'medium',
        guideSection: 'Controllers and Scopes',
        guideUrl: GUIDE_URL + '#controllers-and-scopes',
        check: (lines: string[], filename?: string, cleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getCleanLines(lines);
            const onRegex = /\$scope\.\$on\s*\(/;

            searchLines.forEach((line, index) => {
                if (onRegex.test(line)) {
                    violations.push({
                        ruleId: 'ANG-SCP-02',
                        ruleName: 'No $scope.$on in Controllers',
                        severity: 'medium',
                        line: index + 1,
                        message: '`$scope.$on` detected. Event listeners in controllers are hard to test.',
                        suggestion: 'Move event handling into a service or directive.',
                        codeSnippet: lines[index].trim(),
                        guideUrl: GUIDE_URL + '#controllers-and-scopes'
                    });
                }
            });
            return violations;
        }
    },

    // ── Provider ─────────────────────────────────────────────────────────

    {
        id: 'ANG-SVC-02',
        name: 'Avoid module.provider',
        description: 'Avoid using module.provider unless configuration at config-time is truly required. Prefer module.service.',
        severity: 'low',
        guideSection: 'Services',
        guideUrl: GUIDE_URL + '#services',
        check: (lines: string[], filename?: string, cleanLines?: string[]): Violation[] => {
            const violations: Violation[] = [];
            const searchLines = cleanLines || getCleanLines(lines);
            const providerRegex = /\.provider\s*\(\s*['"]/;

            searchLines.forEach((line, index) => {
                if (providerRegex.test(line)) {
                    violations.push({
                        ruleId: 'ANG-SVC-02',
                        ruleName: 'Avoid module.provider',
                        severity: 'low',
                        line: index + 1,
                        message: '`module.provider()` detected. Only use providers when config-time setup is needed.',
                        suggestion: 'Use `module.service()` unless you need to configure the service in a `config()` block.',
                        codeSnippet: lines[index].trim(),
                        guideUrl: GUIDE_URL + '#services'
                    });
                }
            });
            return violations;
        }
    }

    // Sections deferred to AI deep review layer:
    // - Detailed controllerAs binding patterns across template + JS pairs
    // - Directive compile vs link function usage
    // - $resource/$http patterns (requires multi-file analysis)
];
