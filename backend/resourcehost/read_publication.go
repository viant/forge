package resource

import (
	"context"
	identity "github.com/viant/forge/backend/resource"
)

// BeforePublication runs the same release obligations as finish without closing
// the operation. Callers drain data dispatch first; no original grant is renewed.
func (s *resourceReadSequence) BeforePublication(ctx context.Context) error {
	s.transition.Lock()
	defer s.transition.Unlock()
	s.mu.Lock()
	if s.closed || s.failed != nil || s.ending || s.dispatchDepth != 0 || !s.active {
		s.mu.Unlock()
		return identity.ErrResourceDenied
	}
	s.ending = true
	s.mu.Unlock()
	err := s.endPhase(ctx)
	if err == nil {
		err = s.refreshReportReads(ctx)
	}
	s.mu.Lock()
	s.ending = false
	if err != nil {
		s.failed = err
	}
	s.mu.Unlock()
	if err != nil {
		return err
	}
	err = s.startPhase(ctx)
	if err != nil {
		s.mu.Lock()
		s.failed = err
		s.mu.Unlock()
	}
	return err
}
