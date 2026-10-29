// SPDX-License-Identifier: Apache-2.0
// Forge MCP resource access extracted from Viant Agently Core.
package resource

import (
	"context"
	"encoding/json"
	"io"
	"strings"
	"time"

	dsproto "github.com/viant/forge/backend/datasource/contract"
	primitive "github.com/viant/forge/backend/provider/contract"
	"github.com/viant/forge/backend/provider/contract/observe"
	"github.com/viant/forge/backend/requestctx"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
	windowprotocol "github.com/viant/forge/backend/window/contract"
	"github.com/viant/mcp-protocol/schema"
	mcpclient "github.com/viant/mcp/client"
)

// DecodeDatasourceDefinition decodes the same exact standalone datasource
// envelope used by gateway execution and generic definition resolution.
func DecodeDatasourceDefinition(raw json.RawMessage) (*dsproto.DataSource, error) {
	return datasourceDefinition(raw)
}

func datasourceDefinition(raw json.RawMessage) (*dsproto.DataSource, error) {
	var envelope struct {
		SchemaVersion int64           `json:"schemaVersion"`
		DataSource    json.RawMessage `json:"dataSource"`
	}
	decoder := json.NewDecoder(strings.NewReader(string(raw)))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&envelope) != nil || decoder.Decode(new(any)) != io.EOF || envelope.SchemaVersion != 1 {
		return nil, identity.ErrResourceDenied
	}
	canonical, err := types.CanonicalWindowDescriptor(envelope.DataSource)
	if err != nil {
		return nil, err
	}
	var descriptor dsproto.DataSource
	descriptorDecoder := json.NewDecoder(strings.NewReader(string(canonical)))
	descriptorDecoder.UseNumber()
	if descriptorDecoder.Decode(&descriptor) != nil || descriptor.ID == "" {
		return nil, identity.ErrResourceDenied
	}
	return &descriptor, nil
}
func sameDatasourceDescriptor(expected, actual *dsproto.DataSource) bool {
	if expected == nil || actual == nil {
		return false
	}
	// A parent attachment can assign a local alias. Every other descriptor
	// field is exact, and dispatch always uses the provider's canonical ID.
	copy := *actual
	copy.ID = expected.ID
	a, aErr := json.Marshal(expected)
	b, bErr := json.Marshal(&copy)
	if aErr != nil || bErr != nil {
		return false
	}
	aFP, aErr := types.WindowDescriptorFingerprint(a)
	bFP, bErr := types.WindowDescriptorFingerprint(b)
	return aErr == nil && bErr == nil && aFP == bFP
}

// ResolveDatasource reads the exact original standalone candidate. The proof
// remains opaque provider provenance and never replaces authorization or the
// consumer's original deadline.
func (g *Gateway) ResolveDatasource(ctx context.Context, pin identity.ResolvedResource) (*dsproto.DataSource, *primitive.ExecutionProof, error) {
	uri, err := identity.ParseResourceURI(pin.URI)
	if err != nil || uri.Kind != "datasource" {
		return nil, nil, identity.ErrResourceDenied
	}
	result, err := g.GetForProvider(ctx, pin.ProviderIdentity, identity.ResourceRef{URI: pin.URI, Revision: pin.Selector()}, &pin)
	if err != nil {
		return nil, nil, err
	}
	if result == nil || result.Resource == nil || result.ResolvedResource == nil || result.ResolvedResource.ValidUntil.Before(pin.ValidUntil) {
		return nil, nil, identity.ErrResourceDenied
	}
	descriptor, err := datasourceDefinition(result.Resource.Definition)
	if err != nil {
		return nil, nil, err
	}
	if descriptor.Backend != nil && descriptor.Backend.Kind == dsproto.BackendDatly && descriptor.Backend.Ownership == "provider" {
		if err = matchProviderProof(pin, result.ExecutionProof); err != nil {
			return nil, nil, err
		}
	}
	return descriptor, result.ExecutionProof, nil
}

// FetchDatasource executes one provider-owned standalone datasource through
// the advertised owning connection. Pinned reads, descriptor/component checks
// and original leases run before and after dispatch; no generic fallback exists.
func (g *Gateway) FetchDatasource(ctx context.Context, pin identity.ResolvedResource, proof *primitive.ExecutionProof, expected *dsproto.DataSource, inputs map[string]interface{}) (output json.RawMessage, failure error) {
	labels := observe.Labels{Kind: "datasource"}
	if observe.Enabled(ctx) {
		labels.Provider = pin.ProviderIdentity
	}
	total := observe.Start(ctx, observe.Phase("datasource.fetch"), labels)
	defer func() { total.End(observe.OutcomeFor(failure), observe.CacheUnknown) }()
	if proof != nil {
		copy := *proof
		proof = &copy
	}
	uri, err := identity.ParseResourceURI(pin.URI)
	if err != nil || uri.Kind != "datasource" || expected == nil || expected.Backend == nil || expected.Backend.Kind != dsproto.BackendDatly || expected.Backend.Ownership != "provider" || expected.Backend.Service != "" || expected.Backend.Component == nil {
		return nil, identity.ErrResourceDenied
	}
	if err = matchProviderProof(pin, proof); err != nil {
		return nil, err
	}
	actor, err := g.actor(ctx)
	if err != nil {
		return nil, err
	}
	deadline := identity.MinimumMetadataExpiry(pin.ValidUntil, proof.Resource.ValidUntil)
	deadline = identity.MinimumMetadataExpiry(deadline, actor.ValidUntil)
	ctx, cancel := identity.WithMetadataExpiry(ctx, deadline)
	defer cancel()
	connection, err := g.ConnectionForNamespace(ctx, pin.ProviderIdentity, uri.Namespace)
	if err != nil {
		return nil, err
	}
	check := func() (*dsproto.DataSource, error) {
		actual, _, err := g.ResolveDatasource(ctx, pin)
		if err != nil {
			return nil, err
		}
		if !sameDatasourceDescriptor(expected, actual) || actual.Backend == nil || actual.Backend.Component == nil {
			return nil, identity.ErrResourceStale
		}
		if err = windowprotocol.ValidateComponentDispatch(expected.Backend.Component, *actual.Backend.Component); err != nil {
			return nil, err
		}
		if err = matchProviderProof(pin, proof); err != nil {
			return nil, err
		}
		return actual, nil
	}
	actual, err := check()
	if err != nil {
		return nil, err
	}
	caps, err := g.discover(ctx, actor, connection.Name)
	if err != nil {
		return nil, err
	}
	method := operationMethod(caps, uri.Namespace, "datasource", "fetch")
	if caps.connection != connection || method == "" || method != expected.Backend.Method || method != actual.Backend.Method {
		return nil, identity.ErrResourceDenied
	}
	client, err := g.client(ctx, connection.Name)
	if err != nil {
		return nil, err
	}
	raw, err := json.Marshal(struct {
		Resource       identity.ResolvedResource `json:"resource"`
		ExecutionProof *primitive.ExecutionProof `json:"executionProof"`
		DataSourceID   string                    `json:"dataSourceId"`
		Inputs         map[string]interface{}    `json:"inputs"`
	}{pin, proof, actual.ID, inputs})
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
	dispatch := observe.Start(ctx, observe.Phase("datasource.mcp.call"), labels)
	result, callErr := client.CallTool(dispatchCtx, &schema.CallToolRequestParams{Name: method, Arguments: args}, mcpclient.WithNoRetry())
	dispatch.End(observe.OutcomeFor(callErr), observe.CacheUnknown)
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
	if _, err = check(); err != nil {
		return nil, err
	}
	if err = g.final(ctx, actor); err != nil {
		return nil, err
	}
	if ctx.Err() != nil || !actor.Valid(g.now()) || !identity.MetadataExpiryValid(pin.ValidUntil, g.now()) || !proof.Resource.ValidUntil.After(time.Now()) {
		return nil, identity.ErrResourceDenied
	}
	return body, nil
}
