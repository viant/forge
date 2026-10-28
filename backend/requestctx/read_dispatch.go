// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package requestctx

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
	"sync"
)

// ResourceReadDispatch is a trusted Go lifecycle, never a wire argument. The
// owner verifies and closes PRE facts before execution, then opens fresh POST
// facts for release checks after execution has returned.
type ResourceReadDispatch interface {
	BeforeDispatch(context.Context) error
	AfterDispatch(context.Context) error
}

// ResourceReadRelease advances a cache hit to fresh POST checks without
// pretending that a backend or tool was dispatched.
type ResourceReadRelease interface{ BeforeRelease(context.Context) error }

func BeginResourceReadRelease(ctx context.Context) error {
	lifecycle, _ := ctx.Value(resourceReadDispatchKey{}).(ResourceReadRelease)
	if lifecycle == nil {
		return ctx.Err()
	}
	return lifecycle.BeforeRelease(ctx)
}

type resourceReadDispatchKey struct{}
type resourceReadAssociationKey struct{}

// WithResourceReadAssociation binds delivery memo identity to the original
// parent and selected target. This digest grants nothing and creates no pin.
func WithResourceReadAssociation(ctx context.Context, pin *identity.ResolvedResource, target *types.WindowTarget) (context.Context, error) {
	raw, err := json.Marshal(struct {
		Resource *identity.ResolvedResource
		Target   *types.WindowTarget
	}{pin, target})
	if err != nil {
		return nil, err
	}
	return context.WithValue(ctx, resourceReadAssociationKey{}, sha256.Sum256(raw)), nil
}

func ResourceReadAssociation(ctx context.Context) [32]byte {
	digest, _ := ctx.Value(resourceReadAssociationKey{}).([32]byte)
	return digest
}

func HasResourceReadDispatch(ctx context.Context) bool {
	_, ok := ctx.Value(resourceReadDispatchKey{}).(ResourceReadDispatch)
	return ok
}

func WithResourceReadDispatch(ctx context.Context, lifecycle ResourceReadDispatch) context.Context {
	return context.WithValue(ctx, resourceReadDispatchKey{}, lifecycle)
}

func BeginResourceReadDispatch(ctx context.Context) (func() error, error) {
	lifecycle, _ := ctx.Value(resourceReadDispatchKey{}).(ResourceReadDispatch)
	if lifecycle == nil {
		return func() error { return ctx.Err() }, nil
	}
	if err := lifecycle.BeforeDispatch(ctx); err != nil {
		return nil, err
	}
	var once sync.Once
	var finalErr error
	return func() error {
		once.Do(func() { finalErr = lifecycle.AfterDispatch(ctx) })
		return finalErr
	}, nil
}

// ResourceReadPublication checks the existing POST release obligations at an
// intermediate output boundary, retaining the original operation and deadline.
type ResourceReadPublication interface{ BeforePublication(context.Context) error }

func CheckResourceReadPublication(ctx context.Context) error {
	value := ctx.Value(resourceReadDispatchKey{})
	if value == nil {
		return ctx.Err()
	}
	lifecycle, ok := value.(ResourceReadPublication)
	if !ok {
		return identity.ErrResourceDenied
	}
	return lifecycle.BeforePublication(ctx)
}
