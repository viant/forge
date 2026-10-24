package artifactcohort

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"testing"
	"time"

	"github.com/viant/authz"
)

func TestPolicyCompositionGrantsOverridesAndDenies(t *testing.T) {
	ctx := context.Background()
	p := NewPublisher()
	refs := map[string]RootRef{}
	for _, item := range []struct {
		uri     string
		version uint64
	}{
		{"window://sales/a", 3}, {"window://sales/a", 5}, {"window://sales/b", 2}, {"window://sales/c", 1},
	} {
		a, _, err := p.Publish(ctx, RootRef{URI: item.uri, Kind: "window", Version: item.version}, json.RawMessage(`{"version":`+itemVersion(item.version)+`}`), allowPublished)
		if err != nil {
			t.Fatal(err)
		}
		refs[item.uri+"/"+itemVersion(item.version)] = a.Root
	}
	roles := []string{"standard", "preview", "restricted"}
	policies := make([]authz.Document, 0, len(roles))
	cohorts := make([]Cohort, 0, len(roles))
	for _, role := range roles {
		resource := authz.Resource{Kind: "cohort", ID: role, Version: "logical", Tenant: "tenant"}
		policies = append(policies, authz.Document{Resource: resource, Revision: 1, Policies: map[string]authz.Policy{PolicyAction: {Mode: "protected", Rule: &authz.Rule{Kind: "role", Value: role}}}})
		cohorts = append(cohorts, Cohort{Tenant: "tenant", Name: role, PolicyResource: resource})
	}
	cohorts[0].Roots = []RootRef{refs["window://sales/a/3"], refs["window://sales/b/2"], refs["window://sales/c/1"]}
	cohorts[1].Priority = 10
	cohorts[1].RevisionOverrides = []RootRef{refs["window://sales/a/5"]}
	cohorts[2].DeniedURIs = []string{"window://sales/c"}
	if _, err := p.ReplaceCatalog(ctx, policies, cohorts, p.Generation()); err != nil {
		t.Fatal(err)
	}
	caller := &fakeCaller{publisher: p, fetches: map[string]int{}}
	r, err := NewReplica(Config{Enabled: true, Source: "s", Tenant: "tenant", Account: "a", Caller: caller, Facts: fixtureFacts{}, SessionKey: fixtureSession})
	if err != nil {
		t.Fatal(err)
	}
	if err = r.Sync(ctx); err != nil {
		t.Fatal(err)
	}
	actor := func(session string, roles ...string) context.Context {
		facts := authz.Facts{Subject: session, Tenant: "tenant", Issuer: "verified", Roles: roles, ValidUntil: time.Now().Add(time.Hour)}
		return context.WithValue(context.WithValue(ctx, replicaActorKey{}, facts), replicaSessionKey{}, session)
	}
	all := actor("all", roles...)
	if err = r.Admit(all); err != nil {
		t.Fatal(err)
	}
	for uri, version := range map[string]uint64{"window://sales/a": 5, "window://sales/b": 2} {
		view, e := r.Open(all, uri)
		if e != nil || view.Ref().Version != version {
			t.Fatalf("%s selected %+v: %v", uri, view, e)
		}
	}
	if _, err = r.Open(all, "window://sales/c"); !errors.Is(err, ErrDenied) {
		t.Fatalf("deny did not win: %v", err)
	}
	preview := actor("preview", "preview")
	if err = r.Admit(preview); err != nil {
		t.Fatal(err)
	}
	if _, err = r.Open(preview, "window://sales/a"); !errors.Is(err, ErrDenied) {
		t.Fatalf("override granted root: %v", err)
	}
	standard := actor("standard", "standard")
	if err = r.Admit(standard); err != nil {
		t.Fatal(err)
	}
	view, err := r.Open(standard, "window://sales/a")
	if err != nil || view.Ref().Version != 3 {
		t.Fatalf("standard pin: %+v %v", view, err)
	}
}

func itemVersion(version uint64) string { return fmt.Sprint(version) }

func TestCompositionPriorityTieAndDeny(t *testing.T) {
	ref := func(version uint64) RootRef {
		return RootRef{URI: "window://sales/a", Kind: "window", Version: version, Hash: fmt.Sprint(version)}
	}
	cohorts := []Cohort{
		{Tenant: "tenant", Name: "standard", PolicyHash: "s", Roots: []RootRef{ref(3)}},
		{Tenant: "tenant", Name: "preview", PolicyHash: "p", Priority: 10, RevisionOverrides: []RootRef{ref(5)}},
		{Tenant: "tenant", Name: "restricted", PolicyHash: "r", DeniedURIs: []string{ref(3).URI}},
	}
	r := &Replica{latest: Manifest{Cohorts: cohorts}}
	admitted := admission{tenant: "tenant", cohorts: map[string]string{"standard": "s", "preview": "p"}}
	selected, err := r.effectiveRootsLocked(admitted, "")
	if err != nil || selected[ref(3).URI] != ref(5) {
		t.Fatalf("override selection: %+v %v", selected, err)
	}
	admitted.cohorts["restricted"] = "r"
	selected, err = r.effectiveRootsLocked(admitted, "")
	if err != nil || len(selected) != 0 {
		t.Fatalf("deny precedence: %+v %v", selected, err)
	}
	delete(admitted.cohorts, "restricted")
	r.latest.Cohorts = append(r.latest.Cohorts, Cohort{Tenant: "tenant", Name: "preview2", PolicyHash: "p2", Priority: 10, RevisionOverrides: []RootRef{ref(6)}})
	admitted.cohorts["preview2"] = "p2"
	if _, err = r.effectiveRootsLocked(admitted, ""); !errors.Is(err, ErrConflict) {
		t.Fatalf("equal override priority: %v", err)
	}
	delete(admitted.cohorts, "preview2")
	r.latest.Cohorts = append(r.latest.Cohorts, Cohort{Tenant: "tenant", Name: "standard2", PolicyHash: "s2", Roots: []RootRef{ref(4)}})
	admitted.cohorts["standard2"] = "s2"
	if _, err = r.effectiveRootsLocked(admitted, ""); !errors.Is(err, ErrConflict) {
		t.Fatalf("equal allow priority: %v", err)
	}
}

func TestAdmissionSelectionMapReusedAcrossOpensAndRefreshedOnPublish(t *testing.T) {
	p, caller, r, actor := replicaFixture(t)
	key, _ := fixtureSession(actor)
	r.mu.RLock()
	before := reflect.ValueOf(r.admissions[key].selections[""].roots).Pointer()
	r.mu.RUnlock()
	metadataBefore := caller.count("window://sales/main")
	for i := 0; i < 100; i++ {
		if _, err := r.Open(actor, "window://sales/main"); err != nil {
			t.Fatal(err)
		}
	}
	r.mu.RLock()
	afterOpens := reflect.ValueOf(r.admissions[key].selections[""].roots).Pointer()
	r.mu.RUnlock()
	if before != afterOpens || caller.count("window://sales/main") != metadataBefore {
		t.Fatal("hot opens rebuilt selection or contacted producer")
	}
	if _, _, err := p.Publish(context.Background(), RootRef{URI: "window://sales/main", Kind: "window", Version: 2}, json.RawMessage(`{"window":"updated"}`), allowPublished); err != nil {
		t.Fatal(err)
	}
	if err := r.Sync(actor); err != nil {
		t.Fatal(err)
	}
	r.mu.RLock()
	afterSync := reflect.ValueOf(r.admissions[key].selections[""].roots).Pointer()
	r.mu.RUnlock()
	if afterSync == before {
		t.Fatal("same-policy publication did not refresh local selection map")
	}
	view, err := r.Open(actor, "window://sales/main")
	if err != nil || view.Ref().Version != 2 {
		t.Fatalf("updated root: %+v %v", view, err)
	}
}
