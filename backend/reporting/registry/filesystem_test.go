package registry

import (
	"context"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"testing/fstest"
)

func TestDiscoverFilesystemHooksPreserveNativeAssetsAndProfileReads(t *testing.T) {
	root := t.TempDir()
	builder := writeAsset(t, root, "extension/forge/reporting/family/builder.yaml", "kind: forge.reporting.builder\nid: family\nreportBuilder:\n  document: {title: Default}\n  presentationProfileRefs: [./profiles/profile.json]\n")
	profile := writeAsset(t, root, "extension/forge/reporting/family/profiles/profile.json", `{"kind":"forge.reporting.presentationProfileCatalog","schemaVersion":1,"familyId":"family","views":[{"reportId":"overview","visualProfile":"overview","revision":"1","tabs":[{"id":"main","title":"Main","blockIds":["intro"]}],"blocks":[{"id":"intro","kind":"markdownBlock"}]}]}`)
	baseline, err := Discover(context.Background(), Options{WorkspaceRoot: root})
	if err != nil {
		t.Fatal(err)
	}
	reads := map[string]int{}
	walks := 0
	actual, err := Discover(context.Background(), Options{WorkspaceRoot: root, ReadFile: func(name string) ([]byte, error) { reads[name]++; return os.ReadFile(name) }, WalkDir: func(name string, visit fs.WalkDirFunc) error { walks++; return filepath.WalkDir(name, visit) }})
	if err != nil {
		t.Fatal(err)
	}
	canonicalProfile, err := filepath.EvalSymlinks(profile)
	if err != nil {
		t.Fatal(err)
	}
	if walks != 1 || reads[builder] != 1 || reads[canonicalProfile] != 1 {
		t.Fatalf("native loading bypassed filesystem hooks: walks=%d reads=%v", walks, reads)
	}
	if !reflect.DeepEqual(baseline.Builder("family"), actual.Builder("family")) {
		t.Fatal("filesystem hooks changed native builder/profile semantics")
	}
}

func TestDiscoverVirtualSourceWithoutHostFilesystem(t *testing.T) {
	const root = "/__forge_registry_virtual_test__"
	memory := fstest.MapFS{
		"extension/forge/reporting/builder.yaml": {Data: []byte("kind: forge.reporting.builder\nid: virtual\nreportBuilder:\n  presentationProfileRefs: [./profile.json]\n")},
		"extension/forge/reporting/profile.json": {Data: []byte(`{"kind":"forge.reporting.presentationProfileCatalog","schemaVersion":1,"familyId":"virtual","views":[{"reportId":"one","visualProfile":"one","revision":"1","tabs":[{"id":"main","title":"Main","blockIds":["intro"]}],"blocks":[{"id":"intro","kind":"markdownBlock"}]}]}`)},
	}
	relative := func(name string) string { return strings.TrimPrefix(name, root+"/") }
	resolves := 0
	result, err := Discover(context.Background(), Options{
		WorkspaceRoot: root,
		Stat:          func(name string) (os.FileInfo, error) { return fs.Stat(memory, relative(name)) },
		ReadFile:      func(name string) ([]byte, error) { return fs.ReadFile(memory, relative(name)) },
		WalkDir: func(name string, visit fs.WalkDirFunc) error {
			return fs.WalkDir(memory, relative(name), func(p string, d fs.DirEntry, e error) error { return visit(filepath.Join(root, p), d, e) })
		},
		ResolveReference: func(workspace, filename, reference string) (string, string, error) {
			resolves++
			resolved := filepath.Join(filepath.Dir(filename), reference)
			if !pathWithin(workspace, resolved) {
				return "", "", fmt.Errorf("outside virtual workspace")
			}
			if _, err := fs.Stat(memory, relative(resolved)); err != nil {
				return "", "", err
			}
			return reference, resolved, nil
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	if resolves != 1 || result.Builder("virtual") == nil {
		t.Fatalf("virtual discovery not used: resolves=%d registry=%+v", resolves, result)
	}
	config := result.Builder("virtual").Raw["reportBuilder"].(map[string]any)
	if len(config["presentationProfiles"].([]any)) != 1 {
		t.Fatal("virtual profile was not retained")
	}
}
