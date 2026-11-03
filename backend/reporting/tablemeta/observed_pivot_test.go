package tablemeta

import (
	"encoding/json"
	"testing"
)

func TestObservedPivotMetadata(t *testing.T) {
	columns := []string{"location", "category", "count"}
	for _, tc := range []struct {
		name       string
		domain     string
		categories []string
		valid      bool
	}{
		{"observed", "observed", nil, true},
		{"fixed", "", []string{"Electrical", "Mechanical"}, true},
		{"missing", "", nil, false},
		{"unknown", "automatic", nil, false},
		{"both", "observed", []string{"Electrical"}, false},
		{"explicitEmptyFixed", "observed", []string{}, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			pivot := &Pivot{RowFields: []string{"location"}, ColumnField: "category", ColumnDomain: tc.domain, ColumnCategories: tc.categories, Values: []PivotValue{{Field: "count", Label: "Inspections", Aggregate: "none"}}}
			if err := Validate(nil, pivot, nil, columns); (err == nil) != tc.valid {
				t.Fatalf("valid=%v error=%v", tc.valid, err)
			}
			if !tc.valid {
				return
			}
			raw, err := json.Marshal(pivot)
			if err != nil {
				t.Fatal(err)
			}
			var roundTrip Pivot
			if err := json.Unmarshal(raw, &roundTrip); err != nil {
				t.Fatal(err)
			}
			if roundTrip.ColumnDomain != pivot.ColumnDomain {
				t.Fatal("domain lost")
			}
			if err := Validate(nil, &roundTrip, nil, columns); err != nil {
				t.Fatal(err)
			}
		})
	}
}
