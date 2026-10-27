# XLSX renderers

`Render(fill)` preserves the existing single-table workbook contract, including
its `Report` worksheet and display-cell behavior.

`RenderDashboard(fill)` returns one workbook containing a `Dashboard` worksheet
and data worksheets in authored tab/section order. It uses only the public
`reportfill.ReportFill` contract and can be called by any host.

The host must first execute the admitted report with `DatasetFetchComplete`,
without a current-page dataset offset or single-table selector. Decode the
result's `ReportFill` with `reportfill.DecodeJSON`, then pass that model to
`RenderDashboard`. This API does not fetch data, establish access, or expand the
admitted dataset closure. Existing export handlers must explicitly opt in.

Data worksheets contain resolved tables, chart data, KPI values, and complete
raw tables for the datasets declared in the supplied fill. Raw dataset fields
are ordered by key. Dataset tables preserve rows hidden by presentation row
limits. Unreferenced datasets already declared in the fill receive their own
data worksheet. Hosts should supply only the admitted closure intended for
export. Incomplete provenance, truncation diagnostics, error diagnostics, and
invalid references fail the render without returning a partial workbook.

Numeric cells use raw values and spreadsheet number formats, so formatted display
strings do not round the source measurements. Strings are always written as text;
long integer identifiers use text to avoid Excel's numeric precision limit.

The dashboard contains native Excel charts for line, bar/column, horizontal bar,
stacked bar, area, stacked area, pie, donut, and scatter types. Category charts
accept canonical JS fill rows and authored inline-compiler rows; grouped charts
accept wide resolved rows and unambiguous long rows. Other chart types retain
their data tables. Native charts use Excel styling; browser layout, dual axes,
per-series mixed chart types, maps, and other visual decoration are not reproduced.
The dashboard workbook renderer is additive and does not change current host
PDF, CSV, or selected-table XLSX exports.

All dashboard regression fixtures are independent synthetic values assembled
in `dashboard_test.go`. Tests inspect workbook sheets, typed cells, preserved
source rows, formula safety, and chart/drawing relationship XML.
