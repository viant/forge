// SPDX-License-Identifier: Apache-2.0
// Extracted from Viant Agently Core; provider bindings are independent of agent execution.
package window

import (
	"errors"
	"fmt"
	"strings"
	"time"

	identity "github.com/viant/forge/backend/resource"
)

var ErrResourceBinding = errors.New("invalid portable resource binding")

// ComponentBinding pins Datly dispatch to an exact authored component revision.
// An approved older component must never dispatch through an active alias.
type ComponentBinding struct {
	Kind               string `json:"kind,omitempty" yaml:"kind,omitempty"`
	ID                 string `json:"id" yaml:"id"`
	Revision           string `json:"revision" yaml:"revision"`
	ContentFingerprint string `json:"contentFingerprint,omitempty" yaml:"contentFingerprint,omitempty"`
	SchemaFingerprint  string `json:"schemaFingerprint" yaml:"schemaFingerprint"`
}

// ValidateResourceBindings validates a canonical bundle independently of its
// transport. Arbitrary MCP methods are supported. hostBindings maps producer's
// logical aliases to explicitly configured consumer server references.
func ValidateResourceBindings(definition *Definition, hostBindings map[string]string) error {
	if definition == nil || definition.Resource == nil || !definition.Resource.ResourceCandidate.Valid() {
		return ErrResourceBinding
	}
	uri, err := identity.ParseResourceURI(definition.Resource.URI)
	if err != nil {
		return err
	}
	if uri.Kind == "report" && definition.Report == nil || uri.Kind == "window" && definition.Window == nil {
		return ErrResourceBinding
	}
	if definition.Resource.AuthorityBinding == "" || !definition.Resource.ValidUntil.After(time.Now()) {
		return ErrResourceBinding
	}
	mapped := map[string]string{}
	for id, source := range definition.DataSources {
		if id == "" || source == nil || source.ID != id || source.Backend == nil {
			return fmt.Errorf("%w: datasource %q", ErrResourceBinding, id)
		}
		backend := source.Backend
		if backend.Method == "" || strings.TrimSpace(backend.Method) != backend.Method || !validFingerprint(backend.SchemaFingerprint) {
			return fmt.Errorf("%w: datasource %q contract", ErrResourceBinding, id)
		}
		switch backend.Ownership {
		case "provider":
			if backend.Service != "" {
				return fmt.Errorf("%w: provider datasource %q exposes host alias", ErrResourceBinding, id)
			}
		case "host":
			if backend.Service == "" || hostBindings[backend.Service] == "" {
				return fmt.Errorf("%w: datasource %q missing host binding", ErrResourceBinding, id)
			}
			server := hostBindings[backend.Service]
			// Alias keys must be canonical. Trimming must never create a competing
			// binding to a different host server.
			normalized := strings.TrimSpace(backend.Service)
			if normalized != backend.Service {
				return ErrResourceBinding
			}
			if old, ok := mapped[normalized]; ok && old != server {
				return fmt.Errorf("%w: conflicting alias", ErrResourceBinding)
			}
			mapped[normalized] = server
		default:
			return fmt.Errorf("%w: datasource %q ownership", ErrResourceBinding, id)
		}
		if backend.Kind == "datly" && backend.Component == nil {
			return fmt.Errorf("%w: datasource %q requires component revision", ErrResourceBinding, id)
		}
		if backend.Component != nil {
			component := backend.Component
			if component.ID == "" || strings.TrimSpace(component.ID) != component.ID || component.Revision == "" || component.Revision == "active" || component.Revision == "latest" || component.Revision == "working" || !validFingerprint(component.SchemaFingerprint) {
				return fmt.Errorf("%w: datasource %q component pin", ErrResourceBinding, id)
			}
			if backend.Kind == "datly" && (component.Kind != "dynamic" && component.Kind != "linked" || !validFingerprint(component.ContentFingerprint)) {
				return fmt.Errorf("%w: datasource %q component identity", ErrResourceBinding, id)
			}
		}
	}
	for alias, server := range hostBindings {
		if alias == "" || strings.TrimSpace(alias) != alias || server == "" || strings.TrimSpace(server) != server {
			return fmt.Errorf("%w: conflicting or invalid alias", ErrResourceBinding)
		}
	}
	return nil
}
func validFingerprint(hash string) bool {
	return (identity.ResourceCandidate{Kind: identity.WorkingCandidate, ContentFingerprint: hash}).Valid()
}

// ValidateComponentDispatch checks the actual dispatch target against the
// approved datasource pin. Call after resolving a component, before executing.
func ValidateComponentDispatch(expected *ComponentBinding, actual ComponentBinding) error {
	if expected == nil || expected.ID != actual.ID || expected.Revision != actual.Revision || expected.SchemaFingerprint != actual.SchemaFingerprint {
		return fmt.Errorf("%w: component revision drift", ErrResourceBinding)
	}
	if expected.Kind != "" && expected.Kind != actual.Kind || expected.ContentFingerprint != "" && (!validFingerprint(actual.ContentFingerprint) || expected.ContentFingerprint != actual.ContentFingerprint) {
		return fmt.Errorf("%w: component content drift", ErrResourceBinding)
	}
	return nil
}

// ValidateFetchResource requires a fetch to carry exactly the definition's
// resolved candidate. Authorization must be rechecked by ResourceResolver.
func ValidateFetchResource(definition *Definition, input FetchInput) error {
	if definition == nil || definition.Resource == nil || input.Resource == nil || definition.Resource.URI != input.Resource.URI || definition.Resource.ResourceCandidate != input.Resource.ResourceCandidate || definition.Resource.AuthorityBinding != input.Resource.AuthorityBinding {
		return fmt.Errorf("%w: fetch resource differs from definition", ErrResourceBinding)
	}
	return nil
}

// MergeHostBindings rejects collisions across configured provider bundles.
// A provider's alias cannot silently redirect an earlier datasource binding.
func MergeHostBindings(bundles ...map[string]string) (map[string]string, error) {
	result := map[string]string{}
	for _, bundle := range bundles {
		for alias, server := range bundle {
			if alias == "" || server == "" || strings.TrimSpace(alias) != alias || strings.TrimSpace(server) != server {
				return nil, ErrResourceBinding
			}
			if previous, ok := result[alias]; ok && previous != server {
				return nil, fmt.Errorf("%w: alias %q conflicts", ErrResourceBinding, alias)
			}
			result[alias] = server
		}
	}
	return result, nil
}
