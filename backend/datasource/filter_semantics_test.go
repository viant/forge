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

func TestNormalizeIntegerArrayFilters(t *testing.T) {
	ds := &types.DataSource{FilterSet: []types.Filter{{Template: []types.TemplateItem{{ID: "Ids", Operator: "in", Type: "int[]"}}}}}
	for _, tc := range []struct {
		name        string
		value, want interface{}
	}{
		{"scalar CSV", "1, 2", []int{1, 2}},
		{"native in-control CSV wrapper", []interface{}{"1, 2"}, []int{1, 2}},
		{"mixed numeric and CSV", []interface{}{float64(1), "2,3"}, []int{1, 2, 3}},
		{"string slice", []string{"1,2", "3"}, []int{1, 2, 3}},
		{"typed integers", []int{1, 2}, []int{1, 2}},
		{"invalid retained", []interface{}{"1,bad"}, []interface{}{"1,bad"}},
		{"fraction retained", []interface{}{1.5}, []interface{}{1.5}},
		{"nested array retained", []interface{}{[]interface{}{1}}, []interface{}{[]interface{}{1}}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			input := map[string]interface{}{"Ids": tc.value, "Limit": 10}
			got := normalizeFilterSemantics(input, ds)
			if !reflect.DeepEqual(got["Ids"], tc.want) {
				t.Fatalf("got %#v want %#v", got["Ids"], tc.want)
			}
			if !reflect.DeepEqual(input["Ids"], tc.value) || got["Limit"] != 10 {
				t.Fatal("mutated input or unrelated parameter")
			}
		})
	}
}

func TestNormalizeNumericFilterDoesNotTruncateFraction(t *testing.T) {
	ds := &types.DataSource{FilterSet: []types.Filter{{Template: []types.TemplateItem{{ID: "Cost", Operator: "equal", Type: "number"}}}}}
	got := normalizeFilterSemantics(map[string]interface{}{"Cost": 1.5}, ds)
	if got["Cost"] != 1.5 {
		t.Fatalf("fractional number changed: %#v", got["Cost"])
	}
}
