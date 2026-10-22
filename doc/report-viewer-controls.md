# Report chart/table switching

Authors can control the Chart/Table switch independently of chart metric selection,
series selection and interaction actions. ReportDocument and ReportSpec accept:

```yaml
viewer:
  allowChartTableSwitch: false
```

An individual chart can override the report default:

```yaml
chartSpec:
  allowTableSwitch: true
```

Explicit booleans apply equally in preview and report presentation. When both
settings are absent, legacy presentation behavior is retained: preview shows the
switch and report presentation hides it. Setting false is distinct from omission.
The report editor exposes Legacy host default, Hide switch and Allow switch.

Disabling the switch while the table is selected restores the chart. This setting
changes presentation only; it grants no data or export permission. Metric controls
and the existing host permission boundary are unchanged. Persist the report-level
setting through reportDocumentViewer in builder state; compilation emits viewer
in ReportSpec. The shared Go materializer bundle must be rebuilt with compiler changes.
