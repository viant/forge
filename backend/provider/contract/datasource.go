// SPDX-License-Identifier: Apache-2.0
// Extracted from Viant Agently Core; provider bindings are independent of agent execution.
package primitive

import (
	identity "github.com/viant/forge/backend/resource"
	"strconv"
	"strings"
	"unicode/utf8"
)

// DataSourceReference names a reusable datasource owned by a trusted provider.
// The server selects its definition under the current release and access policy.
type DataSourceReference struct {
	Resource           identity.ResourceRef `json:"resource"`
	ContentFingerprint string               `json:"-"`
	ProviderIdentity   string               `json:"providerIdentity"`
}

func (r DataSourceReference) Validate(immutable bool) error {
	u, e := identity.ParseResourceURI(r.Resource.URI)
	if e != nil || u.Kind != "datasource" || r.ProviderIdentity == "" || len(r.ProviderIdentity) > 2048 || !utf8.ValidString(r.ProviderIdentity) || strings.TrimSpace(r.ProviderIdentity) != r.ProviderIdentity {
		return identity.ErrResource
	}
	if r.Resource.Revision == "" {
		return nil
	}
	if r.Resource.Revision == identity.WorkingCandidate {
		if immutable {
			return identity.ErrResource
		}
		return nil
	}
	number, err := strconv.ParseInt(r.Resource.Revision, 10, 64)
	if err != nil || number < 1 || strconv.FormatInt(number, 10) != r.Resource.Revision {
		return identity.ErrResource
	}
	return nil
}

// MatchesResolved checks source identity and an explicitly selected revision.
// Content identity belongs to the server's private resolution, not the consumer.
func (r DataSourceReference) MatchesResolved(pin identity.ResolvedResource) bool {
	return pin.URI == r.Resource.URI && pin.ProviderIdentity == r.ProviderIdentity && (r.Resource.Revision == "" || pin.Selector() == r.Resource.Revision)
}
