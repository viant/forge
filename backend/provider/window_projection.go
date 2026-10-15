// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package service

import (
	"context"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
	windowprotocol "github.com/viant/forge/backend/window/contract"
	"time"
)

// WindowUIProjection renders role/exposure conditions. Resource access remains
// entirely with the managing MCP that returned this definition.
type WindowUIProjection func(context.Context, *windowprotocol.PresentationInput) (*types.Window, error)

func (s *Service) ProjectWindow(ctx context.Context, window *types.Window) (*types.Window, error) {
	return s.ProjectWindowWithInput(ctx, &windowprotocol.PresentationInput{Window: window})
}
func (s *Service) ProjectWindowWithInput(ctx context.Context, input *windowprotocol.PresentationInput) (*types.Window, error) {
	if input == nil {
		return nil, identity.ErrResourceDenied
	}
	window := input.Window
	if s == nil || s.cfg == nil || window == nil || ctx.Err() != nil {
		return nil, identity.ErrResourceDenied
	}
	if window.Resource != nil && !identity.MetadataExpiryValid(window.Resource.ValidUntil, time.Now()) {
		return nil, identity.ErrResourceDenied
	}
	if s.cfg.WindowUIProjection == nil {
		return window, nil
	}
	projected, err := s.cfg.WindowUIProjection(ctx, input)
	if err != nil {
		return nil, err
	}
	if projected == nil {
		return nil, identity.ErrResourceDenied
	}
	projected.Resource = window.Resource
	projected.ResourceTarget = window.ResourceTarget
	return projected, nil
}
func (s *Service) ConfigureWindowUIProjection(project WindowUIProjection) {
	if s != nil && s.cfg != nil {
		s.cfg.WindowUIProjection = project
	}
}
func (s *Service) HasWindowUIProjection() bool {
	return s != nil && s.cfg != nil && s.cfg.WindowUIProjection != nil
}
