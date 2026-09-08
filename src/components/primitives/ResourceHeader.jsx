import React from 'react';
import {Button, ButtonGroup} from '@blueprintjs/core';
import {resolveSelector} from '../../utils/selector.js';
import {formatDisplayValue} from '../../utils/formatValue.js';
import {evaluatePlainVisibleWhen} from '../visibleWhen.js';
import MutationCommand from './MutationCommand.jsx';
import {usePredicateSignals} from './usePredicateSignals.js';

export default function ResourceHeader({container, context}) {
  usePredicateSignals(context);
  const spec = container.resourceHeader || {};
  const dataContext = context.Context?.(spec.dataSourceRef || container.dataSourceRef) || context;
  const record = dataContext?.signals?.form?.value || dataContext?.signals?.collection?.value?.[0] || {};
  const invoke = (action) => dataContext?.lookupHandler?.(action.handler)?.({context: dataContext, action, record});
  return <header className="forge-resource-header" data-forge-primitive="resourceHeader">
    <div className="forge-resource-header__identity"><h2>{String(resolveSelector(record, spec.titleField || 'name') || container.title || '')}</h2>{spec.subtitleField ? <p>{String(resolveSelector(record, spec.subtitleField) || '')}</p> : null}</div>
    <dl>{(spec.fields || []).map((field) => <div key={field.field}><dt>{field.label}</dt><dd>{formatDisplayValue(resolveSelector(record, field.field), field.format || 'raw')}</dd></div>)}</dl>
    <ButtonGroup>{(spec.actions || []).map((action) => {
      if (action.visibleWhen && !evaluatePlainVisibleWhen(action.visibleWhen, dataContext)) return null;
      const disabled = !!action.disabledWhen && evaluatePlainVisibleWhen(action.disabledWhen, dataContext);
      return action.mutation ? <MutationCommand key={action.id} command={{...action.mutation, commandId: action.mutation?.commandId || action.id, label: action.label, icon: action.icon, hideLabel: action.hideLabel, intent: action.intent}} context={dataContext} extras={{record}} disabled={disabled}/> : <Button key={action.id} icon={action.icon || undefined} intent={action.intent || undefined} aria-label={action.label || action.id} title={action.label || action.id} disabled={disabled} onClick={() => invoke(action)}>{action.hideLabel ? null : action.label}</Button>;
    })}</ButtonGroup>
  </header>;
}
