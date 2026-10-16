package resource

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
	producer "github.com/viant/forge/backend/resourcehost/producer"
	"github.com/viant/mcp-protocol/schema"
)

func TestLocalProviderReusesGenerationAndRechecksAuthority(t *testing.T) {
	p, _, _, revoked := localFixture(t)
	actorCalls, verifyCalls, authorizeCalls := 0, 0, 0
	updateLocalProvider(t, p, func(config *LocalConfig) {
		actor, verify, authorize := config.Actor, config.Verify, config.Authorize
		config.Actor = func(ctx context.Context) (identity.VerifiedActor, error) { actorCalls++; return actor(ctx) }
		config.Verify = func(ctx context.Context, a identity.VerifiedActor) error { verifyCalls++; return verify(ctx, a) }
		config.Authorize = func(ctx context.Context, a identity.VerifiedActor, uri identity.ResourceURI, action string) error {
			authorizeCalls++
			return authorize(ctx, a, uri, action)
		}
	})
	generation, err := p.neutral()
	require.NoError(t, err)
	for i := 0; i < 5; i++ {
		beforeActor, beforeVerify, beforeAuthorize := actorCalls, verifyCalls, authorizeCalls
		_, err = p.List(context.Background(), "window", primitive.ListRequest{Namespace: "team"})
		require.NoError(t, err)
		_, err = p.Get(context.Background(), "window", primitive.GetRequest{URI: "window://team/sales"})
		require.NoError(t, err)
		require.Greater(t, actorCalls, beforeActor)
		require.Greater(t, verifyCalls, beforeVerify)
		require.Greater(t, authorizeCalls, beforeAuthorize)
		same, err := p.neutral()
		require.NoError(t, err)
		require.Same(t, generation, same, "warm list/get must retain the constructed producer")
	}
	*revoked = true
	_, err = p.Get(context.Background(), "window", primitive.GetRequest{URI: "window://team/sales"})
	require.ErrorIs(t, err, identity.ErrResourceDenied)
	require.Same(t, generation, p.provider.Load(), "request revocation must not require reconstruction")
}

func TestLocalProviderNativeConfigurationPublishesValidatedGeneration(t *testing.T) {
	p, _, _, _ := localFixture(t)
	original := p.provider.Load()
	resources := []producer.NativeResource{{Metadata: schema.Resource{Uri: "agently-runtime://workspace/document"}, Read: func(context.Context) ([]byte, error) { return []byte("document"), nil }}}
	require.Error(t, p.ConfigureNativeResources(append(resources, resources[0])))
	require.Same(t, original, p.provider.Load(), "invalid composition must retain original producer")
	require.NoError(t, p.ConfigureNativeResources(resources))
	configured := p.provider.Load()
	require.NotSame(t, original, configured)
	require.Len(t, original.ConfigurationSnapshot().NativeResources, 0, "old handlers retain their configured generation")
	require.Len(t, configured.ConfigurationSnapshot().NativeResources, 1)
	require.Error(t, p.ConfigureNativeResources(resources))
	require.Same(t, configured, p.provider.Load())
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 100; j++ {
				n, err := p.neutral()
				if err != nil || n != configured {
					t.Error("published generation changed")
					return
				}
			}
		}()
	}
	wg.Wait()
}

// The payload is deliberately small so Get measures catalog-size effects rather
// than YAML decoding. All source checks, validators and authority callbacks run.
func benchmarkLocalProvider(b *testing.B, size int) *LocalProvider {
	b.Helper()
	now := time.Now()
	actor := identity.VerifiedActor{Subject: "reader", Issuer: "fixture", TenantID: "team", AccountID: "account", IdentityRevision: "r1", ValidUntil: now.Add(time.Hour)}
	source := &localFixtureSource{raw: json.RawMessage(`{"name":"benchmark"}`)}
	bindings := make([]LocalResourceBinding, size)
	for i := range bindings {
		bindings[i] = LocalResourceBinding{URI: fmt.Sprintf("skill://team/item-%04d", i), FormatVersion: 1, Resolver: func(_ context.Context, a identity.VerifiedActor, _ string) (*identity.ResourceResolver, error) {
			return &identity.ResourceResolver{ProviderIdentity: "benchmark", Source: source, Policy: localFixturePolicy{actor: a}}, nil
		}}
	}
	p, err := NewLocalProvider(LocalConfig{ProviderIdentity: "benchmark", Actor: func(context.Context) (identity.VerifiedActor, error) { return actor, nil }, Verify: func(context.Context, identity.VerifiedActor) error { return nil }, Authorize: func(context.Context, identity.VerifiedActor, identity.ResourceURI, string) error { return nil }, Bindings: bindings, Validators: map[string]LocalResourceValidator{"skill": func(int64, json.RawMessage) error { return nil }}})
	if err != nil {
		b.Fatal(err)
	}
	return p
}

func BenchmarkLocalProviderWarm(b *testing.B) {
	for _, size := range []int{20, 1000} {
		b.Run(fmt.Sprintf("bindings=%d", size), func(b *testing.B) {
			for _, operation := range []string{"delegate", "get", "list", "indexed-window-list"} {
				b.Run(operation, func(b *testing.B) {
					p := benchmarkLocalProvider(b, size)
					if operation == "indexed-window-list" {
						config := localProviderConfig(p)
						index := make([]primitive.ResourceState, len(config.Bindings))
						for i := range config.Bindings {
							config.Bindings[i].URI = strings.Replace(config.Bindings[i].URI, "skill://", "window://", 1)
							uri, err := identity.ParseResourceURI(config.Bindings[i].URI)
							if err != nil {
								b.Fatal(err)
							}
							index[i] = primitive.ResourceState{Kind: "window", Namespace: uri.Namespace, Name: uri.Name, URI: uri.String(), FormatVersion: 1, Lifecycle: identity.WorkingCandidate, Revision: identity.WorkingCandidate, ContentFingerprint: identity.ContentFingerprint(json.RawMessage(`{"name":"benchmark"}`))}
						}
						config.Validators = map[string]LocalResourceValidator{"window": func(int64, json.RawMessage) error { return nil }}
						config.WindowIndex = func(context.Context) ([]primitive.ResourceState, error) { return index, nil }
						var err error
						p, err = NewLocalProvider(config)
						if err != nil {
							b.Fatal(err)
						}
					}
					generation := p.provider.Load()
					ctx := context.Background()
					b.ReportAllocs()
					b.ResetTimer()
					for i := 0; i < b.N; i++ {
						var err error
						switch operation {
						case "delegate":
							var n *producer.LocalProvider
							n, err = p.neutral()
							if n != generation {
								b.Fatal("producer reconstructed")
							}
						case "get":
							_, err = p.Get(ctx, "skill", primitive.GetRequest{URI: "skill://team/item-0000"})
						case "list":
							_, err = p.List(ctx, "skill", primitive.ListRequest{Namespace: "team", Limit: 1})
						case "indexed-window-list":
							_, err = p.List(ctx, "window", primitive.ListRequest{Namespace: "team", Limit: 1})
						}
						if err != nil {
							b.Fatal(err)
						}
					}
					b.StopTimer()
					if p.provider.Load() != generation {
						b.Fatal("producer reconstructed")
					}
					b.ReportMetric(1, "producer-generations")
				})
			}
		})
	}
}
