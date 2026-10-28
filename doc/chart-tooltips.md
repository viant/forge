# Authored chart details

`chartSpec.tooltip` (lowered to `chartModel.tooltip`) opts into ordered, explicit
detail fields. Existing charts retain their existing tooltip without this object.
There are no HTML fragments, expressions, templates, automatic field discovery,
or additional data-source calls.

```json
{"tooltip":{"fields":[
  {"field":"day","label":"Date","format":"date"},
  {"field":"passed","label":"Passed checks","format":"number","aggregate":"sum"},
  {"field":"medianMinutes","label":"Median duration","format":"number2","unit":"min"},
  {"field":"note","label":"Operator note"}
],"print":"details"}}
```

One to sixteen fields are allowed. `field` and `label` are required; their order
is preserved. `unit` is literal text appended to an available value. Formats are
`text` (default), `date` (strict YYYY-MM-DD civil date), `number`, `number2`,
`number5`, `currency`, `currency2`, `percent`, `percentFraction`,
`percentFraction2`, and `compactNumber`, using the shared chart formatting rules.
All strings, including units and source content, render as escaped text.

Every field is validated against the authored field catalog and included in
dimension/measure dependencies and request projection. Adding a dimension such
as a note can change producer grouping: the producer owns that schema and its
aggregation. Details use only the admitted returned rows for the selected
category and series, never an inferred source or a first-row fallback.

`aggregate` defaults to `unique`: one equal scalar across all contributing rows
is shown; different scalars (including a mix of missing/null/value) say
**Multiple values**. Numeric formats may declare `sum`, `avg`, `min`, or `max`;
these ignore null/missing values, retain zero, and reject nonnumeric/nonfinite
inputs. The displayed label names the aggregation and the header states the
source-row count. This aggregate describes the detail field; it does not change
the chart's own metric aggregation. In particular, existing grouped-series
charts retain their established plotted-value semantics. A median field should
normally use `unique`; averaging per-row medians does not calculate a median.

An absent field says **Missing field**, an explicit null says **No value**, and
zero is formatted as zero. Missing heatmap cells have zero source rows. No-data
states do not manufacture source values. Raw dataset rows remain in ReportFill;
resolved tooltip entries store the escaped-text-independent
display strings and states for deterministic print serialization.

## Interaction and export

The shared detail body is used by Recharts hover and keyboard tooltips. The
native **Inspect chart details** selector supplies a keyboard and touch path to
the same complete content without requiring precise pointer positioning. Its
selection is local inspection, separate from report filtering. Document chart
points, comparison bars, heatmap cells and range marks also update this inspector
on focus/hover. The popup is a bounded preview that does not intercept pointer
movement between marks. Its hint points to the inspector, which exposes the full
content without truncation. Invalid producer values show an actionable inline
alert without crashing the plotted chart. Small multiples share one inspector
and reuse the parent's detail entries while retaining pivoted plot values.

Supported families are line, area, bar, horizontal/funnel bar, composed/combo,
pie/donut, categorical heatmap and category range, including small multiples.
Pie/donut category policy is selected by appearance, never by tooltip presence:
document charts retain zero and negative categories for their existing zero/error
states and legends; legacy charts keep positive slices only. Browser, canonical
fill and detail entries use that same policy. Print preserves document-chart
zero and invalid-negative messages instead of showing a misleading positive-only
subset. Pie/donut details use the whole admitted category group; grouped Cartesian
details use the category-and-series group. Heatmap and range models retain their
existing explicit uniqueness requirements. Unknown chart types fail actionably.

`print: "details"` is the default. Essential details become visible text after
the chart, using the canonical report text wrapping and pagination path in
print, PDF and HTML. They are not hidden SVG annotations. `print: "omit"` is an
explicit producer declaration that these fields are supplementary and may be
absent from static output; do not select it for required explanatory meaning.
Print includes admitted detail groups, independently of transient browser legend
visibility. Missing/null/mixed states retain their meanings in exported text.
The chart's existing Table/CSV switch continues to export plotted values and
selected table columns; it does not silently reinterpret detail aggregations as
additional plotted measures. Report dataset CSV/XLSX columns retain their
existing authored-table contract. Use the canonical static detail representation
when the configured explanatory fields must accompany the chart.

## Synthetic example and checks

[`examples/chart-tooltips.json`](examples/chart-tooltips.json) contains independently
invented equipment checks by day, with passed/failed counts, median duration,
Unicode notes, zero, null, a missing note and literal markup-looking text. It
contains no real equipment records or private assets.

Run Vite and open `/chart-tooltip-preview.html` for the actual Chart renderer;
append `?grouped` for a synthetic two-equipment small-multiple comparison.
Run `npm run test:chart-tooltip` for model, schema, dependency/projection and
mounted renderer checks. `go test ./backend/reporting/materializer -run
TestChartTooltipMaterialization` covers canonical fill, PDF text and HTML escaping.
`npm run test:chart-tooltip-browser` checks actual hover, arrow-key inspection,
native selection and popup bounds at desktop and phone widths.

Template segments may also declare `input: {path, labels: [{value, label}]}`.
This display-only mapping reads the owning chart dataset's effective request
filters, with the same safe path and exact typed option identity as donut center
labels. Missing/unmapped values fail. Labels are escaped text, never executable
markup or templates. A direct Chart supplies `container.requestFilters`; native
report fill and runtime use the chart dataset's request. Center labels continue
to use their independently declared scalar dataset request.

When a declared input label has no numeric rows, a zero-row Dataset details entry
retains the selected label and explicit missing numeric fields. The browser
inspector and paginated print details preserve that entry. No data row or numeric
result is fabricated.
