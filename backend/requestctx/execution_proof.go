// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package requestctx

import (
	"context"
	"github.com/viant/forge/backend/provider/contract"
)

type resourceExecutionProofKey struct{}

// WithResourceExecutionProof carries the original provider proof installed by
// trusted resource resolution. It grants no access: providers verify its signed
// binding, and gateways separately reauthorize the original resource/lease.
func WithResourceExecutionProof(ctx context.Context, proof primitive.ExecutionProof) context.Context {
	return context.WithValue(ctx, resourceExecutionProofKey{}, proof)
}
func ResourceExecutionProofFromContext(ctx context.Context) (*primitive.ExecutionProof, bool) {
	if ctx == nil {
		return nil, false
	}
	proof, ok := ctx.Value(resourceExecutionProofKey{}).(primitive.ExecutionProof)
	if !ok {
		return nil, false
	}
	return &proof, true
}
