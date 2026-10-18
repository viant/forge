import React from 'react';
import {useSignals} from '@preact/signals-react/runtime';
import {ButtonGroup, Tag, Switch} from '@blueprintjs/core';
import {resolveSelector} from '../../utils/selector.js';
import {availableStatusTransitions} from './workflowModels.js';
import MutationCommand from './MutationCommand.jsx';

export default function StatusWorkflow({container, context}) {
  useSignals();
  const spec = container.statusWorkflow || {};
  const dataContext = container.dataSourceRef ? context.Context?.(container.dataSourceRef) || context : context;
  const selected = dataContext?.signals?.selection?.value?.selected;
  const form = dataContext?.handlers?.dataSource?.getFormData?.() || dataContext?.signals?.form?.value || {};
  const current = resolveSelector(selected || form, spec.stateField || 'status');
  const transitions = availableStatusTransitions(current, spec, dataContext);
  if (spec.appearance === 'switch') {
    const label = spec.label || 'Status';
    const checked = spec.activeState !== undefined && current != null && String(current) === String(spec.activeState);
    const caption = spec.stateLabels?.[String(current)] || String(current ?? 'Unknown');
    const trigger = ({invoke, disabled = true}) => <Switch role="switch" aria-label={label} checked={checked} disabled={disabled} onChange={invoke}>{caption}</Switch>;
    // A switch has one unambiguous next state. Unknown/ambiguous states remain
    // readable without presenting an arbitrary mutation.
    if (spec.activeState === undefined || transitions.length !== 1) return <div className="forge-status-workflow forge-status-workflow--switch" data-forge-primitive="statusWorkflow">{trigger({})}</div>;
    const transition = transitions[0];
    return <div className="forge-status-workflow forge-status-workflow--switch" data-forge-primitive="statusWorkflow">
      <MutationCommand command={{...transition.command, commandId: transition.command?.commandId || transition.id, label: transition.label || label, confirm: transition.command?.confirm || transition.confirm}}
        context={dataContext} extras={{transitionId: transition.id, from: current, to: transition.to}} renderTrigger={trigger}/>
    </div>;
  }
  return (
    <div className="forge-status-workflow" data-forge-primitive="statusWorkflow">
      <Tag minimal>{String(current ?? 'Unknown')}</Tag>
      <ButtonGroup>
        {transitions.map((transition) => (
          <MutationCommand key={transition.id} command={{...transition.command, commandId: transition.command?.commandId || transition.id, label: transition.label, confirm: transition.command?.confirm || transition.confirm}} context={dataContext} extras={{transitionId: transition.id, from: current, to: transition.to}}/>
        ))}
      </ButtonGroup>
    </div>
  );
}
