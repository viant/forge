// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
// Package policy provides workspace-configured authorization for discoverable
// runtime resources. Product roles and tenant rules remain in the configured
// MCP tool; agently-core deals only in opaque candidate IDs.
package policy

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"
)

const (
	OperationReportView        = "report.view"
	OperationWindowView        = "window.view"
	OperationStarterPromptView = "starterPrompt.view"
	OperationIntentView        = "intent.view"
)

var ErrDenied = errors.New("authorization policy denied")
var ErrIdentityRejected = fmt.Errorf("%w: verified identity rejected", ErrDenied)

type Candidate struct {
	ID       string         `json:"id"`
	Kind     string         `json:"kind,omitempty"`
	Metadata map[string]any `json:"metadata,omitempty"`
}

type Request struct {
	Operation      string         `json:"operation"`
	ConversationID string         `json:"conversationId,omitempty"`
	Candidates     []Candidate    `json:"candidates"`
	Context        map[string]any `json:"context,omitempty"`
}

type Decision struct {
	PolicyVersion string    `json:"policyVersion"`
	ExpiresAt     time.Time `json:"expiresAt"`
	Allow         bool      `json:"allow"`
	AllowedIDs    []string  `json:"allowedIds,omitempty"`
	ReasonCode    string    `json:"reasonCode,omitempty"`
}

type Resolver interface {
	Resolve(context.Context, *Request) (*Decision, error)
}

type ToolExecutor interface {
	Execute(context.Context, string, map[string]interface{}) (string, error)
}

type MCPResolver struct {
	Executor ToolExecutor
	ToolName string
}

func (r *MCPResolver) Resolve(ctx context.Context, request *Request) (*Decision, error) {
	if r == nil || r.Executor == nil {
		return nil, fmt.Errorf("authorization policy executor is unavailable")
	}
	toolName := strings.TrimSpace(r.ToolName)
	if toolName == "" {
		return nil, fmt.Errorf("authorization policy MCP tool is not configured")
	}
	args := map[string]interface{}{
		"operation":      request.Operation,
		"conversationId": request.ConversationID,
		"candidates":     request.Candidates,
		"context":        request.Context,
	}
	raw, err := r.Executor.Execute(ctx, toolName, args)
	if err != nil {
		return nil, fmt.Errorf("authorization policy %s failed: %w", toolName, err)
	}
	var value any
	if err := json.Unmarshal([]byte(raw), &value); err != nil {
		return nil, fmt.Errorf("decode authorization policy response: %w", err)
	}
	found := findDecision(value)
	if found == nil {
		return nil, fmt.Errorf("authorization policy decision was not found")
	}
	encoded, _ := json.Marshal(found)
	decision := &Decision{}
	if err := json.Unmarshal(encoded, decision); err != nil {
		return nil, fmt.Errorf("decode authorization policy decision: %w", err)
	}
	return decision, nil
}

func findDecision(value any) map[string]any {
	switch actual := value.(type) {
	case map[string]any:
		if _, ok := actual["allow"]; ok {
			return actual
		}
		for _, key := range []string{"data", "result", "output", "structuredContent"} {
			if found := findDecision(actual[key]); found != nil {
				return found
			}
		}
		if content, ok := actual["content"].([]any); ok {
			for _, block := range content {
				item, _ := block.(map[string]any)
				text, _ := item["text"].(string)
				var decoded any
				if json.Unmarshal([]byte(text), &decoded) == nil {
					if found := findDecision(decoded); found != nil {
						return found
					}
				}
			}
		}
	case []any:
		for _, item := range actual {
			if found := findDecision(item); found != nil {
				return found
			}
		}
	}
	return nil
}

type Runtime struct {
	Resolver Resolver
	Enabled  map[string]bool
	Now      func() time.Time
	ExactIDs bool // authz mappings use opaque, case-sensitive resource IDs
}

func NewRuntime(resolver Resolver, enabled ...string) *Runtime {
	operations := make(map[string]bool, len(enabled))
	for _, operation := range enabled {
		if operation = strings.TrimSpace(operation); operation != "" {
			operations[operation] = true
		}
	}
	return &Runtime{Resolver: resolver, Enabled: operations, Now: time.Now}
}

func (r *Runtime) IsEnabled(operation string) bool {
	return r != nil && r.Resolver != nil && r.Enabled[strings.TrimSpace(operation)]
}

// Filter returns the candidates allowed by the external policy. When the
// operation is not configured it returns a copy of the original candidates.
func (r *Runtime) Filter(ctx context.Context, operation, conversationID string, candidates []Candidate, scope map[string]any) ([]Candidate, error) {
	if !r.IsEnabled(operation) {
		return append([]Candidate(nil), candidates...), nil
	}
	if len(candidates) == 0 {
		return nil, nil
	}
	decision, err := r.Resolver.Resolve(ctx, &Request{
		Operation: strings.TrimSpace(operation), ConversationID: strings.TrimSpace(conversationID),
		Candidates: append([]Candidate(nil), candidates...), Context: scope,
	})
	if err != nil {
		return nil, err
	}
	if decision == nil || strings.TrimSpace(decision.PolicyVersion) == "" {
		return nil, fmt.Errorf("authorization policy version is required")
	}
	now := time.Now()
	if r.Now != nil {
		now = r.Now()
	}
	if decision.ExpiresAt.IsZero() || !now.Before(decision.ExpiresAt) {
		return nil, fmt.Errorf("authorization policy decision is expired")
	}
	if !decision.Allow {
		return nil, ErrDenied
	}
	if len(decision.AllowedIDs) == 0 {
		return append([]Candidate(nil), candidates...), nil
	}
	allowed := make(map[string]bool, len(decision.AllowedIDs))
	normalize := func(id string) string {
		if r.ExactIDs {
			return id
		}
		return strings.ToLower(strings.TrimSpace(id))
	}
	for _, id := range decision.AllowedIDs {
		allowed[normalize(id)] = true
	}
	result := make([]Candidate, 0, len(candidates))
	for _, candidate := range candidates {
		if allowed[normalize(candidate.ID)] {
			result = append(result, candidate)
		}
	}
	return result, nil
}

func (r *Runtime) Authorize(ctx context.Context, operation, conversationID string, candidate Candidate, scope map[string]any) error {
	filtered, err := r.Filter(ctx, operation, conversationID, []Candidate{candidate}, scope)
	if err != nil {
		return err
	}
	if len(filtered) != 1 {
		return ErrDenied
	}
	return nil
}

var defaultRuntime struct {
	sync.RWMutex
	runtime *Runtime
}

func SetDefaultRuntime(runtime *Runtime) func() {
	defaultRuntime.Lock()
	previous := defaultRuntime.runtime
	defaultRuntime.runtime = runtime
	defaultRuntime.Unlock()
	return func() {
		defaultRuntime.Lock()
		defaultRuntime.runtime = previous
		defaultRuntime.Unlock()
	}
}

func DefaultRuntime() *Runtime {
	defaultRuntime.RLock()
	defer defaultRuntime.RUnlock()
	return defaultRuntime.runtime
}
