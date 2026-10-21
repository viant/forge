package uicontext

import (
	"context"
	"github.com/viant/forge/backend/types"
	"strings"
	"time"
)

type LocalStateOwnerResolver func(context.Context) (*types.LocalStateOwner, error)

// AttachLocalStateOwner always strips untrusted input. Missing verified scope is
// supported metadata without restoration capability, never a permission grant.
func AttachLocalStateOwner(ctx context.Context, window *types.Window, resolve LocalStateOwnerResolver) (*types.Window, error) {
	if window == nil {
		return nil, nil
	}
	copy := *window
	copy.LocalStateOwner = nil
	if resolve == nil {
		return &copy, nil
	}
	owner, err := resolve(ctx)
	if err != nil {
		return nil, err
	}
	if owner == nil || owner.Binding == "" || len(owner.Binding) > 512 || strings.TrimSpace(owner.Binding) != owner.Binding || !owner.ValidUntil.After(time.Now()) {
		return &copy, nil
	}
	held := *owner
	copy.LocalStateOwner = &held
	return &copy, nil
}
