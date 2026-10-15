package window

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestExplicitRootsRemainIndependent(t *testing.T) {
	for _, marker := range []string{"first-host", "second-host"} {
		marker := marker
		t.Run(marker, func(t *testing.T) {
			t.Parallel()
			root := t.TempDir()
			dir := filepath.Join(root, "extension", "forge", "windows")
			if err := os.MkdirAll(dir, 0700); err != nil {
				t.Fatal(err)
			}
			if err := os.WriteFile(filepath.Join(dir, "shared.yaml"), []byte("windowKey: shared\nview:\n  content:\n    id: "+marker+"\n"), 0600); err != nil {
				t.Fatal(err)
			}
			for i := 0; i < 10; i++ {
				window, err := LoadWorkspaceWindowAt(context.Background(), root, "shared", nil)
				if err != nil {
					t.Fatal(err)
				}
				body, err := json.Marshal(window)
				if err != nil {
					t.Fatal(err)
				}
				if !strings.Contains(string(body), marker) {
					t.Fatalf("window substituted across host roots: %s", body)
				}
			}
		})
	}
}

func TestSourceRequiresExplicitRootAndBoundKey(t *testing.T) {
	for _, tc := range []struct{ root, key string }{{"", "shared"}, {t.TempDir(), "../outside"}, {t.TempDir(), "remote:provider:window"}} {
		if _, err := LoadWorkspaceWindowAt(context.Background(), tc.root, tc.key, nil); err == nil {
			t.Fatalf("accepted unbound source: %#v", tc)
		}
	}
}
