package provider

import (
	"context"
	"encoding/json"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/require"
	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/mcp-protocol/schema"
)

type catalogWriter struct {
	catalog        *mutableCatalog
	writes         atomic.Int64
	descriptors    atomic.Int64
	seenContext    context.Context
	seenDefinition json.RawMessage
}

func (w *catalogWriter) owner(ctx context.Context, value string) (identity.ResourceURI, error) {
	uri, err := identity.ParseResourceURI(value)
	actor, ok := ctx.Value(catalogActorKey{}).(identity.VerifiedActor)
	if err != nil || !ok || uri.Namespace != "users" || !strings.HasPrefix(uri.Name, actor.Subject+"/") {
		return uri, identity.ErrResourceDenied
	}
	return uri, nil
}
func (w *catalogWriter) CreateResource(ctx context.Context, in primitive.CreateResourceInput) (*primitive.ResourceResult, error) {
	uri, err := w.owner(ctx, in.URI)
	if err != nil {
		return nil, err
	}
	w.catalog.mu.Lock()
	defer w.catalog.mu.Unlock()
	if _, exists := w.catalog.records[uri.String()]; exists {
		return nil, identity.ErrResource
	}
	actor := ctx.Value(catalogActorKey{}).(identity.VerifiedActor)
	w.catalog.records[uri.String()] = catalogRecord{owner: actor.Subject, raw: append(json.RawMessage(nil), in.Definition...)}
	w.seenContext, w.seenDefinition = ctx, append(json.RawMessage(nil), in.Definition...)
	w.writes.Add(1)
	return &primitive.ResourceResult{URI: uri.String(), ContentFingerprint: identity.ContentFingerprint(in.Definition)}, nil
}
func (w *catalogWriter) UpdateDraft(ctx context.Context, value string, in primitive.UpdateDraftInput) (*primitive.ResourceResult, error) {
	uri, err := w.owner(ctx, value)
	if err != nil {
		return nil, err
	}
	w.catalog.mu.Lock()
	defer w.catalog.mu.Unlock()
	record, exists := w.catalog.records[uri.String()]
	if !exists {
		return nil, ErrCatalogNotFound
	}
	record.raw = append(json.RawMessage(nil), in.Definition...)
	w.catalog.records[uri.String()] = record
	w.seenContext, w.seenDefinition = ctx, append(json.RawMessage(nil), in.Definition...)
	w.writes.Add(1)
	return &primitive.ResourceResult{URI: uri.String(), ContentFingerprint: identity.ContentFingerprint(in.Definition)}, nil
}
func (w *catalogWriter) ArchiveResource(ctx context.Context, value string, _ primitive.ArchiveResourceInput) (*primitive.ResourceResult, error) {
	uri, err := w.owner(ctx, value)
	if err != nil {
		return nil, err
	}
	w.catalog.mu.Lock()
	defer w.catalog.mu.Unlock()
	if _, exists := w.catalog.records[uri.String()]; !exists {
		return nil, ErrCatalogNotFound
	}
	delete(w.catalog.records, uri.String())
	w.writes.Add(1)
	return &primitive.ResourceResult{URI: uri.String()}, nil
}
func (w *catalogWriter) GetResource(ctx context.Context, value string) (*primitive.ResourceDescriptor, error) {
	uri, err := w.owner(ctx, value)
	if err != nil {
		return nil, err
	}
	w.catalog.mu.RLock()
	defer w.catalog.mu.RUnlock()
	record, exists := w.catalog.records[uri.String()]
	if !exists {
		return nil, ErrCatalogNotFound
	}
	w.descriptors.Add(1)
	return &primitive.ResourceDescriptor{ResourceResult: primitive.ResourceResult{URI: uri.String(), ContentFingerprint: identity.ContentFingerprint(record.raw)}, ResourceKind: uri.Kind, Namespace: uri.Namespace, Name: uri.Name, OwnerID: record.owner, Title: "Writer title", Lifecycle: identity.WorkingCandidate}, nil
}
func (w *catalogWriter) StampResource(context.Context, string, primitive.StampResourceInput) (*primitive.ResourceResult, error) {
	w.writes.Add(1)
	return nil, identity.ErrResource
}
func (w *catalogWriter) CloneResource(context.Context, primitive.CloneResourceInput) (*primitive.ResourceResult, error) {
	w.writes.Add(1)
	return nil, identity.ErrResource
}
func authoringFixture(t *testing.T) (*LocalProvider, *catalogWriter, context.Context) {
	p, c, alice, _ := catalogFixture(t)
	c.declarations[0].Kinds[0].Operations = []string{"list", "get", "create", "update", "archive"}
	config := p.ConfigurationSnapshot()
	writer := &catalogWriter{catalog: c}
	config.Authoring = writer
	var err error
	p, err = NewLocalProvider(config)
	require.NoError(t, err)
	return p, writer, alice
}
func TestAuthoringUsesSameInMemoryMCPLifecycle(t *testing.T) {
	p, w, ctx := authoringFixture(t)
	client, err := NewLocalMCPClient(p)
	require.NoError(t, err)
	tools, err := client.ListTools(ctx, nil)
	require.NoError(t, err)
	names := map[string]bool{}
	for _, tool := range tools.Tools {
		names[tool.Name] = true
	}
	for _, name := range []string{"reports/list", "reports/get", "reports/create", "reports/update", "reports/archive"} {
		require.True(t, names[name], name)
	}
	require.False(t, names["reports/stamp"])
	require.False(t, names["reports/clone"])
	call := func(name string, args map[string]interface{}) *schema.CallToolResult {
		t.Helper()
		result, err := client.CallTool(ctx, &schema.CallToolRequestParams{Name: name, Arguments: args})
		require.NoError(t, err)
		require.False(t, *result.IsError, name)
		return result
	}
	uri := "report://users/alice/new"
	call("reports/create", map[string]interface{}{"uri": uri, "formatVersion": 1, "definition": map[string]interface{}{"title": "created"}})
	list := call("reports/list", map[string]interface{}{"namespace": "users"})
	raw, err := json.Marshal(list.StructuredContent)
	require.NoError(t, err)
	var rows struct {
		Reports []primitive.ResourceState `json:"reports"`
	}
	require.NoError(t, json.Unmarshal(raw, &rows))
	require.Len(t, rows.Reports, 1)
	get := call("reports/get", map[string]interface{}{"uri": uri})
	raw, err = json.Marshal(get.StructuredContent)
	require.NoError(t, err)
	var result primitive.GetResult
	require.NoError(t, json.Unmarshal(raw, &result))
	require.Equal(t, "Writer title", result.Resource.Title)
	require.Equal(t, "alice", result.Resource.OwnerID)
	require.Equal(t, "managing", result.ResolvedResource.ProviderIdentity)
	call("reports/update", map[string]interface{}{"uri": uri, "formatVersion": 1, "definition": map[string]interface{}{"title": "updated"}})
	get = call("reports/get", map[string]interface{}{"uri": uri})
	raw, err = json.Marshal(get.StructuredContent)
	require.NoError(t, err)
	require.NoError(t, json.Unmarshal(raw, &result))
	require.JSONEq(t, `{"title":"updated"}`, string(result.Resource.DefinitionBytes))
	call("reports/archive", map[string]interface{}{"uri": uri})
	list = call("reports/list", map[string]interface{}{"namespace": "users"})
	raw, err = json.Marshal(list.StructuredContent)
	require.NoError(t, err)
	require.NoError(t, json.Unmarshal(raw, &rows))
	require.Empty(t, rows.Reports)
	require.Equal(t, int64(3), w.writes.Load())
	require.Equal(t, int64(1), w.catalog.namespaceCalls.Load()-1, "writer configuration captured once, operations never reconstruct provider")
}
func TestAuthoringStrictDecodeAndDeclaredOperationBeforeMutation(t *testing.T) {
	p, w, ctx := authoringFixture(t)
	for _, test := range []struct{ method, raw string }{
		{"reports/create", `{"uri":"report://users/alice/new","formatVersion":1,"definition":{},"owner":"bob"}`},
		{"reports/create", `{"uri":"report://other/alice/new","formatVersion":1,"definition":{}}`},
		{"reports/create", `{"uri":"report://users/alice/new","formatVersion":9,"definition":{}}`},
		{"reports/create", `{"uri":"report://users/alice/new","formatVersion":1}`},
		{"reports/create", `{"uri":"skill://users/alice/new","formatVersion":1,"definition":{}}`},
		{"reports/update", `{"uri":"report://users/alice/new","formatVersion":1,"definition":{}} {}`},
		{"reports/stamp", `{"uri":"report://users/alice/new"}`},
		{"reports/clone", `{"source":{"uri":"report://users/alice/new"},"targetUri":"report://users/alice/copy"}`},
		{"skills/create", `{"uri":"skill://users/alice/new","formatVersion":1,"definition":{}}`},
	} {
		_, err := p.Call(ctx, test.method, json.RawMessage(test.raw))
		require.Error(t, err, test.method+test.raw)
	}
	_, err := p.Call(ctx, "reports/create", json.RawMessage(`{"uri":"report://users/bob/new","formatVersion":1,"definition":{}}`))
	require.ErrorIs(t, err, identity.ErrResourceDenied)
	require.Zero(t, w.writes.Load())
	require.Empty(t, w.catalog.records)
}
func TestAuthoringPreservesDTOBytesAndReadOnlyKinds(t *testing.T) {
	p, w, ctx := authoringFixture(t)
	raw := json.RawMessage(`{"uri":"report://users/alice/exact","formatVersion":1,"definition":{ "opaque": 9007199254740993 }}`)
	_, err := p.Call(ctx, "reports/create", raw)
	require.NoError(t, err)
	require.Same(t, ctx, w.seenContext)
	require.Equal(t, `{ "opaque": 9007199254740993 }`, string(w.seenDefinition))
	contract, err := p.NamespaceGet(ctx, primitive.NamespaceGetRequest{Namespace: "users"})
	require.NoError(t, err)
	require.Equal(t, []string{"list", "get", "archive", "create", "update"}, contract.Kinds[0].Operations)
	require.Equal(t, "reports/update", contract.Kinds[0].Methods["update"])
	config := p.ConfigurationSnapshot()
	config.Authoring = nil
	_, err = NewLocalProvider(config)
	require.Error(t, err, "write declarations require configured writer")
	p, _, ctx, _ = catalogFixture(t)
	require.NotContains(t, p.InstalledTools(), "reports/create")
	_, err = p.Call(ctx, "reports/create", raw)
	require.Error(t, err)
}

func TestAuthoringDoesNotEnableReadOnlyYAMLNamespaces(t *testing.T) {
	p, w, ctx := authoringFixture(t)
	config := p.ConfigurationSnapshot()
	staticURI, _ := identity.ParseResourceURI("template://workspace/example")
	config.Validators["template"] = func(_ int64, raw json.RawMessage) error {
		if !json.Valid(raw) {
			return identity.ErrResource
		}
		return nil
	}
	config.Bindings = []LocalResourceBinding{{URI: staticURI.String(), FormatVersion: 1, Resolver: func(_ context.Context, actor identity.VerifiedActor, _ string) (*identity.ResourceResolver, error) {
		return &identity.ResourceResolver{ProviderIdentity: "managing", Source: &identity.LocalResource{URI: staticURI, Load: func(context.Context) (json.RawMessage, error) { return json.RawMessage(`{"name":"readonly"}`), nil }}, Policy: catalogRevision{actor: actor}}, nil
	}}}
	var err error
	p, err = NewLocalProvider(config)
	require.NoError(t, err)
	require.Contains(t, p.InstalledTools(), "templates/get")
	require.NotContains(t, p.InstalledTools(), "templates/create")
	contract, err := p.NamespaceGet(ctx, primitive.NamespaceGetRequest{Namespace: "workspace"})
	require.NoError(t, err)
	require.Equal(t, []string{"list", "get"}, contract.Kinds[0].Operations)
	get, err := p.Get(ctx, "template", primitive.GetRequest{URI: staticURI.String()})
	require.NoError(t, err)
	require.NotNil(t, get)
	require.Zero(t, w.descriptors.Load(), "read-only source must not call unrelated mutable writer")
	_, err = p.Call(ctx, "templates/create", json.RawMessage(`{"uri":"template://workspace/new","formatVersion":1,"definition":{}}`))
	require.Error(t, err)
	require.Zero(t, w.writes.Load())
}
