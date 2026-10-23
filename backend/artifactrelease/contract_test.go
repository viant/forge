package artifactrelease

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/viant/authz"
	"github.com/viant/forge/backend/artifactcohort"
)

func releaseArtifact(t *testing.T, publisher *artifactcohort.Publisher, uri string, version uint64, body string) artifactcohort.RootRef {
	t.Helper()
	value, _, err := publisher.Publish(context.Background(), artifactcohort.RootRef{URI: uri, Kind: "window", Version: version}, json.RawMessage(body), func(context.Context, json.RawMessage) error { return nil })
	if err != nil {
		t.Fatal(err)
	}
	return value.Root
}

func releaseNamedPolicy(tenant, id, role string, revision int64) (authz.Document, authz.NamedReference) {
	resource := authz.Resource{Tenant: tenant, Kind: "policy", ID: id, Version: "logical"}
	return authz.Document{Resource: resource, Revision: revision, Policies: map[string]authz.Policy{authz.NamedDefinitionAction: {
		Mode: "definition", Definition: &authz.NamedDefinition{DisplayName: id, Policies: map[string]authz.Policy{
			"describe": {Mode: "protected", Rule: &authz.Rule{Kind: "role", Value: role}, RequiredScopes: []string{"catalog.read"}},
			"execute":  {Mode: "protected", Rule: &authz.Rule{Kind: "role", Value: role}, RequiredScopes: []string{"catalog.execute"}},
		}},
	}}}, authz.NamedReference{Resource: resource, Revision: 1}
}

func TestBundleIsExactImmutableContentAndChannelRollbackUsesSameHash(t *testing.T) {
	ctx := context.Background()
	publisher := artifactcohort.NewPublisher()
	first := releaseArtifact(t, publisher, "window://sales/new-board", 1, `{"name":"first"}`)
	second := releaseArtifact(t, publisher, "window://sales/new-board", 2, `{"name":"second"}`)
	lookupCalls := 0
	lookup := func(_ context.Context, ref artifactcohort.RootRef) (*artifactcohort.Artifact, error) {
		lookupCalls++
		return publisher.Get(ref)
	}
	a, err := NewBundle(ctx, "sales", []artifactcohort.RootRef{first}, lookup)
	if err != nil {
		t.Fatal(err)
	}
	b, err := NewBundle(ctx, "sales", []artifactcohort.RootRef{second}, lookup)
	if err != nil || a.Hash == b.Hash {
		t.Fatalf("distinct retained revisions need distinct bundle hashes: %v", err)
	}
	if _, err = NewBundle(ctx, "other", []artifactcohort.RootRef{first}, lookup); !errors.Is(err, ErrInvalid) {
		t.Fatalf("cross-namespace root accepted: %v", err)
	}
	if _, err = NewBundle(ctx, "sales", []artifactcohort.RootRef{first, second}, lookup); !errors.Is(err, ErrInvalid) {
		t.Fatalf("two revisions of the same URI accepted inside one bundle: %v", err)
	}
	bad := first
	bad.Hash = strings.Repeat("0", 64)
	if _, err = NewBundle(ctx, "sales", []artifactcohort.RootRef{bad}, lookup); !errors.Is(err, ErrInvalid) {
		t.Fatalf("unverified root bytes accepted: %v", err)
	}
	key := Key{Tenant: "https://issuer.example/", Account: "account", Workspace: "workspace", Namespace: "sales", Name: "standard"}
	_, ref := releaseNamedPolicy(key.Tenant, "operators", "operator", 1)
	channel, err := NewChannel(key, "Standard release", []authz.NamedReference{ref})
	if err != nil {
		t.Fatal(err)
	}
	current, err := PreparePromotion(channel, 0, a)
	if err != nil || current.Revision != 1 || current.ActiveBundleHash != a.Hash {
		t.Fatalf("first promotion: %+v %v", current, err)
	}
	if _, err = PreparePromotion(current, 0, b); !errors.Is(err, ErrConflict) {
		t.Fatalf("stale channel CAS accepted: %v", err)
	}
	current, err = PreparePromotion(current, 1, b)
	if err != nil {
		t.Fatal(err)
	}
	beforeRollback := lookupCalls
	current, err = PreparePromotion(current, 2, a)
	if err != nil || current.Revision != 3 || current.ActiveBundleHash != a.Hash || lookupCalls != beforeRollback {
		t.Fatalf("rollback rebuilt source: %+v %v calls=%d/%d", current, err, lookupCalls, beforeRollback)
	}
	_, nextRef := releaseNamedPolicy(key.Tenant, "reviewers", "reviewer", 1)
	updated, err := PrepareChannelUpdate(current, 3, "Reviewed release", []authz.NamedReference{nextRef, ref}, a)
	if err != nil || updated.Revision != 4 || updated.Description != "Reviewed release" || len(updated.Policies) != 2 || current.Description != "Standard release" || len(current.Policies) != 1 {
		t.Fatalf("policy edit failed CAS or changed prior state: %+v %v", updated, err)
	}
}

func TestReleaseChannelIdentifiersUseCanonicalResourceGrammar(t *testing.T) {
	base := Key{Tenant: "https://issuer.example/", Account: "account", Workspace: "workspace", Namespace: "sales_ops", Name: "preview-v2"}
	if !base.Valid() {
		t.Fatal("valid namespace and channel identifier rejected")
	}
	for _, name := range []string{"", ".", "..", "bad name", "bad\nname", "bad\x00name", "bad/name", strings.Repeat("x", 65)} {
		candidate := base
		candidate.Name = name
		if candidate.Valid() {
			t.Fatalf("invalid channel name %q accepted", name)
		}
		candidate = base
		candidate.Namespace = name
		if candidate.Valid() {
			t.Fatalf("invalid namespace %q accepted", name)
		}
	}
	for _, value := range []string{"tenant\nother", "account\tother", "workspace\x00other"} {
		candidate := base
		switch {
		case strings.HasPrefix(value, "tenant"):
			candidate.Tenant = value
		case strings.HasPrefix(value, "account"):
			candidate.Account = value
		default:
			candidate.Workspace = value
		}
		if candidate.Valid() {
			t.Fatalf("control character in channel scope %q accepted", value)
		}
	}
}

func TestBundleOrderAndNamedPolicyOrderAreCanonical(t *testing.T) {
	ctx := context.Background()
	publisher := artifactcohort.NewPublisher()
	a := releaseArtifact(t, publisher, "window://sales/a", 1, `{"id":"a"}`)
	b := releaseArtifact(t, publisher, "window://sales/b", 1, `{"id":"b"}`)
	lookup := func(_ context.Context, ref artifactcohort.RootRef) (*artifactcohort.Artifact, error) {
		return publisher.Get(ref)
	}
	forward, err := NewBundle(ctx, "sales", []artifactcohort.RootRef{a, b}, lookup)
	if err != nil {
		t.Fatal(err)
	}
	reverse, err := NewBundle(ctx, "sales", []artifactcohort.RootRef{b, a}, lookup)
	if err != nil || reverse.Hash != forward.Hash || reverse.Roots[0].URI != a.URI {
		t.Fatalf("bundle order changed content identity: %+v %v", reverse, err)
	}
	tenant := "https://issuer.example/"
	_, first := releaseNamedPolicy(tenant, "a", "editor", 1)
	_, second := releaseNamedPolicy(tenant, "b", "reviewer", 1)
	key := Key{Tenant: tenant, Account: "account", Workspace: "workspace", Namespace: "sales", Name: "stable"}
	channel, err := NewChannel(key, "Stable", []authz.NamedReference{second, first})
	if err != nil || channel.Policies[0].Resource.ID != "a" {
		t.Fatalf("named policy refs were not normalized: %+v %v", channel.Policies, err)
	}
	if _, err = NewChannel(key, "Duplicate", []authz.NamedReference{first, first}); !errors.Is(err, ErrInvalid) {
		t.Fatalf("duplicate named policy accepted: %v", err)
	}
}

func TestNamedPoliciesGrantNewBundleRootsWithoutCreatorRule(t *testing.T) {
	ctx := context.Background()
	publisher := artifactcohort.NewPublisher()
	root := releaseArtifact(t, publisher, "window://sales/new-board", 1, `{"name":"new"}`)
	bundle, err := NewBundle(ctx, "sales", []artifactcohort.RootRef{root}, func(_ context.Context, ref artifactcohort.RootRef) (*artifactcohort.Artifact, error) {
		return publisher.Get(ref)
	})
	if err != nil {
		t.Fatal(err)
	}
	key := Key{Tenant: "https://issuer.example/", Account: "account", Workspace: "workspace", Namespace: "sales", Name: "preview"}
	first, firstRef := releaseNamedPolicy(key.Tenant, "editors", "editor", 2)
	second, secondRef := releaseNamedPolicy(key.Tenant, "reviewers", "reviewer", 3)
	channel, err := NewChannel(key, "Preview", []authz.NamedReference{secondRef, firstRef})
	if err != nil {
		t.Fatal(err)
	}
	channel, err = PreparePromotion(channel, 0, bundle)
	if err != nil {
		t.Fatal(err)
	}
	compiled, err := CompileCohorts(ctx, channel, bundle, []authz.Document{first, second})
	if err != nil || len(compiled.Policies) != 2 || len(compiled.Cohorts) != 2 || len(compiled.Dependencies) != 2 {
		t.Fatalf("compiled named release: %+v %v", compiled, err)
	}
	for i, cohort := range compiled.Cohorts {
		if len(cohort.Roots) != 1 || cohort.Roots[0] != root || compiled.Policies[i].Resource != cohort.PolicyResource {
			t.Fatalf("new root was not granted by named policy: %+v", cohort)
		}
		join := compiled.Policies[i].Policies[artifactcohort.PolicyAction]
		if join.Mode != "protected" || join.Rule == nil || join.Rule.Kind != "all" || len(join.Rule.Rules) != 2 || len(join.RequiredScopes) != 2 {
			t.Fatalf("mandatory named-policy constraints were lost: %+v", join)
		}
	}
	manifest, err := publisher.ReplaceCatalog(ctx, compiled.Policies, compiled.Cohorts, publisher.Generation())
	if err != nil || artifactcohort.ValidateManifest(manifest) != nil {
		t.Fatalf("cohorts do not use the existing publisher: %v", err)
	}
	for _, role := range []string{"editor", "reviewer"} {
		grants := 0
		for _, doc := range compiled.Policies {
			_, err := authz.Evaluate(authz.Request{Resource: doc.Resource, Action: artifactcohort.PolicyAction}, doc.Policies,
				authz.Facts{Subject: "recipient", Tenant: key.Tenant, Issuer: key.Tenant, Roles: []string{role}, GrantedScopes: []string{"catalog.read", "catalog.execute"}, ValidUntil: time.Now().Add(time.Hour)}, time.Now())
			if err == nil {
				grants++
			}
		}
		if grants != 1 {
			t.Fatalf("role %s joined %d named cohorts, want one", role, grants)
		}
	}
}

func TestNamedDenyMissingActionAndHeadRevisionFailClosed(t *testing.T) {
	ctx := context.Background()
	publisher := artifactcohort.NewPublisher()
	root := releaseArtifact(t, publisher, "window://sales/new-board", 1, `{}`)
	bundle, err := NewBundle(ctx, "sales", []artifactcohort.RootRef{root}, func(_ context.Context, ref artifactcohort.RootRef) (*artifactcohort.Artifact, error) {
		return publisher.Get(ref)
	})
	if err != nil {
		t.Fatal(err)
	}
	key := Key{Tenant: "tenant", Account: "account", Workspace: "workspace", Namespace: "sales", Name: "standard"}
	doc, ref := releaseNamedPolicy(key.Tenant, "operators", "operator", 1)
	channel, err := NewChannel(key, "Standard", []authz.NamedReference{ref})
	if err != nil {
		t.Fatal(err)
	}
	channel, err = PreparePromotion(channel, 0, bundle)
	if err != nil {
		t.Fatal(err)
	}
	definition := doc.Policies[authz.NamedDefinitionAction].Definition
	definition.Policies["discover"] = authz.Policy{Mode: "deny"}
	compiled, err := CompileCohorts(ctx, channel, bundle, []authz.Document{doc})
	if err != nil || compiled.Policies[0].Policies[artifactcohort.PolicyAction].Mode != "deny" {
		t.Fatalf("explicit discover deny became grant: %+v %v", compiled, err)
	}
	delete(definition.Policies, "execute")
	if _, err = CompileCohorts(ctx, channel, bundle, []authz.Document{doc}); !errors.Is(err, ErrInvalid) {
		t.Fatalf("missing execute action admitted: %v", err)
	}
	definition.Policies["execute"] = authz.Policy{Mode: "protected", Rule: &authz.Rule{Kind: "role", Value: "operator"}}
	channel.Policies[0].Revision = 2
	if _, err = CompileCohorts(ctx, channel, bundle, []authz.Document{doc}); !errors.Is(err, ErrConflict) {
		t.Fatalf("stale named head admitted: %v", err)
	}
}

func TestNamedHeadAdvanceChangesDerivedGrantWithoutChangingBundle(t *testing.T) {
	ctx := context.Background()
	publisher := artifactcohort.NewPublisher()
	root := releaseArtifact(t, publisher, "window://sales/board", 1, `{}`)
	bundle, err := NewBundle(ctx, "sales", []artifactcohort.RootRef{root}, func(_ context.Context, ref artifactcohort.RootRef) (*artifactcohort.Artifact, error) {
		return publisher.Get(ref)
	})
	if err != nil {
		t.Fatal(err)
	}
	key := Key{Tenant: "tenant", Account: "account", Workspace: "workspace", Namespace: "sales", Name: "stable"}
	old, ref := releaseNamedPolicy(key.Tenant, "audience", "reviewer", 1)
	channel, err := NewChannel(key, "Stable", []authz.NamedReference{ref})
	if err != nil {
		t.Fatal(err)
	}
	channel, err = PreparePromotion(channel, 0, bundle)
	if err != nil {
		t.Fatal(err)
	}
	first, err := CompileCohorts(ctx, channel, bundle, []authz.Document{old})
	if err != nil {
		t.Fatal(err)
	}
	newHead := old
	newHead.Revision = 2
	newHead.Policies = map[string]authz.Policy{authz.NamedDefinitionAction: {Mode: "definition", Definition: &authz.NamedDefinition{DisplayName: "audience", Policies: map[string]authz.Policy{
		"describe": {Mode: "protected", Rule: &authz.Rule{Kind: "role", Value: "operator"}},
		"execute":  {Mode: "protected", Rule: &authz.Rule{Kind: "role", Value: "operator"}},
	}}}}
	second, err := CompileCohorts(ctx, channel, bundle, []authz.Document{newHead})
	if err != nil || second.Dependencies[0].Revision != 2 || second.Cohorts[0].Roots[0] != root {
		t.Fatalf("new named head not projected with same immutable roots: %+v %v", second, err)
	}
	firstRaw, _ := json.Marshal(first.Policies)
	secondRaw, _ := json.Marshal(second.Policies)
	if string(firstRaw) == string(secondRaw) || bundle.Hash != channel.ActiveBundleHash {
		t.Fatal("named policy update failed to change grant while retaining release bytes")
	}
}

func TestBoundedNamedPolicyCannotBeAdvertisedAsCohortMembership(t *testing.T) {
	ctx := context.Background()
	publisher := artifactcohort.NewPublisher()
	root := releaseArtifact(t, publisher, "window://sales/board", 1, `{}`)
	bundle, err := NewBundle(ctx, "sales", []artifactcohort.RootRef{root}, func(_ context.Context, ref artifactcohort.RootRef) (*artifactcohort.Artifact, error) {
		return publisher.Get(ref)
	})
	if err != nil {
		t.Fatal(err)
	}
	key := Key{Tenant: "tenant", Account: "account", Workspace: "workspace", Namespace: "sales", Name: "bounded"}
	doc, ref := releaseNamedPolicy(key.Tenant, "operators", "operator", 1)
	definition := doc.Policies[authz.NamedDefinitionAction].Definition
	policy := definition.Policies["execute"]
	policy.EntityType = "advertiser"
	definition.Policies["execute"] = policy
	channel, err := NewChannel(key, "Bounded audience", []authz.NamedReference{ref})
	if err != nil {
		t.Fatal(err)
	}
	channel, err = PreparePromotion(channel, 0, bundle)
	if err != nil {
		t.Fatal(err)
	}
	_, err = CompileCohorts(ctx, channel, bundle, []authz.Document{doc})
	if !errors.Is(err, ErrBoundedMembership) {
		t.Fatalf("bounded policy became an unusable advertised grant: %v", err)
	}
}

func TestMergeActivationPreservesUnrelatedAndOverlappingCohorts(t *testing.T) {
	key := Key{Tenant: "tenant", Account: "account", Workspace: "workspace", Namespace: "sales", Name: "standard"}
	other := Key{Tenant: "tenant", Account: "account", Workspace: "workspace", Namespace: "sales", Name: "preview"}
	rootA := artifactcohort.RootRef{URI: "window://sales/board", Kind: "window", Version: 1, Hash: strings.Repeat("a", 64)}
	rootB := artifactcohort.RootRef{URI: rootA.URI, Kind: "window", Version: 2, Hash: strings.Repeat("b", 64)}
	policyA := authz.Resource{Tenant: "tenant", Kind: "cohort", ID: ReleaseCohortPrefix(key) + "old", Version: "logical"}
	policyOther := authz.Resource{Tenant: "tenant", Kind: "cohort", ID: ReleaseCohortPrefix(other) + "held", Version: "logical"}
	old := authz.Document{Resource: policyA, Revision: 1, Policies: map[string]authz.Policy{"join": {Mode: "deny"}}}
	held := authz.Document{Resource: policyOther, Revision: 1, Policies: map[string]authz.Policy{"join": {Mode: "deny"}}}
	input := Compilation{Policies: []authz.Document{{Resource: authz.Resource{Tenant: "tenant", Kind: "cohort", ID: ReleaseCohortPrefix(key) + "new", Version: "logical"}, Revision: 2, Policies: map[string]authz.Policy{"join": {Mode: "deny"}}}}, Cohorts: []artifactcohort.Cohort{{Tenant: "tenant", Name: ReleaseCohortPrefix(key) + "new", Roots: []artifactcohort.RootRef{rootB}}}}
	// Use a zero manifest to model a producer adapter before first projection;
	// once a publisher returns a validated manifest, the same merge rules apply.
	existing := artifactcohort.Manifest{Policies: []authz.Document{old, held}, Cohorts: []artifactcohort.Cohort{{Tenant: "tenant", Name: ReleaseCohortPrefix(key) + "old", Roots: []artifactcohort.RootRef{rootA}}, {Tenant: "tenant", Name: ReleaseCohortPrefix(other) + "held", Roots: []artifactcohort.RootRef{rootA}}}}
	policies, cohorts, err := MergeActivation(existing, key, input)
	if err != nil || len(policies) != 2 || len(cohorts) != 2 || cohorts[0].Roots[0] != rootA || cohorts[1].Roots[0] != rootB {
		t.Fatalf("unrelated or overlapping channel changed: %+v %+v %v", policies, cohorts, err)
	}
	cohorts[0].Roots[0].Hash = strings.Repeat("c", 64)
	if existing.Cohorts[1].Roots[0] != rootA {
		t.Fatal("activation candidate shares mutable roots with prior generation")
	}
}
