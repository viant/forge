// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package datasource

import (
	"fmt"
	"strings"

	"github.com/viant/forge/backend/types"
)

// project applies the forge Selectors to the backend payload and returns
// (rows, dataInfo, metrics). Rows are always []map[string]interface{}.
func project(raw interface{}, ds *types.DataSource) ([]map[string]interface{}, map[string]interface{}, map[string]interface{}) {
	rowsRaw := raw
	var dataInfo map[string]interface{}
	var metrics map[string]interface{}
	if ds != nil && ds.Selectors != nil {
		if ds.Selectors.Data != "" {
			rowsRaw = selectPath(ds.Selectors.Data, raw)
			if len(ds.Selectors.DataFallbacks) > 0 {
				rowsRaw = selectDataPath(ds.Selectors.Data, ds.Selectors.DataFallbacks, raw)
			}
			if len(ds.Selectors.DataFallbacks) == 0 && rowsRaw == nil && strings.EqualFold(strings.TrimSpace(ds.Selectors.Data), "data") {
				switch raw.(type) {
				case []map[string]interface{}, []interface{}:
					rowsRaw = raw
				}
			}
		}
		if ds.Selectors.DataInfo != "" {
			if di, ok := selectPath(ds.Selectors.DataInfo, raw).(map[string]interface{}); ok {
				dataInfo = di
			}
		}
		if ds.Selectors.Metrics != "" {
			if met, ok := selectPath(ds.Selectors.Metrics, raw).(map[string]interface{}); ok {
				metrics = met
			}
		}
	}
	if ds != nil && ds.Selectors != nil && ds.Selectors.ValueColumn != "" {
		return projectValueRows(rowsRaw, ds.Selectors.ValueColumn), dataInfo, metrics
	}
	rows := coerceRows(rowsRaw)
	return rows, dataInfo, metrics
}

// selectDataPath uses declared alternatives only when the preceding path is
// absent. An explicitly present nil, empty array, false or zero wins.
func selectDataPath(primary string, fallbacks []string, root interface{}) interface{} {
	for _, path := range append([]string{primary}, fallbacks...) {
		if value, present := lookupDataPath(path, root); present {
			return value
		}
	}
	return nil
}

// lookupDataPath is scoped to opt-in data fallbacks; selectPath retains its
// existing behavior for info/metrics and definitions without alternatives.
func lookupDataPath(selector string, root interface{}) (interface{}, bool) {
	norm := strings.TrimPrefix(strings.ReplaceAll(strings.ReplaceAll(strings.TrimSpace(selector), "[", "."), "]", ""), ".")
	cur := root
	for _, token := range strings.Split(norm, ".") {
		token = strings.TrimSpace(token)
		if token == "" {
			continue
		}
		switch actual := cur.(type) {
		case map[string]interface{}:
			value, present := actual[token]
			if !present {
				return nil, false
			}
			cur = value
		case []map[string]interface{}:
			idx, ok := dataPathIndex(token, len(actual))
			if !ok {
				return nil, false
			}
			cur = actual[idx]
		case []interface{}:
			idx, ok := dataPathIndex(token, len(actual))
			if !ok {
				return nil, false
			}
			cur = actual[idx]
		default:
			return nil, false
		}
	}
	return cur, true
}

func dataPathIndex(token string, size int) (int, bool) {
	for _, char := range token {
		if char < '0' || char > '9' {
			return 0, false
		}
	}
	idx := -1
	if _, err := fmt.Sscanf(token, "%d", &idx); err != nil || idx < 0 || idx >= size {
		return 0, false
	}
	return idx, true
}

// coerceRows turns whatever the selector returned into []map[string]interface{}.
func coerceRows(v interface{}) []map[string]interface{} {
	switch arr := v.(type) {
	case []map[string]interface{}:
		return arr
	case []interface{}:
		out := make([]map[string]interface{}, 0, len(arr))
		for _, it := range arr {
			if m, ok := it.(map[string]interface{}); ok {
				out = append(out, m)
			}
		}
		return out
	case map[string]interface{}:
		// Single-row payload.
		return []map[string]interface{}{arr}
	case nil:
		return nil
	default:
		return nil
	}
}

// selectPath mirrors the forge/feedextract dot+[idx] path walker.
// Supports: "a.b.c" and "a[0].b" and "a.0.b".
func selectPath(selector string, root interface{}) interface{} {
	selector = strings.TrimSpace(selector)
	if selector == "" {
		return root
	}
	cur := root
	norm := strings.ReplaceAll(selector, "[", ".")
	norm = strings.ReplaceAll(norm, "]", "")
	norm = strings.TrimPrefix(norm, ".")
	for _, token := range strings.Split(norm, ".") {
		token = strings.TrimSpace(token)
		if token == "" {
			continue
		}
		if cur == nil {
			return nil
		}
		switch actual := cur.(type) {
		case map[string]interface{}:
			if value, ok := actual[token]; ok {
				cur = value
			} else {
				return nil
			}
		case []map[string]interface{}:
			idx := -1
			for _, r := range token {
				if r < '0' || r > '9' {
					return nil
				}
			}
			if token != "" {
				fmt.Sscanf(token, "%d", &idx)
			}
			if idx < 0 || idx >= len(actual) {
				return nil
			}
			cur = actual[idx]
		case []interface{}:
			idx := -1
			for _, r := range token {
				if r < '0' || r > '9' {
					return nil
				}
			}
			if token != "" {
				fmt.Sscanf(token, "%d", &idx)
			}
			if idx < 0 || idx >= len(actual) {
				return nil
			}
			cur = actual[idx]
		default:
			return nil
		}
	}
	return cur
}
