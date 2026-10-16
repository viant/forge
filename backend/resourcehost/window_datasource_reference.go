// SPDX-License-Identifier: Apache-2.0
// Forge MCP resource access extracted from Viant Agently Core.
package resource

import (
	"context"
	"encoding/json"
	"reflect"

	dsproto "github.com/viant/forge/backend/datasource/contract"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
)

func (c *WindowCatalog) fetchReferencedDatasource(ctx context.Context, parent identity.ResolvedResource, target *types.WindowTarget, child identity.ResolvedResource, expected *dsproto.DataSource, inputs map[string]interface{}) (json.RawMessage, error) {
	deadline := identity.MinimumMetadataExpiry(parent.ValidUntil, child.ValidUntil)
	ctx, cancel := identity.WithMetadataExpiry(ctx, deadline)
	defer cancel()
	connection, err := c.Gateway.ConnectionForProvider(ctx, parent.ProviderIdentity)
	if err != nil {
		return nil, err
	}
	check := func() error {
		result, err := GetWithCodec[*types.CompiledWindowResource](ctx, c.Gateway, connection, identity.ResourceRef{URI: parent.URI, Revision: parent.Selector()}, &parent, DefinitionCodec[*types.CompiledWindowResource]{ID: "forge.window.resource.v1", Parse: types.CompileWindowResource})
		if err != nil {
			return err
		}
		variant, err := result.Definition.Select(target)
		if err != nil {
			return err
		}
		if err = c.VerifyWindowTarget(ctx, parent, *target, variant.Fingerprint); err != nil {
			return err
		}
		if err = c.VerifyDependencies(ctx, parent, target, variant); err != nil {
			return err
		}
		ref, ok := variant.DataSourceResources[expected.ID]
		if !ok || ref.Resource.URI != child.URI || ref.Resource.Revision != child.Selector() || ref.ProviderIdentity != child.ProviderIdentity || ref.ContentFingerprint != child.ContentFingerprint {
			return identity.ErrResourceDenied
		}
		var actual dsproto.DataSource
		if json.Unmarshal(variant.DataSources[expected.ID], &actual) != nil || !reflect.DeepEqual(expected, &actual) || identity.MinimumMetadataExpiry(result.ResolvedResource.ValidUntil, parent.ValidUntil).Before(parent.ValidUntil) {
			return identity.ErrResourceDenied
		}
		return nil
	}
	if err = check(); err != nil {
		return nil, err
	}
	actual, proof, err := c.Gateway.ResolveDatasource(ctx, child)
	if err != nil {
		return nil, err
	}
	if !sameDatasourceDescriptor(expected, actual) {
		return nil, identity.ErrResourceStale
	}
	body, err := c.Gateway.FetchDatasource(ctx, child, proof, expected, inputs)
	if err != nil {
		return nil, err
	}
	if err = check(); err != nil {
		return nil, err
	}
	if ctx.Err() != nil || !identity.MetadataExpiryValid(parent.ValidUntil, c.Gateway.now()) || !identity.MetadataExpiryValid(child.ValidUntil, c.Gateway.now()) {
		return nil, identity.ErrResourceDenied
	}
	return body, nil
}
