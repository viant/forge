// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package policy

import (
	"context"
	"fmt"
	"strings"

	"github.com/viant/authz"
)

// ResourceBinding maps one opaque host operation/candidate to a canonical
// shared ACL resource/action. The host owns these bindings.
type ResourceBinding struct {
	Operation   string         `json:"operation"`
	CandidateID string         `json:"candidateId"`
	Resource    authz.Resource `json:"resource"`
	Action      string         `json:"action"`
}

type resourceBindingKey struct{ operation, candidateID string }

func NewStaticResourceMapper(bindings []ResourceBinding) (func(context.Context, string, Candidate) (authz.Resource, string, error), error) {
	index := make(map[resourceBindingKey]ResourceBinding, len(bindings))
	for _, binding := range bindings {
		if binding.Operation == "" || binding.CandidateID == "" || binding.Action == "" || binding.Resource.Kind == "" || binding.Resource.ID != binding.CandidateID || binding.Resource.Version == "" || binding.Resource.Tenant == "" || strings.TrimSpace(binding.Operation) != binding.Operation || strings.TrimSpace(binding.CandidateID) != binding.CandidateID {
			return nil, fmt.Errorf("invalid whole-resource authorization binding")
		}
		key := resourceBindingKey{binding.Operation, binding.CandidateID}
		if _, exists := index[key]; exists {
			return nil, fmt.Errorf("duplicate whole-resource authorization binding")
		}
		index[key] = binding
	}
	return func(ctx context.Context, operation string, candidate Candidate) (authz.Resource, string, error) {
		if ctx == nil || ctx.Err() != nil {
			return authz.Resource{}, "", ErrDenied
		}
		binding, ok := index[resourceBindingKey{operation, candidate.ID}]
		if !ok {
			return authz.Resource{}, "", ErrDenied
		}
		return binding.Resource, binding.Action, nil
	}, nil
}
