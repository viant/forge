// SPDX-License-Identifier: Apache-2.0
// Window source compilation extracted from Viant Agently Core.
package overlay

import (
	identity "github.com/viant/forge/backend/resource"
	"strings"
)

// WithResourceScope projects dependency locators from the managing definition's
// provenance. It performs routing validation only, without resource policies.
func (l Lookup) WithResourceScope(resource *identity.ResolvedResource) (Lookup, error) {
	if resource == nil {
		return l, nil
	}
	owner, err := identity.ParseResourceURI(resource.URI)
	if err != nil {
		return l, err
	}
	scoped := func(kind, name string) (*identity.ResourceRef, error) {
		if name == "" {
			return nil, nil
		}
		if parsed, e := identity.ParseResourceURI(name); e == nil {
			if parsed.Kind != kind {
				return nil, identity.ErrResource
			}
			return &identity.ResourceRef{URI: name}, nil
		}
		if strings.Contains(name, "://") {
			return nil, identity.ErrResource
		}
		uri := identity.ResourceURI{Kind: kind, Namespace: owner.Namespace, Name: name}
		if !uri.Valid() {
			return nil, identity.ErrResource
		}
		return &identity.ResourceRef{URI: uri.String()}, nil
	}
	l.ProviderIdentity = resource.ProviderIdentity
	l.DataSourceResource, err = scoped("datasource", l.DataSource)
	if err != nil {
		return l, err
	}
	picker := l.WindowId
	if picker == "" {
		picker = l.DialogId
	}
	l.PickerResource, err = scoped("window", picker)
	return l, err
}
