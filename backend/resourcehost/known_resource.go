package resource

import (
	"context"

	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/mcp-protocol/schema"
)

// knownResourceCapabilities describes an exact read, not a discovered catalog.
// The configured endpoint owns authorization; resources/read supplies the actual
// definition and revision. Do not publish this partial view into discovery cache.
func (g *Gateway) knownResourceCapabilities(ctx context.Context, actor identity.VerifiedActor, binding *resourceReadBinding, connection Connection, uri identity.ResourceURI) (capabilities, bool) {
	options := binding.options
	// Collection restrictions may use opaque namespace locators. Only the MCP
	// definition reader's authenticated exact-list proof can bypass the full
	// collection walk for a matching configured URI namespace.
	if options.PrimitiveProviderIdentity == "" || options.PrimitiveProviderIdentity != connection.ProviderIdentity || !resourceFiltersSupported(ctx, binding.client) || !standardResourceReadSupported(ctx, binding.client) {
		return capabilities{}, false
	}
	if len(options.PrimitiveNamespaces) != 0 {
		proof, ok := ctx.Value(mcpReferenceProofKey{}).(mcpReferenceProof)
		if !ok || uri.Kind != "mcp" || proof.uri != uri.String() || proof.connection != connection || len(options.PrimitiveNamespaces) != 1 || options.PrimitiveNamespaces[0] != "ns://"+uri.Namespace {
			return capabilities{}, false
		}
	}
	return capabilities{
		actor: actor, connection: connection, expires: actor.ValidUntil,
		sharedIndex: true, standardResources: true,
		bindingKey: binding.capabilityKey(), resourceVersion: g.Manager.ResourceCatalogGeneration(ctx, connection.Name),
		indexedResources: map[string]primitive.ResourceState{uri.String(): {URI: uri.String(), Kind: uri.Kind, Namespace: uri.Namespace, Name: uri.Name}},
		namespaces:       []primitive.NamespaceCapabilities{{Namespace: uri.Namespace, ProviderIdentity: connection.ProviderIdentity, Kinds: []primitive.KindSupport{{Kind: uri.Kind, Operations: []string{"get"}, Methods: map[string]string{"get": schema.MethodResourcesRead}}}}},
	}, true
}
