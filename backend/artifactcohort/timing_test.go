package artifactcohort

import (
	"context"
	"errors"
	"strings"
	"sync"
	"testing"

	"github.com/viant/forge/backend/provider/contract/observe"
)

type timingStore struct {
	mu     sync.Mutex
	values map[RootRef]*Artifact
}

func (s *timingStore) Has(_ context.Context, ref RootRef) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	_, ok := s.values[ref]
	return ok, nil
}
func (s *timingStore) Put(_ context.Context, a *Artifact) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.values[a.Root] = CloneArtifact(a)
	return nil
}
func (s *timingStore) Get(_ context.Context, ref RootRef) (*Artifact, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return CloneArtifact(s.values[ref]), nil
}

type timingManifest struct{ value Manifest }

func (s *timingManifest) Load(context.Context, string, string, string) (Manifest, error) {
	return Manifest{}, ErrUnavailable
}
func (s *timingManifest) Save(_ context.Context, _, _, _ string, v Manifest) error {
	s.value = v
	return nil
}

func TestArtifactTimingPhasesAreNumericAndIdentityFree(t *testing.T) {
	p := fixturePublisher(t, `{"window":"closed"}`)
	caller := &fakeCaller{publisher: p, fetches: map[string]int{}}
	store := &timingStore{values: map[RootRef]*Artifact{}}
	r, err := NewReplica(Config{Enabled: true, Source: "configured-studio", Tenant: "tenant", Account: "account", Caller: caller, Facts: fixtureFacts{}, SessionKey: fixtureSession, Store: store, ManifestStore: &timingManifest{}})
	if err != nil {
		t.Fatal(err)
	}
	var mu sync.Mutex
	events := []observe.Event{}
	observer := observe.ObserverFunc(func(e observe.Event) { mu.Lock(); events = append(events, e); mu.Unlock() })
	actor := actorContext("secret-user", "operator")
	ctx := observe.WithObserver(actor, observer)
	if err = r.Sync(ctx); err != nil {
		t.Fatal(err)
	}
	if err = r.Admit(ctx); err != nil {
		t.Fatal(err)
	}
	if _, err = r.Open(ctx, "window://sales/main"); err != nil {
		t.Fatal(err)
	}
	if err = r.Sync(ctx); err != nil {
		t.Fatal(err)
	}
	want := []observe.Phase{phaseSyncTotal, phaseManifestLoad, phaseDiscovery, phasePolicyCompile, phaseStoreHas, phaseArtifactFetch, phaseStorePut, phasePartitionStage, phasePartitionActivate, phaseManifestSave, phaseAdmit, phaseRootOpen, phaseStoreGet}
	counts := map[observe.Phase]int{}
	for _, e := range events {
		counts[e.Phase]++
		if e.Duration < 0 || strings.Contains(e.Provider, "secret-user") || strings.Contains(e.Namespace, "sales") || strings.Contains(e.Kind, "secret") {
			t.Fatalf("unsafe timing event: %+v", e)
		}
		if e.Phase == phaseArtifactFetch && (e.Bytes <= 0 || e.Cache != observe.CacheMiss) {
			t.Fatalf("fetch bytes missing: %+v", e)
		}
	}
	for _, phase := range want {
		if counts[phase] == 0 {
			t.Fatalf("missing phase %s: %+v", phase, counts)
		}
	}
	if counts[phaseArtifactFetch] != 3 || counts[phaseStoreHas] != 3 || caller.compact != 1 {
		t.Fatalf("unexpected hidden reads: phases=%+v compact=%d", counts, caller.compact)
	}
	if _, err := r.Open(context.Background(), "window://sales/main"); !errors.Is(err, ErrDenied) {
		t.Fatalf("unverified context opened: %v", err)
	}
}
