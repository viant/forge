// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package datasource

import (
	"testing"

	"github.com/viant/forge/backend/types"
)

func TestApplyPagingClientModeReturnsCompleteCollection(t *testing.T) {
	rows := []map[string]interface{}{{"id": 1}, {"id": 2}, {"id": 3}}
	ds := &types.DataSource{
		PaginationMode: "client",
		Paging:         &types.PagingConfig{Enabled: true, Size: 1},
	}
	got, info := applyPaging(rows, nil, ds, map[string]interface{}{"page": 2, "size": 1})
	if len(got) != 3 {
		t.Fatalf("client pagination backend returned %d rows, want all 3", len(got))
	}
	if info != nil {
		t.Fatalf("client pagination backend synthesized page info: %#v", info)
	}
}

func TestApplyPagingOffsetWithoutTotalInfersHasMore(t *testing.T) {
	rows := make([]map[string]interface{}, 20)
	for i := range rows {
		rows[i] = map[string]interface{}{"id": i + 1}
	}
	ds := &types.DataSource{Paging: &types.PagingConfig{
		Enabled: true,
		Size:    20,
		Parameters: &types.PagingParameters{
			Page: "Offset",
			Size: "Limit",
		},
	}}
	got, info := applyPaging(rows, nil, ds, map[string]interface{}{"Offset": 20, "Limit": 20})
	if len(got) != 20 || info["page"] != 2 || info["hasMore"] != true {
		t.Fatalf("unexpected full offset page: rows=%d info=%#v", len(got), info)
	}
	if _, ok := info["pageCount"]; ok {
		t.Fatalf("unknown total must not synthesize pageCount: %#v", info)
	}

	got, info = applyPaging(rows[:19], nil, ds, map[string]interface{}{"Offset": 40, "Limit": 20})
	if len(got) != 19 || info["page"] != 3 || info["hasMore"] != false {
		t.Fatalf("unexpected short final offset page: rows=%d info=%#v", len(got), info)
	}
}

func TestApplyPagingOpenEndedPageDoesNotDoubleSliceBackendRows(t *testing.T) {
	rows := make([]map[string]interface{}, 100)
	for i := range rows {
		rows[i] = map[string]interface{}{"id": 1000 - i}
	}
	ds := &types.DataSource{Paging: &types.PagingConfig{
		Enabled:   true,
		Size:      100,
		OpenEnded: true,
		Parameters: &types.PagingParameters{
			Page: "Page",
		},
	}}
	got, info := applyPaging(rows, map[string]interface{}{"pageCount": 1, "totalCount": 100}, ds, map[string]interface{}{"Page": 2})
	if len(got) != 100 || info["page"] != 2 || info["hasMore"] != true {
		t.Fatalf("backend page was double-sliced: rows=%d info=%#v", len(got), info)
	}
	if _, ok := info["pageCount"]; ok {
		t.Fatalf("open-ended paging retained synthetic pageCount: %#v", info)
	}
}
