package artifactcohort

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
)

func validateRetained(_ context.Context, value *Artifact) error {
	return ValidateArtifact(value)
}

func TestPublisherRetainBatchDoesNotAdvanceFollowOrGeneration(t *testing.T) {
	ctx := context.Background()
	p := NewPublisher()
	first, _, err := p.Publish(ctx, RootRef{URI: "window://studio/connectors", Kind: "window", Version: 1}, json.RawMessage(`{"body":"first"}`), allowPublished)
	if err != nil {
		t.Fatal(err)
	}
	policies, cohorts := cohortFixture()
	baseline, err := p.ReplaceCatalog(ctx, policies, cohorts, p.Generation())
	if err != nil {
		t.Fatal(err)
	}
	retained, err := p.RetainBatch(ctx, []*Artifact{
		{Root: RootRef{URI: first.Root.URI, Kind: "window", Version: 2}, Payload: json.RawMessage(` { "body":"second" } `)},
		{Root: RootRef{URI: "window://studio/other", Kind: "window", Version: 1}, Payload: json.RawMessage(`{"body":"other"}`)},
	}, validateRetained)
	if err != nil || len(retained) != 2 {
		t.Fatalf("retain: %v", err)
	}
	if p.Generation() != baseline.Generation {
		t.Fatal("retain advanced generation")
	}
	unchanged, err := p.Snapshot()
	if err != nil || unchanged.Hash != baseline.Hash || unchanged.Cohorts[0].Roots[0] != first.Root {
		t.Fatalf("retain exposed release early: %+v %v", unchanged, err)
	}
	if _, err = p.Get(retained[0].Root); err != nil {
		t.Fatalf("exact retained version unavailable: %v", err)
	}
	follow, err := p.ReplaceCatalog(ctx, policies, cohorts, p.Generation())
	if err != nil || follow.Cohorts[0].Roots[0] != first.Root {
		t.Fatalf("retained bytes advanced follow selection: %+v %v", follow, err)
	}
	cohorts[0].Roots[0] = retained[0].Root
	selected, err := p.ReplaceCatalog(ctx, policies, cohorts, p.Generation())
	if err != nil || selected.Cohorts[0].Roots[0] != retained[0].Root {
		t.Fatalf("exact release activation: %+v %v", selected, err)
	}
	retained[0].Payload[0] = 'X'
	stored, err := p.Get(selected.Cohorts[0].Roots[0])
	if err != nil || !json.Valid(stored.Payload) {
		t.Fatalf("caller changed retained bytes: %v", err)
	}
}

func TestPublisherRetainBatchAtomicFailureAndImmutableConflict(t *testing.T) {
	ctx := context.Background()
	p := NewPublisher()
	valid := &Artifact{Root: RootRef{URI: "window://studio/a", Kind: "window", Version: 1}, Payload: json.RawMessage(`{"value":1}`)}
	invalid := &Artifact{Root: RootRef{URI: "window://studio/b", Kind: "window", Version: 1}, Payload: json.RawMessage(`{"value":2}`)}
	_, err := p.RetainBatch(ctx, []*Artifact{valid, invalid}, func(_ context.Context, a *Artifact) error {
		if a.Root.URI == invalid.Root.URI {
			return ErrInvalid
		}
		return nil
	})
	if !errors.Is(err, ErrInvalid) {
		t.Fatalf("validator failure: %v", err)
	}
	if p.Generation() != 0 {
		t.Fatal("failed retain advanced generation")
	}
	if _, err = p.Get(RootRef{URI: valid.Root.URI, Kind: valid.Root.Kind, Version: 1, Hash: Hash(valid.Payload)}); !errors.Is(err, ErrUnavailable) {
		t.Fatalf("partial retain: %v", err)
	}
	stored, err := p.RetainBatch(ctx, []*Artifact{valid}, validateRetained)
	if err != nil {
		t.Fatal(err)
	}
	_, err = p.RetainBatch(ctx, []*Artifact{valid, {Root: stored[0].Root, Payload: json.RawMessage(`{"value":99}`)}}, validateRetained)
	if !errors.Is(err, ErrInvalid) {
		t.Fatalf("supplied hash mismatch: %v", err)
	}
	_, err = p.RetainBatch(ctx, []*Artifact{valid, {Root: RootRef{URI: valid.Root.URI, Kind: "window", Version: 1}, Payload: json.RawMessage(`{"value":99}`)}}, validateRetained)
	if !errors.Is(err, ErrConflict) {
		t.Fatalf("same-version changed bytes: %v", err)
	}
	_, err = p.RetainBatch(ctx, []*Artifact{{Root: RootRef{URI: valid.Root.URI, Kind: "window", Version: 2}, Payload: json.RawMessage(`{"value":2}`)}}, validateRetained)
	if err != nil {
		t.Fatal(err)
	}
	if p.Generation() != 0 {
		t.Fatal("retained roots changed generation")
	}
}

func TestPublisherPublishPromotesPreviouslyRetainedVersionOnce(t *testing.T) {
	ctx := context.Background()
	p := NewPublisher()
	first, _, err := p.Publish(ctx, RootRef{URI: "window://studio/connectors", Kind: "window", Version: 1}, json.RawMessage(`{"value":1}`), allowPublished)
	if err != nil {
		t.Fatal(err)
	}
	policies, cohorts := cohortFixture()
	before, err := p.ReplaceCatalog(ctx, policies, cohorts, p.Generation())
	if err != nil {
		t.Fatal(err)
	}
	second, err := p.RetainBatch(ctx, []*Artifact{{Root: RootRef{URI: first.Root.URI, Kind: first.Root.Kind, Version: 2}, Payload: json.RawMessage(`{"value":2}`)}}, validateRetained)
	if err != nil {
		t.Fatal(err)
	}
	published, generation, err := p.Publish(ctx, second[0].Root, second[0].Payload, allowPublished)
	if err != nil || published.Root != second[0].Root || generation != before.Generation+1 {
		t.Fatalf("promote retained: %+v %d %v", published, generation, err)
	}
	after, err := p.Snapshot()
	if err != nil || after.Cohorts[0].Roots[0] != second[0].Root || after.Hash == before.Hash {
		t.Fatalf("follow not advanced: %+v %v", after, err)
	}
	_, repeatedGeneration, err := p.Publish(ctx, second[0].Root, second[0].Payload, allowPublished)
	if err != nil || repeatedGeneration != generation {
		t.Fatalf("repeat publish changed generation: %d %v", repeatedGeneration, err)
	}
}

func TestPublisherRetainBatchCancellationAndBatchConflictAreAtomic(t *testing.T) {
	p := NewPublisher()
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	item := &Artifact{Root: RootRef{URI: "window://studio/a", Kind: "window", Version: 1}, Payload: json.RawMessage(`{"value":1}`)}
	if _, err := p.RetainBatch(ctx, []*Artifact{item}, validateRetained); !errors.Is(err, ErrInvalid) {
		t.Fatalf("canceled retain: %v", err)
	}
	if _, err := p.RetainBatch(context.Background(), []*Artifact{item, {Root: item.Root, Payload: json.RawMessage(`{"value":2}`)}}, validateRetained); !errors.Is(err, ErrConflict) {
		t.Fatalf("duplicate version changed bytes: %v", err)
	}
	if _, err := p.Get(RootRef{URI: item.Root.URI, Kind: item.Root.Kind, Version: item.Root.Version, Hash: Hash(item.Payload)}); !errors.Is(err, ErrUnavailable) {
		t.Fatalf("partial retain after conflict: %v", err)
	}
}
