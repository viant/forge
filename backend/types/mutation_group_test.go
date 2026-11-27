package types_test

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/viant/forge/backend/types"
)

func newGroupedCommand() *types.MutationCommand {
	return &types.MutationCommand{
		CommandID: "batch", Prepare: "Workspace.prepare", Refresh: []types.RefreshSpec{{DataSourceRef: "draft"}},
		Group: []types.MutationGroupMember{
			{Command: &types.MutationCommand{CommandID: "first", DataSourceRef: "publish", ReceiptIdentity: &types.ReceiptIdentity{Field: "id", SubmittedValues: "input.ids"}}},
			{When: map[string]any{"source": "form", "field": "selected", "exists": true}, Command: &types.MutationCommand{CommandID: "second", DataSourceRef: "stage"}},
		},
	}
}

func TestGroupedMutationValidation(t *testing.T) {
	for _, test := range []struct {
		name, want string
		change     func(*types.MutationCommand)
	}{
		{"missing command id", "requires a commandId", func(c *types.MutationCommand) { c.CommandID = "" }},
		{"empty group", "at least one member", func(c *types.MutationCommand) { c.Group = []types.MutationGroupMember{} }},
		{"root writer", "belong to individual writes", func(c *types.MutationCommand) { c.DataSourceRef = "publish" }},
		{"root before", "belong to individual writes", func(c *types.MutationCommand) { c.Before = newOrderedCommand().Before }},
		{"nil member", "requires a command", func(c *types.MutationCommand) { c.Group[0].Command = nil }},
		{"duplicate id", "distinct commandId", func(c *types.MutationCommand) { c.Group[0].Command.CommandID = "second" }},
		{"duplicate writer", "distinct writer datasource", func(c *types.MutationCommand) { c.Group[0].Command.DataSourceRef = "stage" }},
		{"unknown writer", "unknown datasource missing", func(c *types.MutationCommand) { c.Group[0].Command.DataSourceRef = "missing" }},
		{"duplicate refresh", "distinct reader datasources", func(c *types.MutationCommand) { c.Refresh = append(c.Refresh, c.Refresh[0]) }},
		{"writer refresh", "outside the group writers", func(c *types.MutationCommand) { c.Refresh[0].DataSourceRef = "stage" }},
		{"unknown refresh", "unknown datasource missing", func(c *types.MutationCommand) { c.Refresh[0].DataSourceRef = "missing" }},
		{"blank refresh", "distinct reader datasources", func(c *types.MutationCommand) { c.Refresh[0].DataSourceRef = " " }},
		{"empty condition", "one selector", func(c *types.MutationCommand) { c.Group[0].When = map[string]any{} }},
		{"empty conjunction", "non-empty array", func(c *types.MutationCommand) { c.Group[0].When = map[string]any{"all": []any{}} }},
		{"mixed tree keys", "cannot be combined", func(c *types.MutationCommand) { c.Group[0].When = map[string]any{"not": c.Group[1].When, "field": "x"} }},
		{"invalid negation", "one selector", func(c *types.MutationCommand) { c.Group[0].When = map[string]any{"not": true} }},
		{"unknown condition scope", "supported condition scope", func(c *types.MutationCommand) { c.Group[1].When["source"] = "nonexistent" }},
		{"unsafe member selector", "safe selector", func(c *types.MutationCommand) { c.Group[1].When["field"] = "record.__proto__" }},
		{"invalid operand", "requires a boolean", func(c *types.MutationCommand) { c.Group[1].When["exists"] = "true" }},
		{"unknown condition datasource", "unknown datasource missing", func(c *types.MutationCommand) { c.Group[1].When["dataSourceRef"] = "missing" }},
		{"invalid root predicate", "one selector", func(c *types.MutationCommand) { c.ValidateWhen = map[string]any{"equals": true} }},
		{"invalid writer predicate", "one selector", func(c *types.MutationCommand) { c.Group[0].Command.ValidateWhen = map[string]any{"equals": true} }},
		{"before child grouped", "belong to the root", func(c *types.MutationCommand) {
			nested := newOrderedCommand()
			nested.Before[0].Command.Group = c.Group
			*c = *nested
		}},
		{"cleanup grouped", "belong to the root", func(c *types.MutationCommand) {
			nested := newOrderedCommand()
			nested.Before[0].Cleanup.Group = c.Group
			*c = *nested
		}},
	} {
		t.Run(test.name, func(t *testing.T) {
			command := newGroupedCommand()
			test.change(command)
			err := types.ValidateResourceModels(orderedFooter(command))
			if err == nil || !strings.Contains(err.Error(), test.want) {
				t.Fatalf("validation error = %v, want %q", err, test.want)
			}
		})
	}
	if err := types.ValidateResourceModels(orderedFooter(newGroupedCommand())); err != nil {
		t.Fatal(err)
	}
}

func TestMutationReceiptIdentityAlternatives(t *testing.T) {
	for _, test := range []struct {
		name     string
		identity types.ReceiptIdentity
		valid    bool
	}{
		{"scalar IDs", types.ReceiptIdentity{Field: "id", SubmittedValues: "input.ids"}, true},
		{"row IDs", types.ReceiptIdentity{Field: "id", SubmittedRows: "input.records", SubmittedField: "key"}, true},
		{"generated ID", types.ReceiptIdentity{Field: "id", Generated: true}, true},
		{"no source", types.ReceiptIdentity{Field: "id"}, false},
		{"rows and scalar IDs", types.ReceiptIdentity{Field: "id", SubmittedRows: "items", SubmittedValues: "ids"}, false},
		{"generated and scalar IDs", types.ReceiptIdentity{Field: "id", SubmittedValues: "ids", Generated: true}, false},
		{"generated and row IDs", types.ReceiptIdentity{Field: "id", SubmittedRows: "items", Generated: true}, false},
		{"scalar IDs with submitted field", types.ReceiptIdentity{Field: "id", SubmittedValues: "ids", SubmittedField: "key"}, false},
		{"unsafe scalar IDs", types.ReceiptIdentity{Field: "id", SubmittedValues: "constructor.ids"}, false},
		{"unsafe returned field", types.ReceiptIdentity{Field: "record.__proto__", SubmittedValues: "ids"}, false},
	} {
		t.Run(test.name, func(t *testing.T) {
			group := newGroupedCommand()
			group.Group[0].Command.ReceiptIdentity = &test.identity
			for _, command := range []*types.MutationCommand{group, group.Group[0].Command} {
				if err := types.ValidateResourceModels(orderedFooter(command)); (err == nil) != test.valid {
					t.Fatalf("validation error = %v, valid = %v", err, test.valid)
				}
			}
		})
	}
	legacy := &types.MutationCommand{DataSourceRef: "publish", ReceiptIdentity: &types.ReceiptIdentity{Field: "id", SubmittedRows: "items"}}
	encoded, err := json.Marshal(legacy)
	if err != nil {
		t.Fatal(err)
	}
	if string(encoded) != `{"receiptIdentity":{"field":"id","submittedRows":"items"},"dataSourceRef":"publish"}` {
		t.Fatalf("legacy serial shape changed: %s", encoded)
	}
}
