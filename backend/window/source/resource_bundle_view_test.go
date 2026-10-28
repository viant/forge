package window

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
	view "github.com/viant/forge/backend/window/view"
)

// Independently authored fixture: no application assets or captured responses.
func TestPublishedBundleRetainsAuthoredViewDescriptor(t *testing.T) {
	for _, singleTarget := range []bool{false, true} {
		t.Run(map[bool]string{false: "bundle", true: "selected-target"}[singleTarget], func(t *testing.T) {
			root := t.TempDir()
			directory := filepath.Join(root, "extension/forge/windows/inventory/shared")
			require.NoError(t, os.MkdirAll(directory, 0700))
			require.NoError(t, os.WriteFile(filepath.Join(filepath.Dir(directory), "main.yaml"), []byte("$import(shared/main.yaml)\n"), 0600))
			require.NoError(t, os.WriteFile(filepath.Join(directory, "main.yaml"), []byte("id: inventory\nwindowKey: inventory\ntitle: Inventory\ndescription: Browse records\nidentityScope: conversation\nopenMode: replace\nparameters: [{name: RecordId, type: 'int[]', required: true, bindTo: rows.parameters.Id}]\nview: {content: {id: inventory-root}}\n"), 0600))
			source, err := NewWorkspaceResourceSource(root, []ResourceBinding{{WindowKey: "inventory", URI: "window://example/inventory"}}, nil)
			require.NoError(t, err)
			uri, err := identity.ParseResourceURI("window://example/inventory")
			require.NoError(t, err)
			var raw json.RawMessage
			if singleTarget {
				raw, err = source.LoadTargetWithOptions(context.Background(), uri, types.WindowTarget{Platform: "web", FormFactor: "desktop"}, LoaderOptions{})
			} else {
				raw, err = source.LoadBundleWithOptions(context.Background(), uri, LoaderOptions{})
			}
			require.NoError(t, err)
			var bundle types.WindowResourceEnvelope
			require.NoError(t, json.Unmarshal(raw, &bundle))
			require.NotEmpty(t, bundle.ViewMetadata, "the existing window-view reader must discover published windows without a local mirror")
			var spec view.Spec
			require.NoError(t, json.Unmarshal(bundle.ViewMetadata, &spec))
			require.Equal(t, "inventory", spec.ID)
			require.Equal(t, "inventory", spec.WindowKey)
			require.Equal(t, "Inventory", spec.Title)
			require.Equal(t, "Browse records", spec.Description)
			require.Equal(t, "replace", spec.OpenMode)
			require.Equal(t, "conversation", spec.IdentityScope)
			require.Equal(t, []view.Parameter{{Name: "RecordId", Type: "int[]", Required: true, BindTo: "rows.parameters.Id"}}, spec.Parameters)
			require.Empty(t, spec.ResourceURI, "resource routing stays with the admitted catalog")
		})
	}
}

func TestWindowWithoutViewDescriptorKeepsOpaqueParameters(t *testing.T) {
	root := t.TempDir()
	directory := filepath.Join(root, "extension/forge/windows/anonymous")
	require.NoError(t, os.MkdirAll(directory, 0700))
	require.NoError(t, os.WriteFile(filepath.Join(directory, "main.yaml"), []byte("windowKey: anonymous\nparameters: [{name: Scope, type: {name: text}, required: {from: selection}}]\nview: {content: {id: anonymous-root}}\n"), 0600))
	source, err := NewWorkspaceResourceSource(root, []ResourceBinding{{WindowKey: "anonymous", URI: "window://example/anonymous"}}, nil)
	require.NoError(t, err)
	uri, err := identity.ParseResourceURI("window://example/anonymous")
	require.NoError(t, err)
	raw, err := source.LoadTargetWithOptions(context.Background(), uri, types.WindowTarget{Platform: "web"}, LoaderOptions{})
	require.NoError(t, err, "an optional routing descriptor cannot impose its schema on ordinary window parameters")
	var bundle types.WindowResourceEnvelope
	require.NoError(t, json.Unmarshal(raw, &bundle))
	require.Empty(t, bundle.ViewMetadata)
}
