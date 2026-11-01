# Authored chart axis labels

Standard Cartesian report charts can declare optional axis titles in their
existing `chartSpec`. Both builder state and authored document `chartBlock`s use
the same normalizer and lowerer:

```json
{
  "type": "horizontal_bar",
  "xField": "item",
  "yFields": ["netChange"],
  "xAxis": { "label": "Item" },
  "yAxis": { "label": "Net quantity change" }
}
```

## Author contract

- `xAxis` and `yAxis` accept only a string `label`; they are not resolved axis
  objects. Authored `dataKey`, formats, domains, scripts, and other axis settings
  are not accepted by the ReportSpec/ReportFill schemas.
- The normalizer copies only nonblank string labels, trimming surrounding
  whitespace. Invalid values and blank labels are omitted, not coerced to text.
  Labels are plain text, not markup or executable metadata.
- The names describe data roles, not physical orientation: `xAxis` labels the
  category dimension; `yAxis` labels the primary numeric measure axis. A vertical
  chart displays the numeric title vertically; a horizontal bar displays it on
  the horizontal numeric axis. Do not swap the metadata when changing chart type.
- Without labels, existing behavior is unchanged: the category title comes from
  dimension metadata and the renderer retains its existing numeric-title fallback.
  A declared primary numeric title also survives native metric selection; selected
  formats and secondary-axis behavior remain unchanged.
- Lowering does not rename source fields, series titles, or values. Signed data
  does not influence the title. A quantity series can retain its own legend name
  while the axis has a different, sign-neutral title.
- An authored document's direct `chartModel` is still not an authoring override.
  Declare labels in `chartSpec`; lowering generates the resolved `chartModel`.
  Already-resolved ReportSpec models retain their existing axis contract.

## Native consumers and remaining scope

The shared builder produces `chartModel.xAxis.label` and
`chartModel.yAxis.label`, preserving generated keys and formats. Document lowering,
Go ReportSpec JSON round trips, and native materialization retain both labels.
The existing UI consumes the numeric title in vertical and horizontal orientation;
native XLSX charts export both category and value-axis titles.

No renderer or editor control is added. Existing print/SVG layout is unchanged:
vertical Cartesian SVGs display the category caption, but numeric-axis captions
and horizontal category captions are not newly drawn. Horizontal UI category
captions likewise retain their existing layout. Pie/donut, heatmap, category-range,
and scenario-specific rendering contracts are not extended by this change.

## Synthetic regression and file scope

[`examples/chart-axis-labels.json`](examples/chart-axis-labels.json) was independently
authored from constants. It contains mixed-sign and negative-only inventory changes,
not an application capture. JS checks builder/document lowering, direct/grouped
series, metric selection, safe-string normalization, schema rejection, unchanged
resolved data, and fill/print validity. Mounted jsdom tests check the real UI axis
orientation. Go checks the embedded lowerer, complete ReportSpec round trips,
materialized labels/rows, print validity, and both titles in native XLSX chart XML.

Exact implementation and test file scope:

- `src/components/dashboard/reportBuilderUtils.js`: normalize and lower titles.
- `src/components/chartMetricSelection.js`: retain an explicit primary title.
- `src/reporting/schema/reportSpecSchema.js`: optional label-only authored axes.
- `src/reporting/schema/reportFillSchema.js`: matching filled-chart schema.
- `backend/reporting/materializer/lowerer.bundle.js`: existing generated native bundle.
- `src/reporting/reportChartAxisLabels.test.js`: authoring and model regressions.
- `src/components/Chart.axisLabels.render.test.jsx`: mounted UI regression.
- `backend/reporting/materializer/chart_axis_labels_test.go`: native/export regression.
- `doc/examples/chart-axis-labels.json`: shared synthetic fixture.
- `package.json`: focused test command; no dependency changes.
- `vitest.runtime.config.mjs`: register the mounted regression.
- `doc/chart-axis-labels.md`: this author contract and review scope.

Validation commands (no browser, service, port, or container needed):

```sh
npm run test:chart-axis-labels
npm run build --prefix backend/reporting/materializer
go test ./backend/reporting/materializer -run '^TestAuthoredChartAxisLabels$' -count=1
```

Rebuild only the native materializer bundle when its shared source changes.
Consumers must use a Forge revision containing that regenerated bundle; no
per-report workaround or private dependency is required.
