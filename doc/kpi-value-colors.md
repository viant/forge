# Quantitative KPI sparkline colors

An optional `sparkline.valueColor` uses the plotted measure as its explicit
`field`, two to 64 six-digit hex `colors`, and a `domain` policy. Existing
sparklines retain their semantic theme colors when this option is absent.

- `extent` spans the complete series minimum and maximum.
- `fixed` requires explicit `min` and `max`.
- `diverging` requires `center`, an odd number of stops, and `fullRange`.
  False uses a symmetric extent; true independently spans each side of center.

Optional `reverse` reverses the stops; `opacity` is between zero and one.
A constant extent uses the middle color. Null observations remain gaps. The
producer must explicitly mark the series complete (`hasMore: false`); truncated
or offset pages are rejected so paging cannot silently change the color scale.
Screen and canonical print use the same colored line segments, including native
PDF export, without relying on SVG gradient support. Palette and domain choices
belong to authored reports; the framework does not infer a business palette.

When a KPI declares `runtime.requireCompleteDataset: true`, completeness also applies to its current and comparison sparkline datasets, even without quantitative colors. Each dependency must explicitly return `hasMore: false`, without truncation or a nonzero request offset. Legacy uncolored sparklines without this opt-in remain unchanged.
