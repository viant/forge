// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package policy

import (
	"context"

	"github.com/viant/authz"
)

// AuthorizeShared uses the status-preserving shared method when available.
// Core remains buildable with its pinned older authz module until the new
// shared version is published. Both paths fail closed.
func AuthorizeShared(service *authz.Service, ctx context.Context, request authz.Request) (authz.Decision, authz.Facts, error) {
	decision, facts, _, err := AuthorizeSharedWithRevision(service, ctx, request)
	return decision, facts, err
}

// AuthorizeSharedWithRevision exposes the exact policy revision used by the
// shared decision when supported by the linked authz module. A zero revision
// means the older API cannot report it; callers must verify their own read.
func AuthorizeSharedWithRevision(service *authz.Service, ctx context.Context, request authz.Request) (authz.Decision, authz.Facts, int64, error) {
	if service == nil {
		return authz.Decision{}, authz.Facts{}, 0, ErrDenied
	}
	if detailed, ok := any(service).(interface {
		AuthorizeWithStatus(context.Context, authz.Request) (authz.Decision, authz.Facts, int64, error)
	}); ok {
		return detailed.AuthorizeWithStatus(ctx, request)
	}
	if versioned, ok := any(service).(interface {
		AuthorizeWithRevision(context.Context, authz.Request) (authz.Decision, authz.Facts, int64, error)
	}); ok {
		return versioned.AuthorizeWithRevision(ctx, request)
	}
	decision, facts, err := service.AuthorizeWithFacts(ctx, request)
	return decision, facts, 0, err
}

// AuthorizeSharedSelection uses the same loaded policy to attach selected bounds.
// Older shared modules retain their static scoped decision; the caller still
// checks every selected ID against that decision before execution.
func AuthorizeSharedSelection(service *authz.Service, ctx context.Context, request authz.Request, selected []authz.Entity) (authz.Decision, authz.Facts, error) {
	if service == nil {
		return authz.Decision{}, authz.Facts{}, ErrDenied
	}
	if scoped, ok := any(service).(interface {
		AuthorizeSelectionWithStatus(context.Context, authz.Request, []authz.Entity) (authz.Decision, authz.Facts, int64, error)
	}); ok {
		decision, facts, _, err := scoped.AuthorizeSelectionWithStatus(ctx, request, selected)
		return decision, facts, err
	}
	return AuthorizeShared(service, ctx, request)
}

func AuthorizeSharedSelectionWithRevision(service *authz.Service, ctx context.Context, request authz.Request, selected []authz.Entity) (authz.Decision, authz.Facts, int64, error) {
	if service == nil {
		return authz.Decision{}, authz.Facts{}, 0, ErrDenied
	}
	if scoped, ok := any(service).(interface {
		AuthorizeSelectionWithStatus(context.Context, authz.Request, []authz.Entity) (authz.Decision, authz.Facts, int64, error)
	}); ok {
		return scoped.AuthorizeSelectionWithStatus(ctx, request, selected)
	}
	return AuthorizeSharedWithRevision(service, ctx, request)
}
