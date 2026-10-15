// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package permittedview

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/viant/authz"
	"github.com/viant/forge/backend/policy"
	forgetypes "github.com/viant/forge/backend/types"
)

type authzTestProvider struct{ facts authz.Facts }

func (p authzTestProvider) Resolve(context.Context) (authz.Facts, error) { return p.facts, nil }

type authzSequenceProvider struct {
	facts []authz.Facts
	call  int
}

func (p *authzSequenceProvider) Resolve(context.Context) (authz.Facts, error) {
	index := p.call
	p.call++
	if index >= len(p.facts) {
		index = len(p.facts) - 1
	}
	return p.facts[index], nil
}

func TestPrincipalOnlySnapshotRejectsIdentitySwitchDuringProjection(t *testing.T) {
	alice := authz.Facts{Subject: "alice", Issuer: "issuer", Tenant: "tenant", Roles: []string{"reader"}, ValidUntil: time.Now().Add(time.Hour)}
	bob := alice
	bob.Subject = "bob"
	provider := &authzSequenceProvider{facts: []authz.Facts{alice, bob}}
	resolver := &AuthzResolver{Service: &authz.Service{Provider: provider}, Version: "mapping-1",
		Account: func(context.Context, authz.Facts) (string, error) { return "account-1", nil },
		Map: func(context.Context, string, int, string, bool) (authz.Resource, string, *authz.Entity, error) {
			return authz.Resource{}, "", nil, authz.ErrDenied
		},
		Gate: func(context.Context, authz.Facts, string, authz.Resource, string, *authz.Entity) (policy.GateResult, error) {
			return policy.GateResult{}, authz.ErrDenied
		},
	}
	if snapshot, err := resolver.Resolve(context.Background(), &Request{ResourceType: "window", IncludePrincipal: true}); !errors.Is(err, ErrUnavailable) || snapshot != nil {
		t.Fatalf("switched principal snapshot=%+v err=%v", snapshot, err)
	}
}

type authzRevisionFlippingStore struct {
	resource  authz.Resource
	policy    authz.Policy
	revisions []int64
	reads     int
}

func (s *authzRevisionFlippingStore) Get(context.Context, authz.Resource) (authz.Document, error) {
	s.reads++
	revision := int64(s.reads)
	if len(s.revisions) != 0 {
		index := s.reads - 1
		if index >= len(s.revisions) {
			index = len(s.revisions) - 1
		}
		revision = s.revisions[index]
	}
	return authz.Document{Resource: s.resource, Revision: revision, Policies: map[string]authz.Policy{"viewAccess": s.policy}}, nil
}

func (s *authzRevisionFlippingStore) Replace(context.Context, authz.Document, int64, string) (authz.Document, error) {
	return authz.Document{}, authz.ErrDenied
}

func TestCapabilitySnapshotRejectsPolicyRevisionChangedDuringDecision(t *testing.T) {
	testCapabilitySnapshotRejectsPolicyRevisionSequence(t, nil)
}

func TestCapabilitySnapshotRejectsPolicyRevisionChangedAfterDecision(t *testing.T) {
	testCapabilitySnapshotRejectsPolicyRevisionSequence(t, []int64{1, 1, 2})
}

func testCapabilitySnapshotRejectsPolicyRevisionSequence(t *testing.T, revisions []int64) {
	t.Helper()
	resource := authz.Resource{Kind: "global", ID: "settings", Version: "1", Tenant: "tenant"}
	store := &authzRevisionFlippingStore{resource: resource, policy: authz.Policy{Mode: "protected", Rule: &authz.Rule{Kind: "role", Value: "reader"}}, revisions: revisions}
	facts := authz.Facts{Subject: "alice", Issuer: "issuer", Tenant: "tenant", Roles: []string{"reader"}, ValidUntil: time.Now().Add(time.Hour)}
	resolver := &AuthzResolver{Service: &authz.Service{Provider: authzTestProvider{facts}, Store: store}, Version: "mapping-1",
		Account: func(context.Context, authz.Facts) (string, error) { return "account-1", nil },
		Map: func(context.Context, string, int, string, bool) (authz.Resource, string, *authz.Entity, error) {
			return resource, "viewAccess", nil, nil
		},
		Gate: func(context.Context, authz.Facts, string, authz.Resource, string, *authz.Entity) (policy.GateResult, error) {
			return policy.GateResult{Allow: true, Revision: "gate-1", ValidUntil: time.Now().Add(time.Minute)}, nil
		},
	}
	if snapshot, err := resolver.Resolve(context.Background(), &Request{ResourceType: "window", RequestedGlobalCapabilities: []string{"manage"}}); !errors.Is(err, ErrUnavailable) || snapshot != nil {
		t.Fatalf("changed policy snapshot=%+v err=%v", snapshot, err)
	}
}

func TestPrincipalOnlySnapshotBindsVerifiedFactAndIdentityRevisions(t *testing.T) {
	facts := authz.Facts{Subject: "alice", Issuer: "issuer", Tenant: "tenant", Roles: []string{"reader"}, ValidUntil: time.Now().Add(time.Hour)}
	revision := "credential-1"
	lease := time.Now().Add(30 * time.Second)
	resolver := &AuthzResolver{
		Service: &authz.Service{Provider: authzTestProvider{facts}}, Version: "mapping-1",
		Account: func(context.Context, authz.Facts) (string, error) { return "account-1", nil },
		AuthorityRevision: func(_ context.Context, expected authz.Facts, account string) (string, time.Time, error) {
			if expected.Subject != "alice" || account != "account-1" {
				return "", time.Time{}, authz.ErrDenied
			}
			return revision, lease, nil
		},
		Map: func(context.Context, string, int, string, bool) (authz.Resource, string, *authz.Entity, error) {
			t.Fatal("principal-only snapshot requested a capability")
			return authz.Resource{}, "", nil, nil
		},
		Gate: func(context.Context, authz.Facts, string, authz.Resource, string, *authz.Entity) (policy.GateResult, error) {
			t.Fatal("principal-only snapshot invoked a gate")
			return policy.GateResult{}, nil
		},
	}
	request := &Request{ResourceType: "window", IncludePrincipal: true}
	first, err := resolver.Resolve(context.Background(), request)
	if err != nil || first.AuthorizationVersion == "mapping-1" || !first.ExpiresAt.Equal(lease) {
		t.Fatalf("principal snapshot=%+v err=%v", first, err)
	}
	revision = "credential-2"
	second, err := resolver.Resolve(context.Background(), request)
	if err != nil || second.AuthorizationVersion == first.AuthorizationVersion {
		t.Fatalf("credential revision reused snapshot version: %+v %v", second, err)
	}
	resolver.AuthorityRevision = nil
	factVersion, err := resolver.Resolve(context.Background(), request)
	if err != nil {
		t.Fatal(err)
	}
	facts.Roles = []string{"administrator"}
	resolver.Service.Provider = authzTestProvider{facts}
	changedFacts, err := resolver.Resolve(context.Background(), request)
	if err != nil || changedFacts.AuthorizationVersion == factVersion.AuthorizationVersion {
		t.Fatalf("changed facts reused snapshot version: %+v %v", changedFacts, err)
	}
}

func TestDeniedOptionalCapabilityTracksPolicyRevision(t *testing.T) {
	resource := authz.Resource{Kind: "global", ID: "settings", Version: "1", Tenant: "tenant"}
	docs := map[authz.Resource]authz.Document{resource: {
		Resource: resource, Revision: 1,
		Policies: map[string]authz.Policy{"manage": {Mode: "protected", Rule: &authz.Rule{Kind: "role", Value: "administrator"}}},
	}}
	resolver := &AuthzResolver{
		Service: &authz.Service{Store: authzTestStore{docs: docs}, Provider: authzTestProvider{authz.Facts{Subject: "alice", Issuer: "issuer", Tenant: "tenant", Roles: []string{"reader"}, ValidUntil: time.Now().Add(time.Hour)}}},
		Version: "mapping-1",
		Account: func(context.Context, authz.Facts) (string, error) { return "account", nil },
		Map: func(context.Context, string, int, string, bool) (authz.Resource, string, *authz.Entity, error) {
			return resource, "manage", nil, nil
		},
		Gate: func(context.Context, authz.Facts, string, authz.Resource, string, *authz.Entity) (policy.GateResult, error) {
			t.Fatal("denied ACL invoked gate")
			return policy.GateResult{}, nil
		},
	}
	request := &Request{ResourceType: "window", RequestedGlobalCapabilities: []string{"manage"}}
	first, err := resolver.Resolve(context.Background(), request)
	if err != nil || first.GlobalCapabilities["manage"] {
		t.Fatalf("first denied capability=%+v err=%v", first, err)
	}
	doc := docs[resource]
	doc.Revision = 2
	docs[resource] = doc
	second, err := resolver.Resolve(context.Background(), request)
	if err != nil || second.GlobalCapabilities["manage"] || second.AuthorizationVersion == first.AuthorizationVersion {
		t.Fatalf("denied policy edit reused version: first=%+v second=%+v err=%v", first, second, err)
	}
}

type authzErrorProvider struct{ err error }

func (p authzErrorProvider) Resolve(context.Context) (authz.Facts, error) {
	return authz.Facts{}, p.err
}

type authzFlakyProvider struct {
	facts authz.Facts
	calls int
}

func (p *authzFlakyProvider) Resolve(context.Context) (authz.Facts, error) {
	p.calls++
	if p.calls > 1 {
		return authz.Facts{}, authz.ErrDenied
	}
	return p.facts, nil
}

type authzTestStore struct {
	docs map[authz.Resource]authz.Document
}
type authzErrorStore struct{ err error }
type capabilityDecisionProvider func(context.Context, authz.Request, authz.Document, authz.Facts) (authz.Decision, error)

func (f capabilityDecisionProvider) Evaluate(ctx context.Context, request authz.Request, doc authz.Document, facts authz.Facts) (authz.Decision, error) {
	return f(ctx, request, doc, facts)
}

func (s authzErrorStore) Get(context.Context, authz.Resource) (authz.Document, error) {
	return authz.Document{}, s.err
}
func (s authzErrorStore) Replace(context.Context, authz.Document, int64, string) (authz.Document, error) {
	return authz.Document{}, s.err
}

func (s authzTestStore) Get(_ context.Context, r authz.Resource) (authz.Document, error) {
	d, ok := s.docs[r]
	if !ok {
		return d, authz.ErrDenied
	}
	return d, nil
}
func (s authzTestStore) Replace(context.Context, authz.Document, int64, string) (authz.Document, error) {
	return authz.Document{}, authz.ErrDenied
}

func TestAuthzResolverProjectsPrincipalGlobalAndExactResource(t *testing.T) {
	facts := authz.Facts{Subject: "alice", Issuer: "issuer", Tenant: "tenant", Roles: []string{"reader"}, Exposures: []string{"feature"}, EntityGroups: authz.EntityGroups{"customer": {"12"}}, ValidUntil: time.Now().Add(time.Hour)}
	global := authz.Resource{Kind: "global", ID: "settings", Version: "1", Tenant: "tenant"}
	resource := authz.Resource{Kind: "customer", ID: "catalog", Version: "1", Tenant: "tenant"}
	allow := authz.Policy{Mode: "protected", Rule: &authz.Rule{Kind: "role", Value: "reader"}}
	service := &authz.Service{Provider: authzTestProvider{facts}, Store: authzTestStore{map[authz.Resource]authz.Document{
		global:   {Resource: global, Revision: 1, Policies: map[string]authz.Policy{"viewAccess": allow}},
		resource: {Resource: resource, Revision: 1, Policies: map[string]authz.Policy{"retrieve": {Mode: "protected", Rule: allow.Rule, EntityType: "customer"}, "update": {Mode: "protected", Rule: &authz.Rule{Kind: "role", Value: "administrator"}}}},
	}}}
	resolver := &AuthzResolver{Service: service, Version: "map-1", Account: func(context.Context, authz.Facts) (string, error) { return "account-1", nil }, Map: func(_ context.Context, _ string, id int, capability string, isGlobal bool) (authz.Resource, string, *authz.Entity, error) {
		if isGlobal && capability == "manageSettings" {
			return global, "viewAccess", nil, nil
		}
		if !isGlobal && capability == "read" {
			return resource, "retrieve", &authz.Entity{Type: "customer", ID: fmt.Sprint(id)}, nil
		}
		if !isGlobal && capability == "write" {
			return resource, "update", &authz.Entity{Type: "customer", ID: fmt.Sprint(id)}, nil
		}
		return authz.Resource{}, "", nil, authz.ErrDenied
	}, Gate: func(context.Context, authz.Facts, string, authz.Resource, string, *authz.Entity) (policy.GateResult, error) {
		return policy.GateResult{Allow: true, Revision: "gate-1", ValidUntil: time.Now().Add(time.Minute)}, nil
	}, EntityPermission: func(_ context.Context, _ authz.Facts, entity authz.Entity, capability string) (bool, error) {
		return entity.ID == "12" && capability == "read", nil
	}, EntityRoles: func(_ context.Context, _ authz.Facts, entity authz.Entity) ([]string, error) {
		if entity.ID != "12" {
			t.Fatalf("roles requested for unreadable entity %+v", entity)
		}
		return []string{"entityReader"}, nil
	}}
	snapshot, err := resolver.Resolve(context.Background(), &Request{ResourceType: "customer", ResourceIDs: []int{12, 13}, RequestedCapabilities: []string{"read", "write"}, RequestedGlobalCapabilities: []string{"manageSettings"}, IncludePrincipal: true})
	if err != nil {
		t.Fatal(err)
	}
	if snapshot.GlobalCapabilities["manageSettings"] != true || !snapshot.Resources["12"].Capabilities["read"] || snapshot.Resources["12"].Capabilities["write"] || snapshot.Resources["13"].Capabilities["read"] || len(snapshot.Resources["12"].Roles) != 1 || snapshot.Resources["12"].Roles[0] != "entityReader" || len(snapshot.Resources["13"].Roles) != 0 || snapshot.Principal["features"].([]string)[0] != "feature" || snapshot.Account["id"] != "account-1" {
		t.Fatalf("unexpected snapshot: %+v", snapshot)
	}
	currentRoles := resolver.EntityRoles
	resolver.EntityRoles = func(context.Context, authz.Facts, authz.Entity) ([]string, error) {
		return nil, errors.New("role provider unavailable")
	}
	if failed, err := resolver.Resolve(context.Background(), &Request{ResourceType: "customer", ResourceIDs: []int{12}, RequestedCapabilities: []string{"read"}}); failed != nil || !errors.Is(err, ErrUnavailable) {
		t.Fatalf("role provider outage returned snapshot: %+v %v", failed, err)
	}
	resolver.EntityRoles = currentRoles
	resolver.ProjectAccount = func(context.Context, authz.Facts, string) (map[string]any, error) {
		return map[string]any{"id": "other"}, nil
	}
	if _, err := resolver.Resolve(context.Background(), &Request{ResourceType: "customer", IncludePrincipal: true}); err == nil {
		t.Fatal("account projection changed verified account")
	}
	resolver.ProjectAccount = nil
	if unknown, err := resolver.Resolve(context.Background(), &Request{ResourceType: "customer", RequestedGlobalCapabilities: []string{"unknown"}}); err != nil || unknown.GlobalCapabilities["unknown"] {
		t.Fatalf("unknown capability was accepted: %+v %v", unknown, err)
	}
	currentGate := resolver.Gate
	resolver.Gate = func(context.Context, authz.Facts, string, authz.Resource, string, *authz.Entity) (policy.GateResult, error) {
		return policy.GateResult{}, authz.ErrDenied
	}
	if failed, err := resolver.Resolve(context.Background(), &Request{ResourceType: "customer", ResourceIDs: []int{12}, RequestedCapabilities: []string{"read"}}); failed != nil || !errors.Is(err, authz.ErrDenied) {
		t.Fatalf("gate identity error returned snapshot: %+v %v", failed, err)
	}
	resolver.Gate = currentGate
	currentPermission := resolver.EntityPermission
	resolver.EntityPermission = func(context.Context, authz.Facts, authz.Entity, string) (bool, error) { return false, authz.ErrDenied }
	if failed, err := resolver.Resolve(context.Background(), &Request{ResourceType: "customer", ResourceIDs: []int{12}, RequestedCapabilities: []string{"read"}}); failed != nil || !errors.Is(err, authz.ErrDenied) {
		t.Fatalf("entity provider error returned snapshot: %+v %v", failed, err)
	}
	resolver.EntityPermission = currentPermission
	resolver.Gate = func(context.Context, authz.Facts, string, authz.Resource, string, *authz.Entity) (policy.GateResult, error) {
		return policy.GateResult{Allow: false, Revision: "feature-off", ValidUntil: time.Now().Add(time.Minute)}, nil
	}
	snapshot, err = resolver.Resolve(context.Background(), &Request{ResourceType: "customer", ResourceIDs: []int{12}, RequestedCapabilities: []string{"read"}, RequestedGlobalCapabilities: []string{"manageSettings"}})
	if err != nil || snapshot.GlobalCapabilities["manageSettings"] || snapshot.Resources["12"].Capabilities["read"] {
		t.Fatalf("gate bypassed: %+v %v", snapshot, err)
	}
}

func TestExplicitRemoteCapabilityDenialIsFalseWhileOutageInvalidates(t *testing.T) {
	facts := authz.Facts{Subject: "alice", Issuer: "issuer", Tenant: "tenant", Roles: []string{"reader"}, EntityGroups: authz.EntityGroups{"customer": {"12"}}, ValidUntil: time.Now().Add(time.Hour)}
	resource := authz.Resource{Kind: "customer", ID: "catalog", Version: "1", Tenant: "tenant"}
	allow := authz.Policy{Mode: "protected", Rule: &authz.Rule{Kind: "role", Value: "reader"}, EntityType: "customer"}
	doc := authz.Document{Resource: resource, Revision: 1, Policies: map[string]authz.Policy{"retrieve": allow, "update": allow}}
	store := authzTestStore{docs: map[authz.Resource]authz.Document{resource: doc}}
	service := &authz.Service{Provider: authzTestProvider{facts}, Store: store}
	deniedAction := "update"
	service.Decisions = capabilityDecisionProvider(func(_ context.Context, request authz.Request, doc authz.Document, facts authz.Facts) (authz.Decision, error) {
		if request.Action == deniedAction {
			return authz.Decision{}, authz.ErrDenied
		}
		return authz.Evaluate(request, doc.Policies, facts, time.Now())
	})
	resolver := &AuthzResolver{Service: service, Version: "v1", Account: func(context.Context, authz.Facts) (string, error) { return "account", nil }, Map: func(_ context.Context, _ string, id int, capability string, global bool) (authz.Resource, string, *authz.Entity, error) {
		if global {
			return authz.Resource{}, "", nil, authz.ErrDenied
		}
		action := map[string]string{"read": "retrieve", "write": "update"}[capability]
		if action == "" {
			return authz.Resource{}, "", nil, authz.ErrDenied
		}
		return resource, action, &authz.Entity{Type: "customer", ID: fmt.Sprint(id)}, nil
	}, Gate: func(context.Context, authz.Facts, string, authz.Resource, string, *authz.Entity) (policy.GateResult, error) {
		return policy.GateResult{Allow: true, Revision: "r1", ValidUntil: time.Now().Add(time.Minute)}, nil
	}, EntityPermission: func(context.Context, authz.Facts, authz.Entity, string) (bool, error) { return true, nil }}
	request := &Request{ResourceType: "customer", ResourceIDs: []int{12}, RequestedCapabilities: []string{"read", "write"}}
	snapshot, err := resolver.Resolve(context.Background(), request)
	if err != nil || !snapshot.Resources["12"].Capabilities["read"] || snapshot.Resources["12"].Capabilities["write"] {
		t.Fatalf("optional remote denial=%+v %v", snapshot, err)
	}
	delete(doc.Policies, "update")
	store.docs[resource] = doc
	snapshot, err = resolver.Resolve(context.Background(), request)
	if err != nil || snapshot.Resources["12"].Capabilities["write"] {
		t.Fatalf("missing optional policy=%+v %v", snapshot, err)
	}
	doc.Policies["update"] = allow
	store.docs[resource] = doc
	deniedAction = "retrieve"
	var window forgetypes.Window
	if err := json.Unmarshal([]byte(`{"authorization":{"scope":"resource","resource":{"type":"customer","id":{"source":"windowForm","selector":"CustomerID"}},"requestedCapabilities":["read"]},"view":{"content":{"id":"root"}}}`), &window); err != nil {
		t.Fatal(err)
	}
	bound, err := Bind(&window, "customer", "conversation", map[string]any{"CustomerID": 12})
	if err != nil {
		t.Fatal(err)
	}
	result, err := NewRuntime(resolver).Apply(context.Background(), bound)
	if err != nil || result.Denied || result.Window == nil {
		t.Fatalf("entity read capability incorrectly became whole-window admission: %+v %v", result, err)
	}
	if _, detailed := any(service).(interface {
		AuthorizeWithStatus(context.Context, authz.Request) (authz.Decision, authz.Facts, int64, error)
	}); detailed {
		service.Decisions = capabilityDecisionProvider(func(context.Context, authz.Request, authz.Document, authz.Facts) (authz.Decision, error) {
			return authz.Decision{}, errors.New("provider outage")
		})
		if result, err := resolver.Resolve(context.Background(), request); result != nil || !errors.Is(err, ErrUnavailable) {
			t.Fatalf("remote outage returned snapshot: %+v %v", result, err)
		}
	}
}

func TestAuthzResolverFailsSnapshotOnProviderFailure(t *testing.T) {
	facts := authz.Facts{Subject: "alice", Issuer: "issuer", Tenant: "tenant", Roles: []string{"reader"}, ValidUntil: time.Now().Add(time.Hour)}
	resource := authz.Resource{Kind: "global", ID: "settings", Version: "1", Tenant: "tenant"}
	provider := &authzFlakyProvider{facts: facts}
	service := &authz.Service{Provider: provider, Store: authzTestStore{map[authz.Resource]authz.Document{resource: {Resource: resource, Revision: 1, Policies: map[string]authz.Policy{"viewAccess": {Mode: "protected", Rule: &authz.Rule{Kind: "role", Value: "reader"}}}}}}}
	resolver := &AuthzResolver{Service: service, Version: "mapping-1", Account: func(context.Context, authz.Facts) (string, error) { return "account", nil }, Map: func(context.Context, string, int, string, bool) (authz.Resource, string, *authz.Entity, error) {
		return resource, "viewAccess", nil, nil
	}, Gate: func(context.Context, authz.Facts, string, authz.Resource, string, *authz.Entity) (policy.GateResult, error) {
		t.Fatal("gate reached after provider failure")
		return policy.GateResult{}, nil
	}}
	if snapshot, err := resolver.Resolve(context.Background(), &Request{ResourceType: "global", RequestedGlobalCapabilities: []string{"manageSettings"}}); err == nil || snapshot != nil {
		t.Fatalf("provider failure produced snapshot: %+v %v", snapshot, err)
	}
}

func TestAuthzResolverClassifiesIdentityOutageWithoutReturningSnapshot(t *testing.T) {
	resolver := &AuthzResolver{Service: &authz.Service{Provider: authzErrorProvider{errors.New("private IdP failure")}}, Version: "v1", Account: func(context.Context, authz.Facts) (string, error) { return "account", nil }, Map: func(context.Context, string, int, string, bool) (authz.Resource, string, *authz.Entity, error) {
		return authz.Resource{}, "", nil, authz.ErrDenied
	}, Gate: func(context.Context, authz.Facts, string, authz.Resource, string, *authz.Entity) (policy.GateResult, error) {
		return policy.GateResult{}, nil
	}}
	if snapshot, err := resolver.Resolve(context.Background(), &Request{ResourceType: "document", IncludePrincipal: true}); snapshot != nil || !errors.Is(err, ErrUnavailable) || errors.Is(err, authz.ErrDenied) {
		t.Fatalf("outage snapshot=%+v err=%v", snapshot, err)
	}
	resolver.Service.Provider = authzErrorProvider{authz.ErrDenied}
	if snapshot, err := resolver.Resolve(context.Background(), &Request{ResourceType: "document", IncludePrincipal: true}); snapshot != nil || !errors.Is(err, authz.ErrDenied) {
		t.Fatalf("rejected identity snapshot=%+v err=%v", snapshot, err)
	}
}

func TestAuthzResolverClassifiesPolicyStoreOutage(t *testing.T) {
	resource := authz.Resource{Kind: "global", ID: "settings", Version: "1", Tenant: "tenant"}
	facts := authz.Facts{Subject: "alice", Issuer: "issuer", Tenant: "tenant", ValidUntil: time.Now().Add(time.Minute)}
	resolver := &AuthzResolver{Service: &authz.Service{Provider: authzTestProvider{facts}, Store: authzErrorStore{errors.New("private database detail")}}, Version: "v1", Account: func(context.Context, authz.Facts) (string, error) { return "account", nil }, Map: func(context.Context, string, int, string, bool) (authz.Resource, string, *authz.Entity, error) {
		return resource, "execute", nil, nil
	}, Gate: func(context.Context, authz.Facts, string, authz.Resource, string, *authz.Entity) (policy.GateResult, error) {
		return policy.GateResult{}, nil
	}}
	if snapshot, err := resolver.Resolve(context.Background(), &Request{ResourceType: "global", RequestedGlobalCapabilities: []string{"view"}}); snapshot != nil || !errors.Is(err, ErrUnavailable) {
		t.Fatalf("store outage snapshot=%+v err=%v", snapshot, err)
	}
}

func TestAuthzResolverV2KeepsLargeStringIDsExact(t *testing.T) {
	id := "9007199254740993"
	facts := authz.Facts{Subject: "alice", Issuer: "issuer", Tenant: "tenant", Roles: []string{"reader"}, EntityGroups: authz.EntityGroups{"customer": {authz.EntityID(id)}}, ValidUntil: time.Now().Add(time.Hour)}
	resource := authz.Resource{Kind: "customer", ID: "catalog", Version: "1", Tenant: "tenant"}
	service := &authz.Service{Provider: authzTestProvider{facts}, Store: authzTestStore{map[authz.Resource]authz.Document{resource: {Resource: resource, Revision: 1, Policies: map[string]authz.Policy{"retrieve": {Mode: "protected", Rule: &authz.Rule{Kind: "role", Value: "reader"}, EntityType: "customer"}}}}}}
	resolver := &AuthzResolver{Service: service, Version: "v2", Account: func(context.Context, authz.Facts) (string, error) { return "account", nil }, MapV2: func(_ context.Context, _, selectedID, capability string, global bool) (authz.Resource, string, *authz.Entity, error) {
		if global || capability != "read" {
			return authz.Resource{}, "", nil, authz.ErrDenied
		}
		return resource, "retrieve", &authz.Entity{Type: "customer", ID: selectedID}, nil
	}, Gate: func(context.Context, authz.Facts, string, authz.Resource, string, *authz.Entity) (policy.GateResult, error) {
		return policy.GateResult{Allow: true, Revision: "gate-v2", ValidUntil: time.Now().Add(time.Minute)}, nil
	}, EntityPermission: func(_ context.Context, _ authz.Facts, entity authz.Entity, _ string) (bool, error) {
		return entity.ID == id, nil
	}, EntityRoles: func(_ context.Context, _ authz.Facts, entity authz.Entity) ([]string, error) {
		if entity.ID != id {
			t.Fatalf("v2 role entity changed: %+v", entity)
		}
		return []string{"exactRole"}, nil
	}}
	snapshot, err := resolver.Resolve(context.Background(), &Request{SchemaVersion: 2, ResourceType: "customer", StringResourceIDs: []string{id}, RequestedCapabilities: []string{"read"}})
	if err != nil || snapshot.SchemaVersion != 2 || snapshot.Resources[id].IDString != id || !snapshot.Resources[id].Capabilities["read"] || len(snapshot.Resources[id].Roles) != 1 || snapshot.Resources[id].Roles[0] != "exactRole" {
		t.Fatalf("v2 snapshot: %+v %v", snapshot, err)
	}
	if _, err := resolver.Resolve(context.Background(), &Request{SchemaVersion: 2, ResourceType: "customer", ResourceIDs: []int{42}}); err == nil {
		t.Fatal("v1 numeric IDs accepted on v2 request")
	}
}
