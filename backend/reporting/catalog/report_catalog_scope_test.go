// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package catalog

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync/atomic"
	"testing"
	"time"

	identity "github.com/viant/forge/backend/resource"
)

type catalogScopePolicy func(context.Context, identity.ResourceRef, []identity.ResourceCandidate) (identity.ResourceDecision, error)

func (f catalogScopePolicy) SelectRevision(ctx context.Context, r identity.ResourceRef, c []identity.ResourceCandidate) (identity.ResourceDecision, error) {
	return f(ctx, r, c)
}
func TestReportMetadataScopeBuffersProjectionAndChecksRelease(t *testing.T) {
	ctx := context.Background()
	uri, _ := identity.ParseResourceURI("report://shared/Sales")
	raw := json.RawMessage(`{"schemaVersion":1,"format":"forge.authoredReport","reportDocument":{},"builderRef":"selectedBuilder"}`)
	actor := identity.VerifiedActor{Subject: "alice", Issuer: "issuer", TenantID: "tenant", AccountID: "account", IdentityRevision: "one", ValidUntil: time.Now().Add(time.Minute)}
	source := &identity.LocalResource{URI: uri, Load: func(context.Context) (json.RawMessage, error) { return raw, nil }}
	resolver := &identity.ResourceResolver{Source: source, Policy: catalogScopePolicy(func(context.Context, identity.ResourceRef, []identity.ResourceCandidate) (identity.ResourceDecision, error) {
		return identity.ResourceDecision{Candidate: identity.ResourceCandidate{Kind: identity.WorkingCandidate, ContentFingerprint: identity.ContentFingerprint(raw)}, AuthorityBinding: "alice-account", ValidUntil: actor.ValidUntil}, nil
	})}
	begins, finishes := 0, 0
	denyFinish := false
	service := &ReportCatalogService{Identity: func(context.Context) (identity.VerifiedActor, error) { return actor, nil }, Resolver: func(context.Context) (*identity.ResourceResolver, error) { return resolver, nil }, Inventories: []ReportInventory{ReportInventoryFunc(func(context.Context, identity.VerifiedActor) ([]ReportCatalogCandidate, error) {
		return []ReportCatalogCandidate{{URI: uri.String(), Title: "Sales", OwnerID: "alice", BuilderRef: "oldBuilder", BuilderWindow: "oldWindow"}}, nil
	})}, BuilderWindows: map[string]string{"selectedBuilder": "selectedWindow"}, BeginMetadataRead: func(ctx context.Context) (context.Context, func() error, error) {
		begins++
		return ctx, func() error {
			finishes++
			if denyFinish {
				return identity.ErrResourceDenied
			}
			return nil
		}, nil
	}}
	result, err := service.List(ctx, ReportCatalogQuery{})
	if err != nil || len(result.Reports) != 1 || result.Reports[0].BuilderWindow != "selectedWindow" || result.Reports[0].BuilderRef != "selectedBuilder" || begins != 1 || finishes != 1 {
		t.Fatalf("metadata projection=%+v %d/%d %v", result, begins, finishes, err)
	}
	if _, _, err = service.Read(ctx, identity.ResourceRef{URI: uri.String()}, result.Reports[0].Resource); err != nil || begins != 1 {
		t.Fatal("read reused list-only scope", err)
	}
	denyFinish = true
	result, err = service.List(ctx, ReportCatalogQuery{})
	if result != nil || !errors.Is(err, identity.ErrResourceDenied) || begins != 2 || finishes != 2 {
		t.Fatalf("metadata returned after release denial=%+v %v", result, err)
	}
}

func TestReportCatalogExactResourceFilterSkipsUnrelatedResolution(t *testing.T) {
	ctx := context.Background()
	uri, _ := identity.ParseResourceURI("report://shared/Sales")
	raw := json.RawMessage(`{"schemaVersion":1,"format":"forge.authoredReport","reportDocument":{}}`)
	actor := identity.VerifiedActor{Subject: "alice", Issuer: "issuer", TenantID: "tenant", AccountID: "account", IdentityRevision: "one", ValidUntil: time.Now().Add(time.Minute)}
	resolver := &identity.ResourceResolver{Source: &identity.LocalResource{URI: uri, Load: func(context.Context) (json.RawMessage, error) { return raw, nil }}, Policy: catalogScopePolicy(func(context.Context, identity.ResourceRef, []identity.ResourceCandidate) (identity.ResourceDecision, error) {
		return identity.ResourceDecision{Candidate: identity.ResourceCandidate{Kind: identity.WorkingCandidate, ContentFingerprint: identity.ContentFingerprint(raw)}, AuthorityBinding: "alice-account", ValidUntil: actor.ValidUntil}, nil
	})}
	service := &ReportCatalogService{Identity: func(context.Context) (identity.VerifiedActor, error) { return actor, nil }, Resolver: func(context.Context) (*identity.ResourceResolver, error) { return resolver, nil }, Inventories: []ReportInventory{ReportInventoryFunc(func(context.Context, identity.VerifiedActor) ([]ReportCatalogCandidate, error) {
		return []ReportCatalogCandidate{{URI: "report://shared/Other", Title: "Other"}, {URI: uri.String(), Title: "Sales"}}, nil
	})}}
	result, err := service.List(ctx, ReportCatalogQuery{Namespace: "shared", ResourceURI: uri.String()})
	if err != nil || len(result.Reports) != 1 || result.Reports[0].URI != uri.String() {
		t.Fatalf("exact report filter=%+v %v", result, err)
	}
	if _, err = service.List(ctx, ReportCatalogQuery{Namespace: "shared", ResourceURI: "window://shared/Sales"}); !errors.Is(err, identity.ErrResource) {
		t.Fatalf("invalid exact report filter: %v", err)
	}
}

type concurrentCatalogSource struct {
	raw             json.RawMessage
	active, maximum atomic.Int32
	failURI         string
}

func (s *concurrentCatalogSource) Candidates(_ context.Context, uri identity.ResourceURI) ([]identity.ResourceCandidate, error) {
	if uri.String() == s.failURI {
		return nil, errors.New("fixture metadata failure")
	}
	current := s.active.Add(1)
	for previous := s.maximum.Load(); current > previous && !s.maximum.CompareAndSwap(previous, current); previous = s.maximum.Load() {
	}
	defer s.active.Add(-1)
	time.Sleep(10 * time.Millisecond)
	return []identity.ResourceCandidate{{Kind: identity.WorkingCandidate, ContentFingerprint: identity.ContentFingerprint(s.raw)}}, nil
}
func (s *concurrentCatalogSource) ReadCandidate(context.Context, identity.ResourceURI, identity.ResourceCandidate) (json.RawMessage, error) {
	return s.raw, nil
}

func TestReportCatalogPagesAuthorizedResourcesInBoundedParallelOrder(t *testing.T) {
	ctx := context.Background()
	raw := json.RawMessage(`{"schemaVersion":1,"reportDocument":{}}`)
	actor := identity.VerifiedActor{Subject: "alice", Issuer: "issuer", TenantID: "tenant", AccountID: "account", IdentityRevision: "one", ValidUntil: time.Now().Add(time.Minute)}
	source := &concurrentCatalogSource{raw: raw}
	resolver := &identity.ResourceResolver{Source: source, Policy: catalogScopePolicy(func(_ context.Context, _ identity.ResourceRef, candidates []identity.ResourceCandidate) (identity.ResourceDecision, error) {
		return identity.ResourceDecision{Candidate: candidates[0], AuthorityBinding: "actor", ValidUntil: actor.ValidUntil}, nil
	})}
	service := &ReportCatalogService{Identity: func(context.Context) (identity.VerifiedActor, error) { return actor, nil }, Resolver: func(context.Context) (*identity.ResourceResolver, error) { return resolver, nil }, Inventories: []ReportInventory{ReportInventoryFunc(func(context.Context, identity.VerifiedActor) ([]ReportCatalogCandidate, error) {
		var entries []ReportCatalogCandidate
		for i := 15; i >= 0; i-- {
			entries = append(entries, ReportCatalogCandidate{URI: fmt.Sprintf("report://ar/%02d", i), Title: "Report"})
		}
		return entries, nil
	})}}
	result, err := service.List(ctx, ReportCatalogQuery{Namespace: "ar", Limit: 16})
	if err != nil || len(result.Reports) != 16 || source.maximum.Load() < 2 || source.maximum.Load() > 8 {
		t.Fatalf("bounded report list: count=%d max=%d err=%v", len(result.Reports), source.maximum.Load(), err)
	}
	for i, entry := range result.Reports {
		if entry.URI != fmt.Sprintf("report://ar/%02d", i) {
			t.Fatalf("report order[%d]=%s", i, entry.URI)
		}
	}
}

func TestParallelReportPageDoesNotReadPastLookahead(t *testing.T) {
	for _, failure := range []struct {
		uri       string
		wantError bool
	}{{"report://ar/15", false}, {"report://ar/03", true}} {
		t.Run(failure.uri, func(t *testing.T) {
			actor := identity.VerifiedActor{Subject: "alice", Issuer: "issuer", TenantID: "tenant", AccountID: "account", IdentityRevision: "one", ValidUntil: time.Now().Add(time.Minute)}
			source := &concurrentCatalogSource{raw: json.RawMessage(`{"schemaVersion":1,"reportDocument":{}}`), failURI: failure.uri}
			resolver := &identity.ResourceResolver{Source: source, Policy: catalogScopePolicy(func(_ context.Context, _ identity.ResourceRef, candidates []identity.ResourceCandidate) (identity.ResourceDecision, error) {
				return identity.ResourceDecision{Candidate: candidates[0], AuthorityBinding: "actor", ValidUntil: actor.ValidUntil}, nil
			})}
			service := &ReportCatalogService{Identity: func(context.Context) (identity.VerifiedActor, error) { return actor, nil }, Resolver: func(context.Context) (*identity.ResourceResolver, error) { return resolver, nil }, Inventories: []ReportInventory{ReportInventoryFunc(func(context.Context, identity.VerifiedActor) ([]ReportCatalogCandidate, error) {
				var out []ReportCatalogCandidate
				for i := 0; i < 16; i++ {
					out = append(out, ReportCatalogCandidate{URI: fmt.Sprintf("report://ar/%02d", i), Title: "Report"})
				}
				return out, nil
			})}}
			result, err := service.List(context.Background(), ReportCatalogQuery{Namespace: "ar", Limit: 10})
			if failure.wantError {
				if err == nil {
					t.Fatal("required candidate failure was hidden")
				}
				return
			}
			if err != nil || len(result.Reports) != 10 || result.NextCursor == "" {
				t.Fatalf("valid page failed due to later candidate: result=%+v err=%v", result, err)
			}
		})
	}
}
