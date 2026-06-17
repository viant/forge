package reportprint

import (
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestDecodeJSON_RawFixture(t *testing.T) {
	report := loadRawFixtureReportPrint(t)

	require.Equal(t, "reportPrint", report.Kind)
	require.Equal(t, "Performance Report", report.Title)
	require.Len(t, report.Pages, 1)
	require.NotEmpty(t, report.Pages[0].Elements)
	require.Equal(t, "text", report.Pages[0].Elements[0].Kind)
	require.Equal(t, "primaryTable__title_0", report.Pages[0].Elements[0].ID)
}

func TestDecodeJSON_RejectsUnknownField(t *testing.T) {
	_, err := DecodeJSON([]byte(`{
	  "version": 1,
	  "kind": "reportPrint",
	  "specVersion": 1,
	  "specHash": "fnv1a:test",
	  "fillVersion": 1,
	  "fillHash": "fnv1a:test",
	  "source": {
	    "kind": "dashboard.reportBuilder",
	    "containerId": "builder",
	    "stateKey": "builder",
	    "dataSourceRef": "demo"
	  },
	  "title": "Unknown Field",
	  "pageGeometry": {
	    "width": 612,
	    "height": 792,
	    "marginTop": 36,
	    "marginRight": 36,
	    "marginBottom": 36,
	    "marginLeft": 36,
	    "headerHeight": 36,
	    "footerHeight": 24
	  },
	  "pages": [{
	    "number": 1,
	    "elements": [{
	      "id": "title",
	      "kind": "text",
	      "box": {"x": 36, "y": 84, "width": 200, "height": 20},
	      "text": "Hello",
	      "unexpected": true
	    }],
	    "headerElements": [],
	    "footerElements": []
	  }],
	  "bookmarks": [],
	  "diagnostics": []
	}`))
	require.Error(t, err)
	require.Contains(t, err.Error(), "unknown field")
}

func TestDecodeJSON_RejectsZeroWidthLine(t *testing.T) {
	_, err := DecodeJSON([]byte(`{
	  "version": 1,
	  "kind": "reportPrint",
	  "specVersion": 1,
	  "specHash": "fnv1a:test",
	  "fillVersion": 1,
	  "fillHash": "fnv1a:test",
	  "source": {
	    "kind": "dashboard.reportBuilder",
	    "containerId": "builder",
	    "stateKey": "builder",
	    "dataSourceRef": "demo"
	  },
	  "title": "Invalid Line",
	  "pageGeometry": {
	    "width": 612,
	    "height": 792,
	    "marginTop": 36,
	    "marginRight": 36,
	    "marginBottom": 36,
	    "marginLeft": 36,
	    "headerHeight": 36,
	    "footerHeight": 24
	  },
	  "pages": [{
	    "number": 1,
	    "elements": [{
	      "id": "line",
	      "kind": "line",
	      "box": {"x": 36, "y": 84, "width": 200, "height": 0},
	      "strokeColor": "#d0d5dd",
	      "strokeWidth": 0
	    }],
	    "headerElements": [],
	    "footerElements": []
	  }],
	  "bookmarks": [],
	  "diagnostics": []
	}`))
	require.Error(t, err)
	require.Contains(t, err.Error(), "strokeWidth must be > 0")
}

func loadRawFixtureReportPrint(t *testing.T) *ReportPrint {
	t.Helper()

	_, filename, _, ok := runtime.Caller(0)
	require.True(t, ok)

	fixturePath := filepath.Join(
		filepath.Dir(filename),
		"..", "..", "..",
		"src", "reporting", "fixtures", "performance-report-print-fixtures.v1.json",
	)
	data, err := os.ReadFile(fixturePath)
	require.NoError(t, err)

	var fixture struct {
		Raw struct {
			ReportPrint json.RawMessage `json:"reportPrint"`
		} `json:"raw"`
	}
	require.NoError(t, json.Unmarshal(data, &fixture))

	report, err := DecodeJSON(fixture.Raw.ReportPrint)
	require.NoError(t, err)
	return report
}
