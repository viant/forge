package resource

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	reportcatalog "github.com/viant/forge/backend/reporting/catalog"
	"github.com/viant/forge/backend/reporting/registry"
	identity "github.com/viant/forge/backend/resource"
	forgeTypes "github.com/viant/forge/backend/types"
)

func snapshotReportFixture(t *testing.T) (string, NativeSnapshotDefinition) {
	root, _ := nativeWindowFixture(t)
	extensionWrite(t, root, "extension/forge/reporting/builder.yaml", `kind: forge.reporting.builder
id: metrics
reportBuilder:
  document: {title: Default}
  presentationProfileRefs: [./profiles/profile.json]
`)
	extensionWrite(t, root, "extension/forge/reporting/profiles/profile.json", `{"kind":"forge.reporting.presentationProfileCatalog","schemaVersion":1,"familyId":"metrics","views":[{"reportId":"overview","visualProfile":"overview","revision":"1","tabs":[{"id":"main","title":"Main","blockIds":["intro"]}],"blocks":[{"id":"intro","kind":"markdownBlock"}]}]}`)
	extensionWrite(t, root, "extension/forge/reporting/report.yaml", `kind: forge.reporting.report
id: delivery
namespace: example
name: delivery
resourceUri: report://example/delivery
builderRef: metrics
label: Delivery
documentPatch: {title: Delivery, blocks: [{id: intro, kind: markdownBlock, markdown: Hello}]}
statePatch: {selectedMeasures: [spend]}
`)
	options := reportcatalog.ReportResourceOptions{Options: registry.Options{WorkspaceRoot: root}, BuilderWindows: map[string]string{"metrics": "campaign/detail"}}
	return root, NativeSnapshotDefinition{URI: "report://example/delivery", Title: "Delivery", FormatVersion: 1, File: "extension/forge/reporting/report.yaml", Load: NativeReportLoader("report://example/delivery", options, nil)}
}

func TestNativeReportSnapshotRequiresAssignedLookupClosure(t *testing.T) {
	for _, scenario := range []string{"unassigned", "assigned", "missing"} {
		t.Run(scenario, func(t *testing.T) {
			root := t.TempDir()
			extensionWrite(t, root, "extension/forge/reporting/builder.yaml", "kind: forge.reporting.builder\nid: summary\nreportBuilder:\n  document: {title: Rows}\n")
			extensionWrite(t, root, "extension/forge/reporting/report.yaml", "kind: forge.reporting.report\nid: rows\nnamespace: example\nname: rows\nresourceUri: report://example/rows\nbuilderRef: summary\nlabel: Rows\ndocumentPatch: {blocks: [{id: note, kind: markdownBlock, markdown: Rows}]}\n")
			extensionWrite(t, root, "extension/forge/datasources/items.yaml", "id: items\nbackend: {kind: inline, rows: [{value: 3}]}\n")
			if scenario != "missing" {
				extensionWrite(t, root, "extension/forge/datasources/choices.yaml", "id: choices\nbackend: {kind: inline, rows: [{id: 1}]}\n")
			}
			extensionWrite(t, root, "extension/forge/datasources/unrelated.yaml", "id: unrelated\nbackend: {kind: inline, rows: [{id: 2}]}\n")
			windowSource := "windowKey: rows\ndataSource:\n  items: {cardinality: collection}\nview:\n  content: {id: root}\n"
			if scenario != "unassigned" {
				windowSource += "resources:\n  dataSources: [choices]\n"
			}
			extensionWrite(t, root, "extension/forge/windows/rows/main.yaml", windowSource)
			options := reportcatalog.ReportResourceOptions{Options: registry.Options{WorkspaceRoot: root}, BuilderWindows: map[string]string{"summary": "rows"}}
			definition := NativeSnapshotDefinition{URI: "report://example/rows", Title: "Rows", FormatVersion: 1, File: "extension/forge/reporting/report.yaml"}
			definition.Load = NativeReportLoader(definition.URI, options, func(_ context.Context, window *forgeTypes.Window) error {
				window.View.Content.Dashboard = &forgeTypes.Dashboard{ReportBuilder: map[string]any{
					"predicates": []any{map[string]any{"id": "choice", "optionsDataSourceRef": "choices"}},
				}}
				return nil
			})
			snapshot, err := NewNativeAssetSnapshot(t.Context(), root, []NativeSnapshotDefinition{definition})
			if scenario != "assigned" {
				require.Error(t, err, "an incomplete lookup closure must not silently become a saved report")
				require.ErrorContains(t, err, "choices")
				require.Nil(t, snapshot)
				return
			}
			require.NoError(t, err)
			uri, err := identity.ParseResourceURI(definition.URI)
			require.NoError(t, err)
			candidates, err := snapshot.Candidates(t.Context(), uri)
			require.NoError(t, err)
			raw, err := snapshot.ReadCandidate(t.Context(), uri, candidates[0])
			require.NoError(t, err)
			var envelope registry.ReportEnvelope
			require.NoError(t, json.Unmarshal(raw, &envelope))
			require.Contains(t, envelope.DataSources, "choices")
			require.Contains(t, envelope.DataSources, "items")
			require.NotContains(t, envelope.DataSources, "unrelated")
		})
	}
}
func TestNativeReportSnapshotConfinesProfilesAndDatasourceImports(t *testing.T) {
	root, definition := snapshotReportFixture(t)
	snapshot, err := NewNativeAssetSnapshot(context.Background(), root, []NativeSnapshotDefinition{definition})
	require.NoError(t, err)
	uri, _ := identity.ParseResourceURI(definition.URI)
	candidates, err := snapshot.Candidates(context.Background(), uri)
	require.NoError(t, err)
	raw, err := snapshot.ReadCandidate(context.Background(), uri, candidates[0])
	require.NoError(t, err)
	var envelope registry.ReportEnvelope
	require.NoError(t, json.Unmarshal(raw, &envelope))
	require.NotEmpty(t, envelope.DataSources["items"])
	require.Contains(t, string(envelope.BuilderDefinition), "presentationProfiles")
	require.EqualValues(t, 1, snapshot.CompileCount())
	file := filepath.Join(root, "extension/forge/datasources/items.yaml")
	old, err := os.ReadFile(file)
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(file, append(old, []byte("title: Changed\n")...), 0600))
	captured, err := snapshot.ReadCandidate(context.Background(), uri, candidates[0])
	require.NoError(t, err)
	require.Equal(t, raw, captured)
	require.NoError(t, snapshot.Reload(context.Background()))
	_, err = snapshot.ReadCandidate(context.Background(), uri, candidates[0])
	require.ErrorIs(t, err, identity.ErrResourceStale)
}
func TestNativeReportSnapshotRejectsSymlinkProfileAndMissingDatasourceImport(t *testing.T) {
	for _, scenario := range []string{"profile-symlink", "profile-missing", "datasource-import"} {
		t.Run(scenario, func(t *testing.T) {
			root, definition := snapshotReportFixture(t)
			profile := filepath.Join(root, "extension/forge/reporting/profiles/profile.json")
			switch scenario {
			case "profile-symlink":
				require.NoError(t, os.Rename(profile, profile+".original"))
				require.NoError(t, os.Symlink("profile.json.original", profile))
			case "profile-missing":
				require.NoError(t, os.Remove(profile))
			case "datasource-import":
				extensionWrite(t, root, "extension/forge/datasources/items.yaml", "$import(missing.yaml)\n")
			}
			snapshot, err := NewNativeAssetSnapshot(context.Background(), root, []NativeSnapshotDefinition{definition})
			require.Error(t, err)
			require.Nil(t, snapshot)
		})
	}
}
