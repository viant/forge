package xlsx

import (
	"bytes"
	"encoding/json"
	"fmt"
	"hash/fnv"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	reportprint "github.com/viant/forge/backend/reporting/print"
	"github.com/xuri/excelize/v2"
)

// Independently authored equipment notes exercise the canonical print path,
// including the same text-only Markdown presentation used by PDF.
func TestDashboardCanonicalInfoPanel(t *testing.T) {
	artifacts := printExample(t, func(spec map[string]any, _ map[string]json.RawMessage) {
		spec["blocks"] = []any{
			map[string]any{"id": "notes", "kind": "infoPanelBlock", "title": "Equipment reading guide", "eyebrow": "Reading notes", "description": "Use these notes with the equipment log.", "body": "First paragraph explains the gauge.\n\n**Check** the *scale* before reading.\n- Record the reading.\n1. Confirm the unit.\n=SUM(A1:A2)\n+literal\n@literal\n" + strings.Repeat("Long equipment guidance wraps onto another line. ", 150) + "\nEnd equipment notes."},
			map[string]any{"id": "after", "kind": "infoPanelBlock", "title": "Final check", "body": "Keep the equipment log."},
		}
		spec["layoutIntent"] = map[string]any{"kind": "stack", "blockOrder": []string{"notes", "after"}}
	})
	data, err := RenderDashboardWithPrint(artifacts.ReportFill, artifacts.ReportPrint)
	require.NoError(t, err)
	book, err := excelize.OpenReader(bytes.NewReader(data))
	require.NoError(t, err)
	defer book.Close()
	printed, err := reportprint.DecodeJSON(artifacts.ReportPrint)
	require.NoError(t, err)
	require.Greater(t, len(printed.Pages), 1)
	found := map[string]bool{}
	for _, sheet := range book.GetSheetList() {
		rows, err := book.GetRows(sheet)
		require.NoError(t, err)
		for row, cells := range rows {
			for col, value := range cells {
				if value == "" {
					continue
				}
				found[value] = true
				require.NotContains(t, value, "Visual unavailable in Excel")
				cell, err := excelize.CoordinatesToCellName(col+1, row+1)
				require.NoError(t, err)
				formula, err := book.GetCellFormula(sheet, cell)
				require.NoError(t, err)
				require.Empty(t, formula)
			}
		}
	}
	for _, value := range []string{"Equipment reading guide", "Reading notes", "Use these notes with the equipment log.", "First paragraph explains the gauge.", "Check the scale before reading.", "Record the reading.", "Confirm the unit.", "=SUM(A1:A2)", "+literal", "@literal", "End equipment notes.", "Final check", "Keep the equipment log."} {
		require.True(t, found[value], "missing canonical infoPanel text %q", value)
	}
	for _, page := range printed.Pages {
		for _, element := range page.Elements {
			require.LessOrEqual(t, element.Box.Y+element.Box.Height, printed.PageGeometry.Height+1)
		}
	}
}

// Opaque producer requests are retained and hashed, never rewritten as a fixed
// query schema merely to render the same canonical print primitives.
func TestDatasourceDashboardCanonicalInfoPanel(t *testing.T) {
	artifacts := printExample(t, func(spec map[string]any, _ map[string]json.RawMessage) {
		spec["blocks"] = []any{map[string]any{"id": "guide", "kind": "infoPanelBlock", "title": "Equipment guide", "body": "Read the gauge."}}
		spec["layoutIntent"] = map[string]any{"kind": "stack", "blockOrder": []string{"guide"}}
	})
	var filled map[string]any
	require.NoError(t, json.Unmarshal(artifacts.ReportFill, &filled))
	hash := func(value []byte) string {
		h := fnv.New32a()
		_, _ = h.Write(value)
		return fmt.Sprintf("fnv1a:%08x", h.Sum32())
	}
	for _, value := range filled["datasets"].([]any) {
		dataset := value.(map[string]any)
		dataset["request"] = map[string]any{"device": "gauge", "filters": map[string]any{"floor": "north"}}
		request, err := json.Marshal(dataset["request"])
		require.NoError(t, err)
		dataset["provenance"].(map[string]any)["requestHash"] = hash(request)
	}
	raw, err := json.Marshal(filled)
	require.NoError(t, err)
	printed, err := reportprint.DecodeJSON(artifacts.ReportPrint)
	require.NoError(t, err)
	printed.FillHash = hash(raw)
	printRaw, err := json.Marshal(printed)
	require.NoError(t, err)
	_, err = RenderDashboardWithPrint(raw, printRaw)
	require.Error(t, err, "fixed query API must retain its request contract")
	data, err := RenderDatasourceDashboardWithPrint(raw, printRaw)
	require.NoError(t, err)
	book, err := excelize.OpenReader(bytes.NewReader(data))
	require.NoError(t, err)
	defer book.Close()
	var text []string
	for _, sheet := range book.GetSheetList() {
		rows, err := book.GetRows(sheet)
		require.NoError(t, err)
		for _, row := range rows {
			text = append(text, row...)
		}
	}
	require.Contains(t, text, "Equipment guide")
	require.Contains(t, text, "Read the gauge.")
	_, err = RenderDatasourceDashboardWithPrint(raw, artifacts.ReportPrint)
	require.ErrorContains(t, err, "does not match")
}

func TestDatasourceDashboardInfoPanelMissingText(t *testing.T) {
	artifacts := printExample(t, func(spec map[string]any, _ map[string]json.RawMessage) {
		spec["blocks"] = []any{map[string]any{"id": "guide", "kind": "infoPanelBlock", "title": "Equipment guide", "body": "Read the gauge."}}
		spec["layoutIntent"] = map[string]any{"kind": "stack", "blockOrder": []string{"guide"}}
	})
	for _, field := range []string{"title", "body"} {
		for _, value := range []any{nil, ""} {
			t.Run(fmt.Sprintf("%s/%v", field, value), func(t *testing.T) {
				var filled map[string]any
				require.NoError(t, json.Unmarshal(artifacts.ReportFill, &filled))
				filled["blocks"].([]any)[0].(map[string]any)["content"].(map[string]any)[field] = value
				raw, err := json.Marshal(filled)
				require.NoError(t, err)
				_, err = RenderDatasourceDashboardWithPrint(raw, artifacts.ReportPrint)
				require.ErrorContains(t, err, "content."+field+" is required")
			})
		}
	}
}
