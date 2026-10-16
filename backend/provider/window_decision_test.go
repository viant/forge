// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package service

import (
	"context"
	"github.com/viant/forge/backend/requestctx"
	"testing"
)

func TestWindowDecisionScopeFailClosedAndFinish(t *testing.T) {
	for _, callback := range []WindowReadDecisionScope{
		func(ctx context.Context) (context.Context, func() error, error) {
			return nil, func() error { return nil }, nil
		},
		func(ctx context.Context) (context.Context, func() error, error) { return ctx, nil, nil },
	} {
		s := &Service{cfg: &Config{WindowReadDecisionScope: callback}}
		if _, _, err := s.BeginWindowReadDecision(context.Background()); err == nil {
			t.Fatal("incomplete trusted scope accepted")
		}
	}
	calls := 0
	s := &Service{cfg: &Config{WindowReadDecisionScope: func(ctx context.Context) (context.Context, func() error, error) {
		if requestctx.WindowReadDecisionActive(ctx) {
			t.Fatal("prior marker reused")
		}
		return ctx, func() error { calls++; return nil }, nil
	}}}
	prior, closePrior := requestctx.WithWindowReadDecision(context.Background())
	defer closePrior()
	scoped, finish, err := s.BeginWindowReadDecision(prior)
	if err != nil {
		t.Fatal(err)
	}
	if !requestctx.WindowReadDecisionActive(scoped) {
		t.Fatal("trusted phase missing")
	}
	if err := finish(); err != nil {
		t.Fatal(err)
	}
	_ = finish()
	if calls != 1 || requestctx.WindowReadDecisionActive(scoped) {
		t.Fatal("finish failed to close phase exactly once")
	}
}
