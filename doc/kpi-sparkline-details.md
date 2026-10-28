# KPI sparkline point details

An existing KPI `sparkline` can opt into accessible point details:

```json
{"datasetRef":"readings","categoryField":"date","valueField":"temperature","details":{"categoryLabel":"Date","categoryFormat":"date","valueLabel":"Temperature","valueFormat":"number2","unit":"°C","seriesLabel":"Current readings","comparisonLabel":"Earlier readings","print":"details"}}
```

Labels and formats are explicit producer metadata. `categoryFormat` is `text` or
`date`; date requires an exact valid civil `YYYY-MM-DD`, with no timezone or locale
inference. Numeric formats reuse the shared chart tooltip numeric-format set and
formatter. Units remain literal text. No HTML, expression execution, or automatic
field lookup is introduced.

Point details retain current and comparison categories from their own datasets.
Comparison periods align visually by position, but their detail dates are not
replaced with current-period dates. Null observations remain path gaps and have
no selectable numeric detail. Zero remains a real observation. Value-color and
opacity behavior stays with the existing sparkline implementation.

There is one keyboard focus stop per nonempty series. Arrows move among numeric
observations, Home/End select endpoints, and Escape dismisses the detail. Hover
and tap select observations; a shared Dismiss button supports touch dismissal.
The opt-in plot is 44px high and tapping anywhere chooses the nearest plotted
point. Detail text is an accessible status using shared caption typography and
wraps at narrow widths. No thousands-of-points tab sequence is created.

`print` is required: `details` exports every numeric point's identical resolved
text below the KPI using the canonical paginated print path; `omit` explicitly
omits those details. Existing specs without `details` retain their decorative
sparkline and print behavior. No comparison label is synthesized from current
labels when reading legacy fills.

`kpi-sparkline-details-preview.html` is a neutral example with invented temperature
readings, missing values, zero, comparison dates and a translucent value-color
scale. Tests: `npx vite-node src/reporting/kpiSparklineDetails.test.mjs` and
`npx vitest run --config vitest.runtime.config.mjs src/components/dashboard/KpiSparkline.details.render.test.jsx`.
