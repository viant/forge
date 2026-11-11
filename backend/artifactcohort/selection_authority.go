package artifactcohort

import (
	"context"
	"encoding/json"
	"sort"

	"github.com/viant/authz"
)

// Prepare per-URI authority when the already-admitted selection changes. The
// outer cohort document/release name and unrelated roots are publication
// bookkeeping, not a new grant. Preserve the effective join policy, its named
// dependencies and selection priority; evaluating permission remains Admit's job.
func selectionAuthorities(manifest Manifest, admitted admission, selected string, roots map[string]RootRef) (map[string]string, error) {
	store, err := authz.NewStaticStore(manifest.Policies)
	if err != nil {
		return nil, ErrInvalid
	}
	proofs := map[string]map[string]bool{}
	for _, cohort := range manifest.Cohorts {
		if cohort.Tenant != admitted.tenant || admitted.cohorts[cohort.Name] != cohort.PolicyHash {
			continue
		}
		policy := authz.Policy{Mode: "public"}
		var dependencies []authz.NamedDependency
		if !cohort.Public {
			doc, err := store.Get(context.Background(), cohort.PolicyResource)
			if err != nil {
				return nil, ErrInvalid
			}
			resolved, used, err := authz.ResolveNamedDocument(context.Background(), store, doc)
			if err != nil {
				return nil, ErrInvalid
			}
			var ok bool
			policy, ok = authz.PolicyForAction(resolved.Policies, PolicyAction)
			if !ok {
				return nil, ErrInvalid
			}
			dependencies = used
		}
		add := func(refs []RootRef, mode string) error {
			raw, err := json.Marshal(struct {
				Mode         string
				Priority     int
				Policy       authz.Policy
				Dependencies []authz.NamedDependency
			}{mode, cohort.Priority, policy, dependencies})
			if err != nil {
				return err
			}
			proof := Hash(raw)
			for _, ref := range refs {
				if _, ok := roots[ref.URI]; !ok {
					continue
				}
				if proofs[ref.URI] == nil {
					proofs[ref.URI] = map[string]bool{}
				}
				proofs[ref.URI][proof] = true
			}
			return nil
		}
		if selected == "" || selected == cohort.Name {
			if err = add(cohort.Roots, "grant"); err != nil {
				return nil, err
			}
		}
		if err = add(cohort.RevisionOverrides, "override"); err != nil {
			return nil, err
		}
	}
	result := make(map[string]string, len(roots))
	for uri := range roots {
		entries := make([]string, 0, len(proofs[uri]))
		for proof := range proofs[uri] {
			entries = append(entries, proof)
		}
		if len(entries) == 0 {
			return nil, ErrDenied
		}
		sort.Strings(entries)
		raw, _ := json.Marshal(entries)
		result[uri] = Hash(raw)
	}
	return result, nil
}
