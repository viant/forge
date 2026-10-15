// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package datasource

import (
	"reflect"
	"testing"
)

func TestExpandNestedArgsCreatesIndexedCollections(t *testing.T) {
	actual := expandNestedArgs(map[string]interface{}{
		"Records.0.name": "first",
		"Records.0.tags": []string{"one", "two"},
		"Records.1.name": "second",
		"Mode":           "lookup",
	})
	want := map[string]interface{}{
		"Records": []interface{}{
			map[string]interface{}{"name": "first", "tags": []string{"one", "two"}},
			map[string]interface{}{"name": "second"},
		},
		"Mode": "lookup",
	}
	if !reflect.DeepEqual(actual, want) {
		t.Fatalf("unexpected nested arguments:\n got: %#v\nwant: %#v", actual, want)
	}
}

func TestExpandNestedArgsMergesObjectAndDottedChildrenDeterministically(t *testing.T) {
	actual := expandNestedArgs(map[string]interface{}{
		"Body":          map[string]interface{}{"model": map[string]interface{}{"scope": "all"}},
		"Body.model.id": 42,
		"Body.lookup.0": "alpha",
		"Body.lookup.1": "beta",
	})
	body := actual["Body"].(map[string]interface{})
	model := body["model"].(map[string]interface{})
	if model["scope"] != "all" || model["id"] != 42 {
		t.Fatalf("object and dotted child did not merge: %#v", actual)
	}
	if !reflect.DeepEqual(body["lookup"], []interface{}{"alpha", "beta"}) {
		t.Fatalf("indexed child did not become a slice: %#v", actual)
	}
}
