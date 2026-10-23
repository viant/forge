package window

import (
	"context"
	"strings"
	"testing"

	"github.com/viant/forge/backend/types"
)

func strictWindow() *types.Window {
	return &types.Window{WindowKey: "publication", View: types.View{Content: &types.Container{ID: "root"}}}
}
func TestStrictPublicationRejectsUnresolvedExplicitAssignments(t *testing.T) {
	cases := []struct {
		name       string
		assignment *ResourceAssignment
	}{{"datasource", &ResourceAssignment{DataSources: []string{"missing_ds"}}}, {"dialog", &ResourceAssignment{Dialogs: []string{"missing_dialog"}}}, {"schema", &ResourceAssignment{Schemas: []string{"missing_schema"}}}, {"model", &ResourceAssignment{ResourceModels: []string{"missing_model"}}}, {"registry", &ResourceAssignment{Models: []string{"missing_registry"}}}}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			root := t.TempDir()
			if err := mergeWorkspaceForgeAssetsWithOptionsAt(context.Background(), root, strictWindow(), tc.assignment, nil, LoaderOptions{RequireCompleteResources: true}); err == nil || !strings.Contains(err.Error(), "unresolved") {
				t.Fatalf("strict declared %s: %v", tc.name, err)
			}
			if err := MergeWorkspaceForgeAssetsAt(context.Background(), root, strictWindow(), tc.assignment); err != nil {
				t.Fatalf("legacy working load changed: %v", err)
			}
		})
	}
}
func TestStrictPublicationRejectsMissingDeclarativeReferences(t *testing.T) {
	cases := []struct {
		name   string
		window func() *types.Window
	}{
		{"datasource", func() *types.Window {
			w := strictWindow()
			w.View.Content.Binding = types.Binding{DataSourceRef: "missing_ds"}
			return w
		}},
		{"dialog", func() *types.Window {
			w := strictWindow()
			w.View.Content.Items = []types.Item{{ID: "open", Link: &types.TableLink{DialogId: "missing_dialog"}}}
			return w
		}},
		{"model", func() *types.Window {
			w := strictWindow()
			w.DataSource = map[string]types.DataSource{"local": {ResourceModelRef: "missing_model"}}
			return w
		}},
		{"schema", func() *types.Window {
			w := strictWindow()
			w.ResourceModels = map[string]types.ResourceModel{"local": {SchemaRef: "missing_schema"}}
			return w
		}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := mergeWorkspaceForgeAssetsWithOptionsAt(context.Background(), t.TempDir(), tc.window(), nil, nil, LoaderOptions{RequireCompleteResources: true})
			if err == nil {
				t.Fatalf("strict %s reference accepted", tc.name)
			}
		})
	}
}
func TestStrictPublicationDoesNotTreatCodeTextAsDependency(t *testing.T) {
	w := strictWindow()
	w.SetCode([]byte(`({label:"missing_ds", run:()=>"missing_dialog"})`))
	if err := mergeWorkspaceForgeAssetsWithOptionsAt(context.Background(), t.TempDir(), w, nil, nil, LoaderOptions{RequireCompleteResources: true}); err != nil {
		t.Fatalf("code literal rejected as declared dependency: %v", err)
	}
}
