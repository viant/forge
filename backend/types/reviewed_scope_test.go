package types_test

import (
	"strings"
	"testing"

	"github.com/viant/forge/backend/types"
)

func TestReviewedScopeConfiguration(t *testing.T) {
	match := types.ReviewedScopeMatch{Parameter: "review.id", Source: "collection", DataSourceRef: "draft", Field: "0.id"}
	for _, tc := range []struct {
		name   string
		change func(*types.MutationCommand)
		want   string
	}{
		{"scoped", func(c *types.MutationCommand) {}, ""},
		{"window", func(c *types.MutationCommand) {
			c.ReviewedScope[0].Source = "windowForm"
			c.ReviewedScope[0].DataSourceRef = ""
		}, ""},
		{"empty", func(c *types.MutationCommand) { c.ReviewedScope = []types.ReviewedScopeMatch{} }, "at least one"},
		{"unsafe", func(c *types.MutationCommand) { c.ReviewedScope[0].Parameter = "__proto__.id" }, "safe"},
		{"missing", func(c *types.MutationCommand) { c.ReviewedScope[0].DataSourceRef = "absent" }, "unknown datasource"},
		{"ambiguous", func(c *types.MutationCommand) { c.ReviewedScope[0].Source = "windowForm" }, "cannot reference"},
		{"unsupported", func(c *types.MutationCommand) { c.ReviewedScope[0].Source = "unknown" }, "unsupported"},
		{"child", func(c *types.MutationCommand) { c.Before[0].Command.ReviewedScope = []types.ReviewedScopeMatch{match} }, "root dialog footer"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			c := newOrderedCommand()
			c.ReviewedScope = []types.ReviewedScopeMatch{match}
			tc.change(c)
			err := types.ValidateResourceModels(orderedFooter(c))
			if tc.want == "" && err != nil || tc.want != "" && (err == nil || !strings.Contains(err.Error(), tc.want)) {
				t.Fatalf("validation = %v, want %q", err, tc.want)
			}
		})
	}
}
