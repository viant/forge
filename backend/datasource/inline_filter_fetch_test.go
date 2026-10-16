// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package datasource

import (
	"context"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	"github.com/viant/forge/backend/types"
	"testing"
)

func TestFetchInlineScopedReport(t *testing.T) {
	store := NewMemoryStore()
	store.Put(&dsproto.DataSource{ID: "scoped-report", DataSource: types.DataSource{Selectors: &types.Selectors{Data: "data"}}, Backend: &dsproto.Backend{Kind: dsproto.BackendInline, Rows: []map[string]interface{}{{"id": 710001, "date": "2026-09-09"}, {"id": 710002, "date": "2026-09-09"}, {"id": 710001, "date": "2026-09-12"}}, InlineFilters: []dsproto.InlineFilter{{Field: "id", Input: "filters.orderId", Operator: "eq", Type: "number"}, {Field: "date", Input: "filters.To", Operator: "lte", Type: "date"}}}})
	svc := New(Options{Store: store})
	for _, id := range []float64{710001, 710002} {
		result, err := svc.Fetch(context.Background(), "scoped-report", map[string]interface{}{"filters.orderId": []interface{}{id}, "filters.To": "2026-09-11"}, FetchOptions{})
		if err != nil {
			t.Fatal(err)
		}
		if len(result.Rows) != 1 || float64(result.Rows[0]["id"].(int)) != id {
			t.Fatalf("%v got %v", id, result.Rows)
		}
	}
}
