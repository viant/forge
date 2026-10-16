package provider

import (
	"context"
	"encoding/json"
	"errors"
	identity "github.com/viant/forge/backend/resource"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	primitive "github.com/viant/forge/backend/provider/contract"
	"github.com/viant/forge/backend/provider/contract/observe"
	"github.com/viant/mcp-protocol/schema"
)

func TestProviderObservationsHaveBoundedMetadataAndNoPayload(t *testing.T) {
	p, c, alice, _ := catalogFixture(t)
	c.records["report://users/alice/secret-token-path"] = catalogRecord{"alice", json.RawMessage(`{"secret":"definition-private"}`)}
	var mu sync.Mutex
	events := []observe.Event{}
	ctx := observe.WithObserver(alice, observe.ObserverFunc(func(event observe.Event) { mu.Lock(); events = append(events, event); mu.Unlock() }))
	client, err := NewLocalMCPClient(p)
	require.NoError(t, err)
	result, err := client.CallTool(ctx, &schema.CallToolRequestParams{Name: "reports/get", Arguments: map[string]interface{}{"uri": "report://users/alice/secret-token-path"}})
	require.NoError(t, err)
	require.False(t, *result.IsError)
	phases := map[observe.Phase]bool{}
	for _, event := range events {
		phases[event.Phase] = true
		require.NotContains(t, event.Namespace, "alice")
		require.NotContains(t, event.Namespace, "secret")
		require.LessOrEqual(t, len(event.Provider), 128)
	}
	for _, phase := range []observe.Phase{observe.MCPDispatch, observe.Serialization, observe.ProviderGet, observe.SourceLookup, observe.BindingResolver, observe.RevisionResolve, observe.RevisionRead, observe.Validation, observe.Authorization, observe.Identity} {
		require.True(t, phases[phase], string(phase))
	}
	raw, err := json.Marshal(events)
	require.NoError(t, err)
	for _, secret := range []string{"alice", "secret-token-path", "definition-private", "report://"} {
		require.NotContains(t, string(raw), secret)
	}
	c.failure = errors.New("secret raw server error")
	_, err = p.Get(ctx, "report", primitive.GetRequest{URI: "report://users/alice/secret-token-path"})
	require.Error(t, err)
	require.Equal(t, observe.Error, events[len(events)-1].Outcome)
	raw, err = json.Marshal(events)
	require.NoError(t, err)
	require.NotContains(t, string(raw), "secret raw server error")
}
func TestProviderObserverConcurrentRequestsAndValidationCacheState(t *testing.T) {
	p, c, alice, _ := catalogFixture(t)
	c.records["report://users/alice/one"] = catalogRecord{"alice", json.RawMessage(`{}`)}
	var validations, cacheHits atomic.Int64
	ctx := observe.WithObserver(alice, observe.ObserverFunc(func(event observe.Event) {
		if event.Phase == observe.Validation {
			validations.Add(1)
			if event.Cache == observe.CacheHit {
				cacheHits.Add(1)
			}
		}
	}))
	p.definitionValidationCache = func(_ identity.ResourceSource, _ string, _ int64, _ string, _ LocalResourceValidator) bool {
		return true
	}
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 10; j++ {
				_, err := p.Get(ctx, "report", primitive.GetRequest{URI: "report://users/alice/one"})
				if err != nil {
					t.Error(err)
				}
			}
		}()
	}
	wg.Wait()
	require.Equal(t, int64(80), validations.Load())
	require.Equal(t, validations.Load(), cacheHits.Load())
}
func BenchmarkProviderObserver(b *testing.B) {
	for _, enabled := range []bool{false, true} {
		name := "disabled"
		if enabled {
			name = "enabled"
		}
		b.Run(name, func(b *testing.B) {
			// Reuse one persistent producer. Test fixture requires *testing.T, so create
			// the equivalent context-backed dynamic source here without test scaffolding.
			source := &mutableCatalog{records: map[string]catalogRecord{"report://users/alice/one": {"alice", json.RawMessage(`{}`)}}, declarations: []primitive.NamespaceCapabilities{{Namespace: "users", Kinds: []primitive.KindSupport{{Kind: "report", FormatVersions: []int64{1}}}}}}
			actor := identity.VerifiedActor{Subject: "alice", Issuer: "fixture", TenantID: "tenant", AccountID: "account", IdentityRevision: "r1", ValidUntil: time.Now().Add(time.Hour)}
			ctx := context.WithValue(context.Background(), catalogActorKey{}, actor)
			p, err := NewLocalProvider(LocalConfig{ProviderIdentity: "managing", Catalog: source, Actor: func(context.Context) (identity.VerifiedActor, error) { return actor, nil }, Verify: func(context.Context, identity.VerifiedActor) error { return nil }, Authorize: func(context.Context, identity.VerifiedActor, identity.ResourceURI, string) error { return nil }, Validators: map[string]LocalResourceValidator{"report": func(int64, json.RawMessage) error { return nil }}})
			if err != nil {
				b.Fatal(err)
			}
			if enabled {
				ctx = observe.WithObserver(ctx, observe.ObserverFunc(func(observe.Event) {}))
			}
			b.ReportAllocs()
			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				_, err := p.Get(ctx, "report", primitive.GetRequest{URI: "report://users/alice/one"})
				if err != nil {
					b.Fatal(err)
				}
			}
		})
	}
}

func TestObservationDoesNotChangeNilProviderError(t *testing.T) {
	ctx := observe.WithObserver(context.Background(), observe.ObserverFunc(func(observe.Event) {}))
	var p *LocalProvider
	_, err := p.NamespaceList(ctx, primitive.NamespaceListRequest{})
	require.ErrorIs(t, err, identity.ErrResourceDenied)
}
