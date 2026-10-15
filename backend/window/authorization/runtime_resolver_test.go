// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package permittedview

import (
	"context"
	"reflect"
	"testing"
)

type resolverTestExecutor func(context.Context, string, map[string]interface{}) (string, error)

func (f resolverTestExecutor) Execute(ctx context.Context, name string, args map[string]interface{}) (string, error) {
	return f(ctx, name, args)
}

func TestMCPResolverRequiresExplicitTool(t *testing.T) {
	for _, name := range []string{"", " \t\n"} {
		t.Run(name, func(t *testing.T) {
			resolver := &MCPResolver{ToolName: name, Executor: resolverTestExecutor(func(context.Context, string, map[string]interface{}) (string, error) {
				t.Fatal("unconfigured authorization must not dispatch a tool")
				return "", nil
			})}
			snapshot, err := resolver.Resolve(context.Background(), &Request{})
			if err == nil || err.Error() != "permitted view: authorization tool is not configured" || snapshot != nil {
				t.Fatalf("expected configuration error and no snapshot, got %v, %v", snapshot, err)
			}
		})
	}
}

func TestRuntimeRequiresToolOnlyForAuthorizedViews(t *testing.T) {
	resolver := &MCPResolver{Executor: resolverTestExecutor(func(context.Context, string, map[string]interface{}) (string, error) {
		t.Fatal("an unconfigured authorization tool must never be dispatched")
		return "", nil
	})}
	t.Run("no authorization", func(t *testing.T) {
		window := testWindow(t)
		window.Authorization = nil
		bound, err := Bind(window, "window", "conversation", nil)
		if err != nil {
			t.Fatal(err)
		}
		for _, runtime := range []*Runtime{nil, NewRuntime(nil), NewRuntime(resolver)} {
			result, err := runtime.Apply(context.Background(), bound)
			if err != nil || result == nil || result.Denied || result.Window == nil {
				t.Fatalf("view without authorization should render without a resolver: result=%v err=%v", result, err)
			}
		}
	})
	t.Run("authorization defined", func(t *testing.T) {
		window := testWindow(t)
		window.Authorization.Resource = nil
		window.Authorization.ResourceType = "document"
		bound, err := Bind(window, "window", "conversation", nil)
		if err != nil {
			t.Fatal(err)
		}
		result, err := NewRuntime(resolver).Apply(context.Background(), bound)
		if result != nil || err == nil || err.Error() != "permitted view: authorization tool is not configured" {
			t.Fatalf("authorized view must require a configured tool: result=%v err=%v", result, err)
		}
	})
}

func TestMCPResolverUsesConfiguredTool(t *testing.T) {
	request := &Request{ResourceType: "document", ResourceIDs: []int{7}, RequestedCapabilities: []string{"read"}, IncludePrincipal: true}
	calls := 0
	resolver := &MCPResolver{ToolName: " access/authorize ", Executor: resolverTestExecutor(func(_ context.Context, name string, args map[string]interface{}) (string, error) {
		calls++
		if name != "access/authorize" {
			t.Fatalf("unexpected tool %q", name)
		}
		want := map[string]interface{}{
			"ResourceType": request.ResourceType, "ResourceIDs": request.ResourceIDs,
			"RequestedCapabilities":       request.RequestedCapabilities,
			"RequestedGlobalCapabilities": request.RequestedGlobalCapabilities,
			"IncludePrincipal":            request.IncludePrincipal,
		}
		if !reflect.DeepEqual(args, want) {
			t.Fatalf("unexpected authorization arguments: %#v", args)
		}
		return `{"authorizationVersion":"v1","resources":{}}`, nil
	})}
	snapshot, err := resolver.Resolve(context.Background(), request)
	if err != nil || snapshot == nil || snapshot.AuthorizationVersion != "v1" || calls != 1 {
		t.Fatalf("unexpected resolution: snapshot=%v err=%v calls=%d", snapshot, err, calls)
	}
}
