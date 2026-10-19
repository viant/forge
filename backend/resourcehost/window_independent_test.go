package resource

import (
	"context"
	"encoding/json"
	"github.com/stretchr/testify/require"
	forgeMCP "github.com/viant/forge/backend/provider"
	"github.com/viant/forge/backend/types"
	"testing"
	"time"
)

func TestIndependentWindowOpensBeforeDeniedDatasourceAndResolvesOnUse(t *testing.T) {
	stack := newDependencyStack(t, time.Now().Add(time.Minute))
	var envelope types.WindowResourceEnvelope
	require.NoError(t, json.Unmarshal(stack.parent.raw, &envelope))
	var variant types.WindowResourceVariant
	for _, value := range envelope.Variants {
		variant = value
	}
	variant.DataSources = nil
	// An unrelated sibling remains denied throughout. Neither window opening
	// nor requesting orders may read it.
	unused := variant.DataSourceResources["orders"]
	unused.Resource.URI = "datasource://team/unused"
	variant.DataSourceResources["unused"] = unused
	variant.Window.DataSource["unused"] = variant.Window.DataSource["orders"]
	variant.Window.ResourceDependencies["unused"] = variant.Window.ResourceDependencies["orders"]
	deniedSibling := *stack.child
	deniedSibling.denied = true
	stack.provider.items[unused.Resource.URI] = &deniedSibling
	stack.provider.datasourceReads.Store(0)
	fingerprint, err := types.WindowVariantFingerprint(variant)
	require.NoError(t, err)
	envelope.SchemaVersion = 4
	envelope.Targets = []types.WindowTargetBinding{{Variant: fingerprint}}
	envelope.Variants = map[string]types.WindowResourceVariant{fingerprint: variant}
	require.NoError(t, envelope.Validate())
	stack.parent.raw, err = json.Marshal(envelope)
	require.NoError(t, err)
	stack.parent.formatVersion = 4
	stack.child.denied = true
	stack.gateway.Invalidate("parent")
	opened, err := stack.catalog.Get(context.Background(), &forgeMCP.WindowDefinitionGetInput{WindowID: stack.parentURI})
	require.NoError(t, err, "window opening must not read or authorize datasource dependencies")
	require.Zero(t, stack.provider.datasourceReads.Load())
	require.Empty(t, opened.Definition.ResourceTarget.DependencyPins)
	require.Equal(t, "/v1/api/datasources/orders/fetch", opened.Definition.DataSource["orders"].Service.URI)
	_, err = stack.catalog.ResolveDatasource(context.Background(), *opened.Definition.Resource, opened.Definition.ResourceTarget, "orders")
	require.Error(t, err, "datasource server denial applies only when used")
	stack.child.denied = false
	resolved, err := stack.catalog.ResolveDatasource(context.Background(), *opened.Definition.Resource, opened.Definition.ResourceTarget, "orders")
	require.NoError(t, err)
	require.Equal(t, "orders", resolved.ID)
	require.Len(t, resolved.Backend.Rows, 1)
	require.EqualValues(t, 2, stack.provider.datasourceReads.Load(), "only the explicitly requested datasource was read on each attempt")
}
