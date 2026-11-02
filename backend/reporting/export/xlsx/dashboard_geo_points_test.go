package xlsx

import (
	"encoding/json"
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	reportprint "github.com/viant/forge/backend/reporting/print"
)

func TestDashboardCanonicalGeoPointsSVG(t *testing.T) {
	raw, err := os.ReadFile("../../../../doc/examples/sensor-point-geometry.json")
	require.NoError(t, err)
	var example struct {
		Block map[string]any
		Rows  []map[string]any
	}
	require.NoError(t, json.Unmarshal(raw, &example))
	artifacts := printExample(t, func(spec map[string]any, inputs map[string]json.RawMessage) {
		spec["blocks"] = []any{example.Block}
		spec["layoutIntent"] = map[string]any{"kind": "single", "blockOrder": []string{"sensors"}}
		inputs["primary"], err = json.Marshal(map[string]any{"rows": example.Rows})
		require.NoError(t, err)
	})
	printed, err := reportprint.DecodeJSON(artifacts.ReportPrint)
	require.NoError(t, err)
	canonical := ""
	for _, page := range printed.Pages {
		for _, element := range page.Elements {
			if strings.Contains(element.SVG, `<circle cx="296"`) {
				canonical = element.SVG
			}
		}
	}
	require.NotEmpty(t, canonical)
	require.Equal(t, 3, strings.Count(canonical, "<circle "))
	require.Contains(t, canonical, `r="16"`)
	require.Contains(t, canonical, `r="32"`)
	data, err := RenderDashboardWithPrint(artifacts.ReportFill, artifacts.ReportPrint)
	require.NoError(t, err)
	found := false
	for name, content := range workbookZIP(t, data) {
		if strings.HasSuffix(name, ".svg") && content == canonical {
			found = true
		}
	}
	require.True(t, found, "XLSX must retain the exact canonical point map SVG")
	if stem := os.Getenv("FORGE_POINT_PROOF"); stem != "" {
		require.NoError(t, os.WriteFile(stem+".xlsx", data, 0600))
	}
}

func TestDashboardCanonicalCategoricalGeoPointsSVG(t *testing.T) {
	raw, err := os.ReadFile("../../../../doc/examples/sensor-category-point-geometry.json")
	require.NoError(t, err)
	var example struct {
		Block map[string]any
		Rows  []map[string]any
	}
	require.NoError(t, json.Unmarshal(raw, &example))
	artifacts := printExample(t, func(spec map[string]any, inputs map[string]json.RawMessage) {
		spec["blocks"] = []any{example.Block}
		spec["layoutIntent"] = map[string]any{"kind": "single", "blockOrder": []string{"sensors"}}
		inputs["primary"], err = json.Marshal(map[string]any{"rows": example.Rows})
		require.NoError(t, err)
	})
	printed, err := reportprint.DecodeJSON(artifacts.ReportPrint)
	require.NoError(t, err)
	canonical := ""
	for _, page := range printed.Pages {
		for _, element := range page.Elements {
			if strings.Contains(element.SVG, `<circle cx="480"`) {
				canonical = element.SVG
			}
		}
	}
	require.Equal(t, 2, strings.Count(canonical, "<circle "))
	require.Contains(t, canonical, `<circle cx="480" cy="250" r="24" fill="#336699"`)
	require.Contains(t, canonical, `<circle cx="480" cy="250" r="24" fill="#cc6633"`)
	data, err := RenderDashboardWithPrint(artifacts.ReportFill, artifacts.ReportPrint)
	require.NoError(t, err)
	found := false
	for name, content := range workbookZIP(t, data) {
		if strings.HasSuffix(name, ".svg") && content == canonical {
			found = true
		}
	}
	require.True(t, found, "XLSX must embed the exact canonical categorical Point SVG")
}
