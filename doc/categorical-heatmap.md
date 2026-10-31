# Categorical heatmaps

A heatmap compares one numeric measure across two categorical axes. The public
[occupancy fixture](examples/categorical-heatmap.json) shows **Workspace occupancy
by weekday and time slot**: rows Monday, Tuesday, Wednesday; columns Morning,
Afternoon, Evening; measure occupied seats. Every value is independently invented.
There is no customer data, external dataset, private source or producer discovery.
The same file contains an independent signed temperature-deviation example.

Author a normal `chartBlock` with `chartSpec.type: "heatmap"` and a `heatmap`
configuration. Use the same configuration on `chart.heatmap` for a direct Chart.
The normal dataset reference, filters, selection bindings and exports apply.

```json
{
  "type": "heatmap",
  "heatmap": {
    "rowField": "weekday",
    "columnField": "slot",
    "valueField": "occupiedSeats",
    "rowCategories": ["Monday", "Tuesday", "Wednesday"],
    "columnCategories": ["Morning", "Afternoon", "Evening"],
    "colorScale": {
      "type": "sequential",
      "domain": [0, 12],
      "colors": ["#eff3ff", "#08519c"]
    },
    "noData": {"color": "#eeeeee", "label": "No data"},
    "cellLabels": true,
    "legend": true
  }
}
```

The three field names must be distinct. Category arrays contain unique nonempty
strings and define the complete order, including absent coordinates. Each source
row must have both categories in those arrays. A duplicate pair is rejected;
aggregate explicitly upstream to the intended grain. Canonical fill deliberately
rejects the whole report for invalid heatmap rows (duplicates, undeclared
coordinates or invalid numeric values), so an export cannot silently omit failed
evidence. The interactive Chart displays the same validation error inline in its
block. Correct the producer data and rerun; other blocks are not exported from an
invalid fill. Forge does not guess an
aggregation or silently overwrite data. Values must be finite numbers, null or
absent. Zero is measured data; null and absent cells receive the no-data treatment.
The model preserves the distinction between explicit null and absent coordinates.
Filtering removes source records but keeps the declared axes. Fixed color domains
remain unchanged.

A sequential scale has two increasing finite domain stops and two six-digit hex
colors. A diverging scale has three stops and three colors; the middle stop is
its explicit neutral value (for example `[-5,0,5]`). Colors interpolate linearly
in RGB between stops and clamp outside the domain. The legend shows each declared stop and
the no-data key. `cellLabels` and `legend` default to true; `noData` defaults to
the values above. Labels show exact numeric values with no inferred units.

For a sequential scale, opt in to `"domain": "auto"` to derive low/high stops from
the finite values in the complete resolved matrix. For example, use
`{"type":"sequential","domain":"auto","colors":["#eff3ff","#08519c"]}`
to compare occupancy across the current filters. Null and absent cells do not
affect the range; zero does. A constant matrix uses the palette midpoint and one
legend value without inventing a wider numeric range. An empty/all-null matrix
shows only the no-data key. Filtering may change an automatic domain; it never
changes the declared colors. Diverging scales still require explicit stops so
their neutral value is not inferred. Every print tile uses the full matrix's
resolved domain, matching the interactive view rather than rescaling per tile.

Heatmaps reject the generic `seriesField`, `seriesOptions`, `metricSelection`,
`layout` and `stacked` options; their own fields, scale and ordered categories
define the matrix. Legacy null values for those options count as absent.

The compiler retains the configuration and derives legacy `xField`/`yFields`
for existing report contracts. Both category fields participate in projection.
Canonical fill uses `resolvedChart.kind: "heatmap"`, with all source rows and
`seriesKeys: [valueField]`. It does not create synthetic rows in raw exports.
The shared matrix/color/SVG implementation supplies browser and ReportPrint/PDF
marks, category order, labels and no-data semantics. The normal Chart Table/CSV
view retains all raw columns, including additional evidence fields.

The matrix is named with its block title and has one roving keyboard tab stop.
Cells have complete accessible descriptions and visible keyboard focus. Arrow
keys move between coordinates and stay on the current cell at an axis edge; Home/End move to the first/last cell. Enter/Space
select a measured cell when a selection handler exists. Null/absent cells remain
readable and do not select. Selection includes the original row and selectionRows,
`rowDataKey`, `rowValue`, `columnDataKey`, `columnValue`, plus the existing
`xDataKey`/`xValue` (column) and `seriesKey` (measure). The browser uses the shared
small typography role and a local horizontal scroller with at least 44px cell
height. Long axis labels wrap without truncation.

The actual ChartSpecimen in `theme-preview.html` includes both synthetic examples
and populated, empty, loading, error, zero, sparse and signed states.
Run `npm run test:heatmap`, the existing workspace-theme browser test, and the Go
report materializer tests. These cover model semantics, schema round trips,
authored lowering, raw evidence, selection and shared print geometry.

Limits: this is an authored chart primitive, not a new visual builder dialog.
Category keys are strings; numeric/date keys must be explicitly converted by the
producer. There is no automatic aggregation, per-cell formatting, axis discovery,
zoom or native iOS renderer in this change. Large matrices scroll in the browser.
Print tiles rows and columns across pages at a fixed readable 12pt size, repeating
the category labels and complete color/no-data legend on each tile. It preserves
the declared color domain and every coordinate. A short first-page remainder
moves the next tile to a fresh page; labels too tall for a complete page produce
an explicit layout diagnostic instead of clipping or shrinking. Chart rowLimit does not truncate a
matrix. The legacy fenced-report fallback is separate from canonical authored
ReportSpec/Fill/Print and is not extended here.

The compact synthetic example adds seven short categories and four segments with
six-digit numeric labels. Browser width follows the available chart width and the
measured complete wrapped text, with a minimum 44px cell width. Short labels do
not reserve a fixed 156px per column or a fixed 164px row gutter. Longer content
retains local horizontal scrolling instead of shrinking or dropping labels. The
same portable text measurement and readable column widths determine print tiles;
page boundaries repeat axes and legends without changing values or the scale.
