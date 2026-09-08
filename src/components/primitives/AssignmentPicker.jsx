import React from 'react';
import {Button, Checkbox} from '@blueprintjs/core';
import {useSignals} from '@preact/signals-react/runtime';
import {primitiveIdentity} from './workflowModels.js';
import MutationCommand from './MutationCommand.jsx';

function PickerList({title, rows, selected, setSelected, identityFields, labelField, allowMultiple}) {
  return (
    <section className="forge-assignment-picker__list" aria-label={title}>
      <h4>{title}</h4>
      <div className="forge-assignment-picker__rows">
        {rows.map((row) => {
          const key = primitiveIdentity(row, identityFields);
          return (
            <Checkbox
              key={key}
              checked={selected.has(key)}
              label={String(row?.[labelField] ?? key)}
              onChange={() => {
                const next = new Set(selected);
                if (next.has(key)) next.delete(key);
                else {
                  if (!allowMultiple) next.clear();
                  next.add(key);
                }
                setSelected(next);
              }}
            />
          );
        })}
      </div>
    </section>
  );
}

export default function AssignmentPicker({container, context}) {
  useSignals();
  const spec = container.assignmentPicker || {};
  const availableContext = context.Context(spec.availableDataSourceRef);
  const assignedContext = context.Context(spec.assignedDataSourceRef);
  const available = availableContext?.signals?.collection?.value || [];
  const assigned = assignedContext?.signals?.collection?.value || [];
  const identityFields = spec.identityFields?.length ? spec.identityFields : ['id'];
  const labelField = spec.labelField || 'name';
  const allowMultiple = spec.allowMultiple !== false;
  const [availableSelection, setAvailableSelection] = React.useState(new Set());
  const [assignedSelection, setAssignedSelection] = React.useState(new Set());
  const selectedRows = (rows, keys) => rows.filter((row) => keys.has(primitiveIdentity(row, identityFields)));
  const operationRows = (operation) => {
    const assigning = operation === 'assign';
    return selectedRows(assigning ? available : assigned, assigning ? availableSelection : assignedSelection);
  };
  React.useEffect(() => {
    const availableKeys = new Set(available.map((row) => primitiveIdentity(row, identityFields)));
    const assignedKeys = new Set(assigned.map((row) => primitiveIdentity(row, identityFields)));
    setAvailableSelection((current) => new Set([...current].filter((key) => availableKeys.has(key))));
    setAssignedSelection((current) => new Set([...current].filter((key) => assignedKeys.has(key))));
  }, [available, assigned]);
  return (
    <div className="forge-assignment-picker" data-forge-primitive="assignmentPicker">
      <PickerList title="Available" rows={available} selected={availableSelection} setSelected={setAvailableSelection} identityFields={identityFields} labelField={labelField} allowMultiple={allowMultiple}/>
      <div className="forge-assignment-picker__actions">
        <MutationCommand disabled={!availableSelection.size} command={{...spec.assign, commandId: spec.assign?.commandId || 'assign', label: 'Assign'}} context={context} extras={{operationId: 'assign', selectedRows: operationRows('assign')}} onSettled={({status}) => { if (status === 'succeeded') setAvailableSelection(new Set()); }}>Assign</MutationCommand>
        <MutationCommand disabled={!assignedSelection.size} command={{...spec.unassign, commandId: spec.unassign?.commandId || 'unassign', label: 'Unassign'}} context={context} extras={{operationId: 'unassign', selectedRows: operationRows('unassign')}} onSettled={({status}) => { if (status === 'succeeded') setAssignedSelection(new Set()); }}>Unassign</MutationCommand>
      </div>
      <PickerList title="Assigned" rows={assigned} selected={assignedSelection} setSelected={setAssignedSelection} identityFields={identityFields} labelField={labelField} allowMultiple={allowMultiple}/>
    </div>
  );
}
