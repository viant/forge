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
