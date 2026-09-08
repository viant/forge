import React from 'react';
import {useSignals} from '@preact/signals-react/runtime';
import {metricSummaryValue} from './presentationModels.js';

export default function MetricSummary({container, context}) {
  useSignals();
  const spec = container.metricSummary || {};
  const dataContext = context.Context?.(spec.dataSourceRef || container.dataSourceRef) || context;
  const record = dataContext?.signals?.metrics?.value || dataContext?.signals?.form?.value || dataContext?.signals?.collection?.value?.[0] || {};
  return <div className="forge-metric-summary" data-forge-primitive="metricSummary" style={{'--forge-metric-columns': Math.max(1, Number(spec.columns) || 4)}}>{(spec.metrics || []).map((item) => {
    const metric = metricSummaryValue(record, item, dataContext);
    return <article key={item.id} className={`forge-metric-summary__item is-${metric.sentiment}`}><span>{item.label}</span><strong>{metric.display}</strong>{metric.comparison != null ? <small>{metric.direction === 'up' ? '▲' : metric.direction === 'down' ? '▼' : '—'} {metric.comparisonDisplay}</small> : null}</article>;
  })}</div>;
}
