# Explicit donut-center content

Donut charts may opt into `center` on both the direct `Chart` model and authored
`chartSpec`. Existing donuts and pies retain their rendering when it is absent.
Center content is supported only for `type: "donut"`.

```json
{
  "type": "donut",
  "xField": "category",
  "yFields": ["items"],
  "center": {
    "label": "Catalogued items",
    "value": {"field": "items", "operation": "sum"},
    "format": "number"
  }
}
```

The independently invented [Library collection example](examples/donut-center.json)
has Fiction 240, Reference 160 and Science 100, with an explicitly requested sum
of 500. It also supplies a separate producer occupancy field of 72.5 on each row.
Binding that field with `operation: "scalar"` and `format: "percent"` displays
72.5%; it does not sum or derive the center from slice proportions. These are
synthetic examples, not observations or recommendations.

For a direct Chart, use the same `center` object alongside the existing series:

```jsx
<Chart container={{collection: rows, chart: {
  type: 'donut',
  series: {nameKey: 'category', valueKey: 'items'},
  center: {
    label: 'Occupancy rate',
    value: {field: 'occupancyRate', operation: 'scalar'},
    format: 'percent'
  }
}}} context={context}/>
```

The field belongs to the chart's already-declared dataset. Authored report
validation requires a measure field and includes it in the canonical request
projection even when it is not a slice measure. Producer-provided or existing
calculated measures can be bound by their declared field. There is no automatic
lookup of another dataset, guessed field name, business label or calculation.
A misspelled direct-Chart field reads as unavailable because direct charts have
no field catalog; authored reports reject undeclared fields during validation.

`scalar` requires every returned row to agree, including null values. It therefore
has no row-order dependency. Inconsistent repeated KPI values fail explicitly.
`sum` is an explicitly authored calculation over finite numbers; null/missing
values are skipped, and an all-null or empty dataset is unavailable. Numeric
strings, non-finite inputs and overflow fail explicitly. Zero remains zero.

The center always describes the current filtered dataset, before display limits
and slice selection. Toggling or clearing slices does not change the center.
Applying a data filter resolves it again from the filtered rows. This fixed
scope is included in the full accessible description and visible fallback text.
No selected-slices aggregation mode is implied.

Formats reuse the canonical report/KPI formatter: `number`, `number2`, `currency`,
`currency2`, `compact`, `percent`, `percentfraction`, `percentfraction2`, `plain`.
`percent` accepts percentage units (72.5 → 72.5%); `percentfraction` explicitly
accepts a ratio (0.725 → 72.5%). UI and PDF use the same formatted value.

The opt-in donut hole is enlarged within the existing outer ring. The center
uses chart semantic typography, fits text inside an inscribed rectangle, and
wraps the label at whitespace without splitting words. If a single complete word
cannot fit, the complete label moves to the visible fallback. It does not shrink
text to an unreadable size. If the value or
label cannot fit, the value remains in the hole when possible (otherwise an
ellipsis), and complete visible text appears below the chart. Canonical print
uses the same fit rule and paginated text details for that fallback. Accessible
names retain the complete value, label and scope. In the browser, zero slice
totals, no slices selected and absent slice data show a neutral ring with an
explicit state message. Canonical print includes `No slice data.` for empty slice
data; a zero-total print chart shows the neutral ring and center without a separate
zero-state message. Browser slice-selection state is not applied to canonical
print. An unavailable center displays `Unavailable`, not a fabricated zero.

The resolved center is carried in ReportFill as a numeric/null value, formatted
value, label and `scope: "dataset"`. Slice rows, selection metadata and the
existing Table/CSV export remain unchanged. The center is not an extra slice or
CSV row. Native iOS center rendering and a new legacy chart-dialog editor are
outside this opt-in contract.

`npm run test:donut-center` checks source/format semantics, canonical dependencies,
serialization, schemas, fill/print, actual Chart selection/filter behavior and
narrow/empty states. The shared chart specimen includes the collection, independent
occupancy and long-label examples. Workspace browser checks measure every center
text corner against its hole at desktop/phone sizes. The Go materializer test
renders real PDFs for sum, scalar, zero, null, empty and complete long-label output.
