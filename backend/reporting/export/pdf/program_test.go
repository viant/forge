package pdf

import (
	"testing"

	"github.com/stretchr/testify/require"
	reportprint "github.com/viant/forge/backend/reporting/print"
)

func TestBuildDocumentProgram_ReturnsNilForNilReport(t *testing.T) {
	require.Nil(t, buildDocumentProgram(nil))
}

func TestBuildDocumentProgram_SortsElementsAndBookmarksDeterministically(t *testing.T) {
	zTop := 10
	zBottom := 1
	report := &reportprint.ReportPrint{
		Version:     1,
		Kind:        "reportPrint",
		SpecVersion: 1,
		SpecHash:    "fnv1a:test-spec",
		FillVersion: 1,
		FillHash:    "fnv1a:test-fill",
		Source: reportprint.Source{
			Kind:          "dashboard.reportBuilder",
			ContainerID:   "programBuilder",
			StateKey:      "programBuilder",
			DataSourceRef: "demoReportSource",
		},
		Title: "Program Builder",
		PageGeometry: reportprint.PageGeometry{
			Width:  612,
			Height: 792,
		},
		Pages: []reportprint.Page{
			{
				Number: 1,
				Elements: []reportprint.Element{
					{
						ID:     "highZ",
						Kind:   "text",
						Text:   "High Z",
						ZIndex: &zTop,
						Box:    reportprint.Box{X: 36, Y: 84, Width: 100, Height: 12},
					},
					{
						ID:     "lowZ",
						Kind:   "text",
						Text:   "Low Z",
						ZIndex: &zBottom,
						Box:    reportprint.Box{X: 36, Y: 100, Width: 100, Height: 12},
					},
					{
						ID:   "sameZOriginalOrder",
						Kind: "text",
						Text: "Same Z",
						Box:  reportprint.Box{X: 36, Y: 116, Width: 100, Height: 12},
					},
				},
			},
		},
		Bookmarks: []reportprint.Bookmark{
			{
				ID:         "bookmark.overview",
				Title:      "Overview",
				PageNumber: 1,
				Level:      0,
				Y:          60,
			},
			{
				ID:         "bookmark.summary",
				Title:      "Summary",
				PageNumber: 1,
				Level:      1,
				Y:          84,
			},
			{
				ID:         "bookmark.details",
				Title:      "Details",
				PageNumber: 1,
				Level:      2,
				Y:          116,
			},
		},
		Diagnostics: []reportprint.Diagnostic{
			{
				Code:      "providerMetadata",
				Severity:  "debug",
				Message:   "Top-level provider note.",
				ElementID: "highZ",
			},
			{
				Code:       "semanticGovernance",
				Severity:   "info",
				Message:    "Market is deprecated.",
				PageNumber: 1,
				ElementID:  "lowZ",
			},
		},
	}

	program := buildDocumentProgram(report)
	require.NotNil(t, program)
	require.Len(t, program.pages, 1)
	require.Len(t, program.diagnostics, 2)
	require.Equal(t, "$.diagnostics", program.diagnostics[0].Path)
	require.Equal(t, "warning", program.diagnostics[0].Severity)
	require.Equal(t, "$.pages[0]", program.diagnostics[1].Path)
	require.Equal(t, "info", program.diagnostics[1].Severity)

	page := program.pages[0]
	require.Equal(t, 1, page.number)
	require.Len(t, page.bookmarks, 3)
	require.Equal(t, "Overview", page.bookmarks[0].title)
	require.Equal(t, 0, page.bookmarks[0].level)
	require.Equal(t, "Summary", page.bookmarks[1].title)
	require.Equal(t, 0, page.bookmarks[1].level)
	require.Equal(t, "Details", page.bookmarks[2].title)
	require.Equal(t, 1, page.bookmarks[2].level)

	require.Len(t, page.elements, 3)
	require.Equal(t, "sameZOriginalOrder", page.elements[0].element.ID)
	require.Equal(t, "$.pages[0].elements[2]", page.elements[0].path)
	require.Equal(t, "lowZ", page.elements[1].element.ID)
	require.Equal(t, "$.pages[0].elements[1]", page.elements[1].path)
	require.Equal(t, "highZ", page.elements[2].element.ID)
	require.Equal(t, "$.pages[0].elements[0]", page.elements[2].path)
}
