# Per-category ranges and comparators

Use `chartSpec.type: "category-range"` when categories have different target
intervals or comparator values. Ordinary grouped bars retain scalar semantics;
global reference lines retain one value across the plot. This opt-in primitive
adds explicit category-local marks without changing those existing charts.

The [room example](examples/category-range.json) is independently invented for
this public framework. Its temperatures and target values are illustrative,
not measurements, standards or recommendations. The [separate signed-offset example](examples/category-range-signed.json) includes
observed deviations -3, 0 and 4, reversed and zero-length intervals, missing and null
endpoints, and a long label. No external dataset or private capture was used.

```json
{
  "type": "category-range",
  "categoryRange": {
    "categoryField": "room",
    "orientation": "horizontal",
    "series": [
      {"kind": "bar", "field": "measuredCelsius", "label": "Measured"},
      {"kind": "range", "startField": "targetMin", "endField": "targetMax", "label": "Target range"},
      {"kind": "marker", "field": "targetCelsius", "label": "Target"}
    ]
  }
}
```

Each series requires a label. Optional `color` is a six-digit hex value; optional
`format: {decimals: 1, suffix: " °C"}` controls visible values and accessible
names. Decimals must be an integer from 0 through 10. Horizontal is the default;
vertical uses the same value extent. Authored report normalization derives the
existing `xField` and `yFields` compatibility fields from these explicit fields.
Every numeric field participates in the canonical report projection. No field
names, second producer or dataset are discovered implicitly.

Rows retain source order. Categories must be unique, nonempty strings; producers
must aggregate duplicate categories explicitly. Numeric values must be finite
numbers, null or absent. Strings and non-finite numbers fail explicitly. The
common extent includes zero, scalar bars, markers and every present endpoint,
including a present endpoint whose counterpart is unavailable. A bar runs from
zero to its value. Ranges run between their two endpoints; reversed intervals
use the lesser endpoint for geometry while retaining their original order in
labels, selection metadata and raw exports. A zero-length range is a visible
line. A null or missing endpoint suppresses the interval; it never becomes zero.
Its exact unavailable endpoint remains identified in the value label. Independent
bars and markers remain available. All-zero/empty numeric extents use [-1, 1].

Series occupy adjacent lanes in each category on one shared scale; no interval
obscures a scalar bar. Legends identify each authored label and mark kind. Long
labels wrap. Narrow displays scroll within the chart. Every mark has a complete
accessible name and native title tooltip; Tab focuses marks, Enter/Space selects
available marks when a callback is supplied. Unavailable marks are informational.
Selection includes the original row, category field/value, declared series index
and key, and original range endpoint fields/values. Runtime actions use the
existing declared category metadata and authorization path.

Browser and canonical report print call the same SVG generator. Both display
exact formatted values and labels; print omits browser-only interaction attributes.
The existing Table/CSV surface retains all raw returned fields and rows, including
fields not plotted. CSV uses the existing visible-column preference. Existing
export selection semantics are unchanged. This is an explicitly authored contract;
the legacy chart builder has no new range editor, and native iOS rendering is not
extended by this change. Stacking, metric selection, global series dimensions and
small-multiple layout are not range options.

The shared ChartSpecimen contains the room example and a vertical signed example.
`npm run test:category-range` checks models, authored projection, schemas, fill,
print geometry and the actual Chart/selection/table surface. The existing workspace
browser check exercises keyboard focus, distinct comparators, both orientations
and narrow-screen scrolling. `go test ./backend/reporting/materializer -run
TestCategoryRangeMaterialization` checks the embedded materializer, raw endpoints,
actual PDF rendering, diagnostics and extracted category/legend/value text.

## Print pagination and validation failures

Canonical print splits categories into readable pages, retaining one value domain
for the entire chart. Each page repeats the value axis and the complete legend.
Horizontal pages fit as many complete categories as the height budget allows;
vertical pages also limit category columns to the available width. The first
page uses its remaining space, or begins a new page when a complete category
cannot fit there. SVG dimensions match the print box, so text remains 12 points
instead of being squeezed to fit a wider chart. Raw fill rows and exports remain
complete and retain source order.

If one category, its values and the complete legend cannot fit a full content
area at readable size, print returns `categoryRangePrintLayoutUnavailable` before
emitting a partial chart. Its diagnostic asks the author to shorten labels, split
series into authored blocks or choose a larger page. It does not clip or silently
shrink an oversized chart. Long text that fits is wrapped and kept complete.

Both ReportSpec and ReportFill require `categoryRange` when a chart spec or model
has type `category-range`. A malformed direct browser chart shows an actionable
block alert. Invalid source rows (duplicate categories, numeric strings or other
non-finite values) fail canonical report filling as a whole; the browser displays
a per-chart alert. No partially validated report is exported in that case.
