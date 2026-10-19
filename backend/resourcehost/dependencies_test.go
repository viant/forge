package resource

import (
	"context"
	"encoding/json"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	manager "github.com/viant/forge/backend/clientpool"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	forgeMCP "github.com/viant/forge/backend/provider"
	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
	"github.com/viant/jsonrpc"
	"github.com/viant/mcp-protocol/schema"
	mcpclient "github.com/viant/mcp/client"
	cfg "github.com/viant/mcp/client/config"
)

type dependencyResource struct {
	raw              json.RawMessage
	formatVersion    int64
	revision         string
	authorityBinding string
	validUntil       time.Time
	denied           bool
	ownerOverride    string
}

type dependencyMCPProvider struct {
	fixtureNotificationPort
	mcpclient.Interface
	owner           string
	items           map[string]*dependencyResource
	listName        string
	datasourceReads atomic.Int64
}

func (p *dependencyMCPProvider) ListResources(context.Context, *string, ...mcpclient.RequestOption) (*schema.ListResourcesResult, error) {
	return nil, jsonrpc.NewMethodNotFound("resources unavailable", nil)
}

func (p *dependencyMCPProvider) ListTools(context.Context, *string, ...mcpclient.RequestOption) (*schema.ListToolsResult, error) {
	meta := map[string]any{primitive.AuthoringExtension: map[string]any{"version": 1, "providerIdentity": p.owner, "transport": "tools/call"}}
	kinds := map[string]bool{}
	for uri := range p.items {
		parsed, _ := identity.ParseResourceURI(uri)
		kinds[parsed.Kind] = true
	}
	tools := []schema.Tool{{Name: "namespaces/list", Meta: meta}, {Name: "namespaces/get", Meta: meta}}
	for kind := range kinds {
		plural := primitive.Plural(kind)
		tools = append(tools, schema.Tool{Name: plural + "/list", Meta: meta}, schema.Tool{Name: plural + "/get", Meta: meta})
	}
	return &schema.ListToolsResult{Tools: tools}, nil
}

func (p *dependencyMCPProvider) CallTool(_ context.Context, request *schema.CallToolRequestParams, _ ...mcpclient.RequestOption) (*schema.CallToolResult, error) {
	if request == nil {
		return dependencyToolError(identity.ErrResource), nil
	}
	if request.Name == "datasources/get" {
		p.datasourceReads.Add(1)
	}
	var value any
	switch request.Name {
	case "namespaces/list":
		namespaces := map[string]map[string]bool{}
		for uri := range p.items {
			parsed, _ := identity.ParseResourceURI(uri)
			if namespaces[parsed.Namespace] == nil {
				namespaces[parsed.Namespace] = map[string]bool{}
			}
			namespaces[parsed.Namespace][parsed.Kind] = true
		}
		out := []primitive.Namespace{}
		for namespace, kinds := range namespaces {
			values := []string{}
			for kind := range kinds {
				values = append(values, kind)
			}
			out = append(out, primitive.Namespace{Name: namespace, Kinds: values})
		}
		value = primitive.NamespaceListResult{ProviderIdentity: p.owner, Namespaces: out, Complete: true}
	case "namespaces/get":
		namespace, _ := request.Arguments["namespace"].(string)
		kinds := map[string]map[int64]bool{}
		for uri, item := range p.items {
			parsed, _ := identity.ParseResourceURI(uri)
			if parsed.Namespace == namespace {
				if kinds[parsed.Kind] == nil {
					kinds[parsed.Kind] = map[int64]bool{}
				}
				kinds[parsed.Kind][item.formatVersion] = true
			}
		}
		capabilities := []primitive.KindSupport{}
		for kind, versions := range kinds {
			formatVersions := []int64{}
			for version := range versions {
				formatVersions = append(formatVersions, version)
			}
			capabilities = append(capabilities, primitive.KindSupport{Kind: kind, FormatVersions: formatVersions, Operations: []string{"list", "get"}, Methods: primitive.Methods(kind, []string{"list", "get"})})
		}
		value = primitive.NamespaceCapabilities{ProviderIdentity: p.owner, Namespace: namespace, Kinds: capabilities}
	default:
		parts := strings.Split(request.Name, "/")
		if len(parts) != 2 {
			return dependencyToolError(identity.ErrResource), nil
		}
		kind := primitive.Kind(parts[0])
		if kind == "" {
			return dependencyToolError(identity.ErrResource), nil
		}
		if parts[1] == "list" {
			namespace, _ := request.Arguments["namespace"].(string)
			rows := []primitive.ResourceState{}
			for uri, item := range p.items {
				parsed, err := identity.ParseResourceURI(uri)
				if err != nil || parsed.Kind != kind || namespace != "" && parsed.Namespace != namespace {
					continue
				}
				rows = append(rows, dependencyState(p.owner, uri, item, false))
			}
			value = map[string]any{parts[0]: rows, "complete": true}
			break
		}
		if parts[1] != "get" {
			return dependencyToolError(identity.ErrResource), nil
		}
		uri, _ := request.Arguments["uri"].(string)
		item := p.items[uri]
		if item == nil || item.denied {
			return dependencyToolError(identity.ErrResourceDenied), nil
		}
		requested, _ := request.Arguments["revision"].(string)
		if requested != "" && requested != item.revision {
			return dependencyToolError(identity.ErrResourceDenied), nil
		}
		owner := p.owner
		if item.ownerOverride != "" {
			owner = item.ownerOverride
		}
		candidate := dependencyCandidate(item)
		pin := identity.ResolvedResource{ProviderIdentity: owner, URI: uri, ResourceCandidate: candidate, AuthorityBinding: item.authorityBinding, ValidUntil: item.validUntil}
		value = primitive.GetResult{Resource: func() *primitive.ResourceState {
			state := dependencyState(owner, uri, item, true)
			return &state
		}(), ResolvedResource: &pin}
	}
	return &schema.CallToolResult{StructuredContent: value}, nil
}

func dependencyToolError(err error) *schema.CallToolResult {
	failed := true
	return &schema.CallToolResult{IsError: &failed, StructuredContent: map[string]any{"message": "denied"}}
}

func dependencyCandidate(item *dependencyResource) identity.ResourceCandidate {
	candidate := identity.ResourceCandidate{ContentFingerprint: identity.ContentFingerprint(item.raw)}
	if item.revision == identity.WorkingCandidate {
		candidate.Kind = identity.WorkingCandidate
	} else {
		candidate.Kind = identity.StampedCandidate
		candidate.Revision = item.revision
	}
	return candidate
}

func dependencyState(owner, uri string, item *dependencyResource, includeDefinition bool) primitive.ResourceState {
	parsed, _ := identity.ParseResourceURI(uri)
	state := primitive.ResourceState{Kind: parsed.Kind, Namespace: parsed.Namespace, Name: parsed.Name, URI: uri, Title: parsed.Name, Lifecycle: "working", Revision: item.revision, FormatVersion: item.formatVersion, ContentFingerprint: identity.ContentFingerprint(item.raw)}
	if includeDefinition {
		state.Definition = append(json.RawMessage(nil), item.raw...)
		state.DefinitionBytes = append([]byte(nil), item.raw...)
	}
	return state
}

type dependencyStack struct {
	parentURI      string
	childURI       string
	parent         *dependencyResource
	child          *dependencyResource
	provider       *dependencyMCPProvider
	parentProvider *dependencyMCPProvider
	manager        *manager.Manager
	gateway        *Gateway
	catalog        *WindowCatalog
	actor          identity.VerifiedActor
	opened         *forgeMCP.WindowDefinitionGetOutput
}

func newDependencyStack(t *testing.T, childLease time.Time, parentCacheScopes ...map[string]string) *dependencyStack {
	t.Helper()
	ctx := context.Background()
	now := time.Now().UTC()
	actor := identity.VerifiedActor{Subject: "orders-user", Issuer: "https://fixture.identity", TenantID: "team", AccountID: "opaque-account", IdentityRevision: "orders-identity-1", ValidUntil: now.Add(10 * time.Minute)}
	childURI := "datasource://team/orders"
	childInner := dsproto.DataSource{ID: "source-authored-id", DataSource: types.DataSource{Selectors: &types.Selectors{Data: "data"}}, Backend: &dsproto.Backend{Kind: dsproto.BackendInline, Rows: []map[string]interface{}{{"orderId": 1}}}}
	childDescriptor, err := json.Marshal(childInner)
	require.NoError(t, err)
	childRaw, err := json.Marshal(struct {
		SchemaVersion int             `json:"schemaVersion"`
		DataSource    json.RawMessage `json:"dataSource"`
	}{SchemaVersion: 1, DataSource: childDescriptor})
	require.NoError(t, err)
	child := &dependencyResource{raw: childRaw, formatVersion: 1, revision: identity.WorkingCandidate, authorityBinding: "child-authority-r1", validUntil: childLease.UTC()}

	parentURI := "window://team/orders"
	parentDescriptor := childInner
	parentDescriptor.ID = "orders"
	parentDescriptorRaw, err := json.Marshal(parentDescriptor)
	require.NoError(t, err)
	descriptorFingerprint, err := types.WindowDescriptorFingerprint(parentDescriptorRaw)
	require.NoError(t, err)
	dataSourceReference := primitive.DataSourceReference{Resource: identity.ResourceRef{URI: childURI, Revision: identity.WorkingCandidate}, ContentFingerprint: identity.ContentFingerprint(childRaw), ProviderIdentity: "child-provider"}
	window := &types.Window{View: types.View{Content: &types.Container{ID: "orders-root"}}, DataSource: map[string]types.DataSource{"orders": parentDescriptor.DataSource}, ResourceDependencies: map[string]string{"orders": descriptorFingerprint}}
	variant := types.WindowResourceVariant{Window: window, DataSources: map[string]json.RawMessage{"orders": parentDescriptorRaw}, DataSourceResources: map[string]primitive.DataSourceReference{"orders": dataSourceReference}}
	variantFingerprint, err := types.WindowVariantFingerprint(variant)
	require.NoError(t, err)
	envelope := types.WindowResourceEnvelope{SchemaVersion: 3, Format: types.WindowReferencesFormat, Targets: []types.WindowTargetBinding{{Target: types.WindowTarget{}, Variant: variantFingerprint}}, Variants: map[string]types.WindowResourceVariant{variantFingerprint: variant}}
	require.NoError(t, envelope.Validate())
	parentRaw, err := json.Marshal(envelope)
	require.NoError(t, err)
	parent := &dependencyResource{raw: parentRaw, formatVersion: 3, revision: identity.WorkingCandidate, authorityBinding: "parent-authority-r1", validUntil: now.Add(5 * time.Minute)}

	provider := &dependencyMCPProvider{owner: "parent-provider", items: map[string]*dependencyResource{parentURI: parent}}
	childProvider := &dependencyMCPProvider{owner: "child-provider", items: map[string]*dependencyResource{childURI: child}}
	providers := map[string]mcpclient.Interface{"parent": provider, "child": childProvider}
	options := fixtureOptions{"parent": &cfg.MCPClient{}, "child": &cfg.MCPClient{}}
	if len(parentCacheScopes) > 0 {
		options["parent"].ResourceCacheScopes = parentCacheScopes[0]
	}
	mgr, err := manager.New(options, manager.WithClientFactory(func(_ context.Context, _, name string) (mcpclient.Interface, error) { return providers[name], nil }))
	require.NoError(t, err)
	t.Cleanup(func() { mgr.CloseConversation("") })
	actorResolver := func(context.Context) (identity.VerifiedActor, error) { return actor, nil }
	actorVerifier := func(_ context.Context, expected identity.VerifiedActor) error {
		if !sameLocalActor(expected, actor) || !expected.Valid(time.Now()) {
			return identity.ErrResourceDenied
		}
		return nil
	}
	gateway := NewGateway(mgr, actorResolver, actorVerifier, "host-provider")
	proof, err := types.NewWindowTargetHMAC([]byte(strings.Repeat("dependency-fixture-hmac-key-", 2)))
	require.NoError(t, err)
	catalog := &WindowCatalog{Gateway: gateway, TargetProof: proof}

	opened, err := catalog.Get(ctx, &forgeMCP.WindowDefinitionGetInput{WindowID: parentURI})
	require.NoError(t, err)
	require.Equal(t, "parent-provider", opened.Definition.Resource.ProviderIdentity)
	require.Equal(t, "orders-root", opened.Definition.View.Content.ID)
	return &dependencyStack{parentURI: parentURI, childURI: childURI, parent: parent, child: child, provider: childProvider, parentProvider: provider, manager: mgr, gateway: gateway, catalog: catalog, actor: actor, opened: opened}
}

func dependencyOpenInput(stack *dependencyStack) *forgeMCP.WindowDefinitionGetInput {
	return &forgeMCP.WindowDefinitionGetInput{WindowID: stack.parentURI, ResolvedResource: stack.opened.Definition.Resource, Target: stack.opened.Definition.ResourceTarget}
}

func TestWindowReferencesOpenCapturesChildPinsCapsLeaseAndSignsPins(t *testing.T) {
	childLease := time.Now().UTC().Add(35 * time.Second)
	stack := newDependencyStack(t, childLease)
	opened := stack.opened
	require.NotNil(t, opened.Definition.Resource)
	require.NotNil(t, opened.Definition.ResourceTarget)
	require.Equal(t, "parent-provider", opened.Definition.Resource.ProviderIdentity)
	require.LessOrEqual(t, opened.Definition.Resource.ValidUntil, childLease)
	require.Greater(t, opened.Definition.Resource.ValidUntil, time.Now())
	require.NotEmpty(t, opened.Definition.ResourceTarget.SelectionToken)
	require.Len(t, opened.Definition.ResourceTarget.DependencyPins, 1)
	childPin, ok := opened.Definition.ResourceTarget.DependencyPins["orders"]
	require.True(t, ok)
	require.Equal(t, "child-provider", childPin.ProviderIdentity)
	require.Equal(t, stack.childURI, childPin.URI)
	require.Equal(t, identity.WorkingCandidate, childPin.Selector())
	require.Equal(t, identity.ContentFingerprint(stack.child.raw), childPin.ContentFingerprint)
	require.Equal(t, stack.child.authorityBinding, childPin.AuthorityBinding)
	require.Equal(t, childLease, childPin.ValidUntil)

	// The child attachment uses a different authored ID. Successful opening
	// proves the server rewrote only that ID before matching the full descriptor.
	var envelope types.WindowResourceEnvelope
	require.NoError(t, json.Unmarshal(stack.parent.raw, &envelope))
	variant := envelope.Variants[envelope.Targets[0].Variant]
	var parentDescriptor struct {
		ID string `json:"id"`
	}
	require.NoError(t, json.Unmarshal(variant.DataSources["orders"], &parentDescriptor))
	var childBody struct {
		DataSource json.RawMessage `json:"dataSource"`
	}
	require.NoError(t, json.Unmarshal(stack.child.raw, &childBody))
	var childDefinition struct {
		ID string `json:"id"`
	}
	require.NoError(t, json.Unmarshal(childBody.DataSource, &childDefinition))
	require.Equal(t, "orders", parentDescriptor.ID)
	require.Equal(t, "source-authored-id", childDefinition.ID)

	// A signed selection token binds the original child authority snapshot.
	tampered := *opened.Definition.ResourceTarget
	tampered.DependencyPins = map[string]identity.ResolvedResource{}
	for id, pin := range opened.Definition.ResourceTarget.DependencyPins {
		tampered.DependencyPins[id] = pin
	}
	pin := tampered.DependencyPins["orders"]
	pin.AuthorityBinding = "forged-authority"
	tampered.DependencyPins["orders"] = pin
	result, err := stack.catalog.Get(context.Background(), &forgeMCP.WindowDefinitionGetInput{WindowID: stack.parentURI, ResolvedResource: opened.Definition.Resource, Target: &tampered})
	require.Nil(t, result)
	require.ErrorIs(t, err, identity.ErrResourceDenied)
}

func TestWindowReferencesRequireOriginalChildAuthorityAfterResourceChange(t *testing.T) {
	mutations := []struct {
		name   string
		mutate func(*dependencyResource)
	}{
		{"role revocation", func(item *dependencyResource) { item.denied = true }},
		{"content drift", func(item *dependencyResource) {
			item.raw = json.RawMessage(`{"schemaVersion":1,"dataSource":{"id":"different","dataSource":{"selectors":{"data":"data"}},"backend":{"kind":"inline","rows":[]}}}`)
		}},
		{"provider identity drift", func(item *dependencyResource) { item.ownerOverride = "other-provider" }},
		{"candidate revision drift", func(item *dependencyResource) { item.revision = "2" }},
		{"expired child lease", func(item *dependencyResource) { item.validUntil = time.Now().UTC().Add(-time.Second) }},
	}
	for _, tc := range mutations {
		t.Run(tc.name, func(t *testing.T) {
			stack := newDependencyStack(t, time.Now().UTC().Add(time.Minute))
			tc.mutate(stack.child)
			stack.provider.resourceChanged()
			result, err := stack.catalog.Get(context.Background(), dependencyOpenInput(stack))
			require.Nil(t, result)
			require.Error(t, err)
		})
	}
}

func TestWindowReferencesRejectsMissingOrChangedDependencyPins(t *testing.T) {
	stack := newDependencyStack(t, time.Now().UTC().Add(time.Minute))
	missing := *stack.opened.Definition.ResourceTarget
	missing.DependencyPins = nil
	result, err := stack.catalog.Get(context.Background(), &forgeMCP.WindowDefinitionGetInput{WindowID: stack.parentURI, ResolvedResource: stack.opened.Definition.Resource, Target: &missing})
	require.Nil(t, result)
	require.Error(t, err)

	var envelope types.WindowResourceEnvelope
	require.NoError(t, json.Unmarshal(stack.parent.raw, &envelope))
	variantID := envelope.Targets[0].Variant
	variant := envelope.Variants[variantID]
	ref := variant.DataSourceResources["orders"]
	ref.Resource.Revision = "2"
	variant.DataSourceResources["orders"] = ref
	variant.Fingerprint = ""
	newFingerprint, err := types.WindowVariantFingerprint(variant)
	require.NoError(t, err)
	delete(envelope.Variants, variantID)
	envelope.Variants[newFingerprint] = variant
	envelope.Targets[0].Variant = newFingerprint
	stack.parent.raw, err = json.Marshal(envelope)
	require.NoError(t, err)
	stack.parentChanged()
	stack.provider.items[stack.childURI].revision = identity.WorkingCandidate
	result, err = stack.catalog.Get(context.Background(), &forgeMCP.WindowDefinitionGetInput{WindowID: stack.parentURI})
	require.Nil(t, result)
	require.Error(t, err)
}

func (s *dependencyStack) parentChanged() { s.parentProvider.resourceChanged() }
