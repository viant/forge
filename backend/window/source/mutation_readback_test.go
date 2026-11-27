package window

import (
	"context"
	"testing"

	"github.com/viant/forge/backend/types"
)

func TestVerifiedReadbackSourceBundle(t *testing.T) {
	manifest := WindowSourceManifest{
		Version: 1, Binding: ResourceBinding{WindowKey: "records", URI: "window://example/records"},
		Files: map[string]string{
			"extension/forge/windows/records/main.yaml": `windowKey: records
resources: {dataSources: [updateRecords, readRecords]}
view:
  content:
    id: editor
    mutationCommand:
      commandId: update
      dataSourceRef: updateRecords
      receiptIdentity: {field: id, submittedRows: changes}
      reconcile:
        mode: refetch
        dataSourceRef: readRecords
        resultPath: '0.data'
        verify:
          idsParameter: ids
          scope:
            - field: ownerId
              parameter: {name: owner, in: windowForm, location: selectedOwner}
              passToReader: true
          fields: {description: summary}
`,
			"extension/forge/datasources/updateRecords.yaml": "id: updateRecords\nbackend: {kind: inline, rows: []}\n",
			"extension/forge/datasources/readRecords.yaml":   "id: readRecords\nbackend: {kind: inline, rows: []}\n",
		},
	}
	raw, err := CompileWindowSource(context.Background(), manifest)
	if err != nil {
		t.Fatal(err)
	}
	resource, err := types.SelectWindowResource(raw, nil)
	if err != nil {
		t.Fatal(err)
	}
	cmd := resource.Window.View.Content.MutationCommand
	readback := cmd.Reconcile.Verify
	if cmd.Reconcile.ResultPath != "0.data" || readback.IDsParameter != "ids" || len(readback.Scope) != 1 ||
		readback.Scope[0].Parameter.Location != "selectedOwner" || !readback.Scope[0].PassToReader || readback.Fields["description"] != "summary" {
		t.Fatalf("compiled readback = %#v", readback)
	}
}
