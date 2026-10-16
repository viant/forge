// SPDX-License-Identifier: Apache-2.0
// Extracted from Viant Agently Core; provider bindings are independent of agent execution.
// Package user defines canonical identities beneath a user's resource namespace.
// These helpers validate structure only; the managing provider authorizes access.
package user

import (
	"strings"

	identity "github.com/viant/forge/backend/resource"
)

const Namespace = "users"

// NewURI retains the authenticated canonical user ID exactly. It never slugs,
// lowercases, URL-decodes or substitutes an email/display name for that ID.
func NewURI(kind, canonicalUser, path string) (identity.ResourceURI, error) {
	probe := identity.ResourceURI{Kind: kind, Namespace: canonicalUser, Name: "identity"}
	uri := identity.ResourceURI{Kind: kind, Namespace: Namespace, Name: canonicalUser + "/" + path}
	if !probe.Valid() || !uri.Valid() {
		return identity.ResourceURI{}, identity.ErrResource
	}
	return uri, nil
}

// Parse extracts identity components without deciding whether a caller owns them.
func Parse(uri identity.ResourceURI) (owner, path string, ok bool) {
	if uri.Namespace != Namespace || !uri.Valid() {
		return "", "", false
	}
	owner, path, ok = strings.Cut(uri.Name, "/")
	if !ok || owner == "" || path == "" {
		return "", "", false
	}
	return owner, path, true
}
