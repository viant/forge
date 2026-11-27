package types_test

import (
	"strings"
	"testing"

	"github.com/viant/forge/backend/types"
)

func TestVerifiedReadbackConfiguration(t *testing.T) {
	for _, test := range []struct {
		name   string
		change func(*types.MutationCommand)
		want   string
	}{
		{"scoped update", func(*types.MutationCommand) {}, ""},
		{"generated identity", func(c *types.MutationCommand) {
			c.ReceiptIdentity = &types.ReceiptIdentity{Field: "id", Generated: true}
			c.Reconcile.Verify.SubmittedRows = "records"
		}, ""},
		{"scalar IDs only", func(c *types.MutationCommand) {
			c.ReceiptIdentity = &types.ReceiptIdentity{Field: "id", SubmittedValues: "keys"}
			c.Reconcile.Verify.Fields = nil
		}, ""},
		{"missing receipt", func(c *types.MutationCommand) { c.ReceiptIdentity = nil }, "receiptIdentity"},
		{"writer read", func(c *types.MutationCommand) { c.Reconcile.DataSourceRef = "publish" }, "distinct writer and reader"},
		{"missing reader", func(c *types.MutationCommand) { c.Reconcile.DataSourceRef = "absent" }, "unknown reader"},
		{"writer as refresh", func(c *types.MutationCommand) { c.Refresh = []types.RefreshSpec{{DataSourceRef: "publish"}} }, "refresh datasource"},
		{"duplicate read", func(c *types.MutationCommand) { c.Refresh = []types.RefreshSpec{{DataSourceRef: "draft"}} }, "refresh datasource"},
		{"unsafe receipt path", func(c *types.MutationCommand) { c.Reconcile.ResultPath = "constructor.rows" }, "invalid selector"},
		{"no scope", func(c *types.MutationCommand) { c.Reconcile.Verify.Scope = nil }, "scope binding"},
		{"missing binding", func(c *types.MutationCommand) { c.Reconcile.Verify.Scope[0].Parameter = nil }, "reader field and a parameter"},
		{"parameter collision", func(c *types.MutationCommand) { c.Reconcile.Verify.Scope[0].Parameter.Name = "keys" }, "distinct parameter name"},
		{"invalid field", func(c *types.MutationCommand) { c.Reconcile.Verify.Fields["title"] = "__proto__.caption" }, "invalid submitted or reader selector"},
		{"contradictory update rows", func(c *types.MutationCommand) { c.Reconcile.Verify.SubmittedRows = "other" }, "match receiptIdentity"},
		{"scalar IDs with fields", func(c *types.MutationCommand) {
			c.ReceiptIdentity = &types.ReceiptIdentity{Field: "id", SubmittedValues: "keys"}
		}, "requires submittedRows"},
		{"wrong mode", func(c *types.MutationCommand) { c.Reconcile.Mode = "merge" }, "refetch mode"},
		{"preparation writer as reader", func(c *types.MutationCommand) {
			c.Before = newOrderedCommand().Before
			c.Reconcile.DataSourceRef = "stage"
		}, "preparation or cleanup writer"},
	} {
		t.Run(test.name, func(t *testing.T) {
			command := &types.MutationCommand{
				DataSourceRef:   "publish",
				ReceiptIdentity: &types.ReceiptIdentity{Field: "id", SubmittedRows: "records"},
				Reconcile: &types.ReconcileSpec{Mode: "refetch", DataSourceRef: "draft", ResultPath: "0.data", Verify: &types.ReadbackVerification{
					IDsParameter: "keys", Fields: map[string]string{"caption": "title"},
					Scope: []types.ReadbackScope{{Field: "owner", Parameter: &types.Parameter{Name: "ownerId", In: "windowForm", Location: "currentOwner"}, PassToReader: true}},
				}},
			}
			test.change(command)
			err := types.ValidateResourceModels(orderedFooter(command))
			if test.want == "" {
				if err != nil {
					t.Fatal(err)
				}
			} else if err == nil || !strings.Contains(err.Error(), test.want) {
				t.Fatalf("got %v, expected %q", err, test.want)
			}
		})
	}
}

func TestVerifiedReadbackRejectsMutationHTTPMethod(t *testing.T) {
	command := &types.MutationCommand{
		DataSourceRef: "publish", ReceiptIdentity: &types.ReceiptIdentity{Field: "id", Generated: true},
		Reconcile: &types.ReconcileSpec{Mode: "refetch", DataSourceRef: "draft", Verify: &types.ReadbackVerification{
			IDsParameter: "keys", Scope: []types.ReadbackScope{{Field: "owner", Parameter: &types.Parameter{Name: "owner", In: "windowForm", Location: "owner"}}},
		}},
	}
	window := orderedFooter(command)
	window.DataSource["draft"] = types.DataSource{Service: &types.Service{Method: "DELETE", URI: "/records"}}
	if err := types.ValidateResourceModels(window); err == nil || !strings.Contains(err.Error(), "read transport") {
		t.Fatalf("verification reader with DELETE method: %v", err)
	}
}
