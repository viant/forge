// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package datasource

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	requestctx "github.com/viant/forge/backend/requestctx"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
	internalAuth "github.com/viant/mcp/client/auth/link"
	"testing"
	"time"
)

func TestBoundResourceCacheSeparatesIdentityAndDescriptorWithoutLeaseRenewal(t *testing.T) {
	descriptor := &dsproto.DataSource{ID: "rows", Backend: &dsproto.Backend{Kind: dsproto.BackendMCPTool, Service: "arbitrary", Method: "read"}}
	pin := identity.ResolvedResource{URI: "window://one/list", ProviderIdentity: "one-provider", AuthorityBinding: "owner-account", ResourceCandidate: identity.ResourceCandidate{Kind: identity.WorkingCandidate, ContentFingerprint: "original"}, ValidUntil: time.Now().Add(time.Minute)}
	target := &types.WindowTarget{FormFactor: "phone"}
	original, err := boundResourceCacheKey("legacy", pin, target, descriptor, Identity{User: "verified-owner"})
	if err != nil {
		t.Fatal(err)
	}
	renewed := pin
	renewed.ValidUntil = pin.ValidUntil.Add(time.Hour)
	same, err := boundResourceCacheKey("legacy", renewed, target, descriptor, Identity{User: "verified-owner"})
	if err != nil || same != original {
		t.Fatal("lease changed cache TTL identity")
	}
	for _, change := range []func(*identity.ResolvedResource){func(p *identity.ResolvedResource) { p.URI = "window://two/list" }, func(p *identity.ResolvedResource) { p.ProviderIdentity = "another" }, func(p *identity.ResolvedResource) { p.AuthorityBinding = "other-account" }, func(p *identity.ResolvedResource) { p.ContentFingerprint = "changed-working" }, func(p *identity.ResolvedResource) { p.Kind = identity.StampedCandidate; p.Revision = "r2" }} {
		changed := pin
		change(&changed)
		key, err := boundResourceCacheKey("legacy", changed, target, descriptor, Identity{User: "verified-owner"})
		if err != nil || key == original {
			t.Fatal("different selected identity shared cache")
		}
	}
	key, err := boundResourceCacheKey("legacy", pin, &types.WindowTarget{FormFactor: "desktop"}, descriptor, Identity{User: "verified-owner"})
	if err != nil || key == original {
		t.Fatal("target shared cache")
	}
	changed := *descriptor
	changed.Selectors = &types.Selectors{Data: "different.rows"}
	key, err = boundResourceCacheKey("legacy", pin, target, &changed, Identity{User: "verified-owner"})
	if err != nil || key == original {
		t.Fatal("descriptor shared cache")
	}
}

func TestBoundResourceCacheHitKeepsPreAndFinalAdmissionAndFreshTTL(t *testing.T) {
	descriptor := &dsproto.DataSource{ID: "rows", Backend: &dsproto.Backend{Kind: dsproto.BackendInline, Rows: []map[string]interface{}{{"id": 1}}}}
	now := time.Now()
	pin := identity.ResolvedResource{URI: "window://one/list", ValidUntil: now.Add(time.Minute)}
	denied, denyFinal := false, false
	admissions := 0
	service := New(Options{Now: func() time.Time { return now }, ResolveDefinition: func(context.Context, identity.ResolvedResource, *types.WindowTarget, string) (*dsproto.DataSource, error) {
		return descriptor, nil
	}, AuthorizeDefinition: func(context.Context, *dsproto.DataSource, map[string]interface{}) error {
		admissions++
		if denied || denyFinal && admissions%2 == 0 {
			return identity.ErrResourceDenied
		}
		return nil
	}})
	ctx := requestctx.WithResolvedResource(internalAuth.InjectUser(context.Background(), "verified-owner"), pin)
	first, err := service.Fetch(ctx, "rows", nil, FetchOptions{})
	if err != nil || first.Cache.Hit {
		t.Fatal(first, err)
	}
	fetched := first.Cache.FetchedAt
	now = now.Add(time.Second)
	second, err := service.Fetch(ctx, "rows", nil, FetchOptions{})
	if err != nil || !second.Cache.Hit || !second.Cache.FetchedAt.Equal(fetched) {
		t.Fatal("cache renewed TTL or missed admission", second, err)
	}
	denied = true
	if out, err := service.Fetch(ctx, "rows", nil, FetchOptions{}); out != nil || !errors.Is(err, identity.ErrResourceDenied) {
		t.Fatal("pre denied cache released rows")
	}
	denied = false
	admissions = 0
	denyFinal = true
	if out, err := service.Fetch(ctx, "rows", nil, FetchOptions{}); out != nil || !errors.Is(err, identity.ErrResourceDenied) || admissions != 2 {
		t.Fatal("final denied cache released rows", admissions, out, err)
	}
}
func TestCursorCachedResultCannotBypassContinuationValidation(t *testing.T) {
	descriptor := &dsproto.DataSource{ID: "rows", Backend: &dsproto.Backend{Kind: dsproto.BackendInline, Rows: []map[string]interface{}{{"id": 1}}}, DataSource: types.DataSource{Paging: &types.PagingConfig{Enabled: true, Mode: "cursor", Parameters: &types.PagingParameters{Page: "resume"}, DataInfoSelectors: &types.DataInfoSelectors{HasMore: "more", NextCursor: "next"}}}}
	store := NewMemoryStore()
	store.Put(descriptor)
	service := New(Options{Store: store})
	raw, _ := json.Marshal(descriptor)
	sum := sha256.Sum256(raw)
	aliases, _ := prepareResponseAliases(descriptor.ResponseAliases)
	key := responseAliasCacheKey(buildCacheKey(service.scopeID(context.Background(), dsproto.CachePolicyOrDefault(nil).Scope), descriptor.ID, nil, map[string]interface{}{}), aliases) + "|cursor:" + hex.EncodeToString(sum[:])
	service.cache.put(key, cacheEntry{result: &dsproto.FetchResult{Rows: []map[string]interface{}{{"id": "cached"}}, DataInfo: map[string]interface{}{"more": false}}, fetchedAt: service.now()}, 10)
	if out, err := service.Fetch(context.Background(), "rows", nil, FetchOptions{}); err != nil || out == nil || out.Cache == nil || !out.Cache.Hit {
		t.Fatal("test did not reach cursor cache", out, err)
	}
	service.cache.put(key, cacheEntry{result: &dsproto.FetchResult{Rows: []map[string]interface{}{{"id": "must-not-release"}}, DataInfo: map[string]interface{}{"more": "false"}}, fetchedAt: service.now()}, 10)
	if out, err := service.Fetch(context.Background(), "rows", nil, FetchOptions{}); out != nil || err == nil {
		t.Fatal("invalid cached continuation released rows", out, err)
	}
}

func TestBoundResourceCacheNeverSharesAcrossPrincipalsEvenWithGlobalScope(t *testing.T) {
	ds := &dsproto.DataSource{ID: "rows", Backend: &dsproto.Backend{Kind: dsproto.BackendInline}}
	pin := identity.ResolvedResource{URI: "window://same/list", AuthorityBinding: "same-account"}
	first, _ := boundResourceCacheKey("global", pin, nil, ds, Identity{User: "alice"})
	other, _ := boundResourceCacheKey("global", pin, nil, ds, Identity{User: "bob"})
	if first == other {
		t.Fatal("canonical cache shared across users")
	}
}

func TestBoundResourceCacheRejectsEmptyPrincipalIdentity(t *testing.T) {
	if key, err := boundResourceCacheKey("global", identity.ResolvedResource{URI: "window://same/list"}, nil, &dsproto.DataSource{}, Identity{}); err == nil || key != "" {
		t.Fatal("empty canonical principal shared a cache identity")
	}
}
