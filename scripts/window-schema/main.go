// Generate public JSON Schema from canonical Go authored model ASTs without
// requiring backend services. Unknown/interface values stay extensible.
package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"flag"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"sort"
	"strconv"
	"strings"
)

type S = map[string]interface{}
type definition struct {
	expr      ast.Expr
	namespace string
	imports   map[string]string
}

var defs = map[string]definition{}
var generated = S{}
var loaded = map[string]bool{}
var descriptorSource string
var windowSource string
var provenance = map[string]string{}

func load(dir, ns string) {
	if loaded[ns] {
		return
	}
	loaded[ns] = true
	paths, _ := filepath.Glob(filepath.Join(dir, "*.go"))
	sort.Strings(paths)
	for _, path := range paths {
		if strings.HasSuffix(path, "_test.go") {
			continue
		}
		bytes, err := os.ReadFile(path)
		if err != nil {
			panic(err)
		}
		hash := sha256.Sum256(bytes)
		provenance[ns+filepath.Base(path)] = hex.EncodeToString(hash[:])
		file, err := parser.ParseFile(token.NewFileSet(), path, bytes, parser.ParseComments)
		if err != nil {
			panic(err)
		}
		imports := map[string]string{}
		for _, i := range file.Imports {
			p, _ := strconv.Unquote(i.Path.Value)
			alias := filepath.Base(p)
			if i.Name != nil {
				alias = i.Name.Name
			}
			imports[alias] = p
		}
		for _, decl := range file.Decls {
			if g, ok := decl.(*ast.GenDecl); ok {
				for _, spec := range g.Specs {
					if t, ok := spec.(*ast.TypeSpec); ok {
						defs[ns+t.Name.Name] = definition{t.Type, ns, imports}
					}
				}
			}
		}
	}
}
func external(path string) string {
	if path == "github.com/viant/forge/backend/types" {
		return ""
	}
	if path == "github.com/viant/forge/backend/window/contract" && windowSource != "" {
		ns := path + "."
		load(windowSource, ns)
		return ns
	}
	ns := path + "."
	if !loaded[ns] {
		command := exec.Command("go", "list", "-f", "{{.Dir}}", path)
		command.Env = append(os.Environ(), "GOWORK=off")
		b, e := command.Output()
		if e != nil {
			loaded[ns] = true
			return ns
		}
		load(strings.TrimSpace(string(b)), ns)
	}
	return ns
}
func ref(name string) S {
	if d, ok := defs[name]; ok {
		if _, exists := generated[name]; !exists {
			generated[name] = S{}
			generated[name] = schema(d.expr, d)
		}
		return S{"$ref": "#/$defs/" + strings.ReplaceAll(name, "/", "~1")}
	}
	return S{}
}
func schema(expr ast.Expr, context definition) S {
	switch t := expr.(type) {
	case *ast.StarExpr:
		return schema(t.X, context)
	case *ast.Ident:
		switch t.Name {
		case "string":
			return S{"type": "string"}
		case "bool":
			return S{"type": "boolean"}
		case "int", "int8", "int16", "int32", "int64", "uint", "uint8", "uint16", "uint32", "uint64", "byte", "rune":
			return S{"type": "integer"}
		case "float32", "float64":
			return S{"type": "number"}
		case "any":
			return S{}
		default:
			return ref(context.namespace + t.Name)
		}
	case *ast.ArrayType:
		return S{"type": "array", "items": schema(t.Elt, context)}
	case *ast.MapType:
		return S{"type": "object", "additionalProperties": schema(t.Value, context)}
	case *ast.SelectorExpr:
		alias, ok := t.X.(*ast.Ident)
		if !ok {
			return S{}
		}
		path := context.imports[alias.Name]
		if path == "time" && t.Sel.Name == "Time" {
			return S{"type": "string", "format": "date-time"}
		}
		if path == "encoding/json" && t.Sel.Name == "RawMessage" {
			return S{}
		}
		if strings.HasPrefix(path, "github.com/") {
			return ref(external(path) + t.Sel.Name)
		}
		return S{}
	case *ast.StructType:
		properties := S{}
		embedded := []S{}
		for _, field := range t.Fields.List {
			if len(field.Names) == 0 {
				embedded = append(embedded, schema(field.Type, context))
				continue
			}
			if !ast.IsExported(field.Names[0].Name) {
				continue
			}
			tag := ""
			if field.Tag != nil {
				tag = strings.Trim(field.Tag.Value, "`")
			}
			yamlTag, present := reflect.StructTag(tag).Lookup("yaml")
			if !present {
				yamlTag = reflect.StructTag(tag).Get("json")
			}
			name := strings.Split(yamlTag, ",")[0]
			if name == "-" {
				continue
			}
			if name == "" {
				name = field.Names[0].Name
			}
			child := schema(field.Type, context)
			if field.Doc != nil {
				child["description"] = strings.TrimSpace(field.Doc.Text())
			}
			properties[name] = child
		}
		result := S{"type": "object", "properties": properties, "additionalProperties": true}
		if len(embedded) > 0 {
			result["allOf"] = embedded
		}
		return result
	default:
		return S{}
	}
}
func main() {
	source := flag.String("source", "backend/types", "canonical types directory")
	out := flag.String("out", "src/window-editor/forgeWindowSchema.json", "output")
	descriptor := flag.String("descriptor-source", "", "committed Forge backend/datasource/contract directory")
	window := flag.String("window-source", "", "committed Forge backend/window/contract directory")
	modelCommit := flag.String("source-commit", "", "exact committed Forge authored source revision")
	flag.Parse()
	descriptorSource = *descriptor
	windowSource = *window
	if descriptorSource == "" || windowSource == "" || *modelCommit == "" {
		panic("Use scripts/verify-window-editor-canonical.sh to export exact committed canonical sources and generate the schema")
	}
	load(*source, "")
	ref("Window")
	ref("WindowResourceEnvelope")
	if descriptorSource != "" {
		ns := "github.com/viant/forge/backend/datasource/contract."
		load(descriptorSource, ns)
		descriptor := ref(ns + "DataSource")
		variant := generated["WindowResourceVariant"].(S)
		variant["properties"].(S)["dataSources"] = S{"type": "object", "additionalProperties": descriptor}
	}
	commitCommand := exec.Command("git", "log", "-1", "--format=%H", "--", ".")
	commitCommand.Dir = *source
	commitBytes, _ := commitCommand.Output()
	if *modelCommit != "" {
		commitBytes = []byte(*modelCommit)
	}
	result := S{"$schema": "https://json-schema.org/draft/2020-12/schema", "$ref": "#/$defs/Window", "$defs": generated, "x-forge-provenance": S{"generator": "scripts/window-schema/main.go", "baseCommit": strings.TrimSpace(string(commitBytes)), "sourceNote": "Generated from committed canonical Forge authored model and Forge-owned public contracts; SHA-256 identifies every parsed source file.", "sha256": provenance}}
	bytes, _ := json.MarshalIndent(result, "", "  ")
	if err := os.WriteFile(*out, append(bytes, '\n'), 0644); err != nil {
		panic(err)
	}
}
