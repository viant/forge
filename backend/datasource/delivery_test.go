// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package datasource

import (
	"context"
	"encoding/json"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	"github.com/viant/forge/backend/requestctx"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
	"testing"
	"time"
)

type heldDelivery struct{}

func (heldDelivery) BeforeDispatch(context.Context) error { return nil }
func (heldDelivery) AfterDispatch(context.Context) error  { return nil }
func TestPrepareNewDeliveryDetachedAndFailsClosed(t *testing.T) {
	now := time.Now()
	pin := &identity.ResolvedResource{ProviderIdentity: "owner", URI: "window://team/view", ResourceCandidate: identity.ResourceCandidate{Kind: identity.WorkingCandidate, ContentFingerprint: identity.ContentFingerprint([]byte(`{}`))}, AuthorityBinding: "original", ValidUntil: now.Add(-time.Minute)}
	opts := FetchOptions{Resource: pin, Target: &types.WindowTarget{Platform: "web"}, SelectionBinding: &identity.SelectionBinding{Token: "original"}, WindowParameters: map[string]any{"parent": map[string]any{"id": 1}}}
	calls := 0
	s := New(Options{Now: func() time.Time { return now }, NewDeliveryPreparer: func(ctx context.Context, in OriginalDelivery) (context.Context, *PreparedDelivery, error) {
		calls++
		in.WindowParameters["parent"].(map[string]any)["id"] = 2
		in.SelectionBinding.Token = "mutated"
		in.Resource.ValidUntil = now.Add(time.Minute)
		in.Resource.AuthorityBinding = "fresh"
		return ctx, &PreparedDelivery{Resource: in.Resource, Target: in.Target}, nil
	}})
	freshCtx, fresh, cleanup, err := s.prepareNewDelivery(context.Background(), opts)
	if err != nil {
		t.Fatal(err)
	}
	defer cleanup()
	if requestctx.WindowParametersFromContext(freshCtx)["parent"].(map[string]any)["id"].(json.Number).String() != "1" {
		t.Fatal("selector hints changed")
	}
	if fresh.Resource.ValidUntil.Before(now) || pin.ValidUntil.After(now) || opts.SelectionBinding.Token != "original" || opts.WindowParameters["parent"].(map[string]any)["id"] != 1 {
		t.Fatal("original selection mutated")
	}
	held := requestctx.WithResourceReadDispatch(context.Background(), heldDelivery{})
	if _, _, _, err = s.prepareNewDelivery(held, opts); err == nil || calls != 1 {
		t.Fatal("held operation renewed")
	}
	s.newDeliveryPreparer = nil
	if _, _, _, err = s.prepareNewDelivery(context.Background(), opts); err == nil {
		t.Fatal("unsupported binding accepted")
	}
	s.newDeliveryPreparer = func(ctx context.Context, in OriginalDelivery) (context.Context, *PreparedDelivery, error) {
		in.Resource.URI = "window://foreign/view"
		in.Resource.ValidUntil = now.Add(time.Minute)
		return ctx, &PreparedDelivery{Resource: in.Resource, Target: in.Target}, nil
	}
	if _, _, _, err = s.prepareNewDelivery(context.Background(), opts); err == nil {
		t.Fatal("artifact switched")
	}
}

type deliveryExecutor func(context.Context, string, map[string]interface{}) (string, error)

func (f deliveryExecutor) Execute(ctx context.Context, name string, args map[string]interface{}) (string, error) {
	return f(ctx, name, args)
}
func TestFetchPreparesNewDeliveryBeforeSequenceAndDispatch(t *testing.T) {
	now := time.Now()
	signer, _ := identity.NewSelectionHMAC(make([]byte, 32))
	signer.Now = func() time.Time { return now }
	actor := identity.VerifiedActor{Issuer: "idp", Subject: "alice", TenantID: "1", AccountID: "2", IdentityRevision: "v1", ValidUntil: now.Add(time.Hour)}
	original := identity.ResolvedResource{ProviderIdentity: "owner", URI: "window://team/view", ResourceCandidate: identity.ResourceCandidate{Kind: identity.WorkingCandidate, ContentFingerprint: identity.ContentFingerprint([]byte(`{}`))}, AuthorityBinding: "original", ValidUntil: now.Add(time.Minute)}
	target := &types.WindowTarget{Platform: "web"}
	targetRaw, _ := json.Marshal(target)
	params := map[string]any{"ids": []any{1}, "parent": 2}
	binding, err := signer.Bind(context.Background(), original, targetRaw, actor, "instance", params)
	if err != nil {
		t.Fatal(err)
	}
	now = now.Add(2 * time.Minute)
	actor.IdentityRevision = "v2"
	descriptor := &dsproto.DataSource{ID: "rows", DataSource: types.DataSource{Selectors: &types.Selectors{Data: "data"}}, Backend: &dsproto.Backend{Kind: dsproto.BackendMCPTool, Service: "managing", Method: "read"}}
	dispatched, sequences := 0, 0
	prepared, allowed := false, true
	detachedContext := false
	service := New(Options{DisableCache: true, Now: func() time.Time { return now },
		NewDeliveryPreparer: func(ctx context.Context, in OriginalDelivery) (context.Context, *PreparedDelivery, error) {
			if !allowed {
				return nil, nil, identity.ErrResourceDenied
			}
			raw, _ := json.Marshal(in.Target)
			if err := signer.VerifyOriginalForNewDelivery(ctx, *in.Resource, raw, *in.SelectionBinding, in.WindowParameters, actor); err != nil {
				return nil, nil, err
			}
			in.Resource.ValidUntil = now.Add(time.Minute)
			in.Resource.AuthorityBinding = "fresh"
			prepared = true
			if detachedContext {
				ctx = context.Background()
			}
			return ctx, &PreparedDelivery{Resource: in.Resource, Target: in.Target}, nil
		},
		ReadSequence: func(ctx context.Context) (context.Context, func() error, error) {
			sequences++
			if !prepared {
				t.Fatal("sequence started before preparation")
			}
			return requestctx.WithResourceReadDispatch(ctx, heldDelivery{}), func() error { return nil }, nil
		},
		ResolveResource: func(_ context.Context, pin identity.ResolvedResource) (*identity.ResolvedResource, error) {
			if !pin.ValidUntil.After(now) {
				return nil, identity.ErrResourceDenied
			}
			return &pin, nil
		},
		ResolveDefinition: func(_ context.Context, _ identity.ResolvedResource, _ *types.WindowTarget, _ string) (*dsproto.DataSource, error) {
			return descriptor, nil
		},
		Executor: deliveryExecutor(func(ctx context.Context, _ string, _ map[string]interface{}) (string, error) {
			if serviceIdentity := defaultIdentity(ctx); serviceIdentity != (Identity{User: "owner-user", Conversation: "conversation-1"}) || ctx.Value(deliveryCredentialKey{}) != "managed-credential" {
				t.Fatal("delivery lost credential/cache identity/conversation")
			}
			dispatched++
			return `{"data":[{"id":1}]}`, nil
		}),
	})
	opts := FetchOptions{Resource: &original, Target: target, SelectionBinding: binding, WindowParameters: params}
	initialCtx := WithIdentity(context.Background(), "owner-user", "conversation-1")
	initialCtx = context.WithValue(initialCtx, deliveryCredentialKey{}, "managed-credential")
	result, err := service.Fetch(initialCtx, "rows", nil, opts)
	if err != nil || result == nil || dispatched != 1 || sequences != 1 {
		t.Fatalf("fetch=%+v err=%v dispatch=%d sequences=%d", result, err, dispatched, sequences)
	}
	if !original.ValidUntil.Before(now) || original.AuthorityBinding != "original" {
		t.Fatal("original facts changed")
	}
	preparer := service.newDeliveryPreparer
	for _, name := range []string{"revoked", "foreign actor", "parent changed", "held", "disabled host", "association", "parent decision", "detached context"} {
		t.Run(name, func(t *testing.T) {
			savedActor := actor
			savedParent := params["parent"]
			ctx := context.Background()
			allowed = true
			detachedContext = false
			service.newDeliveryPreparer = preparer
			switch name {
			case "detached context":
				detachedContext = true
			case "association":
				ctx, _ = requestctx.WithResourceReadAssociation(ctx, &original, target)
			case "parent decision":
				var closeDecision func()
				ctx, closeDecision = requestctx.WithWindowReadDecision(ctx)
				defer closeDecision()
			case "disabled host":
				service.newDeliveryPreparer = nil
			case "revoked":
				allowed = false
			case "foreign actor":
				actor.AccountID = "3"
			case "parent changed":
				params["parent"] = 3
			case "held":
				ctx = requestctx.WithResourceReadDispatch(ctx, heldDelivery{})
			}
			_, err := service.Fetch(ctx, "rows", nil, opts)
			if err == nil || dispatched != 1 || sequences != 1 {
				t.Fatalf("denial reached execution: %v dispatch=%d sequences=%d", err, dispatched, sequences)
			}
			actor = savedActor
			params["parent"] = savedParent
		})
	}
}

func TestPreparationContextCannotEscapeParent(t *testing.T) {
	now := time.Now()
	original := identity.ResolvedResource{ProviderIdentity: "owner", URI: "window://team/view", ResourceCandidate: identity.ResourceCandidate{Kind: identity.WorkingCandidate, ContentFingerprint: identity.ContentFingerprint([]byte(`{}`))}, AuthorityBinding: "original", ValidUntil: now.Add(-time.Minute)}
	opts := FetchOptions{Resource: &original, SelectionBinding: &identity.SelectionBinding{Token: "original"}}
	calls := 0
	var cancelInCallback context.CancelFunc
	service := New(Options{Now: func() time.Time { return now }, NewDeliveryPreparer: func(ctx context.Context, in OriginalDelivery) (context.Context, *PreparedDelivery, error) {
		calls++
		if cancelInCallback != nil {
			cancelInCallback()
		}
		in.Resource.AuthorityBinding = "fresh"
		in.Resource.ValidUntil = now.Add(time.Minute)
		return context.WithoutCancel(ctx), &PreparedDelivery{Resource: in.Resource}, nil
	}})
	canceled, cancel := context.WithCancel(context.Background())
	cancel()
	if _, _, _, err := service.prepareNewDelivery(canceled, opts); err == nil || calls != 0 {
		t.Fatal("canceled parent entered preparation")
	}
	during, duringCancel := context.WithCancel(context.Background())
	cancelInCallback = duringCancel
	if _, _, _, err := service.prepareNewDelivery(during, opts); err == nil || calls != 1 {
		t.Fatal("background callback rescued canceled parent")
	}
	cancelInCallback = nil
	deadline := now.Add(time.Minute)
	parent, parentCancel := context.WithDeadline(context.Background(), deadline)
	defer parentCancel()
	fresh, _, cleanup, err := service.prepareNewDelivery(parent, opts)
	if err != nil {
		t.Fatal(err)
	}
	defer cleanup()
	got, ok := fresh.Deadline()
	if !ok || got.After(deadline) {
		t.Fatal("callback enlarged or dropped parent deadline")
	}
	parentCancel()
	if fresh.Err() != context.Canceled {
		t.Fatal("parent cancellation was not synchronously visible")
	}
	select {
	case <-fresh.Done():
	case <-time.After(time.Second):
		t.Fatal("callback escaped later parent cancellation")
	}
	if fresh.Err() == nil {
		t.Fatal("prepared context stayed live after cancellation")
	}
}

type deliveryCredentialKey struct{}

func TestPreparationDerivedContextPreservesOperationValues(t *testing.T) {
	now := time.Now()
	pin := identity.ResolvedResource{ProviderIdentity: "owner", URI: "window://team/view", ResourceCandidate: identity.ResourceCandidate{Kind: identity.WorkingCandidate, ContentFingerprint: identity.ContentFingerprint([]byte(`{}`))}, AuthorityBinding: "current", ValidUntil: now.Add(time.Minute)}
	service := New(Options{Now: func() time.Time { return now }, NewDeliveryPreparer: func(ctx context.Context, in OriginalDelivery) (context.Context, *PreparedDelivery, error) {
		return context.WithoutCancel(ctx), &PreparedDelivery{Resource: in.Resource}, nil
	}})
	parent := WithIdentity(context.Background(), "cache-user", "cache-conversation")
	parent = context.WithValue(parent, deliveryCredentialKey{}, "current-managed-credential")
	fresh, _, cleanup, err := service.prepareNewDelivery(parent, FetchOptions{Resource: &pin, SelectionBinding: &identity.SelectionBinding{Token: "original"}})
	if err != nil {
		t.Fatal(err)
	}
	defer cleanup()
	if service.identity(fresh) != (Identity{User: "cache-user", Conversation: "cache-conversation"}) || fresh.Value(deliveryCredentialKey{}) != "current-managed-credential" {
		t.Fatal("preparation lost operation context values")
	}
}
