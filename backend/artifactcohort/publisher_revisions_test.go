package artifactcohort

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/viant/authz"
)

func revisionCatalog() ([]authz.Document, []Cohort) {
	policy := func(name, role string) authz.Document {
		return authz.Document{Resource: authz.Resource{Tenant: "tenant", Kind: "cohort", ID: name, Version: "logical"}, Revision: 1, Policies: map[string]authz.Policy{PolicyAction: {Mode: "protected", Rule: &authz.Rule{Kind: "role", Value: role}}}}
	}
	pinned, following := policy("pinned", "reader"), policy("following", "editor")
	uri := "window://studio/shared"
	return []authz.Document{pinned, following}, []Cohort{
		{Tenant: "tenant", Name: "pinned", PolicyResource: pinned.Resource, Roots: []RootRef{{URI: uri, Kind: "window", Version: 1}}},
		{Tenant: "tenant", Name: "following", PolicyResource: following.Resource, Roots: []RootRef{{URI: uri, Kind: "window"}}},
	}
}

func TestPublisherPinsExactRevisionAndFollowsOnlySelectedCohort(t *testing.T) {
	ctx := context.Background()
	p := NewPublisher()
	uri := "window://studio/shared"
	publish := func(version uint64, body string) *Artifact {
		value, _, err := p.Publish(ctx, RootRef{URI: uri, Kind: "window", Version: version}, json.RawMessage(body), allowPublished)
		if err != nil {
			t.Fatal(err)
		}
		return value
	}
	v2 := publish(2, `{"version":2}`)
	missingPolicies, missingCohorts := revisionCatalog()
	if _, err := p.ReplaceCatalog(ctx, missingPolicies, missingCohorts, p.Generation()); !errors.Is(err, ErrUnavailable) {
		t.Fatalf("missing pinned revision accepted: %v", err)
	}
	v1 := publish(1, `{"version":1}`) // historical hydration after latest
	policies, cohorts := revisionCatalog()
	manifest, err := p.ReplaceCatalog(ctx, policies, cohorts, p.Generation())
	if err != nil {
		t.Fatal(err)
	}
	if err = ValidateManifest(manifest); err != nil {
		t.Fatal(err)
	}
	if got := manifest.Cohorts[0].Roots[0]; got != v2.Root {
		t.Fatalf("follow did not select latest: %+v", got)
	}
	if len(manifest.Cohorts[0].FollowPublished) != 1 || manifest.Cohorts[0].FollowPublished[0] != uri {
		t.Fatal("follow selector lost")
	}
	if got := manifest.Cohorts[1].Roots[0]; got != v1.Root || len(manifest.Cohorts[1].FollowPublished) != 0 {
		t.Fatalf("pin changed to latest: %+v", got)
	}
	if RootKey(v1.Root) == RootKey(v2.Root) {
		t.Fatal("version key collision")
	}
	for _, want := range []*Artifact{v1, v2} {
		got, e := p.Get(want.Root)
		if e != nil || string(got.Payload) != string(want.Payload) {
			t.Fatalf("historical Get: %+v %v", got, e)
		}
	}
	beforePartition := manifest.PartitionHashes[PartitionKey("studio", "window")]
	v3 := publish(3, `{"version":3}`)
	advanced, _ := p.Snapshot()
	if advanced.Cohorts[0].Roots[0] != v3.Root || advanced.Cohorts[1].Roots[0] != v1.Root {
		t.Fatal("pin/follow advance incorrect")
	}
	if advanced.PartitionHashes[PartitionKey("studio", "window")] == beforePartition {
		t.Fatal("revision advance did not change partition hash")
	}
	if _, err = p.Get(v2.Root); err != nil {
		t.Fatalf("former head not retained: %v", err)
	}
	// A snapshot replacement preserves the follow marker despite its now-filled Version.
	replaced, err := p.ReplaceCatalog(ctx, advanced.Policies, advanced.Cohorts, p.Generation())
	if err != nil || replaced.Hash != advanced.Hash || len(replaced.Cohorts[0].FollowPublished) != 1 {
		t.Fatalf("snapshot replacement lost selector: %v", err)
	}
	if _, _, err = p.Publish(ctx, RootRef{URI: uri, Kind: "window", Version: 1}, json.RawMessage(`{"different":true}`), allowPublished); !errors.Is(err, ErrConflict) {
		t.Fatalf("same-version overwrite: %v", err)
	}
	if _, _, err = p.Publish(ctx, RootRef{URI: uri, Kind: "window", Version: 1}, v1.Payload, allowPublished); err != nil {
		t.Fatalf("exact historical replay: %v", err)
	}
}

func TestPartitionHashIncludesCohortRevisionMapping(t *testing.T) {
	p := NewPublisher()
	ctx := context.Background()
	uri := "window://studio/shared"
	a, _, _ := p.Publish(ctx, RootRef{URI: uri, Kind: "window", Version: 1}, json.RawMessage(`{"v":1}`), allowPublished)
	b, _, _ := p.Publish(ctx, RootRef{URI: uri, Kind: "window", Version: 2}, json.RawMessage(`{"v":2}`), allowPublished)
	policies, cohorts := revisionCatalog()
	base, err := p.ReplaceCatalog(ctx, policies, cohorts, p.Generation())
	if err != nil {
		t.Fatal(err)
	}
	swapped, _ := CloneManifest(base)
	swapped.Cohorts[0].Roots[0], swapped.Cohorts[1].Roots[0] = a.Root, b.Root
	swapped.Cohorts[0].Hash = CohortHash(swapped.Cohorts[0])
	swapped.Cohorts[1].Hash = CohortHash(swapped.Cohorts[1])
	FillPartitionHashes(&swapped)
	swapped.Hash = ManifestHash(swapped)
	if err := ValidateManifest(swapped); err != nil {
		t.Fatal(err)
	}
	if base.PartitionHashes[PartitionKey("studio", "window")] == swapped.PartitionHashes[PartitionKey("studio", "window")] {
		t.Fatal("cohort revision swap was invisible")
	}
	pinnedCurrent, _ := CloneManifest(base)
	pinnedCurrent.Cohorts[0].FollowPublished = nil
	pinnedCurrent.Cohorts[0].Hash = CohortHash(pinnedCurrent.Cohorts[0])
	FillPartitionHashes(&pinnedCurrent)
	pinnedCurrent.Hash = ManifestHash(pinnedCurrent)
	if err := ValidateManifest(pinnedCurrent); err != nil {
		t.Fatal(err)
	}
	if pinnedCurrent.PartitionHashes[PartitionKey("studio", "window")] == base.PartitionHashes[PartitionKey("studio", "window")] {
		t.Fatal("follow-to-pin selector change was invisible")
	}
	invalid, _ := CloneManifest(base)
	invalid.Cohorts[1].Roots[0] = invalid.Cohorts[0].Roots[0]
	invalid.Cohorts[1].Roots[0].Hash = Hash([]byte("mismatch"))
	invalid.Cohorts[1].Hash = CohortHash(invalid.Cohorts[1])
	FillPartitionHashes(&invalid)
	invalid.Hash = ManifestHash(invalid)
	if !errors.Is(ValidateManifest(invalid), ErrInvalid) {
		t.Fatal("same URI/version conflicting hash accepted")
	}
}

func TestUnselectedPublishedRevisionKeepsManifestContentHash(t *testing.T) {
	p := NewPublisher()
	ctx := context.Background()
	_, _, err := p.Publish(ctx, RootRef{URI: "window://studio/selected", Kind: "window", Version: 1}, json.RawMessage(`{"selected":true}`), allowPublished)
	if err != nil {
		t.Fatal(err)
	}
	policies, cohorts := cohortFixture()
	cohorts[0].Roots = []RootRef{{URI: "window://studio/selected", Kind: "window"}}
	before, err := p.ReplaceCatalog(ctx, policies, cohorts, p.Generation())
	if err != nil {
		t.Fatal(err)
	}
	_, _, err = p.Publish(ctx, RootRef{URI: "window://studio/unselected", Kind: "window", Version: 1}, json.RawMessage(`{"unselected":true}`), allowPublished)
	if err != nil {
		t.Fatal(err)
	}
	after, _ := p.Snapshot()
	if after.Hash != before.Hash || after.PartitionHashes[PartitionKey("studio", "window")] != before.PartitionHashes[PartitionKey("studio", "window")] {
		t.Fatal("unselected bytes changed advertised index")
	}
}
