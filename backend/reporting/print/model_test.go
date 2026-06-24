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

func TestDecodeJSON_AudiencePDFExportFixture(t *testing.T) {
	report := loadAudienceFixtureReportPrint(t)

	require.Equal(t, "reportPrint", report.Kind)
	require.Equal(t, "Capacity Audience Segment Index Q3", report.Title)
	require.Len(t, report.Pages, 2)
	require.Len(t, report.Bookmarks, 4)
	require.NotEmpty(t, report.Pages[0].Elements)
}

func TestDecodeJSON_AudienceLandscapeFixturePreservesStandaloneParity(t *testing.T) {
	report := loadAudienceLandscapeFixtureReportPrint(t)

	require.Equal(t, "reportPrint", report.Kind)
	require.Equal(t, "Capacity Audience Segment Index Q3", report.Title)
	require.Len(t, report.Pages, 2)
	require.Len(t, report.Bookmarks, 4)
	require.Equal(t, "bookmark.sharedFilters", report.Bookmarks[0].ID)
	require.Equal(t, "bookmark.comparisonTable", report.Bookmarks[len(report.Bookmarks)-1].ID)
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

func TestDecodeJSON_RejectsNegativeLineWidth(t *testing.T) {
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
	      "strokeWidth": -1
	    }],
	    "headerElements": [],
	    "footerElements": []
	  }],
	  "bookmarks": [],
	  "diagnostics": []
	}`))
	require.Error(t, err)
	require.Contains(t, err.Error(), "strokeWidth must be >= 0")
}

func TestDecodeJSON_RejectsUnsupportedElementKind(t *testing.T) {
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
	  "title": "Unsupported Element",
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
	      "id": "shape",
	      "kind": "polygon",
	      "box": {"x": 36, "y": 84, "width": 200, "height": 20}
	    }],
	    "headerElements": [],
	    "footerElements": []
	  }],
	  "bookmarks": [],
	  "diagnostics": []
	}`))
	require.Error(t, err)
	require.Contains(t, err.Error(), `kind "polygon" is not supported`)
}

func TestDecodeJSON_RejectsNegativeZIndex(t *testing.T) {
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
	  "title": "Negative ZIndex",
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
	      "zIndex": -1,
	      "text": "Hello"
	    }],
	    "headerElements": [],
	    "footerElements": []
	  }],
	  "bookmarks": [],
	  "diagnostics": []
	}`))
	require.Error(t, err)
	require.Contains(t, err.Error(), "zIndex must be >= 0")
}

func TestDecodeJSON_RejectsNegativePageGeometryMargin(t *testing.T) {
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
	  "title": "Negative Margin",
	  "pageGeometry": {
	    "width": 612,
	    "height": 792,
	    "marginTop": -1,
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
	      "text": "Hello"
	    }],
	    "headerElements": [],
	    "footerElements": []
	  }],
	  "bookmarks": [],
	  "diagnostics": []
	}`))
	require.Error(t, err)
	require.Contains(t, err.Error(), "pageGeometry margins, headerHeight, and footerHeight must be >= 0")
}

func TestDecodeJSON_RejectsInvalidBookmark(t *testing.T) {
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
	  "title": "Invalid Bookmark",
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
	      "text": "Hello"
	    }],
	    "headerElements": [],
	    "footerElements": []
	  }],
	  "bookmarks": [{"title": "Missing ID", "pageNumber": 1}],
	  "diagnostics": []
	}`))
	require.Error(t, err)
	require.Contains(t, err.Error(), "reportPrint.bookmarks[0].id is required")
}

func TestDecodeJSON_RejectsInvalidDiagnostic(t *testing.T) {
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
	  "title": "Invalid Diagnostic",
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
	      "text": "Hello"
	    }],
	    "headerElements": [],
	    "footerElements": []
	  }],
	  "bookmarks": [],
	  "diagnostics": [{"code": "missingSeverity", "message": "No severity"}]
	}`))
	require.Error(t, err)
	require.Contains(t, err.Error(), "reportPrint.diagnostics[0].severity is required")
}

func TestDecodeJSON_RejectsTableCellDataBarWithoutFillColor(t *testing.T) {
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
	  "title": "Missing Data Bar Fill",
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
	      "id": "bar",
	      "kind": "tableCellDataBar",
	      "box": {"x": 36, "y": 84, "width": 48, "height": 8},
	      "rowKey": "row-1",
	      "columnKey": "spend",
	      "value": 10,
	      "min": 0,
	      "max": 100
	    }],
	    "headerElements": [],
	    "footerElements": []
	  }],
	  "bookmarks": [],
	  "diagnostics": []
	}`))
	require.Error(t, err)
	require.Contains(t, err.Error(), "rowKey, columnKey, and fillColor are required")
}

func TestDecodeJSON_RejectsTableCellToneWithoutToneAndBackgroundColor(t *testing.T) {
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
	  "title": "Missing Tone",
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
	      "id": "tone",
	      "kind": "tableCellTone",
	      "box": {"x": 36, "y": 84, "width": 96, "height": 16},
	      "rowKey": "row-1",
	      "columnKey": "health",
	      "label": "Healthy"
	    }],
	    "headerElements": [],
	    "footerElements": []
	  }],
	  "bookmarks": [],
	  "diagnostics": []
	}`))
	require.Error(t, err)
	require.Contains(t, err.Error(), "rowKey, columnKey, tone, label, and backgroundColor are required")
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

func loadAudienceFixtureReportPrint(t *testing.T) *ReportPrint {
	t.Helper()
	return loadAudienceLandscapeFixtureReportPrint(t)
}

func loadAudienceLandscapeFixtureReportPrint(t *testing.T) *ReportPrint {
	t.Helper()

	_, filename, _, ok := runtime.Caller(0)
	require.True(t, ok)

	fixturePath := filepath.Join(
		filepath.Dir(filename),
		"..", "..", "..",
		"src", "reporting", "fixtures", "capacity-audience-landscape-report-print-fixture.v1.json",
	)
	data, err := os.ReadFile(fixturePath)
	require.NoError(t, err)

	report, err := DecodeJSON(data)
	require.NoError(t, err)
	return report
}
