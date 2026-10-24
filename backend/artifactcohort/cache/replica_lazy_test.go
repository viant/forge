package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"sync/atomic"
	"testing"
	"time"

	"github.com/viant/authz"
	"github.com/viant/forge/backend/artifactcohort"
)

type lazyCaller struct {
	publisher        *artifactcohort.Publisher
	fetches, compact atomic.Int32
}

func (c *lazyCaller) Discover(context.Context) (artifactcohort.Manifest, error) {
	return c.publisher.Snapshot()
}
func (c *lazyCaller) DiscoverKnown(_ context.Context, known string) (artifactcohort.Manifest, error) {
	m, e := c.publisher.Snapshot()
	if e != nil {
		return m, e
	}
	if m.Hash == known {
		c.compact.Add(1)
		return artifactcohort.Manifest{Unchanged: true, Hash: known}, nil
	}
	return m, nil
}
func (c *lazyCaller) Fetch(_ context.Context, in artifactcohort.FetchInput) (*artifactcohort.Artifact, error) {
	c.fetches.Add(1)
	return c.publisher.Get(in.Root)
}

type lazyFacts struct{}

func (lazyFacts) Resolve(context.Context) (authz.Facts, error) {
	return authz.Facts{Subject: "alice", Tenant: "tenant", Issuer: "verified", Roles: []string{"operator"}, ValidUntil: time.Now().Add(time.Hour)}, nil
}

type lazyManifestStore struct{ value artifactcohort.Manifest }

func (m *lazyManifestStore) Load(context.Context, string, string, string) (artifactcohort.Manifest, error) {
	return artifactcohort.CloneManifest(m.value)
}
func (m *lazyManifestStore) Save(_ context.Context, _, _, _ string, value artifactcohort.Manifest) error {
	var e error
	m.value, e = artifactcohort.CloneManifest(value)
	return e
}

func TestReplicaPreloadKeepsRefsOnlyAndRestartHydratesOnUse(t *testing.T) {
	ctx := context.Background()
	p := artifactcohort.NewPublisher()
	validate := func(_ context.Context, raw json.RawMessage) error {
		if !json.Valid(raw) {
			return artifactcohort.ErrInvalid
		}
		return nil
	}
	for _, root := range []artifactcohort.RootRef{{URI: "window://studio/connectors", Kind: "window", Version: 1}, {URI: "intent://studio/help", Kind: "intent", Version: 1}} {
		if _, _, e := p.Publish(ctx, root, json.RawMessage(`{"closed":true}`), validate); e != nil {
			t.Fatal(e)
		}
	}
	policy := authz.Resource{Kind: "cohort", ID: "operators", Version: "logical", Tenant: "tenant"}
	policies := []authz.Document{{Resource: policy, Revision: 1, Policies: map[string]authz.Policy{artifactcohort.PolicyAction: {Mode: "protected", Rule: &authz.Rule{Kind: "role", Value: "operator"}}}}}
	cohorts := []artifactcohort.Cohort{{Tenant: "tenant", Name: "operators", PolicyResource: policy, Roots: []artifactcohort.RootRef{{URI: "window://studio/connectors", Kind: "window"}, {URI: "intent://studio/help", Kind: "intent"}}}}
	if _, e := p.ReplaceCatalog(ctx, policies, cohorts, p.Generation()); e != nil {
		t.Fatal(e)
	}
	caller := &lazyCaller{publisher: p}
	backing := NewMemoryBacking()
	index := &lazyManifestStore{}
	newStore := func() *Store {
		s, e := New(Config{SizeMB: 1, MaxEntries: 8, MaxEntryBytes: 16 * 1024, Backing: backing})
		if e != nil {
			t.Fatal(e)
		}
		return s
	}
	makeReplica := func(s *Store) *artifactcohort.Replica {
		r, e := artifactcohort.NewReplica(artifactcohort.Config{Enabled: true, Source: "studio", Tenant: "tenant", Account: "acct", Caller: caller, Facts: lazyFacts{}, SessionKey: func(context.Context) (string, error) { return "alice", nil }, Store: s, ManifestStore: index, MaxFetchConcurrent: 1})
		if e != nil {
			t.Fatal(e)
		}
		if e = r.Sync(ctx); e != nil {
			t.Fatal(e)
		}
		if e = r.Admit(ctx); e != nil {
			t.Fatal(e)
		}
		return r
	}
	firstStore := newStore()
	first := makeReplica(firstStore)
	if firstStore.Hydrations() != 0 || caller.fetches.Load() != 1 {
		t.Fatalf("preload hydrated or fetched incorrectly: %d/%d", firstStore.Hydrations(), caller.fetches.Load())
	}
	if _, e := first.Open(ctx, "window://studio/connectors"); e != nil {
		t.Fatal(e)
	}
	if firstStore.Hydrations() != 1 {
		t.Fatalf("first open did not hydrate exactly once: %d", firstStore.Hydrations())
	}
	if _, e := first.Open(ctx, "window://studio/connectors"); e != nil {
		t.Fatal(e)
	}
	if firstStore.Hydrations() != 1 {
		t.Fatal("repeat open hydrated again")
	}
	_ = firstStore.Close()
	secondStore := newStore()
	defer secondStore.Close()
	second := makeReplica(secondStore)
	if caller.compact.Load() != 1 || caller.fetches.Load() != 1 || secondStore.Hydrations() != 0 {
		t.Fatalf("restart missed compact hash/cache: compact=%d fetches=%d hydrations=%d", caller.compact.Load(), caller.fetches.Load(), secondStore.Hydrations())
	}
	if _, e := second.Open(ctx, "window://studio/connectors"); e != nil {
		t.Fatal(e)
	}
	if secondStore.Hydrations() != 1 {
		t.Fatal("restarted first open did not hydrate")
	}
	for i := 0; i < 60; i++ {
		payload := []byte(fmt.Sprintf(`{"rotation":%d}`, i))
		ref := artifactcohort.RootRef{URI: fmt.Sprintf("window://studio/rotation-%d", i), Kind: "window", Version: 1, Hash: artifactcohort.Hash(payload)}
		if e := secondStore.Put(ctx, &artifactcohort.Artifact{Root: ref, Payload: payload}); e != nil {
			t.Fatal(e)
		}
		if _, e := secondStore.Get(ctx, ref); e != nil {
			t.Fatal(e)
		}
	}
	before := secondStore.Hydrations()
	if _, e := second.Open(ctx, "window://studio/connectors"); e != nil {
		t.Fatal(e)
	}
	if secondStore.Hydrations() <= before || caller.fetches.Load() != 1 {
		t.Fatalf("rotation did not rehydrate from backing without MCP: hydration=%d/%d fetch=%d", before, secondStore.Hydrations(), caller.fetches.Load())
	}
}
