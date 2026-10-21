package service

import (
	"context"
	"github.com/viant/forge/backend/types"
	"github.com/viant/forge/backend/uicontext"
)

func (s *Service) ConfigureLocalStateOwner(resolve uicontext.LocalStateOwnerResolver) {
	if s != nil && s.cfg != nil {
		s.cfg.LocalStateOwnerResolver = resolve
	}
}
func (s *Service) AttachLocalStateOwner(ctx context.Context, window *types.Window) (*types.Window, error) {
	var resolve uicontext.LocalStateOwnerResolver
	if s != nil && s.cfg != nil {
		resolve = s.cfg.LocalStateOwnerResolver
	}
	return uicontext.AttachLocalStateOwner(ctx, window, resolve)
}
