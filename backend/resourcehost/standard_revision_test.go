package resource

import (
	"context"
	"github.com/stretchr/testify/require"
	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/mcp-protocol/schema"
	mcpclient "github.com/viant/mcp/client"
	"testing"
)

type revisionReadClient struct {
	mcpclient.Interface
	pin     *identity.ResolvedResource
	request *schema.ReadResourceRequestParams
}

func (c *revisionReadClient) ReadResource(_ context.Context, p *schema.ReadResourceRequestParams, _ ...mcpclient.RequestOption) (*schema.ReadResourceResult, error) {
	c.request = p
	entry := schema.ReadResourceResultContentsElem{Uri: p.Uri, Text: `{"schemaVersion":1,"dataSource":{"id":"orders"}}`}
	if c.pin != nil {
		entry.Meta = map[string]any{"resource": c.pin}
	}
	return &schema.ReadResourceResult{Contents: []schema.ReadResourceResultContentsElem{entry}}, nil
}
func TestStandardResourceRevisionUsesSharedMetadataAndReturnedPin(t *testing.T) {
	const uri = "datasource://demo/orders"
	pin := identity.ResolvedResource{ProviderIdentity: "provider", URI: uri, ResourceCandidate: identity.ResourceCandidate{Kind: identity.StampedCandidate, Revision: "1", ContentFingerprint: identity.ContentFingerprint([]byte("original"))}}
	caps := capabilities{connection: Connection{ProviderIdentity: "provider"}, indexedResources: map[string]primitive.ResourceState{uri: {URI: uri, Kind: "datasource"}}}
	c := &revisionReadClient{pin: &pin}
	got, err := standardDefinitionGet(context.Background(), c, caps, identity.ResourceRef{URI: uri, Revision: "1"})
	require.NoError(t, err)
	require.Equal(t, "1", c.request.Meta.AdditionalProperties.(map[string]any)[primitive.RevisionMeta])
	require.Equal(t, pin, *got.ResolvedResource)
	_, err = standardDefinitionGet(context.Background(), c, caps, identity.ResourceRef{URI: uri, Revision: "2"})
	require.ErrorIs(t, err, identity.ErrResourceStale)
	c.pin = nil
	_, err = standardDefinitionGet(context.Background(), c, caps, identity.ResourceRef{URI: uri, Revision: "1"})
	require.ErrorIs(t, err, identity.ErrResourceStale)
	_, err = standardDefinitionGet(context.Background(), c, caps, identity.ResourceRef{URI: uri})
	require.NoError(t, err, "ordinary MCP resources need no custom metadata")
}
