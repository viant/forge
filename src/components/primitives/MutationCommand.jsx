import React from 'react';
import {Alert, Button} from '@blueprintjs/core';
import {evaluatePlainVisibleWhen} from '../visibleWhen.js';
import {executeCommand, getMutationCommandState, resetMutationCommandState, subscribeMutationCommand} from './primitiveMutation.js';
import {usePredicateSignals} from './usePredicateSignals.js';

export function useMutationCommandState(context, command) {
  const [state, setState] = React.useState(() => {
    const current = getMutationCommandState(context, command);
    return !current.guarded && ['succeeded', 'failed'].includes(current.phase)
      ? {...current, phase: 'idle', message: '', error: null, writerStatus: 'idle', syncStatus: 'not_started', warnings: []}
      : current;
  });
  React.useEffect(() => {
    resetMutationCommandState(context, command);
    return subscribeMutationCommand(context, command, setState);
  }, [context, command?.commandId, command?.dataSourceRef]);
  return state;
}

export default function MutationCommand({command, context, extras = {}, disabled = false, children, onSettled}) {
  usePredicateSignals(context);
  const state = useMutationCommandState(context, command);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmMessage, setConfirmMessage] = React.useState('');
  const confirmResolver = React.useRef(null);
  const valid = !command?.validateWhen || evaluatePlainVisibleWhen(command.validateWhen, context);
  const blocked = disabled || !valid;
  const busy = state.guarded === true || ['validating', 'confirming', 'pending'].includes(state.phase);
  const statusMessage = state.message || ({validating: 'Validating…', confirming: 'Awaiting confirmation…', pending: 'Saving…', indeterminate: 'Outcome unknown; refresh authoritative data before retrying.'}[state.phase]) || (state.guarded ? 'Working…' : '');
  const invoke = () => {
    if (blocked || busy) return;
    void executeCommand(context, command, extras, {onSettled, confirm: (message) => new Promise((resolve) => {
      confirmResolver.current = resolve;
      setConfirmMessage(message);
      setConfirmOpen(true);
    })});
  };
  const settleConfirmation = (accepted) => {
    setConfirmOpen(false);
    const resolve = confirmResolver.current;
    confirmResolver.current = null;
    resolve?.(accepted);
  };
  React.useEffect(() => () => confirmResolver.current?.(false), []);
  return (
    <span className="forge-mutation-command">
      <Button icon={command?.icon || undefined} aria-label={command?.label || 'Save'} title={!valid ? command.invalidMessage || 'This action is not currently valid.' : command?.label || undefined} intent={command?.intent || undefined} loading={state.phase === 'pending'} disabled={blocked || busy} onClick={invoke}>{command?.hideLabel ? null : children || command?.label || 'Save'}</Button>
      <span className="forge-mutation-command__status" data-command-phase={state.phase || 'idle'} aria-live="polite">{statusMessage}</span>
      <Alert isOpen={confirmOpen} intent={command?.intent === 'danger' ? 'danger' : 'primary'} confirmButtonText={children || command?.label || 'Confirm'} cancelButtonText="Cancel" onCancel={() => settleConfirmation(false)} onConfirm={() => settleConfirmation(true)}>{confirmMessage}</Alert>
    </span>
  );
}
