package main

import (
	"encoding/json"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"io/ioutil"
	"os"
	"regexp"
	"strings"
)

type Violation struct {
	RuleID     string `json:"ruleId"`
	RuleName   string `json:"ruleName"`
	Message    string `json:"message"`
	Suggestion string `json:"suggestion"`
	Line       int    `json:"line"`
}

type avvarreVisitor struct {
	fset        *token.FileSet
	violations  []Violation
	filename    string
	packageName string
	sourceLines []string
}

func (v *avvarreVisitor) addViolation(ruleID, ruleName, message, suggestion string, pos token.Pos) {
	line := v.fset.Position(pos).Line
	v.violations = append(v.violations, Violation{
		RuleID:     ruleID,
		RuleName:   ruleName,
		Message:    message,
		Suggestion: suggestion,
		Line:       line,
	})
}

func (v *avvarreVisitor) visit(n ast.Node) bool {
	if n == nil {
		return true
	}

	switch node := n.(type) {
	case *ast.File:
		v.checkPackageName(node)
		v.checkPackageComment(node)
	case *ast.GenDecl:
		if node.Tok == token.IMPORT {
			v.checkImports(node)
		} else if node.Tok == token.CONST {
			v.checkConstants(node)
		} else if node.Tok == token.VAR {
			v.checkVariables(node)
		}
	case *ast.FuncDecl:
		v.checkFunctionNaming(node)
		v.checkReceiverNaming(node)
		v.checkReturnTypes(node)
		v.checkContextParam(node)
		v.checkDocComment(node)
	case *ast.CallExpr:
		v.checkPanic(node)
		v.checkErrorf(node)
		v.checkPowerFeatures(node)
	case *ast.AssignStmt:
		v.checkDiscardedErrors(node)
		v.checkEmptySliceDeclaration(node)
	case *ast.IfStmt:
		v.checkUnnecessaryElse(node)
		v.checkEmptyBody("if", node.Body, node.If)
	case *ast.ForStmt:
		v.checkEmptyBody("for", node.Body, node.For)
	case *ast.RangeStmt:
		v.checkEmptyBody("for range", node.Body, node.For)
	case *ast.SwitchStmt:
		v.checkEmptyBody("switch", node.Body, node.Switch)
	case *ast.InterfaceType:
		v.checkEmptyInterface(node)
	}

	return true
}

// --- Rule Implementations ---

func (v *avvarreVisitor) checkPackageName(f *ast.File) {
	v.packageName = f.Name.Name
	name := v.packageName
	base := strings.TrimSuffix(name, "_test")
	if strings.ToLower(base) != base || strings.Contains(base, "_") {
		v.addViolation("GO-NAME-02", "Package names must be lowercase",
			fmt.Sprintf("Package name %q contains uppercase letters or underscores.", name),
			"Package names must be all lowercase with no underscores.", f.Package)
	}
}

func (v *avvarreVisitor) checkImports(gd *ast.GenDecl) {
	for _, spec := range gd.Specs {
		is, ok := spec.(*ast.ImportSpec)
		if !ok {
			continue
		}
		// GO-IMP-01: No dot imports
		if is.Name != nil && is.Name.Name == "." {
			v.addViolation("GO-IMP-01", "No dot imports",
				"Dot import found. Semicolons are inserted automatically.",
				"Use a regular import and qualify names with the package prefix.", is.Pos())
		}
		// GO-IMP-02: Blank imports only in main/test
		if is.Name != nil && is.Name.Name == "_" {
			if v.packageName != "main" && !strings.HasSuffix(v.packageName, "_test") {
				v.addViolation("GO-IMP-02", "Blank imports only in main/test",
					fmt.Sprintf("Blank import in non-main package: %s.", is.Path.Value),
					"Blank imports should only be used for side effects in main packages or tests.", is.Pos())
			}
		}
		// GO-IMP-03: Import aliases lowercase
		if is.Name != nil && is.Name.Name != "." && is.Name.Name != "_" {
			alias := is.Name.Name
			if strings.ToLower(alias) != alias || strings.Contains(alias, "_") {
				v.addViolation("GO-IMP-03", "Import aliases must be lowercase",
					fmt.Sprintf("Import alias %q contains uppercase or underscores.", alias),
					"Import aliases must be all lowercase with no underscores.", is.Name.Pos())
			}
		}
	}
}

func (v *avvarreVisitor) checkConstants(gd *ast.GenDecl) {
	for _, spec := range gd.Specs {
		vs, ok := spec.(*ast.ValueSpec)
		if !ok {
			continue
		}
		for _, name := range vs.Names {
			// GO-NAME-03: No SCREAMING_SNAKE_CASE
			if strings.Contains(name.Name, "_") && strings.ToUpper(name.Name) == name.Name {
				v.addViolation("GO-NAME-03", "No SCREAMING_SNAKE_CASE constants",
					fmt.Sprintf("Constant %q uses SCREAMING_SNAKE_CASE.", name.Name),
					"Use MixedCaps instead.", name.Pos())
			}
		}
	}
}

func (v *avvarreVisitor) checkVariables(gd *ast.GenDecl) {
	for _, spec := range gd.Specs {
		vs, ok := spec.(*ast.ValueSpec)
		if !ok {
			continue
		}
		for _, name := range vs.Names {
			// GO-NAME-06: Error sentinel variables must use Err prefix
			if vs.Values != nil && len(vs.Values) > 0 {
				if call, ok := vs.Values[0].(*ast.CallExpr); ok {
					if isErrorConstructor(call) {
						if !strings.HasPrefix(name.Name, "Err") {
							v.addViolation("GO-NAME-06", "Error variables must use Err prefix",
								fmt.Sprintf("Error variable %q should start with \"Err\" prefix.", name.Name),
								"Rename to start with \"Err\".", name.Pos())
						}
					}
				}
			}
		}
	}
}

func (v *avvarreVisitor) checkFunctionNaming(fd *ast.FuncDecl) {
	name := fd.Name.Name
	// GO-NAME-01: Exported names MixedCaps
	if ast.IsExported(name) && strings.Contains(name, "_") {
		if !strings.HasSuffix(v.filename, "_test.go") {
			v.addViolation("GO-NAME-01", "Exported names must use MixedCaps",
				fmt.Sprintf("Exported name %q uses underscores.", name),
				"Use MixedCaps (PascalCase) instead.", fd.Name.Pos())
		}
	}
	// GO-NAME-05: No "Get" prefix
	if fd.Recv != nil && strings.HasPrefix(name, "Get") && len(name) > 3 && strings.ToUpper(name[3:4]) == name[3:4] {
		v.addViolation("GO-NAME-05", "No \"Get\" prefix on getters",
			fmt.Sprintf("Getter %q has a \"Get\" prefix.", name),
			fmt.Sprintf("Rename to %q.", name[3:]), fd.Name.Pos())
	}
	// GO-NAME-07: Acronym casing
	badAcronyms := map[string]string{
		"Http": "HTTP",
		"Url":  "URL",
		"Xml":  "XML",
		"Json": "JSON",
		"Sql":  "SQL",
		"Api":  "API",
	}
	for bad, good := range badAcronyms {
		if strings.Contains(name, bad) {
			v.addViolation("GO-NAME-07", "Acronyms must be consistently cased",
				fmt.Sprintf("Name %q uses %q — should be %q.", name, bad, good),
				"Use consistent casing for initialisms.", fd.Name.Pos())
			break
		}
	}
	// GO-LANG-01: No init() outside main
	if name == "init" && fd.Recv == nil {
		if v.packageName != "main" {
			v.addViolation("GO-LANG-01", "Avoid init() outside main package",
				"init() function found in non-main package.",
				"Avoid init(). Use explicit initialization functions.", fd.Name.Pos())
		}
	}
}

func (v *avvarreVisitor) checkReceiverNaming(fd *ast.FuncDecl) {
	if fd.Recv == nil || len(fd.Recv.List) == 0 {
		return
	}
	for _, field := range fd.Recv.List {
		if len(field.Names) == 0 {
			continue
		}
		name := field.Names[0].Name
		if name == "this" || name == "self" {
			v.addViolation("GO-NAME-04", "Receiver names must be short",
				fmt.Sprintf("Receiver name %q is not idiomatic Go.", name),
				"Use a short abbreviation (1-2 chars) of the type name.", field.Names[0].Pos())
		} else if len(name) > 3 {
			v.addViolation("GO-NAME-04", "Receiver names must be short",
				fmt.Sprintf("Receiver name %q is too long.", name),
				"Receiver names should be 1-2 characters.", field.Names[0].Pos())
		}
	}
}

func (v *avvarreVisitor) checkReturnTypes(fd *ast.FuncDecl) {
	if fd.Type.Results == nil {
		return
	}
	// GO-ERR-05: Return error interface
	for _, field := range fd.Type.Results.List {
		if star, ok := field.Type.(*ast.StarExpr); ok {
			if ident, ok := star.X.(*ast.Ident); ok {
				if strings.HasSuffix(ident.Name, "Error") && ast.IsExported(fd.Name.Name) {
					v.addViolation("GO-ERR-05", "Return error interface, not concrete type",
						"Function returns concrete error type pointer.",
						"Return the \"error\" interface instead.", field.Type.Pos())
				}
			}
		}
	}
}

func (v *avvarreVisitor) checkContextParam(fd *ast.FuncDecl) {
	if fd.Type.Params == nil || len(fd.Type.Params.List) == 0 {
		return
	}
	// GO-LANG-03: Context first
	hasCtx := false
	isFirst := false
	for i, field := range fd.Type.Params.List {
		if t, ok := field.Type.(*ast.SelectorExpr); ok {
			if x, ok := t.X.(*ast.Ident); ok && x.Name == "context" && t.Sel.Name == "Context" {
				hasCtx = true
				if i == 0 {
					isFirst = true
				}
			}
		}
	}
	if hasCtx && !isFirst {
		v.addViolation("GO-LANG-03", "context.Context should be first parameter",
			"context.Context is not the first parameter.",
			"Move context.Context to the first position.", fd.Type.Params.Pos())
	}
}

func (v *avvarreVisitor) checkPanic(ce *ast.CallExpr) {
	if ident, ok := ce.Fun.(*ast.Ident); ok && ident.Name == "panic" {
		if !strings.HasSuffix(v.filename, "_test.go") {
			v.addViolation("GO-ERR-03", "No panic for error handling",
				"panic() found. Do not use panic for normal error handling.",
				"Return an error instead.", ce.Pos())
		}
	}
}

func (v *avvarreVisitor) checkErrorf(ce *ast.CallExpr) {
	var funName string
	if sel, ok := ce.Fun.(*ast.SelectorExpr); ok {
		if x, ok := sel.X.(*ast.Ident); ok && x.Name == "fmt" {
			funName = sel.Sel.Name
		}
	} else if ident, ok := ce.Fun.(*ast.Ident); ok {
		funName = ident.Name
	}

	if funName == "Errorf" || funName == "New" {
		if len(ce.Args) > 0 {
			if lit, ok := ce.Args[0].(*ast.BasicLit); ok && lit.Kind == token.STRING {
				val := strings.Trim(lit.Value, "\"")
				// GO-ERR-01: No capitalized
				if len(val) > 0 && val[0] >= 'A' && val[0] <= 'Z' {
					// Check if it might be an acronym or exported name (more than 1 cap or acronym)
					if len(val) > 1 && !(val[1] >= 'A' && val[1] <= 'Z') {
						v.addViolation("GO-ERR-01", "Error strings must not be capitalized",
							"Error string starts with capital letter.",
							"Error strings should be lowercase.", ce.Args[0].Pos())
					}
				}
				// GO-ERR-02: No punctuation
				if len(val) > 0 && (strings.HasSuffix(val, ".") || strings.HasSuffix(val, "!")) {
					v.addViolation("GO-ERR-02", "Error strings must not end with punctuation",
						"Error string ends with punctuation.",
						"Remove trailing punctuation.", ce.Args[0].Pos())
				}
				// GO-LANG-04: Use %q
				if strings.Contains(val, `\"%s\"`) {
					v.addViolation("GO-LANG-04", "Use %q for string values in errors",
						"Manually quoted %s in error format string.",
						"Use %q instead.", ce.Args[0].Pos())
				}
			}
		}
	}

	if funName == "Errorf" {
		// GO-ERR-06: Error wrapping %w
		hasFormat := false
		hasErrorVar := false
		if len(ce.Args) >= 2 {
			if lit, ok := ce.Args[0].(*ast.BasicLit); ok && lit.Kind == token.STRING {
				val := lit.Value
				if strings.Contains(val, "%v") || strings.Contains(val, "%s") {
					hasFormat = true
				}
			}
			lastArg := ce.Args[len(ce.Args)-1]
			if ident, ok := lastArg.(*ast.Ident); ok {
				lname := strings.ToLower(ident.Name)
				if strings.Contains(lname, "err") {
					hasErrorVar = true
				}
			}
		}
		if hasFormat && hasErrorVar {
			v.addViolation("GO-ERR-06", "Error wrapping should use %w",
				"Using %v/%s to wrap an error.",
				"Use %w to wrap the error correctly.", ce.Pos())
		}
	}
}

func (v *avvarreVisitor) checkDiscardedErrors(as *ast.AssignStmt) {
	for i, rhs := range as.Rhs {
		if call, ok := rhs.(*ast.CallExpr); ok {
			// This is simplified; we'd want to check if the function returns an error
			// For now, check if the LHS has an underscore at the 2nd position (common pattern: val, _ := ...)
			if len(as.Lhs) > i+1 {
				if ident, ok := as.Lhs[i+1].(*ast.Ident); ok && ident.Name == "_" {
					// GO-ERR-04: No discarded without comment
					// We'd need comment association logic here
					_ = call
				}
			}
		}
	}
}

func (v *avvarreVisitor) checkUnnecessaryElse(is *ast.IfStmt) {
	if is.Else == nil {
		return
	}
	// Check if then block returns
	if len(is.Body.List) > 0 {
		last := is.Body.List[len(is.Body.List)-1]
		_, isRet := last.(*ast.ReturnStmt)
		_, isBrk := last.(*ast.BranchStmt)
		if isRet || isBrk {
			v.addViolation("GO-FMT-04", "No unnecessary else after return",
				"Unnecessary else after return/continue/break.",
				"Remove the else and dedent the code.", is.Else.Pos())
		}
	}
}

func (v *avvarreVisitor) checkEmptyBody(kind string, body *ast.BlockStmt, pos token.Pos) {
	if body == nil || len(body.List) == 0 {
		v.addViolation("GO-FMT-05", "No empty body",
			fmt.Sprintf("Empty %s body.", kind),
			"Add implementation or a comment explaining why it is empty.", pos)
	}
}

func (v *avvarreVisitor) checkEmptyInterface(it *ast.InterfaceType) {
	if it.Methods == nil || len(it.Methods.List) == 0 {
		v.addViolation("GO-LANG-02", "Prefer any over interface{}",
			"\"interface{}\" found. Use \"any\" instead.",
			"Replace \"interface{}\" with \"any\".", it.Pos())
	}
}

func (v *avvarreVisitor) checkEmptySliceDeclaration(as *ast.AssignStmt) {
	if as.Tok != token.DEFINE {
		return
	}
	for _, rhs := range as.Rhs {
		if cl, ok := rhs.(*ast.CompositeLit); ok {
			if at, ok := cl.Type.(*ast.ArrayType); ok && len(cl.Elts) == 0 {
				_ = at
				v.addViolation("GO-LANG-05", "Prefer var declaration for empty slices",
					"Using := for empty slice declaration.",
					"Use \"var s []Type\" instead.", as.Pos())
			}
		}
	}
}

func (v *avvarreVisitor) checkDocComment(fd *ast.FuncDecl) {
	if !ast.IsExported(fd.Name.Name) {
		return
	}
	if fd.Doc == nil {
		v.addViolation("GO-DOC-01", "Exported symbols must have doc comments",
			fmt.Sprintf("Exported symbol %q is missing a doc comment.", fd.Name.Name),
			"Add a doc comment.", fd.Name.Pos())
	} else {
		text := fd.Doc.Text()
		if !strings.HasPrefix(text, fd.Name.Name) {
			v.addViolation("GO-DOC-02", "Doc comments must start with the symbol name",
				fmt.Sprintf("Doc comment for %q does not start with its name.", fd.Name.Name),
				"Start the comment with the symbol name.", fd.Doc.Pos())
		}
		if !strings.HasSuffix(strings.TrimSpace(text), ".") {
			v.addViolation("GO-DOC-04", "Doc comments should end with a period",
				"Doc comment does not end with a period.",
				"Add a period at the end of the comment.", fd.Doc.Pos())
		}
	}
}

func (v *avvarreVisitor) checkPackageComment(f *ast.File) {
	if f.Doc == nil {
		v.addViolation("GO-DOC-03", "Package must have a package comment",
			"Package declaration is missing a package comment.",
			"Add a package comment.", f.Package)
	}
}

func isErrorConstructor(ce *ast.CallExpr) bool {
	var name string
	if sel, ok := ce.Fun.(*ast.SelectorExpr); ok {
		if x, ok := sel.X.(*ast.Ident); ok && (x.Name == "errors" || x.Name == "fmt") {
			name = sel.Sel.Name
		}
	} else if ident, ok := ce.Fun.(*ast.Ident); ok {
		name = ident.Name
	}
	return name == "New" || name == "Errorf"
}

func main() {
	src, err := ioutil.ReadAll(os.Stdin)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error reading stdin: %v\n", err)
		os.Exit(1)
	}

	fset := token.NewFileSet()
	f, err := parser.ParseFile(fset, "stdin", src, parser.ParseComments)
	if err != nil {
		fmt.Println("[]")
		return
	}

	visitor := &avvarreVisitor{
		fset: fset,
		filename: "stdin",
	}

	ast.Inspect(f, visitor.visit)

	output, _ := json.Marshal(visitor.violations)
	fmt.Println(string(output))
}
