package policy

import (
	"context"
	"github.com/viant/authz/oauth"
	"github.com/viant/mcp/client/auth/link"
)

func hostIdentityContext(ctx context.Context) context.Context {
	if ctx == nil {
		return context.Background()
	}
	if token := link.IDToken(ctx); token != "" {
		return oauth.WithBearer(ctx, token)
	}
	return ctx
}
