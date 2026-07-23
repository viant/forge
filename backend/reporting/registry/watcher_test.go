package registry

import (
	"context"
	"os"
	"testing"
	"time"
)

func TestWatcherReloadsValidChangesAndRetainsLastValidRegistry(t *testing.T) {
	workspace := t.TempDir()
	builderPath := writeAsset(t, workspace, "extension/forge/reporting/performance/builder.yaml", `
kind: forge.reporting.builder
id: performance
reportBuilder: {}
`)
	loader := NewLoader(Options{WorkspaceRoot: workspace})
	initial, err := loader.Reload(context.Background())
	if err != nil {
		t.Fatalf("initial reload: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	events := make(chan error, 8)
	watcher := NewWatcher(loader, WithWatchDebounce(25*time.Millisecond))
	if err = watcher.Start(ctx, func(_ *Registry, reloadErr error) {
		events <- reloadErr
	}); err != nil {
		t.Fatalf("Start() error = %v", err)
	}
	defer watcher.Close()

	writeAsset(t, workspace, "extension/forge/reporting/performance/presets/delivery.yaml", `
kind: forge.reporting.preset
id: delivery
builderRef: performance
label: Delivery
document: {blocks: []}
`)
	awaitWatchEvent(t, events, false)
	valid := loader.Current()
	if valid == initial || valid.Preset("delivery") == nil {
		t.Fatalf("expected valid asset reload, got %#v", valid)
	}

	if err = os.WriteFile(builderPath, []byte("kind: [invalid"), 0o644); err != nil {
		t.Fatalf("write invalid builder: %v", err)
	}
	awaitWatchEvent(t, events, true)
	if loader.Current() != valid {
		t.Fatalf("invalid reload replaced the last valid registry")
	}

	if err = os.WriteFile(builderPath, []byte(`
kind: forge.reporting.builder
id: performance
label: Updated Performance
reportBuilder: {}
`), 0o644); err != nil {
		t.Fatalf("restore valid builder: %v", err)
	}
	awaitWatchEvent(t, events, false)
	if got := loader.Current().Builder("performance"); got == nil || got.Label != "Updated Performance" {
		t.Fatalf("expected recovery reload, got %#v", got)
	}
}

func awaitWatchEvent(t *testing.T, events <-chan error, wantError bool) {
	t.Helper()
	deadline := time.After(5 * time.Second)
	for {
		select {
		case err := <-events:
			if (err != nil) == wantError {
				return
			}
		case <-deadline:
			t.Fatalf("timed out waiting for watcher event (wantError=%v)", wantError)
		}
	}
}
