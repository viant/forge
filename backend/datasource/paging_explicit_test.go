// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package datasource

import (
	"github.com/viant/forge/backend/types"
	"reflect"
	"testing"
)

func TestLegacyPagingEmptyModeRetainsExistingSlicingAndLiteralOffset(t *testing.T) {
	rows := []map[string]interface{}{{"id": 0}, {"id": 1}, {"id": 2}, {"id": 3}, {"id": 4}}
	ds := &types.DataSource{Paging: &types.PagingConfig{Enabled: true, Size: 2, Parameters: &types.PagingParameters{Page: "pageNumber", Size: "batch"}}}
	got, info := applyPaging(rows, nil, ds, map[string]interface{}{"pageNumber": 3, "batch": 2})
	if len(got) != 1 || got[0]["id"] != 4 || info["page"] != 3 || info["totalCount"] != 5 {
		t.Fatalf("legacy page behavior changed: %#v %#v", got, info)
	}
	ds.Paging.Parameters.Page = "Offset"
	got, info = applyPaging(rows[:2], nil, ds, map[string]interface{}{"Offset": 4, "batch": 2})
	if !reflect.DeepEqual(got, rows[:2]) || info["page"] != 3 || info["hasMore"] != true {
		t.Fatalf("legacy literal-offset behavior changed: %#v %#v", got, info)
	}
}
func TestExplicitPagingDisabledNeverChangesRowsOrInfo(t *testing.T) {
	rows := []map[string]interface{}{{"id": 1}}
	info := map[string]interface{}{"custom": "kept"}
	ds := &types.DataSource{Paging: &types.PagingConfig{Enabled: false, Mode: "unsupported"}}
	if validateExplicitPaging(ds) != nil {
		t.Fatal("disabled paging must not impose capability requirements")
	}
	got, actual := applyPaging(rows, info, ds, nil)
	if !reflect.DeepEqual(got, rows) || !reflect.DeepEqual(actual, info) {
		t.Fatal("disabled paging altered backend result")
	}
}
func TestExplicitOffsetHonorsKnownZeroAndDoesNotMutateUpstreamInfo(t *testing.T) {
	rows := []map[string]interface{}{}
	info := map[string]interface{}{"count": 0, "opaque": "kept"}
	ds := &types.DataSource{Paging: &types.PagingConfig{Enabled: true, Mode: "offset", Size: 2, Parameters: &types.PagingParameters{Page: "skipRows", Size: "takeRows"}, DataInfoSelectors: &types.DataInfoSelectors{TotalCount: "count"}}}
	_, got := applyPaging(rows, info, ds, map[string]interface{}{"skipRows": 0, "takeRows": 2})
	if got["totalCount"] != 0 || got["hasMore"] != false || got["opaque"] != "kept" {
		t.Fatalf("zero total/opaque info lost: %#v", got)
	}
	if len(info) != 2 {
		t.Fatal("upstream info was mutated")
	}
}
func TestScalarValueColumnIsExplicitAndPreservesZeroFalseAndArrays(t *testing.T) {
	for _, value := range []interface{}{false, float64(0), "", []interface{}{false, float64(0), ""}} {
		legacy, _, _ := project(value, nil)
		if len(legacy) != 0 {
			t.Fatal("legacy scalar projection unexpectedly changed")
		}
		ds := &types.DataSource{Selectors: &types.Selectors{ValueColumn: "answer"}}
		got, _, _ := project(value, ds)
		if list, ok := value.([]interface{}); ok {
			if len(got) != len(list) {
				t.Fatal("scalar array dropped")
			}
			for i, v := range list {
				if !reflect.DeepEqual(got[i]["answer"], v) {
					t.Fatal("scalar array value altered")
				}
			}
		} else if len(got) != 1 || !reflect.DeepEqual(got[0]["answer"], value) {
			t.Fatalf("scalar lost: %#v", got)
		}
	}
}

func TestCursorPagingRequiresStrictAuthoredContinuation(t *testing.T) {
	ds := &types.DataSource{Paging: &types.PagingConfig{Enabled: true, Mode: "cursor", Parameters: &types.PagingParameters{Page: "resume"}, DataInfoSelectors: &types.DataInfoSelectors{HasMore: "nav.more", NextCursor: "nav.next"}}}
	if err := validateExplicitPaging(ds); err != nil {
		t.Fatal(err)
	}
	for _, info := range []map[string]interface{}{nil, {"nav": map[string]interface{}{"more": "true"}}, {"nav": map[string]interface{}{"more": true}}, {"nav": map[string]interface{}{"more": true, "next": ""}}} {
		if err := validatePagingDataInfo(ds, info); err == nil {
			t.Fatal("invalid cursor result admitted")
		}
	}
	for _, info := range []map[string]interface{}{{"nav": map[string]interface{}{"more": false}}, {"nav": map[string]interface{}{"more": true, "next": map[string]interface{}{"opaque": "token"}}}} {
		if err := validatePagingDataInfo(ds, info); err != nil {
			t.Fatal(err)
		}
	}
	ds.Paging.Parameters.Page = ""
	if validateExplicitPaging(ds) == nil {
		t.Fatal("missing token argument admitted")
	}
}

func TestCursorPagingRejectsRepeatedCurrentTokenBeforeRowRelease(t *testing.T) {
	ds := &types.DataSource{Paging: &types.PagingConfig{Enabled: true, Mode: "cursor", Parameters: &types.PagingParameters{Page: "resume"}, DataInfoSelectors: &types.DataInfoSelectors{HasMore: "more", NextCursor: "next"}}}
	info := map[string]interface{}{"more": true, "next": map[string]interface{}{"opaque": "same"}}
	if err := validatePagingDataInfo(ds, info, map[string]interface{}{"resume": map[string]interface{}{"opaque": "same"}}); err == nil {
		t.Fatal("repeated token admitted")
	}
}

func TestExplicitPageOffsetHonorsAuthoredFalseWithFullPageAndRejectsInvalidType(t *testing.T) {
	for _, mode := range []string{"page", "offset"} {
		ds := &types.DataSource{Paging: &types.PagingConfig{Enabled: true, Mode: mode, Size: 2, DataInfoSelectors: &types.DataInfoSelectors{HasMore: "nav.remaining"}}}
		info := map[string]interface{}{"nav": map[string]interface{}{"remaining": false}}
		if err := validatePagingDataInfo(ds, info); err != nil {
			t.Fatal(err)
		}
		rows := []map[string]interface{}{{"id": 1}, {"id": 2}}
		outRows, outInfo := applyPaging(rows, info, ds, nil)
		if len(outRows) != 2 || outInfo["hasMore"] != false {
			t.Fatal("full final page inferred another page", outInfo)
		}
		if err := validatePagingDataInfo(ds, map[string]interface{}{"nav": map[string]interface{}{"remaining": "false"}}); err == nil {
			t.Fatal("invalid typed continuation admitted")
		}
		ds.Paging.Mode = ""
		if err := validatePagingDataInfo(ds, nil); err != nil {
			t.Fatal("legacy empty-mode behavior changed")
		}
	}
}
