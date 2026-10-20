// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package catalog

import (
	"context"
	"encoding/json"
	"errors"
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
