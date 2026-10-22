# KPI comparison binding

Native KPI blocks can bind their secondary value to another declared dataset:

```yaml
kind: kpiBlock
id: revenue
datasetRef: currentSummary
valueField: revenue
valueFormat: currency2
secondaryDatasetRef: priorSummary
secondaryField: revenue
secondaryCalculation: relativeChange
secondaryLabel: Change vs prior period
secondaryFormat: percentFraction
secondaryTrend: true
```

`secondaryCalculation` supports `value` (the default), `difference` (current minus
secondary), and `relativeChange` ((current minus secondary) divided by secondary).
Missing values, blank or nonnumeric input, nonfinite arithmetic, and a zero
relative-change denominator produce null. A genuine zero current value remains
zero and can produce −100%. No JavaScript expression or formatter callback runs.

Secondary references participate in published-dataset closure and field
projection. The dataset must be declared, admitted, and executed by the normal
host pipeline. The materializer does not fetch data or infer access. Comparison
bindings read the first secondary row and are intended for aggregate summaries,
not implicit joins between detail rows. Use explicit matching/grain logic before
comparing detail categories.

The existing KPI renderer displays the materialized secondary value and trend;
the existing print materializer consumes the same value. The policy introduces
no application-specific renderer. Tests cover nullable arithmetic, dependency
retention, projection, both schemas, fill/print agreement, and bundled Goja
lowering/materialization. The canonical Overview YAML is authored to use this
binding with its equal-length prior-period dataset. Publication and live
combined-execution verification remain pending.
