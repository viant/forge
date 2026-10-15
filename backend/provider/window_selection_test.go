// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package service

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/viant/afs"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/service/meta"
	"github.com/viant/forge/backend/types"
	"strings"
	"testing"
	"time"
)

func TestWindowSelectionEmissionOptionalDetachedAndSanitized(t *testing.T) {
	pin := identity.ResolvedResource{ProviderIdentity: "owner", URI: "window://team/view", ResourceCandidate: identity.ResourceCandidate{Kind: identity.WorkingCandidate, ContentFingerprint: identity.ContentFingerprint([]byte(`{}`))}, AuthorityBinding: "actor", ValidUntil: time.Now().Add(time.Minute)}
	window := &types.Window{Resource: &pin, ResourceTarget: &types.WindowTarget{Platform: "web"}, SelectionBinding: &identity.SelectionBinding{Token: "counterfeit"}}
	parameters := map[string]any{"ids": []any{json.Number("9007199254740993"), "opaque"}, "parent": map[string]any{"id": "parent"}}
	calls := 0
	service := NewService(&Config{})
	if got, err := service.EmitWindowSelection(context.Background(), window, parameters); err != nil || got.SelectionBinding != nil || calls != 0 {
		t.Fatal("default emitted binding", err)
	}
	service.ConfigureWindowSelectionEmitter(func(_ context.Context, in *types.Window, p map[string]any) (*identity.SelectionBinding, error) {
		calls++
		if in.SelectionBinding != nil || p["ids"].([]any)[0].(json.Number).String() != "9007199254740993" {
			t.Fatal("original binding/precision leaked")
		}
		digest, _ := identity.SelectionParametersDigest(p)
		p["parent"].(map[string]any)["id"] = "mutated"
		in.Resource.URI = "window://foreign/view"
		return &identity.SelectionBinding{Actor: identity.CanonicalActor{Issuer: "idp", Subject: "canonical", TenantID: "1", AccountID: "2"}, InstanceID: "instance", ParametersDigest: digest, Token: "signed"}, nil
	})
	if calls != 0 {
		t.Fatal("configuration invoked emitter")
	}
	got, err := service.EmitWindowSelection(context.Background(), window, parameters)
	if err != nil || got.SelectionBinding.Token != "signed" || got.Resource.URI != pin.URI || window.SelectionBinding.Token != "counterfeit" || parameters["parent"].(map[string]any)["id"] != "parent" || calls != 1 {
		t.Fatal("detached selection emission failed", err)
	}
	for _, failure := range []error{context.DeadlineExceeded, ErrWindowSelectionUnavailable, errors.New("private detail")} {
		service.ConfigureWindowSelectionEmitter(func(context.Context, *types.Window, map[string]any) (*identity.SelectionBinding, error) {
			return nil, failure
		})
		_, err := service.EmitWindowSelection(context.Background(), window, parameters)
		if failure == context.DeadlineExceeded || failure == ErrWindowSelectionUnavailable {
			if err != failure {
				t.Fatal("availability classification lost", err)
			}
		} else if err != identity.ErrResourceDenied {
			t.Fatal("private error leaked", err)
		}
	}
}

func TestCanonicalMCPWindowOpenEmitsFullSelectionBeforeSend(t *testing.T) {
	root := t.TempDir()
	source := &canonicalSource{content: map[string]json.RawMessage{"1": json.RawMessage(`{"windowKey":"overview","view":{"content":{"id":"approved"}},"parameters":[{"name":"ids","default":"declaration-only"}]}`)}}
	policy := &windowPolicyFixture{binding: "actor", omitted: "1", allowed: true}
	resolver := &identity.ResourceResolver{ProviderIdentity: "owner", Source: source, Policy: policy}
	catalog, err := NewMetadataWindowCatalog(meta.New(afs.New(), root), root, []SavedWindow{{WindowDefinitionSummary: WindowDefinitionSummary{WindowID: "overview", ResourceURI: "window://planning/overview"}, Key: "overview"}}, WithWindowResourceResolver(func(context.Context, string) (*identity.ResourceResolver, identity.ResourceRef, error) {
		return resolver, identity.ResourceRef{URI: "window://planning/overview"}, nil
	}))
	if err != nil {
		t.Fatal(err)
	}
	signed := 0
	bridge := NewService(&Config{WindowDefinitions: catalog, WindowSelectionEmitter: func(_ context.Context, w *types.Window, p map[string]any) (*identity.SelectionBinding, error) {
		signed++
		if p["ids"].([]any)[0].(json.Number).String() != "9007199254740993" || p["parents"].(map[string]any)["account"] != "selected-parent" {
			t.Fatal("MCP effective parameters changed")
		}
		if w.Parameters[0]["default"] != "declaration-only" {
			t.Fatal("authored declarations overwritten")
		}
		digest, _ := identity.SelectionParametersDigest(p)
		return &identity.SelectionBinding{Actor: identity.CanonicalActor{Issuer: "idp", Subject: "canonical", TenantID: "1", AccountID: "2"}, InstanceID: "instance", ParametersDigest: digest, Token: "host-signed"}, nil
	}})
	if _, err := bridge.WindowDefinitionGet(context.Background(), &WindowDefinitionGetInput{WindowID: "overview"}); err != nil || signed != 0 {
		t.Fatal("definition GET emitted binding", err)
	}
	bridge.Hub().registerHTTPClient("default", "client")
	delivered := make(chan rpcRequest, 1)
	workerError := make(chan error, 1)
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		request, err := bridge.Hub().dequeueCommand(ctx, "default", "client")
		if err != nil {
			workerError <- err
			return
		}
		delivered <- *request
		bridge.Hub().deliverResponse(&rpcResponse{ID: request.ID, OK: true, Result: json.RawMessage(`{"windowId":"instance"}`)})
	}()
	parameters := map[string]any{"ids": []any{json.Number("9007199254740993"), "opaque"}, "parents": map[string]any{"account": "selected-parent"}}
	opened, err := bridge.UICommand(context.Background(), &UICommandInput{ClientID: "client", Method: "ui.window.open", Params: map[string]any{"windowKey": "overview", "parameters": parameters, "options": map[string]any{"inlineMetadata": "counterfeit"}}})
	if err != nil || !opened.OK || signed != 1 {
		t.Fatal("MCP OPEN emission failed", err)
	}
	select {
	case request := <-delivered:
		raw, _ := json.Marshal(request.Params)
		if !strings.Contains(string(raw), "host-signed") || strings.Contains(string(raw), "counterfeit") || !strings.Contains(string(raw), "9007199254740993") {
			t.Fatalf("OPEN metadata lost selection binding: %s", raw)
		}
	case err := <-workerError:
		t.Fatal(err)
	case <-time.After(time.Second):
		t.Fatal("OPEN not sent")
	}
}
