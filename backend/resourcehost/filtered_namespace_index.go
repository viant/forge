package resource

import (
	"context"
	"encoding/json"
	"fmt"

	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
	namespaces "github.com/viant/mcp-protocol/extension/namespaces"
	"github.com/viant/mcp-protocol/schema"
	mcpclient "github.com/viant/mcp/client"
)

const resourceFilterExtension = "io.viant/resources/filter"

type filteredResourceClient interface {
	ListResourcesWithParams(context.Context, *schema.ListResourcesRequestParams, ...mcpclient.RequestOption) (*schema.ListResourcesResult, error)
}

// Filters are sent only when the owning producer explicitly advertises them.
// Namespace discovery supplies the opaque collection locator; display names
// never become resource authorities or transport identities.
func resourceFiltersSupported(ctx context.Context, client mcpclient.Interface) bool {
	if capability, ok := client.(interface{ ResourceListParamsSupported(context.Context) bool }); ok && !capability.ResourceListParamsSupported(ctx) {
		return false
	}
	if _, ok := client.(filteredResourceClient); !ok {
		return false
	}
	initialized, err := client.Initialize(ctx)
	if err != nil || initialized == nil || initialized.Capabilities.Resources == nil {
		return false
	}
	raw, err := json.Marshal(initialized.Capabilities.Extensions[resourceFilterExtension])
	if err != nil {
		return false
	}
	var contract struct {
		SchemaVersion int      `json:"schemaVersion"`
		Fields        []string `json:"fields"`
	}
	if json.Unmarshal(raw, &contract) != nil || contract.SchemaVersion != 1 {
		return false
	}
	fields := map[string]bool{}
	for _, field := range contract.Fields {
		fields[field] = true
	}
	return fields["namespace"] && fields["kind"]
}

func (g *Gateway) readFilteredNamespaceIndex(ctx context.Context, client mcpclient.Interface, namespace namespaces.Namespace, resources map[string]primitive.ResourceState) error {
	filtered, ok := client.(filteredResourceClient)
	if !ok {
		return ErrUnavailable
	}
	seen := map[string]bool{}
	for cursor, page := (*string)(nil), 0; page < 100; page++ {
		params := &schema.ListResourcesRequestParams{Cursor: cursor}
		params.Meta.AdditionalProperties = map[string]any{resourceFilterExtension: map[string]any{"namespace": namespace.URI, "limit": 100}}
		listed, err := filtered.ListResourcesWithParams(ctx, params)
		if err != nil {
			return err
		}
		if listed == nil || listed.ResultType != "" && listed.ResultType != schema.ResultTypeComplete || listed.TtlMs < 0 {
			return identity.ErrResource
		}
		for _, entry := range listed.Resources {
			uri, err := identity.ParseResourceURI(entry.Uri)
			if err != nil || primitive.Plural(uri.Kind) == "" {
				continue
			}
			if entry.Name == "" || resources[entry.Uri].URI != "" {
				return fmt.Errorf("%w: duplicate or invalid indexed resource", ErrCollision)
			}
			state := primitive.ResourceState{URI: entry.Uri, Kind: uri.Kind, Namespace: uri.Namespace, Name: uri.Name, Title: entry.Name}
			if entry.Title != nil && *entry.Title != "" {
				state.Title = *entry.Title
			}
			if entry.Description != nil {
				state.Description = *entry.Description
			}
			if entry.MimeType != nil {
				state.MimeType = *entry.MimeType
			}
			resources[entry.Uri] = state
		}
		if listed.NextCursor == nil {
			return nil
		}
		if *listed.NextCursor == "" || seen[*listed.NextCursor] || page == 99 {
			return identity.ErrResource
		}
		seen[*listed.NextCursor] = true
		cursor = listed.NextCursor
	}
	return identity.ErrResource
}
