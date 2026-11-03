package tablemeta

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestStaticPivotMetadata(t *testing.T) {
	for _, domain := range []string{"observed", "fixed"} {
		for _, fields := range [][]string{nil, {"members"}, {}, {"members", "members"}, {"branch"}, {"month"}, {"circulation"}, {"unknown"}, {" "}} {
			pivot := &Pivot{RowFields: []string{"branch"}, StaticFields: fields, ColumnField: "month", Values: []PivotValue{{Field: "circulation", Label: "Circulation", Aggregate: "none"}}}
			if domain == "observed" {
				pivot.ColumnDomain = domain
			} else {
				pivot.ColumnCategories = []string{"March", "January"}
			}
			valid := fields == nil || len(fields) == 1 && fields[0] == "members"
			err := Validate(nil, pivot, nil, []string{"branch", "month", "circulation", "members"})
			if !valid {
				require.Error(t, err, "%s %v", domain, fields)
				continue
			}
			require.NoError(t, err)
			raw, err := json.Marshal(pivot)
			require.NoError(t, err)
			if fields == nil {
				require.NotContains(t, string(raw), "staticFields")
			}
			var decoded Pivot
			require.NoError(t, json.Unmarshal(raw, &decoded))
			require.Equal(t, pivot, &decoded)
			require.NoError(t, Validate(nil, &decoded, nil, []string{"branch", "month", "circulation", "members"}))
		}
	}
}
