// Package schema exposes canonical Forge authoring schemas from the linked version.
package schema

import (
	"crypto/sha256"
	"embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"sync"

	"github.com/xeipuuv/gojsonpointer"
)

//go:generate node generate.mjs
//go:embed report-spec.json window.json
var documents embed.FS

var ErrSelection = errors.New("invalid authoring schema selection")

// Selection retains source identity while explicitly distinguishing a fragment
// from the complete document. Schema is compact JSON with closed local refs.
type Selection struct {
	SchemaRef   string          `json:"schemaRef"`
	Pointer     string          `json:"pointer"`
	Fingerprint string          `json:"fingerprint"`
	Complete    bool            `json:"complete"`
	Schema      json.RawMessage `json:"schema"`
}
type document struct {
	once         sync.Once
	mu           sync.Mutex
	source       map[string]any
	compact      string
	fingerprint  string
	nodes        map[string]any
	refs         map[string][]string
	selections   map[string]json.RawMessage
	err          error
	computations int
}

var canonical = map[string]*document{"forge:report-spec": {}, "forge:window": {}}

func load(reference string) (*document, error) {
	entry, ok := canonical[reference]
	if !ok {
		return nil, fmt.Errorf("%w: unsupported Forge schema reference %q", ErrSelection, reference)
	}
	entry.once.Do(func() {
		entry.computations++
		name := strings.TrimPrefix(reference, "forge:") + ".json"
		raw, err := documents.ReadFile(name)
		if err != nil {
			entry.err = err
			return
		}
		if err = json.Unmarshal(raw, &entry.source); err != nil {
			entry.err = err
			return
		}
		compact, err := json.Marshal(entry.source)
		if err != nil {
			entry.err = err
			return
		}
		entry.compact = string(compact)
		hash := sha256.Sum256(compact)
		entry.fingerprint = hex.EncodeToString(hash[:])
		entry.nodes = map[string]any{}
		entry.refs = map[string][]string{}
		entry.selections = map[string]json.RawMessage{"": compact}
		entry.index("", entry.source)
	})
	return entry, entry.err
}
func token(value string) string {
	return strings.ReplaceAll(strings.ReplaceAll(value, "~", "~0"), "/", "~1")
}
func (d *document) index(pointer string, value any) []string {
	d.nodes[pointer] = value
	found := map[string]bool{}
	switch actual := value.(type) {
	case map[string]any:
		if ref, ok := actual["$ref"].(string); ok {
			found[ref] = true
		}
		for key, child := range actual {
			for _, ref := range d.index(pointer+"/"+token(key), child) {
				found[ref] = true
			}
		}
	case []any:
		for index, child := range actual {
			for _, ref := range d.index(fmt.Sprintf("%s/%d", pointer, index), child) {
				found[ref] = true
			}
		}
	}
	refs := make([]string, 0, len(found))
	for ref := range found {
		refs = append(refs, ref)
	}
	sort.Strings(refs)
	d.refs[pointer] = refs
	return refs
}

// Compact returns immutable JSON prepared once per schema per process.
func Compact(reference string) (string, error) {
	entry, err := load(reference)
	if err != nil {
		return "", err
	}
	return entry.compact, nil
}

// Resolve returns a caller-owned map without reparsing or regenerating schema.
func Resolve(reference string) (map[string]any, error) {
	entry, err := load(reference)
	if err != nil {
		return nil, err
	}
	return clone(entry.source).(map[string]any), nil
}
func clone(value any) any {
	switch actual := value.(type) {
	case map[string]any:
		result := make(map[string]any, len(actual))
		for key, child := range actual {
			result[key] = clone(child)
		}
		return result
	case []any:
		result := make([]any, len(actual))
		for i, child := range actual {
			result[i] = clone(child)
		}
		return result
	default:
		return value
	}
}

// Select returns a requested schema fragment and its transitive canonical defs.
// The finite canonical node index bounds memoized selections; no network or
// schema catalog traversal occurs on a request. Repeated selections reuse bytes.
func Select(reference, pointer string) (Selection, error) {
	entry, err := load(reference)
	if err != nil {
		return Selection{}, err
	}
	parsed, err := gojsonpointer.NewJsonPointer(pointer)
	if err != nil {
		return Selection{}, fmt.Errorf("%w: %w", ErrSelection, err)
	}
	pointer = parsed.String()
	node, exists := entry.nodes[pointer]
	if !exists {
		return Selection{}, fmt.Errorf("%w: unknown pointer %q", ErrSelection, pointer)
	}
	switch node.(type) {
	case map[string]any, bool:
	default:
		return Selection{}, fmt.Errorf("%w: pointer is not a schema", ErrSelection)
	}
	entry.mu.Lock()
	defer entry.mu.Unlock()
	raw, ok := entry.selections[pointer]
	if !ok {
		result, err := entry.fragment(pointer, node)
		if err != nil {
			return Selection{}, err
		}
		raw, err = json.Marshal(result)
		if err != nil {
			return Selection{}, err
		}
		entry.selections[pointer] = raw
	}
	return Selection{SchemaRef: reference, Pointer: pointer, Fingerprint: entry.fingerprint, Complete: pointer == "", Schema: append(json.RawMessage(nil), raw...)}, nil
}
func (d *document) fragment(pointer string, node any) (map[string]any, error) {
	result := map[string]any{"$schema": d.source["$schema"], "allOf": []any{clone(node)}}
	definitions := map[string]any{}
	visited := map[string]bool{}
	pending := append([]string(nil), d.refs[pointer]...)
	for len(pending) > 0 {
		ref := pending[len(pending)-1]
		pending = pending[:len(pending)-1]
		if visited[ref] {
			continue
		}
		visited[ref] = true
		if !strings.HasPrefix(ref, "#/$defs/") {
			return nil, fmt.Errorf("%w: non-canonical reference %q", ErrSelection, ref)
		}
		refPointer := strings.TrimPrefix(ref, "#")
		// Include the entire referenced definition, retaining its original pointer.
		encodedName := strings.Split(strings.TrimPrefix(refPointer, "/$defs/"), "/")[0]
		rootPointer := "/$defs/" + encodedName
		target, ok := d.nodes[rootPointer]
		if !ok {
			return nil, fmt.Errorf("%w: unresolved reference %q", ErrSelection, ref)
		}
		if _, ok := d.nodes[refPointer]; !ok {
			return nil, fmt.Errorf("%w: unresolved pointer %q", ErrSelection, ref)
		}
		name := strings.ReplaceAll(strings.ReplaceAll(encodedName, "~1", "/"), "~0", "~")
		definitions[name] = clone(target)
		pending = append(pending, d.refs[rootPointer]...)
	}
	if len(definitions) > 0 {
		result["$defs"] = definitions
	}
	return result, nil
}
