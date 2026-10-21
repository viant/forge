package uicontext

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/url"
	"regexp"
	"sort"
	"strings"
)

const RedactedValue = "[redacted]"

var ErrReadBudget = errors.New("UI read exceeds the bounded projection budget")

// ReadOptions is trusted host configuration, never supplied by the browser or
// model. PreservePaths retains existing runtime pin contracts verbatim; callers
// should instead omit pins from new public read contracts.
type ReadOptions struct {
	Metadata      map[string]interface{}
	DataSourceRef string
	PreservePaths []string
	MaxBytes      int
	MaxDepth      int
	MaxItems      int
	MaxFields     int
	MaxString     int
}
type ReadResult struct {
	JSON      json.RawMessage
	Redacted  bool
	Truncated bool
}

var credentialText = regexp.MustCompile(`(?i)\b(?:basic|bearer)\s+\S+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+`)

func isCredentialText(value string) bool {
	if credentialText.MatchString(value) {
		return true
	}
	if parsed, err := url.Parse(value); err == nil {
		if parsed.User != nil {
			if _, ok := parsed.User.Password(); ok {
				return true
			}
		}
		for key := range parsed.Query() {
			if SensitiveKey(key) || strings.EqualFold(key, "key") {
				return true
			}
		}
		if fragment, err := url.ParseQuery(parsed.Fragment); err == nil {
			for key := range fragment {
				if SensitiveKey(key) || strings.EqualFold(key, "key") {
					return true
				}
			}
		}
	}
	return false
}
func boundedOption(value, fallback, maximum int) int {
	if value <= 0 {
		return fallback
	}
	if value > maximum {
		return maximum
	}
	return value
}

// RedactReadJSON projects existing captured state without fetching data. Safe
// shape/identities are retained, sensitive values are replaced, and truncation
// is explicit in ReadResult. No error permits a raw-output fallback.
func RedactReadJSON(raw json.RawMessage, options ReadOptions) (ReadResult, error) {
	result := ReadResult{}
	if len(raw) > 4<<20 {
		return result, ErrReadBudget
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.UseNumber()
	var value interface{}
	if err := decoder.Decode(&value); err != nil {
		return result, err
	}
	if err := decoder.Decode(new(interface{})); err != io.EOF {
		if err == nil {
			err = errors.New("UI read must contain one JSON value")
		}
		return result, err
	}
	maxBytes := boundedOption(options.MaxBytes, 65536, 262144)
	maxDepth := boundedOption(options.MaxDepth, 12, 24)
	maxItems := boundedOption(options.MaxItems, 100, 200)
	maxFields := boundedOption(options.MaxFields, 100, 200)
	maxString := boundedOption(options.MaxString, 4096, 8192)
	sensitive, complete := collectSensitiveFields(options.Metadata)
	if !complete {
		return result, ErrReadBudget
	}
	preserved := map[string]bool{}
	for _, path := range options.PreservePaths {
		preserved[path] = true
	}
	protectedBranch := func(path string) bool {
		for preservedPath := range preserved {
			if path == "" || path == preservedPath || strings.HasPrefix(preservedPath, path+".") {
				return true
			}
		}
		return false
	}
	var proofBytes func(interface{}, string) int
	proofBytes = func(value interface{}, path string) int {
		if preserved[path] {
			encoded, _ := json.Marshal(value)
			return len(encoded)
		}
		total := 0
		switch typed := value.(type) {
		case map[string]interface{}:
			for key, child := range typed {
				childPath := key
				if path != "" {
					childPath = path + "." + key
				}
				if protectedBranch(childPath) {
					total += proofBytes(child, childPath)
				}
			}
		case []interface{}:
			for _, child := range typed {
				total += proofBytes(child, path)
			}
		}
		return total
	}
	reserved := proofBytes(value, "")
	if reserved > maxBytes-64 {
		return result, ErrReadBudget
	}
	stateBudget := maxBytes - reserved
	used := 0
	privateField := func(ref, path, key string) bool {
		if SensitiveKey(key) {
			return true
		}
		fields := sensitive[ref]
		if ref == "" {
			fields = map[string]bool{}
			for _, items := range sensitive {
				for field := range items {
					fields[field] = true
				}
			}
		}
		for field := range fields {
			if key == field || strings.HasSuffix(path, "."+field) || path == field {
				return true
			}
		}
		return false
	}
	var walk func(interface{}, string, string, int, bool) (interface{}, error)
	walk = func(value interface{}, path, ref string, depth int, sensitiveControl bool) (interface{}, error) {
		if preserved[path] {
			return value, nil
		}
		if (used > stateBudget-32 || depth > maxDepth) && !protectedBranch(path) {
			result.Truncated = true
			return nil, nil
		}
		switch typed := value.(type) {
		case map[string]interface{}:
			if ds, ok := typed["dataSourceRef"].(string); ok {
				ref = ds
			}
			field, _ := typed["dataField"].(string)
			if field == "" {
				field, _ = typed["bindingPath"].(string)
			}
			if field == "" {
				field, _ = typed["controlId"].(string)
			}
			if field == "" {
				field, _ = typed["id"].(string)
			}
			typ, _ := typed["type"].(string)
			sensitiveControl = sensitiveControl || typed["sensitive"] == true || typed["secret"] == true || SensitiveKey(typ) || (field != "" && privateField(ref, field, field))
			keys := make([]string, 0, len(typed))
			for key := range typed {
				keys = append(keys, key)
			}
			// Stable record identities survive bounded map projections.
			identity := func(key string) bool {
				key = strings.ToLower(key)
				return key == "id" || strings.HasSuffix(key, "id") || strings.HasSuffix(key, "ids")
			}
			priority := func(key string) int {
				if identity(key) || key == "operationRevision" || key == "selected" || key == "selection" || key == "semanticContext" || key == "formStatus" {
					return 0
				}
				childPath := key
				if path != "" {
					childPath = path + "." + key
				}
				if protectedBranch(childPath) {
					return 1
				}
				if key == "input" || key == "filter" || key == "form" || key == "windowForm" || key == "viewState" || key == "surface" {
					return 2
				}
				if key == "metadata" || key == "collection" || key == "metrics" {
					return 4
				}
				return 3
			}
			sort.Slice(keys, func(i, j int) bool {
				if priority(keys[i]) != priority(keys[j]) {
					return priority(keys[i]) < priority(keys[j])
				}
				return keys[i] < keys[j]
			})
			out := map[string]interface{}{}
			used += 2
			for i, key := range keys {
				childPath := key
				if path != "" {
					childPath = path + "." + key
				}
				if (i >= maxFields || used > stateBudget-32) && !protectedBranch(childPath) {
					result.Truncated = true
					continue
				}
				if (len(key) > 128 || len(key)+4 > stateBudget-used-24) && !protectedBranch(childPath) {
					result.Truncated = true
					continue
				}
				used += len(key) + 4
				if !preserved[childPath] && (privateField(ref, childPath, key) || (sensitiveControl && (key == "value" || key == "default" || key == "defaultValue"))) {
					out[key] = RedactedValue
					result.Redacted = true
					used += len(RedactedValue) + 2
					continue
				}
				childRef := ref
				if strings.HasSuffix(path, "dataSources") {
					childRef = key
				}
				clean, err := walk(typed[key], childPath, childRef, depth+1, sensitiveControl)
				if err != nil {
					return nil, err
				}
				out[key] = clean
			}
			return out, nil
		case []interface{}:
			out := []interface{}{}
			used += 2
			for i, item := range typed {
				if i == maxItems || (used > stateBudget-32 && !protectedBranch(path)) {
					result.Truncated = true
					break
				}
				clean, err := walk(item, path, ref, depth+1, sensitiveControl)
				if err != nil {
					return nil, err
				}
				out = append(out, clean)
				used++
			}
			return out, nil
		case string:
			if isCredentialText(typed) {
				result.Redacted = true
				used += len(RedactedValue) + 2
				return RedactedValue, nil
			}
			if len(typed) > maxString {
				typed = typed[:maxString] + "…"
				result.Truncated = true
			}
			encoded, _ := json.Marshal(typed)
			if len(encoded) > stateBudget-used {
				result.Truncated = true
				return nil, nil
			}
			used += len(encoded)
			return typed, nil
		default:
			encoded, err := json.Marshal(value)
			if err != nil {
				return nil, err
			}
			if len(encoded) > stateBudget-used {
				result.Truncated = true
				return nil, nil
			}
			used += len(encoded)
			return value, nil
		}
	}
	clean, err := walk(value, "", options.DataSourceRef, 0, false)
	if err != nil {
		return result, err
	}
	encoded, err := json.Marshal(clean)
	if err != nil {
		return result, err
	}
	if len(encoded) > maxBytes {
		return result, ErrReadBudget
	}
	result.JSON = encoded
	return result, nil
}
