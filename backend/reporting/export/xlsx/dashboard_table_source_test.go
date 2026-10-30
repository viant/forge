package xlsx

import (
	"testing"

	"github.com/stretchr/testify/require"
	reportfill "github.com/viant/forge/backend/reporting/fill"
)

// Synthetic presentation descriptors distinguish semantic labels from numeric
// formatting, without inferring meaning from field names or application schemas.
func TestDashboardTableSemanticDisplayValues(t *testing.T) {
	for _, tc := range []struct {
		name   string
		column reportfill.TableColumn
		cell   reportfill.ResolvedTableCell
		want   any
	}{
		{"relation", reportfill.TableColumn{Key: "ownerId"}, reportfill.ResolvedTableCell{SourceKey: "ownerId", DisplayKey: "owner.name", Value: 17, DisplayValue: "Cedar"}, "Cedar"},
		{"mapping", reportfill.TableColumn{Key: "status", DisplayValueMap: map[string]any{"1": "Ready"}}, reportfill.ResolvedTableCell{SourceKey: "status", DisplayKey: "status", Value: 1, DisplayValue: "Ready"}, "Ready"},
		{"precision", reportfill.TableColumn{Key: "amount"}, reportfill.ResolvedTableCell{SourceKey: "amount", DisplayKey: "amount", Value: 0.11459765000000001, DisplayValue: "0.11"}, 0.11459765000000001},
		{"false label", reportfill.TableColumn{Key: "flag"}, reportfill.ResolvedTableCell{SourceKey: "flag", DisplayKey: "flag.label", Value: 1, DisplayValue: false}, false},
	} {
		t.Run(tc.name, func(t *testing.T) { require.Equal(t, tc.want, dashboardTableCellValue(tc.column, tc.cell)) })
	}
}
