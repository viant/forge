// SPDX-License-Identifier: Apache-2.0
// Extracted from Viant Agently Core; provider bindings are independent of agent execution.
package primitive

import (
	identity "github.com/viant/forge/backend/resource"
	"strconv"
	"strings"
	"unicode/utf8"
)

// DataSourceReference binds a reusable definition to an explicit candidate.
// Fingerprints/provider IDs are expectations verified by the trusted resolver,
// never caller authorization. Working may be authored; stamps require immutable.
type DataSourceReference struct {
	Resource           identity.ResourceRef `json:"resource"`
	ContentFingerprint string               `json:"contentFingerprint"`
	ProviderIdentity   string               `json:"providerIdentity"`
}

func (r DataSourceReference) Validate(immutable bool) error {
	u, e := identity.ParseResourceURI(r.Resource.URI)
	if e != nil || u.Kind != "datasource" || r.ProviderIdentity == "" || len(r.ProviderIdentity) > 2048 || !utf8.ValidString(r.ProviderIdentity) || strings.TrimSpace(r.ProviderIdentity) != r.ProviderIdentity {
		return identity.ErrResource
	}
	candidate := identity.ResourceCandidate{ContentFingerprint: r.ContentFingerprint}
	if r.Resource.Revision == identity.WorkingCandidate {
		if immutable {
			return identity.ErrResource
		}
		candidate.Kind = identity.WorkingCandidate
	} else {
		number, e := strconv.ParseInt(r.Resource.Revision, 10, 64)
		if e != nil || number < 1 || strconv.FormatInt(number, 10) != r.Resource.Revision {
			return identity.ErrResource
		}
		candidate.Kind = identity.StampedCandidate
		candidate.Revision = r.Resource.Revision
	}
	if !candidate.Valid() {
		return identity.ErrResource
	}
	return nil
}
