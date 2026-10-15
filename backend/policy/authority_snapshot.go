// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package policy

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/viant/authz"
	"github.com/viant/authz/gating"
)

// AuthoritySnapshotResolver is explicitly registered by a trusted host. It
// returns facts, account and identity revision from one independently verified
// authority read. Each invocation is fresh; this contract grants no cache lease
// and never substitutes itself for a separately configured revision callback.
type AuthoritySnapshotResolver func(context.Context) (gating.Principal, error)

// ResolveAuthorityBinding validates an atomic authority result and derives the
// same identity/account/revision binding as the independent-read path. Call it
// separately before and after protected work; it does not retain any snapshot.
func ResolveAuthorityBinding(ctx context.Context, resolve AuthoritySnapshotResolver) (string, time.Time, error) {
	if ctx == nil || ctx.Err() != nil || resolve == nil {
		return "", time.Time{}, ErrIdentityRejected
	}
	principal, err := resolve(ctx)
	if err != nil {
		if errors.Is(err, authz.ErrDenied) || errors.Is(err, authz.ErrIdentityDenied) {
			return "", time.Time{}, ErrIdentityRejected
		}
		return "", time.Time{}, err
	}
	if ctx.Err() != nil {
		return "", time.Time{}, ErrIdentityRejected
	}
	valid := func(value string) bool { return value != "" && value != "*" && strings.TrimSpace(value) == value }
	for _, value := range []string{principal.Facts.Subject, principal.Facts.Issuer, principal.Facts.Tenant, principal.AccountID, principal.IdentityRevision} {
		if !valid(value) {
			return "", time.Time{}, ErrIdentityRejected
		}
	}
	lease := principal.Facts.ValidUntil
	if !lease.After(time.Now()) {
		return "", time.Time{}, ErrIdentityRejected
	}
	raw, err := json.Marshal(struct{ Subject, Issuer, Tenant, Account, Revision string }{principal.Facts.Subject, principal.Facts.Issuer, principal.Facts.Tenant, principal.AccountID, principal.IdentityRevision})
	if err != nil {
		return "", time.Time{}, err
	}
	digest := sha256.Sum256(raw)
	return hex.EncodeToString(digest[:]), lease, nil
}
