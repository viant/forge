// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package datasource

// A value column is an explicit authoring choice; ordinary object/row projection
// keeps its original behavior when it is absent.
func projectValueRows(raw interface{}, column string) []map[string]interface{} {
	if raw == nil {
		return nil
	}
	switch values := raw.(type) {
	case []interface{}:
		rows := make([]map[string]interface{}, 0, len(values))
		for _, value := range values {
			rows = append(rows, map[string]interface{}{column: value})
		}
		return rows
	default:
		return []map[string]interface{}{{column: raw}}
	}
}
