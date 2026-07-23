package pdf

import (
	"testing"

	"github.com/stretchr/testify/require"
	reportprint "github.com/viant/forge/backend/reporting/print"
)

const tinyPNGBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF9sAAAAASUVORK5CYII="
const tinyWEBPBase64 = "UklGRrIBAABXRUJQVlA4TKUBAAAvSsAYAA8w//M///MfeJAkbXvaSG7m8Q3GfYSBJekwQztm/IcZlgwnmWImn2BK7aFmBtnVir6q//8VOkFE/xm4baTIu8c48ArEo6+B3zFKYln3pqClSCKX0begFTAXFOLXHSyF8cCNcZEG4OywuA4KVVfJCiArU7GAgJI8+lJP/OKMT/fBAjevg1cYB7YVkFuWga2lyPi5I0HFy5YTpWIHg0RZpkniRVW9odHAKOwosWuOGdxIyn2OvaCDvhg/we6TwadPBPbqBV58MsLmMJ8yZnOWk8SRz4N+QoyPL+MnamzMvcE1rHNEr91F9GKZPVUcS9w7PhhH36suB9qPeYb/oLk6cuTiJ0wOK3m5h1cKjW6EVZCYMK7dxcKCBdgP9HkKr9gkAO2P8GKZGWVdIAatQa+1IDpt6qyorVwdy01xdW8Jkfk6xjEXmVQQ+HQdFr6OKhIN34dXWq0+0qr6EJSCeeVLH9+gvGTLyqM65PQ44ihzlTXxQKjKbAvshXgir7Lil9w4L2bvMycmjQcqXaMCO6BlY28i+FOLzbfI1vEqxAhotocAAA=="

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
							Payload:  tinyPNGBase64,
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
	require.Len(t, plan.pages[0].operations, 3)
	require.Equal(t, "text", plan.pages[0].operations[0].kind)
	require.Equal(t, "svg", plan.pages[0].operations[1].kind)
	require.Equal(t, "image", plan.pages[0].operations[2].kind)
	require.NotNil(t, plan.pages[0].operations[1].svg)
	require.Len(t, plan.pages[0].operations[1].svg.operations, 3)
	require.Equal(t, "text", plan.pages[0].operations[1].svg.operations[0].kind)
	require.NotNil(t, plan.pages[0].operations[1].svg.operations[0].text)
	require.Equal(t, 46.0, plan.pages[0].operations[1].svg.operations[0].text.x)
	require.Equal(t, 128.0, plan.pages[0].operations[1].svg.operations[0].text.y)
	require.Equal(t, "path", plan.pages[0].operations[1].svg.operations[1].kind)
	require.NotNil(t, plan.pages[0].operations[1].svg.operations[1].path)
	require.Equal(t, "D", plan.pages[0].operations[1].svg.operations[1].path.style)
	require.Equal(t, "circle", plan.pages[0].operations[1].svg.operations[2].kind)
	require.NotNil(t, plan.pages[0].operations[1].svg.operations[2].circle)
	require.InDelta(t, 8.0, plan.pages[0].operations[1].svg.operations[2].circle.radiusX, 0.001)
	require.InDelta(t, 6.0, plan.pages[0].operations[1].svg.operations[2].circle.radiusY, 0.001)
	require.Empty(t, plan.diagnostics)
}

func TestBuildRenderPlan_ReportsInvalidImagePayloadDiagnostic(t *testing.T) {
	report := &reportprint.ReportPrint{
		Version:     1,
		Kind:        "reportPrint",
		SpecVersion: 1,
		SpecHash:    "fnv1a:test-spec",
		FillVersion: 1,
		FillHash:    "fnv1a:test-fill",
		Source: reportprint.Source{
			Kind:          "dashboard.reportBuilder",
			ContainerID:   "invalidImageBuilder",
			StateKey:      "invalidImageBuilder",
			DataSourceRef: "demoReportSource",
		},
		Title: "Invalid Image",
		PageGeometry: reportprint.PageGeometry{
			Width:  612,
			Height: 792,
		},
		Pages: []reportprint.Page{
			{
				Number: 1,
				Elements: []reportprint.Element{
					{
						ID:   "invalid_image",
						Kind: "image",
						Box:  reportprint.Box{X: 36, Y: 84, Width: 120, Height: 90},
						Image: &reportprint.Image{
							MimeType: "image/png",
							Payload:  "aGVsbG8=",
						},
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
	require.Equal(t, "invalidReportPrintImagePayload", plan.diagnostics[0].Code)
	require.Equal(t, "invalid_image", plan.diagnostics[0].ElementID)
	require.Contains(t, plan.diagnostics[0].Message, "could not validate image payload")
}

func TestBuildRenderPlan_CompilesImageWithMimeParameters(t *testing.T) {
	report := &reportprint.ReportPrint{
		Version:     1,
		Kind:        "reportPrint",
		SpecVersion: 1,
		SpecHash:    "fnv1a:test-spec",
		FillVersion: 1,
		FillHash:    "fnv1a:test-fill",
		Source: reportprint.Source{
			Kind:          "dashboard.reportBuilder",
			ContainerID:   "parameterizedImageBuilder",
			StateKey:      "parameterizedImageBuilder",
			DataSourceRef: "demoReportSource",
		},
		Title: "Parameterized Image",
		PageGeometry: reportprint.PageGeometry{
			Width:  612,
			Height: 792,
		},
		Pages: []reportprint.Page{
			{
				Number: 1,
				Elements: []reportprint.Element{
					{
						ID:   "image_with_params",
						Kind: "image",
						Box:  reportprint.Box{X: 36, Y: 84, Width: 120, Height: 90},
						Image: &reportprint.Image{
							MimeType: "image/png;base64",
							Payload:  tinyPNGBase64,
						},
					},
				},
			},
		},
	}

	plan := buildRenderPlan(buildDocumentProgram(report))
	require.NotNil(t, plan)
	require.Len(t, plan.pages, 1)
	require.Len(t, plan.pages[0].operations, 1)
	require.Equal(t, "image", plan.pages[0].operations[0].kind)
	require.Empty(t, plan.diagnostics)
}

func TestBuildRenderPlan_CompilesWebPImage(t *testing.T) {
	report := &reportprint.ReportPrint{
		Version:     1,
		Kind:        "reportPrint",
		SpecVersion: 1,
		SpecHash:    "fnv1a:test-spec",
		FillVersion: 1,
		FillHash:    "fnv1a:test-fill",
		Source: reportprint.Source{
			Kind:          "dashboard.reportBuilder",
			ContainerID:   "unsupportedImageBuilder",
			StateKey:      "unsupportedImageBuilder",
			DataSourceRef: "demoReportSource",
		},
		Title: "Unsupported Image",
		PageGeometry: reportprint.PageGeometry{
			Width:  612,
			Height: 792,
		},
		Pages: []reportprint.Page{
			{
				Number: 1,
				Elements: []reportprint.Element{
					{
						ID:   "webp_image",
						Kind: "image",
						Box:  reportprint.Box{X: 36, Y: 84, Width: 120, Height: 90},
						Image: &reportprint.Image{
							MimeType: "image/webp",
							Payload:  tinyWEBPBase64,
						},
					},
				},
			},
		},
	}

	plan := buildRenderPlan(buildDocumentProgram(report))
	require.NotNil(t, plan)
	require.Len(t, plan.pages, 1)
	require.Len(t, plan.pages[0].operations, 1)
	require.Equal(t, "image", plan.pages[0].operations[0].kind)
	require.Equal(t, "png", plan.pages[0].operations[0].image.imageType)
	require.NotEmpty(t, plan.pages[0].operations[0].image.payload)
	require.Empty(t, plan.diagnostics)
}

func TestBuildRenderPlan_ReportsUnsupportedImageMimeTypeDiagnostic(t *testing.T) {
	report := &reportprint.ReportPrint{
		Version:     1,
		Kind:        "reportPrint",
		SpecVersion: 1,
		SpecHash:    "fnv1a:test-spec",
		FillVersion: 1,
		FillHash:    "fnv1a:test-fill",
		Source: reportprint.Source{
			Kind:          "dashboard.reportBuilder",
			ContainerID:   "unsupportedImageBuilder",
			StateKey:      "unsupportedImageBuilder",
			DataSourceRef: "demoReportSource",
		},
		Title: "Unsupported Image",
		PageGeometry: reportprint.PageGeometry{
			Width:  612,
			Height: 792,
		},
		Pages: []reportprint.Page{
			{
				Number: 1,
				Elements: []reportprint.Element{
					{
						ID:   "unsupported_image",
						Kind: "image",
						Box:  reportprint.Box{X: 36, Y: 84, Width: 120, Height: 90},
						Image: &reportprint.Image{
							MimeType: "image/tiff",
							Payload:  tinyPNGBase64,
						},
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
	require.Equal(t, "unsupportedReportPrintImageMimeType", plan.diagnostics[0].Code)
	require.Equal(t, "unsupported_image", plan.diagnostics[0].ElementID)
	require.Contains(t, plan.diagnostics[0].Message, "image/tiff")
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

func TestBuildRenderPlan_FlattensSupportedSVGGroup(t *testing.T) {
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
						ID:   "grouped_svg",
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
	require.Len(t, plan.pages[0].operations, 1)
	require.Equal(t, "svg", plan.pages[0].operations[0].kind)
	require.NotNil(t, plan.pages[0].operations[0].svg)
	require.Len(t, plan.pages[0].operations[0].svg.operations, 1)
	require.Equal(t, "rect", plan.pages[0].operations[0].svg.operations[0].kind)
	require.NotNil(t, plan.pages[0].operations[0].svg.operations[0].rect)
	require.Equal(t, "#ff0000", plan.pages[0].operations[0].svg.operations[0].rect.fillColor)
	require.Empty(t, plan.diagnostics)
}

func TestBuildRenderPlan_CompilesTranslatedSVGGroup(t *testing.T) {
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
						ID:   "translated_svg",
						Kind: "svg",
						Box:  reportprint.Box{X: 36, Y: 84, Width: 220, Height: 80},
						SVG: `<svg viewBox="0 0 220 80" width="220" height="80">
						  <g transform="translate(10,10)"><rect x="10" y="10" width="20" height="20" /></g>
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
	require.Len(t, plan.pages[0].operations[0].svg.operations, 1)
	require.Equal(t, "rect", plan.pages[0].operations[0].svg.operations[0].kind)
	require.NotNil(t, plan.pages[0].operations[0].svg.operations[0].rect)
	require.InDelta(t, 56.0, plan.pages[0].operations[0].svg.operations[0].rect.box.X, 0.001)
	require.InDelta(t, 104.0, plan.pages[0].operations[0].svg.operations[0].rect.box.Y, 0.001)
	require.Empty(t, plan.diagnostics)
}

func TestBuildRenderPlan_CompilesTranslatedSVGPathGroup(t *testing.T) {
	report := &reportprint.ReportPrint{
		Version:     1,
		Kind:        "reportPrint",
		SpecVersion: 1,
		SpecHash:    "fnv1a:test-spec",
		FillVersion: 1,
		FillHash:    "fnv1a:test-fill",
		Source: reportprint.Source{
			Kind:          "dashboard.reportBuilder",
			ContainerID:   "translatedSvgPathBuilder",
			StateKey:      "translatedSvgPathBuilder",
			DataSourceRef: "demoReportSource",
		},
		Title: "Translated SVG Path",
		PageGeometry: reportprint.PageGeometry{
			Width:  612,
			Height: 792,
		},
		Pages: []reportprint.Page{
			{
				Number: 1,
				Elements: []reportprint.Element{
					{
						ID:   "translated_svg_path",
						Kind: "svg",
						Box:  reportprint.Box{X: 36, Y: 84, Width: 220, Height: 80},
						SVG: `<svg viewBox="0 0 220 80" width="220" height="80">
						  <g transform="translate(10,10)"><path d="M10,10 L30,10" fill="none" stroke="#ff0000" stroke-width="2" /></g>
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
	require.Len(t, plan.pages[0].operations[0].svg.operations, 1)
	require.Equal(t, "path", plan.pages[0].operations[0].svg.operations[0].kind)
	require.NotNil(t, plan.pages[0].operations[0].svg.operations[0].path)
	require.InDelta(t, 46.0, plan.pages[0].operations[0].svg.operations[0].path.originX, 0.001)
	require.InDelta(t, 94.0, plan.pages[0].operations[0].svg.operations[0].path.originY, 0.001)
	require.Equal(t, "#ff0000", plan.pages[0].operations[0].svg.operations[0].path.strokeColor)
	require.Equal(t, "D", plan.pages[0].operations[0].svg.operations[0].path.style)
	require.Empty(t, plan.diagnostics)
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
						  <g transform="scale(2)"><rect x="10" y="10" width="20" height="20" /></g>
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

func TestBuildRenderPlan_CompilesSupportedSVGStyleAttribute(t *testing.T) {
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
						ID:   "supported_svg_style",
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
	require.Len(t, plan.pages[0].operations, 1)
	require.Equal(t, "svg", plan.pages[0].operations[0].kind)
	require.NotNil(t, plan.pages[0].operations[0].svg)
	require.Len(t, plan.pages[0].operations[0].svg.operations, 1)
	require.Equal(t, "rect", plan.pages[0].operations[0].svg.operations[0].kind)
	require.NotNil(t, plan.pages[0].operations[0].svg.operations[0].rect)
	require.Equal(t, "#00ff00", plan.pages[0].operations[0].svg.operations[0].rect.fillColor)
	require.Empty(t, plan.diagnostics)
}

func TestBuildRenderPlan_CompilesSVGDashPattern(t *testing.T) {
	report := &reportprint.ReportPrint{
		Version:     1,
		Kind:        "reportPrint",
		SpecVersion: 1,
		SpecHash:    "fnv1a:test-spec",
		FillVersion: 1,
		FillHash:    "fnv1a:test-fill",
		Source: reportprint.Source{
			Kind:          "dashboard.reportBuilder",
			ContainerID:   "dashedSvgBuilder",
			StateKey:      "dashedSvgBuilder",
			DataSourceRef: "demoReportSource",
		},
		Title: "Dashed SVG",
		PageGeometry: reportprint.PageGeometry{
			Width:  612,
			Height: 792,
		},
		Pages: []reportprint.Page{
			{
				Number: 1,
				Elements: []reportprint.Element{
					{
						ID:   "dashed_svg",
						Kind: "svg",
						Box:  reportprint.Box{X: 36, Y: 84, Width: 220, Height: 80},
						SVG:  `<svg viewBox="0 0 220 80" width="220" height="80"><line x1="10" y1="10" x2="200" y2="10" stroke="#ff0000" stroke-width="2" stroke-dasharray="4 2" /></svg>`,
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
	require.Len(t, plan.pages[0].operations[0].svg.operations, 1)
	require.Equal(t, "line", plan.pages[0].operations[0].svg.operations[0].kind)
	require.NotNil(t, plan.pages[0].operations[0].svg.operations[0].line)
	require.Equal(t, []float64{4, 2}, plan.pages[0].operations[0].svg.operations[0].line.dashPattern)
	require.Empty(t, plan.diagnostics)
}

func TestBuildRenderPlan_CompilesFilledPolygonDonutSVGPaths(t *testing.T) {
	report := &reportprint.ReportPrint{
		Version:     1,
		Kind:        "reportPrint",
		SpecVersion: 1,
		SpecHash:    "fnv1a:test-spec",
		FillVersion: 1,
		FillHash:    "fnv1a:test-fill",
		Source: reportprint.Source{
			Kind:          "dashboard.reportBuilder",
			ContainerID:   "polygonDonutBuilder",
			StateKey:      "polygonDonutBuilder",
			DataSourceRef: "demoReportSource",
		},
		Title: "Polygon Donut SVG",
		PageGeometry: reportprint.PageGeometry{
			Width:  612,
			Height: 792,
		},
		Pages: []reportprint.Page{
			{
				Number: 1,
				Elements: []reportprint.Element{
					{
						ID:   "polygon_donut_svg",
						Kind: "svg",
						Box:  reportprint.Box{X: 36, Y: 84, Width: 220, Height: 120},
						SVG: `<svg viewBox="0 0 220 120" width="220" height="120">
						  <path d="M110,18 L132,24 L150,38 L160,58 L162,76 L152,92 L136,104 L118,110 L102,102 L94,86 L96,72 L106,58 L120,50 L130,40 L122,28 Z" fill="#137cbd" />
						  <path d="M94,86 L86,102 L68,110 L50,104 L34,92 L24,76 L26,58 L36,38 L54,24 L76,18 L98,22 L88,40 L74,48 L64,60 L62,74 L70,88 Z" fill="#f97316" />
						  <circle cx="110" cy="64" r="22" fill="#ffffff" />
						  <text x="110" y="116" text-anchor="middle" font-size="11" fill="#344054">Gender</text>
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
	require.Len(t, plan.pages[0].operations[0].svg.operations, 4)
	require.Equal(t, "path", plan.pages[0].operations[0].svg.operations[0].kind)
	require.Equal(t, "path", plan.pages[0].operations[0].svg.operations[1].kind)
	require.Equal(t, "circle", plan.pages[0].operations[0].svg.operations[2].kind)
	require.Equal(t, "text", plan.pages[0].operations[0].svg.operations[3].kind)
	require.Empty(t, plan.diagnostics)
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
						SVG:  `<svg viewBox="0 0 220 80" width="220" height="80"><rect x="40" y="10" width="20" height="20" style="transform:scale(2)" /></svg>`,
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

func TestBuildRenderPlan_CompilesSupportedSVGStyleTranslate(t *testing.T) {
	report := &reportprint.ReportPrint{
		Version:     1,
		Kind:        "reportPrint",
		SpecVersion: 1,
		SpecHash:    "fnv1a:test-spec",
		FillVersion: 1,
		FillHash:    "fnv1a:test-fill",
		Source: reportprint.Source{
			Kind:          "dashboard.reportBuilder",
			ContainerID:   "supportedSvgTranslateStyleBuilder",
			StateKey:      "supportedSvgTranslateStyleBuilder",
			DataSourceRef: "demoReportSource",
		},
		Title: "Supported SVG Style Translate",
		PageGeometry: reportprint.PageGeometry{
			Width:  612,
			Height: 792,
		},
		Pages: []reportprint.Page{
			{
				Number: 1,
				Elements: []reportprint.Element{
					{
						ID:   "supported_svg_translate_style",
						Kind: "svg",
						Box:  reportprint.Box{X: 36, Y: 84, Width: 220, Height: 80},
						SVG:  `<svg viewBox="0 0 220 80" width="220" height="80"><rect x="40" y="10" width="20" height="20" style="transform:translate(10px, 0);fill:#00ff00" /></svg>`,
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
	require.Len(t, plan.pages[0].operations[0].svg.operations, 1)
	require.Equal(t, "rect", plan.pages[0].operations[0].svg.operations[0].kind)
	require.NotNil(t, plan.pages[0].operations[0].svg.operations[0].rect)
	require.InDelta(t, 86.0, plan.pages[0].operations[0].svg.operations[0].rect.box.X, 0.001)
	require.InDelta(t, 94.0, plan.pages[0].operations[0].svg.operations[0].rect.box.Y, 0.001)
	require.Equal(t, "#00ff00", plan.pages[0].operations[0].svg.operations[0].rect.fillColor)
	require.Empty(t, plan.diagnostics)
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
						ID:              "cell_bar",
						Kind:            "tableCellDataBar",
						Box:             reportprint.Box{X: 140, Y: 174, Width: 48, Height: 8},
						RowKey:          "row_1",
						ColumnKey:       "spend",
						FillColor:       "#2563eb",
						BackgroundColor: "#dbeafe",
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
	require.Equal(t, "#2563eb", plan.pages[0].operations[4].dataBar.fillColor)
	require.Equal(t, "#dbeafe", plan.pages[0].operations[4].dataBar.backgroundColor)

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
