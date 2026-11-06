// SPDX-License-Identifier: Apache-2.0
package provider

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

// Fixtures here are independently authored synthetic rows, with no external
// application, datasource, query or production capture dependencies.
var syntheticMenuFields = MenuRowFields{
	GroupID: "group_id", GroupLabel: "group_label", GroupOrder: "group_order",
	ItemID: "item_id", ItemLabel: "item_label", ItemOrder: "item_order",
}

func syntheticMenuRow(group string, groupOrder any, item string, itemOrder any) map[string]any {
	return map[string]any{
		"group_id": group, "group_label": "Same group", "group_order": groupOrder,
		"item_id": item, "item_label": "Same item", "item_order": itemOrder,
		// These unbound datasource columns must never become executable actions.
		"url": "https://example.invalid/untrusted", "action": `{"type":"untrusted"}`,
	}
}

func TestProjectMenuRowsIdentityOrderingAndAuthoredActions(t *testing.T) {
	rows := []map[string]any{
		syntheticMenuRow("second", 20, "last", 30),
		syntheticMenuRow("first", []byte("10"), "tie-one", 10),
		syntheticMenuRow("second", 20, "first", -1),
		syntheticMenuRow("first", 10, "tie-two", json.Number("10")),
		syntheticMenuRow("third", 20, "last", 1),
	}
	action := json.RawMessage(`{"type":"window","resourceUri":"window://synthetic/home","parameters":{"large":9007199254740993},"parameterBindings":{"Key":{"from":["key"]}}}`)
	bindings := make(map[MenuRowIdentity]MenuRowBinding)
	for _, row := range rows {
		bindings[MenuRowIdentity{GroupID: row["group_id"].(string), ItemID: row["item_id"].(string)}] = MenuRowBinding{Action: action}
	}
	app := json.RawMessage(`{"id":"workspace","title":"Workspace","icon":"application","menus":[{"id":"replaced"}]}`)
	raw, err := ProjectMenuRows(context.Background(), rows, syntheticMenuFields, app, bindings)
	require.NoError(t, err)
	require.NoError(t, ValidateMenuTargets(context.Background(), raw))
	var envelope struct {
		SchemaVersion int `json:"schemaVersion"`
		Applications  []struct {
			ID    string `json:"id"`
			Icon  string `json:"icon"`
			Menus []struct {
				ID    string `json:"id"`
				Title string `json:"title"`
				Menus []struct {
					ID     string          `json:"id"`
					Action json.RawMessage `json:"action"`
				} `json:"menus"`
			} `json:"menus"`
		} `json:"applications"`
	}
	require.NoError(t, json.Unmarshal(raw, &envelope))
	require.Equal(t, 1, envelope.SchemaVersion)
	require.Len(t, envelope.Applications, 1)
	application := envelope.Applications[0]
	require.Equal(t, "workspace", application.ID)
	require.Equal(t, "application", application.Icon)
	require.Len(t, application.Menus, 3)
	require.Equal(t, "first", application.Menus[0].ID)
	require.Equal(t, "second", application.Menus[1].ID)
	require.Equal(t, "third", application.Menus[2].ID, "group ties preserve first appearance")
	require.Equal(t, application.Menus[0].Title, application.Menus[1].Title, "same labels never merge group IDs")
	require.Equal(t, "tie-one", application.Menus[0].Menus[0].ID)
	require.Equal(t, "tie-two", application.Menus[0].Menus[1].ID)
	require.Equal(t, "first", application.Menus[1].Menus[0].ID)
	require.Equal(t, "last", application.Menus[1].Menus[1].ID)
	for _, group := range application.Menus {
		for _, item := range group.Menus {
			require.JSONEq(t, string(action), string(item.Action))
		}
	}
	for i := 0; i < 3; i++ {
		again, err := ProjectMenuRows(context.Background(), rows, syntheticMenuFields, app, bindings)
		require.NoError(t, err)
		require.Equal(t, raw, again)
	}
	require.JSONEq(t, `{"id":"workspace","title":"Workspace","icon":"application","menus":[{"id":"replaced"}]}`, string(app), "authored input is not mutated")
}

func TestProjectMenuRowsUsesProducerSelectionAndNativeDisabledSemantics(t *testing.T) {
	rows := []map[string]any{syntheticMenuRow("group", 1, "pending", 1), syntheticMenuRow("group", 1, "live", 2)}
	bindings := map[MenuRowIdentity]MenuRowBinding{
		{GroupID: "group", ItemID: "pending"}: {Disabled: true},
		{GroupID: "group", ItemID: "live"}:    {Disabled: true, Action: json.RawMessage(`{"resourceUri":"report://synthetic/live"}`)},
		// An authored binding does not add an item absent from selected rows.
		{GroupID: "group", ItemID: "omitted"}: {Action: json.RawMessage(`{"resourceUri":"window://synthetic/omitted"}`)},
	}
	raw, err := ProjectMenuRows(context.Background(), rows, syntheticMenuFields, json.RawMessage(`{"id":"workspace"}`), bindings)
	require.NoError(t, err)
	require.NotContains(t, string(raw), "omitted")
	var envelope struct {
		Applications []json.RawMessage `json:"applications"`
	}
	require.NoError(t, json.Unmarshal(raw, &envelope))
	checked := 0
	filtered, err := filterMenuNodes(context.Background(), envelope.Applications, func(json.RawMessage) (bool, error) {
		checked++
		return false, nil
	}, 0)
	require.NoError(t, err)
	require.Equal(t, 1, checked, "disabled actions still use the existing visibility path")
	encoded, err := json.Marshal(filtered)
	require.NoError(t, err)
	require.JSONEq(t, `[{"id":"workspace","menus":[{"id":"group","title":"Same group","menus":[{"id":"pending","title":"Same item","disabled":true}]}]}]`, string(encoded))
}

func TestProjectMenuRowsMappingAndEmptyRows(t *testing.T) {
	fields := MenuRowFields{GroupID: "category", GroupLabel: "caption", GroupOrder: "rank", ItemID: "key", ItemLabel: "name", ItemOrder: "position"}
	rows := []map[string]any{{"category": int64(7), "caption": "Category", "rank": 1, "key": []byte("entry"), "name": "Entry", "position": "2"}}
	bindings := map[MenuRowIdentity]MenuRowBinding{{GroupID: "7", ItemID: "entry"}: {Disabled: true}}
	raw, err := ProjectMenuRows(context.Background(), rows, fields, json.RawMessage(`{"id":"workspace"}`), bindings)
	require.NoError(t, err)
	require.JSONEq(t, `{"schemaVersion":1,"applications":[{"id":"workspace","menus":[{"id":"7","title":"Category","menus":[{"id":"entry","title":"Entry","disabled":true}]}]}]}`, string(raw))
	raw, err = ProjectMenuRows(context.Background(), nil, fields, json.RawMessage(`{"id":"workspace"}`), nil)
	require.NoError(t, err)
	require.JSONEq(t, `{"schemaVersion":1,"applications":[]}`, string(raw))
}

func TestProjectMenuRowsPreservesDatabaseIntegerOrderPrecision(t *testing.T) {
	rows := []map[string]any{
		syntheticMenuRow("group", 1, "later", int64(9007199254740993)),
		syntheticMenuRow("group", 1, "earlier", int64(9007199254740992)),
	}
	bindings := map[MenuRowIdentity]MenuRowBinding{
		{GroupID: "group", ItemID: "later"}:   {Disabled: true},
		{GroupID: "group", ItemID: "earlier"}: {Disabled: true},
	}
	raw, err := ProjectMenuRows(context.Background(), rows, syntheticMenuFields, json.RawMessage(`{"id":"workspace"}`), bindings)
	require.NoError(t, err)
	require.JSONEq(t, `{"schemaVersion":1,"applications":[{"id":"workspace","menus":[{"id":"group","title":"Same group","menus":[{"id":"earlier","title":"Same item","disabled":true},{"id":"later","title":"Same item","disabled":true}]}]}]}`, string(raw))
}

func TestProjectMenuRowsRejectsUnboundOrInvalidActionThroughNativeContract(t *testing.T) {
	row := syntheticMenuRow("group", 1, "item", 1)
	key := MenuRowIdentity{GroupID: "group", ItemID: "item"}
	for _, binding := range []*MenuRowBinding{nil, {}, {Disabled: false}, {Disabled: true, Action: json.RawMessage(`null`)}, {Action: json.RawMessage(`"invalid"`)}} {
		bindings := make(map[MenuRowIdentity]MenuRowBinding)
		if binding != nil {
			bindings[key] = *binding
		}
		_, err := ProjectMenuRows(context.Background(), []map[string]any{row}, syntheticMenuFields, json.RawMessage(`{"id":"workspace"}`), bindings)
		require.Error(t, err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err := ProjectMenuRows(ctx, nil, syntheticMenuFields, json.RawMessage(`{"id":"workspace"}`), nil)
	require.ErrorIs(t, err, context.Canceled)
}
