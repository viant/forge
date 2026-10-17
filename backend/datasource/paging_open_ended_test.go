package datasource

import (
	"github.com/viant/forge/backend/types"
	"testing"
)

func TestOpenEndedOffsetPageNumbers(t *testing.T) {
	ds := &types.DataSource{Paging: &types.PagingConfig{Enabled: true, OpenEnded: true, Size: 10, Parameters: &types.PagingParameters{Page: "Offset", Size: "Limit"}}}
	for _, tc := range []struct{ offset, page, count int }{{0, 1, 10}, {10, 2, 10}, {20, 3, 10}, {30, 4, 1}, {40, 5, 0}, {-10, 1, 0}} {
		rows := make([]map[string]interface{}, tc.count)
		got, info := applyPaging(rows, nil, ds, map[string]interface{}{"Offset": tc.offset, "Limit": 10})
		if len(got) != tc.count {
			t.Fatal("upstream page sliced")
		}
		if info["page"] != tc.page {
			t.Errorf("offset %d: page=%v want %d", tc.offset, info["page"], tc.page)
		}
		if info["hasMore"] != (tc.count == 10) {
			t.Errorf("offset %d: wrong hasMore", tc.offset)
		}
		if _, ok := info["totalCount"]; ok {
			t.Fatal("invented total")
		}
	}
	ds.Paging.Parameters.Page = "Page"
	_, info := applyPaging(make([]map[string]interface{}, 10), nil, ds, map[string]interface{}{"Page": 3, "Limit": 10})
	if info["page"] != 3 {
		t.Fatal("page-based input changed")
	}
}
