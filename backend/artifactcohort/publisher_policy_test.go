package artifactcohort

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"testing"

	"github.com/viant/authz"
)

func TestPublisherCohortPoliciesReuseImmutableGeneration(t *testing.T) {
	ctx := context.Background()
	p := NewPublisher()
	if _, _, err := p.CohortPolicies("operators"); !errors.Is(err, ErrUnavailable) {
		t.Fatal(err)
	}
	if _, _, err := p.Publish(ctx, RootRef{URI: "window://studio/connectors", Kind: "window", Version: 1}, json.RawMessage(`{"title":"Example"}`), allowPublished); err != nil {
		t.Fatal(err)
	}
	docs, cohorts := cohortFixture()
	if _, err := p.ReplaceCatalog(ctx, docs, cohorts, p.Generation()); err != nil {
		t.Fatal(err)
	}
	refs, store, err := p.CohortPolicies("operators")
	if err != nil || len(refs) != 1 {
		t.Fatal(refs, err)
	}
	resource := refs[0]
	refs[0].ID = "caller-change"
	for range 10 {
		current, again, err := p.CohortPolicies("operators")
		if err != nil || again != store || current[0] != resource {
			t.Fatal(current, err)
		}
	}
	doc, err := store.Get(ctx, resource)
	if err != nil {
		t.Fatal(err)
	}
	delete(doc.Policies, PolicyAction)
	original, err := store.Get(ctx, resource)
	if err != nil || original.Policies[PolicyAction].Rule.Value != "operator" {
		t.Fatal(original, err)
	}
	if _, err = store.Replace(ctx, original, 1, "caller"); !errors.Is(err, authz.ErrDenied) {
		t.Fatal("published store must be immutable", err)
	}
	if _, _, err = p.Publish(ctx, RootRef{URI: "window://studio/connectors", Kind: "window", Version: 2}, json.RawMessage(`{"title":"Updated"}`), allowPublished); err != nil {
		t.Fatal(err)
	}
	_, same, err := p.CohortPolicies("operators")
	if err != nil || same != store {
		t.Fatal("content publication rebuilt unchanged policy store", err)
	}
	docs[0].Revision = 2
	docs[0].Policies[PolicyAction] = authz.Policy{Mode: "protected", Rule: &authz.Rule{Kind: "role", Value: "viewer"}}
	if _, err = p.ReplaceCatalog(ctx, docs, cohorts, p.Generation()); err != nil {
		t.Fatal(err)
	}
	_, newStore, err := p.CohortPolicies("operators")
	if err != nil || newStore == store {
		t.Fatal("policy publication did not replace store", err)
	}
	current, err := newStore.Get(ctx, resource)
	if err != nil || current.Revision != 2 || current.Policies[PolicyAction].Rule.Value != "viewer" {
		t.Fatal(current, err)
	}
	old, err := store.Get(ctx, resource)
	if err != nil || old.Revision != 1 {
		t.Fatal("old immutable snapshot changed", err)
	}
	if _, err = p.ReplaceCatalog(ctx, nil, nil, p.Generation()); err != nil {
		t.Fatal(err)
	}
	removed, _, err := p.CohortPolicies("operators")
	if err != nil || len(removed) != 0 {
		t.Fatal("withdrawn cohort retained", removed, err)
	}
}

func TestPublisherCohortPoliciesConcurrentReplacement(t *testing.T) {
	ctx := context.Background()
	p := NewPublisher()
	docs, cohorts := cohortFixture()
	cohorts[0].Roots = nil
	if _, err := p.ReplaceCatalog(ctx, docs, cohorts, 0); err != nil {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	for range 4 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for range 100 {
				refs, store, err := p.CohortPolicies("operators")
				if err != nil || len(refs) != 1 {
					t.Error(err)
					return
				}
				doc, err := store.Get(ctx, refs[0])
				if err != nil || doc.Resource != refs[0] || doc.Revision < 1 {
					t.Error("mixed policy generation", err)
					return
				}
			}
		}()
	}
	for i := 0; i < 20; i++ {
		docs[0].Revision = int64(i + 2)
		if _, err := p.ReplaceCatalog(ctx, docs, cohorts, p.Generation()); err != nil {
			t.Fatal(err)
		}
	}
	wg.Wait()
}
