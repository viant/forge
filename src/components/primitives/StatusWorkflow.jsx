import React from 'react';
import {ButtonGroup, Tag} from '@blueprintjs/core';
import {resolveSelector} from '../../utils/selector.js';
import {availableStatusTransitions} from './workflowModels.js';
import MutationCommand from './MutationCommand.jsx';

export default function StatusWorkflow({container, context}) {
  const spec = container.statusWorkflow || {};
  const dataContext = container.dataSourceRef ? context.Context?.(container.dataSourceRef) || context : context;
  const selected = dataContext?.signals?.selection?.value?.selected;
  const form = dataContext?.handlers?.dataSource?.getFormData?.() || dataContext?.signals?.form?.value || {};
  const current = resolveSelector(selected || form, spec.stateField || 'status');
  const transitions = availableStatusTransitions(current, spec, dataContext);
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
