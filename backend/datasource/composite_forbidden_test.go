package datasource

import (
	"fmt"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	"testing"
)

func TestCompositeEmptyOnForbiddenRequiresOptInAndTyped403(t *testing.T) {
	for _, tc := range []struct {
		name    string
		enabled bool
		err     error
		want    bool
	}{
		{"enabled 403", true, &dsproto.UpstreamAuthorizationError{Status: 403}, true},
		{"wrapped 403", true, fmt.Errorf("call: %w", &dsproto.UpstreamAuthorizationError{Status: 403}), true},
		{"default 403", false, &dsproto.UpstreamAuthorizationError{Status: 403}, false},
		{"unauthenticated", true, &dsproto.UpstreamAuthorizationError{Status: 401}, false},
		{"server failure", true, fmt.Errorf("server failure (500)"), false},
		{"untrusted text", true, fmt.Errorf("403 Forbidden"), false},
		{"redacted denial", true, dsproto.ErrDatasourceDenied, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if got := compositeEmptyOnError(dsproto.MCPCall{EmptyOnForbidden: tc.enabled}, tc.err); got != tc.want {
				t.Fatalf("got %v want %v", got, tc.want)
			}
		})
	}
}
