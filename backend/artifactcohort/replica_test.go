package artifactcohort

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/viant/authz"
)

type replicaActorKey struct{}
type replicaSessionKey struct{}
type fixtureFacts struct{}
type countedFacts struct{ calls atomic.Int32 }

func (f *countedFacts) Resolve(ctx context.Context) (authz.Facts, error) {
	f.calls.Add(1)
	return fixtureFacts{}.Resolve(ctx)
}

func (fixtureFacts) Resolve(ctx context.Context) (authz.Facts, error) {
	facts, ok := ctx.Value(replicaActorKey{}).(authz.Facts)
	if !ok {
		return authz.Facts{}, ErrDenied
	}
	return facts, nil
}
func fixtureSession(ctx context.Context) (string, error) {
	value, _ := ctx.Value(replicaSessionKey{}).(string)
	if value == "" {
		return "", ErrDenied
	}
	return value, nil
}
func actorContext(session, role string) context.Context {
	facts := authz.Facts{Subject: session, Tenant: "tenant", Issuer: "verified", Roles: []string{role}, ValidUntil: time.Now().Add(time.Hour)}
	return context.WithValue(context.WithValue(context.Background(), replicaActorKey{}, facts), replicaSessionKey{}, session)
}

type fakeCaller struct {
	mu        sync.Mutex
	publisher *Publisher
	fetches   map[string]int
	discovers int
	compact   int
	failURI   string
	blockURI  string
	entered   chan struct{}
	release   chan struct{}
}

type countedManifestStore struct {
	mu    sync.Mutex
	value Manifest
	saves int
}

func (s *countedManifestStore) Load(context.Context, string, string, string) (Manifest, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.saves == 0 {
		return Manifest{}, ErrUnavailable
	}
	return CloneManifest(s.value)
}
func (s *countedManifestStore) Save(_ context.Context, _, _, _ string, value Manifest) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	cloned, err := CloneManifest(value)
	if err != nil {
		return err
	}
	s.value = cloned
	s.saves++
	return nil
}
func (s *countedManifestStore) snapshot() (string, int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.value.Hash, s.saves
}

func (f *fakeCaller) Discover(context.Context) (Manifest, error) {
	f.mu.Lock()
	f.discovers++
	f.mu.Unlock()
	return f.publisher.Snapshot()
}
func (f *fakeCaller) DiscoverKnown(_ context.Context, knownHash string) (Manifest, error) {
	f.mu.Lock()
	f.discovers++
	f.mu.Unlock()
	snapshot, err := f.publisher.Snapshot()
	if err != nil {
		return Manifest{}, err
	}
	if snapshot.Hash == knownHash {
		f.mu.Lock()
		f.compact++
		f.mu.Unlock()
		return Manifest{Unchanged: true, Hash: knownHash, Generation: snapshot.Generation}, nil
	}
	return snapshot, nil
}
func (f *fakeCaller) Fetch(ctx context.Context, input FetchInput) (*Artifact, error) {
	f.mu.Lock()
	f.fetches[input.Root.URI]++
	fail, block := f.failURI == input.Root.URI, f.blockURI == input.Root.URI
	entered, release := f.entered, f.release
	f.mu.Unlock()
	if block {
		select {
		case entered <- struct{}{}:
		default:
		}
		select {
		case <-release:
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}
	if fail {
		return nil, ErrUnavailable
	}
	return f.publisher.Get(input.Root)
}
func (f *fakeCaller) count(uri string) int { f.mu.Lock(); defer f.mu.Unlock(); return f.fetches[uri] }
func fixturePublisher(t *testing.T, windowBody string) *Publisher {
	t.Helper()
	ctx := context.Background()
	p := NewPublisher()
	for _, entry := range []struct{ uri, kind, body string }{
		{"window://sales/main", "window", windowBody}, {"intent://sales/main", "intent", `{"intent":"sales"}`}, {"intent://ops/main", "intent", `{"intent":"ops"}`},
	} {
		if _, _, err := p.Publish(ctx, RootRef{URI: entry.uri, Kind: entry.kind, Version: 1}, json.RawMessage(entry.body), allowPublished); err != nil {
			t.Fatal(err)
		}
	}
	resource := authz.Resource{Kind: "cohort", ID: "operators", Version: "logical", Tenant: "tenant"}
	doc := authz.Document{Resource: resource, Revision: 1, Policies: map[string]authz.Policy{PolicyAction: {Mode: "protected", Rule: &authz.Rule{Kind: "role", Value: "operator"}}}}
	cohort := Cohort{Tenant: "tenant", Name: "operators", PolicyResource: resource, Roots: []RootRef{{URI: "window://sales/main", Kind: "window"}, {URI: "intent://sales/main", Kind: "intent"}, {URI: "intent://ops/main", Kind: "intent"}}}
	if _, err := p.ReplaceCatalog(ctx, []authz.Document{doc}, []Cohort{cohort}, p.Generation()); err != nil {
		t.Fatal(err)
	}
	return p
}
func replicaFixture(t *testing.T) (*Publisher, *fakeCaller, *Replica, context.Context) {
	t.Helper()
	p := fixturePublisher(t, `{"window":"sales"}`)
	caller := &fakeCaller{publisher: p, fetches: map[string]int{}}
	r, err := NewReplica(Config{Enabled: true, Source: "studio-management", Tenant: "tenant", Account: "account-a", Caller: caller, Facts: fixtureFacts{}, SessionKey: fixtureSession, MaxFetchConcurrent: 4})
	if err != nil {
		t.Fatal(err)
	}
	ctx := actorContext("alice", "operator")
	if err = r.Sync(ctx); err != nil {
		t.Fatal(err)
	}
	if err = r.Admit(ctx); err != nil {
		t.Fatal(err)
	}
	return p, caller, r, ctx
}
func TestReplicaStartupLocalAdmissionAndHashReconnect(t *testing.T) {
	_, caller, r, ctx := replicaFixture(t)
	counting := &countedFacts{}
	r.cfg.Facts = counting
	if caller.count("window://sales/main") != 1 || caller.count("intent://sales/main") != 1 || caller.count("intent://ops/main") != 1 {
		t.Fatal("startup did not fetch each published root once")
	}
	before := caller.discovers
	windowFetch := caller.count("window://sales/main")
	for i := 0; i < 100; i++ {
		user := actorContext(fmt.Sprintf("user-%d", i), "operator")
		if err := r.EnsureAdmitted(user); err != nil {
			t.Fatal(err)
		}
		view, err := r.Open(user, "window://sales/main")
		if err != nil || string(view.Payload()) != `{"window":"sales"}` {
			t.Fatal("local window", err)
		}
	}
	if counting.calls.Load() != 100 {
		t.Fatalf("expected one policy fact lookup for each new login, got %d", counting.calls.Load())
	}
	for i := 0; i < 100; i++ {
		if err := r.EnsureAdmitted(ctx); err != nil {
			t.Fatal(err)
		}
	}
	if counting.calls.Load() != 100 {
		t.Fatal("existing session reevaluated policy during opens")
	}
	if caller.discovers != before || caller.count("window://sales/main") != windowFetch {
		t.Fatal("login/Open contacted MCP")
	}
	if err := r.Sync(ctx); err != nil {
		t.Fatal(err)
	}
	if caller.count("window://sales/main") != windowFetch {
		t.Fatal("same-hash reconnect fetched window bytes")
	}
	if caller.compact != 1 {
		t.Fatal("same-hash reconnect did not use compact discovery")
	}
}

func TestReplicaPersistsActivatedManifestAfterCompactRetry(t *testing.T) {
	p := fixturePublisher(t, `{"window":"sales"}`)
	caller := &fakeCaller{publisher: p, fetches: map[string]int{}}
	store := &countedManifestStore{}
	r, err := NewReplica(Config{Enabled: true, Source: "studio-management", Tenant: "tenant", Account: "account-a", Caller: caller, Facts: fixtureFacts{}, SessionKey: fixtureSession, ManifestStore: store})
	if err != nil {
		t.Fatal(err)
	}
	actor := actorContext("alice", "operator")
	if err = r.Sync(actor); err != nil {
		t.Fatal(err)
	}
	oldHash, saves := store.snapshot()
	if oldHash == "" || saves != 1 {
		t.Fatalf("initial catalog not persisted: hash=%q saves=%d", oldHash, saves)
	}
	uri := "intent://sales/main"
	if _, _, err = p.Publish(actor, RootRef{URI: uri, Kind: "intent", Version: 2}, json.RawMessage(`{"intent":"changed"}`), allowPublished); err != nil {
		t.Fatal(err)
	}
	caller.mu.Lock()
	caller.blockURI = uri
	caller.entered = make(chan struct{}, 1)
	caller.release = make(chan struct{})
	entered, release := caller.entered, caller.release
	caller.mu.Unlock()
	first := make(chan error, 1)
	go func() { first <- r.Sync(actor) }()
	select {
	case <-entered:
	case <-time.After(time.Second):
		t.Fatal("changed partition was not staged")
	}
	r.MarkDisconnected() // notification arrives while changed bytes stage
	close(release)
	if err = <-first; !errors.Is(err, ErrUnavailable) {
		t.Fatalf("raced activation did not fail closed: %v", err)
	}
	if got, count := store.snapshot(); got != oldHash || count != 1 {
		t.Fatalf("failed activation persisted candidate: hash=%q saves=%d", got, count)
	}
	if err = r.Sync(actor); err != nil {
		t.Fatalf("compact retry failed: %v", err)
	}
	want, err := p.Snapshot()
	if err != nil {
		t.Fatal(err)
	}
	if got, count := store.snapshot(); got != want.Hash || count != 2 || caller.compact < 1 {
		t.Fatalf("compact retry did not persist activated index: got=%q want=%q saves=%d compact=%d", got, want.Hash, count, caller.compact)
	}
	if err = r.Sync(actor); err != nil {
		t.Fatal(err)
	}
	if _, count := store.snapshot(); count != 2 {
		t.Fatalf("unchanged poll rewrote verified manifest: saves=%d", count)
	}
}
func TestFailedSalesIntentPartitionDoesNotBlockSalesWindowOrOpsIntent(t *testing.T) {
	p, caller, r, ctx := replicaFixture(t)
	beforeWindow := caller.count("window://sales/main")
	beforeOps := caller.count("intent://ops/main")
	uri := "intent://sales/main"
	if _, _, err := p.Publish(ctx, RootRef{URI: uri, Kind: "intent", Version: 2}, json.RawMessage(`{"intent":"sales-v2"}`), allowPublished); err != nil {
		t.Fatal(err)
	}
	if err := r.MarkUpdated(uri); err != nil {
		t.Fatal(err)
	}
	caller.mu.Lock()
	caller.failURI = uri
	caller.blockURI = uri
	caller.entered = make(chan struct{}, 1)
	caller.release = make(chan struct{})
	entered, release := caller.entered, caller.release
	caller.mu.Unlock()
	finished := make(chan error, 1)
	go func() { finished <- r.Sync(ctx) }()
	select {
	case <-entered:
	case <-time.After(time.Second):
		t.Fatal("changed intent fetch did not start")
	}
	for _, other := range []string{"window://sales/main", "intent://ops/main"} {
		if _, err := r.Open(ctx, other); err != nil {
			t.Fatalf("unrelated %s blocked during intent fetch: %v", other, err)
		}
	}
	if _, err := r.Open(ctx, uri); !errors.Is(err, ErrUnavailable) {
		t.Fatalf("changed intent served while loading: %v", err)
	}
	close(release)
	if err := <-finished; err == nil {
		t.Fatal("failed changed intent fetch reported success")
	}
	for _, other := range []string{"window://sales/main", "intent://ops/main"} {
		if _, err := r.Open(ctx, other); err != nil {
			t.Fatalf("unrelated %s blocked after intent failure: %v", other, err)
		}
	}
	if caller.count("window://sales/main") != beforeWindow || caller.count("intent://ops/main") != beforeOps {
		t.Fatal("unrelated partitions refetched")
	}
	caller.mu.Lock()
	caller.failURI = ""
	caller.blockURI = ""
	caller.mu.Unlock()
	if err := r.Sync(ctx); err != nil {
		t.Fatal(err)
	}
	view, err := r.Open(ctx, uri)
	if err != nil || view.Ref().Version != 2 {
		t.Fatal("changed intent did not activate", err)
	}
}
func TestChangedWindowActivatesWhileChangedIntentFetchIsBlocked(t *testing.T) {
	p, caller, r, ctx := replicaFixture(t)
	windowURI, intentURI := "window://sales/main", "intent://sales/main"
	if _, _, err := p.Publish(ctx, RootRef{URI: windowURI, Kind: "window", Version: 2}, json.RawMessage(`{"window":"v2"}`), allowPublished); err != nil {
		t.Fatal(err)
	}
	if _, _, err := p.Publish(ctx, RootRef{URI: intentURI, Kind: "intent", Version: 2}, json.RawMessage(`{"intent":"v2"}`), allowPublished); err != nil {
		t.Fatal(err)
	}
	if err := r.MarkUpdated(windowURI); err != nil {
		t.Fatal(err)
	}
	if err := r.MarkUpdated(intentURI); err != nil {
		t.Fatal(err)
	}
	caller.mu.Lock()
	caller.blockURI = intentURI
	caller.entered = make(chan struct{}, 1)
	caller.release = make(chan struct{})
	entered, release := caller.entered, caller.release
	caller.mu.Unlock()
	finished := make(chan error, 1)
	go func() { finished <- r.Sync(ctx) }()
	select {
	case <-entered:
	case <-time.After(time.Second):
		t.Fatal("intent did not block")
	}
	deadline := time.Now().Add(time.Second)
	for {
		view, err := r.Open(ctx, windowURI)
		if err == nil && view.Ref().Version == 2 {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("changed window waited for blocked intent: %v", err)
		}
		time.Sleep(time.Millisecond)
	}
	if _, err := r.Open(ctx, intentURI); !errors.Is(err, ErrUnavailable) {
		t.Fatalf("blocked intent opened: %v", err)
	}
	close(release)
	if err := <-finished; err != nil {
		t.Fatal(err)
	}
}
func TestReplicaProviderAccountBoundaryForSameAlias(t *testing.T) {
	pA := fixturePublisher(t, `{"owner":"account-a"}`)
	pB := fixturePublisher(t, `{"owner":"account-b"}`)
	makeReplica := func(source, account string, p *Publisher) *Replica {
		caller := &fakeCaller{publisher: p, fetches: map[string]int{}}
		r, err := NewReplica(Config{Enabled: true, Source: source, Tenant: "tenant", Account: account, Caller: caller, Facts: fixtureFacts{}, SessionKey: fixtureSession})
		if err != nil {
			t.Fatal(err)
		}
		ctx := actorContext("alice", "operator")
		if err = r.Sync(ctx); err != nil {
			t.Fatal(err)
		}
		if err = r.Admit(ctx); err != nil {
			t.Fatal(err)
		}
		return r
	}
	a := makeReplica("studio-a", "account-a", pA)
	b := makeReplica("studio-b", "account-b", pB)
	ctx := actorContext("alice", "operator")
	aView, _ := a.Open(ctx, "window://sales/main")
	bView, _ := b.Open(ctx, "window://sales/main")
	if string(aView.Payload()) == string(bView.Payload()) || aView.Ref().Hash == bView.Ref().Hash {
		t.Fatal("same logical artifact alias crossed provider/account replica boundary")
	}
}
func TestReplicaPolicyOnlyChangeRevokesOldAdmissionWithoutRootDownload(t *testing.T) {
	p, caller, r, operator := replicaFixture(t)
	before := caller.count("window://sales/main")
	policies, cohorts := cohortFixture()
	policies[0].Policies[PolicyAction] = authz.Policy{Mode: "protected", Rule: &authz.Rule{Kind: "role", Value: "viewer"}}
	cohorts[0].Roots = []RootRef{{URI: "window://sales/main", Kind: "window"}, {URI: "intent://sales/main", Kind: "intent"}, {URI: "intent://ops/main", Kind: "intent"}}
	if _, err := p.ReplaceCatalog(operator, policies, cohorts, p.Generation()); err != nil {
		t.Fatal(err)
	}
	if err := r.HandleNotification(operator, NotificationListChanged, ""); err != nil {
		t.Fatal(err)
	}
	if caller.count("window://sales/main") != before {
		t.Fatal("policy-only change downloaded root bytes")
	}
	if _, err := r.Open(operator, "window://sales/main"); !errors.Is(err, ErrDenied) {
		t.Fatalf("old admission survived policy change: %v", err)
	}
	if err := r.EnsureAdmitted(operator); !errors.Is(err, ErrDenied) {
		t.Fatalf("old role re-admitted: %v", err)
	}
	viewer := actorContext("bob", "viewer")
	if err := r.EnsureAdmitted(viewer); err != nil {
		t.Fatalf("new role failed admission: %v", err)
	}
	if _, err := r.Open(viewer, "window://sales/main"); err != nil {
		t.Fatalf("new role unable to open unchanged root: %v", err)
	}
}
func TestReplicaFullSnapshotRemovesOmittedRoot(t *testing.T) {
	p, caller, r, ctx := replicaFixture(t)
	policies, cohorts := cohortFixture()
	cohorts[0].Roots = []RootRef{{URI: "intent://sales/main", Kind: "intent"}, {URI: "intent://ops/main", Kind: "intent"}}
	if _, err := p.ReplaceCatalog(ctx, policies, cohorts, p.Generation()); err != nil {
		t.Fatal(err)
	}
	before := caller.count("intent://ops/main")
	if err := r.Sync(ctx); err != nil {
		t.Fatal(err)
	}
	if r.PartitionReady(PartitionKey("sales", "window")) {
		t.Fatal("omitted window partition survived full snapshot")
	}
	if _, err := r.Open(ctx, "window://sales/main"); !errors.Is(err, ErrDenied) {
		t.Fatalf("omitted root remained accessible: %v", err)
	}
	if caller.count("intent://ops/main") != before {
		t.Fatal("unchanged partition refetched")
	}
}
func TestSamePolicyAddedRootNeedsNoReevaluationAndEmptyCatalogRevokesLastRoot(t *testing.T) {
	p, _, r, ctx := replicaFixture(t)
	counting := &countedFacts{}
	r.cfg.Facts = counting
	newURI := "window://sales/new"
	if _, _, err := p.Publish(ctx, RootRef{URI: newURI, Kind: "window", Version: 1}, json.RawMessage(`{"new":true}`), allowPublished); err != nil {
		t.Fatal(err)
	}
	policies, cohorts := cohortFixture()
	cohorts[0].Roots = []RootRef{{URI: "window://sales/main", Kind: "window"}, {URI: "intent://sales/main", Kind: "intent"}, {URI: "intent://ops/main", Kind: "intent"}, {URI: newURI, Kind: "window"}}
	if _, err := p.ReplaceCatalog(ctx, policies, cohorts, p.Generation()); err != nil {
		t.Fatal(err)
	}
	if err := r.Sync(ctx); err != nil {
		t.Fatal(err)
	}
	if err := r.EnsureAdmitted(ctx); err != nil {
		t.Fatal(err)
	}
	if counting.calls.Load() != 0 {
		t.Fatal("same-policy root addition reevaluated facts")
	}
	if _, err := r.Open(ctx, newURI); err != nil {
		t.Fatalf("new root denied under admitted cohort: %v", err)
	}
	if _, err := p.ReplaceCatalog(ctx, nil, nil, p.Generation()); err != nil {
		t.Fatal(err)
	}
	if err := r.Sync(ctx); err != nil {
		t.Fatal(err)
	}
	for _, uri := range []string{newURI, "window://sales/main", "intent://sales/main"} {
		if _, err := r.Open(ctx, uri); !errors.Is(err, ErrDenied) {
			t.Fatalf("removed root %s accessible: %v", uri, err)
		}
	}
	if _, err := r.PermittedRoots(ctx); !errors.Is(err, ErrDenied) {
		t.Fatalf("removed cohort still listed: %v", err)
	}
}
func TestLocalAdmissionUsesVerifiedRoleGroupExposureAndKeepsEntityFactsPerSession(t *testing.T) {
	p := fixturePublisher(t, `{"window":"shared"}`)
	policies, cohorts := cohortFixture()
	cohorts[0].Roots = []RootRef{{URI: "window://sales/main", Kind: "window"}}
	policies[0].Policies[PolicyAction] = authz.Policy{Mode: "protected", Rule: &authz.Rule{Kind: "all", Rules: []authz.Rule{{Kind: "role", Value: "operator"}, {Kind: "group", Value: "analytics"}, {Kind: "exposure", Value: "studio"}}}}
	if _, err := p.ReplaceCatalog(context.Background(), policies, cohorts, p.Generation()); err != nil {
		t.Fatal(err)
	}
	caller := &fakeCaller{publisher: p, fetches: map[string]int{}}
	r, err := NewReplica(Config{Enabled: true, Source: "studio", Tenant: "tenant", Account: "acct", Caller: caller, Facts: fixtureFacts{}, SessionKey: fixtureSession})
	if err != nil {
		t.Fatal(err)
	}
	if err = r.Sync(context.Background()); err != nil {
		t.Fatal(err)
	}
	actor := func(session string, groups, exposures []string, entities authz.EntityGroups) context.Context {
		facts := authz.Facts{Subject: session, Tenant: "tenant", Issuer: "verified", Roles: []string{"operator"}, MembershipGroups: groups, Exposures: exposures, EntityGroups: entities, ValidUntil: time.Now().Add(time.Hour)}
		return context.WithValue(context.WithValue(context.Background(), replicaActorKey{}, facts), replicaSessionKey{}, session)
	}
	alice := actor("alice", []string{"analytics"}, []string{"studio"}, authz.EntityGroups{"project": {"101"}})
	bob := actor("bob", []string{"analytics"}, []string{"studio"}, authz.EntityGroups{"project": {"202"}})
	missingGroup := actor("mallory", nil, []string{"studio"}, nil)
	missingExposure := actor("eve", []string{"analytics"}, nil, nil)
	for _, ctx := range []context.Context{alice, bob} {
		if err := r.EnsureAdmitted(ctx); err != nil {
			t.Fatalf("verified role/group/exposure denied: %v", err)
		}
		if _, err := r.Open(ctx, "window://sales/main"); err != nil {
			t.Fatal(err)
		}
	}
	for _, ctx := range []context.Context{missingGroup, missingExposure} {
		if err := r.EnsureAdmitted(ctx); !errors.Is(err, ErrDenied) {
			t.Fatalf("missing verified claim admitted: %v", err)
		}
	}
	if caller.count("window://sales/main") != 1 {
		t.Fatal("per-user entity facts caused duplicated cohort artifact bytes")
	}
}
func TestOneVerifiedUserCanJoinTwoNamedCohortsWithoutOpenPolicyCalls(t *testing.T) {
	p := fixturePublisher(t, `{"window":"sales"}`)
	sales := authz.Resource{Kind: "cohort", ID: "sales", Version: "logical", Tenant: "tenant"}
	ops := authz.Resource{Kind: "cohort", ID: "ops", Version: "logical", Tenant: "tenant"}
	policies := []authz.Document{
		{Resource: sales, Revision: 1, Policies: map[string]authz.Policy{PolicyAction: {Mode: "protected", Rule: &authz.Rule{Kind: "role", Value: "sales"}}}},
		{Resource: ops, Revision: 1, Policies: map[string]authz.Policy{PolicyAction: {Mode: "protected", Rule: &authz.Rule{Kind: "role", Value: "ops"}}}},
	}
	cohorts := []Cohort{{Tenant: "tenant", Name: "sales", PolicyResource: sales, Roots: []RootRef{{URI: "window://sales/main", Kind: "window"}}}, {Tenant: "tenant", Name: "ops", PolicyResource: ops, Roots: []RootRef{{URI: "intent://ops/main", Kind: "intent"}}}}
	if _, err := p.ReplaceCatalog(context.Background(), policies, cohorts, p.Generation()); err != nil {
		t.Fatal(err)
	}
	caller := &fakeCaller{publisher: p, fetches: map[string]int{}}
	facts := &countedFacts{}
	r, err := NewReplica(Config{Enabled: true, Source: "studio", Tenant: "tenant", Account: "acct", Caller: caller, Facts: facts, SessionKey: fixtureSession})
	if err != nil {
		t.Fatal(err)
	}
	if err = r.Sync(context.Background()); err != nil {
		t.Fatal(err)
	}
	verified := authz.Facts{Subject: "alice", Tenant: "tenant", Issuer: "verified", Roles: []string{"sales", "ops"}, ValidUntil: time.Now().Add(time.Hour)}
	ctx := context.WithValue(context.WithValue(context.Background(), replicaActorKey{}, verified), replicaSessionKey{}, "alice")
	if err = r.EnsureAdmitted(ctx); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 100; i++ {
		for _, uri := range []string{"window://sales/main", "intent://ops/main"} {
			if _, err := r.Open(ctx, uri); err != nil {
				t.Fatalf("joined cohort root %s denied: %v", uri, err)
			}
		}
		if err := r.EnsureAdmitted(ctx); err != nil {
			t.Fatal(err)
		}
	}
	if facts.calls.Load() != 1 {
		t.Fatalf("facts resolved on Open/Ensure: %d", facts.calls.Load())
	}
	roots, err := r.PermittedRoots(ctx)
	if err != nil || len(roots) != 2 {
		t.Fatalf("union roots: %+v %v", roots, err)
	}
	if caller.count("window://sales/main") != 1 || caller.count("intent://ops/main") != 1 {
		t.Fatal("per-user cohort join refetched artifacts")
	}
}
func TestReplicaChangedContentAfterProducerGenerationReset(t *testing.T) {
	_, caller, r, ctx := replicaFixture(t)
	newProducer := fixturePublisher(t, `{"window":"after-restart"}`)
	caller.mu.Lock()
	caller.publisher = newProducer
	caller.mu.Unlock()
	if err := r.Sync(ctx); err != nil {
		t.Fatalf("content-hash sync rejected producer restart: %v", err)
	}
	view, err := r.Open(ctx, "window://sales/main")
	if err != nil || string(view.Payload()) != `{"window":"after-restart"}` {
		t.Fatalf("new published content unavailable: %v", err)
	}
}
func TestDisabledReplicaKeepsLegacyBoundary(t *testing.T) {
	r, err := NewReplica(Config{})
	if err != nil {
		t.Fatal(err)
	}
	if _, err = r.Open(context.Background(), "window://sales/main"); !errors.Is(err, ErrUnsupported) {
		t.Fatalf("unregistered capability used: %v", err)
	}
}
