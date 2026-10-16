// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package service

import (
	"context"
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"github.com/viant/forge/backend/requestctx"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/viant/mcp-protocol/authorization"
)

// NamespaceService derives a caller namespace from a JWT carried in context.
// It mirrors mcp-toolbox behavior: email/sub -> namespace; else stable token hash.
// NamespaceIdentity carries only verified owner identity and its absolute lease.
// Fresh resolutions never renew a previously captured command deadline.
type NamespaceIdentity struct {
	Namespace  string
	ValidUntil time.Time
	// SessionBound is trusted startup ownership, never caller wire input.
	SessionBound bool `json:"-" yaml:"-"`
}
type NamespaceResolver func(context.Context) (NamespaceIdentity, error)

type NamespaceService struct {
	clearScopes      func(context.Context) context.Context
	metadataScope    MetadataReadScope
	Resolver         NamespaceResolver
	DefaultNamespace string
}

func NewNamespaceService(resolvers ...NamespaceResolver) *NamespaceService {
	s := &NamespaceService{DefaultNamespace: "default"}
	if len(resolvers) > 0 {
		s.Resolver = resolvers[0]
	}
	return s
}

func (s *NamespaceService) Namespace(ctx context.Context) (string, error) {
	if s == nil {
		return "default", nil
	}
	if s.Resolver != nil {
		identity, err := s.Identity(ctx)
		return identity.Namespace, err
	}
	tokenValue := ctx.Value(authorization.TokenKey)
	if tokenValue == nil {
		return s.DefaultNamespace, nil
	}
	var tokenString string
	switch tv := tokenValue.(type) {
	case string:
		tokenString = tv
	case *authorization.Token:
		tokenString = tv.Token
	default:
		return "", fmt.Errorf("unsupported token type %T", tokenValue)
	}
	tokenString = normalizeBearer(tokenString)
	return namespaceFromTokenString(tokenString, s.DefaultNamespace), nil
}

func (s *NamespaceService) NamespaceFromRequest(r *http.Request) string {
	if s == nil {
		return "default"
	}
	tokenString := normalizeBearer(r.Header.Get("Authorization"))
	return namespaceFromTokenString(tokenString, s.DefaultNamespace)
}

func normalizeBearer(v string) string {
	v = strings.TrimSpace(v)
	if strings.HasPrefix(strings.ToLower(v), "bearer ") {
		return strings.TrimSpace(v[len("bearer "):])
	}
	return v
}

func namespaceFromTokenString(tokenString string, fallback string) string {
	if tokenString == "" {
		return fallback
	}
	var claimMap jwt.MapClaims
	if _, _, err := new(jwt.Parser).ParseUnverified(tokenString, &claimMap); err == nil {
		if email, _ := claimMap["email"].(string); email != "" {
			return email
		}
		if sub, _ := claimMap["sub"].(string); sub != "" {
			return sub
		}
	}
	sum := md5.Sum([]byte(tokenString))
	return "tkn-" + hex.EncodeToString(sum[:])
}

// ConfigureNamespaceResolver is a pre-serving trusted host registration seam.
func (s *Service) ConfigureNamespaceResolver(resolve NamespaceResolver, clearScopes ...func(context.Context) context.Context) {
	if s != nil && s.cfg != nil {
		s.cfg.NamespaceResolver = resolve
		s.ns.Resolver = resolve
		s.hub.ns.Resolver = resolve
		s.ns.metadataScope = s.cfg.MetadataScope
		s.hub.ns.metadataScope = s.cfg.MetadataScope
		if len(clearScopes) > 0 {
			s.ns.clearScopes = clearScopes[0]
			s.hub.ns.clearScopes = clearScopes[0]
		}
	}
}

func (s *NamespaceService) receiverContext(ctx context.Context) context.Context {
	ctx = WithoutMetadataReadScope(ctx, s.metadataScope)
	ctx = requestctx.WithoutWindowReadDecision(ctx)
	if s.clearScopes != nil {
		ctx = s.clearScopes(ctx)
	}
	if ctx == nil || ctx.Err() != nil {
		return nil
	}
	return context.WithoutCancel(ctx)
}

func (s *NamespaceService) Identity(ctx context.Context) (NamespaceIdentity, error) {
	if s == nil || s.Resolver == nil {
		ns, err := s.Namespace(ctx)
		return NamespaceIdentity{Namespace: ns}, err
	}
	if ctx == nil || ctx.Err() != nil {
		return NamespaceIdentity{}, fmt.Errorf("UI identity unavailable")
	}
	identity, err := s.Resolver(ctx)
	if err != nil || strings.TrimSpace(identity.Namespace) == "" || !namespaceIdentityLive(identity, time.Now()) || ctx.Err() != nil {
		return NamespaceIdentity{}, fmt.Errorf("UI identity unavailable")
	}
	return identity, nil
}

// HasNamespaceResolver reports trusted startup UI-owner wiring only.
func (s *Service) HasNamespaceResolver() bool { return s != nil && s.ns != nil && s.ns.Resolver != nil }

// UIIdentity exposes the existing verified UI ownership scope for conversation
// state that has no window resource, such as inline report progress events.
func (s *Service) UIIdentity(ctx context.Context) (NamespaceIdentity, error) {
	if s == nil || s.ns == nil {
		return NamespaceIdentity{}, fmt.Errorf("UI identity unavailable")
	}
	return s.ns.Identity(ctx)
}

func namespaceIdentityLive(identity NamespaceIdentity, now time.Time) bool {
	if identity.ValidUntil.IsZero() {
		return identity.SessionBound
	}
	return identity.ValidUntil.After(now)
}
