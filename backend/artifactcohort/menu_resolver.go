package artifactcohort

import (
	"context"
	"encoding/json"
	"strconv"

	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/mcp-protocol/schema"
	mcpclient "github.com/viant/mcp/client"
)

// MenuResolver is optional on the trusted, configured origin Caller. The exact
// admitted root is supplied by the replica, never selected by a browser URL.
// Implementations must forward the caller's authenticated request context.
type MenuResolver interface {
	ResolveMenu(context.Context, RootRef, map[string]any) (*primitive.GetResult, error)
}

func validateResolvedMenu(ref RootRef, result *primitive.GetResult) error {
	if result == nil || result.Resource == nil || result.MenuProjection == nil {
		return ErrInvalid
	}
	resource, projection := result.Resource, result.MenuProjection
	if resource.URI != ref.URI || resource.ContentFingerprint != ref.Hash || resource.Revision != "" && resource.Revision != strconv.FormatUint(ref.Version, 10) {
		return ErrConflict
	}
	if result.ResolvedResource != nil {
		pin := result.ResolvedResource
		if pin.URI != ref.URI || pin.ContentFingerprint != ref.Hash || pin.Selector() != strconv.FormatUint(ref.Version, 10) {
			return ErrConflict
		}
	}
	if projection.SchemaVersion != 1 || len(projection.DefinitionBytes) == 0 || identity.ContentFingerprint(projection.DefinitionBytes) != projection.ContentFingerprint {
		return ErrInvalid
	}
	return nil
}

// ResolveMenu reuses the origin's resource get path. It never interprets source
// bindings or executes a datasource on the consuming host.
func (c MCPCaller) ResolveMenu(ctx context.Context, ref RootRef, parameters map[string]any) (*primitive.GetResult, error) {
	if c.Client == nil || ref.Kind != "navigation" || ref.URI == "" || ref.Version == 0 || ref.Hash == "" {
		return nil, ErrInvalid
	}
	arguments := map[string]any{"uri": ref.URI, "revision": strconv.FormatUint(ref.Version, 10)}
	if parameters != nil {
		arguments["parameters"] = parameters
	}
	response, err := c.Client.CallTool(ctx, &schema.CallToolRequestParams{Name: "resources/get", Arguments: arguments}, mcpclient.WithNoRetry())
	if err != nil {
		return nil, err
	}
	raw, err := exactText(response)
	if err != nil {
		return nil, err
	}
	var result primitive.GetResult
	if err := json.Unmarshal(raw, &result); err != nil {
		return nil, ErrInvalid
	}
	if err := validateResolvedMenu(ref, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

func (c NamespaceCaller) ResolveMenu(ctx context.Context, ref RootRef, parameters map[string]any) (*primitive.GetResult, error) {
	partition, err := RootPartition(ref)
	namespace, _, ok := cutPartition(partition)
	if err != nil || !ok || namespace != c.Namespace {
		return nil, ErrInvalid
	}
	return (MCPCaller{Client: c.Client}).ResolveMenu(ctx, ref, parameters)
}
