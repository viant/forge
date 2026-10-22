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

The canonical static print artifact uses authored defaults with independently
scaled axes and matching fractional-percent formats. Null observations remain
unavailable and break lines instead of producing zero observations. Host wiring
that exports a viewer's temporary selection, rather than the authored defaults,
remains an explicit acceptance gap; do not claim viewer/export-state parity yet.

Implementation evidence: field-contract/schema tests, native rendered selector
interaction tests, independent-axis SVG geometry tests, nullable line-gap tests,
and the existing bundled Goja spec/fill/print golden fixtures. Overview's native
YAML is authored with six approved metric choices. A deployed browser check,
responsive control check, and complete option/export interaction audit are still
required after publication. The source change is not a published report rollout.
