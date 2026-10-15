// SPDX-License-Identifier: Apache-2.0
// Extracted from Viant Agently Core; provider bindings are independent of agent execution.
package resource

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"
)

type revisionPolicyFunc func(context.Context, ResourceRef, []ResourceCandidate) (ResourceDecision, error)

func (f revisionPolicyFunc) SelectRevision(ctx context.Context, ref ResourceRef, c []ResourceCandidate) (ResourceDecision, error) {
	return f(ctx, ref, c)
}

type resourceFixture struct {
	content   map[string]json.RawMessage
	afterRead func()
}

func (f *resourceFixture) Candidates(context.Context, ResourceURI) ([]ResourceCandidate, error) {
	result := []ResourceCandidate{}
	for revision, raw := range f.content {
		kind := StampedCandidate
		stamp := revision
		if revision == WorkingCandidate {
			kind = WorkingCandidate
			stamp = ""
		}
		result = append(result, ResourceCandidate{Kind: kind, Revision: stamp, ContentFingerprint: ContentFingerprint(raw)})
	}
	return result, nil
}
func (f *resourceFixture) ReadCandidate(_ context.Context, _ ResourceURI, c ResourceCandidate) (json.RawMessage, error) {
	raw := f.content[c.Selector()]
	if f.afterRead != nil {
		f.afterRead()
	}
	return raw, nil
}
func TestCanonicalResourceIdentity(t *testing.T) {
	for _, uri := range []string{"window://planning/overview", "report://planning/overview", "report://reports.ads/revenue", "window://platform/deliver/orders", "datasource://platform/deliver/orders", "skill://platform/analysis/delivery"} {
		got, err := ParseResourceURI(uri)
		if err != nil || got.String() != uri {
			t.Fatalf("%s: %+v %v", uri, got, err)
		}
	}
	for _, uri := range []string{"report://host", "report://host/path/../child", "report://host/path/./child", "report://host/path//child", "report://host/path/", "report://host//path", "report://host/path/%2Fchild", "report://user@host/name", "report://namespace/name?revision=1", "report://namespace/name#1", "report://namespace/%2f", "http://namespace/name", "report://../name", "report://namespace:80/name"} {
		if _, err := ParseResourceURI(uri); err == nil {
			t.Fatalf("ambiguous resource accepted: %s", uri)
		}
	}
	parsed, err := ParseResourceURI("window://platform/deliver/orders")
	if err != nil || parsed.Namespace != "platform" || parsed.Name != "deliver/orders" {
		t.Fatalf("subfolder identity lost: %+v %v", parsed, err)
	}
}
func TestResourceResolverPolicySelectionAndPinnedReads(t *testing.T) {
	ctx := context.Background()
	now := time.Now()
	chosen := "1"
	allowed := true
	source := &resourceFixture{content: map[string]json.RawMessage{"1": json.RawMessage(`{"version":"old"}`), "2": json.RawMessage(`{"version":"new"}`), WorkingCandidate: json.RawMessage(`{"version":"draft"}`)}}
	policy := revisionPolicyFunc(func(_ context.Context, ref ResourceRef, candidates []ResourceCandidate) (ResourceDecision, error) {
		if !allowed {
			return ResourceDecision{}, ErrResourceDenied
		}
		for _, c := range candidates {
			if c.Selector() == chosen {
				return ResourceDecision{AuthorityBinding: "alice/account/revision-1", Candidate: c, ValidUntil: now.Add(time.Minute)}, nil
			}
		}
		return ResourceDecision{}, ErrResourceDenied
	})
	resolver := &ResourceResolver{Source: source, Policy: policy, Now: func() time.Time { return now }}
	ref := ResourceRef{URI: "report://planning/revenue"}
	old, err := resolver.Resolve(ctx, ref)
	if err != nil || old.Revision != "1" {
		t.Fatalf("older selection=%+v %v", old, err)
	}
	raw, _, err := resolver.ReadResolved(ctx, *old)
	if err != nil || string(raw) != string(source.content["1"]) {
		t.Fatalf("pinned read=%s %v", raw, err)
	}
	if _, err := resolver.Resolve(ctx, ResourceRef{URI: ref.URI, Revision: "2"}); !errors.Is(err, ErrResourceDenied) {
		t.Fatalf("explicit forbidden=%v", err)
	}
	chosen = WorkingCandidate
	working, err := resolver.Resolve(ctx, ref)
	if err != nil || working.Kind != WorkingCandidate || working.Revision != "" {
		t.Fatalf("working selection=%+v %v", working, err)
	}
	source.content[WorkingCandidate] = json.RawMessage(`{"version":"changed draft"}`)
	if _, _, err := resolver.ReadResolved(ctx, *working); !errors.Is(err, ErrResourceStale) {
		t.Fatalf("stale fingerprint=%v", err)
	}
	if _, _, err := resolver.ReadResolved(ctx, *old); !errors.Is(err, ErrResourceDenied) {
		t.Fatalf("policy changed: old resource must stay pinned and deny: %v", err)
	}
	allowed = false
	if _, err := resolver.Resolve(ctx, ref); !errors.Is(err, ErrResourceDenied) {
		t.Fatalf("no allowed revision=%v", err)
	}
}
func TestLocalResourceHasOnlyWorkingCandidateAndRechecksAfterRead(t *testing.T) {
	now := time.Now()
	allowed := true
	local := &LocalResource{URI: ResourceURI{Kind: "window", Namespace: "local", Name: "overview"}, Load: func(context.Context) (json.RawMessage, error) { return json.RawMessage(`{"view":{}}`), nil }}
	policy := revisionPolicyFunc(func(_ context.Context, _ ResourceRef, c []ResourceCandidate) (ResourceDecision, error) {
		if !allowed {
			return ResourceDecision{}, ErrResourceDenied
		}
		if len(c) != 1 || c[0].Kind != WorkingCandidate || c[0].Revision != "" {
			t.Fatal("invented local revision")
		}
		return ResourceDecision{AuthorityBinding: "alice/account/revision-1", Candidate: c[0], ValidUntil: now.Add(time.Minute)}, nil
	})
	resolver := &ResourceResolver{Source: local, Policy: policy, Now: func() time.Time { return now }}
	pinned, err := resolver.Resolve(context.Background(), ResourceRef{URI: local.URI.String()})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := resolver.Resolve(context.Background(), ResourceRef{URI: local.URI.String(), Revision: "1"}); !errors.Is(err, ErrResourceDenied) {
		t.Fatalf("fabricated YAML history=%v", err)
	}
	local.Load = func(context.Context) (json.RawMessage, error) {
		allowed = false
		return json.RawMessage(`{"view":{}}`), nil
	}
	if _, _, err := resolver.ReadResolved(context.Background(), *pinned); !errors.Is(err, ErrResourceDenied) {
		t.Fatalf("revoked during read=%v", err)
	}
	allowed = true
	now = now.Add(2 * time.Minute)
	if _, _, err := resolver.ReadResolved(context.Background(), *pinned); !errors.Is(err, ErrResourceDenied) {
		t.Fatalf("expired open resource=%v", err)
	}
}
func TestResourceResolverRejectsPolicyInventedCandidate(t *testing.T) {
	now := time.Now()
	source := &resourceFixture{content: map[string]json.RawMessage{"1": json.RawMessage(`{}`)}}
	resolver := &ResourceResolver{Source: source, Policy: revisionPolicyFunc(func(_ context.Context, _ ResourceRef, c []ResourceCandidate) (ResourceDecision, error) {
		c[0].Revision = "forged"
		return ResourceDecision{AuthorityBinding: "alice/account/revision-1", Candidate: c[0], ValidUntil: now.Add(time.Minute)}, nil
	})}
	if _, err := resolver.Resolve(context.Background(), ResourceRef{URI: "window://local/overview"}); !errors.Is(err, ErrResourceDenied) {
		t.Fatalf("policy invented candidate=%v", err)
	}
}

func TestResolvedResourceRejectsChangedAuthorityBinding(t *testing.T) {
	now := time.Now()
	binding := "alice/account-a/identity-1"
	source := &resourceFixture{content: map[string]json.RawMessage{"1": json.RawMessage(`{}`)}}
	resolver := &ResourceResolver{Source: source, Policy: revisionPolicyFunc(func(_ context.Context, _ ResourceRef, c []ResourceCandidate) (ResourceDecision, error) {
		return ResourceDecision{Candidate: c[0], AuthorityBinding: binding, ValidUntil: now.Add(time.Minute)}, nil
	})}
	pinned, err := resolver.Resolve(context.Background(), ResourceRef{URI: "window://local/overview"})
	if err != nil {
		t.Fatal(err)
	}
	for _, changed := range []string{"alice/account-b/identity-1", "bob/account-a/identity-1", "alice/account-a/identity-2"} {
		binding = changed
		if _, _, err := resolver.ReadResolved(context.Background(), *pinned); !errors.Is(err, ErrResourceDenied) {
			t.Fatalf("changed authority %q accepted: %v", changed, err)
		}
	}
	binding = pinned.AuthorityBinding
	source.afterRead = func() { binding = "alice/account-b/identity-1" }
	if _, _, err := resolver.ReadResolved(context.Background(), *pinned); !errors.Is(err, ErrResourceDenied) {
		t.Fatalf("account switched during I/O=%v", err)
	}
	binding = ""
	if _, err := resolver.Resolve(context.Background(), ResourceRef{URI: pinned.URI}); !errors.Is(err, ErrResourceDenied) {
		t.Fatalf("missing binding=%v", err)
	}
}
