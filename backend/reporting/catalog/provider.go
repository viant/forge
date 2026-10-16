// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package catalog

import (
	"context"
	identity "github.com/viant/forge/backend/resource"
	"time"
)

// Provider is a verified report inventory projection with explicit identity
// and metadata scope. It contains no storage/schema or authoring dependency.
type Provider interface {
	List(context.Context, ReportCatalogQuery) (*ReportCatalogResult, error)
	Read(context.Context, identity.ResourceRef, *identity.ResolvedResource) ([]byte, *identity.ResolvedResource, error)
	MetadataRead(context.Context) (context.Context, func() error, error)
	CurrentActor(context.Context) (identity.VerifiedActor, error)
}

func (s *ReportCatalogService) MetadataRead(ctx context.Context) (context.Context, func() error, error) {
	if s == nil || ctx == nil || ctx.Err() != nil {
		return nil, nil, identity.ErrResourceDenied
	}
	if s.BeginMetadataRead != nil {
		return s.BeginMetadataRead(ctx)
	}
	return ctx, func() error { return nil }, nil
}
func (s *ReportCatalogService) CurrentActor(ctx context.Context) (identity.VerifiedActor, error) {
	if s == nil || s.Identity == nil || ctx == nil || ctx.Err() != nil {
		return identity.VerifiedActor{}, identity.ErrResourceDenied
	}
	actor, err := s.Identity(ctx)
	if err != nil || !actor.Valid(time.Now()) {
		return identity.VerifiedActor{}, identity.ErrResourceDenied
	}
	return actor, nil
}
