# Native chart metric selection

A direct cartesian report chart can declare its approved metric choices and defaults:

```yaml
chartSpec:
  type: line
  xField: date
  yFields: [spend, impressions, ctr, conversionRate]
  metricSelection:
    primaryField: spend
    secondaryField: conversionRate
```

The canonical field catalog supplies labels and formats. The native shared Chart
component displays primary and secondary selectors and assigns independent axes.
The secondary choice can be cleared. It cannot select an undeclared field or use
the same field on both axes. There is no product-specific chart renderer.

These controls change presentation over fields already returned by an admitted
dataset. They do not change advertiser/campaign scope, attribution semantics,
query predicates, subscription, or an authorization decision. Changes to those
source parameters still require the normal host execution path. The optional
`onMetricSelectionChange` callback exposes the choice to consuming hosts.

Without requested presentation state, static print uses authored defaults with independently
scaled axes and matching fractional-percent formats. Null observations remain
unavailable and break lines instead of producing zero observations. `applyReportChartSelections` and the bounded Go `materializer.Present` entrypoint
apply temporary viewer choices only to opted-in chart blocks. The resource engine
uses the selected spec for both ReportFill and ReportPrint while retaining the
approved datasource requests. Unknown blocks, undeclared fields, and arbitrary
replacement metadata fail before dispatch.

Hosts may advertise `reportCapabilities.chartMetricSelection: true` only after
both their run and export adapters forward `chartMetricSelections` to this engine.
The native resource viewer then reruns selected metrics, forwards the same choices
to export, checks that the response retained them, and cancels stale exports.
Without that capability, changing a local chart blocks print/export until the
saved choice is restored. Consumer-adapter wiring and deployed interaction tests
remain required; the library tests do not establish that every host supports it.

Implementation evidence: field-contract/schema tests, native rendered selector
interaction tests, independent-axis SVG geometry tests, nullable line-gap tests,
and the existing bundled Goja spec/fill/print golden fixtures. Overview's native
YAML is authored with six approved metric choices. A deployed browser check,
responsive control check, and complete option/export interaction audit are still
required after publication. The source change is not a published report rollout.

## Horizontal bars

`horizontal_bar` supports primary metric selection on its single numeric x axis.
Declare `metricSelection: {primaryField: amount, secondaryField: ""}` with the
approved fields in `yFields`. The native control exposes only Primary metric;
each choice retains its declared label and format in chart, table and print.
The category axis remains horizontal-bar categories, and selected presentation
state follows the same run/export contract described above.

A nonempty `secondaryField` is rejected for this type. Horizontal bars do not
implement independent secondary value axes. Metric options must be unstacked
horizontal bars on the single value axis; combo series, right-axis options and
small multiples are rejected. Line, area, bar and combo charts retain their
existing primary and optional secondary controls.

The synthetic `reportHorizontalMetricSelection.test.js` fixture exercises three
formats, all primary choices, schema preservation, immutable datasource requests,
fill and canonical print. Native rendered checks cover orientation, numeric-axis
format changes, the primary-only control and selected-metric table output.
