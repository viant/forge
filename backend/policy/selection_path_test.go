// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package policy

import (
	"context"
	"reflect"
	"testing"

	"github.com/viant/authz"
)

func TestExplicitBackendSelectionPathsMatchRealMutationPayloads(t *testing.T) {
	resource := authz.Resource{Kind: "window", ID: "window://example/campaign", Version: "1", Tenant: "tenant"}
	for _, tc := range []struct {
		path  string
		input map[string]any
	}{
		{"Campaigns[].Id", map[string]any{"Campaigns": []map[string]any{{"Id": 42, "name": "selected"}, {"Id": 43}}}},
		{"Data.campaignIds[]", map[string]any{"Data": map[string]any{"campaignIds": []int{42, 43}}}},
	} {
		mapper, err := NewStaticBackendMapper([]BackendBinding{{Operation: "datasource.fetch", ID: "campaign", Resource: resource, Action: "execute", EntityType: "campaign", Permission: "archive", SelectionMode: "multiple", SelectionPath: tc.path, SelectionIDFormat: "positiveDecimal"}})
		if err != nil {
			t.Fatal(err)
		}
		actual, action, selected, permission, err := mapper(context.Background(), "datasource.fetch", "campaign", tc.input)
		if err != nil || actual != resource || action != "execute" || permission != "archive" || !reflect.DeepEqual(selected, []authz.Entity{{Type: "campaign", ID: "42"}, {Type: "campaign", ID: "43"}}) {
			t.Fatal("typed mutation selection lost", selected, err)
		}
	}
}

func TestExplicitSelectionPathRejectsMissingMalformedMixedAndUnsafeIDs(t *testing.T) {
	binding := BackendBinding{EntityType: "campaign", SelectionPath: "Campaigns[].Id", SelectionIDFormat: "positiveDecimal", SelectionMode: "multiple"}
	for _, value := range []any{nil, []any{}, []any{nil}, []any{map[string]any{}}, []any{map[string]any{"Id": nil}}, []any{map[string]any{"Id": 1}, map[string]any{"Id": 1}}, []any{map[string]any{"Id": 1}, map[string]any{"Id": "2"}}, []any{map[string]any{"Id": float64(9007199254740992)}}, []any{map[string]any{"Id": "01"}}, []any{map[string]any{"Id": 0}}, map[string]any{"Id": 1}} {
		if selected, err := resolveSelectionPath(map[string]any{"Campaigns": value}, binding); err == nil || selected != nil {
			t.Fatal("invalid path payload admitted", value, selected)
		}
	}
	if _, err := resolveSelectionPath(map[string]any{"Campaigns.Id": []int{1}}, binding); err == nil {
		t.Fatal("literal-key fallback was used")
	}
	for _, path := range []string{"Campaigns.Id[]", "Campaigns[*].Id", "Campaigns..Id", "Campaigns[].", " Campaigns[].Id"} {
		copy := binding
		copy.SelectionPath = path
		if selected, err := resolveSelectionPath(map[string]any{"Campaigns": []any{map[string]any{"Id": 1}}}, copy); err == nil || selected != nil {
			t.Fatal("implicit array or invalid path admitted", path)
		}
	}
}
