// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package service

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/viant/afs"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/service/meta"
)

type windowPolicyFixture struct {
	binding string
	omitted string
	allowed bool
}

func (p *windowPolicyFixture) SelectRevision(_ context.Context, ref identity.ResourceRef, c []identity.ResourceCandidate) (identity.ResourceDecision, error) {
	selected := p.omitted
	if ref.Revision != "" {
		selected = ref.Revision
	}
	if p.allowed && selected == "1" {
		for _, candidate := range c {
			if candidate.Selector() == selected {
				return identity.ResourceDecision{Candidate: candidate, AuthorityBinding: p.binding, ValidUntil: time.Now().Add(time.Minute)}, nil
			}
		}
	}
	return identity.ResourceDecision{}, identity.ErrResourceDenied
}
func TestWindowExplicitRevisionReadAndOpenDoNotResolveOmittedDefault(t *testing.T) {
	root := t.TempDir()
	source := &canonicalSource{content: map[string]json.RawMessage{"1": json.RawMessage(`{"windowKey":"overview","view":{"content":{"id":"approved"}}}`)}}
	policy := &windowPolicyFixture{binding: "alice/account/identity-1", omitted: "not-permitted", allowed: true}
	resolver := &identity.ResourceResolver{Source: source, Policy: policy}
	catalog, err := NewMetadataWindowCatalog(meta.New(afs.New(), root), root, []SavedWindow{{WindowDefinitionSummary: WindowDefinitionSummary{WindowID: "overview", Title: "Overview", ResourceURI: "window://planning/overview"}, Key: "never-load-current"}}, WithWindowResourceResolver(func(context.Context, string) (*identity.ResourceResolver, identity.ResourceRef, error) {
		return resolver, identity.ResourceRef{URI: "window://planning/overview"}, nil
	}))
	if err != nil {
		t.Fatal(err)
	}
	list, err := catalog.List(context.Background(), nil)
	if err != nil || len(list.Windows) != 0 {
		t.Fatalf("omitted policy denied list=%+v %v", list, err)
	}
	ref := &identity.ResourceRef{URI: "window://planning/overview", Revision: "1"}
	got, err := catalog.Get(context.Background(), &WindowDefinitionGetInput{WindowID: "overview", Resource: ref})
	if err != nil || got.Definition.Resource.Revision != "1" || got.Definition.View.Content.ID != "approved" {
		t.Fatalf("explicit old get=%+v %v", got, err)
	}
	svc := NewService(&Config{WindowDefinitions: catalog})
	svc.Hub().registerHTTPClient("default", "client-a")
	command := make(chan rpcRequest, 1)
	workerError := make(chan error, 1)
	go func() {
		workerCtx, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		req, err := svc.Hub().dequeueCommand(workerCtx, "default", "client-a")
		if err != nil {
			workerError <- err
			return
		}
		command <- *req
		svc.Hub().deliverResponse(&rpcResponse{ID: req.ID, OK: true, Result: json.RawMessage(`{"windowId":"instance-1"}`)})
	}()
	opened, err := svc.UICommand(context.Background(), &UICommandInput{ClientID: "client-a", Method: "ui.window.open", Params: map[string]any{"windowKey": "overview", "resource": ref, "options": map[string]any{"inlineMetadata": map[string]any{"view": "forged"}}}})
	if err != nil || !opened.OK {
		t.Fatalf("explicit open=%+v %v", opened, err)
	}
	select {
	case req := <-command:
		raw, _ := json.Marshal(req.Params)
		if strings.Contains(string(raw), "forged") || !strings.Contains(string(raw), "approved") || !strings.Contains(string(raw), "authorityBinding") {
			t.Fatalf("open did not carry approved pin: %s", raw)
		}
	case err := <-workerError:
		t.Fatal(err)
	case <-time.After(time.Second):
		t.Fatal("open was not sent")
	}
	pin, ok := svc.getWindowPin(windowPinKey{Namespace: "default", ClientID: "client-a", WindowID: "instance-1"})
	if !ok || pin.Resource.Revision != "1" {
		t.Fatalf("server pin=%+v %v", pin, ok)
	}
	svc.Hub().setSnapshot("default", "client-a", json.RawMessage(`{"selected":{"windowId":"instance-1"},"globalSecret":"omit","windows":[{"windowId":"instance-1","windowKey":"overview","resource":{"uri":"window://foreign/name"},"parameters":{"synthetic":"visible"}},{"windowId":"forged-instance","windowKey":"overview","parameters":{"secret":"hide"}}]}`))
	live, err := svc.WindowList(context.Background(), &WindowListInput{ClientID: "client-a"})
	if err != nil || len(live.Windows) != 1 {
		t.Fatalf("live list=%+v %v", live, err)
	}
	snapshot, err := svc.UISnapshot(context.Background(), &UISnapshotInput{ClientID: "client-a"})
	if err != nil || strings.Contains(string(snapshot.Snapshot), "globalSecret") || strings.Contains(string(snapshot.Snapshot), "foreign") {
		t.Fatalf("snapshot trusted caller metadata=%+v %v", snapshot, err)
	}
	policy.binding = "alice/other-account/identity-1"
	live, err = svc.WindowList(context.Background(), &WindowListInput{ClientID: "client-a"})
	if err != nil || len(live.Windows) != 0 {
		t.Fatalf("changed-account live disclosure=%+v %v", live, err)
	}
	if _, err := svc.WindowGet(context.Background(), &WindowGetInput{ClientID: "client-a", WindowID: "instance-1"}); err == nil {
		t.Fatal("changed-account live get disclosed window")
	}
	if _, err := svc.UICommand(context.Background(), &UICommandInput{ClientID: "client-a", Method: "ui.data.fetch", Params: map[string]any{"windowId": "instance-1"}}); err == nil {
		t.Fatal("changed-account instance executed")
	}
	policy.binding = pin.Resource.AuthorityBinding
	policy.allowed = false
	if _, err := svc.UICommand(context.Background(), &UICommandInput{ClientID: "client-a", Method: "ui.data.fetch", Params: map[string]any{"windowId": "instance-1"}}); err == nil {
		t.Fatal("owning catalog denial executed")
	}
}
