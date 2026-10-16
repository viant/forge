package window

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/viant/afs"
	"github.com/viant/afs/storage"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
)

type targetReadFS struct {
	afs.Service
	reads []string
}

func (f *targetReadFS) DownloadWithURL(ctx context.Context, location string, options ...storage.Option) ([]byte, error) {
	f.reads = append(f.reads, location)
	return f.Service.DownloadWithURL(ctx, location, options...)
}

func TestLoadTargetWithOptionsReadsOnlySelectedBranch(t *testing.T) {
	root := t.TempDir()
	for name, body := range map[string]string{
		"demo/main.yaml":        "windowKey: demo\nview:\n  content: {id: default}\n",
		"demo/web/main.yaml":    "windowKey: demo\nview:\n  content: {id: selected-web}\n",
		"demo/web/main.js":      "(() => ({ marker() { return 'web-only'; } }))()",
		"demo/mobile/main.yaml": "windowKey: demo\nview:\n  content: {id: unselected-mobile}\n",
		"demo/mobile/main.js":   "(() => ({ marker() { return 'mobile-only'; } }))()",
	} {
		filename := filepath.Join(root, "extension/forge/windows", name)
		if err := os.MkdirAll(filepath.Dir(filename), 0700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filename, []byte(body), 0600); err != nil {
			t.Fatal(err)
		}
	}
	source, err := NewWorkspaceResourceSource(root, []ResourceBinding{{WindowKey: "demo", URI: "window://example/demo"}}, nil)
	if err != nil {
		t.Fatal(err)
	}
	uri, err := identity.ParseResourceURI("window://example/demo")
	if err != nil {
		t.Fatal(err)
	}
	tracking := &targetReadFS{Service: afs.New()}
	selected := types.WindowTarget{Platform: "web", FormFactor: "desktop"}
	raw, err := source.LoadTargetWithOptions(context.Background(), uri, selected, LoaderOptions{FS: tracking, AssetDirectories: func(context.Context) (map[string]bool, error) {
		t.Fatal("single target enumerated equivalence directories")
		return nil, nil
	}})
	if err != nil {
		t.Fatal(err)
	}
	var envelope types.WindowResourceEnvelope
	if err = json.Unmarshal(raw, &envelope); err != nil {
		t.Fatal(err)
	}
	if err = envelope.Validate(); err != nil {
		t.Fatal(err)
	}
	if len(envelope.Targets) != 2 || len(envelope.Variants) != 1 || envelope.Targets[0].Target.ProfileKey() != selected.ProfileKey() {
		t.Fatalf("expected selected target, default alias, and one variant: %+v", envelope.Targets)
	}
	if envelope.Targets[1].Target.ProfileKey() != (types.WindowTarget{}).ProfileKey() || envelope.Targets[0].Variant != envelope.Targets[1].Variant {
		t.Fatal("default must alias the already compiled requested variant")
	}
	if _, err := types.SelectWindowResource(raw, &selected); err != nil {
		t.Fatal(err)
	}
	if _, err := types.SelectWindowResource(raw, nil); err != nil {
		t.Fatal(err)
	}
	variant := envelope.Variants[envelope.Targets[0].Variant]
	if variant.Window.View.Content.ID != "selected-web" || variant.Window.Actions == nil || !strings.Contains(variant.Window.Actions.Code, "web-only") {
		t.Fatalf("wrong native branch: %s", raw)
	}
	if len(tracking.reads) == 0 {
		t.Fatal("no reads recorded")
	}
	for _, location := range tracking.reads {
		if strings.Contains(location, "/mobile/") {
			t.Fatalf("unselected target read: %s", location)
		}
	}
	full, err := source.LoadBundleWithOptions(context.Background(), uri, LoaderOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if err = json.Unmarshal(full, &envelope); err != nil {
		t.Fatal(err)
	}
	if len(envelope.Targets) != len(standardWindowTargets()) || !strings.Contains(string(full), "mobile-only") {
		t.Fatal("full bundle stopped materializing all native branches")
	}
}
