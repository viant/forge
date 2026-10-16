// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package permittedview

import (
	"context"
	"encoding/json"
	"github.com/stretchr/testify/require"
	"github.com/viant/forge/backend/types"
	"testing"
	"time"
)

type projectionPrincipal struct {
	roles, features []string
	calls           int
}

func (r *projectionPrincipal) Resolve(_ context.Context, request *Request) (*Snapshot, error) {
	r.calls++
	if !request.IncludePrincipal || len(request.ResourceIDs) != 0 || len(request.StringResourceIDs) != 0 || request.ResourceType != "" || len(request.RequestedCapabilities) != 0 || len(request.RequestedGlobalCapabilities) != 0 {
		panic("UI projection requested resource permission")
	}
	return &Snapshot{AuthorizationVersion: "current", ExpiresAt: time.Now().Add(time.Minute), Principal: map[string]any{"roles": r.roles, "features": r.features}}, nil
}
func TestWindowProjectionUsesOnlyPrincipalRolesAndExposure(t *testing.T) {
	w := &types.Window{}
	require.NoError(t, json.Unmarshal([]byte(`{"authorization":{"scope":"resource","resource":{"type":"advertiser","id":{"source":"resource","selector":"Id"}},"requestedCapabilities":["read"]},"dataSource":{"owner":{"service":{"endpoint":"owner-data","uri":"/get"},"parameters":[{"name":"Id","from":"windowForm"}]}},"view":{"content":{"id":"root","containers":[{"id":"role","visibleWhen":{"source":"authorization","field":"principal.roles","contains":"editor"}},{"id":"feature","visibleWhen":{"source":"authorization","field":"principal.features","contains":"history"}},{"id":"plain"}]}}}`), w))
	original, _ := json.Marshal(w.DataSource)
	resolver := &projectionPrincipal{roles: []string{"editor"}}
	runtime := NewRuntime(resolver)
	first, err := runtime.Project(context.Background(), w)
	require.NoError(t, err)
	require.Len(t, first.Window.View.Content.Containers, 2)
	require.Equal(t, "role", first.Window.View.Content.Containers[0].ID)
	resolver.roles = nil
	resolver.features = []string{"history"}
	next, err := runtime.Project(context.Background(), w)
	require.NoError(t, err)
	require.Len(t, next.Window.View.Content.Containers, 2)
	require.Equal(t, "feature", next.Window.View.Content.Containers[0].ID)
	forwarded, _ := json.Marshal(next.Window.DataSource)
	require.JSONEq(t, string(original), string(forwarded), "UI projection preserves owner datasource arguments")
	require.Equal(t, 2, resolver.calls)
}
func TestWindowWithoutPresentationGuardsDoesNotResolvePrincipalOrEntity(t *testing.T) {
	window := &types.Window{Authorization: &types.AuthorizationSpec{Scope: "resource"}}
	resolver := &projectionPrincipal{}
	result, err := NewRuntime(resolver).Project(context.Background(), window)
	require.NoError(t, err)
	require.Same(t, window, result.Window)
	require.Zero(t, resolver.calls)
}

func TestWindowProjectionPreservesOwnerDecodedMetadataAndInput(t *testing.T) {
	window := &types.Window{Parameters: []map[string]any{{"value": json.Number("9007199254740993")}}}
	require.NoError(t, json.Unmarshal([]byte(`{"content":{"id":"root","containers":[{"id":"editor","visibleWhen":{"source":"authorization","field":"principal.roles","contains":"editor"}}]}}`), &window.View))
	before, err := json.Marshal(window)
	require.NoError(t, err)
	projected, err := NewRuntime(&projectionPrincipal{roles: []string{"editor"}}).Project(context.Background(), window)
	require.NoError(t, err)
	after, err := json.Marshal(window)
	require.NoError(t, err)
	require.Equal(t, before, after)
	require.Equal(t, json.Number("9007199254740993"), projected.Window.Parameters[0]["value"], "owner arguments never take a lossy presentation JSON roundtrip")
	projected.Window.View.Content.ID = "detached"
	require.Equal(t, "root", window.View.Content.ID, "rendered presentation is detached from input")
}

func TestWindowProjectionPreservesOriginalAdvertiserBrowserConditions(t *testing.T) {
	window := &types.Window{}
	require.NoError(t, json.Unmarshal([]byte(`{"view":{"content":{"id":"root","containers":[{"id":"upload","visibleWhen":{"all":[{"source":"authorization","field":"principal.roles","contains":"editor"},{"source":"windowForm","field":"selected","equals":true}]},"disabledWhen":{"source":"windowForm","field":"advertiserLocationListUploadSafe","notEquals":true}},{"id":"history","visibleWhen":{"any":[{"source":"authorization","field":"principal.features","contains":"history"},{"source":"windowForm","field":"hasSelection","equals":true}]}}]}}}`), window))
	resolver := &projectionPrincipal{roles: []string{"editor"}}
	result, err := NewRuntime(resolver).Project(context.Background(), window)
	require.NoError(t, err)
	raw, err := json.Marshal(result.Window)
	require.NoError(t, err)
	var tree map[string]any
	require.NoError(t, json.Unmarshal(raw, &tree))
	containers := tree["view"].(map[string]any)["content"].(map[string]any)["containers"].([]any)
	require.Len(t, containers, 2)
	require.Equal(t, map[string]any{"source": "windowForm", "field": "advertiserLocationListUploadSafe", "notEquals": true}, containers[0].(map[string]any)["disabledWhen"])
	require.Equal(t, map[string]any{"source": "windowForm", "field": "selected", "equals": true}, containers[0].(map[string]any)["visibleWhen"])
	require.Equal(t, map[string]any{"source": "windowForm", "field": "hasSelection", "equals": true}, containers[1].(map[string]any)["visibleWhen"])
	resolver.roles = nil
	result, err = NewRuntime(resolver).Project(context.Background(), window)
	require.NoError(t, err)
	require.Len(t, result.Window.View.Content.Containers, 1, "false role in mixed ALL cannot be skipped")
	malformed := &types.Window{}
	require.NoError(t, json.Unmarshal([]byte(`{"view":{"content":{"id":"root","visibleWhen":{"any":[{"source":"windowForm","field":"selected","equals":true},{"source":"authorization","field":"principal.roles","unsupported":true}]}}}}`), malformed))
	_, err = NewRuntime(resolver).Project(context.Background(), malformed)
	require.Error(t, err, "malformed authorization portion cannot hide behind browser condition")
}

type contextualPresentationExecutor struct {
	calls int
	args  map[string]interface{}
}

func (e *contextualPresentationExecutor) Execute(_ context.Context, _ string, args map[string]interface{}) (string, error) {
	e.calls++
	e.args = args
	return `{"authorizationVersion":"ui","expiresAt":"2999-01-01T00:00:00Z","principal":{"roles":["editor"]},"resources":{"42":{"id":42,"type":"advertiser","capabilities":{"read":false,"write":true}}}}`, nil
}
func TestContextualMCPPresentationPreservesAuthoredHintsWithoutReadAdmission(t *testing.T) {
	window := &types.Window{}
	require.NoError(t, json.Unmarshal([]byte(`{"authorization":{"scope":"resource","resource":{"type":"advertiser","id":{"source":"resource","selector":"AdvertiserId.0"}},"requestedCapabilities":["read","write"]},"dataSource":{"owner":{"service":{"endpoint":"owner","uri":"/data"}}},"view":{"content":{"id":"frame","containers":[{"id":"write","visibleWhen":{"source":"authorization","field":"resource.capabilities.write","equals":true}},{"id":"read","visibleWhen":{"source":"authorization","field":"resource.capabilities.read","equals":true}}]}}}`), window))
	executor := &contextualPresentationExecutor{}
	runtime := NewRuntime(&MCPResolver{Executor: executor, ToolName: "steward:ResourceAuthorization"})
	input := &BoundView{Window: window, ResourceData: map[string]any{"AdvertiserId": []any{42}}, WindowForm: map[string]any{"opaque": "unchanged"}}
	result, err := runtime.Project(context.Background(), window, input)
	require.NoError(t, err)
	require.Equal(t, "advertiser", executor.args["ResourceType"])
	require.Equal(t, []int{42}, executor.args["ResourceIDs"])
	require.Equal(t, []string{"read", "write"}, executor.args["RequestedCapabilities"])
	require.False(t, result.Denied)
	require.Equal(t, "frame", result.Window.View.Content.ID)
	require.Len(t, result.Window.View.Content.Containers, 1)
	require.Equal(t, "write", result.Window.View.Content.Containers[0].ID)
	require.Equal(t, window.DataSource, result.Window.DataSource, "read=false never removes owner datasource or gates its dispatch")
	browserOnly := &types.Window{}
	require.NoError(t, json.Unmarshal([]byte(`{"authorization":{"scope":"resource","resource":{"type":"advertiser","id":{"source":"resource","selector":"AdvertiserId.0"}}},"view":{"content":{"id":"root","disabledWhen":{"source":"windowForm","field":"advertiserLocationListUploadSafe","notEquals":true}}}}`), browserOnly))
	_, err = runtime.Project(context.Background(), browserOnly, &BoundView{Window: browserOnly})
	require.NoError(t, err)
	require.Equal(t, 1, executor.calls, "browser-only conditions require no UI-facts RPC or selector binding")
}
