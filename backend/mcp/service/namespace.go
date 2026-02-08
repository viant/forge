package service

import (
	"context"
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/viant/mcp-protocol/authorization"
)

// NamespaceService derives a caller namespace from a JWT carried in context.
// It mirrors mcp-toolbox behavior: email/sub -> namespace; else stable token hash.
type NamespaceService struct {
	DefaultNamespace string
}

func NewNamespaceService() *NamespaceService {
	return &NamespaceService{DefaultNamespace: "default"}
}

func (s *NamespaceService) Namespace(ctx context.Context) (string, error) {
	if s == nil {
		return "default", nil
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
