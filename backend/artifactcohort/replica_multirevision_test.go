package artifactcohort

import (
	"context"
	"encoding/json"
	"errors"
	"sync/atomic"
	"testing"
	"time"

	"github.com/viant/authz"
	"github.com/viant/forge/backend/types"
)

type cohortSelectorKey struct{}
type countedArtifactStore struct {
	timingStore
	gets atomic.Int32
}

func (s *countedArtifactStore) Get(ctx context.Context, ref RootRef) (*Artifact, error) {
	s.gets.Add(1)
	return s.timingStore.Get(ctx, ref)
}
func revisionActor(session string, roles ...string) context.Context {
	facts := authz.Facts{Subject: session, Tenant: "tenant", Issuer: "verified", Roles: roles, ValidUntil: time.Now().Add(time.Hour)}
	return context.WithValue(context.WithValue(context.Background(), replicaActorKey{}, facts), replicaSessionKey{}, session)
}
func selectCohort(ctx context.Context, name string) context.Context {
	return context.WithValue(ctx, cohortSelectorKey{}, name)
}
func revisionWindow(t *testing.T, name string) json.RawMessage {
	t.Helper()
	variant := types.WindowResourceVariant{Window: &types.Window{WindowKey: name, View: types.View{Content: &types.Container{ID: "root"}}}}
	fingerprint, err := types.WindowVariantFingerprint(variant)
	if err != nil {
		t.Fatal(err)
	}
	envelope := types.WindowResourceEnvelope{SchemaVersion: 2, Format: types.WindowBundleFormat, Targets: []types.WindowTargetBinding{{Variant: fingerprint}}, Variants: map[string]types.WindowResourceVariant{fingerprint: variant}}
	raw, err := json.Marshal(envelope)
	if err != nil {
		t.Fatal(err)
	}
	return raw
}
func multiRevisionPublisher(t *testing.T) (*Publisher, RootRef, RootRef) {
	t.Helper()
	p := NewPublisher()
	first, _, err := p.Publish(context.Background(), RootRef{URI: "window://sales/main", Kind: "window", Version: 3}, revisionWindow(t, "v3"), allowPublished)
	if err != nil {
		t.Fatal(err)
	}
	second, _, err := p.Publish(context.Background(), RootRef{URI: "window://sales/main", Kind: "window", Version: 4}, revisionWindow(t, "v4"), allowPublished)
	if err != nil {
		t.Fatal(err)
	}
	policies, cohorts := replicaRevisionCatalog(first.Root, second.Root)
	if _, err := p.ReplaceCatalog(context.Background(), policies, cohorts, p.Generation()); err != nil {
		t.Fatal(err)
	}
	return p, first.Root, second.Root
}
func replicaRevisionCatalog(v3, v4 RootRef) ([]authz.Document, []Cohort) {
	resources := []authz.Resource{{Kind: "cohort", ID: "older", Version: "logical", Tenant: "tenant"}, {Kind: "cohort", ID: "newer", Version: "logical", Tenant: "tenant"}}
	policies := []authz.Document{{Resource: resources[0], Revision: 1, Policies: map[string]authz.Policy{PolicyAction: {Mode: "protected", Rule: &authz.Rule{Kind: "role", Value: "older"}}}}, {Resource: resources[1], Revision: 1, Policies: map[string]authz.Policy{PolicyAction: {Mode: "protected", Rule: &authz.Rule{Kind: "role", Value: "newer"}}}}}
	cohorts := []Cohort{{Tenant: "tenant", Name: "older", PolicyResource: resources[0], Roots: []RootRef{v3}}, {Tenant: "tenant", Name: "newer", PolicyResource: resources[1], Roots: []RootRef{v4}}}
	return policies, cohorts
}

func TestReplicaTwoCohortRevisionsSelectionAndSwap(t *testing.T) {
	p, v3, v4 := multiRevisionPublisher(t)
	caller := &fakeCaller{publisher: p, fetches: map[string]int{}}
	alice := revisionActor("alice", "older")
	bob := revisionActor("bob", "newer")
	both := revisionActor("both", "older", "newer")
	plain, err := NewReplica(Config{Enabled: true, Source: "studio", Tenant: "tenant", Account: "acct", Caller: caller, Facts: fixtureFacts{}, SessionKey: fixtureSession})
	if err != nil {
		t.Fatal(err)
	}
	if err = plain.Sync(alice); err != nil {
		t.Fatal(err)
	}
	for _, actor := range []context.Context{alice, bob, both} {
		if err = plain.Admit(actor); err != nil {
			t.Fatal(err)
		}
	}
	if caller.count(v3.URI) != 2 {
		t.Fatalf("both immutable revisions not fetched: %d", caller.count(v3.URI))
	}
	for _, tc := range []struct {
		actor context.Context
		want  RootRef
	}{{alice, v3}, {bob, v4}} {
		view, e := plain.Open(tc.actor, v3.URI)
		if e != nil || view.Ref() != tc.want {
			t.Fatalf("role revision: %+v %v", view, e)
		}
	}
	if _, err = plain.Open(both, v3.URI); !errors.Is(err, ErrConflict) {
		t.Fatalf("ambiguous union opened: %v", err)
	}
	if _, err = plain.PermittedRoots(both); !errors.Is(err, ErrConflict) {
		t.Fatalf("ambiguous list returned: %v", err)
	}
	priorFetches := caller.count(v3.URI)
	store := &countedArtifactStore{timingStore: timingStore{values: map[RootRef]*Artifact{}}}
	var selections atomic.Int32
	selected, err := NewReplica(Config{Enabled: true, Source: "studio", Tenant: "tenant", Account: "acct-selected", Caller: caller, Facts: fixtureFacts{}, SessionKey: fixtureSession, Store: store, Cohort: func(ctx context.Context) (string, error) {
		selections.Add(1)
		value, _ := ctx.Value(cohortSelectorKey{}).(string)
		if value == "" {
			return "", ErrDenied
		}
		return value, nil
	}})
	if err != nil {
		t.Fatal(err)
	}
	if err = selected.Sync(alice); err != nil {
		t.Fatal(err)
	}
	for _, actor := range []context.Context{alice, bob, both} {
		if err = selected.Admit(actor); err != nil {
			t.Fatal(err)
		}
	}
	if store.gets.Load() != 0 {
		t.Fatal("sync eagerly hydrated published bodies")
	}
	for _, state := range selected.partitions {
		if len(state.artifacts) != 0 {
			t.Fatal("store-backed replica retained raw artifact")
		}
	}
	for _, tc := range []struct {
		actor  context.Context
		cohort string
		want   RootRef
	}{{alice, "older", v3}, {bob, "newer", v4}, {both, "older", v3}, {both, "newer", v4}} {
		before := selections.Load()
		view, e := selected.Open(selectCohort(tc.actor, tc.cohort), v3.URI)
		if e != nil || view.Ref() != tc.want || selections.Load() != before+1 {
			t.Fatalf("selected revision or single selector: %+v %v count=%d", view, e, selections.Load()-before)
		}
		selectedWindow, hash, e := selected.OpenWindowVariant(selectCohort(tc.actor, tc.cohort), v3.URI, nil)
		wantKey := "v3"
		if tc.want == v4 {
			wantKey = "v4"
		}
		if e != nil || selectedWindow == nil || selectedWindow.Window == nil || selectedWindow.Window.WindowKey != wantKey || hash != tc.want.Hash {
			t.Fatalf("selected schema-2 window: %+v %s %v", selectedWindow, hash, e)
		}
	}
	if _, err = selected.Open(selectCohort(alice, "newer"), v3.URI); !errors.Is(err, ErrDenied) {
		t.Fatalf("unauthorized cohort selected: %v", err)
	}
	if roots, e := selected.PermittedRoots(selectCohort(both, "older")); e != nil || len(roots) != 1 || roots[0] != v3 {
		t.Fatalf("selected root list: %v %v", roots, e)
	}
	before, err := p.Snapshot()
	if err != nil {
		t.Fatal(err)
	}
	policies, swapped := replicaRevisionCatalog(v4, v3)
	if _, err = p.ReplaceCatalog(context.Background(), policies, swapped, p.Generation()); err != nil {
		t.Fatal(err)
	}
	after, err := p.Snapshot()
	if err != nil {
		t.Fatal(err)
	}
	partition, _ := RootPartition(v3)
	if before.PartitionHashes[partition] == after.PartitionHashes[partition] {
		t.Fatal("cohort assignment swap left partition hash unchanged")
	}
	if err = selected.Sync(alice); err != nil {
		t.Fatal(err)
	}
	if caller.count(v3.URI) != priorFetches+2 {
		t.Fatalf("store sync unexpectedly re-fetched pinned bytes: before=%d after=%d", priorFetches, caller.count(v3.URI))
	}
	// The new replica's first sync fetched two revisions; swap reused those exact
	// hashes from the immutable store, so no further producer fetch is expected.
	if view, e := selected.Open(selectCohort(alice, "older"), v3.URI); e != nil || view.Ref() != v4 {
		t.Fatalf("older assignment did not switch to v4: %+v %v", view, e)
	}
	if view, e := selected.Open(selectCohort(bob, "newer"), v3.URI); e != nil || view.Ref() != v3 {
		t.Fatalf("newer assignment did not switch to v3: %+v %v", view, e)
	}
}
