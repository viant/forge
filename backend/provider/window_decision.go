// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package service

import (
	"context"
	"sync"

	"github.com/viant/forge/backend/requestctx"
	identity "github.com/viant/forge/backend/resource"
)

// WindowReadDecisionScope is supplied only by trusted host registration. It
// shares authority FACTS during a pure read phase; every permission/pin check
// still runs. Finish must freshly verify authority and the original deadline.
type WindowReadDecisionScope func(context.Context) (context.Context, func() error, error)

func (s *Service) ConfigureWindowReadDecisionScope(begin WindowReadDecisionScope) {
	if s != nil && s.cfg != nil {
		s.cfg.WindowReadDecisionScope = begin
	}
}
func (s *Service) BeginWindowReadDecision(ctx context.Context) (context.Context, func() error, error) {
	if ctx == nil || ctx.Err() != nil {
		return nil, nil, identity.ErrResourceDenied
	}
	if s == nil || s.cfg == nil || s.cfg.WindowReadDecisionScope == nil {
		return ctx, func() error { return nil }, nil
	}
	// Each explicit PRE/POST phase is fresh. Caller metadata scope cannot be
	// reused as an execution/open authorization snapshot.
	ctx = WithoutMetadataReadScope(ctx, s.cfg.MetadataScope)
	scoped, finish, err := s.cfg.WindowReadDecisionScope(requestctx.WithoutWindowReadDecision(ctx))
	if err != nil {
		return nil, nil, err
	}
	if scoped == nil || finish == nil {
		return nil, nil, identity.ErrResourceDenied
	}
	marked, closeMarker := requestctx.WithWindowReadDecision(scoped)
	var once sync.Once
	var finalErr error
	return marked, func() error {
		once.Do(func() {
			defer closeMarker()
			finalErr = finish()
			if marked.Err() != nil {
				finalErr = marked.Err()
			}
		})
		return finalErr
	}, nil
}
