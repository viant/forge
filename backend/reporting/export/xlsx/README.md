# XLSX report and dashboard exports

`Render(fill)` keeps the single-table `Report` worksheet contract.
`RenderDashboard(fill)` provides a data-driven dashboard when only a fill is
available. `RenderDashboardWithPrint(fillJSON, printJSON)` is the recommended
visual export: it consumes the same canonical `ReportPrint` as PDF together
with its original `ReportFill` JSON.

```go
workbook, err := xlsx.RenderDashboardWithPrint(artifacts.ReportFill, artifacts.ReportPrint)
```

The host must execute the admitted report with `DatasetFetchComplete`, retain
both artifacts, and avoid a current-page offset or single-table selector. These
renderers do not fetch data, establish authorization, expand the admitted dataset
closure, or rerun calculations. Existing host export handlers explicitly opt in.
The print-aware API checks the fill fingerprint, versions, spec fingerprint,
and source identity. Pass original artifact JSON, not a re-marshaled typed fill
that may omit print-only fields.

## Workbook organization

One workbook contains:

- `Dashboard`: authored-tab navigation, exported parameters/refinements, and
  instructions describing local interactions.
- One visual worksheet per authored tab/section, in authored order. Print-aware
  export places canonical text, KPI cards, tables, chart boxes, headers, footers,
  and page breaks on a fine native worksheet grid. Tabs without visible print
  content receive an explicit empty-state message.
  When a PDF page is shared by tabs, leading space belonging to another tab is
  removed while the retained elements keep their relative positions.
- A separate `Chart ...` worksheet for each chart or KPI trend. Native charts
  reference numeric cells on these sheets through quoted absolute formulas.
- `Table ...` sheets for print-aware resolved table values, including calculated
  values, hierarchy totals, and pivots. These retain numeric types independently
  of the visual print text.
- `Values`: typed primary and secondary KPI calculations, including values that
  do not exist as individual raw dataset fields.
- One `Data ...` worksheet for every admitted dataset, including unreferenced
  dependencies. It retains all supplied rows, fields in deterministic key order,
  and declared dataset filter/refinement/scope context.

Presentation row limits never remove raw dataset or chart-source rows. Incomplete
provenance, nonzero page offsets, truncation/error diagnostics, malformed
references, non-finite values, and Excel row/column/text limits fail the export
without returning a partial workbook. Long integer identifiers remain text to
avoid Excel precision loss. Untrusted strings are always text, never formulas.

Canonical print artifacts carry optional `visibleBlockIds` membership evaluated
by the shared runtime visibility and container traversal. Visual, chart, table,
and KPI supporting sheets follow that membership, including inactive ancestors;
all admitted raw `Data` worksheets remain complete. An explicit empty list means
no presentation blocks. Older unconditional artifacts remain supported. A
conditional fill-only export, or an older conditional print without membership,
returns an error requesting a freshly generated canonical print rather than
exporting inactive variants under incorrect labels. Hosts that generate matched
fill/print artifacts locally obtain this metadata from the same Forge runtime.

## PDF-to-XLSX feature matrix

| Canonical report feature | XLSX representation | Interaction / fidelity boundary |
| --- | --- | --- |
| Authored tabs, section order, responsive grouping | One visual worksheet per tab, canonical print coordinates | Native cells use a 3-point grid; Excel font metrics may differ slightly from PDF |
| KPI value, secondary/body text, tone, card border | Editable formatted cells and decorative rounded borders | KPI values are exported snapshots, not server calculations |
| KPI current/comparison sparklines | Native miniature line charts with separate typed sources | Source filters and edits update the trend; missing observations stay gaps |
| Column/bar, horizontal/funnel bar, pie/donut without center labels | Native Excel charts | Editable series, labels, colors, axes, legends, and source references |
| Line/area series | Current canonical PDF lowering uses monotone paths: exact SVG plus native editable companion on the source sheet | Excel smoothing differs from monotone PDF paths; companions use straight segments to avoid invented overshoot. Explicit straight-path print artifacts and fill-only exports use native charts |
| Mixed series and secondary axes | Native combination charts when print geometry is equivalent | Each series retains its type and axis; Excel controls tick placement |
| Stacked charts and scatter | Native Excel charts in fill-only export | Print-aware export follows the supplied canonical PDF representation |
| Chart labels and formats | Authored labels, palettes/category colors, axis titles, numeric formats | Excel lays out labels differently; colors are assigned at export, so manual reordering can require restyling |
| Paginated or limited charts | Native chart per canonical row slice | Optional `chartSource` metadata preserves exact ranges and shared bounds; full source rows remain available |
| Donut center total | Canonical donut SVG with the total inside the hole, plus native editable companion and source snapshot | Main visual preserves the dataset snapshot; local filters update the companion, not the static center |
| Tables, hierarchy, pivots, grouped headers | Canonical native visual cells plus typed resolved-table and raw-data sheets | Preserves exported expansion/pivot state; does not create Excel PivotTables or recompute hierarchy totals |
| Markdown, notes, panels, callouts, steppers, kanban, timeline, collections | Canonical lowered text and geometry | Same content and grouping as PDF; browser actions are not workbook actions |
| Table badges and tones | Rounded vector pills and foreground labels, plus typed table data | Canonical capsule geometry and exported visual state are retained; static decoration |
| Table data bars | Resolved rounded SVG bars and overlaid labels, plus separate typed values | Same absolute width, capsule radius and continuous 64-step gradient as PDF; static decoration |
| Heatmaps, category ranges, arbitrary geometry/maps | Exact self-contained canonical SVG visuals | Clearly static; source filters do not redraw them |
| Complex annotations or point styling without a supported native mapping | Canonical SVG plus retained typed source data | Static fallback is identified in the source sheet and visual-sheet guide |
| Embedded images | Validated embedded PNG/JPEG; other supported raster formats converted to PNG | Tiny rasters are replicated to at least 16 pixels per dimension for Excel compatibility, preserving alpha and pixel boundaries; print dimensions stay unchanged. No external image URLs or network access |
| Filter/refinement context | Canonical visible content plus workbook/context cells | Saved server context is distinct from local Excel filtering |
| Pagination and printing | Canonical page areas, headers/footers, manual breaks, Letter/A4 orientation | Visual print areas exclude interaction guides; data sheets have separate print areas |

Older print artifacts without chart-slice metadata retain faithful SVG for
paginated/limited charts and expose an editable full-source companion chart on
the chart-data sheet. They are never silently plotted against an assumed slice.
The fill-only API cannot reconstruct missing canonical composition or SVGs; it
shows explicit unsupported-visual messages and retains the data. Use the
print-aware API for the full matrix above. Compact display text follows PDF;
supporting numeric cells retain readable full values instead of fixed K/M units
that could become incorrect after editing.

## What filtering means

Native AutoFilter controls on a chart's source sheet hide/unhide its categories;
charts explicitly plot only visible source rows. Each chart has an isolated
source worksheet, so filtering one does not inadvertently filter another.
Editing an existing numeric source cell updates that native chart. Adding rows
requires extending its native series ranges. Explicit axis bounds remain fixed.
Filtering/sorting raw-data or resolved-table sheets explores those snapshots;
it does not rerun aggregation, pivots, hierarchy totals, or server queries.

This export does not create macros, external connections, credentials, slicers,
validation-driven server filters, or live refresh. Incoming canonical SVG is
restricted to inert, self-contained primitives using the HTML export validator.
Renderer-generated SVG uses only escaped text, validated dimensions, sanitized
colors and fixed markup; rounded gradients additionally use a fixed local
clipPath reference, never an input URL. Modern Excel with SVG support is required
for vector fallback visuals. Excelize obtains SVG dimensions through Go's global
image registry: importing this package registers a dimension-only `<svg` decoder.
`image.DecodeConfig` can then read SVG dimensions; `image.Decode` returns an
explicit unsupported-raster-decoding error rather than `image.ErrFormat`.

## Validation and public examples

Fixtures are independently authored synthetic framework examples. The paired
example includes multiple tabs, a curved chart with native companion and a native comparison sparkline, KPI,
markdown, typed tables, hierarchy/pivots, heatmap, ranges, and custom geometry.
Generated workbooks, PDFs, images, and inspection files remain untracked.

```sh
go test ./backend/reporting/export/... ./backend/reporting/fill ./backend/reporting/print ./backend/reporting/materializer
FORGE_XLSX_EXAMPLE=/tmp/dashboard.xlsx go test ./backend/reporting/export/xlsx -run TestDashboardVisualExample -count=1
FORGE_XLSX_PRINT_EXAMPLE=/tmp/visual-report go test ./backend/reporting/export/xlsx -run TestDashboardCanonicalPrintPair -count=1
node --test src/reporting/reportPrintChartSource.test.js src/reporting/reportPrintRowLimit.test.js
node scripts/generate-synthetic-report-fixtures.mjs --check
```

Tests inspect typed cells, full rows, chart formulas/relationships, native chart
groups and axes, point colors, print areas, image relationships, source slice
bounds, fingerprint mismatches, and text/formula safety. Excelize 2.10 and 2.11
are supported without changing the host dependency version. Native Excel
verification additionally exercises filters and source edits, inspects visual
pages, and checks print preview: ZIP structure alone is not interaction proof.
