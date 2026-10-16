package resource

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/viant/forge/backend/clientpool"
	primitiveprovider "github.com/viant/forge/backend/provider"
	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
	"github.com/viant/mcp"
	"github.com/viant/mcp-protocol/schema"
	mcpclient "github.com/viant/mcp/client"
	cfg "github.com/viant/mcp/client/config"
)

func TestPublicWindowDatasourceReferencesAllowZeroMetadataAndRetainPins(t *testing.T) {
	stack := newDependencyStack(t, time.Now().Add(time.Hour))
	stack.parent.validUntil = time.Time{}
	stack.child.validUntil = time.Time{}
	actor, verify := PublicReadActors()
	g := NewGateway(stack.manager, actor, verify, "public-source")
	defer g.Close()
	catalog := &WindowCatalog{Gateway: g, TargetProof: stack.catalog.TargetProof}
	opened, err := catalog.Get(context.Background(), &primitiveprovider.WindowDefinitionGetInput{WindowID: stack.parentURI})
	require.NoError(t, err)
	require.True(t, opened.Definition.Resource.ValidUntil.IsZero())
	require.True(t, opened.Definition.ResourceTarget.DependencyPins["orders"].ValidUntil.IsZero())
	descriptor, err := catalog.ResolveDatasource(context.Background(), *opened.Definition.Resource, opened.Definition.ResourceTarget, "orders")
	require.NoError(t, err)
	require.Equal(t, "orders", descriptor.ID)
	stack.child.denied = true
	stack.provider.resourceChanged()
	_, err = catalog.ResolveDatasource(context.Background(), *opened.Definition.Resource, opened.Definition.ResourceTarget, "orders")
	require.Error(t, err, "zero metadata retains managing source denial")
}

// The owning source signs a finite execution proof independently of its
// notification-bound definition metadata. No client deadline is synthesized.
type zeroMetadataExecutionClient struct {
	*standaloneExecutingFixture
	proofUntil time.Time
}

func (c *zeroMetadataExecutionClient) CallTool(ctx context.Context, in *schema.CallToolRequestParams, opts ...mcpclient.RequestOption) (*schema.CallToolResult, error) {
	var out *schema.CallToolResult
	var err error
	if in.Name == "datasources/get" {
		out, err = c.dependencyMCPProvider.CallTool(ctx, in, opts...)
	} else {
		out, err = c.standaloneExecutingFixture.CallTool(ctx, in, opts...)
	}
	if err != nil || in.Name != "datasources/get" || out.IsError != nil && *out.IsError {
		return out, err
	}
	got := out.StructuredContent.(primitive.GetResult)
	proof := primitive.ExecutionProof{Resource: *got.ResolvedResource, Binding: "fixture-datasource:" + got.ResolvedResource.ContentFingerprint}
	proof.Resource.ValidUntil = c.proofUntil
	proof.Token, err = c.signer.Sign(ctx, proof.Resource, types.WindowTarget{}, proof.Binding)
	if err != nil {
		return nil, err
	}
	got.ExecutionProof = &proof
	out.StructuredContent = got
	return out, nil
}

type zeroMetadataWindowClient struct {
	*dependencyMCPProvider
	signer     *types.WindowTargetHMAC
	proofUntil time.Time
}

func (c *zeroMetadataWindowClient) CallTool(ctx context.Context, in *schema.CallToolRequestParams, opts ...mcpclient.RequestOption) (*schema.CallToolResult, error) {
	out, err := c.dependencyMCPProvider.CallTool(ctx, in, opts...)
	if err != nil || in.Name != "windows/get" {
		return out, err
	}
	got := out.StructuredContent.(primitive.GetResult)
	proof := primitive.ExecutionProof{Resource: *got.ResolvedResource, Binding: "parent-mapping:" + got.ResolvedResource.ContentFingerprint}
	proof.Resource.ValidUntil = c.proofUntil
	proof.Token, err = c.signer.Sign(ctx, proof.Resource, types.WindowTarget{}, proof.Binding)
	if err != nil {
		return nil, err
	}
	got.ExecutionProof = &proof
	out.StructuredContent = got
	return out, nil
}
func TestReferencedDatasourceZeroMetadataPreservesRealExecutionDeadline(t *testing.T) {
	ctx := context.Background()
	g, source, pin, _, descriptor := standaloneStack(t)
	source.items[pin.URI].validUntil = time.Time{}
	client := &zeroMetadataExecutionClient{standaloneExecutingFixture: source, proofUntil: time.Now().Add(time.Minute)}
	mgr, err := manager.New(nil)
	require.NoError(t, err)
	defer mgr.CloseConversation("")
	require.NoError(t, mgr.RegisterLocal(ctx, "provider", &cfg.MCPClient{ClientOptions: &mcp.ClientOptions{}, PrimitiveProviderIdentity: "provider"}, func(context.Context) (mcpclient.Interface, error) { return client, nil }))
	freshGateway := NewGateway(mgr, g.Actor, g.Verify, "execution-test")
	defer freshGateway.Close()
	connection, err := freshGateway.ConnectionForProvider(ctx, "provider")
	require.NoError(t, err)
	got, err := Get[json.RawMessage](ctx, freshGateway, connection, identity.ResourceRef{URI: pin.URI}, nil)
	require.NoError(t, err)
	metadata := *got.ResolvedResource
	metadata.ValidUntil = time.Time{}
	require.False(t, got.ResolvedResource.ValidUntil.IsZero(), "authenticated actor deadline still caps the returned view")
	require.False(t, got.ExecutionProof.Resource.ValidUntil.IsZero())
	body, err := freshGateway.FetchDatasource(ctx, metadata, got.ExecutionProof, descriptor, nil)
	require.NoError(t, err)
	require.JSONEq(t, `{"data":[{"id":7}]}`, string(body))
	require.Equal(t, 1, source.fetched)

	alias := *descriptor
	alias.ID = "orders"
	descriptorRaw, err := json.Marshal(alias)
	require.NoError(t, err)
	descriptorFP, err := types.WindowDescriptorFingerprint(descriptorRaw)
	require.NoError(t, err)
	variant := types.WindowResourceVariant{Window: &types.Window{View: types.View{Content: &types.Container{ID: "references"}}, DataSource: map[string]types.DataSource{"orders": alias.DataSource}, ResourceDependencies: map[string]string{"orders": descriptorFP}}, DataSources: map[string]json.RawMessage{"orders": descriptorRaw}, DataSourceResources: map[string]primitive.DataSourceReference{"orders": {Resource: identity.ResourceRef{URI: pin.URI, Revision: identity.WorkingCandidate}, ProviderIdentity: "provider", ContentFingerprint: got.ResolvedResource.ContentFingerprint}}}
	variantFP, err := types.WindowVariantFingerprint(variant)
	require.NoError(t, err)
	envelope := types.WindowResourceEnvelope{SchemaVersion: 3, Format: types.WindowReferencesFormat, Targets: []types.WindowTargetBinding{{Variant: variantFP}}, Variants: map[string]types.WindowResourceVariant{variantFP: variant}}
	parentRaw, err := json.Marshal(envelope)
	require.NoError(t, err)
	parentURI := "window://team/reference"
	parent := &dependencyMCPProvider{owner: "parent", items: map[string]*dependencyResource{parentURI: {raw: parentRaw, formatVersion: 3, revision: identity.WorkingCandidate, authorityBinding: "parent-source"}}}
	require.NoError(t, mgr.RegisterLocal(ctx, "parent", &cfg.MCPClient{ClientOptions: &mcp.ClientOptions{}, PrimitiveProviderIdentity: "parent"}, func(context.Context) (mcpclient.Interface, error) {
		return &zeroMetadataWindowClient{dependencyMCPProvider: parent, signer: source.signer, proofUntil: client.proofUntil}, nil
	}))
	catalog := &WindowCatalog{Gateway: freshGateway, TargetProof: source.signer}
	opened, err := catalog.Get(ctx, &primitiveprovider.WindowDefinitionGetInput{WindowID: parentURI})
	require.NoError(t, err)
	require.False(t, opened.Definition.Resource.ValidUntil.IsZero(), "authenticated actor retains its real bound")
	parentMetadata := *opened.Definition.Resource
	parentMetadata.ValidUntil = time.Time{}
	target := *opened.Definition.ResourceTarget
	childMetadata := target.DependencyPins["orders"]
	childMetadata.ValidUntil = time.Time{}
	target.DependencyPins = map[string]identity.ResolvedResource{"orders": childMetadata}
	target.SelectionToken = ""
	target.SelectionToken, err = source.signer.Sign(ctx, parentMetadata, target, variantFP)
	require.NoError(t, err)
	body, err = catalog.FetchProviderDatasource(ctx, parentMetadata, &target, &alias, map[string]any{"selected": "original"})
	require.NoError(t, err)
	require.JSONEq(t, `{"data":[{"id":7}]}`, string(body))
	require.Equal(t, 2, source.fetched)
	expired := *got.ExecutionProof
	expired.Resource.ValidUntil = time.Now().Add(-time.Second)
	_, err = freshGateway.FetchDatasource(ctx, metadata, &expired, descriptor, nil)
	require.Error(t, err)
	expired.Resource.ValidUntil = time.Time{}
	_, err = freshGateway.FetchDatasource(ctx, metadata, &expired, descriptor, nil)
	require.Error(t, err)
	require.Equal(t, 2, source.fetched, "missing/expired execution TTL cannot dispatch despite zero definition metadata")
}
