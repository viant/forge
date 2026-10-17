package datasource

import (
	"github.com/viant/forge/backend/types"
	"reflect"
	"testing"
)

func TestNormalizeStringArrayFilters(t *testing.T) {
	ds := &types.DataSource{FilterSet: []types.Filter{{Template: []types.TemplateItem{{ID: "Kind", Operator: "in", Type: "string[]"}}}}}
	for _, tc := range []struct {
		name   string
		value  interface{}
		want   interface{}
		absent bool
	}{
		{"single", "First Kind", []string{"First Kind"}, false},
		{"multiple", " First Kind, Second Kind ", []string{"First Kind", "Second Kind"}, false},
		{"typed", []string{"First, Kind"}, []string{"First, Kind"}, false},
		{"json array", []interface{}{"First Kind"}, []string{"First Kind"}, false},
		{"invalid remains visible", []interface{}{"First", 2}, []interface{}{"First", 2}, false},
		{"clear", "  ", nil, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			input := map[string]interface{}{"Kind": tc.value, "Limit": 10}
			got := normalizeFilterSemantics(input, ds)
			value, exists := got["Kind"]
			if exists == tc.absent || !reflect.DeepEqual(value, tc.want) {
				t.Fatalf("got %#v, exists %v", value, exists)
			}
			if !reflect.DeepEqual(input["Kind"], tc.value) || got["Limit"] != 10 {
				t.Fatal("mutated input or unrelated parameter")
			}
		})
	}
}
