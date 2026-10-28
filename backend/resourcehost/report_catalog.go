package resource

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/viant/forge/backend/provider/contract"
	iauth "github.com/viant/mcp/client/auth/link"

	"github.com/viant/authz"
	"github.com/viant/forge/backend/policy"
	catalog "github.com/viant/forge/backend/reporting/catalog"
	"github.com/viant/forge/backend/reporting/engine"
	"github.com/viant/forge/backend/reporting/registry"
	identity "github.com/viant/forge/backend/resource"
)

// ReportGatewayCatalog connects ordinary reporting service list/get/compile
// paths to the same gateway as windows. It never rewrites provider authority,
// fingerprints, revision or lease, and never grants mutation capabilities.
type ReportGatewayCatalog struct {
	Gateway           *Gateway
	BeginMetadataRead func(context.Context) (context.Context, func() error, error)
	BuilderWindows    map[string]string
	Capabilities      func(context.Context, identity.VerifiedActor, catalog.ReportCatalogCandidate, identity.ResolvedResource) (catalog.ReportCapabilities, error)
}

func (c *ReportGatewayCatalog) CurrentActor(ctx context.Context) (identity.VerifiedActor, error) {
	if c == nil || c.Gateway == nil {
		return identity.VerifiedActor{}, identity.ErrResourceDenied
	}
	return c.Gateway.actor(ctx)
}
func (c *ReportGatewayCatalog) MetadataRead(ctx context.Context) (context.Context, func() error, error) {
	if c == nil || c.Gateway == nil {
		return nil, nil, identity.ErrResourceDenied
	}
	if sequence := sequenceFromContext(ctx); sequence != nil {
		if sequence.gateway != c.Gateway {
			return nil, nil, identity.ErrResourceDenied
		}
		scoped, err := ReadContext(ctx)
		if err != nil {
			return nil, nil, err
		}
		actor, err := c.Gateway.actor(scoped)
		if err != nil {
			return nil, nil, err
		}
		return scoped, func() error { return c.Gateway.final(scoped, actor) }, nil
	}
	if c.BeginMetadataRead != nil {
		return c.BeginMetadataRead(ctx)
	}
	actor, err := c.Gateway.actor(ctx)
	if err != nil {
		return nil, nil, err
	}
	return ctx, func() error { return c.Gateway.final(ctx, actor) }, nil
}
func (c *ReportGatewayCatalog) Reader(ctx context.Context, operation string) (reporting.ResourceReader, error) {
	if c == nil || c.Gateway == nil || operation == "" {
		return nil, identity.ErrResourceDenied
	}
	if _, err := c.Gateway.actor(ctx); err != nil {
		return nil, err
	}
	return &gatewayReportReader{catalog: c}, nil
}

func (c *ReportGatewayCatalog) Read(ctx context.Context, ref identity.ResourceRef, pin *identity.ResolvedResource) ([]byte, *identity.ResolvedResource, error) {
	reader, err := c.Reader(ctx, "report.retrieve")
	if err != nil {
		return nil, nil, err
	}
	if pin == nil {
		pin, err = reader.Resolve(ctx, ref)
		if err != nil {
			return nil, nil, err
		}
	}
	if pin.URI != ref.URI || ref.Revision != "" && ref.Revision != pin.Selector() {
		return nil, nil, identity.ErrResourceDenied
	}
	return reader.ReadResolved(ctx, *pin)
}

type gatewayReportReader struct {
	catalog *ReportGatewayCatalog
}

func readReport[T any](ctx context.Context, r *gatewayReportReader, ref identity.ResourceRef, pin *identity.ResolvedResource, ownerHint string, refresh ...bool) (*Result[T], error) {
	uri, err := identity.ParseResourceURI(ref.URI)
	if err != nil || uri.Kind != "report" {
		return nil, identity.ErrResourceDenied
	}
	captured, err := r.catalog.Gateway.actor(ctx)
	if err != nil {
		return nil, err
	}
	owner := ownerHint
	if pin != nil {
		owner = pin.ProviderIdentity
		if pin.URI != ref.URI || owner == "" {
			return nil, identity.ErrResourceDenied
		}
	}
	var connection Connection
	if owner != "" {
		var found bool
		connection, found, err = r.catalog.Gateway.configuredOwnerConnection(ctx, owner)
		if err == nil && !found {
			connection, err = r.catalog.Gateway.ConnectionForResource(ctx, uri, owner)
		}
	} else {
		connection, err = r.catalog.Gateway.ConnectionForResource(ctx, uri, owner)
	}
	if err != nil {
		return nil, err
	}
	if len(refresh) > 1 && refresh[1] {
		ctx = withFreshMetadataSelection(ctx)
	}
	force := len(refresh) > 0 && refresh[0]
	got, err := get[T](ctx, r.catalog.Gateway, connection, ref, pin, force, false)
	if err != nil {
		return nil, err
	}
	fresh, err := r.catalog.Gateway.actor(ctx)
	if err != nil {
		return nil, err
	}
	if !sameLocalActor(captured, fresh) || !identity.MetadataExpiryValid(got.ResolvedResource.ValidUntil, r.catalog.Gateway.now()) {
		return nil, identity.ErrResourceDenied
	}
	if err = r.catalog.Gateway.final(ctx, captured); err != nil {
		return nil, err
	}
	if ctx.Err() != nil || !identity.MetadataExpiryValid(got.ResolvedResource.ValidUntil, r.catalog.Gateway.now()) {
		return nil, identity.ErrResourceDenied
	}
	if err = r.recordReportRead(ctx, connection, &got.GetResult); err != nil {
		return nil, err
	}
	pinCopy := *got.ResolvedResource
	got.ResolvedResource = &pinCopy
	return got, nil
}
func (r *gatewayReportReader) read(ctx context.Context, ref identity.ResourceRef, pin *identity.ResolvedResource, ownerHint string) (json.RawMessage, *identity.ResolvedResource, error) {
	result, err := readReport[json.RawMessage](ctx, r, ref, pin, ownerHint)
	if err != nil {
		return nil, nil, err
	}
	return append(json.RawMessage(nil), result.Resource.DefinitionBytes...), result.ResolvedResource, nil
}

// ReadResource selects and delivers one report through its owning MCP, avoiding
// an otherwise discarded Resolve body followed by the same read.
func (r *gatewayReportReader) ReadDefinition(ctx context.Context, ref identity.ResourceRef, pin *identity.ResolvedResource) (*primitive.GetResult, error) {
	got, err := readReport[json.RawMessage](ctx, r, ref, pin, "")
	if err != nil {
		return nil, err
	}
	return &got.GetResult, nil
}

func (r *gatewayReportReader) ReadResource(ctx context.Context, ref identity.ResourceRef, pin *identity.ResolvedResource) (json.RawMessage, *identity.ResolvedResource, error) {
	return r.read(ctx, ref, pin, "")
}
func (r *gatewayReportReader) Resolve(ctx context.Context, ref identity.ResourceRef) (*identity.ResolvedResource, error) {
	_, pin, err := r.read(ctx, ref, nil, "")
	return pin, err
}
func (r *gatewayReportReader) ReadResolvedFresh(ctx context.Context, pin identity.ResolvedResource) (json.RawMessage, *identity.ResolvedResource, error) {
	result, err := readReport[json.RawMessage](ctx, r, identity.ResourceRef{URI: pin.URI, Revision: pin.Selector()}, &pin, "", true)
	if err != nil {
		return nil, nil, err
	}
	return append(json.RawMessage(nil), result.Resource.DefinitionBytes...), result.ResolvedResource, nil
}
func (r *gatewayReportReader) ReadResolved(ctx context.Context, pin identity.ResolvedResource) (json.RawMessage, *identity.ResolvedResource, error) {
	return r.read(ctx, identity.ResourceRef{URI: pin.URI, Revision: pin.Selector()}, &pin, "")
}
func (r *gatewayReportReader) ResolveForProvider(ctx context.Context, ref identity.ResourceRef, provider string) (*identity.ResolvedResource, error) {
	if provider == "" {
		return nil, identity.ErrResourceDenied
	}
	_, pin, err := r.read(ctx, ref, nil, provider)
	return pin, err
}
func (c *ReportGatewayCatalog) List(ctx context.Context, input catalog.ReportCatalogQuery) (out *catalog.ReportCatalogResult, failure error) {
	if input.Limit < 0 || input.Limit > 1000 {
		return nil, identity.ErrResource
	}
	scoped, finish, err := c.MetadataRead(ctx)
	if err != nil {
		return nil, err
	}
	if scoped == nil || finish == nil {
		return nil, identity.ErrResourceDenied
	}
	defer func() {
		if err := finish(); err != nil {
			out = nil
			failure = err
		}
		if out != nil {
			if ctx.Err() != nil {
				out = nil
				failure = identity.ErrResourceDenied
				return
			}
			for _, entry := range out.Reports {
				if entry.Resource == nil || !identity.MetadataExpiryValid(entry.Resource.ValidUntil, c.Gateway.now()) {
					out = nil
					failure = identity.ErrResourceDenied
					return
				}
			}
		}
	}()
	ctx = scoped
	actor, err := c.CurrentActor(ctx)
	if err != nil {
		return nil, err
	}
	query := CatalogQuery{Namespace: input.Namespace, Cursor: input.Cursor, Limit: input.Limit}
	if query.Limit == 0 {
		query.Limit = primitive.MaxCatalogPageSize
	}
	if input.CurrentUserOnly {
		for _, owner := range []string{actor.Subject, iauth.CanonicalUserID(ctx)} {
			if owner != "" {
				query.OwnerIDs = append(query.OwnerIDs, owner)
			}
		}
		if iauth.Provider(ctx) != "" && iauth.EffectiveUserID(ctx) != "" {
			query.OwnerIDs = append(query.OwnerIDs, iauth.EffectiveUserID(ctx))
		}
		if len(query.OwnerIDs) == 0 {
			if input.Cursor != "" {
				return nil, primitive.ErrCatalogCursor
			}
			return &catalog.ReportCatalogResult{Reports: []catalog.ReportCatalogEntry{}}, nil
		}
	}
	page, err := ListPage[registry.ReportEnvelope](ctx, c.Gateway, "report", query, true)
	if err != nil {
		return nil, err
	}
	result := &catalog.ReportCatalogResult{Reports: []catalog.ReportCatalogEntry{}, NextCursor: page.NextCursor}
	owners := make(map[string]string, len(page.Items))
	for _, row := range page.Items {
		resource, pin := row.Resource, row.ResolvedResource
		if pin == nil || pin.ContentFingerprint != resource.ContentFingerprint {
			return nil, identity.ErrResourceStale
		}
		if owner, exists := owners[resource.URI]; exists && owner != pin.ProviderIdentity {
			return nil, ErrCollision
		}
		owners[resource.URI] = pin.ProviderIdentity
		envelope := row.Definition
		candidate := catalog.ReportCatalogCandidate{URI: resource.URI, Title: resource.Title, OwnerID: resource.OwnerID, BuilderRef: envelope.BuilderRef, BuilderWindow: c.BuilderWindows[envelope.BuilderRef], ReportID: resource.URI}
		capabilities := catalog.ReportCapabilities{}
		if c.Capabilities != nil {
			capabilities, err = c.Capabilities(ctx, actor, candidate, *pin)
			if err != nil {
				return nil, err
			}
		}
		if c.Gateway.generation(row.Connection.Name) != row.Connection.Generation {
			return nil, identity.ErrResourceStale
		}
		result.Reports = append(result.Reports, catalog.ReportCatalogEntry{ReportCatalogCandidate: candidate, Namespace: resource.Namespace, Name: resource.Name, OwnedByCurrentUser: reportOwnedByCurrentUser(ctx, actor, resource.OwnerID), Resource: pin, Capabilities: capabilities})
	}
	return result, nil
}

var _ catalog.Provider = (*ReportGatewayCatalog)(nil)

func resourceIdentityRejected(err error) bool {
	return errors.Is(err, policy.ErrIdentityRejected) || errors.Is(err, authz.ErrIdentityDenied)
}

// Ownership here is a UI catalog filter, never permission to read a resource.
// The managing provider has already filtered the supplied catalog.
func reportOwnedByCurrentUser(ctx context.Context, actor identity.VerifiedActor, owner string) bool {
	if owner == "" {
		return false
	}
	return owner == actor.Subject || owner == iauth.CanonicalUserID(ctx) || iauth.Provider(ctx) != "" && owner == iauth.EffectiveUserID(ctx)
}
