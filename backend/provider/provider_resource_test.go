// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"testing"
	"time"

	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
	windowprotocol "github.com/viant/forge/backend/window/contract"
)

type canonicalPolicy struct {
	chosen, binding string
	allowed         bool
	now             time.Time
}

func (p *canonicalPolicy) SelectRevision(_ context.Context, ref identity.ResourceRef, candidates []identity.ResourceCandidate) (identity.ResourceDecision, error) {
	if p.allowed && ref.URI == "window://planning/overview" {
		for _, c := range candidates {
			if c.Selector() == p.chosen {
				return identity.ResourceDecision{Candidate: c, AuthorityBinding: p.binding, ValidUntil: p.now.Add(time.Minute)}, nil
			}
		}
	}
	return identity.ResourceDecision{}, identity.ErrResourceDenied
}

type canonicalSource struct{ content map[string]json.RawMessage }

func (s *canonicalSource) Candidates(context.Context, identity.ResourceURI) ([]identity.ResourceCandidate, error) {
	var result []identity.ResourceCandidate
	for stamp, raw := range s.content {
		kind := identity.StampedCandidate
		revision := stamp
		if stamp == identity.WorkingCandidate {
			kind = identity.WorkingCandidate
			revision = ""
		}
		result = append(result, identity.ResourceCandidate{Kind: kind, Revision: revision, ContentFingerprint: identity.ContentFingerprint(raw)})
	}
	return result, nil
}
func (s *canonicalSource) ReadCandidate(_ context.Context, _ identity.ResourceURI, c identity.ResourceCandidate) (json.RawMessage, error) {
	return s.content[c.Selector()], nil
}
func canonicalProviderFixture(t *testing.T) (*PrimitiveProvider, *canonicalPolicy, *canonicalSource, *int, *windowprotocol.ComponentBinding) {
	t.Helper()
	now := time.Now()
	policy := &canonicalPolicy{chosen: "1", binding: "alice/account-a/identity-1", allowed: true, now: now}
	source := &canonicalSource{content: map[string]json.RawMessage{}}
	component := &windowprotocol.ComponentBinding{Kind: "dynamic", ID: "orders", Revision: "7", ContentFingerprint: identity.ContentFingerprint([]byte("component-7")), SchemaFingerprint: identity.ContentFingerprint([]byte("schema"))}
	for _, stamp := range []string{"1", "2", identity.WorkingCandidate} {
		definition := windowprotocol.Definition{ContractVersion: windowprotocol.Version, Window: &types.Window{WindowKey: "overview", View: types.View{Content: &types.Container{Title: stamp}}}, DataSources: map[string]*windowprotocol.DataSource{"orders": {ID: "orders", Backend: &windowprotocol.Backend{Kind: "datly", Ownership: "provider", Method: "arbitraryMCP/query", SchemaFingerprint: component.SchemaFingerprint, Component: component}}}}
		raw, err := json.Marshal(definition)
		if err != nil {
			t.Fatal(err)
		}
		source.content[stamp] = raw
	}
	calls := new(int)
	resolver := &identity.ResourceResolver{Source: source, Policy: policy, Now: func() time.Time { return policy.now }}
	provider := &PrimitiveProvider{ResourceResolver: func(context.Context) (*identity.ResourceResolver, error) { return resolver, nil }, Authority: PrimitiveAuthorityFuncs{AuthenticateFunc: func(context.Context) (string, error) { return policy.binding, nil }, AuthorizeFunc: func(context.Context, string, string, string, string) error {
		if !policy.allowed {
			return errors.New("denied")
		}
		return nil
	}, AuthorizeFetchFunc: func(_ context.Context, binding string, in *windowprotocol.FetchInput) error {
		if binding != policy.binding || in.Inputs["selectedId"] != 1 {
			return errors.New("selected entity denied")
		}
		return nil
	}}, Host: PrimitiveHostFuncs{
		CatalogFunc: func(context.Context, *windowprotocol.CatalogInput) (*windowprotocol.Catalog, error) {
			return &windowprotocol.Catalog{ContractVersion: windowprotocol.Version, CatalogRevision: "catalog-1", Windows: []windowprotocol.WindowSummary{{Key: "overview", Title: "Overview", ResourceURI: "window://planning/overview"}, {Key: "denied", Title: "Denied", ResourceURI: "window://planning/denied"}}}, nil
		},
		ResourceRefFunc: func(_ context.Context, key string) (identity.ResourceRef, error) {
			if key != "overview" {
				return identity.ResourceRef{}, ErrProviderUnavailable
			}
			return identity.ResourceRef{URI: "window://planning/overview"}, nil
		},
		DefinitionResolvedFunc: func(_ context.Context, pin identity.ResolvedResource, raw json.RawMessage) (*windowprotocol.Definition, error) {
			var definition windowprotocol.Definition
			if json.Unmarshal(raw, &definition) != nil {
				return nil, ErrProviderUnavailable
			}
			return &definition, nil
		},
		FetchResolvedFunc: func(_ context.Context, in *windowprotocol.FetchInput, descriptor *windowprotocol.DataSource) (windowprotocol.FetchOutput, error) {
			if err := windowprotocol.ValidateComponentDispatch(descriptor.Backend.Component, *component); err != nil {
				return nil, err
			}
			if in.Resource == nil || in.Resource.URI != "window://planning/overview" || in.WindowKey != "overview" {
				return nil, ErrProviderUnavailable
			}
			*calls++
			return json.RawMessage(fmt.Sprintf(`{"revision":%q,"selectedId":1}`, in.Resource.Selector())), nil
		},
	}}
	return provider, policy, source, calls, component
}
func TestCanonicalProviderCatalogDefinitionAndFetchUseOnePolicy(t *testing.T) {
	provider, policy, source, calls, component := canonicalProviderFixture(t)
	ctx := context.Background()
	catalog, err := provider.Catalog(ctx, &windowprotocol.CatalogInput{ContractVersion: windowprotocol.Version})
	if err != nil || len(catalog.Windows) != 1 || catalog.Windows[0].Name != "overview" {
		t.Fatalf("filtered catalog=%+v %v", catalog, err)
	}
	definition, err := provider.Definition(ctx, &windowprotocol.DefinitionInput{ContractVersion: windowprotocol.Version, WindowKey: "overview"})
	if err != nil || definition.Resource.Revision != "1" || definition.Window.View.Content.Title != "1" {
		t.Fatalf("policy-selected old definition=%+v %v", definition, err)
	}
	if _, err := provider.Definition(ctx, &windowprotocol.DefinitionInput{ContractVersion: windowprotocol.Version, Resource: &identity.ResourceRef{URI: definition.Resource.URI, Revision: "2"}}); err == nil {
		t.Fatal("explicit denied stamp read")
	}
	pin := *definition.Resource
	input := &windowprotocol.FetchInput{ContractVersion: windowprotocol.Version, WindowKey: "forged", Resource: &pin, DataSourceID: "orders", Inputs: map[string]any{"selectedId": 1}}
	output, err := provider.Fetch(ctx, input)
	if err != nil || string(output) != `{"revision":"1","selectedId":1}` || *calls != 1 {
		t.Fatalf("pinned fetch=%s dispatch=%d %v", output, *calls, err)
	}
	component.Revision = "8"
	if _, err := provider.Fetch(ctx, input); err == nil {
		t.Fatal("component drift executed")
	}
	if *calls != 1 {
		t.Fatal("component drift reached executor")
	}
	component.Revision = "7"
	policy.binding = "alice/account-b/identity-1"
	if _, err := provider.Fetch(ctx, input); err == nil {
		t.Fatal("account-switched pin executed")
	}
	policy.binding = pin.AuthorityBinding
	policy.chosen = identity.WorkingCandidate
	working, err := provider.Definition(ctx, &windowprotocol.DefinitionInput{ContractVersion: windowprotocol.Version, WindowKey: "overview"})
	if err != nil || working.Resource.Revision != "" || working.Resource.Kind != identity.WorkingCandidate {
		t.Fatalf("working=%+v %v", working, err)
	}
	source.content[identity.WorkingCandidate] = source.content["2"]
	if _, err := provider.Fetch(ctx, &windowprotocol.FetchInput{ContractVersion: windowprotocol.Version, Resource: working.Resource, DataSourceID: "orders", Inputs: input.Inputs}); err == nil {
		t.Fatal("stale working pin executed")
	}
	if _, err := provider.Fetch(ctx, &windowprotocol.FetchInput{ContractVersion: windowprotocol.Version, WindowKey: "overview", DefinitionRevision: definition.DefinitionRevision, DataSourceID: "orders", Inputs: input.Inputs}); err == nil {
		t.Fatal("legacy fingerprint bypassed canonical resolver")
	}
	policy.allowed = false
	if _, err := provider.Fetch(ctx, input); err == nil {
		t.Fatal("revoked pin executed")
	}
}
func TestResourceReadURIHasOnlyStandardRevisionSelector(t *testing.T) {
	ref, err := ResourceReadURI("report://planning/revenue?revision=7")
	if err != nil || ref.URI != "report://planning/revenue" || ref.Revision != "7" {
		t.Fatalf("read ref=%+v %v", ref, err)
	}
	for _, value := range []string{"report://planning/revenue?latest=true", "report://planning/revenue?revision=1&revision=2", "report://planning/revenue?revision=", "report://planning/revenue?revision=1&account=foreign", "http://planning/revenue"} {
		if _, err := ResourceReadURI(value); err == nil {
			t.Fatalf("ambiguous read accepted: %s", value)
		}
	}
}

func TestCanonicalProviderRequiresSelectedInputAuthority(t *testing.T) {
	provider, _, _, calls, _ := canonicalProviderFixture(t)
	definition, err := provider.Definition(context.Background(), &windowprotocol.DefinitionInput{ContractVersion: windowprotocol.Version, WindowKey: "overview"})
	if err != nil {
		t.Fatal(err)
	}
	authority := provider.Authority.(PrimitiveAuthorityFuncs)
	authority.AuthorizeFetchFunc = nil
	provider.Authority = authority
	if _, err := provider.Fetch(context.Background(), &windowprotocol.FetchInput{ContractVersion: windowprotocol.Version, Resource: definition.Resource, DataSourceID: "orders", Inputs: map[string]any{"selectedId": 1}}); err == nil || *calls != 0 {
		t.Fatalf("missing selected-input authority executed: calls=%d err=%v", *calls, err)
	}
}
