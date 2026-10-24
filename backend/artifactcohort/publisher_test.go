package artifactcohort

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/viant/authz"
)

func allowPublished(_ context.Context, body json.RawMessage) error {
	if !json.Valid(body) {
		return ErrInvalid
	}
	return nil
}
func cohortFixture() ([]authz.Document, []Cohort) {
	resource := authz.Resource{Kind: "cohort", ID: "operators", Version: "logical", Tenant: "tenant"}
	doc := authz.Document{Resource: resource, Revision: 1, Policies: map[string]authz.Policy{PolicyAction: {Mode: "protected", Rule: &authz.Rule{Kind: "role", Value: "operator"}}}}
	return []authz.Document{doc}, []Cohort{{Tenant: "tenant", Name: "operators", PolicyResource: resource, Roots: []RootRef{{URI: "window://studio/connectors", Kind: "window"}}}}
}
func TestPublisherVersionPolicyAndClosedBytes(t *testing.T) {
	ctx := context.Background()
	p := NewPublisher()
	raw := json.RawMessage(`{"schemaVersion":2,"format":"window.bundle","body":"closed"}`)
	ref := RootRef{URI: "window://studio/connectors", Kind: "window", Version: 1}
	first, generation, err := p.Publish(ctx, ref, raw, allowPublished)
	if err != nil || generation != 1 || first.Root.Hash != Hash(raw) {
		t.Fatalf("publish: %+v %d %v", first, generation, err)
	}
	if _, _, err = p.Publish(ctx, RootRef{URI: ref.URI, Kind: ref.Kind, Version: 2}, json.RawMessage(`{"changed":true}`), func(context.Context, json.RawMessage) error { return ErrInvalid }); !errors.Is(err, ErrInvalid) {
		t.Fatalf("invalid candidate replaced active: %v", err)
	}
	if _, _, err = p.Publish(ctx, ref, json.RawMessage(`{"changed":true}`), allowPublished); !errors.Is(err, ErrConflict) {
		t.Fatalf("same version changed bytes accepted: %v", err)
	}
	if got, err := p.Get(first.Root); err != nil || string(got.Payload) != string(raw) {
		t.Fatal("old active changed", err)
	}
	policies, cohorts := cohortFixture()
	manifest, err := p.ReplaceCatalog(ctx, policies, cohorts, generation)
	if err != nil || manifest.Generation != 2 || manifest.Cohorts[0].Roots[0] != first.Root {
		t.Fatalf("catalog: %+v %v", manifest, err)
	}
	if _, err = p.ReplaceCatalog(ctx, policies, cohorts, generation); !errors.Is(err, ErrConflict) {
		t.Fatalf("stale CAS accepted: %v", err)
	}
	policies[0].Policies[PolicyAction] = authz.Policy{Mode: "protected", Rule: &authz.Rule{Kind: "role", Value: "viewer"}}
	updated, err := p.ReplaceCatalog(ctx, policies, cohorts, manifest.Generation)
	if err != nil || updated.Generation != 3 || updated.Hash == manifest.Hash {
		t.Fatalf("policy-only generation: %+v %v", updated, err)
	}
	nextRaw := json.RawMessage(`{"schemaVersion":2,"format":"window.bundle","body":"new"}`)
	next, nextGen, err := p.Publish(ctx, RootRef{URI: ref.URI, Kind: ref.Kind, Version: 2}, nextRaw, allowPublished)
	if err != nil || nextGen != 4 || next.Root.Version != 2 {
		t.Fatalf("new version: %+v %d %v", next, nextGen, err)
	}
	snapshot, err := p.Snapshot()
	if err != nil || snapshot.Cohorts[0].Roots[0] != next.Root || snapshot.Hash == updated.Hash {
		t.Fatalf("inconsistent snapshot: %+v %v", snapshot, err)
	}
	snapshot.Cohorts[0].Roots[0].Hash = "caller-mutated"
	again, _ := p.Snapshot()
	if again.Cohorts[0].Roots[0] != next.Root {
		t.Fatal("snapshot was not detached")
	}
	owned, _ := p.Get(next.Root)
	owned.Payload[0] = 'X'
	againArtifact, _ := p.Get(next.Root)
	if !json.Valid(againArtifact.Payload) {
		t.Fatal("caller mutated published bytes")
	}
}
func TestPublisherRejectsMissingCatalogRoot(t *testing.T) {
	p := NewPublisher()
	policies, cohorts := cohortFixture()
	if _, err := p.ReplaceCatalog(context.Background(), policies, cohorts, 0); !errors.Is(err, ErrUnavailable) {
		t.Fatalf("missing published root accepted: %v", err)
	}
	if p.Generation() != 0 {
		t.Fatal("failed catalog advanced generation")
	}
}
func TestPublisherCanonicalWireBytesRetainExactLargeInteger(t *testing.T) {
	p := NewPublisher()
	raw := json.RawMessage(" { \"html\":\"<tag>\", \"id\":9007199254740993 } ")
	a, _, err := p.Publish(context.Background(), RootRef{URI: "window://studio/precision", Kind: "window", Version: 1}, raw, allowPublished)
	if err != nil {
		t.Fatal(err)
	}
	wire, err := json.Marshal(a)
	if err != nil {
		t.Fatal(err)
	}
	var decoded Artifact
	if err = json.Unmarshal(wire, &decoded); err != nil {
		t.Fatal(err)
	}
	if err = ValidateArtifact(&decoded); err != nil {
		t.Fatalf("wire changed published hash: %v", err)
	}
	if string(decoded.Payload) != string(a.Payload) || !bytes.Contains(decoded.Payload, []byte("9007199254740993")) || !bytes.Contains(decoded.Payload, []byte(`\u003ctag\u003e`)) {
		t.Fatalf("canonical wire bytes lost exact content: %s", decoded.Payload)
	}
}
func TestManifestContentHashIgnoresPublicationGeneration(t *testing.T) {
	p := NewPublisher()
	ctx := context.Background()
	_, _, err := p.Publish(ctx, RootRef{URI: "window://studio/connectors", Kind: "window", Version: 1}, json.RawMessage(`{"window":"closed"}`), allowPublished)
	if err != nil {
		t.Fatal(err)
	}
	policies, cohorts := cohortFixture()
	first, err := p.ReplaceCatalog(ctx, policies, cohorts, p.Generation())
	if err != nil {
		t.Fatal(err)
	}
	second, err := p.ReplaceCatalog(ctx, policies, cohorts, p.Generation())
	if err != nil {
		t.Fatal(err)
	}
	if second.Generation <= first.Generation || second.Hash != first.Hash {
		t.Fatalf("identical content changed hash: %d/%d %q/%q", first.Generation, second.Generation, first.Hash, second.Hash)
	}
}
