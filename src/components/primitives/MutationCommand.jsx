import {useRegisteredControlActions} from '../../runtime/useRegisteredControlActions.js';
import {isLiveControlVisible} from '../../core/ui/controlActions.js';
import React from 'react';
import {Alert, Button} from '@blueprintjs/core';
import {evaluatePlainVisibleWhen} from '../visibleWhen.js';
import {executeCommand, getMutationCommandState, resetMutationCommandState, subscribeMutationCommand} from './primitiveMutation.js';
import {usePredicateSignals} from './usePredicateSignals.js';
import {commandGuardKey, discardCommandVerification, retryCommandVerification, stableContextOwner} from './commandExecutor.js';
import DisabledActionShell from '../DisabledActionShell.jsx';
import {findDialogSignal, protectedWindowEpoch} from '../../core/store/signals.js';
import {getLogger} from '../../utils/logger.js';
const mutationLog = getLogger('mutation');

function useBoundMutationCommandState(context, command) {
  const [state, setState] = React.useState(() => {
    const current = getMutationCommandState(context, command);
    return !current.guarded && ['succeeded', 'failed'].includes(current.phase)
      ? {...current, phase: 'idle', message: '', error: null, writerStatus: 'idle', syncStatus: 'not_started', warnings: []}
      : current;
  });
  // A host may recreate context facades while the same datasource and dialog remain mounted.
  // Subscribe and reset only when the underlying command state actually changes owners.
  const owner = stableContextOwner(context);
  const key = commandGuardKey(command);
  const authority = context?.signals?.authorization?.value ?? context?.authorization;
  const epoch = context?.identity?.protectedWindow ? protectedWindowEpoch(context.identity.windowId) : undefined;
  const verification = command?.reconcile?.verify ? command.reconcile : null;
  const binding = React.useMemo(() => ({context, command}), [owner, key, command?.dataSourceRef, authority, epoch, verification]);
  React.useLayoutEffect(() => {
    resetMutationCommandState(binding.context, binding.command);
    return subscribeMutationCommand(binding.context, binding.command, setState);
  }, [binding]);
  return {state, binding};
}

export function useMutationCommandState(context, command) {
  return useBoundMutationCommandState(context, command).state;
}

export default function MutationCommand({command, context, extras = {}, disabled = false, children, onSettled, renderTrigger, dialogId, closeOnSuccess}) {
  usePredicateSignals(context, [command?.validateWhen]);
  const {state, binding} = useBoundMutationCommandState(context, command);
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
  const scopedFooter = dialogId && (command.reconcile?.verify || command.group || (!closeOnSuccess && !command.before?.length && !command.clearFormFields?.length));
  const dialog = scopedFooter && findDialogSignal(`${context?.identity?.windowId}Dialog${dialogId}`);
  const presentation = dialog?.peek?.()?.props;
  const activatedPresentation = React.useRef(null);
  const belongsHere = !dialog || (activatedPresentation.current?.props === presentation && activatedPresentation.current?.binding === binding);
  const liveBinding = React.useRef(null);
  React.useLayoutEffect(() => {
    liveBinding.current = binding;
    return () => {
      liveBinding.current = null;
      if (binding.command.reconcile?.verify) discardCommandVerification(binding.context, binding.command, binding);
    };
  }, [binding]);
  const retry = belongsHere && state.phase === 'verification_failed';
  const triggerDisabled = retry ? disabled : blocked || busy;
  const statusMessage = !belongsHere ? (state.guarded ? (['indeterminate', 'partial_failure', 'verification_failed'].includes(state.phase)
    ? 'A previous submission needs verification before retrying.' : 'Another submission is in progress.') : '') : state.message || ({validating: 'Validating…', confirming: 'Awaiting confirmation…', preparing: 'Preparing…', pending: 'Saving…', indeterminate: 'Outcome unknown; refresh authoritative data before retrying.'}[state.phase]) || (state.guarded ? 'Working…' : '');
  const invoke = () => {
    mutationLog.debug('activate', {commandId: command?.commandId, dataSourceRef: command?.dataSourceRef, blocked, busy, phase: state.phase, guarded: getMutationCommandState(context, command).guarded});
    if (triggerDisabled) return;
    if (retry) return retryCommandVerification(context, command, binding);
    activatedPresentation.current = {props: presentation, binding};
    commandPromise.current = executeCommand(context, command, extras, {onSettled, dialogId, closeOnSuccess, presentationToken: binding, isPresent: () => liveBinding.current === binding, confirm: (message) => new Promise((resolve) => {
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
  useRegisteredControlActions(operationMeta,()=>({visible:isLiveControlVisible(operationRoot.current),disabled:triggerDisabled,readOnly:false,actions:{click:operateInvoke}}),`${triggerDisabled}:${state.phase}`);
  useRegisteredControlActions({...operationMeta,controlId:command?.commandId?`${command.commandId}:confirm`:null},()=>({visible:confirmOpen&&isLiveControlVisible(operationRoot.current),disabled:!confirmOpen,readOnly:false,actions:{click:()=>{settleConfirmation(true);return commandPromise.current;}}}),`${confirmOpen}`);
  useRegisteredControlActions({...operationMeta,controlId:command?.commandId?`${command.commandId}:cancel`:null},()=>({visible:confirmOpen&&isLiveControlVisible(operationRoot.current),disabled:!confirmOpen,readOnly:false,actions:{click:()=>{settleConfirmation(false);return commandPromise.current;}}}),`${confirmOpen}`);

  return (
    <div ref={operationRoot} style={{display:'contents'}}><DisabledActionShell reason={retry ? '' : blockedExplanation} label={command?.label || 'Action'} className="forge-mutation-command">
      {retry ? <Button className={command?.className} data-forge-part="button" intent={command?.intent || undefined}
        disabled={triggerDisabled} onClick={invoke}>Retry verification</Button> : renderTrigger ? renderTrigger({invoke, disabled: blocked || busy, pending: state.phase === 'pending'}) :
        <Button className={command?.className} data-forge-part="button" icon={command?.icon || undefined} aria-label={command?.label || 'Save'} title={!valid ? command.invalidMessage || 'This action is not currently valid.' : command?.label || undefined} intent={command?.intent || undefined} loading={state.phase === 'pending'} disabled={blocked || busy} onClick={invoke}>{command?.hideLabel ? null : children || command?.label || 'Save'}</Button>}
      <span className="forge-mutation-command__status" data-command-phase={(belongsHere || state.guarded ? state.phase : 'idle') || 'idle'} aria-live="polite">{statusMessage}</span>
      <Alert isOpen={confirmOpen} intent={command?.intent === 'danger' ? 'danger' : 'primary'} confirmButtonText={children || command?.label || 'Confirm'} cancelButtonText="Cancel" onCancel={() => settleConfirmation(false)} onConfirm={() => settleConfirmation(true)}>{confirmMessage}</Alert>
    </DisabledActionShell></div>
  );
}
