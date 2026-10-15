// SPDX-License-Identifier: Apache-2.0
// Forge MCP resource access extracted from Viant Agently Core.
package resource

import (
	"context"
	identity "github.com/viant/forge/backend/resource"
	"time"
)

// PublicReadActors carries no authenticated identity or business permissions.
// Managing providers still decide whether each public list/get is available.
func PublicReadActors() (ActorResolver, ActorVerifier) {
	actor := func(ctx context.Context) (identity.VerifiedActor, error) {
		if ctx == nil || ctx.Err() != nil {
			return identity.VerifiedActor{}, identity.ErrResourceDenied
		}
		return identity.VerifiedActor{PublicRead: true}, nil
	}
	verify := func(ctx context.Context, held identity.VerifiedActor) error {
		if ctx == nil || ctx.Err() != nil || !held.PublicRead || !held.ReadValid(time.Now()) {
			return identity.ErrResourceDenied
		}
		return nil
	}
	return actor, verify
}
