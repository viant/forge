package provider

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/mcp-protocol/schema"
)

type catalogActorKey struct{}
type catalogRecord struct {
	owner string
	raw   json.RawMessage
}
type mutableCatalog struct {
	mu                             sync.RWMutex
	records                        map[string]catalogRecord
	declarations                   []primitive.NamespaceCapabilities
	namespaceCalls, lists, lookups atomic.Int64
	failure                        error
	invalidBinding                 *LocalResourceBinding
}

func (c *mutableCatalog) Namespaces() []primitive.NamespaceCapabilities {
	c.namespaceCalls.Add(1)
	return c.declarations
}
func (c *mutableCatalog) List(ctx context.Context, a identity.VerifiedActor, kind, namespace string) ([]LocalResourceBinding, error) {
	c.lists.Add(1)
	c.mu.RLock()
	defer c.mu.RUnlock()
	if c.failure != nil {
		return nil, c.failure
	}
	if c.invalidBinding != nil {
		return []LocalResourceBinding{*c.invalidBinding}, nil
	}
	var out []LocalResourceBinding
	for value, record := range c.records {
		uri, _ := identity.ParseResourceURI(value)
		if record.owner == a.Subject && uri.Kind == kind && (namespace == "" || uri.Namespace == namespace) {
			out = append(out, c.binding(uri, a))
		}
	}
	return out, nil
}
func (c *mutableCatalog) Lookup(ctx context.Context, a identity.VerifiedActor, uri identity.ResourceURI) (LocalResourceBinding, error) {
	c.lookups.Add(1)
	c.mu.RLock()
	defer c.mu.RUnlock()
	if c.failure != nil {
		return LocalResourceBinding{}, c.failure
	}
	if c.invalidBinding != nil {
		return *c.invalidBinding, nil
	}
	record, ok := c.records[uri.String()]
	if !ok {
		return LocalResourceBinding{}, ErrCatalogNotFound
	}
	if record.owner != a.Subject {
		return LocalResourceBinding{}, identity.ErrResourceDenied
	}
	return c.binding(uri, a), nil
}
func (c *mutableCatalog) binding(uri identity.ResourceURI, a identity.VerifiedActor) LocalResourceBinding {
	return LocalResourceBinding{URI: uri.String(), OwnerID: a.Subject, Title: uri.Name, FormatVersion: 1, Resolver: func(ctx context.Context, a identity.VerifiedActor, _ string) (*identity.ResourceResolver, error) {
		return &identity.ResourceResolver{ProviderIdentity: "managing", Source: &identity.LocalResource{URI: uri, Load: func(context.Context) (json.RawMessage, error) {
			c.mu.RLock()
			defer c.mu.RUnlock()
			record, ok := c.records[uri.String()]
			if !ok {
				return nil, ErrCatalogNotFound
			}
			if record.owner != a.Subject {
				return nil, identity.ErrResourceDenied
			}
			return append(json.RawMessage(nil), record.raw...), nil
		}}, Policy: catalogRevision{actor: a}}, nil
	}}
}

type catalogRevision struct{ actor identity.VerifiedActor }

func (p catalogRevision) SelectRevision(_ context.Context, ref identity.ResourceRef, cs []identity.ResourceCandidate) (identity.ResourceDecision, error) {
	if len(cs) != 1 || ref.Revision != "" && ref.Revision != identity.WorkingCandidate {
		return identity.ResourceDecision{}, identity.ErrResourceDenied
	}
	return identity.ResourceDecision{Candidate: cs[0], AuthorityBinding: "owner:" + p.actor.Subject, ValidUntil: p.actor.ValidUntil}, nil
}
func catalogFixture(t *testing.T) (*LocalProvider, *mutableCatalog, context.Context, context.Context) {
	t.Helper()
	source := &mutableCatalog{records: map[string]catalogRecord{}, declarations: []primitive.NamespaceCapabilities{{Namespace: "users", ProviderIdentity: "managing", Kinds: []primitive.KindSupport{{Kind: "report", FormatVersions: []int64{1}}}}}}
	p, err := NewLocalProvider(LocalConfig{ProviderIdentity: "managing", Catalog: source, Actor: func(ctx context.Context) (identity.VerifiedActor, error) {
		a, ok := ctx.Value(catalogActorKey{}).(identity.VerifiedActor)
		if !ok {
			return a, identity.ErrResourceDenied
		}
		return a, nil
	}, Verify: func(context.Context, identity.VerifiedActor) error { return nil }, Authorize: func(context.Context, identity.VerifiedActor, identity.ResourceURI, string) error { return nil }, Validators: map[string]LocalResourceValidator{"report": func(_ int64, raw json.RawMessage) error {
		if !json.Valid(raw) {
			return identity.ErrResource
		}
		return nil
	}}})
	require.NoError(t, err)
	actor := func(user string) context.Context {
		return context.WithValue(context.Background(), catalogActorKey{}, identity.VerifiedActor{Subject: user, Issuer: "fixture", TenantID: "tenant", AccountID: "account", IdentityRevision: "r1", ValidUntil: time.Now().Add(time.Hour)})
	}
	return p, source, actor("alice"), actor("bob")
}
func TestDynamicCatalogContractCapturedOnceAndPartialKinds(t *testing.T) {
	p, c, alice, _ := catalogFixture(t)
	require.Equal(t, int64(1), c.namespaceCalls.Load())
	require.Equal(t, []string{"namespaces/list", "namespaces/get", "reports/list", "reports/get"}, p.InstalledTools())
	c.declarations[0].Kinds[0].FormatVersions[0] = 9
	for i := 0; i < 3; i++ {
		ns, err := p.NamespaceList(alice, primitive.NamespaceListRequest{})
		require.NoError(t, err)
		require.Len(t, ns.Namespaces, 1)
		require.Equal(t, []string{"report"}, ns.Namespaces[0].Kinds)
		contract, err := p.NamespaceGet(alice, primitive.NamespaceGetRequest{Namespace: "users"})
		require.NoError(t, err)
		require.Equal(t, []int64{1}, contract.Kinds[0].FormatVersions)
	}
	require.Equal(t, int64(1), c.namespaceCalls.Load())
	require.Zero(t, c.lists.Load())
	require.Zero(t, c.lookups.Load())
	require.Same(t, c, p.ConfigurationSnapshot().Catalog)
}
func TestDynamicCatalogCurrentOwnerAndNewDeletedRecords(t *testing.T) {
	p, c, alice, bob := catalogFixture(t)
	listed, err := p.List(alice, "report", primitive.ListRequest{})
	require.NoError(t, err)
	require.Empty(t, listed.Resources)
	c.mu.Lock()
	c.records["report://users/alice/one"] = catalogRecord{"alice", json.RawMessage(`{"title":"One"}`)}
	c.records["report://users/bob/one"] = catalogRecord{"bob", json.RawMessage(`{"title":"Bob"}`)}
	c.mu.Unlock()
	listed, err = p.List(alice, "report", primitive.ListRequest{Namespace: "users"})
	require.NoError(t, err)
	require.Len(t, listed.Resources, 1)
	require.Equal(t, "alice", listed.Resources[0].OwnerID)
	before := c.lists.Load()
	got, err := p.Get(alice, "report", primitive.GetRequest{URI: "report://users/alice/one"})
	require.NoError(t, err)
	require.Equal(t, "alice", got.Resource.OwnerID)
	require.Equal(t, before, c.lists.Load(), "Get must do direct lookup without full inventory")
	_, err = p.Get(alice, "report", primitive.GetRequest{URI: "report://users/bob/one"})
	require.ErrorIs(t, err, identity.ErrResourceDenied)
	listed, err = p.List(bob, "report", primitive.ListRequest{})
	require.NoError(t, err)
	require.Len(t, listed.Resources, 1)
	require.Equal(t, "report://users/bob/one", listed.Resources[0].URI)
	c.mu.Lock()
	delete(c.records, "report://users/alice/one")
	c.mu.Unlock()
	listed, err = p.List(alice, "report", primitive.ListRequest{})
	require.NoError(t, err)
	require.Empty(t, listed.Resources)
	_, err = p.Get(alice, "report", primitive.GetRequest{URI: "report://users/alice/one"})
	require.ErrorIs(t, err, identity.ErrResourceDenied)
	require.Equal(t, int64(1), c.namespaceCalls.Load(), "saving/deleting does not construct a new producer")
}
func TestDynamicCatalogRejectsDeclarationAndBindingMismatch(t *testing.T) {
	p, c, alice, _ := catalogFixture(t)
	for _, invalid := range []primitive.NamespaceCapabilities{
		{Namespace: "users", ProviderIdentity: "other", Kinds: []primitive.KindSupport{{Kind: "report", FormatVersions: []int64{1}}}},
		{Namespace: "../users", Kinds: []primitive.KindSupport{{Kind: "report", FormatVersions: []int64{1}}}},
		{Namespace: "users", Kinds: []primitive.KindSupport{{Kind: "intent", FormatVersions: []int64{1}}}},
	} {
		c.declarations = []primitive.NamespaceCapabilities{invalid}
		_, err := NewLocalProvider(p.ConfigurationSnapshot())
		require.Error(t, err)
	}
	uri, _ := identity.ParseResourceURI("report://users/alice/valid")
	binding := c.binding(uri, identity.VerifiedActor{Subject: "alice"})
	for _, change := range []func(*LocalResourceBinding){func(b *LocalResourceBinding) { b.URI = "report://other/alice/valid" }, func(b *LocalResourceBinding) { b.URI = "intent://users/alice/valid" }, func(b *LocalResourceBinding) { b.FormatVersion = 2 }, func(b *LocalResourceBinding) { b.Resolver = nil }} {
		invalid := binding
		change(&invalid)
		c.invalidBinding = &invalid
		_, err := p.List(alice, "report", primitive.ListRequest{})
		require.ErrorIs(t, err, identity.ErrResource)
		_, err = p.Get(alice, "report", primitive.GetRequest{URI: uri.String()})
		require.ErrorIs(t, err, identity.ErrResource)
	}
}
func TestDynamicCatalogCollisionAndDenialNeverFallThrough(t *testing.T) {
	p, c, alice, _ := catalogFixture(t)
	uri, _ := identity.ParseResourceURI("report://users/alice/one")
	c.records[uri.String()] = catalogRecord{"alice", json.RawMessage(`{}`)}
	config := p.ConfigurationSnapshot()
	config.Bindings = []LocalResourceBinding{{URI: uri.String(), FormatVersion: 1, Resolver: func(_ context.Context, actor identity.VerifiedActor, _ string) (*identity.ResourceResolver, error) {
		return &identity.ResourceResolver{ProviderIdentity: "managing", Source: &identity.LocalResource{URI: uri, Load: func(context.Context) (json.RawMessage, error) { return json.RawMessage(`{}`), nil }}, Policy: catalogRevision{actor: actor}}, nil
	}}}
	p, err := NewLocalProvider(config)
	require.NoError(t, err)
	_, err = p.List(alice, "report", primitive.ListRequest{})
	require.ErrorIs(t, err, ErrCatalogCollision)
	_, err = p.Get(alice, "report", primitive.GetRequest{URI: uri.String()})
	require.ErrorIs(t, err, ErrCatalogCollision)
	c.failure = identity.ErrResourceDenied
	_, err = p.Get(alice, "report", primitive.GetRequest{URI: uri.String()})
	require.ErrorIs(t, err, identity.ErrResourceDenied, "managing denial cannot select static source")
	c.failure = errors.Join(ErrCatalogNotFound, identity.ErrResourceDenied)
	_, err = p.Get(alice, "report", primitive.GetRequest{URI: uri.String()})
	require.ErrorIs(t, err, identity.ErrResourceDenied, "joined denial must remain terminal")
	c.failure = errors.New("managing unavailable")
	_, err = p.List(alice, "report", primitive.ListRequest{})
	require.ErrorIs(t, err, c.failure)
	c.failure = nil
	delete(c.records, uri.String())
	got, err := p.Get(alice, "report", primitive.GetRequest{URI: uri.String()})
	require.NoError(t, err)
	require.Equal(t, uri.String(), got.Resource.URI, "explicit unknown permits the configured static source")
}
func TestDynamicCatalogConcurrentCurrentRecords(t *testing.T) {
	p, c, alice, _ := catalogFixture(t)
	c.records["report://users/alice/one"] = catalogRecord{"alice", json.RawMessage(`{}`)}
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 20; j++ {
				_, err := p.Get(alice, "report", primitive.GetRequest{URI: "report://users/alice/one"})
				if err != nil {
					t.Error(err)
				}
			}
		}()
	}
	wg.Wait()
	require.Equal(t, int64(1), c.namespaceCalls.Load())
	require.Zero(t, c.lists.Load())
}

func TestDynamicCatalogUsesExistingInMemoryMCPContract(t *testing.T) {
	p, c, alice, _ := catalogFixture(t)
	client, err := NewLocalMCPClient(p)
	require.NoError(t, err)
	call := func(name string, args map[string]interface{}) *schema.CallToolResult {
		t.Helper()
		result, err := client.CallTool(alice, &schema.CallToolRequestParams{Name: name, Arguments: args})
		require.NoError(t, err)
		return result
	}
	list := call("reports/list", map[string]interface{}{"namespace": "users"})
	raw, err := json.Marshal(list.StructuredContent)
	require.NoError(t, err)
	var before struct {
		Reports []primitive.ResourceState `json:"reports"`
	}
	require.NoError(t, json.Unmarshal(raw, &before))
	require.Empty(t, before.Reports)
	c.mu.Lock()
	c.records["report://users/alice/new"] = catalogRecord{"alice", json.RawMessage(`{"title":"New"}`)}
	c.mu.Unlock()
	list = call("reports/list", map[string]interface{}{"namespace": "users"})
	raw, err = json.Marshal(list.StructuredContent)
	require.NoError(t, err)
	require.NoError(t, json.Unmarshal(raw, &before))
	require.Len(t, before.Reports, 1)
	require.Equal(t, "alice", before.Reports[0].OwnerID)
	get := call("reports/get", map[string]interface{}{"uri": "report://users/alice/new"})
	require.False(t, *get.IsError)
	raw, err = json.Marshal(get.StructuredContent)
	require.NoError(t, err)
	var selected primitive.GetResult
	require.NoError(t, json.Unmarshal(raw, &selected))
	require.Equal(t, "report://users/alice/new", selected.Resource.URI)
	require.Equal(t, "managing", selected.ResolvedResource.ProviderIdentity)
	c.mu.Lock()
	delete(c.records, "report://users/alice/new")
	c.mu.Unlock()
	get = call("reports/get", map[string]interface{}{"uri": "report://users/alice/new"})
	require.True(t, *get.IsError, "deleted owning record must fail through the same MCP contract")
	require.Equal(t, int64(1), c.namespaceCalls.Load(), "same client and producer after save/delete")
}
