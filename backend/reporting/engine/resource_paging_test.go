package reporting

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	"github.com/viant/forge/backend/types"
	"strings"
	"testing"
)

func cursorReportDescriptor() *dsproto.DataSource {
	return &dsproto.DataSource{ID: "rows", Backend: &dsproto.Backend{Kind: dsproto.BackendMCPTool, Service: "ordinary", Method: "read"}, DataSource: types.DataSource{Paging: &types.PagingConfig{Enabled: true, Mode: "cursor", Parameters: &types.PagingParameters{Page: "resume"}, DataInfoSelectors: &types.DataInfoSelectors{HasMore: "more", NextCursor: "next"}}}}
}
func TestCompleteResourceCursorRejectsInvalidContinuationAndBounds(t *testing.T) {
	for _, tc := range []struct {
		name      string
		result    *dsproto.FetchResult
		errorText string
	}{
		{"unknown", &dsproto.FetchResult{Rows: []map[string]interface{}{{"id": 1}}, DataInfo: map[string]interface{}{}}, "boolean"},
		{"not boolean", &dsproto.FetchResult{Rows: []map[string]interface{}{{"id": 1}}, DataInfo: map[string]interface{}{"more": "true"}}, "boolean"},
		{"missing token", &dsproto.FetchResult{Rows: []map[string]interface{}{{"id": 1}}, DataInfo: map[string]interface{}{"more": true}}, "missing"},
		{"no progress", &dsproto.FetchResult{DataInfo: map[string]interface{}{"more": true, "next": "a"}}, "without progress"},
		{"repeated token", &dsproto.FetchResult{Rows: []map[string]interface{}{{"id": 1}}, DataInfo: map[string]interface{}{"more": true, "next": "a"}}, "repeated"},
		{"row bound", &dsproto.FetchResult{Rows: make([]map[string]interface{}, maxResourceDatasetRows+1), DataInfo: map[string]interface{}{"more": false}}, "bound"},
		{"byte bound", &dsproto.FetchResult{Rows: []map[string]interface{}{{"large": strings.Repeat("x", maxResourceDatasetBytes)}}, DataInfo: map[string]interface{}{"more": false}}, "bound"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			calls := 0
			out, err := fetchCompleteResourceDataset(context.Background(), cursorReportDescriptor(), nil, func() error { return nil }, func(*dsproto.DataSource, map[string]interface{}) (*dsproto.FetchResult, error) {
				calls++
				return tc.result, nil
			})
			if out != nil || err == nil || !strings.Contains(err.Error(), tc.errorText) {
				t.Fatalf("partial/invalid complete result: %#v %v", out, err)
			}
			if calls > 2 {
				t.Fatal("continued after invalid token")
			}
		})
	}
}
func TestCompleteResourceCursorGuardsEveryPageAndFreezesAuthoredInputs(t *testing.T) {
	descriptor := cursorReportDescriptor()
	inputs := map[string]interface{}{"query": map[string]interface{}{"q": "approved"}}
	calls, checks := 0, 0
	out, err := fetchCompleteResourceDataset(context.Background(), descriptor, inputs, func() error { checks++; return nil }, func(exact *dsproto.DataSource, args map[string]interface{}) (*dsproto.FetchResult, error) {
		calls++
		if exact.Backend.Method != "read" || args["query"].(map[string]interface{})["q"] != "approved" {
			t.Fatal("descriptor/inputs changed across pages")
		}
		if calls == 1 {
			if _, exists := args["resume"]; exists {
				t.Fatal("first page got token")
			}
		} else if args["resume"] != "opaque" {
			t.Fatal("wrong token")
		}
		exact.Backend.Method = "mutated"
		args["query"].(map[string]interface{})["q"] = "mutated"
		return &dsproto.FetchResult{Rows: []map[string]interface{}{{"id": calls}}, DataInfo: map[string]interface{}{"more": calls == 1, "next": "opaque"}}, nil
	})
	if err != nil || len(out.Rows) != 2 || checks != 5 || inputs["query"].(map[string]interface{})["q"] != "approved" || descriptor.Backend.Method != "read" {
		t.Fatalf("guard/freeze failed checks=%d result=%#v err=%v", checks, out, err)
	}
	for _, denyAt := range []int{1, 2, 3, 4, 5} {
		t.Run("guard", func(t *testing.T) {
			checks = 0
			calls = 0
			out, err = fetchCompleteResourceDataset(context.Background(), descriptor, inputs, func() error {
				checks++
				if checks == denyAt {
					return errors.New("revoked")
				}
				return nil
			}, func(*dsproto.DataSource, map[string]interface{}) (*dsproto.FetchResult, error) {
				calls++
				return &dsproto.FetchResult{Rows: []map[string]interface{}{{"id": calls}}, DataInfo: map[string]interface{}{"more": calls == 1, "next": "opaque"}}, nil
			})
			if out != nil || err == nil {
				t.Fatal("rows escaped failed page/final guard")
			}
		})
	}
}
func TestCompleteResourceLegacyAndExplicitNumericContracts(t *testing.T) {
	descriptor := cursorReportDescriptor()
	descriptor.Paging.Mode = ""
	calls := 0
	out, err := fetchCompleteResourceDataset(context.Background(), descriptor, nil, func() error { t.Fatal("legacy helper introduced another guard"); return nil }, func(*dsproto.DataSource, map[string]interface{}) (*dsproto.FetchResult, error) {
		calls++
		return &dsproto.FetchResult{Rows: []map[string]interface{}{{"id": 1}}}, nil
	})
	if err != nil || out == nil || calls != 1 {
		t.Fatal("legacy changed")
	}
	for _, mode := range []string{"page", "offset"} {
		descriptor.Paging.Mode = mode
		calls = 0
		out, err = fetchCompleteResourceDataset(context.Background(), descriptor, nil, func() error { return nil }, func(_ *dsproto.DataSource, args map[string]interface{}) (*dsproto.FetchResult, error) {
			position, err := reportPagingInteger(args["resume"])
			if err != nil {
				t.Fatal(err)
			}
			expected := int64(calls)
			if mode == "page" {
				expected++
			}
			if position != expected {
				t.Fatal("wrong exact paging position", position, expected)
			}
			calls++
			return &dsproto.FetchResult{Rows: []map[string]interface{}{{"id": calls}}, DataInfo: map[string]interface{}{"more": calls == 1}}, nil
		})
		if err != nil || len(out.Rows) != 2 {
			t.Fatalf("explicit %s: %#v %v", mode, out, err)
		}
	}
	descriptor.Paging.DataInfoSelectors.HasMore = ""
	calls = 0
	if out, err = fetchCompleteResourceDataset(context.Background(), descriptor, nil, func() error { return nil }, func(*dsproto.DataSource, map[string]interface{}) (*dsproto.FetchResult, error) {
		calls++
		return &dsproto.FetchResult{Rows: []map[string]interface{}{{"id": 1}}}, nil
	}); out != nil || err == nil {
		t.Fatal("unknown normalized completeness admitted")
	}
	if calls != 1 {
		t.Fatal("continued without boolean completeness")
	}
}

func TestCompleteResourceMalformedDefinitionDoesNotDispatch(t *testing.T) {
	for _, descriptor := range []*dsproto.DataSource{nil, {ID: "missing", DataSource: types.DataSource{Paging: &types.PagingConfig{Enabled: true, Mode: "cursor"}}}, {Backend: &dsproto.Backend{Kind: dsproto.BackendMCPTool}}} {
		out, err := fetchCompleteResourceDataset(context.Background(), descriptor, nil, func() error { return nil }, func(*dsproto.DataSource, map[string]interface{}) (*dsproto.FetchResult, error) {
			t.Fatal("malformed definition dispatched")
			return nil, nil
		})
		if out != nil || err == nil {
			t.Fatal("malformed definition accepted")
		}
	}
}
func TestCompleteResourcePreservesLargeNumericAndObjectCursorWireValues(t *testing.T) {
	for _, token := range []interface{}{json.Number("9223372036854775807"), map[string]interface{}{"ordinal": json.Number("9223372036854775807"), "tag": "opaque"}} {
		descriptor := cursorReportDescriptor()
		calls := 0
		expected, _ := json.Marshal(token)
		out, err := fetchCompleteResourceDataset(context.Background(), descriptor, map[string]interface{}{"largeFilter": int64(9223372036854775807)}, func() error { return nil }, func(_ *dsproto.DataSource, args map[string]interface{}) (*dsproto.FetchResult, error) {
			calls++
			filter, _ := json.Marshal(args["largeFilter"])
			if string(filter) != "9223372036854775807" {
				t.Fatal("filter was rounded", string(filter))
			}
			if calls == 2 {
				actual, _ := json.Marshal(args["resume"])
				if !bytes.Equal(actual, expected) {
					t.Fatal("opaque cursor was rounded", string(actual))
				}
			}
			return &dsproto.FetchResult{Rows: []map[string]interface{}{{"id": calls}}, DataInfo: map[string]interface{}{"more": calls == 1, "next": token}}, nil
		})
		if err != nil || len(out.Rows) != 2 || calls != 2 {
			t.Fatal(out, err, calls)
		}
	}
}
func TestReportIntegerPositionRejectsLossyAndFractionalValues(t *testing.T) {
	for _, value := range []interface{}{1.25, float64(9223372036854775807), json.Number("1.25"), json.Number("9223372036854775808")} {
		if _, err := reportPagingInteger(value); err == nil {
			t.Fatal("non-exact position admitted", value)
		}
	}
	if value, err := reportPagingInteger(json.Number("1.0")); err != nil || value != 1 {
		t.Fatal("exact integer lexical form rejected", value, err)
	}
}

func TestViewerOffsetPreservesScopeAndPinnedInputs(t *testing.T) {
	descriptor := cursorReportDescriptor()
	descriptor.Paging.Mode = "offset"
	descriptor.Paging.Parameters.Page = "offset"
	args := map[string]interface{}{"advertiserId": 7, "campaignIds": []int{11}, "limit": 25, "offset": 0}
	if err := applyReportDatasetOffset(descriptor, args, 25); err != nil {
		t.Fatal(err)
	}
	if args["advertiserId"] != 7 || args["limit"] != 25 || args["offset"] != 25 {
		t.Fatalf("changed scope or limit: %#v", args)
	}
	ids := args["campaignIds"].([]int)
	if len(ids) != 1 || ids[0] != 11 {
		t.Fatal("changed campaign scope")
	}
	for _, offset := range []int{-1, maxResourceDatasetRows} {
		if applyReportDatasetOffset(descriptor, args, offset) == nil {
			t.Fatal("accepted out-of-bound offset")
		}
	}
	descriptor.Backend.Pinned = map[string]interface{}{"offset": 0}
	if applyReportDatasetOffset(descriptor, args, 50) == nil {
		t.Fatal("replaced pinned offset")
	}
	delete(descriptor.Backend.Pinned, "offset")
	descriptor.Paging.Mode = "cursor"
	if applyReportDatasetOffset(descriptor, args, 50) == nil {
		t.Fatal("treated cursor as offset")
	}
}
