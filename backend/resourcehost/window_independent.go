package resource

import (
	"context"
	"encoding/json"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
)

func (c *WindowCatalog) resolveIndependentDatasource(ctx context.Context, connection Connection, definition *Result[json.RawMessage], parent identity.ResolvedResource, target *types.WindowTarget, id string, variant *types.WindowResourceVariant) (*dsproto.DataSource, error) {
	if target == nil || c.VerifyWindowTarget(ctx, parent, *target, variant.Fingerprint) != nil {
		return nil, identity.ErrResourceDenied
	}
	raw := variant.DataSources[id]
	reads := []selectedResourceRead{{connection: connection, pin: parent, result: definition.GetResult, definitionCache: definition.definitionCache}}
	if ref, ok := variant.DataSourceResources[id]; ok {
		childConnection, err := c.Gateway.dependencyConnection(ctx, connection, ref.ProviderIdentity)
		if err != nil {
			return nil, err
		}
		child, err := Get[json.RawMessage](ctx, c.Gateway, childConnection, ref.Resource, nil)
		if err != nil {
			return nil, err
		}
		raw, err = types.MaterializeWindowDatasource(*variant, id, child.Definition)
		if err != nil {
			return nil, err
		}
		reads = append(reads, selectedResourceRead{connection: childConnection, pin: *child.ResolvedResource, result: child.GetResult, definitionCache: child.definitionCache})
	}
	var descriptor dsproto.DataSource
	if len(raw) == 0 || json.Unmarshal(raw, &descriptor) != nil || descriptor.ID != id {
		return nil, identity.ErrResourceDenied
	}
	if variant.DataSources == nil {
		variant.DataSources = map[string]json.RawMessage{}
	}
	variant.DataSources[id] = raw
	if err := c.registerSelectedDatasource(ctx, parent, target, id, variant, reads); err != nil {
		return nil, err
	}
	return &descriptor, nil
}
