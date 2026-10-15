// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package datasource

import (
	dsproto "github.com/viant/forge/backend/datasource/contract"
	"testing"
)

func TestInlineFiltersScopeDatesAndOrder(t *testing.T) {
	rows := []map[string]interface{}{
		{"order": 710001, "date": "2026-09-08", "spend": 100},
		{"order": 710001, "date": "2026-09-09", "spend": 200},
		{"order": 710002, "date": "2026-09-09", "spend": 400},
		{"order": 710001, "date": "2026-09-11", "spend": 300},
		{"order": 710001, "date": "2026-09-12", "spend": 500},
	}
	filters := []dsproto.InlineFilter{{Field: "order", Input: "filters.orderId", Operator: "eq", Type: "number"}, {Field: "date", Input: "filters.From", Operator: "gte", Type: "date"}, {Field: "date", Input: "filters.To", Operator: "lte", Type: "date"}}
	for _, test := range []struct {
		order float64
		count int
		spend int
	}{{710001, 2, 500}, {710002, 1, 400}, {999999, 0, 0}} {
		got, err := filterInlineRows(rows, filters, map[string]interface{}{"filters": map[string]interface{}{"orderId": test.order, "From": "2026-09-09T00:00:00Z", "To": "2026-09-11"}})
		if err != nil {
			t.Fatal(err)
		}
		total := 0
		for _, row := range got {
			total += row["spend"].(int)
		}
		if len(got) != test.count || total != test.spend {
			t.Fatalf("order %v got %v", test.order, got)
		}
	}
	if len(rows) != 5 {
		t.Fatal("mutated source")
	}
	unfiltered, err := filterInlineRows(rows, nil, nil)
	if err != nil || len(unfiltered) != 5 {
		t.Fatal("changed unconfigured source")
	}
	if _, err := filterInlineRows(rows, filters, map[string]interface{}{"filters": map[string]interface{}{"From": "invalid"}}); err == nil {
		t.Fatal("invalid date must fail")
	}
}

func TestInlineFiltersLookupArray(t *testing.T) {
	got, err := filterInlineRows([]map[string]interface{}{{"id": 710001}, {"id": 710002}, {"id": 710003}}, []dsproto.InlineFilter{{Field: "id", Input: "filters.orderId", Operator: "eq", Type: "number"}}, map[string]interface{}{"filters.orderId": []interface{}{float64(710001), float64(710002)}})
	if err != nil || len(got) != 2 {
		t.Fatalf("got %v %v", got, err)
	}
}
