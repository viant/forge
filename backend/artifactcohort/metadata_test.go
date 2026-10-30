package artifactcohort

import (
	"context"
	"encoding/json"
	"testing"
	"time"
)

// All definitions below are independent synthetic envelopes, not captures.
func TestMetadataSourceAllKindsStayLocalAndSelectOneHash(t *testing.T) {
	ctx := actorContext("alice", "operator")
	publisher := NewPublisher()
	roots := []RootRef{}
	// Navigation uses the separately fingerprinted GetMenu contract, covered by
	// metadata_menu_test.go; ordinary kinds retain exact source-byte delivery.
	kinds := []string{"window", "report", "mcp", "skill", "playbook", "toolfeed", "eval", "agent", "prompt"}
	for _, kind := range kinds {
		a, _, err := publisher.Publish(ctx, RootRef{URI: kind + "://example/sample", Kind: kind, Version: 7}, json.RawMessage(`{"schemaVersion":1,"title":"Synthetic fixture"}`), allowPublished)
		if err != nil {
			t.Fatal(err)
		}
		roots = append(roots, a.Root)
	}
	policies, cohorts := cohortFixture()
	cohorts[0].Roots = roots
	if _, err := publisher.ReplaceCatalog(ctx, policies, cohorts, publisher.Generation()); err != nil {
		t.Fatal(err)
	}
	caller := &fakeCaller{publisher: publisher, fetches: map[string]int{}}
	facts := &countedFacts{}
	replica, err := NewReplica(Config{Enabled: true, Source: "producer", Tenant: "tenant", Account: "account", Caller: caller, Facts: facts, SessionKey: fixtureSession})
	if err != nil {
		t.Fatal(err)
	}
	if err = replica.Sync(ctx); err != nil {
		t.Fatal(err)
	}
	source, err := NewMetadataSource(replica, []string{"example"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err = source.Namespaces(ctx); err != nil {
		t.Fatal(err)
	}
	policyCalls := facts.calls.Load()
	for round := 0; round < 10; round++ {
		for _, root := range roots {
			rows, err := source.List(ctx, root.Kind, "example")
			if err != nil || len(rows) != 1 {
				t.Fatalf("list %s: %v", root.Kind, err)
			}
			got, err := source.Get(ctx, root.URI)
			if err != nil {
				t.Fatal(err)
			}
			if got.Revision != "" || got.ContentFingerprint != root.Hash || Hash(got.DefinitionBytes) != root.Hash {
				t.Fatal("cohort hash changed or independent revision selected")
			}
			got.DefinitionBytes[0] = 'x'
		}
	}
	if caller.discovers != 1 || len(caller.fetches) != len(kinds) || facts.calls.Load() != policyCalls {
		t.Fatal("interactive metadata or policy work")
	}
	for _, count := range caller.fetches {
		if count != 1 {
			t.Fatal("repeated fetch")
		}
	}
	if _, err = source.Get(ctx, "report://example/missing"); err == nil {
		t.Fatal("missing accepted")
	}
	if _, err = source.Get(context.Background(), roots[0].URI); err == nil {
		t.Fatal("anonymous accepted")
	}
	if _, err = source.Get(actorContext("bob", "viewer"), roots[0].URI); err == nil {
		t.Fatal("foreign session accepted")
	}
	deniedCalls := facts.calls.Load()
	for i := 0; i < 10; i++ {
		if _, err = source.Get(actorContext("bob", "viewer"), roots[0].URI); err == nil {
			t.Fatal("denied admission accepted")
		}
	}
	if facts.calls.Load() != deniedCalls {
		t.Fatal("unchanged denied session reevaluated policy")
	}
	if _, err = source.Get(ctx, "report://foreign/sample"); err == nil {
		t.Fatal("unclaimed namespace accepted")
	}
	if caller.discovers != 1 {
		t.Fatal("metadata fallback")
	}
	before, err := source.AdmissionKey(ctx)
	if err != nil {
		t.Fatal(err)
	}
	root := roots[0]
	next, _, err := publisher.Publish(ctx, RootRef{URI: root.URI, Kind: root.Kind, Version: 8}, json.RawMessage(`{"schemaVersion":1,"title":"Updated synthetic fixture"}`), allowPublished)
	if err != nil {
		t.Fatal(err)
	}
	cohorts[0].Roots[0] = next.Root
	if _, err = publisher.ReplaceCatalog(ctx, policies, cohorts, publisher.Generation()); err != nil {
		t.Fatal(err)
	}
	if err = replica.Sync(ctx); err != nil {
		t.Fatal(err)
	}
	got, err := source.Get(ctx, root.URI)
	if err != nil || got.ContentFingerprint != next.Root.Hash {
		t.Fatalf("updated local selection: %v", err)
	}
	after, err := source.AdmissionKey(ctx)
	if err != nil || after == before {
		t.Fatal("selection generation did not change")
	}
	// The earlier denied foreign session performed one separate local join.
	if facts.calls.Load() != policyCalls+1 {
		t.Fatal("resource-only update reevaluated policy")
	}
}

func TestMetadataAdmissionUsesVerifiedFactsLease(t *testing.T) {
	ctx := actorContext("alice", "operator")
	publisher := NewPublisher()
	artifact, _, err := publisher.Publish(ctx, RootRef{URI: "window://studio/connectors", Kind: "window", Version: 1}, json.RawMessage(`{"schemaVersion":1}`), allowPublished)
	if err != nil {
		t.Fatal(err)
	}
	policies, cohorts := cohortFixture()
	cohorts[0].Roots = []RootRef{artifact.Root}
	if _, err = publisher.ReplaceCatalog(ctx, policies, cohorts, publisher.Generation()); err != nil {
		t.Fatal(err)
	}
	caller := &fakeCaller{publisher: publisher, fetches: map[string]int{}}
	facts := &countedFacts{}
	replica, err := NewReplica(Config{Enabled: true, Source: "producer", Tenant: "tenant", Account: "account", Caller: caller, Facts: facts, SessionKey: fixtureSession})
	if err != nil {
		t.Fatal(err)
	}
	if err = replica.Sync(ctx); err != nil {
		t.Fatal(err)
	}
	source, err := NewMetadataSource(replica, []string{"studio"})
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 10; i++ {
		if _, err = source.Get(ctx, artifact.Root.URI); err != nil {
			t.Fatal(err)
		}
	}
	if facts.calls.Load() != 1 {
		t.Fatal("repeated policy admission")
	}
	replica.mu.Lock()
	held := replica.admissions["alice"]
	held.validUntil = time.Now().Add(-time.Second)
	replica.admissions["alice"] = held
	replica.mu.Unlock()
	if _, err = replica.Open(ctx, artifact.Root.URI); err == nil {
		t.Fatal("expired admitted facts accepted")
	}
	if _, err = source.Get(ctx, artifact.Root.URI); err != nil {
		t.Fatal(err)
	}
	if facts.calls.Load() != 2 || caller.discovers != 1 || caller.fetches[artifact.Root.URI] != 1 {
		t.Fatal("facts refresh must not refetch artifact metadata")
	}
}
