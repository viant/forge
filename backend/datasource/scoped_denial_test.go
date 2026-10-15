// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package datasource

import (
	"context"
	"errors"
	"testing"
	"time"

	ds "github.com/viant/forge/backend/datasource/contract"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
)

func TestManagingMCPDenialDoesNotRereadWindowAfterDispatch(t *testing.T) {
	for _, tc := range []struct {
		name   string
		status int
	}{{"forbidden", 403}, {"unauthorized", 401}} {
		t.Run(tc.name, func(t *testing.T) {
			now := time.Now()
			pin := identity.ResolvedResource{
				URI:               "window://owned/editor",
				ResourceCandidate: identity.ResourceCandidate{Kind: identity.WorkingCandidate, ContentFingerprint: identity.ContentFingerprint([]byte("definition"))},
				ProviderIdentity:  "owned", AuthorityBinding: "actor", ValidUntil: now.Add(time.Minute),
			}
			target := &types.WindowTarget{Platform: "web", SelectionToken: "held"}
			descriptor := &ds.DataSource{ID: "rows", Backend: &ds.Backend{Kind: ds.BackendMCPTool, Service: "fixture", Method: "Rows"}}
			revalidations, definitions, authorizations, executions := 0, 0, 0, 0
			atDispatch := [3]int{}
			service := New(Options{
				Now: func() time.Time { return now }, DisableCache: true,
				ResolveResource: func(_ context.Context, in identity.ResolvedResource) (*identity.ResolvedResource, error) {
					revalidations++
					if in != pin {
						return nil, identity.ErrResourceDenied
					}
					copy := in
					return &copy, nil
				},
				ResolveDefinition: func(_ context.Context, in identity.ResolvedResource, got *types.WindowTarget, id string) (*ds.DataSource, error) {
					definitions++
					if in != pin || id != "rows" || !types.SameWindowTarget(got, target) {
						return nil, identity.ErrResourceDenied
					}
					return descriptor, nil
				},
				AuthorizeDefinition: func(context.Context, *ds.DataSource, map[string]interface{}) error {
					authorizations++
					return nil
				},
				Executor: permissionResolverTestExecutor(func(context.Context, string, map[string]interface{}) (string, error) {
					executions++
					atDispatch = [3]int{revalidations, definitions, authorizations}
					now = now.Add(2 * time.Minute) // the original pin can expire while MCP decides
					return "", &ds.UpstreamAuthorizationError{Status: tc.status}
				}),
			})
			out, err := service.Fetch(context.Background(), "rows", nil, FetchOptions{Resource: &pin, Target: target})
			if out != nil || executions != 1 {
				t.Fatalf("result=%v dispatches=%d error=%v", out, executions, err)
			}
			if got := [3]int{revalidations, definitions, authorizations}; got != atDispatch {
				t.Fatalf("post-dispatch artifact read/check: before=%v after=%v", atDispatch, got)
			}
			if tc.status == 403 {
				if !errors.Is(err, ds.ErrDatasourceDenied) || errors.Is(err, identity.ErrResourceDenied) {
					t.Fatalf("managing denial changed scope: %v", err)
				}
			} else {
				var upstream *ds.UpstreamAuthorizationError
				if !errors.As(err, &upstream) || upstream.Status != 401 {
					t.Fatalf("upstream identity denial changed: %v", err)
				}
			}
		})
	}
}

type permissionResolverTestExecutor func(context.Context, string, map[string]interface{}) (string, error)

func (f permissionResolverTestExecutor) Execute(c context.Context, n string, a map[string]interface{}) (string, error) {
	return f(c, n, a)
}
