package artifactrelease

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"github.com/viant/authz"
	"github.com/viant/forge/backend/artifactcohort"
)

// Compilation is a pure projection of already persisted release choices and
// existing named policy heads into the artifactcohort manifest contract. No
// actor facts or source definitions are accepted here.
type Compilation struct {
	Policies     []authz.Document
	Cohorts      []artifactcohort.Cohort
	Dependencies []authz.NamedDependency
}

// CompileCohorts gives each named policy an independent cohort, so matching
// any one audience can admit the channel's exact roots. It composes the
// policy's normal use actions into one join rule; it never ANDs in the
// resource creator's authoring membership. Existing data execution and row
// authorization remain separate in the producer.
func CompileCohorts(ctx context.Context, channel Channel, bundle Bundle, namedDocuments []authz.Document) (Compilation, error) {
	if ctx == nil || ctx.Err() != nil || validateTargetChannel(channel, bundle) != nil {
		return Compilation{}, ErrInvalid
	}
	store, err := authz.NewStaticStore(namedDocuments)
	if err != nil {
		return Compilation{}, ErrInvalid
	}
	result := Compilation{}
	dependencies := map[authz.Resource]int64{}
	for _, ref := range channel.Policies {
		head, err := store.Get(ctx, ref.Resource)
		if err != nil || head.Revision < ref.Revision {
			return Compilation{}, ErrConflict
		}
		definition, err := authz.Definition(head)
		if err != nil {
			return Compilation{}, ErrInvalid
		}
		for _, action := range []string{"describe", "execute"} {
			if _, found := authz.PolicyForAction(definition.Policies, action); !found {
				return Compilation{}, fmt.Errorf("%w: named policy lacks %s", ErrInvalid, action)
			}
		}
		actions := []string{"describe", "execute"}
		if _, found := authz.PolicyForAction(definition.Policies, "discover"); found {
			actions = append(actions, "discover")
		}
		resource := channelPolicyResource(channel.Key, ref)
		selection := authz.Document{Resource: resource, Revision: int64(channel.Revision), Policies: map[string]authz.Policy{}}
		for _, action := range actions {
			copy := ref
			declared, _ := authz.PolicyForAction(definition.Policies, action)
			selection.Policies[action] = authz.Policy{Mode: "named", Named: &copy, Priority: declared.Priority}
		}
		resolved, used, err := authz.ResolveNamedDocument(ctx, store, selection)
		if err != nil {
			return Compilation{}, err
		}
		for _, dependency := range used {
			if prior := dependencies[dependency.Resource]; prior != 0 && prior != dependency.Revision {
				return Compilation{}, ErrConflict
			}
			dependencies[dependency.Resource] = dependency.Revision
		}
		join, err := joinUsePolicies(resolved.Policies, actions)
		if err != nil {
			return Compilation{}, err
		}
		document := authz.Document{Resource: resource, Revision: int64(channel.Revision), Policies: map[string]authz.Policy{artifactcohort.PolicyAction: join}}
		if authz.ValidateDocument(document) != nil {
			return Compilation{}, ErrInvalid
		}
		result.Policies = append(result.Policies, document)
		result.Cohorts = append(result.Cohorts, artifactcohort.Cohort{Tenant: channel.Key.Tenant, Name: ReleaseCohortName(channel.Key, ref), PolicyResource: resource, Priority: join.Priority, Roots: append([]artifactcohort.RootRef(nil), bundle.Roots...)})
	}
	for resource, revision := range dependencies {
		result.Dependencies = append(result.Dependencies, authz.NamedDependency{Resource: resource, Revision: revision})
	}
	sort.Slice(result.Dependencies, func(i, j int) bool {
		return policyResourceKey(result.Dependencies[i].Resource) < policyResourceKey(result.Dependencies[j].Resource)
	})
	return result, nil
}

func joinUsePolicies(policies map[string]authz.Policy, actions []string) (authz.Policy, error) {
	rules := []authz.Rule{}
	scopes := map[string]bool{}
	entityType := ""
	priority := 0
	for _, action := range actions {
		policy, found := authz.PolicyForAction(policies, action)
		if !found || policy.Mode == "deny" {
			return authz.Policy{Mode: "deny"}, nil
		}
		if policy.Mode != "protected" || policy.Rule == nil {
			return authz.Policy{}, ErrInvalid
		}
		// Release use is ranked by execution priority. Describe/discover remain
		// mandatory gates, but cannot change which permitted revision is used.
		if action == "execute" {
			priority = policy.Priority
		}
		if policy.EntityType != "" {
			// Replica.Admit rejects bounded join decisions. Keep this mandatory
			// source restriction intact and fail publication until the producer
			// supplies an independently valid unbounded audience policy.
			return authz.Policy{}, ErrBoundedMembership
		}
		if entityType != "" && policy.EntityType != "" && entityType != policy.EntityType {
			return authz.Policy{}, ErrInvalid
		}
		if entityType == "" {
			entityType = policy.EntityType
		}
		rules = append(rules, *policy.Rule)
		for _, scope := range policy.RequiredScopes {
			scopes[scope] = true
		}
	}
	if len(rules) == 0 {
		return authz.Policy{}, ErrInvalid
	}
	rule := rules[0]
	if len(rules) > 1 {
		rule = authz.Rule{Kind: "all", Rules: rules}
	}
	join := authz.Policy{Mode: "protected", Rule: &rule, EntityType: entityType, Priority: priority}
	for scope := range scopes {
		join.RequiredScopes = append(join.RequiredScopes, scope)
	}
	sort.Strings(join.RequiredScopes)
	if authz.ValidatePolicy(artifactcohort.PolicyAction, join) != nil {
		return authz.Policy{}, ErrInvalid
	}
	return join, nil
}

func policyResourceKey(value authz.Resource) string {
	return value.Tenant + "\x00" + value.Kind + "\x00" + value.ID + "\x00" + value.Version
}

// MergeActivation replaces this channel's derived cohorts and join documents
// in one complete candidate for Publisher.ReplaceCatalog. Unrelated cohorts,
// including other release channels and legacy bindings, remain untouched.
// The producer must fence Compilation.Dependencies and use its own post-commit
// outbox/retry before claiming the persisted channel is active.
func MergeActivation(existing artifactcohort.Manifest, key Key, current Compilation) ([]authz.Document, []artifactcohort.Cohort, error) {
	return MergeProjectedActivation(existing, key, key.Tenant, current)
}

// MergeProjectedActivation replaces a channel's compiled ordinary cohort
// projection when the receiving host uses a different verified audience
// tenant from the Studio storage tenant. The channel key and named-policy
// dependencies remain in the storage tenant; only ordinary output tenancy is
// changed by the trusted producer before this merge.
func MergeProjectedActivation(existing artifactcohort.Manifest, key Key, projectionTenant string, current Compilation) ([]authz.Document, []artifactcohort.Cohort, error) {
	if !key.Valid() || !(Key{Tenant: projectionTenant, Account: key.Account, Workspace: key.Workspace, Namespace: key.Namespace, Name: key.Name}).Valid() {
		return nil, nil, ErrInvalid
	}
	if existing.Hash != "" && artifactcohort.ValidateManifest(existing) != nil {
		return nil, nil, ErrInvalid
	}
	prefix := ReleaseCohortPrefix(key)
	policies := make([]authz.Document, 0, len(existing.Policies)+len(current.Policies))
	cohorts := make([]artifactcohort.Cohort, 0, len(existing.Cohorts)+len(current.Cohorts))
	for _, doc := range existing.Policies {
		if doc.Resource.Tenant == projectionTenant && doc.Resource.Kind == "cohort" && strings.HasPrefix(doc.Resource.ID, prefix) {
			continue
		}
		policies = append(policies, doc)
	}
	for _, cohort := range existing.Cohorts {
		if cohort.Tenant == projectionTenant && strings.HasPrefix(cohort.Name, prefix) {
			continue
		}
		cohorts = append(cohorts, cohort)
	}
	for _, doc := range current.Policies {
		if doc.Resource.Tenant != projectionTenant || doc.Resource.Kind != "cohort" || !strings.HasPrefix(doc.Resource.ID, prefix) {
			return nil, nil, ErrInvalid
		}
		policies = append(policies, doc)
	}
	for _, cohort := range current.Cohorts {
		if cohort.Tenant != projectionTenant || !strings.HasPrefix(cohort.Name, prefix) {
			return nil, nil, ErrInvalid
		}
		cohorts = append(cohorts, cohort)
	}
	// Preserve the existing producer's order for unrelated entries. Detach
	// nested policy/rule and root slices before an adapter mutates its candidate.
	// The publisher canonicalizes cohorts and validates duplicate policy keys.
	detached, err := artifactcohort.CloneManifest(artifactcohort.Manifest{Policies: policies, Cohorts: cohorts})
	if err != nil {
		return nil, nil, err
	}
	return detached.Policies, detached.Cohorts, nil
}
