package service

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/viant/afs"
	"github.com/viant/forge/backend/service/meta"
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
