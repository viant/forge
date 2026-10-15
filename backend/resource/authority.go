// SPDX-License-Identifier: Apache-2.0
// Extracted from Viant Agently Core; provider bindings are independent of agent execution.
package resource

import "context"

// ResourceAuthority admits an exact resource selector/action using current
// trusted identity. Storage and transport implementations remain provider-owned.
type ResourceAuthority interface {
	AuthorizeResource(context.Context, ResourceURI, string, string) (VerifiedActor, error)
}
type ResourceAuthorityFunc func(context.Context, ResourceURI, string, string) (VerifiedActor, error)

func (f ResourceAuthorityFunc) AuthorizeResource(ctx context.Context, uri ResourceURI, selector, action string) (VerifiedActor, error) {
	return f(ctx, uri, selector, action)
}
