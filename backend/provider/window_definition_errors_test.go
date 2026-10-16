// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	windowprotocol "github.com/viant/forge/backend/window/contract"
	"strings"
	"testing"
	"time"

	"github.com/viant/afs"
	"github.com/viant/authz"
	"github.com/viant/authz/gating"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/service/meta"
	"github.com/viant/forge/backend/types"
)

type windowFailureSource struct {
	stage string
	err   error
	reads int
	raw   json.RawMessage
}

func (s *windowFailureSource) Candidates(context.Context, identity.ResourceURI) ([]identity.ResourceCandidate, error) {
	if s.stage == "candidates" {
		return nil, s.err
	}
	return []identity.ResourceCandidate{{Kind: identity.WorkingCandidate, ContentFingerprint: identity.ContentFingerprint(s.raw)}}, nil
}
func (s *windowFailureSource) ReadCandidate(context.Context, identity.ResourceURI, identity.ResourceCandidate) (json.RawMessage, error) {
	s.reads++
	if s.stage == "read" || s.stage == "late read" && s.reads == 2 {
		return nil, s.err
	}
	return s.raw, nil
}

type windowFailurePolicy struct{ err error }

func (p windowFailurePolicy) SelectRevision(_ context.Context, _ identity.ResourceRef, c []identity.ResourceCandidate) (identity.ResourceDecision, error) {
	if p.err != nil {
		return identity.ResourceDecision{}, p.err
	}
	return identity.ResourceDecision{Candidate: c[0], AuthorityBinding: "verified", ValidUntil: time.Now().Add(time.Minute)}, nil
}
func windowFailureCatalog(t *testing.T, stage string, failure error) *MetadataWindowCatalog {
	t.Helper()
	root := t.TempDir()
	source := &windowFailureSource{stage: stage, err: failure, raw: json.RawMessage(`{"view":{"content":{"id":"safe"}}}`)}
	policy := windowFailurePolicy{}
	if stage == "policy" {
		policy.err = failure
	}
	resolver := &identity.ResourceResolver{ProviderIdentity: "owner", Source: source, Policy: policy}
	options := []WindowCatalogOption{WithWindowResourceResolver(func(context.Context, string) (*identity.ResourceResolver, identity.ResourceRef, error) {
		if stage == "resolver" {
			return nil, identity.ResourceRef{}, failure
		}
		return resolver, identity.ResourceRef{URI: "window://team/view"}, nil
	})}
	if stage == "entry" {
		options = append(options, WithWindowAuthorizer(func(context.Context, string) (bool, error) { return false, failure }))
	}
	if stage == "load" {
		options = append(options, WithWindowResolvedDefinitionLoader(func(context.Context, string, identity.ResolvedResource, json.RawMessage) (*types.Window, error) {
			return nil, failure
		}))
	}
	catalog, err := NewMetadataWindowCatalog(meta.New(afs.New(), root), root, []SavedWindow{{WindowDefinitionSummary: WindowDefinitionSummary{WindowID: "view", ResourceURI: "window://team/view"}, Key: "view"}}, options...)
	if err != nil {
		t.Fatal(err)
	}
	return catalog
}
func TestWindowDefinitionTrustedErrorsSurviveCatalogAndService(t *testing.T) {
	for _, stage := range []string{"resolver", "entry", "policy", "candidates", "read", "late read", "load"} {
		for _, sentinel := range []error{context.DeadlineExceeded, ErrWindowSelectionUnavailable, authz.ErrUnavailable, gating.ErrUnavailable, identity.ErrResourceDenied, identity.ErrResourceStale, errors.New("unknown private failure")} {
			t.Run(stage+"/"+sentinel.Error(), func(t *testing.T) {
				failure := fmt.Errorf("private dependency detail: %w", sentinel)
				catalog := windowFailureCatalog(t, stage, failure)
				bridge := NewService(&Config{WindowDefinitions: catalog})
				_, err := bridge.WindowDefinitionGet(context.Background(), &WindowDefinitionGetInput{WindowID: "view"})
				if err == nil || strings.Contains(err.Error(), "private") {
					t.Fatalf("failure escaped or detail leaked: %v", err)
				}
				expected := sentinel
				if sentinel == authz.ErrUnavailable || sentinel == gating.ErrUnavailable {
					expected = ErrWindowSelectionUnavailable
				}
				known := sentinel == authz.ErrUnavailable || sentinel == gating.ErrUnavailable || sentinel == context.DeadlineExceeded || sentinel == ErrWindowSelectionUnavailable || sentinel == identity.ErrResourceDenied || sentinel == identity.ErrResourceStale
				if known && !errors.Is(err, expected) {
					t.Fatalf("trusted classification lost: %v", err)
				}
				if !known && (errors.Is(err, identity.ErrResourceDenied) || errors.Is(err, ErrWindowSelectionUnavailable) || errors.Is(err, context.DeadlineExceeded)) {
					t.Fatalf("unknown failure acquired authority classification: %v", err)
				}
			})
		}
	}
}
func TestCanonicalMCPWindowOpenPreservesTrustedResolutionErrors(t *testing.T) {
	for _, sentinel := range []error{context.DeadlineExceeded, ErrWindowSelectionUnavailable, authz.ErrUnavailable, gating.ErrUnavailable, identity.ErrResourceDenied, errors.New("unknown private failure")} {
		t.Run(sentinel.Error(), func(t *testing.T) {
			catalog := windowFailureCatalog(t, "read", fmt.Errorf("private read detail: %w", sentinel))
			emissions := 0
			bridge := NewService(&Config{WindowDefinitions: catalog, WindowSelectionEmitter: func(context.Context, *types.Window, map[string]any) (*identity.SelectionBinding, error) {
				emissions++
				return nil, nil
			}})
			output, err := bridge.UICommand(context.Background(), &UICommandInput{Method: "ui.window.open", Params: map[string]any{"windowKey": "view"}})
			if output != nil || err == nil || emissions != 0 || strings.Contains(err.Error(), "private") {
				t.Fatalf("failed OPEN produced metadata/emission: %+v %v %d", output, err, emissions)
			}
			expected := sentinel
			if sentinel == authz.ErrUnavailable || sentinel == gating.ErrUnavailable {
				expected = ErrWindowSelectionUnavailable
			}
			if sentinel == authz.ErrUnavailable || sentinel == gating.ErrUnavailable || sentinel == context.DeadlineExceeded || sentinel == ErrWindowSelectionUnavailable || sentinel == identity.ErrResourceDenied {
				if !errors.Is(err, expected) {
					t.Fatalf("MCP classification erased: %v", err)
				}
			} else if errors.Is(err, identity.ErrResourceDenied) || errors.Is(err, ErrWindowSelectionUnavailable) || errors.Is(err, context.DeadlineExceeded) {
				t.Fatal("unknown failure relabeled")
			}
		})
	}
}

type verificationFailureCatalog struct {
	window  *types.Window
	failure error
}

func (c *verificationFailureCatalog) List(context.Context, *WindowDefinitionListInput) (*WindowDefinitionListOutput, error) {
	return &WindowDefinitionListOutput{}, nil
}
func (c *verificationFailureCatalog) Get(context.Context, *WindowDefinitionGetInput) (*WindowDefinitionGetOutput, error) {
	return &WindowDefinitionGetOutput{WindowID: "view", Definition: c.window}, nil
}
func (*verificationFailureCatalog) UsesResourceResolution() bool { return true }
func (*verificationFailureCatalog) CheckWindowContent(context.Context, string, identity.ResolvedResource, *types.WindowTarget) error {
	return nil
}
func (c *verificationFailureCatalog) RevalidateResource(context.Context, string, identity.ResolvedResource) (*identity.ResolvedResource, error) {
	return nil, c.failure
}
func verificationWindow() *types.Window {
	return &types.Window{Resource: &identity.ResolvedResource{ProviderIdentity: "owner", URI: "window://team/view", ResourceCandidate: identity.ResourceCandidate{Kind: identity.WorkingCandidate, ContentFingerprint: identity.ContentFingerprint([]byte(`{}`))}, AuthorityBinding: "actor", ValidUntil: time.Now().Add(time.Minute)}, Authorization: &types.AuthorizationSpec{Scope: "principal"}}
}
func TestCanonicalMCPUnknownAdmissionFailureRemainsTypedDenied(t *testing.T) {
	for _, test := range []struct {
		name              string
		failure, expected error
	}{
		{"unknown", errors.New("private verifier failure"), identity.ErrResourceDenied}, {"unavailable", ErrWindowSelectionUnavailable, ErrWindowSelectionUnavailable}, {"timeout", context.DeadlineExceeded, context.DeadlineExceeded},
	} {
		t.Run(test.name, func(t *testing.T) {
			emissions := 0
			catalog := &verificationFailureCatalog{window: verificationWindow()}
			bridge := NewService(&Config{WindowDefinitions: catalog, WindowUIProjection: func(context.Context, *windowprotocol.PresentationInput) (*types.Window, error) {
				return nil, fmt.Errorf("private admission detail: %w", test.failure)
			}, WindowSelectionEmitter: func(context.Context, *types.Window, map[string]any) (*identity.SelectionBinding, error) {
				emissions++
				return nil, nil
			}})
			output, err := bridge.UICommand(context.Background(), &UICommandInput{Method: "ui.window.open", Params: map[string]any{"windowKey": "view"}})
			if output != nil || !errors.Is(err, test.expected) || emissions != 0 || strings.Contains(err.Error(), "private") {
				t.Fatalf("admission classification/release wrong: %+v %v emissions=%d", output, err, emissions)
			}
		})
	}
}
func TestCanonicalMCPUnknownFinalVerificationRemainsTypedDenied(t *testing.T) {
	for _, test := range []struct {
		name              string
		failure, expected error
	}{
		{"unknown", errors.New("private verifier failure"), identity.ErrResourceDenied}, {"unavailable", ErrWindowSelectionUnavailable, ErrWindowSelectionUnavailable}, {"timeout", context.DeadlineExceeded, context.DeadlineExceeded},
	} {
		t.Run(test.name, func(t *testing.T) {
			catalog := &verificationFailureCatalog{window: verificationWindow(), failure: fmt.Errorf("private final verifier detail: %w", test.failure)}
			catalog.window.Authorization = nil
			bridge := NewService(&Config{WindowDefinitions: catalog})
			bridge.Hub().registerHTTPClient("default", "client")
			delivered := make(chan error, 1)
			go func() {
				ctx, cancel := context.WithTimeout(context.Background(), time.Second)
				defer cancel()
				request, err := bridge.Hub().dequeueCommand(ctx, "default", "client")
				if err != nil {
					delivered <- err
					return
				}
				bridge.Hub().deliverResponse(&rpcResponse{ID: request.ID, OK: true, Result: json.RawMessage(`{"windowId":"instance"}`)})
				delivered <- nil
			}()
			output, err := bridge.UICommand(context.Background(), &UICommandInput{ClientID: "client", Method: "ui.window.open", Params: map[string]any{"windowKey": "view"}})
			if output != nil || !errors.Is(err, test.expected) || strings.Contains(err.Error(), "private") {
				t.Fatalf("final verification classification wrong: %+v %v", output, err)
			}
			if workerErr := <-delivered; workerErr != nil {
				t.Fatal(workerErr)
			}
		})
	}
}
