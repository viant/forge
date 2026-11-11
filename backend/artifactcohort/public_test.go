package artifactcohort

import (
	"context"
	"encoding/json"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/viant/authz"
)

type publicOnlyCaller struct{ p *Publisher }

func (c publicOnlyCaller) Discover(ctx context.Context) (Manifest, error) {
	if err := ctx.Err(); err != nil {
		return Manifest{}, err
	}
	return c.p.PublicSnapshot()
}
func (c publicOnlyCaller) Fetch(ctx context.Context, input FetchInput) (*Artifact, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	return c.p.FetchPublic(input)
}

type unavailablePublicFacts struct{ calls atomic.Int32 }

func (f *unavailablePublicFacts) Resolve(context.Context) (authz.Facts, error) {
	f.calls.Add(1)
	return authz.Facts{}, ErrDenied
}

func publicStyleFixture(t *testing.T) (*Publisher, RootRef, Cohort) {
	t.Helper()
	p := NewPublisher()
	a, _, err := p.Publish(context.Background(), RootRef{URI: "style://shared/base", Kind: "style", Version: 1}, json.RawMessage(`{"schemaVersion":1,"css":".surface { color: purple; }"}`), allowPublished)
	require.NoError(t, err)
	c := Cohort{Tenant: "tenant", Name: "shared-base", Public: true, Roots: []RootRef{a.Root}}
	_, err = p.ReplaceCatalog(context.Background(), nil, []Cohort{c}, p.Generation())
	require.NoError(t, err)
	return p, a.Root, c
}

func TestPublicStyleCohortNeedsNoUserFactsAndWithdraws(t *testing.T) {
	p, root, cohort := publicStyleFixture(t)
	ctx := context.Background()
	facts := &unavailablePublicFacts{}
	var sessions atomic.Int32
	r, err := NewReplica(Config{Enabled: true, Source: "public-style", Tenant: "tenant", Account: "owner", Caller: publicOnlyCaller{p}, Facts: facts, SessionKey: func(context.Context) (string, error) { sessions.Add(1); return "", ErrDenied }})
	require.NoError(t, err)
	require.NoError(t, r.Sync(ctx))
	metadata, err := NewMetadataSource(r, []string{"shared"})
	require.NoError(t, err)
	for i := 0; i < 100; i++ {
		require.NoError(t, r.EnsureAdmitted(ctx))
		view, err := r.Open(ctx, root.URI)
		require.NoError(t, err)
		require.Equal(t, root, view.Ref())
		_, err = metadata.AuthorityKey(ctx, root.URI)
		require.NoError(t, err)
		_, err = metadata.MetadataGeneration(ctx, "style")
		require.NoError(t, err)
	}
	require.Zero(t, facts.calls.Load())
	require.Zero(t, sessions.Load())
	canceled, cancel := context.WithCancel(ctx)
	cancel()
	require.ErrorIs(t, r.EnsureAdmitted(canceled), context.Canceled)
	_, err = r.Open(canceled, root.URI)
	require.ErrorIs(t, err, context.Canceled)
	_, err = metadata.MetadataGeneration(canceled, "style")
	require.ErrorIs(t, err, context.Canceled)
	ref, exists, err := p.LookupPublicRoot("tenant", root.URI)
	require.NoError(t, err)
	require.True(t, exists)
	require.Equal(t, root, ref)
	_, err = p.FetchPublic(FetchInput{Tenant: "other", Root: root})
	require.ErrorIs(t, err, ErrDenied)
	_, err = p.ReplaceCatalog(ctx, nil, nil, p.Generation())
	require.NoError(t, err)
	require.False(t, p.PublicOnly())
	require.True(t, p.PublicReadable())
	empty, err := p.PublicSnapshot()
	require.NoError(t, err)
	require.Empty(t, empty.Cohorts)
	require.NoError(t, r.Sync(ctx))
	require.NoError(t, r.EnsureAdmitted(ctx))
	_, err = r.Open(ctx, root.URI)
	require.ErrorIs(t, err, ErrDenied)
	_, err = p.FetchPublic(FetchInput{Tenant: "tenant", Root: root})
	require.ErrorIs(t, err, ErrDenied)
	_, exists, err = p.LookupPublicRoot("tenant", root.URI)
	require.NoError(t, err)
	require.False(t, exists)
	_, err = p.ReplaceCatalog(ctx, nil, []Cohort{cohort}, p.Generation())
	require.NoError(t, err)
	require.NoError(t, r.Sync(ctx))
	require.NoError(t, r.EnsureAdmitted(ctx))
	resource := authz.Resource{Tenant: "tenant", Kind: "cohort", ID: "members", Version: "logical"}
	doc := authz.Document{Resource: resource, Revision: 1, Policies: map[string]authz.Policy{PolicyAction: {Mode: "protected", Rule: &authz.Rule{Kind: "role", Value: "member"}}}}
	private := Cohort{Tenant: "tenant", Name: "members", PolicyResource: resource, Roots: []RootRef{root}}
	_, err = p.ReplaceCatalog(ctx, []authz.Document{doc}, []Cohort{private}, p.Generation())
	require.NoError(t, err)
	require.ErrorIs(t, r.Sync(ctx), ErrDenied)
	_, err = r.Open(ctx, root.URI)
	require.ErrorIs(t, err, ErrDenied)
	require.Zero(t, facts.calls.Load(), "a withdrawn public grant cannot fall through to unrelated identity work")
}

func TestPublicSnapshotAndFetchAreAtomicWithPrivatePublication(t *testing.T) {
	p, root, public := publicStyleFixture(t)
	ctx := context.Background()
	resource := authz.Resource{Tenant: "tenant", Kind: "cohort", ID: "members", Version: "logical"}
	doc := authz.Document{Resource: resource, Revision: 1, Policies: map[string]authz.Policy{PolicyAction: {Mode: "protected", Rule: &authz.Rule{Kind: "role", Value: "member"}}}}
	private := Cohort{Tenant: "tenant", Name: "members", PolicyResource: resource, Roots: []RootRef{root}}
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		for i := 0; i < 100; i++ {
			m, err := p.PublicSnapshot()
			if err == nil {
				require.Empty(t, m.Policies)
				for _, c := range m.Cohorts {
					require.True(t, c.Public)
				}
			} else {
				require.ErrorIs(t, err, ErrDenied)
			}
			a, err := p.FetchPublic(FetchInput{Tenant: "tenant", Root: root})
			if err == nil {
				require.Equal(t, root, a.Root)
			} else {
				require.ErrorIs(t, err, ErrDenied)
			}
		}
	}()
	for i := 0; i < 30; i++ {
		_, err := p.ReplaceCatalog(ctx, []authz.Document{doc}, []Cohort{private}, p.Generation())
		require.NoError(t, err)
		_, err = p.ReplaceCatalog(ctx, nil, []Cohort{public}, p.Generation())
		require.NoError(t, err)
	}
	wg.Wait()
}

func TestPublicCohortRejectsConflictingPolicy(t *testing.T) {
	p, _, cohort := publicStyleFixture(t)
	cohort.PolicyResource = authz.Resource{Tenant: "tenant", Kind: "cohort", ID: "hidden", Version: "logical"}
	_, err := p.ReplaceCatalog(context.Background(), nil, []Cohort{cohort}, p.Generation())
	require.ErrorIs(t, err, ErrInvalid)
}
