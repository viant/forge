import React from 'react';
import {HTMLTable, NonIdealState} from '@blueprintjs/core';
import {resolveSelector} from '../../utils/selector.js';
import {diffHistoryRecords} from './workflowModels.js';

const display = (value) => value == null ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value);

export default function HistoryDiff({container, context}) {
  const spec = container.historyDiff || {};
  const dataContext = context.Context?.(spec.dataSourceRef || container.dataSourceRef) || context;
  const rows = dataContext?.signals?.collection?.value || [];
  const diffs = rows.flatMap((record, index) => diffHistoryRecords(resolveSelector(record, spec.beforeField || 'before') || {}, resolveSelector(record, spec.afterField || 'after') || {}, spec).map((diff) => ({...diff, record, index, recordLabel: spec.recordLabelField ? resolveSelector(record, spec.recordLabelField) : ''})));
  if (!diffs.length) return <NonIdealState icon="history" title="No changes" description="No field-level differences were found."/>;
  return (
    <div className="forge-history-diff" data-forge-primitive="historyDiff">
      <HTMLTable striped interactive={false} compact>
        <thead><tr>{spec.recordLabelField ? <th>Record</th> : null}<th>Field</th><th>Before</th><th>After</th></tr></thead>
        <tbody>{diffs.map((diff) => <tr key={`${diff.index}:${diff.field}`}>{spec.recordLabelField ? <td>{display(diff.recordLabel)}</td> : null}<th>{spec.fieldLabels?.[diff.field] || diff.field}</th><td>{display(diff.before)}</td><td>{display(diff.after)}</td></tr>)}</tbody>
      </HTMLTable>
    </div>
  );
}
