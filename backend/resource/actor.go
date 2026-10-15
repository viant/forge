// SPDX-License-Identifier: Apache-2.0
// Extracted from Viant Agently Core; provider bindings are independent of agent execution.
package resource

import "time"

// VerifiedActor carries verified host identity, or an explicit unverified
// PublicRead scope. Only Valid admits verified identity for Studio mutations;
// the host must derive all private identity fields from verified identity.
type VerifiedActor struct {
	// PublicRead represents unverified public definition reads only; no identity authority.
	PublicRead       bool
	Subject          string
	Issuer           string
	TenantID         string
	AccountID        string
	IdentityRevision string
	ValidUntil       time.Time
}

func (a VerifiedActor) Valid(now time.Time) bool {
	return !a.PublicRead && a.Subject != "" && a.Issuer != "" && internalID(a.TenantID) && internalID(a.AccountID) &&
		a.IdentityRevision != "" && a.ValidUntil.After(now)
}

// ReadValid accepts the explicit public read scope without admitting it as a
// verified principal. Public scopes cannot carry private identity facts.
func (a VerifiedActor) ReadValid(now time.Time) bool {
	if !a.PublicRead {
		return a.Valid(now)
	}
	return a.Subject == "" && a.Issuer == "" && a.TenantID == "" && a.AccountID == "" && a.IdentityRevision == "" && MetadataExpiryValid(a.ValidUntil, now)
}
