// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package permittedview

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"
)

type ToolExecutor interface {
	Execute(context.Context, string, map[string]interface{}) (string, error)
}

type MCPResolver struct {
	Executor ToolExecutor
	// ToolName must be explicitly supplied when resolving a view's authorization.
	// Views without authorization bypass this resolver entirely.
	ToolName string
}

func (r *MCPResolver) Resolve(ctx context.Context, request *Request) (*Snapshot, error) {
	if r == nil || r.Executor == nil {
		return nil, fmt.Errorf("permitted view: authorization executor is unavailable")
	}
	toolName := strings.TrimSpace(r.ToolName)
	if toolName == "" {
		return nil, fmt.Errorf("permitted view: authorization tool is not configured")
	}
	if request != nil && request.SchemaVersion == 2 {
		return nil, fmt.Errorf("permitted view: v2 string IDs are unsupported by the legacy MCP resolver")
	}
	args := map[string]interface{}{
		"ResourceType":                request.ResourceType,
		"ResourceIDs":                 request.ResourceIDs,
		"RequestedCapabilities":       request.RequestedCapabilities,
		"RequestedGlobalCapabilities": request.RequestedGlobalCapabilities,
		"IncludePrincipal":            request.IncludePrincipal,
	}
	raw, err := r.Executor.Execute(ctx, toolName, args)
	if err != nil {
		return nil, fmt.Errorf("permitted view: %s failed: %w", toolName, err)
	}
	result := &Snapshot{}
	if err = decodeSnapshot([]byte(raw), result); err != nil {
		return nil, fmt.Errorf("permitted view: decode authorization response: %w", err)
	}
	return result, nil
}

type Runtime struct {
	Resolver Resolver
	Now      func() time.Time
}

func NewRuntime(resolver Resolver) *Runtime {
	return &Runtime{Resolver: resolver, Now: time.Now}
}

func (r *Runtime) Apply(ctx context.Context, bound *BoundView) (*Result, error) {
	if bound == nil || bound.Window == nil {
		return nil, fmt.Errorf("permitted view: bound window is required")
	}
	if bound.Window.Authorization == nil {
		return Compile(bound, nil)
	}
	if r == nil || r.Resolver == nil {
		return nil, fmt.Errorf("permitted view: authorization runtime is unavailable")
	}
	request, err := ResolveRequest(bound)
	if err != nil {
		return nil, err
	}
	snapshot, err := r.Resolver.Resolve(ctx, request)
	if err != nil {
		return nil, err
	}
	if snapshot == nil || strings.TrimSpace(snapshot.AuthorizationVersion) == "" {
		return nil, fmt.Errorf("permitted view: authorization snapshot/version is required")
	}
	now := time.Now()
	if r.Now != nil {
		now = r.Now()
	}
	if snapshot.ExpiresAt.IsZero() || !now.Before(snapshot.ExpiresAt) {
		return nil, fmt.Errorf("permitted view: authorization snapshot is expired")
	}
	if bound.SchemaVersion == 2 {
		if snapshot.SchemaVersion != 2 {
			return nil, fmt.Errorf("permitted view: v2 authorization snapshot is required")
		}
		if bound.ResourceIDString != "" {
			resource := snapshot.Resources[bound.ResourceIDString]
			if resource == nil || resource.IDString != bound.ResourceIDString || !strings.EqualFold(resource.Type, bound.ResourceType) {
				return nil, fmt.Errorf("permitted view: authorization resource identity mismatch")
			}
		}
	} else if snapshot.SchemaVersion == 2 {
		return nil, fmt.Errorf("permitted view: v1 authorization snapshot is required")
	}
	if bound.ResourceID > 0 {
		resource := snapshot.Resources[fmt.Sprint(bound.ResourceID)]
		if resource != nil && (resource.ID != bound.ResourceID || !strings.EqualFold(resource.Type, bound.ResourceType)) {
			return nil, fmt.Errorf("permitted view: authorization resource identity mismatch")
		}
	}
	return Compile(bound, snapshot)
}

func decodeSnapshot(raw []byte, target *Snapshot) error {
	var value any
	if err := json.Unmarshal(raw, &value); err != nil {
		return err
	}
	found := findSnapshot(value)
	if found == nil {
		return fmt.Errorf("authorization payload was not found")
	}
	encoded, _ := json.Marshal(found)
	return json.Unmarshal(encoded, target)
}

func findSnapshot(value any) map[string]any {
	switch actual := value.(type) {
	case map[string]any:
		if _, ok := actual["authorizationVersion"]; ok {
			return actual
		}
		for _, key := range []string{"data", "result", "output", "structuredContent"} {
			if nested := findSnapshot(actual[key]); nested != nil {
				return nested
			}
		}
		if content, ok := actual["content"].([]any); ok {
			for _, block := range content {
				if item, ok := block.(map[string]any); ok {
					if text, ok := item["text"].(string); ok {
						var decoded any
						if json.Unmarshal([]byte(text), &decoded) == nil {
							if nested := findSnapshot(decoded); nested != nil {
								return nested
							}
						}
					}
				}
			}
		}
	case []any:
		for _, item := range actual {
			if nested := findSnapshot(item); nested != nil {
				return nested
			}
		}
	}
	return nil
}

var defaultRuntimeState struct {
	sync.RWMutex
	runtime *Runtime
}

func SetDefaultRuntime(runtime *Runtime) func() {
	defaultRuntimeState.Lock()
	previous := defaultRuntimeState.runtime
	defaultRuntimeState.runtime = runtime
	defaultRuntimeState.Unlock()
	return func() {
		defaultRuntimeState.Lock()
		defaultRuntimeState.runtime = previous
		defaultRuntimeState.Unlock()
	}
}

func DefaultRuntime() *Runtime {
	defaultRuntimeState.RLock()
	defer defaultRuntimeState.RUnlock()
	return defaultRuntimeState.runtime
}

// ResolvePresentation forwards authored UI facts inputs to their configured MCP.
// Its response controls presentation only; no capability admits resource reads.
func (r *MCPResolver) ResolvePresentation(ctx context.Context, bound *BoundView) (*Snapshot, error) {
	selected, err := BindResource(bound.Window, bound.WindowID, bound.ConversationID, bound.WindowForm, bound.ResourceData)
	if err != nil {
		return nil, err
	}
	*bound = *selected
	request, err := ResolveRequest(bound)
	if err != nil {
		return nil, err
	}
	if request == nil {
		return r.Resolve(ctx, &Request{IncludePrincipal: true})
	}
	return r.Resolve(ctx, request)
}
