package resource

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
)

type indexedWindowSource struct {
	uri        identity.ResourceURI
	raw        json.RawMessage
	candidates int
	reads      int
}

func (s *indexedWindowSource) Candidates(_ context.Context, uri identity.ResourceURI) ([]identity.ResourceCandidate, error) {
	s.candidates++
	if uri != s.uri {
		return nil, identity.ErrResourceDenied
	}
	return []identity.ResourceCandidate{{Kind: identity.WorkingCandidate, ContentFingerprint: identity.ContentFingerprint(s.raw)}}, nil
}
func (s *indexedWindowSource) ReadCandidate(_ context.Context, uri identity.ResourceURI, candidate identity.ResourceCandidate) (json.RawMessage, error) {
	s.reads++
	if uri != s.uri || candidate.Kind != identity.WorkingCandidate || candidate.ContentFingerprint != identity.ContentFingerprint(s.raw) {
		return nil, identity.ErrResourceDenied
	}
	return append(json.RawMessage(nil), s.raw...), nil
}

type indexedWindowPolicy func(context.Context, identity.ResourceRef, []identity.ResourceCandidate) (identity.ResourceDecision, error)

func (p indexedWindowPolicy) SelectRevision(ctx context.Context, ref identity.ResourceRef, candidates []identity.ResourceCandidate) (identity.ResourceDecision, error) {
	return p(ctx, ref, candidates)
}

func indexedWindowBytes(t *testing.T, id string) json.RawMessage {
	t.Helper()
	variant := types.WindowResourceVariant{Window: &types.Window{View: types.View{Content: &types.Container{ID: id}}}, DataSources: map[string]json.RawMessage{}}
	fingerprint, err := types.WindowVariantFingerprint(variant)
	require.NoError(t, err)
	envelope := types.WindowResourceEnvelope{
		SchemaVersion: 2,
		Format:        types.WindowBundleFormat,
		Targets:       []types.WindowTargetBinding{{Target: types.WindowTarget{}, Variant: fingerprint}},
		Variants:      map[string]types.WindowResourceVariant{fingerprint: variant},
	}
	raw, err := json.Marshal(envelope)
	require.NoError(t, err)
	require.NoError(t, envelope.Validate())
	return raw
}

func indexedWindowFixture(t *testing.T, uris ...string) (*LocalProvider, map[string]*indexedWindowSource, *[]primitive.ResourceState, *int) {
	t.Helper()
	now := time.Now().UTC()
	actor := identity.VerifiedActor{Subject: "index-user", Issuer: "https://fixture.invalid", TenantID: "team", AccountID: "account-index", IdentityRevision: "index-facts-1", ValidUntil: now.Add(time.Minute)}
	sources := map[string]*indexedWindowSource{}
	bindings := make([]LocalResourceBinding, 0, len(uris))
	index := make([]primitive.ResourceState, 0, len(uris))
	for _, value := range uris {
		uri, err := identity.ParseResourceURI(value)
		require.NoError(t, err)
		raw := indexedWindowBytes(t, uri.Name)
		source := &indexedWindowSource{uri: uri, raw: raw}
		sources[value] = source
		binding := LocalResourceBinding{URI: value, Title: "title-" + uri.Name, FormatVersion: 2, Resolver: func(_ context.Context, requestActor identity.VerifiedActor, _ string) (*identity.ResourceResolver, error) {
			policy := indexedWindowPolicy(func(_ context.Context, ref identity.ResourceRef, candidates []identity.ResourceCandidate) (identity.ResourceDecision, error) {
				if ref.Revision != "" && ref.Revision != identity.WorkingCandidate || len(candidates) != 1 {
					return identity.ResourceDecision{}, identity.ErrResourceDenied
				}
				return identity.ResourceDecision{Candidate: candidates[0], AuthorityBinding: "authority-" + requestActor.AccountID, ValidUntil: requestActor.ValidUntil}, nil
			})
			return &identity.ResourceResolver{ProviderIdentity: "local-index", Source: source, Policy: policy}, nil
		}}
		bindings = append(bindings, binding)
		index = append(index, primitive.ResourceState{Kind: "window", Namespace: uri.Namespace, Name: uri.Name, URI: value, Title: binding.Title, Lifecycle: identity.WorkingCandidate, Revision: identity.WorkingCandidate, FormatVersion: binding.FormatVersion, ContentFingerprint: identity.ContentFingerprint(raw)})
	}
	visible := true
	indexCalls := 0
	provider, err := NewLocalProvider(LocalConfig{
		ProviderIdentity: "local-index",
		Actor:            func(context.Context) (identity.VerifiedActor, error) { return actor, nil },
		Verify: func(_ context.Context, expected identity.VerifiedActor) error {
			if !expected.Valid(time.Now()) || !sameLocalActor(expected, actor) {
				return identity.ErrResourceDenied
			}
			return nil
		},
		Authorize: func(_ context.Context, _ identity.VerifiedActor, uri identity.ResourceURI, _ string) error {
			if uri.Namespace == "private" {
				return identity.ErrResourceDenied
			}
			return nil
		},
		Bindings:   bindings,
		Validators: map[string]LocalResourceValidator{"window": ValidateWindowBundle},
		WindowIndex: func(context.Context) ([]primitive.ResourceState, error) {
			indexCalls++
			return append([]primitive.ResourceState(nil), index...), nil
		},
		WindowListVisibility: func(_ context.Context, _ identity.VerifiedActor, _ LocalResourceBinding) (bool, error) {
			return visible, nil
		},
	})
	require.NoError(t, err)
	return provider, sources, &index, &indexCalls
}

func TestLocalWindowIndexListDoesNotResolveOrReadWindowBodies(t *testing.T) {
	provider, sources, _, indexCalls := indexedWindowFixture(t, "window://team/orders", "window://team/inventory")
	updateLocalProvider(t, provider, func(config *LocalConfig) {
		config.WindowListVisibility = func(context.Context, identity.VerifiedActor, LocalResourceBinding) (bool, error) {
			return true, nil
		}
	})
	listed, err := provider.List(context.Background(), "window", primitive.ListRequest{Namespace: "team", Limit: 1})
	require.NoError(t, err)
	require.Len(t, listed.Resources, 1)
	require.Equal(t, "window://team/inventory", listed.Resources[0].URI)
	require.False(t, listed.Complete)
	require.Equal(t, "1", listed.NextCursor)
	require.Equal(t, 2, *indexCalls, "index once before and once after visibility callbacks")
	for _, source := range sources {
		require.Zero(t, source.candidates, "window list must not resolve policy candidates")
		require.Zero(t, source.reads, "window list must not read or parse definitions")
	}
	second, err := provider.List(context.Background(), "window", primitive.ListRequest{Namespace: "team", Cursor: listed.NextCursor, Limit: 1})
	require.NoError(t, err)
	require.Len(t, second.Resources, 1)
	require.Equal(t, "window://team/orders", second.Resources[0].URI)
	require.True(t, second.Complete)
	require.Equal(t, 4, *indexCalls, "each page confirms a fresh static index")
}

func TestLocalWindowIndexFiltersGroupsAndPrivateNamespaces(t *testing.T) {
	provider, sources, _, _ := indexedWindowFixture(t, "window://team/hidden", "window://private/owner-only")
	updateLocalProvider(t, provider, func(config *LocalConfig) {
		config.WindowListVisibility = func(_ context.Context, _ identity.VerifiedActor, binding LocalResourceBinding) (bool, error) {
			return binding.URI != "window://team/hidden", nil
		}
	})
	listed, err := provider.List(context.Background(), "window", primitive.ListRequest{})
	require.NoError(t, err)
	require.Empty(t, listed.Resources)
	for _, source := range sources {
		require.Zero(t, source.candidates)
		require.Zero(t, source.reads)
	}
	_, err = provider.List(context.Background(), "window", primitive.ListRequest{Namespace: "unknown"})
	require.ErrorIs(t, err, identity.ErrResourceDenied)
	_, err = provider.List(context.Background(), "window", primitive.ListRequest{Namespace: "private"})
	require.NoError(t, err, "configured private namespace is filtered by the explicit authorizer")
}

func TestLocalWindowIndexRequiresAuthenticatedActorBeforeSnapshot(t *testing.T) {
	provider, _, _, indexCalls := indexedWindowFixture(t, "window://team/orders")
	updateLocalProvider(t, provider, func(config *LocalConfig) {
		config.Actor = func(context.Context) (identity.VerifiedActor, error) { return identity.VerifiedActor{}, nil }
	})
	listed, err := provider.List(context.Background(), "window", primitive.ListRequest{})
	require.Nil(t, listed)
	require.ErrorIs(t, err, identity.ErrResourceDenied)
	require.Zero(t, *indexCalls, "unauthenticated callers must not trigger the window index")
}

func TestLocalWindowIndexDoesNotExtendOriginalActorLease(t *testing.T) {
	provider, _, _, indexCalls := indexedWindowFixture(t, "window://team/orders")
	clock := time.Now().UTC()
	actor := identity.VerifiedActor{Subject: "index-user", Issuer: "https://fixture.invalid", TenantID: "team", AccountID: "account-index", IdentityRevision: "index-facts-1", ValidUntil: clock.Add(time.Second)}
	updateLocalProvider(t, provider, func(config *LocalConfig) {
		config.Now = func() time.Time { return clock }
	})
	updateLocalProvider(t, provider, func(config *LocalConfig) {
		config.Actor = func(context.Context) (identity.VerifiedActor, error) { return actor, nil }
	})
	updateLocalProvider(t, provider, func(config *LocalConfig) {
		config.Verify = func(context.Context, identity.VerifiedActor) error { return nil }
	})
	updateLocalProvider(t, provider, func(config *LocalConfig) {
		config.WindowListVisibility = func(context.Context, identity.VerifiedActor, LocalResourceBinding) (bool, error) {
			clock = actor.ValidUntil.Add(time.Nanosecond)
			return true, nil
		}
	})
	listed, err := provider.List(context.Background(), "window", primitive.ListRequest{})
	require.Nil(t, listed)
	require.ErrorIs(t, err, identity.ErrResourceDenied)
	require.Equal(t, 2, *indexCalls)
}

func TestLocalWindowIndexRejectsCallerRolesAndMetadataDrift(t *testing.T) {
	provider, sources, index, indexCalls := indexedWindowFixture(t, "window://team/orders")
	call, err := provider.call(context.Background(), "windows/list", json.RawMessage(`{"namespace":"team","roles":["admin"]}`))
	require.Nil(t, call)
	require.ErrorIs(t, err, identity.ErrResource)
	for _, source := range sources {
		require.Zero(t, source.candidates)
		require.Zero(t, source.reads)
	}

	mutated := false
	updateLocalProvider(t, provider, func(config *LocalConfig) {
		config.WindowListVisibility = func(_ context.Context, _ identity.VerifiedActor, _ LocalResourceBinding) (bool, error) {
			if !mutated {
				(*index)[0].Title = "changed-during-visibility"
				mutated = true
			}
			return true, nil
		}
	})
	listed, err := provider.List(context.Background(), "window", primitive.ListRequest{Namespace: "team"})
	require.Nil(t, listed)
	require.ErrorIs(t, err, identity.ErrResourceStale)
	require.True(t, mutated)
	require.Equal(t, 2, *indexCalls)
	for _, source := range sources {
		require.Zero(t, source.candidates)
		require.Zero(t, source.reads)
	}
}

func TestLocalWindowIndexDoesNotWeakenAuthenticatedGet(t *testing.T) {
	provider, sources, _, _ := indexedWindowFixture(t, "window://team/orders")
	result, err := provider.Get(context.Background(), "window", primitive.GetRequest{URI: "window://team/orders"})
	require.NoError(t, err)
	require.NotNil(t, result.ResolvedResource)
	require.Equal(t, "local-index", result.ResolvedResource.ProviderIdentity)
	require.Equal(t, 1, sources["window://team/orders"].candidates)
	require.Equal(t, 1, sources["window://team/orders"].reads)

	updateLocalProvider(t, provider, func(config *LocalConfig) {
		config.Authorize = func(_ context.Context, _ identity.VerifiedActor, _ identity.ResourceURI, action string) error {
			if action == "resource.get" {
				return identity.ErrResourceDenied
			}
			return nil
		}
	})
	result, err = provider.Get(context.Background(), "window", primitive.GetRequest{URI: "window://team/orders"})
	require.Nil(t, result)
	require.ErrorIs(t, err, identity.ErrResourceDenied)
}

func TestLocalWindowIndexSuppressesGroupDenialAndFailsClosedOnProviderError(t *testing.T) {
	provider, _, _, _ := indexedWindowFixture(t, "window://team/orders")
	updateLocalProvider(t, provider, func(config *LocalConfig) {
		config.WindowListVisibility = func(context.Context, identity.VerifiedActor, LocalResourceBinding) (bool, error) {
			return false, identity.ErrResourceDenied
		}
	})
	listed, err := provider.List(context.Background(), "window", primitive.ListRequest{})
	require.NoError(t, err)
	require.Empty(t, listed.Resources)
	updateLocalProvider(t, provider, func(config *LocalConfig) {
		config.WindowListVisibility = func(context.Context, identity.VerifiedActor, LocalResourceBinding) (bool, error) {
			return false, errors.New("visibility backend unavailable")
		}
	})
	listed, err = provider.List(context.Background(), "window", primitive.ListRequest{})
	require.Nil(t, listed)
	require.ErrorContains(t, err, "visibility backend unavailable")
}

func TestLocalWindowIndexRechecksVisibilityAfterAllInitialGroupChecks(t *testing.T) {
	uris := make([]string, 0, 20)
	for _, group := range []string{"group-a", "group-b"} {
		for i := 0; i < 10; i++ {
			uris = append(uris, fmt.Sprintf("window://team/%s-%02d", group, i))
		}
	}
	provider, sources, _, indexCalls := indexedWindowFixture(t, uris...)
	visibilityCalls := 0
	revoked := false
	updateLocalProvider(t, provider, func(config *LocalConfig) {
		config.WindowListVisibility = func(_ context.Context, _ identity.VerifiedActor, binding LocalResourceBinding) (bool, error) {
			visibilityCalls++
			if visibilityCalls == 20 {
				// The last initial check revokes group-a without changing the actor.
				revoked = true
			}
			if revoked && strings.HasPrefix(binding.URI, "window://team/group-a-") {
				return false, nil
			}
			return true, nil
		}
	})

	listed, err := provider.List(context.Background(), "window", primitive.ListRequest{})
	require.NoError(t, err)
	require.Len(t, listed.Resources, 10)
	require.True(t, revoked)
	require.Equal(t, 40, visibilityCalls, "every visible entry receives a final group-visibility check")
	for _, row := range listed.Resources {
		require.True(t, strings.HasPrefix(row.URI, "window://team/group-b-"), "revoked group must not leak in the returned page")
	}
	require.Equal(t, 2, *indexCalls)
	for _, source := range sources {
		require.Zero(t, source.candidates, "static listing must not resolve candidates")
		require.Zero(t, source.reads, "static listing must not read definitions")
	}
}

func TestLocalWindowIndexWithoutGroupCallbackStaysMetadataOnly(t *testing.T) {
	provider, sources, _, indexCalls := indexedWindowFixture(t, "window://team/orders", "window://team/inventory")
	updateLocalProvider(t, provider, func(config *LocalConfig) {
		config.WindowListVisibility = nil
	})
	listed, err := provider.List(context.Background(), "window", primitive.ListRequest{Namespace: "team"})
	require.NoError(t, err)
	require.Len(t, listed.Resources, 2)
	require.Equal(t, 2, *indexCalls)
	for _, source := range sources {
		require.Zero(t, source.candidates, "group-free list must not select a resource revision")
		require.Zero(t, source.reads, "group-free list must not read a resource body")
	}
}
