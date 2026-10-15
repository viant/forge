// SPDX-License-Identifier: Apache-2.0
// Extracted from Viant Agently Core.
package reporting

import "encoding/json"

func cloneJSONMap(value map[string]interface{}) map[string]interface{} {
	if len(value) == 0 {
		return nil
	}
	encoded, err := json.Marshal(value)
	if err != nil {
		result := make(map[string]interface{}, len(value))
		for key, item := range value {
			result[key] = item
		}
		return result
	}
	var result map[string]interface{}
	if json.Unmarshal(encoded, &result) != nil {
		return nil
	}
	return result
}
