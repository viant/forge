import {useRegisteredControlActions} from '../../runtime/useRegisteredControlActions.js';
import {isLiveControlVisible} from '../../core/ui/controlActions.js';
import React from 'react';
import {Alert, Button} from '@blueprintjs/core';
import {evaluatePlainVisibleWhen} from '../visibleWhen.js';
import MutationCommand, {useMutationCommandState} from './MutationCommand.jsx';
import {usePredicateSignals} from './usePredicateSignals.js';
import {useDraftLifecycle} from './useDraftLifecycle.js';
import {draftSnapshot, resetDraft, validateDraft, retainedDraftBaseline, retainDraftBaseline} from './draftFormModel.js';

export default function DraftForm({container, context, children}) {
  const spec = container.draftForm || {};
  const operationRoot = React.useRef(null);
  const ref = spec.dataSourceRef || container.dataSourceRef;
  const dataContext = !ref || context.identity?.dataSourceRef === ref ? context : context.Context?.(ref) || context;
  usePredicateSignals(dataContext, [spec.dirtyWhen, spec.validWhen, spec.submitWhen]);
  const lifecycle = useDraftLifecycle(spec.lifecycle, dataContext);
  const form = dataContext?.signals?.form?.value || dataContext?.handlers?.dataSource?.getFormData?.() || {};
  const formStatus = dataContext?.signals?.formStatus?.value || {};
  const snapshot = draftSnapshot(form);
  const baselineOwner = dataContext?.signals?.form || dataContext;
  const [baseline, setBaseline] = React.useState(() => retainedDraftBaseline(baselineOwner,snapshot));
  const acceptedBaseline = React.useRef({owner: baselineOwner, version: undefined});
  const [confirmReset, setConfirmReset] = React.useState(false);
  const command = {...spec.submit, synchronizeForm: true, commandId: spec.submit?.commandId || `${container.id || 'draft'}:submit`, label: spec.saveLabel || spec.submit?.label || 'Save'};
  const commandState = useMutationCommandState(dataContext, command);
  const busy = commandState.guarded === true;
  React.useEffect(() => {
    if (formStatus.dirty !== false) return;
    const previous = acceptedBaseline.current;
    // A field value can publish before its dirty flag. Only an accepted clean
    // datasource version (load/reset/save) may replace the reset baseline.
    if (typeof formStatus.version === 'number' && previous.owner === baselineOwner && previous.version === formStatus.version) return;
    acceptedBaseline.current = {owner: baselineOwner, version: formStatus.version};
    retainDraftBaseline(baselineOwner,snapshot,formStatus.version);
    setBaseline(snapshot);
  }, [formStatus.dirty, formStatus.version, baselineOwner, snapshot]);
  const dirty = spec.dirtyWhen ? evaluatePlainVisibleWhen(spec.dirtyWhen, dataContext) : typeof formStatus.dirty === 'boolean' ? formStatus.dirty : snapshot !== baseline;
  const validationMessage = validateDraft(spec, dataContext, form);
  const valid = !validationMessage && (!spec.validWhen || evaluatePlainVisibleWhen(spec.validWhen, dataContext));
  const reset = () => {
    if (!resetDraft(dataContext, retainedDraftBaseline(baselineOwner, baseline), busy)) return;
    if (spec.onReset && typeof dataContext?.lookupHandler === 'function') {
      const handler = dataContext.lookupHandler(spec.onReset);
      if (typeof handler === 'function') handler({context: dataContext, values: JSON.parse(retainedDraftBaseline(baselineOwner, baseline))});
    }
  };
  const resetControlId=`${container.id || 'draft'}:reset`;
  const operationMeta={windowId:context?.identity?.windowId,dataSourceRef:dataContext?.identity?.dataSourceRef,controlId:resetControlId};
  const requestReset=()=>spec.confirmDiscard?setConfirmReset(true):reset();
  useRegisteredControlActions(operationMeta,()=>({visible:isLiveControlVisible(operationRoot.current),disabled:!dirty||busy,readOnly:false,actions:{click:requestReset}}),`${dirty}:${busy}`);
  useRegisteredControlActions({...operationMeta,controlId:`${resetControlId}:confirm`},()=>({visible:confirmReset&&isLiveControlVisible(operationRoot.current),disabled:!confirmReset||busy,readOnly:false,actions:{click:()=>{setConfirmReset(false);reset();}}}),`${confirmReset}:${busy}`);
  useRegisteredControlActions({...operationMeta,controlId:`${resetControlId}:cancel`},()=>({visible:confirmReset&&isLiveControlVisible(operationRoot.current),disabled:!confirmReset,readOnly:false,actions:{click:()=>setConfirmReset(false)}}),`${confirmReset}`);
  useRegisteredControlActions({...operationMeta,controlId:`${container.id || 'draft'}:retry`},()=>({visible:lifecycle.status==='failed'&&isLiveControlVisible(operationRoot.current),disabled:lifecycle.status!=='failed'||busy,readOnly:false,actions:{click:lifecycle.retry}}),`${lifecycle.status}:${busy}`);
  const body = children ? <fieldset className="forge-draft-form__fields" data-forge-part="draft-fields" disabled={busy}>{children}</fieldset> : null;
  return <div ref={operationRoot} className={`forge-draft-form${children ? ' forge-draft-form--editor' : ''}`} data-forge-primitive="draftForm" aria-busy={busy || undefined}>
    <div className="forge-draft-form__actions" data-forge-part="draft-actions">
      {spec.submit && (!spec.submitWhen || evaluatePlainVisibleWhen(spec.submitWhen, dataContext)) ? <MutationCommand command={command} context={dataContext} extras={{data: form}} disabled={!dirty || !valid || !lifecycle.ready} onSettled={({status, warnings = []}) => {
        if (status !== 'succeeded' || warnings.length) return;
        // A child editor is locked for the full command, including synchronization.
        // Standalone draft toolbars must also preserve programmatic edits made in flight.
        const current = dataContext?.handlers?.dataSource?.getFormData?.() || dataContext?.signals?.form?.value || {};
        if (draftSnapshot(current) === snapshot) {
          setBaseline(snapshot);
          dataContext?.handlers?.dataSource?.resetFormDirty?.();
        }
      }}/>: null}
      <Button data-forge-part="button" disabled={!dirty || busy} onClick={requestReset}>{spec.resetLabel || 'Reset'}</Button>
      <span className="forge-draft-form__status" aria-live="polite">{dirty ? 'Unsaved changes' : 'No unsaved changes'}</span>
      {dirty && validationMessage ? <span data-forge-part="validation-message" role="status">{validationMessage}</span> : null}
    </div>
    {spec.lifecycle && lifecycle.status === 'waiting' ? <span role="status">Waiting for defaults context</span> : null}
    {spec.lifecycle && lifecycle.status === 'loading' ? <span role="status">Loading defaults…</span> : null}
    {spec.lifecycle && lifecycle.status === 'failed' ? <div role="alert">{lifecycle.error}<Button disabled={busy} onClick={lifecycle.retry}>Retry</Button></div> : null}
    {body}
    <Alert isOpen={confirmReset} intent="warning" confirmButtonText={spec.resetLabel || 'Reset'} cancelButtonText="Cancel" onCancel={() => setConfirmReset(false)} onConfirm={() => { setConfirmReset(false); reset(); }}>{spec.confirmDiscard}</Alert>
  </div>;
}
