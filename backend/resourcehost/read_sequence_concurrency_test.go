package resource

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestConcurrentDispatchWaitsForPhaseTransitionAndOverlapsCalls(t *testing.T) {
	g, _, _, _ := readSequenceFixture(t)
	ctx, finish, err := g.BeginReadSequence(context.Background(), nil)
	require.NoError(t, err)
	s := sequenceFromContext(ctx)
	entered, release := make(chan struct{}), make(chan struct{})
	s.finishFacts = func() error { close(entered); <-release; return nil }
	first, second := make(chan error, 1), make(chan error, 1)
	go func() { first <- s.BeforeDispatch(ctx) }()
	select {
	case <-entered:
	case <-time.After(5 * time.Second):
		t.Fatal("transition did not start")
	}
	go func() { second <- s.BeforeDispatch(ctx) }()
	select {
	case err := <-second:
		close(release)
		t.Fatalf("parallel dispatch escaped the in-flight transition: %v", err)
	case <-time.After(20 * time.Millisecond):
	}
	close(release)
	require.NoError(t, <-first)
	require.NoError(t, <-second)
	s.mu.Lock()
	depth := s.dispatchDepth
	s.mu.Unlock()
	require.Equal(t, 2, depth, "both producer calls must be allowed to remain in flight")
	require.NoError(t, s.AfterDispatch(ctx))
	require.NoError(t, s.AfterDispatch(ctx))
	require.NoError(t, finish())
	require.Error(t, s.BeforeDispatch(ctx), "closed operation cannot be reused")
}
