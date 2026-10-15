// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package datasource

import (
	"encoding/json"
	"github.com/viant/forge/backend/types"
	"testing"
)

func TestPagingRetainsUseNumberInputs(t *testing.T) {
	rows := make([]map[string]interface{}, 10)
	for i := range rows {
		rows[i] = map[string]interface{}{"id": 30 + i}
	}
	source := &types.DataSource{Paging: &types.PagingConfig{Enabled: true, Size: 20, Parameters: &types.PagingParameters{Page: "Offset", Size: "Limit"}}}
	result, info := applyPaging(rows, map[string]interface{}{"totalCount": 60}, source, map[string]interface{}{"Offset": json.Number("30"), "Limit": json.Number("10")})
	if len(result) != 10 || info["page"] != 4 || info["pageSize"] != 10 || info["pageCount"] != 6 {
		t.Fatalf("UseNumber inputs lost: rows=%d info=%#v", len(result), info)
	}
	for _, test := range []struct {
		value    json.Number
		expected int
	}{{"20", 20}, {"20.0", 20}, {"2e1", 20}, {"1e-1000000000", 0}, {"9223372036854775808", 7}, {"18446744073709551615", 7}, {"-9223372036854775809", 7}, {"1e100", 7}, {"-1e100", 7}, {"invalid", 7}, {"NaN", 7}, {"Infinity", 7}, {"-Infinity", 7}, {"1e1000", 7}} {
		if result := intArg(map[string]interface{}{"value": test.value}, "value", 7); result != test.expected {
			t.Errorf("intArg(%q)=%d want %d", test.value, result, test.expected)
		}
	}
}
