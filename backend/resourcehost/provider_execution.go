package resource

import (
	"context"
	"encoding/json"
	"reflect"
	"time"

	dsproto "github.com/viant/forge/backend/datasource/contract"
	primitive "github.com/viant/forge/backend/provider/contract"
	"github.com/viant/forge/backend/requestctx"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
	windowprotocol "github.com/viant/forge/backend/window/contract"
	"github.com/viant/mcp-protocol/schema"
	mcpclient "github.com/viant/mcp/client"
)

func matchProviderProof(pin identity.ResolvedResource, proof *primitive.ExecutionProof) error {
	if proof == nil || proof.Binding == "" || proof.Token == "" || pin.ProviderIdentity != proof.Resource.ProviderIdentity || pin.URI != proof.Resource.URI || pin.ResourceCandidate != proof.Resource.ResourceCandidate || pin.AuthorityBinding != proof.Resource.AuthorityBinding || pin.ValidUntil.After(proof.Resource.ValidUntil) || !proof.Resource.ValidUntil.After(time.Now()) || !identity.MetadataExpiryValid(pin.ValidUntil, time.Now()) {
		return identity.ErrResourceDenied
	}
	return nil
}

// FetchProviderDatasource retains the provider execution and window selection
// proofs. Owning-provider reads verify current content without replacing the
// original leases or proofs.
func (c *WindowCatalog) FetchProviderDatasource(ctx context.Context, pin identity.ResolvedResource, target *types.WindowTarget, expected *dsproto.DataSource, inputs map[string]interface{}) (json.RawMessage, error) {
	if !c.AuthzReady() || target == nil || target.SelectionToken == "" || expected == nil || expected.Backend == nil || expected.Backend.Kind != dsproto.BackendDatly || expected.Backend.Ownership != "provider" || expected.Backend.Service != "" || expected.Backend.Component == nil {
		return nil, identity.ErrResourceDenied
	}
	if child, linked := target.DependencyPins[expected.ID]; linked {
		uri, err := identity.ParseResourceURI(child.URI)
		if err != nil || uri.Kind != "datasource" {
			return nil, identity.ErrResourceDenied
		}
		return c.fetchReferencedDatasource(ctx, pin, target, child, expected, inputs)
	}
	if err := matchProviderProof(pin, target.ExecutionProof); err != nil {
		return nil, err
	}
	connection, err := c.Gateway.ConnectionForNamespace(ctx, pin.ProviderIdentity, resourceNamespace(pin.URI))
	if err != nil {
		return nil, err
	}
	actor, err := c.Gateway.actor(ctx)
	if err != nil {
		return nil, err
	}
	check := func() error {
		result, err := Get[json.RawMessage](ctx, c.Gateway, connection, identity.ResourceRef{URI: pin.URI, Revision: pin.Selector()}, &pin)
		if err != nil {
			return err
		}
		variant, err := types.SelectWindowResourceWithReferences(result.Resource.Definition, target)
		if err != nil {
			return err
		}
		if err = c.VerifyDependencies(ctx, pin, target, variant); err != nil {
			return err
		}
		var actual dsproto.DataSource
		if json.Unmarshal(variant.DataSources[expected.ID], &actual) != nil || actual.Backend == nil || actual.Backend.Component == nil || !reflect.DeepEqual(expected, &actual) {
			return identity.ErrResourceStale
		}
		if err = windowprotocol.ValidateComponentDispatch(expected.Backend.Component, *actual.Backend.Component); err != nil {
			return err
		}
		if result.ResolvedResource.ValidUntil.Before(pin.ValidUntil) {
			return identity.ErrResourceDenied
		}
		return matchProviderProof(pin, target.ExecutionProof)
	}
	if err = check(); err != nil {
		return nil, err
	}
	capabilities, err := c.Gateway.discover(ctx, actor, connection.Name)
	if err != nil {
		return nil, err
	}
	uri, _ := identity.ParseResourceURI(pin.URI)
	method := operationMethod(capabilities, uri.Namespace, "window", "fetch")
	if capabilities.connection != connection || method == "" || method != expected.Backend.Method {
		return nil, identity.ErrResourceDenied
	}
	client, err := c.Gateway.client(ctx, connection.Name)
	if err != nil {
		return nil, err
	}
	raw, err := json.Marshal(struct {
		Resource       identity.ResolvedResource `json:"resource"`
		ExecutionProof *primitive.ExecutionProof `json:"executionProof"`
		DataSourceID   string                    `json:"dataSourceId"`
		Inputs         map[string]interface{}    `json:"inputs"`
	}{pin, target.ExecutionProof, expected.ID, inputs})
	if err != nil {
		return nil, err
	}
	var args map[string]interface{}
	if json.Unmarshal(raw, &args) != nil {
		return nil, identity.ErrResourceDenied
	}
	finishDispatch, err := requestctx.BeginResourceReadDispatch(ctx)
	if err != nil {
		return nil, err
	}
	dispatchCtx, contextErr := ReadContext(ctx)
	if contextErr != nil {
		_ = finishDispatch()
		return nil, contextErr
	}
	result, callErr := client.CallTool(dispatchCtx, &schema.CallToolRequestParams{Name: method, Arguments: args}, mcpclient.WithNoRetry())
	finishErr := finishDispatch()
	if callErr != nil {
		return nil, callErr
	}
	if finishErr != nil {
		return nil, finishErr
	}
	if result == nil || result.IsError != nil && *result.IsError {
		return nil, identity.ErrResourceDenied
	}
	var body json.RawMessage
	if result.StructuredContent != nil {
		body, err = json.Marshal(result.StructuredContent)
	} else {
		for _, content := range result.Content {
			if text, ok := content.(schema.TextContent); ok && json.Valid([]byte(text.Text)) {
				body = json.RawMessage(text.Text)
				break
			}
		}
	}
	if err != nil || len(body) == 0 {
		return nil, identity.ErrResourceDenied
	}
	if err = check(); err != nil {
		return nil, err
	}
	if err = c.Gateway.final(ctx, actor); err != nil {
		return nil, err
	}
	// The final verifier may consume the remaining original lease. It cannot
	// renew that lease or authorize release after its deadline.
	if ctx.Err() != nil || !actor.Valid(c.Gateway.now()) || !pin.ValidUntil.After(c.Gateway.now()) {
		return nil, identity.ErrResourceDenied
	}
	if err = matchProviderProof(pin, target.ExecutionProof); err != nil {
		return nil, err
	}
	return body, nil
}
