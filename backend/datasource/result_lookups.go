// SPDX-License-Identifier: Apache-2.0
package datasource

import (
	"maps"
	"slices"
	"strings"
	"unicode"

	dsproto "github.com/viant/forge/backend/datasource/contract"
)

func projectResultLookups(rows []map[string]any, lookups map[string]dsproto.ResultLookup) []map[string]any {
	if len(lookups) == 0 {
		return rows
	}

	var projected []map[string]any
	for index, row := range rows {
		output := resultLookupRow(row, nil, lookups)
		if output == nil {
			continue
		}
		if projected == nil {
			projected = slices.Clone(rows)
		}
		projected[index] = output
	}
	if projected != nil {
		return projected
	}
	return rows
}

// output is already owned on the cache-hit path. Otherwise copy the row only
// on the first match. Always read the original row so lookups cannot chain.
func resultLookupRow(row, output map[string]any, lookups map[string]dsproto.ResultLookup) map[string]any {
	for target, lookup := range lookups {
		if _, exists := row[target]; exists || target == "" || target == "__proto__" || target == "constructor" || target == "prototype" {
			continue
		}
		key, ok := row[lookup.Field].(string)
		if !ok {
			continue
		}
		if lookup.TrimSpace {
			// Match the window runtime's ECMAScript String.trim semantics.
			key = strings.TrimFunc(key, func(r rune) bool {
				return r == '\uFEFF' || r != '\u0085' && unicode.IsSpace(r)
			})
		}
		value, found := lookup.Values[key]
		if !found {
			continue
		}
		if output == nil {
			output = maps.Clone(row)
		}
		if value == nil {
			output[target] = nil
		} else {
			output[target] = *value
		}
	}
	return output
}
