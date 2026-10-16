// SPDX-License-Identifier: Apache-2.0
// Extracted from Viant Agently Core; provider bindings are independent of agent execution.
package resource

import (
	"context"
	"time"
)

// MetadataExpiryValid treats an omitted expiry as notification/reload-bound
// definition metadata. It does not apply to authentication or execution tokens.
func MetadataExpiryValid(until, now time.Time) bool { return until.IsZero() || until.After(now) }

// MinimumMetadataExpiry propagates real managing-source constraints. Zero
// denotes no metadata deadline, never an expired or synthesized future lease.
func MinimumMetadataExpiry(left, right time.Time) time.Time {
	if left.IsZero() {
		return right
	}
	if right.IsZero() || left.Before(right) {
		return left
	}
	return right
}

// WithMetadataExpiry retains caller cancellation when no metadata deadline exists.
func WithMetadataExpiry(ctx context.Context, until time.Time) (context.Context, context.CancelFunc) {
	if until.IsZero() {
		return ctx, func() {}
	}
	return context.WithDeadline(ctx, until)
}

// MetadataExpiryExtends rejects extending a real managing-source deadline;
// selecting a finite deadline from event-bound metadata only narrows it.
func MetadataExpiryExtends(next, held time.Time) bool {
	return !held.IsZero() && (next.IsZero() || next.After(held))
}
