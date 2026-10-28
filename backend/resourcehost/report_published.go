// SPDX-License-Identifier: Apache-2.0
package resource

import (
	"context"

	reporting "github.com/viant/forge/backend/reporting/engine"
	identity "github.com/viant/forge/backend/resource"
)

// VerifyPublishedResource fences a previously selected closed root using only
// local admission and active-root pointers. It never hydrates definition bytes.
func (r *gatewayReportReader) VerifyPublishedResource(ctx context.Context, pin identity.ResolvedResource) error {
	uri, err := identity.ParseResourceURI(pin.URI)
	if err != nil || (uri.Kind != "report" && uri.Kind != "window") {
		return identity.ErrResourceDenied
	}
	source, ok := r.catalog.Gateway.publishedNamespace(uri.Namespace)
	if !ok || source.connection.ProviderIdentity != pin.ProviderIdentity {
		return identity.ErrResourceDenied
	}
	connection := source.connection
	connection.Generation = r.catalog.Gateway.generation(connection.Name)
	return r.catalog.Gateway.verifyPublishedPin(ctx, connection, pin)
}
func (g *Gateway) verifyPublishedPin(ctx context.Context, connection Connection, pin identity.ResolvedResource) error {
	uri, err := identity.ParseResourceURI(pin.URI)
	if err != nil || pin.Kind != identity.PublishedCandidate || !pin.ResourceCandidate.Valid() || !identity.MetadataExpiryValid(pin.ValidUntil, g.now()) {
		return identity.ErrResourceDenied
	}
	source, covered, err := g.publishedForURI(connection, uri)
	if err != nil {
		return err
	}
	if !covered || pin.ProviderIdentity != connection.ProviderIdentity {
		return identity.ErrResourceDenied
	}
	actor, err := g.actor(ctx)
	if err != nil {
		return err
	}
	admission, err := source.source.AdmissionKey(ctx)
	if err != nil {
		return err
	}
	if admission == "" {
		return identity.ErrResourceDenied
	}
	hash, err := source.source.CurrentHash(ctx, pin.URI)
	if err != nil {
		return err
	}
	if hash != pin.ContentFingerprint || publishedAuthority(actor, source, uri, hash, admission) != pin.AuthorityBinding || identity.MetadataExpiryExtends(pin.ValidUntil, actor.ValidUntil) {
		return identity.ErrResourceDenied
	}
	if err = g.final(ctx, actor); err != nil {
		return err
	}
	fresh, err := source.source.AdmissionKey(ctx)
	if err != nil {
		return err
	}
	if fresh != admission || connection.Generation != g.generation(connection.Name) {
		return identity.ErrResourceDenied
	}
	return nil
}

var _ reporting.PublishedResourceVerifier = (*gatewayReportReader)(nil)
