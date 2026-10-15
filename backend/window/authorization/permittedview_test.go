// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package permittedview

import (
	"encoding/json"
	"testing"
	"time"

	forgetypes "github.com/viant/forge/backend/types"
)

func testWindow(t *testing.T) *forgetypes.Window {
	t.Helper()
	source := []byte(`{
  "authorization":{"scope":"resource","resource":{"type":"advertiser","id":{"source":"windowForm","selector":"AdvertiserId.0"}},"requestedCapabilities":["read","write","viewHistory"],"behavior":{"failClosed":true}},
  "dataSource":{"identity":{},"edit":{},"history":{}},
  "view":{"content":{"id":"root","containers":[
    {"id":"overview","dataSourceRef":"identity"},
    {"id":"edit","dataSourceRef":"edit","visibleWhen":{"source":"authorization","field":"resource.capabilities.write","equals":true}},
    {"id":"history","dataSourceRef":"history","visibleWhen":{"source":"authorization","field":"resource.capabilities.viewHistory","equals":true}}
  ]}}
}`)
	result := &forgetypes.Window{}
	if err := json.Unmarshal(source, result); err != nil {
		t.Fatal(err)
	}
	return result
}

func TestBindAndCompile(t *testing.T) {
	bound, err := Bind(testWindow(t), "advertiser-85141", "conversation-1", map[string]any{"AdvertiserId": []int{85141}})
	if err != nil {
		t.Fatal(err)
	}
	request, err := ResolveRequest(bound)
	if err != nil {
		t.Fatal(err)
	}
	if request.ResourceType != "advertiser" || len(request.ResourceIDs) != 1 || request.ResourceIDs[0] != 85141 {
		t.Fatalf("unexpected authorization request: %#v", request)
	}
	snapshot := &Snapshot{AuthorizationVersion: "v1", ExpiresAt: time.Now().Add(time.Minute), Resources: map[string]*Resource{
		"85141": {Type: "advertiser", ID: 85141, Capabilities: map[string]bool{"read": true, "write": false, "viewHistory": true}},
	}}
	compiled, err := Compile(bound, snapshot)
	if err != nil {
		t.Fatal(err)
	}
	if compiled.Denied {
		t.Fatalf("unexpected compiled result: %#v", compiled)
	}
	ids := []string{}
	for _, container := range compiled.Window.View.Content.Containers {
		ids = append(ids, container.ID)
	}
	if got := stringsJoin(ids); got != "overview,history" {
		t.Fatalf("unexpected permitted containers %q", got)
	}
	if compiled.DataSourceRefs["edit"] || !compiled.DataSourceRefs["identity"] || !compiled.DataSourceRefs["history"] {
		t.Fatalf("unexpected permitted datasource refs: %#v", compiled.DataSourceRefs)
	}
}

func TestCompileDoesNotUseEntityReadAsWindowAdmission(t *testing.T) {
	bound, err := Bind(testWindow(t), "advertiser-85141", "conversation-1", map[string]any{"AdvertiserId": []any{85141.0}})
	if err != nil {
		t.Fatal(err)
	}
	compiled, err := Compile(bound, &Snapshot{Resources: map[string]*Resource{}})
	if err != nil {
		t.Fatal(err)
	}
	if compiled.Denied || compiled.Window == nil || len(compiled.DataSourceRefs) == 0 {
		t.Fatalf("entity permission unexpectedly denied owner-provided frame: %#v", compiled)
	}
}

func TestCompileRejectsMalformedAuthorizationGuards(t *testing.T) {
	for _, guard := range []string{"hiddenWhen", "disabledWhen", "readOnlyWhen", "visibleWhen"} {
		t.Run(guard, func(t *testing.T) {
			raw := `{"authorization":{"resourceType":"document"},"view":{"content":{"id":"root","containers":[{"id":"item","` + guard + `":{"source":"authorization","field":"principal.roles","greaterThan":1}}]}}}`
			window := &forgetypes.Window{}
			if err := json.Unmarshal([]byte(raw), window); err != nil {
				t.Fatal(err)
			}
			if _, err := Compile(&BoundView{Window: window, ResourceType: "document"}, &Snapshot{}); err == nil {
				t.Fatal("malformed guard was accepted")
			}
		})
	}
}

func TestBindAcceptsScalarForExplicitSingletonSelector(t *testing.T) {
	bound, err := Bind(testWindow(t), "advertiser-85141", "conversation-1", map[string]any{"AdvertiserId": 85141})
	if err != nil {
		t.Fatal(err)
	}
	request, err := ResolveRequest(bound)
	if err != nil {
		t.Fatal(err)
	}
	if len(request.ResourceIDs) != 1 || request.ResourceIDs[0] != 85141 {
		t.Fatalf("unexpected singleton authorization request: %#v", request)
	}
}

func TestBindRejectsScalarForNonzeroArraySelector(t *testing.T) {
	window := testWindow(t)
	window.Authorization.Resource.ID.Selector = "AdvertiserId.1"
	if _, err := Bind(window, "advertiser-85141", "conversation-1", map[string]any{"AdvertiserId": 85141}); err == nil {
		t.Fatal("expected nonzero scalar array selector to remain unresolved")
	}
}

func stringsJoin(values []string) string {
	result := ""
	for _, value := range values {
		if result != "" {
			result += ","
		}
		result += value
	}
	return result
}
