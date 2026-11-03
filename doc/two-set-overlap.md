# Fixed two-set overlap charts

`chartSpec.type: two-set-overlap` is a typed, decorative two-circle chart for
three independently declared regions. Use `twoSetOverlap.leftOnly`,
`twoSetOverlap.intersection`, and `twoSetOverlap.rightOnly`, each with a `label`
and numeric `valueField`. Optional `secondaryField` binds a second scalar;
`format` and `secondaryFormat` reuse the native numeric display format contract
(`decimals`, `grouping`, `scale`, `prefix`, `suffix`, `negativeStyle`). Percentages
must be provided by the producer, with explicit scale/suffix when desired.

See [the independently invented device-monitoring example](examples/two-set-overlap.json)
for counts with authored percentages and checks per device. No total, percentage,
union, intersection or frequency is computed. Values may be signed scalars; the
circles have equal fixed radii unrelated to any value. Desktop regions show their bound labels and values directly. Narrow containers
use complete stacked value lanes connected to each region by labels 1/2/3. Long labels
and values wrap rather than shrinking. Source fields may be nested native chart
paths. Missing and explicit null fields retain distinct typed states and both say
Unavailable, while zero
says 0. Zero rows use No data available. As with native independent donut-center
data, more than one scalar row fails explicitly; producers own aggregation.

The existing report-document chart block, dataset bindings, ordinary report
filters, typed `chartSpec.tooltip`, native Table/CSV actions, and canonical fill
and print paths apply. The chart introduces no selection/cross-filter action.
There is an always-available assistive table with region labels and formatted
values. The Table action retains complete returned raw fields and precision.
Region graphics are keyboard-focusable with accessible descriptions and native
SVG titles; declared typed tooltips use the existing inspector and print details.

Canonical print flattens the same circle/text layout into PDF-supported SVG.
XLSX uses the existing canonical print picture and companion raw numeric source
worksheet, since Excel has no native overlap chart. It does not substitute a pie
or bar chart. The complete chart moves to a new print page when needed; if its
labels cannot fit a readable page, an existing diagnostic path reports the gap.
There is no arbitrary drawing schema, area-proportional geometry or inferred data.

`chartSpec` retains the common `xField` and `yFields` serialization shape;
normalization resolves these from the explicit overlap bindings. They are measure
fields, not a synthetic category. The native chart model carries `twoSetOverlap`
and its ordinary `series.valueKey`/`series.values` envelope. The typed fill kind is
`two-set-overlap`, preserving all raw source rows without aggregation. Existing
chart families retain their prior behavior. This is a two-set scalar primitive;
more sets, proportional area, arbitrary shapes, and custom interactions are
outside its contract.

Run `npm run test:two-set-overlap` and
`go test ./backend/reporting/export/xlsx -run TestTwoSetOverlapCanonicalExports`.
The maintained theme-preview ChartSpecimen includes both neutral examples.

## Labeled region lists

Opt into `twoSetOverlap.mode: "region-list"` and declare `rowLabelField` to
show every supplied row in each of the three regions. The default still accepts
at most one scalar row. Each region independently binds `valueField`, optional
`secondaryField` (for example a producer-authored percentage), and optional
`frequencyField` with `frequencyFormat`. These all use the existing numeric
format contract, including zero, null and missing states. No percentage,
frequency, total or aggregation is inferred.

Rows retain input order and identity. An authored “All devices” row and child
rows are all displayed; repeated labels remain separate rows. The neutral
`regionListChartSpec` and `regionListRows` example includes both cases. The label
field participates in dataset selection; numeric metric fields remain measures.

The same model and SVG supply the UI and canonical print. Wide containers use
three lanes linked to the fixed circles; narrow containers stack those lanes.
The accessible table includes each row's region, label and all declared values.
Row tooltip inspection retains row identity even when labels repeat. Print
continues complete source rows on subsequent pages, repeating the fixed diagram
and region headings. An individual row whose complete labels cannot fit a page
uses the existing explicit layout diagnostic. XLSX retains that print appearance
and the existing editable source-data sheets, preserving all source values.
