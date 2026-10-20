package resource

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	manager "github.com/viant/forge/backend/clientpool"
	"github.com/viant/forge/backend/requestctx"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
	"github.com/viant/mcp"
	"github.com/viant/mcp-protocol/schema"
	mcpclient "github.com/viant/mcp/client"
	cfg "github.com/viant/mcp/client/config"
)

type targetResourceClient struct {
	*filteredIndexClient
	advertise   bool
	readTargets []string
}

func (c *targetResourceClient) Initialize(ctx context.Context, opts ...mcpclient.RequestOption) (*schema.InitializeResult, error) {
	r, err := c.filteredIndexClient.Initialize(ctx, opts...)
	if c.advertise {
		r.Capabilities.Extensions[windowTargetExtension] = map[string]interface{}{"schemaVersion": 1}
	}
	return r, err
}
func (c *targetResourceClient) ReadResource(_ context.Context, p *schema.ReadResourceRequestParams, _ ...mcpclient.RequestOption) (*schema.ReadResourceResult, error) {
	name := "legacy"
	metadata, _ := p.Meta.AdditionalProperties.(map[string]any)
	if c.advertise {
		raw, err := json.Marshal(metadata[windowTargetExtension])
		require.NoError(c.t, err)
		var target map[string]any
		require.NoError(c.t, json.Unmarshal(raw, &target))
		require.NotContains(c.t, target, "selectionToken")
		require.NotContains(c.t, target, "executionProof")
		require.NotContains(c.t, target, "dependencyPins")
		require.Equal(c.t, []any{"a", "z"}, target["capabilities"])
		name = target["formFactor"].(string)
	} else {
		require.NotContains(c.t, metadata, windowTargetExtension)
	}
	c.readTargets = append(c.readTargets, name)
	raw, _ := json.Marshal(map[string]any{"title": name, "view": map[string]any{"content": map[string]any{"id": "orders", "text": name}}})
	return &schema.ReadResourceResult{Contents: []schema.ReadResourceResultContentsElem{{Uri: p.Uri, Text: string(raw)}}}, nil
}

func TestStandardWindowTargetMetadataAndCachePartition(t *testing.T) {
	for _, advertise := range []bool{false, true} {
		t.Run(map[bool]string{false: "ordinary server", true: "target aware server"}[advertise], func(t *testing.T) {
			client := &targetResourceClient{filteredIndexClient: &filteredIndexClient{t: t}, advertise: advertise}
			mgr, err := manager.New(nil)
			require.NoError(t, err)
			require.NoError(t, mgr.RegisterLocal(context.Background(), "remote", &cfg.MCPClient{ClientOptions: &mcp.ClientOptions{}, PrimitiveProviderIdentity: "producer", ResourceCacheScopes: map[string]string{"remote": cfg.ResourceCachePublic}}, func(context.Context) (mcpclient.Interface, error) { return client, nil }))
			defer mgr.CloseConversation("")
			actor, verify := PublicReadActors()
			g := NewGateway(mgr, actor, verify, "consumer")
			defer g.Close()
			rows, err := g.List(context.Background(), "window", "remote")
			require.NoError(t, err)
			require.Len(t, rows, 1)
			for _, form := range []string{"desktop", "tablet", "desktop"} {
				target := &types.WindowTarget{Platform: "web", FormFactor: form, Surface: "browser", Capabilities: []string{"z", "a", "a"}, SelectionToken: "must-not-leak"}
				ctx := requestctx.WithWindowTarget(context.Background(), target)
				got, err := Get[json.RawMessage](ctx, g, rows[0].Connection, identity.ResourceRef{URI: rows[0].Resource.URI}, nil)
				require.NoError(t, err)
				var body struct {
					Title string `json:"title"`
				}
				require.NoError(t, json.Unmarshal(got.Definition, &body))
				want := "legacy"
				if advertise {
					want = form
				}
				require.Equal(t, want, body.Title)
				_, err = Get[json.RawMessage](ctx, g, rows[0].Connection, identity.ResourceRef{URI: rows[0].Resource.URI, Revision: got.ResolvedResource.Selector()}, got.ResolvedResource)
				require.NoError(t, err, "pinned revalidation must reuse the same target partition")
				require.Equal(t, []string{"z", "a", "a"}, target.Capabilities)
				require.Equal(t, "must-not-leak", target.SelectionToken)
			}
			require.Len(t, client.readTargets, 2, "existing definition cache reuses each normalized target separately")
		})
	}
}
