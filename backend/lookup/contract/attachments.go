// SPDX-License-Identifier: Apache-2.0
// Window source compilation extracted from Viant Agently Core.
package overlay

import (
	"strconv"
	"strings"
	"unicode/utf8"

	identity "github.com/viant/forge/backend/resource"
)

// LibraryReference pins one reusable lookup or legacy template library resource. The provider
// and content fingerprint are expectations verified by the trusted reader;
// they never grant access or select a transport.
type LibraryReference struct {
	Resource           identity.ResourceRef `json:"resource" yaml:"resource"`
	ProviderIdentity   string               `json:"providerIdentity" yaml:"providerIdentity"`
	ContentFingerprint string               `json:"contentFingerprint" yaml:"contentFingerprint"`
}

// Validate checks the canonical lookup/template identity and its original source
// candidate. Immutable parents may reference only a stamped library revision.
func (r LibraryReference) Validate(immutableParent bool) error {
	uri, err := identity.ParseResourceURI(r.Resource.URI)
	if err != nil || (uri.Kind != "template" && uri.Kind != "lookup") || uri.String() != r.Resource.URI {
		return identity.ErrResource
	}
	if r.ProviderIdentity == "" || len(r.ProviderIdentity) > 2048 || !utf8.ValidString(r.ProviderIdentity) || strings.TrimSpace(r.ProviderIdentity) != r.ProviderIdentity {
		return identity.ErrResource
	}
	candidate := identity.ResourceCandidate{ContentFingerprint: r.ContentFingerprint}
	if r.Resource.Revision == identity.WorkingCandidate {
		if immutableParent {
			return identity.ErrResource
		}
		candidate.Kind = identity.WorkingCandidate
	} else {
		revision := r.Resource.Revision
		number, parseErr := strconv.ParseInt(revision, 10, 64)
		if parseErr != nil || number < 1 || strconv.FormatInt(number, 10) != revision {
			return identity.ErrResource
		}
		candidate.Kind = identity.StampedCandidate
		candidate.Revision = revision
	}
	if !candidate.Valid() {
		return identity.ErrResource
	}
	return nil
}

// ValidateLibraryReferences validates the references attached to one parent.
func ValidateLibraryReferences(refs []LibraryReference, immutableParent bool) error {
	for _, ref := range refs {
		if err := ref.Validate(immutableParent); err != nil {
			return err
		}
	}
	return nil
}
