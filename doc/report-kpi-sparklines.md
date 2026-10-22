# Shared KPI sparklines

Optional KPI metadata adds an accessible compact trend using declared report
datasets. The same materialized series and geometry feed the Forge KPI component
and ReportPrint SVG. No application chart, provider lookup, or formula runs in
the component.

```yaml
kind: kpiBlock
id: impressions
valueField: impressions
datasetRef: summary
sparkline:
  datasetRef: daily
  comparisonDatasetRef: priorDaily # optional
  categoryField: advertiserDate
  valueField: impressions
  periodStartPath: filters.from   # optional pair, paths in each dataset request
  periodEndPath: filters.to
```

Source declarations and required fields survive ordinary dataset pruning and
projection. Each dataset remains subject to its usual server authorization,
subscription, date, and campaign gates. Hosts planning lazy section reads should
use `reportSectionDatasets` from `forge/reporting/section-datasets`. It derives
the existing conservative active-section plan using `getReportBlockDatasetRefs`
from `forge/reporting/dataset-refs`. Both use one closure for primary, comparison,
and sparkline dependencies. Ambiguous or duplicate block identities retain full
report validation, rather than omitting uncertain dependencies.

With period paths, civil dates are validated and expanded to a bounded daily
sequence (at most 4096 days). Missing dates and unavailable measurements remain
null. Duplicate or out-of-period dates fail; comparison periods must have equal
length. Without period paths, unique categories are ordered and displayed as an
observation sequence. No missing value becomes zero. Genuine zero observations
and isolated points remain visible. Current and comparison series share a scale;
current is solid and comparison is dashed. All-null series render no sparkline.

This is an opt-in shared primitive. Existing reports and golden artifacts remain
unchanged until their authored KPI blocks declare it. Publication, consumer
pinning, canonical AR authoring, live source reconciliation, and browser visual
acceptance are separate steps. A green model or server test is not visual sign-off.
