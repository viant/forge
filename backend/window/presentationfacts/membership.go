// Package presentationfacts indexes detached UI display facts. It neither
// authorizes resource access nor changes the facts' serialized representation.
package presentationfacts

import "strings"

// Membership is owned by one detached evaluation scope. Build a new index for
// each new scope; retaining indexes by mutable input pointer would become stale.
type Membership struct {
	fields map[string]map[string]struct{}
}

// NewMembership captures exact string membership for selected collection paths.
// Strings retain their separate substring semantics in the caller's evaluator.
func NewMembership(values map[string]any, paths ...string) *Membership {
	index := &Membership{fields: make(map[string]map[string]struct{}, len(paths))}
	for _, path := range paths {
		var value any = values
		for _, part := range strings.Split(path, ".") {
			object, ok := value.(map[string]any)
			if !ok {
				value = nil
				break
			}
			value = object[part]
		}
		set := map[string]struct{}{}
		switch collection := value.(type) {
		case []any:
			for _, item := range collection {
				if text, ok := item.(string); ok {
					set[text] = struct{}{}
				}
			}
		case []string:
			for _, text := range collection {
				set[text] = struct{}{}
			}
		case map[string]any:
			for key := range collection {
				set[key] = struct{}{}
			}
		case map[string]bool:
			for key := range collection {
				set[key] = struct{}{}
			}
		default:
			continue
		}
		index.fields[path] = set
	}
	return index
}

// Contains returns handled=false for non-string operands or unindexed values,
// allowing the caller to retain its existing generic comparison semantics.
func (m *Membership) Contains(path string, expected any) (match, handled bool) {
	if m == nil {
		return false, false
	}
	text, ok := expected.(string)
	if !ok {
		return false, false
	}
	set, indexed := m.fields[path]
	if !indexed {
		return false, false
	}
	_, match = set[text]
	return match, true
}
