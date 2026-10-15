// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package permittedview

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/viant/authz"
	"github.com/viant/forge/backend/policy"
)

// ErrUnavailable marks an authorization dependency failure. Callers must
// invalidate protected metadata and may return a retryable service status.
var ErrUnavailable = fmt.Errorf("permitted view authorization unavailable: %w", authz.ErrUnavailable)

// CapabilityMapping is server-owned. It translates an authored capability to
// the exact ACL resource/action and, for resource capabilities, selected entity.
// Global capabilities must return a nil entity and an unbounded ACL decision.
type CapabilityMapping func(context.Context, string, int, string, bool) (authz.Resource, string, *authz.Entity, error)
type CapabilityMappingV2 func(context.Context, string, string, string, bool) (authz.Resource, string, *authz.Entity, error)
type AccountProjection func(context.Context, authz.Facts, string) (map[string]any, error)

// AuthzResolver projects trusted ACL decisions into Forge's v1 snapshot shape.
// Account binding and mappings are injected by the host, never read from UI
// parameters. The host must independently enforce backend actions.
type AuthzResolver struct {
	Service *authz.Service
	Version string
	Account func(context.Context, authz.Facts) (string, error)
	// AuthorityRevision rechecks the host's verified identity, returning an
	// observed revision and lease. Static IdP hosts include the credential in it.
	AuthorityRevision func(context.Context, authz.Facts, string) (string, time.Time, error)
	ProjectAccount    AccountProjection
	Map               CapabilityMapping
	MapV2             CapabilityMappingV2
	// EntityPermission checks the exact mapped entity and capability through a
	// trusted provider. ACL entity membership alone is insufficient.
	EntityPermission func(context.Context, authz.Facts, authz.Entity, string) (bool, error)
	// EntityPermissionWithLease preserves shorter provider authority leases.
	EntityPermissionWithLease func(context.Context, authz.Facts, authz.Entity, string) (bool, time.Time, error)
	// EntityRoles exposes only host-mapped roles on an exact entity whose read
	// capability passed. Global principal roles are never copied here.
	EntityRoles func(context.Context, authz.Facts, authz.Entity) ([]string, error)
	Gate        policy.GateCheck
}

func (r *AuthzResolver) Resolve(ctx context.Context, request *Request) (*Snapshot, error) {
	if request != nil && request.IncludePrincipal && strings.TrimSpace(request.ResourceType) == "" && len(request.ResourceIDs) == 0 && len(request.StringResourceIDs) == 0 && len(request.RequestedCapabilities) == 0 && len(request.RequestedGlobalCapabilities) == 0 {
		return r.resolvePrincipal(ctx, request)
	}
	if r == nil || r.Service == nil || r.Service.Provider == nil || r.Account == nil || r.Gate == nil || strings.TrimSpace(r.Version) == "" || request == nil || strings.TrimSpace(request.ResourceType) == "" || ctx.Err() != nil {
		return nil, fmt.Errorf("permitted view: authz resolver is not configured")
	}
	if request.SchemaVersion == 2 {
		if r.MapV2 == nil || len(request.ResourceIDs) != 0 {
			return nil, fmt.Errorf("permitted view: v2 capability mapping is unavailable")
		}
	} else if (request.SchemaVersion != 0 && request.SchemaVersion != 1) || r.Map == nil || len(request.StringResourceIDs) != 0 {
		return nil, fmt.Errorf("permitted view: v1 capability mapping is unavailable")
	}
	facts, err := r.Service.Provider.Resolve(ctx)
	if err != nil {
		if errors.Is(err, authz.ErrDenied) {
			return nil, authz.ErrDenied
		}
		return nil, ErrUnavailable
	}
	if facts.Subject == "" || facts.Issuer == "" || facts.Tenant == "" || !facts.ValidUntil.After(time.Now()) {
		return nil, fmt.Errorf("permitted view: verified principal is unavailable")
	}
	accountID, err := r.Account(ctx, facts)
	if err != nil {
		if errors.Is(err, authz.ErrDenied) {
			return nil, authz.ErrDenied
		}
		return nil, ErrUnavailable
	}
	if strings.TrimSpace(accountID) == "" {
		return nil, fmt.Errorf("permitted view: verified account is unavailable")
	}
	snapshot := &Snapshot{AuthorizationVersion: r.Version, ExpiresAt: facts.ValidUntil, GlobalCapabilities: map[string]bool{}, Resources: map[string]*Resource{}}
	if request.SchemaVersion == 2 {
		snapshot.SchemaVersion = 2
	}
	gateRevisions := map[string]bool{}
	policyRevisions := map[string]bool{}
	observedPolicies := map[authz.Resource]int64{}
	readEntities := map[string]authz.Entity{}
	reconfirmDenial := func() (bool, error) {
		current, err := r.Service.Provider.Resolve(ctx)
		if err != nil {
			if errors.Is(err, authz.ErrDenied) {
				return false, authz.ErrDenied
			}
			return false, ErrUnavailable
		}
		if !policy.SameAuthorityFacts(facts, current, time.Now()) {
			return false, ErrUnavailable
		}
		return false, nil
	}
	if request.IncludePrincipal {
		snapshot.Principal = map[string]any{"subject": facts.Subject, "issuer": facts.Issuer, "tenantId": facts.Tenant, "roles": append([]string{}, facts.Roles...), "features": append([]string{}, facts.Exposures...)}
		project := r.ProjectAccount
		if project == nil {
			project = OpaqueAccountProjection
		}
		account, err := project(ctx, facts, accountID)
		if err != nil {
			return nil, ErrUnavailable
		}
		if account == nil || fmt.Sprint(account["id"]) != accountID {
			return nil, fmt.Errorf("permitted view: verified account projection is invalid")
		}
		snapshot.Account = account
	}
	check := func(id int, stringID, capability string, global bool) (bool, error) {
		if strings.TrimSpace(capability) == "" {
			return false, fmt.Errorf("permitted view: empty capability")
		}
		var resource authz.Resource
		var action string
		var selected *authz.Entity
		var err error
		if request.SchemaVersion == 2 {
			resource, action, selected, err = r.MapV2(ctx, request.ResourceType, stringID, capability, global)
		} else {
			resource, action, selected, err = r.Map(ctx, request.ResourceType, id, capability, global)
		}
		if err != nil {
			if errors.Is(err, authz.ErrDenied) {
				return false, nil
			}
			return false, ErrUnavailable
		}
		if resource.Kind == "" || resource.ID == "" || resource.Tenant != facts.Tenant || action == "" || (global && selected != nil) || (!global && selected == nil) {
			return false, fmt.Errorf("permitted view: capability mapping is unavailable")
		}
		if r.Service.Store == nil {
			return false, ErrUnavailable
		}
		doc, err := r.Service.Store.Get(ctx, resource)
		if err != nil {
			if errors.Is(err, authz.ErrDenied) || errors.Is(err, sql.ErrNoRows) {
				return false, nil
			}
			return false, ErrUnavailable
		}
		if doc.Resource != resource || doc.Revision < 1 {
			return false, ErrUnavailable
		}
		if prior, exists := observedPolicies[resource]; exists && prior != doc.Revision {
			return false, ErrUnavailable
		}
		observedPolicies[resource] = doc.Revision
		policyBinding, err := json.Marshal(struct {
			Resource authz.Resource
			Action   string
			Revision int64
		}{resource, action, doc.Revision})
		if err != nil {
			return false, ErrUnavailable
		}
		policyRevisions[string(policyBinding)] = true
		if _, exists := doc.Policies[action]; !exists {
			return false, nil
		}
		var selection []authz.Entity
		if selected != nil {
			selection = []authz.Entity{*selected}
		}
		decision, current, decisionRevision, err := policy.AuthorizeSharedSelectionWithRevision(r.Service, ctx, authz.Request{Resource: resource, Action: action}, selection)
		if decisionRevision != 0 && decisionRevision != doc.Revision {
			return false, ErrUnavailable
		}
		if err != nil {
			if errors.Is(err, authz.ErrDenied) {
				return reconfirmDenial()
			}
			return false, ErrUnavailable
		}
		if decisionRevision < 1 {
			return false, ErrUnavailable
		}
		if current.Subject != "" {
			if !policy.SameAuthorityFacts(facts, current, time.Now()) {
				return false, fmt.Errorf("permitted view: principal changed during authorization")
			}
			if current.ValidUntil.Before(snapshot.ExpiresAt) {
				snapshot.ExpiresAt = current.ValidUntil
			}
		}
		if global && decision.Bounded {
			return false, nil
		}
		if decision.Bounded {
			found := false
			for _, entity := range decision.Entities {
				found = found || entity == *selected
			}
			if !found {
				return false, nil
			}
		}
		gate, err := r.Gate(ctx, facts, accountID, resource, action, selected)
		if err != nil {
			if errors.Is(err, authz.ErrDenied) || errors.Is(err, policy.ErrDenied) {
				return false, err
			}
			return false, ErrUnavailable
		}
		if gate.Revision == "" || !gate.ValidUntil.After(time.Now()) {
			return false, fmt.Errorf("permitted view: gate decision is invalid")
		}
		if gate.ValidUntil.Before(snapshot.ExpiresAt) {
			snapshot.ExpiresAt = gate.ValidUntil
		}
		gateRevisions[gate.Revision] = true
		if !gate.Allow {
			return false, nil
		}
		if global {
			return true, nil
		}
		if r.EntityPermission == nil && r.EntityPermissionWithLease == nil {
			return false, fmt.Errorf("permitted view: entity permission provider is unavailable")
		}
		var allowed bool
		var entityLease time.Time
		if r.EntityPermissionWithLease != nil {
			allowed, entityLease, err = r.EntityPermissionWithLease(ctx, facts, *selected, capability)
		} else {
			allowed, err = r.EntityPermission(ctx, facts, *selected, capability)
		}
		if err != nil {
			if errors.Is(err, authz.ErrDenied) {
				return false, err
			}
			return false, ErrUnavailable
		}
		if r.EntityPermissionWithLease != nil {
			if !entityLease.After(time.Now()) {
				return false, ErrUnavailable
			}
			if entityLease.Before(snapshot.ExpiresAt) {
				snapshot.ExpiresAt = entityLease
			}
		}
		if allowed && capability == "read" {
			key := stringID
			if request.SchemaVersion != 2 {
				key = strconv.Itoa(id)
			}
			readEntities[key] = *selected
		}
		return allowed, nil
	}
	projectRoles := func(key string, entry *Resource) error {
		entity, readable := readEntities[key]
		if !readable || r.EntityRoles == nil {
			return nil
		}
		roles, err := r.EntityRoles(ctx, facts, entity)
		if err != nil {
			if errors.Is(err, authz.ErrDenied) {
				return fmt.Errorf("permitted view: entity roles denied")
			}
			return ErrUnavailable
		}
		seen := map[string]bool{}
		for _, role := range roles {
			if role == "" || strings.TrimSpace(role) != role {
				return ErrUnavailable
			}
			seen[role] = true
		}
		entry.Roles = make([]string, 0, len(seen))
		for role := range seen {
			entry.Roles = append(entry.Roles, role)
		}
		sort.Strings(entry.Roles)
		return nil
	}
	for _, capability := range request.RequestedGlobalCapabilities {
		if _, exists := snapshot.GlobalCapabilities[capability]; exists {
			continue
		}
		allowed, err := check(0, "", capability, true)
		if err != nil {
			return nil, err
		}
		snapshot.GlobalCapabilities[capability] = allowed
	}
	for _, id := range request.ResourceIDs {
		if id <= 0 {
			return nil, fmt.Errorf("permitted view: positive resource ID is required")
		}
		key := strconv.Itoa(id)
		if snapshot.Resources[key] != nil {
			return nil, fmt.Errorf("permitted view: duplicate resource ID")
		}
		entry := &Resource{Type: request.ResourceType, ID: id, Capabilities: map[string]bool{}}
		for _, capability := range request.RequestedCapabilities {
			if _, exists := entry.Capabilities[capability]; exists {
				continue
			}
			allowed, err := check(id, "", capability, false)
			if err != nil {
				return nil, err
			}
			entry.Capabilities[capability] = allowed
		}
		if err := projectRoles(key, entry); err != nil {
			return nil, err
		}
		snapshot.Resources[key] = entry
	}
	for _, id := range request.StringResourceIDs {
		if id == "" || strings.TrimSpace(id) != id || snapshot.Resources[id] != nil {
			return nil, fmt.Errorf("permitted view: invalid or duplicate v2 resource ID")
		}
		entry := &Resource{Type: request.ResourceType, IDString: id, Capabilities: map[string]bool{}}
		for _, capability := range request.RequestedCapabilities {
			if _, exists := entry.Capabilities[capability]; exists {
				continue
			}
			allowed, err := check(0, id, capability, false)
			if err != nil {
				return nil, err
			}
			entry.Capabilities[capability] = allowed
		}
		if err := projectRoles(id, entry); err != nil {
			return nil, err
		}
		snapshot.Resources[id] = entry
	}
	current, err := r.Service.Provider.Resolve(ctx)
	if err != nil {
		if errors.Is(err, authz.ErrDenied) {
			return nil, authz.ErrDenied
		}
		return nil, ErrUnavailable
	}
	if !policy.SameAuthorityFacts(facts, current, time.Now()) {
		return nil, ErrUnavailable
	}
	currentAccount, err := r.Account(ctx, current)
	if err != nil || currentAccount != accountID {
		return nil, ErrUnavailable
	}
	if current.ValidUntil.Before(snapshot.ExpiresAt) {
		snapshot.ExpiresAt = current.ValidUntil
	}
	for resource, revision := range observedPolicies {
		currentDoc, err := r.Service.Store.Get(ctx, resource)
		if err != nil || currentDoc.Resource != resource || currentDoc.Revision != revision {
			return nil, ErrUnavailable
		}
	}
	if ctx.Err() != nil || !snapshot.ExpiresAt.After(time.Now()) {
		return nil, fmt.Errorf("permitted view: authorization expired")
	}
	authorityFacts := facts
	authorityFacts.ValidUntil = time.Time{}
	factBytes, err := json.Marshal(struct {
		AccountID string
		Facts     authz.Facts
	}{accountID, authorityFacts})
	if err != nil {
		return nil, ErrUnavailable
	}
	factHash := sha256.Sum256(factBytes)
	snapshot.AuthorizationVersion += ":facts:" + hex.EncodeToString(factHash[:12])
	if r.AuthorityRevision != nil {
		revision, lease, err := r.AuthorityRevision(ctx, facts, accountID)
		if err != nil {
			if errors.Is(err, authz.ErrDenied) {
				return nil, authz.ErrDenied
			}
			return nil, ErrUnavailable
		}
		if revision == "" || !lease.After(time.Now()) {
			return nil, ErrUnavailable
		}
		if lease.Before(snapshot.ExpiresAt) {
			snapshot.ExpiresAt = lease
		}
		identityHash := sha256.Sum256([]byte(revision))
		snapshot.AuthorizationVersion += ":identity:" + hex.EncodeToString(identityHash[:12])
	}
	if len(gateRevisions) != 0 {
		revisions := make([]string, 0, len(gateRevisions))
		for revision := range gateRevisions {
			revisions = append(revisions, revision)
		}
		sort.Strings(revisions)
		snapshot.AuthorizationVersion += ":" + strings.Join(revisions, ",")
	}
	if len(policyRevisions) != 0 {
		revisions := make([]string, 0, len(policyRevisions))
		for revision := range policyRevisions {
			revisions = append(revisions, revision)
		}
		sort.Strings(revisions)
		policyHash := sha256.Sum256([]byte(strings.Join(revisions, "\n")))
		snapshot.AuthorizationVersion += ":policies:" + hex.EncodeToString(policyHash[:12])
	}
	if ctx.Err() != nil || !snapshot.ExpiresAt.After(time.Now()) {
		return nil, ErrUnavailable
	}
	return snapshot, nil
}

// resolvePrincipal projects current authenticated roles/exposures for rendering.
// It never resolves an account, reads resource policies, or evaluates actions.
func (r *AuthzResolver) resolvePrincipal(ctx context.Context, request *Request) (*Snapshot, error) {
	if r == nil || r.Service == nil || r.Service.Provider == nil || ctx == nil || ctx.Err() != nil {
		return nil, ErrUnavailable
	}
	if request.SchemaVersion != 0 && request.SchemaVersion != 1 && request.SchemaVersion != 2 {
		return nil, fmt.Errorf("permitted view: unsupported schema")
	}
	facts, err := r.Service.Provider.Resolve(ctx)
	if err != nil {
		if errors.Is(err, authz.ErrDenied) {
			return nil, authz.ErrDenied
		}
		return nil, ErrUnavailable
	}
	if facts.Subject == "" || !facts.ValidUntil.After(time.Now()) || ctx.Err() != nil {
		return nil, ErrUnavailable
	}
	principal := map[string]any{"subject": facts.Subject, "issuer": facts.Issuer, "tenantId": facts.Tenant, "roles": append([]string{}, facts.Roles...), "features": append([]string{}, facts.Exposures...)}
	raw, err := json.Marshal(principal)
	if err != nil {
		return nil, ErrUnavailable
	}
	revision := sha256.Sum256(raw)
	snapshot := &Snapshot{AuthorizationVersion: "principal:" + hex.EncodeToString(revision[:]), ExpiresAt: facts.ValidUntil, Principal: principal, GlobalCapabilities: map[string]bool{}, Resources: map[string]*Resource{}}
	if request.SchemaVersion == 2 {
		snapshot.SchemaVersion = 2
	}
	return snapshot, nil
}
