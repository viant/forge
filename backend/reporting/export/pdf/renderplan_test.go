package pdf

import (
	"testing"

	"github.com/stretchr/testify/require"
	reportprint "github.com/viant/forge/backend/reporting/print"
)

func TestBuildRenderPlan_ReturnsNilForNilProgram(t *testing.T) {
	require.Nil(t, buildRenderPlan(nil))
	require.Nil(t, buildRenderPlan(&documentProgram{}))
}

func TestBuildRenderPlan_CompilesSupportedOperationsAndDiagnostics(t *testing.T) {
	report := &reportprint.ReportPrint{
		Version:     1,
		Kind:        "reportPrint",
		SpecVersion: 1,
		SpecHash:    "fnv1a:test-spec",
		FillVersion: 1,
		FillHash:    "fnv1a:test-fill",
		Source: reportprint.Source{
			Kind:          "dashboard.reportBuilder",
			ContainerID:   "renderPlanBuilder",
			StateKey:      "renderPlanBuilder",
			DataSourceRef: "demoReportSource",
		},
		Title: "Render Plan",
		PageGeometry: reportprint.PageGeometry{
			Width:  612,
			Height: 792,
		},
		Pages: []reportprint.Page{
			{
				Number: 1,
				Elements: []reportprint.Element{
					{
						ID:   "headline",
						Kind: "text",
						Text: "Headline",
						Box:  reportprint.Box{X: 36, Y: 84, Width: 120, Height: 14},
					},
					{
						ID:   "geo",
						Kind: "svg",
						Box:  reportprint.Box{X: 36, Y: 108, Width: 220, Height: 80},
						SVG: `<svg viewBox="0 0 220 80" width="220" height="80">
						  <text x="10" y="20">Geo</text>
						  <path d="M20,20 L200,20" fill="none" stroke="#ff0000" />
						  <ellipse cx="20" cy="20" rx="8" ry="6" />
						</svg>`,
					},
					{
						ID:   "image",
						Kind: "image",
						Box:  reportprint.Box{X: 36, Y: 200, Width: 100, Height: 50},
						Image: &reportprint.Image{
							MimeType: "image/png",
							Payload:  "ignored",
						},
					},
				},
			},
		},
	}

	program := buildDocumentProgram(report)
	plan := buildRenderPlan(program)

	require.NotNil(t, plan)
	require.Len(t, plan.pages, 1)
	require.Len(t, plan.pages[0].operations, 2)
	require.Equal(t, "text", plan.pages[0].operations[0].kind)
	require.Equal(t, "svg", plan.pages[0].operations[1].kind)
	require.NotNil(t, plan.pages[0].operations[1].svg)
	require.Len(t, plan.pages[0].operations[1].svg.operations, 2)
	require.Equal(t, "text", plan.pages[0].operations[1].svg.operations[0].kind)
	require.NotNil(t, plan.pages[0].operations[1].svg.operations[0].text)
	require.Equal(t, 46.0, plan.pages[0].operations[1].svg.operations[0].text.x)
	require.Equal(t, 128.0, plan.pages[0].operations[1].svg.operations[0].text.y)
	require.Equal(t, "path", plan.pages[0].operations[1].svg.operations[1].kind)
	require.NotNil(t, plan.pages[0].operations[1].svg.operations[1].path)
	require.Equal(t, "D", plan.pages[0].operations[1].svg.operations[1].path.style)

	require.Len(t, plan.diagnostics, 2)
	require.Equal(t, "unsupportedReportPrintSVGChild", plan.diagnostics[0].Code)
	require.Equal(t, "$.pages[0].elements[1].svg[2]", plan.diagnostics[0].Path)
	require.Equal(t, "unsupportedReportPrintElement", plan.diagnostics[1].Code)
	require.Equal(t, "$.pages[0].elements[2]", plan.diagnostics[1].Path)
}

func TestBuildRenderPlan_ReportsInvalidSVGPathDuringPlanning(t *testing.T) {
	report := &reportprint.ReportPrint{
		Version:     1,
		Kind:        "reportPrint",
		SpecVersion: 1,
		SpecHash:    "fnv1a:test-spec",
		FillVersion: 1,
		FillHash:    "fnv1a:test-fill",
		Source: reportprint.Source{
			Kind:          "dashboard.reportBuilder",
			ContainerID:   "invalidPathBuilder",
			StateKey:      "invalidPathBuilder",
			DataSourceRef: "demoReportSource",
		},
		Title: "Invalid Path",
		PageGeometry: reportprint.PageGeometry{
			Width:  612,
			Height: 792,
		},
		Pages: []reportprint.Page{
			{
				Number: 1,
				Elements: []reportprint.Element{
					{
						ID:   "invalid_path_svg",
						Kind: "svg",
						Box:  reportprint.Box{X: 36, Y: 84, Width: 220, Height: 80},
						SVG:  `<svg viewBox="0 0 220 80" width="220" height="80"><path d="M20,20 L" fill="none" stroke="#ff0000" /></svg>`,
					},
				},
			},
		},
	}

	plan := buildRenderPlan(buildDocumentProgram(report))
	require.NotNil(t, plan)
	require.Len(t, plan.pages, 1)
	require.Empty(t, plan.pages[0].operations)
	require.Len(t, plan.diagnostics, 1)
	require.Equal(t, "invalidReportPrintSVGPath", plan.diagnostics[0].Code)
	require.Equal(t, "$.pages[0].elements[0].svg[0]", plan.diagnostics[0].Path)
}

func TestBuildRenderPlan_ReportsUnsupportedSVGGroupDiagnostic(t *testing.T) {
	report := &reportprint.ReportPrint{
		Version:     1,
		Kind:        "reportPrint",
		SpecVersion: 1,
		SpecHash:    "fnv1a:test-spec",
		FillVersion: 1,
		FillHash:    "fnv1a:test-fill",
		Source: reportprint.Source{
			Kind:          "dashboard.reportBuilder",
			ContainerID:   "unsupportedSvgBuilder",
			StateKey:      "unsupportedSvgBuilder",
			DataSourceRef: "demoReportSource",
		},
		Title: "Unsupported SVG",
		PageGeometry: reportprint.PageGeometry{
			Width:  612,
			Height: 792,
		},
		Pages: []reportprint.Page{
			{
				Number: 1,
				Elements: []reportprint.Element{
					{
						ID:   "unsupported_svg",
						Kind: "svg",
						Box:  reportprint.Box{X: 36, Y: 84, Width: 220, Height: 80},
						SVG: `<svg viewBox="0 0 220 80" width="220" height="80">
						  <g fill="#ff0000"><rect x="10" y="10" width="20" height="20" /></g>
						</svg>`,
					},
				},
			},
		},
	}

	plan := buildRenderPlan(buildDocumentProgram(report))
	require.NotNil(t, plan)
	require.Len(t, plan.pages, 1)
	require.Empty(t, plan.pages[0].operations)
	require.Len(t, plan.diagnostics, 1)
	require.Equal(t, "unsupportedReportPrintSVGGroup", plan.diagnostics[0].Code)
	require.Equal(t, "$.pages[0].elements[0].svg[0]", plan.diagnostics[0].Path)
}

func TestBuildRenderPlan_ReportsUnsupportedSVGStyleAttributeDiagnostic(t *testing.T) {
	report := &reportprint.ReportPrint{
		Version:     1,
		Kind:        "reportPrint",
		SpecVersion: 1,
		SpecHash:    "fnv1a:test-spec",
		FillVersion: 1,
		FillHash:    "fnv1a:test-fill",
		Source: reportprint.Source{
			Kind:          "dashboard.reportBuilder",
			ContainerID:   "unsupportedSvgStyleBuilder",
			StateKey:      "unsupportedSvgStyleBuilder",
			DataSourceRef: "demoReportSource",
		},
		Title: "Unsupported SVG Style",
		PageGeometry: reportprint.PageGeometry{
			Width:  612,
			Height: 792,
		},
		Pages: []reportprint.Page{
			{
				Number: 1,
				Elements: []reportprint.Element{
					{
						ID:   "unsupported_svg_style",
						Kind: "svg",
						Box:  reportprint.Box{X: 36, Y: 84, Width: 220, Height: 80},
						SVG:  `<svg viewBox="0 0 220 80" width="220" height="80"><rect x="40" y="10" width="20" height="20" style="fill:#00ff00" /></svg>`,
					},
				},
			},
		},
	}

	plan := buildRenderPlan(buildDocumentProgram(report))
	require.NotNil(t, plan)
	require.Len(t, plan.pages, 1)
	require.Empty(t, plan.pages[0].operations)
	require.Len(t, plan.diagnostics, 1)
	require.Equal(t, "unsupportedReportPrintSVGStyleAttribute", plan.diagnostics[0].Code)
	require.Equal(t, "$.pages[0].elements[0].svg[0]", plan.diagnostics[0].Path)
}

func TestBuildRenderPlan_CompilesPrimitivePaintOperations(t *testing.T) {
	report := &reportprint.ReportPrint{
		Version:     1,
		Kind:        "reportPrint",
		SpecVersion: 1,
		SpecHash:    "fnv1a:test-spec",
		FillVersion: 1,
		FillHash:    "fnv1a:test-fill",
		Source: reportprint.Source{
			Kind:          "dashboard.reportBuilder",
			ContainerID:   "primitiveBuilder",
			StateKey:      "primitiveBuilder",
			DataSourceRef: "demoReportSource",
		},
		Title: "Primitive Ops",
		PageGeometry: reportprint.PageGeometry{
			Width:  612,
			Height: 792,
		},
		Pages: []reportprint.Page{
			{
				Number: 1,
				Elements: []reportprint.Element{
					{
						ID:            "headline",
						Kind:          "text",
						Box:           reportprint.Box{X: 36, Y: 84, Width: 120, Height: 18},
						Text:          "Headline",
						FontSize:      12,
						FontWeight:    "600",
						Color:         "#101828",
						Align:         "center",
						VerticalAlign: "middle",
					},
					{
						ID:          "separator",
						Kind:        "line",
						Box:         reportprint.Box{X: 36, Y: 108, Width: 180, Height: 0},
						StrokeColor: "#d0d5dd",
						StrokeWidth: 2,
						StrokeStyle: "dashed",
					},
					{
						ID:          "card",
						Kind:        "rect",
						Box:         reportprint.Box{X: 36, Y: 120, Width: 80, Height: 40},
						FillColor:   "#f8fafc",
						StrokeColor: "#d0d5dd",
						StrokeWidth: 1,
						Radius:      8,
					},
					{
						ID:        "cell_value",
						Kind:      "tableCellText",
						Box:       reportprint.Box{X: 42, Y: 170, Width: 80, Height: 16},
						RowKey:    "row_1",
						ColumnKey: "status",
						Text:      "Healthy",
						Align:     "right",
					},
					{
						ID:        "cell_bar",
						Kind:      "tableCellDataBar",
						Box:       reportprint.Box{X: 140, Y: 174, Width: 48, Height: 8},
						RowKey:    "row_1",
						ColumnKey: "spend",
						FillColor: "#2563eb",
					},
					{
						ID:              "cell_badge",
						Kind:            "tableCellBadge",
						Box:             reportprint.Box{X: 200, Y: 168, Width: 76, Height: 18},
						RowKey:          "row_1",
						ColumnKey:       "health",
						Label:           "Healthy",
						BackgroundColor: "#ecfdf3",
						BorderColor:     "#abefc6",
						TextColor:       "#027a48",
					},
				},
			},
		},
	}

	plan := buildRenderPlan(buildDocumentProgram(report))
	require.NotNil(t, plan)
	require.Len(t, plan.pages, 1)
	require.Empty(t, plan.diagnostics)
	require.Len(t, plan.pages[0].operations, 6)

	require.Equal(t, "text", plan.pages[0].operations[0].kind)
	require.Equal(t, "Headline", plan.pages[0].operations[0].text.text)
	require.Equal(t, "center", plan.pages[0].operations[0].text.align)

	require.Equal(t, "line", plan.pages[0].operations[1].kind)
	require.Equal(t, 216.0, plan.pages[0].operations[1].line.x2)
	require.Equal(t, []float64{4, 2}, plan.pages[0].operations[1].line.dashPattern)

	require.Equal(t, "rect", plan.pages[0].operations[2].kind)
	require.Equal(t, 8.0, plan.pages[0].operations[2].rect.radius)
	require.Equal(t, "DF", plan.pages[0].operations[2].rect.style)

	require.Equal(t, "tableCellText", plan.pages[0].operations[3].kind)
	require.Equal(t, "middle", plan.pages[0].operations[3].text.verticalAlign)
	require.Equal(t, "Healthy", plan.pages[0].operations[3].text.text)

	require.Equal(t, "tableCellDataBar", plan.pages[0].operations[4].kind)
	require.Equal(t, 48.0, plan.pages[0].operations[4].dataBar.box.Width)

	require.Equal(t, "tableCellBadge", plan.pages[0].operations[5].kind)
	require.Equal(t, "Healthy", plan.pages[0].operations[5].labelPill.label)
	require.Equal(t, 1.0, plan.pages[0].operations[5].labelPill.borderWidth)
	require.Equal(t, 9.0, plan.pages[0].operations[5].labelPill.radius)
	require.Equal(t, "DF", plan.pages[0].operations[5].labelPill.style)
}

func TestBuildRenderPlan_CompilesLineRectCircleOperations(t *testing.T) {
	report := &reportprint.ReportPrint{
		Version:     1,
		Kind:        "reportPrint",
		SpecVersion: 1,
		SpecHash:    "fnv1a:test-spec",
		FillVersion: 1,
		FillHash:    "fnv1a:test-fill",
		Source: reportprint.Source{
			Kind:          "dashboard.reportBuilder",
			ContainerID:   "shapeBuilder",
			StateKey:      "shapeBuilder",
			DataSourceRef: "demoReportSource",
		},
		Title: "Shapes",
		PageGeometry: reportprint.PageGeometry{
			Width:  612,
			Height: 792,
		},
		Pages: []reportprint.Page{
			{
				Number: 1,
				Elements: []reportprint.Element{
					{
						ID:   "shape_svg",
						Kind: "svg",
						Box:  reportprint.Box{X: 36, Y: 84, Width: 220, Height: 80},
						SVG: `<svg viewBox="0 0 220 80" width="220" height="80">
						  <line x1="10" y1="10" x2="100" y2="10" stroke="#ff0000" stroke-width="2" />
						  <rect x="10" y="20" width="40" height="20" fill="#00ff00" />
						  <circle cx="80" cy="30" r="8" fill="#0000ff" />
						</svg>`,
					},
				},
			},
		},
	}

	plan := buildRenderPlan(buildDocumentProgram(report))
	require.NotNil(t, plan)
	require.Len(t, plan.pages, 1)
	require.Len(t, plan.pages[0].operations, 1)
	require.Equal(t, "svg", plan.pages[0].operations[0].kind)
	require.NotNil(t, plan.pages[0].operations[0].svg)
	require.Len(t, plan.pages[0].operations[0].svg.operations, 3)
	require.Equal(t, "line", plan.pages[0].operations[0].svg.operations[0].kind)
	require.NotNil(t, plan.pages[0].operations[0].svg.operations[0].line)
	require.Equal(t, 46.0, plan.pages[0].operations[0].svg.operations[0].line.x1)
	require.Equal(t, "rect", plan.pages[0].operations[0].svg.operations[1].kind)
	require.NotNil(t, plan.pages[0].operations[0].svg.operations[1].rect)
	require.Equal(t, 20.0, plan.pages[0].operations[0].svg.operations[1].rect.box.Height)
	require.Equal(t, "circle", plan.pages[0].operations[0].svg.operations[2].kind)
	require.NotNil(t, plan.pages[0].operations[0].svg.operations[2].circle)
	require.Equal(t, "F", plan.pages[0].operations[0].svg.operations[2].circle.style)
}
