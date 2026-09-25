package html

import (
	"bytes"
	"encoding/base64"
	"image"
	"image/color"
	"image/png"
	"math"
	"strings"
	"testing"

	"github.com/viant/forge/backend/reporting/fenced"
	reportprint "github.com/viant/forge/backend/reporting/print"
)

func sampleReport() *reportprint.ReportPrint {
	return &reportprint.ReportPrint{
		Version: 1, Kind: "reportPrint", SpecVersion: 1, SpecHash: "spec",
		FillVersion: 1, FillHash: "fill", Title: "Sales",
		Source:       reportprint.Source{Kind: "draft", ContainerID: "c", StateKey: "s", DataSourceRef: "d"},
		PageGeometry: reportprint.PageGeometry{Width: 612, Height: 792},
		Pages:        []reportprint.Page{{Number: 1}},
	}
}

func element(id, kind string) reportprint.Element {
	return reportprint.Element{ID: id, Kind: kind, Box: reportprint.Box{X: 10, Y: 20, Width: 100, Height: 30}}
}

func TestRenderPageStructureAndEscaping(t *testing.T) {
	r := sampleReport()
	r.Title = `Quarterly </title><script>alert(1)</script> & "results"`
	r.Pages[0].HeaderElements = []reportprint.Element{{ID: "header", Kind: "text", Text: "Header", Box: reportprint.Box{X: 1, Y: 2}}}
	body := element("body", "text")
	body.Text = `<img src=x onerror="alert(1)"> & value` + "\n" + `</text><script>alert(2)</script>`
	body.Color = `red" onload="alert(3)`
	r.Pages[0].Elements = []reportprint.Element{body}
	r.Pages[0].FooterElements = []reportprint.Element{{ID: "footer", Kind: "text", Text: "Footer", Box: reportprint.Box{X: 1, Y: 700}}}
	r.Pages = append(r.Pages, reportprint.Page{Number: 2})

	data, err := Render(r)
	if err != nil {
		t.Fatal(err)
	}
	got := string(data)
	for _, want := range []string{`<!doctype html>`, `<meta charset="utf-8">`, `viewBox="0 0 612 792"`, `aria-label="Page 2 of Quarterly &lt;/title&gt;&lt;script&gt;alert(1)&lt;/script&gt; &amp; &#34;results&#34;"`, `&lt;img src=x onerror=&#34;alert(1)&#34;&gt;`, `&lt;/text&gt;&lt;script&gt;alert(2)&lt;/script&gt;`, `fill="#101828"`, `@media print`} {
		if !strings.Contains(got, want) {
			t.Errorf("missing %q", want)
		}
	}
	if strings.Count(got, `<div class="page">`) != 2 || strings.Count(got, `</svg></div>`) != 2 {
		t.Fatalf("unexpected page count: %s", got)
	}
	if !(strings.Index(got, "Header") < strings.Index(got, "&lt;img") && strings.Index(got, "&lt;img") < strings.Index(got, "Footer")) {
		t.Fatal("header, body, footer order was lost")
	}
	if strings.Contains(got, "<script>") || strings.Contains(got, `onload="alert(3)`) {
		t.Fatal("unescaped active content")
	}
}

func TestRenderRepresentativeOperations(t *testing.T) {
	r := sampleReport()
	rect := element("rect", "rect")
	rect.FillColor, rect.StrokeColor, rect.Radius = "#fff", "navy", 4
	line := element("line", "line")
	line.StrokeColor = "red"
	cell := element("cell", "tableCellText")
	cell.RowKey, cell.ColumnKey, cell.Text = "r", "c", "centered"
	cell.Align, cell.FontWeight, cell.FontSize = "center", "bold", 12
	tone := element("tone", "tableCellTone")
	tone.RowKey, tone.ColumnKey, tone.Tone, tone.Label = "r", "c", "good", "OK"
	tone.BackgroundColor, tone.Text = "green", "Tone text"
	badge := element("badge", "tableCellBadge")
	badge.RowKey, badge.ColumnKey, badge.Label = "r", "c", "Badge text"
	badge.BackgroundColor = "blue"
	bar := element("bar", "tableCellDataBar")
	bar.RowKey, bar.ColumnKey, bar.FillColor = "r", "c", "red"
	bar.Value, bar.Min, bar.Max, bar.Text = 5, 0, 10, "50%"
	r.Pages[0].Elements = []reportprint.Element{rect, line, cell, tone, badge, bar}
	data, err := Render(r)
	if err != nil {
		t.Fatal(err)
	}
	got := string(data)
	for _, want := range []string{`rx="4" fill="#fff" stroke="navy"`, `<line x1="10" y1="20" x2="110" y2="50" stroke="red" stroke-width="0.5"`, `x="60" y="32"`, `>centered</text>`, `fill="green"`, `>Tone text</text>`, `>Badge text</text>`, `width="50" height="30" rx="0" fill="red"`, `>50%</text>`} {
		if !strings.Contains(got, want) {
			t.Errorf("missing operation output %q", want)
		}
	}
}

func TestRenderEmbeddedMedia(t *testing.T) {
	r := sampleReport()
	svg := element("chart", "svg")
	svg.SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><path d="M0 0 L20 20" stroke="red"/><rect x="1" y="1" width="4" height="4" style="fill:#00ff00;transform:translate(2px, 0)"/><text x="2" y="10">A &amp; B</text></svg>`
	bitmap := image.NewRGBA(image.Rect(0, 0, 1, 1))
	bitmap.Set(0, 0, color.RGBA{R: 255, A: 255})
	var buf bytes.Buffer
	if err := png.Encode(&buf, bitmap); err != nil {
		t.Fatal(err)
	}
	img := element("image", "image")
	img.Image = &reportprint.Image{MimeType: "image/png", Payload: base64.StdEncoding.EncodeToString(buf.Bytes())}
	r.Pages[0].Elements = []reportprint.Element{svg, img}
	data, err := Render(r)
	if err != nil {
		t.Fatal(err)
	}
	got := string(data)
	if !strings.Contains(got, `href="data:image/svg+xml;base64,`+base64.StdEncoding.EncodeToString([]byte(svg.SVG))+`"`) || !strings.Contains(got, `href="data:image/png;base64,`+img.Image.Payload+`"`) {
		t.Fatal("embedded media missing or changed")
	}
}

func TestRenderForgeCompiledChartPrint(t *testing.T) {
	compiled, err := fenced.Compile(&fenced.CompileRequest{ReportID: "operations", Fences: []fenced.Fence{
		{Kind: fenced.ReportFence, Payload: []byte(`{"version":1,"scope":"message","id":"operations","sequence":1,"mode":"start","grammar":"report-document-v1","title":"Operations","blocks":[{"id":"trend","kind":"chartBlock","datasetRef":"daily","title":"Trend","chartSpec":{"type":"line","xField":"day","yFields":["count"]}}]}`)},
		{Kind: fenced.DataFence, Payload: []byte(`{"version":2,"scope":"message","id":"daily","reportRef":"operations","sequence":2,"format":"json","mode":"replace","data":[{"day":"2026-09-23","count":3},{"day":"2026-09-24","count":5}]}`)},
		{Kind: fenced.ReportFence, Payload: []byte(`{"version":1,"scope":"message","id":"operations","sequence":3,"mode":"commit"}`)},
	}})
	if err != nil {
		t.Fatal(err)
	}
	printModel, err := reportprint.DecodeJSON(compiled.ReportPrint)
	if err != nil {
		t.Fatal(err)
	}
	output, err := Render(printModel)
	if err != nil || !strings.Contains(string(output), `data:image/svg+xml;base64,`) {
		t.Fatalf("Forge chart print did not render as safe HTML: %v, %s", err, output)
	}
}

func TestRenderRejectsInvalidModelsAndMedia(t *testing.T) {
	tests := []struct {
		name string
		make func() *reportprint.ReportPrint
		want string
	}{
		{"nil", func() *reportprint.ReportPrint { return nil }, "reportPrint is required"},
		{"invalid model", func() *reportprint.ReportPrint { r := sampleReport(); r.Version = 0; return r }, "version"},
		{"unknown kind", func() *reportprint.ReportPrint {
			r := sampleReport()
			r.Pages[0].Elements = []reportprint.Element{element("bad", "script")}
			return r
		}, "not supported"},
		{"nonfinite geometry", func() *reportprint.ReportPrint { r := sampleReport(); r.PageGeometry.Width = math.Inf(1); return r }, "non-finite"},
		{"nonfinite element", func() *reportprint.ReportPrint {
			r := sampleReport()
			e := element("bad", "rect")
			e.Radius = math.NaN()
			r.Pages[0].Elements = []reportprint.Element{e}
			return r
		}, "non-finite"},
		{"active SVG", func() *reportprint.ReportPrint {
			r := sampleReport()
			e := element("bad", "svg")
			e.SVG = `<svg><script>alert(1)</script></svg>`
			r.Pages[0].Elements = []reportprint.Element{e}
			return r
		}, "unsupported embedded SVG"},
		{"SVG event", func() *reportprint.ReportPrint {
			r := sampleReport()
			e := element("bad", "svg")
			e.SVG = `<svg><rect onload="alert(1)"/></svg>`
			r.Pages[0].Elements = []reportprint.Element{e}
			return r
		}, "unsupported embedded SVG attribute"},
		{"SVG external image", func() *reportprint.ReportPrint {
			r := sampleReport()
			e := element("bad", "svg")
			e.SVG = `<svg><image href="https://example.com/a.png"/></svg>`
			r.Pages[0].Elements = []reportprint.Element{e}
			return r
		}, "unsupported embedded SVG"},
		{"SVG style", func() *reportprint.ReportPrint {
			r := sampleReport()
			e := element("bad", "svg")
			e.SVG = `<svg><rect style="fill:url(https://example.com/a)"/></svg>`
			r.Pages[0].Elements = []reportprint.Element{e}
			return r
		}, "unsupported embedded SVG attribute"},
		{"SVG malformed", func() *reportprint.ReportPrint {
			r := sampleReport()
			e := element("bad", "svg")
			e.SVG = `<svg><rect></svg>`
			r.Pages[0].Elements = []reportprint.Element{e}
			return r
		}, "invalid embedded SVG"},
		{"image MIME", func() *reportprint.ReportPrint {
			r := sampleReport()
			e := element("bad", "image")
			e.Image = &reportprint.Image{MimeType: `image/svg+xml" onload="x`, Payload: "YWJj"}
			r.Pages[0].Elements = []reportprint.Element{e}
			return r
		}, "unsupported report image"},
		{"image base64", func() *reportprint.ReportPrint {
			r := sampleReport()
			e := element("bad", "image")
			e.Image = &reportprint.Image{MimeType: "image/png", Payload: `abc" onload="x`}
			r.Pages[0].Elements = []reportprint.Element{e}
			return r
		}, "invalid report image payload"},
		{"image content", func() *reportprint.ReportPrint {
			r := sampleReport()
			e := element("bad", "image")
			e.Image = &reportprint.Image{MimeType: "image/png", Payload: "YWJj"}
			r.Pages[0].Elements = []reportprint.Element{e}
			return r
		}, "does not match"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			data, err := Render(tt.make())
			if err == nil || !strings.Contains(err.Error(), tt.want) || data != nil {
				t.Fatalf("Render = %q, %v; want %q error", data, err, tt.want)
			}
		})
	}
}
