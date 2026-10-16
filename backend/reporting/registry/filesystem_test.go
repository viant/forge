package registry

import (
	"context"
	"io/fs"
	"os"
	"path/filepath"
	"reflect"
	"testing"
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
