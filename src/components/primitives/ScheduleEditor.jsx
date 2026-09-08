import React from 'react';
import {Button, Callout, HTMLTable, InputGroup} from '@blueprintjs/core';
import {validateSchedule} from './workflowModels.js';
import MutationCommand from './MutationCommand.jsx';
import {applyScheduleTimeZone, applyWallTimeDraft, instantToWallTime} from './scheduleTimeZone.js';

export default function ScheduleEditor({container, context}) {
  const spec = container.scheduleEditor || {};
  const dataContext = context.Context?.(spec.dataSourceRef || container.dataSourceRef) || context;
  const sourceRows = dataContext?.signals?.collection?.value || [];
  const [rows, setRows] = React.useState(sourceRows);
  React.useEffect(() => setRows(sourceRows.map((row) => ({...row}))), [sourceRows]);
  const startField = spec.startField || 'start';
  const endField = spec.endField || 'end';
  const timeZoneFor = (row) => row?.[spec.timeZoneField] || context?.resource?.timeZone || 'UTC';
  const validation = validateSchedule(rows, spec);
  const update = (index, field, value) => setRows((current) => current.map((row, rowIndex) => rowIndex === index ? {...row, [field]: value} : row));
  const updateWallTime = (index, row, field, value) => {
    setRows((current) => current.map((item, rowIndex) => rowIndex === index ? applyWallTimeDraft(item, field, value, timeZoneFor(row), spec.ambiguousTimePolicy || 'reject') : item));
  };
  const updateTimeZone = (index, value) => setRows((current) => current.map((item, rowIndex) => rowIndex === index ? applyScheduleTimeZone(item, spec.timeZoneField, value, [startField, endField], spec.ambiguousTimePolicy || 'reject') : item));
  const displayWallTime = (value, row) => {
    try { return instantToWallTime(value, timeZoneFor(row)); } catch (_) { return ''; }
  };
  const remove = (index) => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
  return (
    <div className="forge-schedule-editor" data-forge-primitive="scheduleEditor">
      <HTMLTable compact striped>
        <thead><tr><th>Start</th><th>End</th>{spec.timeZoneField ? <th>Time zone</th> : null}{spec.allowRemove !== false ? <th aria-label="Actions"/> : null}</tr></thead>
        <tbody>{rows.map((row, index) => <tr key={index}>
          <td><InputGroup type="datetime-local" value={row._scheduleDraft?.[startField] ?? displayWallTime(row[startField], row)} onChange={(event) => updateWallTime(index, row, startField, event.currentTarget.value)}/></td>
          <td><InputGroup type="datetime-local" value={row._scheduleDraft?.[endField] ?? displayWallTime(row[endField], row)} onChange={(event) => updateWallTime(index, row, endField, event.currentTarget.value)}/></td>
          {spec.timeZoneField ? <td><InputGroup value={row[spec.timeZoneField] || ''} onChange={(event) => updateTimeZone(index, event.currentTarget.value)}/></td> : null}
          {spec.allowRemove !== false ? <td><Button minimal icon="trash" aria-label="Remove schedule row" onClick={() => remove(index)}/></td> : null}
        </tr>)}</tbody>
      </HTMLTable>
      {!validation.valid ? <Callout intent="danger">{rows.flatMap((row) => Object.values(row._scheduleErrors || {})).find(Boolean) || 'Resolve invalid or overlapping schedule ranges before saving.'}</Callout> : null}
      <div className="forge-schedule-editor__actions">
        {spec.allowAdd !== false ? <Button icon="plus" onClick={() => setRows((current) => [...current, {[startField]: '', [endField]: ''}])}>Add period</Button> : null}
        {spec.mutation ? <MutationCommand command={{...spec.mutation, label: 'Save schedule', intent: 'primary'}} context={dataContext} extras={{rows: rows.map(({_scheduleErrors, _scheduleDraft, ...row}) => row)}} disabled={!validation.valid}/> : null}
      </div>
    </div>
  );
}
