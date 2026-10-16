// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package service

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/viant/afs"
	"github.com/viant/forge/backend/service/meta"
	"github.com/viant/forge/backend/types"
)

func TestSavedWindowCatalogResolvesImportsAndDataSources(t *testing.T) {
	root := t.TempDir()
	write := func(name, body string) {
		t.Helper()
		if err := os.WriteFile(filepath.Join(root, name), []byte(body), 0600); err != nil {
			t.Fatal(err)
		}
	}
	write("sources.yaml", "records:\n  service: {endpoint: '/fixture', uri: '/records', method: GET}\n")
	write("inventory.yaml", "windowKey: inventory\ndataSource: $import(sources.yaml)\nview: {content: {id: root}}\n")
	write("inventory.js", "(() => ({ ready: true }))()")
	write("catalog.yaml", "baseURL: .\nwindows:\n  - {windowId: inventory, title: Inventory, namespace: public, key: inventory}\n  - {windowId: hidden, title: Hidden, namespace: private, key: missing, roles: [private-reader]}\n  - {windowId: second, title: Second, namespace: public, key: inventory}\n")
	catalog, err := LoadWindowCatalog(filepath.Join(root, "catalog.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	page, err := catalog.List(ctx, &WindowDefinitionListInput{Limit: 1})
	if err != nil || len(page.Windows) != 1 || page.Windows[0].WindowID != "inventory" || !page.HasMore {
		t.Fatalf("page=%+v err=%v", page, err)
	}
	page, err = catalog.List(ctx, &WindowDefinitionListInput{Query: "second"})
	if err != nil || len(page.Windows) != 1 || page.Windows[0].WindowID != "second" {
		t.Fatalf("filter=%+v err=%v", page, err)
	}
	got, err := catalog.Get(ctx, &WindowDefinitionGetInput{WindowID: "inventory"})
	if err != nil {
		t.Fatal(err)
	}
	if got.Definition.DataSource["records"].Service == nil || got.Definition.DataSource["records"].Service.URI != "/records" {
		t.Fatalf("datasource definition missing: %+v", got.Definition.DataSource)
	}
	if got.Definition.Actions == nil || !strings.Contains(got.Definition.Actions.Code, "ready") {
		t.Fatal("saved action code omitted")
	}
	_, err = catalog.Get(ctx, &WindowDefinitionGetInput{WindowID: "hidden"})
	if err == nil || err.Error() != "window definition is not available" {
		t.Fatalf("read denial leaked loader error: %v", err)
	}
	for _, id := range []string{"../inventory", "file:///inventory", "missing", " inventory"} {
		if _, err = catalog.Get(ctx, &WindowDefinitionGetInput{WindowID: id}); err == nil {
			t.Fatalf("accepted unknown ID %q", id)
		}
	}
}

func TestWindowAuthorizePreservesDenialAndAuthorityOutage(t *testing.T) {
	root := t.TempDir()
	mode := "allow"
	catalog, err := NewMetadataWindowCatalog(meta.New(afs.New(), root), root, []SavedWindow{{WindowDefinitionSummary: WindowDefinitionSummary{WindowID: "orders"}, Key: "missing"}}, WithWindowAuthorizer(func(context.Context, string) (bool, error) {
		switch mode {
		case "deny":
			return false, nil
		case "outage":
			return false, errors.New("private provider detail")
		default:
			return true, nil
		}
	}))
	if err != nil {
		t.Fatal(err)
	}
	svc := NewService(&Config{WindowDefinitions: catalog, DynamicWindowAuthorizer: func(context.Context, string) (bool, error) { return true, nil }})
	if allowed, err := svc.WindowAuthorize(context.Background(), "orders"); err != nil || !allowed {
		t.Fatalf("allow=%v err=%v", allowed, err)
	}
	mode = "deny"
	if allowed, err := svc.WindowAuthorize(context.Background(), "orders"); err != nil || allowed {
		t.Fatalf("denial=%v err=%v", allowed, err)
	}
	mode = "outage"
	if _, err := svc.WindowAuthorize(context.Background(), "orders"); err == nil || strings.Contains(err.Error(), "private provider detail") {
		t.Fatalf("outage=%v", err)
	}
	if _, err := catalog.Get(context.Background(), &WindowDefinitionGetInput{WindowID: "orders"}); err == nil || err.Error() != "window admission authority unavailable" {
		t.Fatalf("direct get outage=%v", err)
	}
	if _, err := catalog.List(context.Background(), nil); err == nil || err.Error() != "window admission authority unavailable" {
		t.Fatalf("list outage=%v", err)
	}
	if err := catalog.Authorize(context.Background(), "orders"); err == nil || err.Error() != "window admission authority unavailable" {
		t.Fatalf("direct open outage=%v", err)
	}
}

func TestProtectedWindowRoleOutageIsUnavailable(t *testing.T) {
	root := t.TempDir()
	catalog, err := NewMetadataWindowCatalog(meta.New(afs.New(), root), root,
		[]SavedWindow{{WindowDefinitionSummary: WindowDefinitionSummary{WindowID: "orders"}, Key: "orders", Roles: []string{"reader"}}},
		WithWindowAuthorizer(func(context.Context, string) (bool, error) { return true, nil }),
		WithWindowRoleResolver(func(context.Context) ([]string, error) { return nil, errors.New("private role provider failure") }))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := catalog.List(context.Background(), nil); err == nil || err.Error() != "window role authority unavailable" {
		t.Fatalf("protected role outage list=%v", err)
	}
	if _, err := catalog.Get(context.Background(), &WindowDefinitionGetInput{WindowID: "orders"}); err == nil || err.Error() != "window role authority unavailable" {
		t.Fatalf("protected role outage get=%v", err)
	}
}

func TestHostWindowDefinitionLoaderRunsOnlyAfterAdmission(t *testing.T) {
	root := t.TempDir()
	allowed, loads := false, 0
	catalog, err := NewMetadataWindowCatalog(meta.New(afs.New(), root), root, []SavedWindow{{WindowDefinitionSummary: WindowDefinitionSummary{WindowID: "orders"}, Key: "orders"}},
		WithWindowAuthorizer(func(context.Context, string) (bool, error) { return allowed, nil }),
		WithWindowDefinitionLoader(func(_ context.Context, id string) (*types.Window, error) {
			loads++
			if id != "orders" {
				t.Fatalf("unconfigured loader ID %q", id)
			}
			return &types.Window{}, nil
		}))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := catalog.Get(context.Background(), &WindowDefinitionGetInput{WindowID: "orders"}); err == nil || loads != 0 {
		t.Fatalf("denied definition loaded: err=%v calls=%d", err, loads)
	}
	allowed = true
	if got, err := catalog.Get(context.Background(), &WindowDefinitionGetInput{WindowID: "orders"}); err != nil || got.Definition == nil || loads != 1 {
		t.Fatalf("admitted definition=%+v err=%v calls=%d", got, err, loads)
	}
}

func TestSavedWindowCatalogRejectsUnsafeConfiguration(t *testing.T) {
	root := t.TempDir()
	loader := meta.New(afs.New(), root)
	for _, key := range []string{"../secret", "/secret", "https://example.test/window", "nested/../secret", "secret\\path"} {
		if _, err := NewMetadataWindowCatalog(loader, root, []SavedWindow{{WindowDefinitionSummary: WindowDefinitionSummary{WindowID: "id"}, Key: key}}); err == nil {
			t.Fatalf("accepted key %q", key)
		}
	}
	entry := SavedWindow{WindowDefinitionSummary: WindowDefinitionSummary{WindowID: "id"}, Key: "window"}
	if _, err := NewMetadataWindowCatalog(loader, root, []SavedWindow{entry, entry}); err == nil {
		t.Fatal("duplicate ID accepted")
	}
	svc := NewService(&Config{})
	if _, err := svc.WindowDefinitionsList(context.Background(), nil); err == nil {
		t.Fatal("unconfigured catalog accepted")
	}
}

func TestWindowAuthorizerChecksListAndDirectGetIncludingRolelessEntries(t *testing.T) {
	root := t.TempDir()
	loader := meta.New(afs.New(), root)
	entries := []SavedWindow{
		{WindowDefinitionSummary: WindowDefinitionSummary{WindowID: "open"}, Key: "missing"},
		{WindowDefinitionSummary: WindowDefinitionSummary{WindowID: "restricted"}, Key: "missing", Roles: []string{"reader"}},
	}
	allowed := map[string]bool{"restricted": true}
	calls := map[string]int{}
	catalog, err := NewMetadataWindowCatalog(loader, root, entries,
		WithWindowRoleResolver(func(context.Context) ([]string, error) { return []string{"reader"}, nil }),
		WithWindowAuthorizer(func(_ context.Context, id string) (bool, error) { calls[id]++; return allowed[id], nil }))
	if err != nil {
		t.Fatal(err)
	}
	ids := catalog.ConfiguredWindowIDs()
	if len(ids) != 2 || ids[0] != "open" || ids[1] != "restricted" {
		t.Fatalf("configured IDs=%v", ids)
	}
	ids[0] = "forged"
	if catalog.ConfiguredWindowIDs()[0] != "open" {
		t.Fatal("catalog inventory was mutable")
	}
	if !NewService(&Config{WindowDefinitions: catalog}).AuthzReady() {
		t.Fatal("source-owned resolved catalog unexpectedly required consumer authorizer")
	}
	dynamic := func(_ context.Context, id string) (bool, error) { calls["dynamic:"+id]++; return allowed[id], nil }
	if !NewService(&Config{WindowDefinitions: catalog, DynamicWindowAuthorizer: dynamic}).AuthzReady() {
		t.Fatal("complete host admission was not recognized")
	}
	if NewService(&Config{}).AuthzReady() {
		t.Fatal("unprotected bridge reported authz readiness")
	}
	list, err := catalog.List(context.Background(), nil)
	if err != nil || len(list.Windows) != 1 || list.Windows[0].WindowID != "restricted" {
		t.Fatalf("list=%+v err=%v", list, err)
	}
	if _, err := catalog.Get(context.Background(), &WindowDefinitionGetInput{WindowID: "open"}); err == nil || err.Error() != "window definition is not available" {
		t.Fatalf("roleless direct get bypassed authorizer: %v", err)
	}
	if calls["open"] != 2 || calls["restricted"] != 1 {
		t.Fatalf("callback not invoked for each candidate: %+v", calls)
	}
	allowed["restricted"] = false
	if _, err := catalog.Get(context.Background(), &WindowDefinitionGetInput{WindowID: "restricted"}); err == nil || err.Error() != "window definition is not available" {
		t.Fatalf("direct get bypassed updated decision: %v", err)
	}
	svc := NewService(&Config{WindowDefinitions: catalog})
	if _, err := svc.UICommand(context.Background(), &UICommandInput{Method: "ui.window.open", Params: map[string]any{"windowKey": "restricted"}}); err == nil || err.Error() != "window definition is not available" {
		t.Fatalf("direct open bypassed updated decision: %v", err)
	}
	if calls["restricted"] != 3 {
		t.Fatalf("open did not recheck current admission: %+v", calls)
	}
	if _, err := svc.UICommand(context.Background(), &UICommandInput{Method: "ui.window.openDynamic", Params: map[string]any{"windowKey": "restricted"}}); err == nil || err.Error() != "dynamic window is not available" {
		t.Fatalf("dynamic open bypassed missing callback: %v", err)
	}
	svc = NewService(&Config{WindowDefinitions: catalog, DynamicWindowAuthorizer: dynamic})
	if _, err := svc.UICommand(context.Background(), &UICommandInput{Method: "ui.window.openDynamic", Params: map[string]any{"windowKey": "restricted"}}); err == nil || err.Error() != "dynamic window is not available" {
		t.Fatalf("dynamic open bypassed denial: %v", err)
	}
	if calls["dynamic:restricted"] != 1 {
		t.Fatalf("dynamic callback not invoked: %+v", calls)
	}
	svc = NewService(&Config{WindowDefinitions: catalog, DynamicWindowAuthorizer: func(context.Context, string) (bool, error) {
		return false, errors.New("private dynamic provider failure")
	}})
	if _, err := svc.UICommand(context.Background(), &UICommandInput{Method: "ui.window.openDynamic", Params: map[string]any{"windowKey": "restricted"}}); err == nil || err.Error() != "dynamic window admission authority unavailable" {
		t.Fatalf("dynamic authority outage was hidden or leaked: %v", err)
	}
}
