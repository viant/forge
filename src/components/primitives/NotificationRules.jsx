import React from 'react';
import {Button, Callout} from '@blueprintjs/core';
import {evaluatePlainVisibleWhen} from '../visibleWhen.js';
import MutationCommand from './MutationCommand.jsx';
import {resolveTemplate} from '../../utils/selector.js';
import {usePredicateSignals} from './usePredicateSignals.js';
import {notificationActionState} from './presentationModels.js';

export default function NotificationRules({container, context}) {
  usePredicateSignals(context);
  const rules = container.notificationRules?.rules || [];
  return <div className="forge-notification-rules" data-forge-primitive="notificationRules">{rules.map((rule) => {
    if (rule.visibleWhen && !evaluatePlainVisibleWhen(rule.visibleWhen, context)) return null;
    const action = rule.action;
    const actionState = notificationActionState(action, context);
    const actionVisible = !action || actionState.visible;
    const actionDisabled = !!action && actionState.disabled;
    const invoke = () => {
      if (!actionVisible || actionDisabled) return false;
      return context?.lookupHandler?.(action.handler)?.({context, action});
    };
    const actionNode = !action || !actionVisible ? null : action.mutation
      ? <MutationCommand command={{...action.mutation, commandId: action.mutation?.commandId || action.id, label: action.label, icon: action.icon, hideLabel: action.hideLabel, intent: action.intent}} context={context} disabled={actionDisabled}/>
      : <Button icon={action.icon || undefined} disabled={actionDisabled} aria-label={action.label || action.id} title={action.label || action.id} onClick={invoke}>{action.hideLabel ? null : action.label}</Button>;
    return <Callout key={rule.id} intent={rule.intent || 'primary'} icon={rule.icon || undefined}>{resolveTemplate(rule.message, context)}{actionNode ? <div className="forge-notification-rules__action">{actionNode}</div> : null}</Callout>;
  })}</div>;
}
