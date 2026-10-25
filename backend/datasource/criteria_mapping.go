package datasource

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"reflect"
	"regexp"
	"strconv"
	"strings"

	dsproto "github.com/viant/forge/backend/datasource/contract"
)

var criteriaInputName = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*$`)
var criteriaColumnName = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$`)

// criteriaArguments never edits the logical request. Producer authorization and
// Criteria validation remain upstream; authored mappings only serialize values.
func criteriaArguments(args map[string]interface{}, backend *dsproto.Backend) (map[string]interface{}, string, error) {
	mapping := backend.CriteriaMapping
	if mapping == nil {
		return args, "", nil
	}
	if backend.Kind != dsproto.BackendMCPTool || !criteriaInputName.MatchString(mapping.Parameter) || len(mapping.Fields) == 0 {
		return nil, "", fmt.Errorf("criteriaMapping requires an MCP tool, selector parameter and explicit fields")
	}
	if mapping.LiteralGrammar != "" && mapping.LiteralGrammar != "sql" && mapping.LiteralGrammar != "simple" {
		return nil, "", fmt.Errorf("unsupported criteriaMapping literal grammar")
	}
	for _, key := range backend.RequestMetadata {
		if key == mapping.Parameter {
			return nil, "", fmt.Errorf("criteriaMapping selector cannot be request metadata")
		}
	}
	result := transportArguments(args, nil)
	parts := []string{}
	if base, exists := result[mapping.Parameter]; exists && base != nil && base != "" {
		pinned, trusted := backend.Pinned[mapping.Parameter]
		text, valid := base.(string)
		if !trusted || !valid || !reflect.DeepEqual(base, pinned) {
			return nil, "", fmt.Errorf("criteriaMapping reserves its selector parameter")
		}
		parts = append(parts, "("+text+")")
	}
	seen := map[string]bool{}
	for _, field := range mapping.Fields {
		if !criteriaInputName.MatchString(field.Input) || field.Input == mapping.Parameter || seen[field.Input] || !criteriaColumnName.MatchString(field.Field) {
			return nil, "", fmt.Errorf("criteriaMapping has an invalid or duplicate input/column")
		}
		seen[field.Input] = true
		op := strings.ToLower(field.Operator)
		if op != "equal" && op != "contains" && op != "in" {
			return nil, "", fmt.Errorf("unsupported criteriaMapping operator %q", field.Operator)
		}
		if field.Type != "string" && field.Type != "int" && field.Type != "number" && field.Type != "bool" {
			return nil, "", fmt.Errorf("unsupported criteriaMapping type %q", field.Type)
		}
		if op == "contains" && field.Type != "string" {
			return nil, "", fmt.Errorf("criteriaMapping contains requires string values")
		}
		value, exists := result[field.Input]
		delete(result, field.Input)
		if !exists || value == nil || value == "" {
			continue
		}
		if mapping.LiteralGrammar == "simple" && containsCriteriaQuote(value) {
			return nil, "", fmt.Errorf("filter %q contains a quote unsupported by this data source", field.Input)
		}
		if op == "in" {
			values := reflect.ValueOf(value)
			if values.Kind() != reflect.Slice && values.Kind() != reflect.Array {
				return nil, "", fmt.Errorf("criteriaMapping in requires a typed array")
			}
			if values.Len() == 0 {
				continue
			}
			literals := make([]string, values.Len())
			for i := range literals {
				literal, err := criteriaLiteral(values.Index(i).Interface(), field.Type)
				if err != nil {
					return nil, "", err
				}
				literals[i] = literal
			}
			parts = append(parts, field.Field+" IN ("+strings.Join(literals, ", ")+")")
			continue
		}
		if op == "contains" {
			text, ok := value.(string)
			if !ok {
				return nil, "", fmt.Errorf("criteriaMapping expected string input %q", field.Input)
			}
			// Datly binds this literal. Backslashes are retained for LIKE's
			// literal wildcard escaping, rather than interpolated into SQL.
			value = "%" + strings.NewReplacer(`\`, `\\`, "%", `\%`, "_", `\_`).Replace(text) + "%"
		}
		literal, err := criteriaLiteral(value, field.Type)
		if err != nil {
			return nil, "", err
		}
		operator := " = "
		if op == "contains" {
			operator = " LIKE "
		}
		parts = append(parts, field.Field+operator+literal)
	}
	delete(result, mapping.Parameter)
	criteria := strings.Join(parts, " AND ")
	if criteria != "" {
		result[mapping.Parameter] = criteria
	}
	// Explicit cache policies cannot collapse two different mapped filters.
	sum := sha256.Sum256([]byte(mapping.Parameter + "\x00" + criteria))
	return result, "|criteria:" + hex.EncodeToString(sum[:]), nil
}

func containsCriteriaQuote(value interface{}) bool {
	if text, ok := value.(string); ok {
		return strings.Contains(text, "'")
	}
	v := reflect.ValueOf(value)
	if v.Kind() == reflect.Slice || v.Kind() == reflect.Array {
		for i := 0; i < v.Len(); i++ {
			if containsCriteriaQuote(v.Index(i).Interface()) {
				return true
			}
		}
	}
	return false
}

func criteriaLiteral(value interface{}, kind string) (string, error) {
	switch kind {
	case "string":
		if text, ok := value.(string); ok {
			return "'" + strings.ReplaceAll(text, "'", "''") + "'", nil
		}
	case "bool":
		if boolean, ok := value.(bool); ok {
			return strconv.FormatBool(boolean), nil
		}
	case "int", "number":
		text := ""
		switch number := value.(type) {
		case json.Number:
			text = number.String()
		default:
			v := reflect.ValueOf(value)
			switch v.Kind() {
			case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
				text = strconv.FormatInt(v.Int(), 10)
			case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
				text = strconv.FormatUint(v.Uint(), 10)
			case reflect.Float32, reflect.Float64:
				n := v.Float()
				if !math.IsNaN(n) && !math.IsInf(n, 0) && (kind != "int" || math.Trunc(n) == n) {
					text = strconv.FormatFloat(n, 'f', -1, v.Type().Bits())
				}
			}
		}
		if text != "" {
			if kind == "int" {
				if _, err := strconv.ParseInt(text, 10, 64); err == nil {
					return text, nil
				}
			} else if n, err := strconv.ParseFloat(text, 64); err == nil && !math.IsNaN(n) && !math.IsInf(n, 0) {
				return text, nil
			}
		}
	}
	return "", fmt.Errorf("criteriaMapping expected %s value, got %T", kind, value)
}
