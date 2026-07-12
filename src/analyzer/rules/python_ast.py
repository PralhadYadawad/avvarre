import ast
import json
import sys
import re
from typing import List, Dict, Any, Optional

class Violation:
    def __init__(self, rule_id: str, rule_name: str, message: str, suggestion: str, line: int):
        self.rule_id = rule_id
        self.rule_name = rule_name
        self.message = message
        self.suggestion = suggestion
        self.line = line

    def to_dict(self) -> Dict[str, Any]:
        return {
            "ruleId": self.rule_id,
            "ruleName": self.rule_name,
            "message": self.message,
            "suggestion": self.suggestion,
            "line": self.line
        }

class avvarreVisitor(ast.NodeVisitor):
    def __init__(self):
        self.violations: List[Violation] = []
        # Context tracking
        self.in_loop = False
        self.loop_stack = 0
        self.top_level_nodes = []

    def add_violation(self, rule_id: str, rule_name: str, message: str, suggestion: str, node: ast.AST):
        line = getattr(node, 'lineno', 1)
        self.violations.append(Violation(rule_id, rule_name, message, suggestion, line))

    def visit_Module(self, node: ast.Module):
        self.top_level_nodes = node.body
        self.generic_visit(node)

    # =========================================================================
    # §2.2 IMPORTS
    # =========================================================================

    def visit_ImportFrom(self, node: ast.ImportFrom):
        # PY-IMP-01: No wildcard imports
        for alias in node.names:
            if alias.name == "*":
                module_name = node.module or "module"
                self.add_violation(
                    "PY-IMP-01",
                    "No wildcard imports",
                    f'Wildcard import found. This imports all names from {module_name}, polluting the namespace.',
                    f'Import specific names instead: "from {module_name} import name1, name2"',
                    node
                )

        # PY-IMP-02: No relative imports
        if node.level > 0:
            self.add_violation(
                "PY-IMP-02",
                "No relative imports",
                "Relative import found. Use the full package path instead.",
                "Replace with absolute import using the full package name.",
                node
            )
        self.generic_visit(node)

    def visit_Import(self, node: ast.Import):
        # PY-IMP-03: No multi-module imports on a single line
        if len(node.names) > 1:
            modules = [alias.name for alias in node.names]
            self.add_violation(
                "PY-IMP-03",
                "No multi-module imports",
                "Multiple modules imported on one line.",
                f'Put each import on its own line:\n' + '\n'.join([f'import {m}' for m in modules]),
                node
            )
        self.generic_visit(node)

    # =========================================================================
    # §2.4 EXCEPTIONS
    # =========================================================================

    def visit_ExceptHandler(self, node: ast.ExceptHandler):
        # PY-EXC-01: No bare except
        if node.type is None:
            self.add_violation(
                "PY-EXC-01",
                "No bare except",
                "Bare except: catches all exceptions including KeyboardInterrupt and SystemExit.",
                'Catch specific exceptions: "except ValueError:" or at minimum "except Exception:".',
                node
            )
        else:
            # PY-EXC-02: No broad Exception catch
            types_to_check = []
            if isinstance(node.type, ast.Name):
                types_to_check.append(node.type.id)
            elif isinstance(node.type, ast.Tuple):
                for elt in node.type.elts:
                    if isinstance(elt, ast.Name):
                        types_to_check.append(elt.id)

            bad_types = {"Exception", "StandardError"}
            caught_bad = [t for t in types_to_check if t in bad_types]
            
            if caught_bad:
                is_reraising = False
                for stmt in node.body:
                    if isinstance(stmt, ast.Raise):
                        is_reraising = True
                        break
                if not is_reraising:
                    self.add_violation(
                        "PY-EXC-02",
                        "No broad Exception catch",
                        f"Broad exception catch of {caught_bad[0]}. This catches too many exception types including programming errors.",
                        "Catch specific exceptions (e.g. ValueError). If you must catch Exception, re-raise it after logging.",
                        node
                    )
        self.generic_visit(node)

    def visit_Assert(self, node: ast.Assert):
        # PY-EXC-04: No assert for validation
        self.add_violation(
            "PY-EXC-04",
            "No assert for validation",
            "Assert statements are stripped with python -O and must not be critical to application logic.",
            'Use "if not condition: raise ValueError(message)" for input validation.',
            node
        )
        self.generic_visit(node)

    # =========================================================================
    # §2.5 MUTABLE GLOBAL STATE & §2.10 LAMBDAS & §3.11 RESOURCES
    # =========================================================================

    def visit_Assign(self, node: ast.Assign):
        # PY-GLOB-01: Avoid mutable global state
        if node in self.top_level_nodes:
            is_mutable = isinstance(node.value, (ast.List, ast.Dict, ast.Set))
            if not is_mutable and isinstance(node.value, ast.Call):
                if isinstance(node.value.func, ast.Name):
                    if node.value.func.id in {"list", "dict", "set"}:
                        is_mutable = True
            if is_mutable:
                for target in node.targets:
                    if isinstance(target, ast.Name):
                        var_name = target.id
                        if not (var_name.upper() == var_name and len(var_name) > 1):
                            self.add_violation(
                                "PY-GLOB-01",
                                "Avoid mutable global state",
                                f'Mutable global state: "{var_name}" is a module-level mutable variable.',
                                f'If constant, rename to UPPER_CASE. If mutable, prefix with _.',
                                node
                            )

        # PY-LAMBDA-01: No lambda assigned to a variable
        if isinstance(node.value, ast.Lambda):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    self.add_violation(
                        "PY-LAMBDA-01",
                        "No lambda assigned to a variable",
                        f'Lambda assigned to variable "{target.id}". Named lambdas defeat the purpose of anonymous functions.',
                        f'Use a def statement instead: "def {target.id}(...):"',
                        node
                    )

        # PY-RES-01: Use "with" for files
        if isinstance(node.value, ast.Call) and isinstance(node.value.func, ast.Name):
            if node.value.func.id == "open":
                self.add_violation(
                    "PY-RES-01",
                    'Use "with" for files',
                    'File opened without "with" statement. The file may not be properly closed.',
                    'Use: with open(...) as var:',
                    node
                )

        self.generic_visit(node)

    # =========================================================================
    # §2.7 COMPREHENSIONS
    # =========================================================================

    def _check_comp(self, node, ctype):
        if hasattr(node, "generators") and len(node.generators) > 1:
            self.add_violation(
                "PY-COMP-01",
                "No multiple for clauses in comprehensions",
                f'Multiple "for" clauses in {ctype} comprehension.',
                "Break this into nested for loops.",
                node
            )

    def visit_ListComp(self, node): self._check_comp(node, "list"); self.generic_visit(node)
    def visit_SetComp(self, node): self._check_comp(node, "set"); self.generic_visit(node)
    def visit_DictComp(self, node): self._check_comp(node, "dict"); self.generic_visit(node)
    def visit_GeneratorExp(self, node): self._check_comp(node, "generator"); self.generic_visit(node)

    # =========================================================================
    # §2.8 DEFAULT ITERATORS & §3.10 STRINGS
    # =========================================================================

    def visit_For(self, node: ast.For):
        if isinstance(node.iter, ast.Call) and isinstance(node.iter.func, ast.Attribute):
            attr = node.iter.func.attr
            if attr in {"keys", "readlines"}:
                base = "dict" if attr == "keys" else "file"
                if isinstance(node.iter.func.value, ast.Name): base = node.iter.func.value.id
                rule = "PY-ITER-01" if attr == "keys" else "PY-ITER-02"
                self.add_violation(rule, f"No .{attr}() in for loops", f"Unnecessary .{attr}() call.", f'Use "for x in {base}:" instead.', node)
        
        self.loop_stack += 1
        self.in_loop = True
        self.generic_visit(node)
        self.loop_stack -= 1
        if self.loop_stack == 0: self.in_loop = False

    def visit_While(self, node: ast.While):
        self._check_if_len_emptiness(node.test, node)
        self.loop_stack += 1
        self.in_loop = True
        self.generic_visit(node)
        self.loop_stack -= 1
        if self.loop_stack == 0: self.in_loop = False

    def visit_AugAssign(self, node: ast.AugAssign):
        if self.in_loop and isinstance(node.op, ast.Add):
            is_str = False
            if isinstance(node.value, (ast.Constant, ast.JoinedStr)):
                if isinstance(node.value, ast.JoinedStr) or (isinstance(node.value, ast.Constant) and isinstance(node.value.value, str)):
                    is_str = True
            elif isinstance(node.value, ast.Call) and isinstance(node.value.func, ast.Name) and node.value.func.id == "str":
                is_str = True
            if is_str:
                self.add_violation("PY-STR-01", "No string += in loops", "String concatenation with += in loop.", 'Use "".join() instead.', node)
        self.generic_visit(node)

    # =========================================================================
    # §2.12 DEFAULTS & §2.17 DECORATORS & §3.16 NAMING & §3.18 LENGTH
    # =========================================================================

    def _check_mutable_defaults(self, node, defaults):
        for d in defaults:
            if isinstance(d, (ast.List, ast.Dict, ast.Set)) or (isinstance(d, ast.Call) and isinstance(d.func, ast.Name) and d.func.id in {"list", "dict", "set"}):
                self.add_violation("PY-MUT-01", "No mutable default arguments", "Mutable default argument found.", "Use None as default.", node)

    def _check_names(self, node, kind):
        name = node.name
        if kind == "func":
            if not (name.startswith('__') and name.endswith('__')) and not name.startswith('test'):
                if not re.match(r'^_?_?[a-z][a-z0-9_]*$', name):
                    self.add_violation("PY-NAME-01", "Functions must use snake_case", f'Function "{name}" is not snake_case.', "Rename to snake_case.", node)
        else: # class
            if re.search(r'^[a-z]', name) or '_' in name:
                if not re.match(r'^_[A-Z]', name):
                    self.add_violation("PY-NAME-02", "Classes must use PascalCase", f'Class "{name}" is not PascalCase.', "Rename to PascalCase.", node)

    def visit_FunctionDef(self, node): self._handle_func(node)
    def visit_AsyncFunctionDef(self, node): self._handle_func(node)

    def _handle_func(self, node):
        self._check_names(node, "func")
        self._check_mutable_defaults(node, node.args.defaults)
        self._check_mutable_defaults(node, node.args.kw_defaults)
        for d in node.decorator_list:
            if isinstance(d, ast.Name) and d.id == "staticmethod":
                self.add_violation("PY-DEC-01", "Avoid @staticmethod", "@staticmethod should not be used.", "Use a module-level function.", node)
        if hasattr(node, 'end_lineno') and node.end_lineno - node.lineno > 40:
            self.add_violation("PY-LEN-01", "Function too long", f'Function "{node.name}" > 40 lines.', "Break it up.", node)
        self.generic_visit(node)

    def visit_ClassDef(self, node):
        self._check_names(node, "class")
        is_exc = any(isinstance(b, ast.Name) and (b.id.endswith("Error") or b.id.endswith("Exception")) for b in node.bases)
        if is_exc and not node.name.endswith("Error"):
            self.add_violation("PY-EXC-03", "Exception names must end in Error", f'Exception "{node.name}" should end in "Error".', "Rename to ...Error.", node)
        self.generic_visit(node)

    # =========================================================================
    # §2.14 BOOLEANS
    # =========================================================================

    def visit_Compare(self, node):
        for op, right in zip(node.ops, node.comparators):
            is_none = (isinstance(right, ast.Constant) and right.value is None) or (isinstance(right, ast.Name) and right.id == "None")
            if is_none and isinstance(op, (ast.Eq, ast.NotEq)):
                self.add_violation("PY-BOOL-01", 'Use "is None"', "Comparison to None with ==/!=.", 'Use "is/is not None".', node)
            is_bool = (isinstance(right, ast.Constant) and isinstance(right.value, bool)) or (isinstance(right, ast.Name) and right.id in ("True", "False"))
            if is_bool:
                self.add_violation("PY-BOOL-03", "No == True/False", "Direct comparison to boolean.", 'Use "if x:" or "if not x:".', node)
        self.generic_visit(node)

    def _check_if_len_emptiness(self, test, node):
        def is_len(n): return isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id == "len"
        bad = is_len(test) or (isinstance(test, ast.UnaryOp) and isinstance(test.op, ast.Not) and is_len(test.operand))
        if not bad and isinstance(test, ast.Compare):
            if (is_len(test.left) and any(isinstance(c, (ast.Constant, ast.Num)) and (getattr(c, 'value', None) == 0 or getattr(c, 'n', None) == 0) for c in test.comparators)): bad = True
        if bad: self.add_violation("PY-BOOL-02", "No if len()", "len() used for emptiness check.", 'Use "if seq:".', node)

    def visit_If(self, node): self._check_if_len_emptiness(node.test, node); self.generic_visit(node)
    def visit_IfExp(self, node): self._check_if_len_emptiness(node.test, node); self.generic_visit(node)

    # =========================================================================
    # §2.19 POWER & §3.10 LOGGING
    # =========================================================================

    def visit_Call(self, node):
        if isinstance(node.func, ast.Name) and node.func.id in {"eval", "exec", "__import__", "compile"}:
            self.add_violation("PY-PWR-01", "Avoid power features", f'"{node.func.id}()" used.', "Avoid it.", node)
        if isinstance(node.func, ast.Attribute) and node.func.attr in {"debug", "info", "warning", "error", "critical", "exception", "log"}:
            obj = getattr(node.func.value, 'id', getattr(node.func.value, 'attr', '')).lower()
            if "log" in obj and node.args and isinstance(node.args[0], ast.JoinedStr):
                self.add_violation("PY-STR-02", "No f-strings in logging", "f-string in logging.", "Use %-style.", node)
        self.generic_visit(node)

def check_formatting(source: str) -> List[Violation]:
    violations = []
    lines = source.split('\n')
    clean_lines = [l.split('#')[0] for l in lines]
    has_main_guard = any(re.search(r'if\s+__name__\s*==\s*[\'"]__main__[\'"]\s*:', cl) for cl in clean_lines)
    top_level_call_line = -1
    for i, line in enumerate(lines):
        clean = clean_lines[i]
        trimmed = clean.strip()
        if clean.strip().endswith(';'): violations.append(Violation("PY-FMT-01", "No semicolons", "Semicolon found.", "Remove it.", i+1))
        if len(line) > 80 and not re.search(r'https?://', line) and not re.match(r'^\s*(import|from)\s+', line) and not re.search(r'#.*(pylint|pytype|type):\s*(disable|ignore)', line):
            violations.append(Violation("PY-FMT-02", "80-char limit", "Line > 80 chars.", "Break line.", i+1))
        if line.endswith('\\'): violations.append(Violation("PY-FMT-03", "No backslash", "Backslash found.", "Use ( ).", i+1))
        if re.search(r'\btry\s*:.*\bexcept\b', clean): violations.append(Violation("PY-STMT-01", "Single-line try/except", "try/except on one line.", "Split lines.", i+1))
        is_indented = line.startswith((' ', '\t'))
        if not is_indented and trimmed:
            is_def = re.match(r'^(def|class|import|from|if|elif|else|for|while|try|except|finally|with)\b|#|@|"""|\'\'\'', trimmed)
            if not is_def:
                is_assignment = re.match(r'^\w+\s*=', trimmed)
                is_call = re.match(r'^\w[\w.]*\s*\(', trimmed)
                if not is_assignment and is_call:
                    if top_level_call_line == -1:
                        top_level_call_line = i + 1
    if top_level_call_line != -1 and not has_main_guard:
        violations.append(Violation("PY-MAIN-01", "Scripts need main guard", "Top-level call without main guard.", 'Add if __name__ == "__main__":', top_level_call_line))
    return violations

def main():
    source = sys.stdin.read()
    try: tree = ast.parse(source)
    except: print("[]"); return
    visitor = avvarreVisitor()
    visitor.visit(tree)
    fmt = check_formatting(source)
    print(json.dumps([v.to_dict() for v in visitor.violations + fmt]))

if __name__ == "__main__": main()
