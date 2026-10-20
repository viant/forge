package types

import (
	"encoding/json"
	"testing"
)

func TestWorkspaceSummaryMetadataRoundTrip(t *testing.T) {
	raw := []byte(`{"workspaceSummary":{"title":"Overview","sections":[{"id":"recent","dataSourceRef":"reports","labelField":"title","handler":"open","statuses":{"active":{"intent":"success"}}}]},"table":{"presentation":"catalog","fullWidth":true}}`)
	var container Container
	if err := json.Unmarshal(raw, &container); err != nil {
		t.Fatal(err)
	}
	encoded, err := json.Marshal(container)
	if err != nil {
		t.Fatal(err)
	}
	var restored Container
	if err = json.Unmarshal(encoded, &restored); err != nil {
		t.Fatal(err)
	}
	if restored.WorkspaceSummary.Sections[0].Handler != "open" || restored.Table.Presentation != "catalog" {
		t.Fatal(string(encoded))
	}
}

func TestDialogCloseGuardRoundTrip(t *testing.T) {
	raw := []byte(`{"id":"edit","closeDisabledWhen":{"selector":"saving","equals":true},"properties":{"closeDisabledWhen":{"selector":"locked","equals":true}}}`)
	var dialog Dialog
	if err := json.Unmarshal(raw, &dialog); err != nil {
		t.Fatal(err)
	}
	encoded, err := json.Marshal(dialog)
	if err != nil {
		t.Fatal(err)
	}
	var restored Dialog
	if err = json.Unmarshal(encoded, &restored); err != nil {
		t.Fatal(err)
	}
	if restored.CloseDisabledWhen["selector"] != "saving" || restored.Properties.CloseDisabledWhen["selector"] != "locked" {
		t.Fatal(string(encoded))
	}
}

func TestResultPreviewMetadataRoundTrip(t *testing.T) {
	var container Container
	if err := json.Unmarshal([]byte(`{"resultPreview":{"dataSourceRef":"query","dataField":"payload","label":"Query result"}}`), &container); err != nil {
		t.Fatal(err)
	}
	encoded, err := json.Marshal(container)
	if err != nil {
		t.Fatal(err)
	}
	var restored Container
	if err = json.Unmarshal(encoded, &restored); err != nil {
		t.Fatal(err)
	}
	if restored.ResultPreview == nil || restored.ResultPreview.DataField != "payload" {
		t.Fatal(string(encoded))
	}
}

func TestItemExplicitVisibleLabelSurvivesRoundTrip(t *testing.T) {
	var item Item
	if err := json.Unmarshal([]byte(`{"id":"run","label":"Run query","icon":"play","hideLabel":false}`), &item); err != nil {
		t.Fatal(err)
	}
	encoded, err := json.Marshal(item)
	if err != nil {
		t.Fatal(err)
	}
	var decoded map[string]interface{}
	if err = json.Unmarshal(encoded, &decoded); err != nil {
		t.Fatal(err)
	}
	if value, present := decoded["hideLabel"]; !present || value != false {
		t.Fatal(string(encoded))
	}
}

func TestReaderWorkbenchBindingsPreserveZeroIndexAndFalseDefault(t *testing.T) {
	var container Container
	raw := []byte(`{"readerWorkbench":{"dataSourceRef":"context","operations":{"preview":{"dataSourceRef":"execute","parameters":{"reportId":{"arg":0},"input.cube":{"arg":5,"default":false}},"mutation":true}},"lookups":{"definition":{"dataSourceRef":"inspect"}}}}`)
	if err := json.Unmarshal(raw, &container); err != nil {
		t.Fatal(err)
	}
	encoded, err := json.Marshal(container)
	if err != nil {
		t.Fatal(err)
	}
	var restored Container
	if err = json.Unmarshal(encoded, &restored); err != nil {
		t.Fatal(err)
	}
	binding := restored.ReaderWorkbench.Operations["preview"]
	if binding.Parameters["reportId"].Arg == nil || *binding.Parameters["reportId"].Arg != 0 || binding.Parameters["input.cube"].Default != false || !binding.Mutation {
		t.Fatal(string(encoded))
	}
}

func TestComplexWidgetContractsSurviveCompilation(t *testing.T) {
	raw := []byte(`{
  "resourcePolicyEditor":{"dataSourceRef":"selection","actionsByKindField":"contracts","choicesField":"directory","operations":{"get":"policy_get","replace":"policy_replace"}},
  "gateRequirementsEditor":{"dataSourceRef":"selection","previewSelectionField":"selected","operations":{"preview":"gate_preview"}},
  "predicateCompositionEditor":{"dataSourceRef":"draft","protectedGroups":[99],"onSave":"actions.save","onGroupSave":"actions.group"},
  "hostContent":{"slot":"namespace-skills","properties":{"readOnly":true}},
  "previewWorkbench":{"baseURL":"/review","queryFields":["scenario"],"widths":{"phone":390}},
  "workspaceSummary":{"titleField":"heading","descriptionField":"description"}
 }`)
	var original Container
	if err := json.Unmarshal(raw, &original); err != nil {
		t.Fatal(err)
	}
	encoded, err := json.Marshal(original)
	if err != nil {
		t.Fatal(err)
	}
	var restored Container
	if err = json.Unmarshal(encoded, &restored); err != nil {
		t.Fatal(err)
	}
	if restored.ResourcePolicyEditor == nil || restored.ResourcePolicyEditor.ActionsByKindField != "contracts" || restored.ResourcePolicyEditor.ChoicesField != "directory" || restored.ResourcePolicyEditor.Operations["replace"] != "policy_replace" {
		t.Fatal(string(encoded))
	}
	if restored.GateRequirementsEditor == nil || restored.GateRequirementsEditor.PreviewSelectionField != "selected" {
		t.Fatal(string(encoded))
	}
	if restored.PredicateCompositionEditor == nil || len(restored.PredicateCompositionEditor.ProtectedGroups) != 1 || restored.PredicateCompositionEditor.ProtectedGroups[0] != 99 || restored.PredicateCompositionEditor.OnGroupSave != "actions.group" {
		t.Fatal(string(encoded))
	}
	if restored.HostContent == nil || restored.HostContent.Slot != "namespace-skills" || restored.HostContent.Properties["readOnly"] != true {
		t.Fatal(string(encoded))
	}
	if restored.PreviewWorkbench == nil || restored.PreviewWorkbench.Widths["phone"] != 390 || restored.WorkspaceSummary.TitleField != "heading" {
		t.Fatal(string(encoded))
	}
}
