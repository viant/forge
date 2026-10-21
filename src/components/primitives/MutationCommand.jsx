import {useRegisteredControlActions} from '../../runtime/useRegisteredControlActions.js';
import {isLiveControlVisible} from '../../core/ui/controlActions.js';
import React from 'react';
import {Alert, Button} from '@blueprintjs/core';
import {evaluatePlainVisibleWhen} from '../visibleWhen.js';
import {executeCommand, getMutationCommandState, resetMutationCommandState, subscribeMutationCommand} from './primitiveMutation.js';
import {usePredicateSignals} from './usePredicateSignals.js';
import DisabledActionShell from '../DisabledActionShell.jsx';
import {getLogger} from '../../utils/logger.js';
const mutationLog = getLogger('mutation');

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

export default function MutationCommand({command, context, extras = {}, disabled = false, children, onSettled, renderTrigger}) {
  usePredicateSignals(context, [command?.validateWhen]);
  const state = useMutationCommandState(context, command);
  const operationRoot = React.useRef(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmMessage, setConfirmMessage] = React.useState('');
  const confirmResolver = React.useRef(null);
  const commandPromise = React.useRef(null);
  const valid = !command?.validateWhen || evaluatePlainVisibleWhen(command.validateWhen, context);
  const blocked = disabled || !valid;
  const blockedExplanation = blocked
    ? (!valid ? command?.invalidMessage || command?.tooltip : command?.tooltip)
    : '';
  const busy = state.guarded === true || ['validating', 'confirming', 'pending'].includes(state.phase);
  const statusMessage = state.message || ({validating: 'Validating…', confirming: 'Awaiting confirmation…', pending: 'Saving…', indeterminate: 'Outcome unknown; refresh authoritative data before retrying.'}[state.phase]) || (state.guarded ? 'Working…' : '');
  const invoke = () => {
    mutationLog.debug('activate', {commandId: command?.commandId, dataSourceRef: command?.dataSourceRef, blocked, busy, phase: state.phase, guarded: getMutationCommandState(context, command).guarded});
    if (blocked || busy) return;
    commandPromise.current = executeCommand(context, command, extras, {onSettled, confirm: (message) => new Promise((resolve) => {
      confirmResolver.current = resolve;
      setConfirmMessage(message);
      setConfirmOpen(true);
    })}).then(result => {mutationLog.debug('settled', {commandId: command?.commandId, status: result.status, accepted: result.accepted, errorCode: result.error?.code});return result;});
    return commandPromise.current;
  };
  const settleConfirmation = (accepted) => {
    setConfirmOpen(false);
    const resolve = confirmResolver.current;
    confirmResolver.current = null;
    resolve?.(accepted);
  };
  React.useEffect(() => () => confirmResolver.current?.(false), []);
  const operateInvoke=async()=>{const promise=invoke();await Promise.resolve();if(confirmResolver.current)return {status:'awaiting_confirmation',pendingConfirmation:true,accepted:false};return await promise;};
  const operationMeta={windowId:context?.identity?.windowId,dataSourceRef:context?.identity?.dataSourceRef,controlId:command?.commandId};
  useRegisteredControlActions(operationMeta,()=>({visible:isLiveControlVisible(operationRoot.current),disabled:blocked||busy,readOnly:false,actions:{click:operateInvoke}}),`${blocked}:${busy}:${state.phase}`);
  useRegisteredControlActions({...operationMeta,controlId:command?.commandId?`${command.commandId}:confirm`:null},()=>({visible:confirmOpen&&isLiveControlVisible(operationRoot.current),disabled:!confirmOpen,readOnly:false,actions:{click:()=>{settleConfirmation(true);return commandPromise.current;}}}),`${confirmOpen}`);
  useRegisteredControlActions({...operationMeta,controlId:command?.commandId?`${command.commandId}:cancel`:null},()=>({visible:confirmOpen&&isLiveControlVisible(operationRoot.current),disabled:!confirmOpen,readOnly:false,actions:{click:()=>{settleConfirmation(false);return commandPromise.current;}}}),`${confirmOpen}`);

  return (
    <div ref={operationRoot} style={{display:'contents'}}><DisabledActionShell reason={blockedExplanation} label={command?.label || 'Action'} className="forge-mutation-command">
      {renderTrigger ? renderTrigger({invoke, disabled: blocked || busy, pending: state.phase === 'pending'}) :
        <Button className={command?.className} data-forge-part="button" icon={command?.icon || undefined} aria-label={command?.label || 'Save'} title={!valid ? command.invalidMessage || 'This action is not currently valid.' : command?.label || undefined} intent={command?.intent || undefined} loading={state.phase === 'pending'} disabled={blocked || busy} onClick={invoke}>{command?.hideLabel ? null : children || command?.label || 'Save'}</Button>}
      <span className="forge-mutation-command__status" data-command-phase={state.phase || 'idle'} aria-live="polite">{statusMessage}</span>
      <Alert isOpen={confirmOpen} intent={command?.intent === 'danger' ? 'danger' : 'primary'} confirmButtonText={children || command?.label || 'Confirm'} cancelButtonText="Cancel" onCancel={() => settleConfirmation(false)} onConfirm={() => settleConfirmation(true)}>{confirmMessage}</Alert>
    </DisabledActionShell></div>
  );
}
