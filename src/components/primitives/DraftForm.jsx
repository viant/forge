import React from 'react';
import {Alert, Button} from '@blueprintjs/core';
import {evaluatePlainVisibleWhen} from '../visibleWhen.js';
import MutationCommand, {useMutationCommandState} from './MutationCommand.jsx';
import {usePredicateSignals} from './usePredicateSignals.js';
import {draftSnapshot, resetDraft, validateDraft} from './draftFormModel.js';

export default function DraftForm({container, context, children}) {
  const spec = container.draftForm || {};
  const ref = spec.dataSourceRef || container.dataSourceRef;
  const dataContext = !ref || context.identity?.dataSourceRef === ref ? context : context.Context?.(ref) || context;
  usePredicateSignals(dataContext, [spec.dirtyWhen, spec.validWhen]);
  const form = dataContext?.signals?.form?.value || dataContext?.handlers?.dataSource?.getFormData?.() || {};
  const formStatus = dataContext?.signals?.formStatus?.value || {};
  const snapshot = draftSnapshot(form);
  const [baseline, setBaseline] = React.useState(snapshot);
  const baselineOwner = dataContext?.signals?.form || dataContext;
  const acceptedBaseline = React.useRef({owner: baselineOwner, version: formStatus.version});
  const [confirmReset, setConfirmReset] = React.useState(false);
  const command = {...spec.submit, commandId: spec.submit?.commandId || `${container.id || 'draft'}:submit`, label: spec.saveLabel || spec.submit?.label || 'Save'};
  const commandState = useMutationCommandState(dataContext, command);
  const busy = commandState.guarded === true;
  React.useEffect(() => {
    if (formStatus.dirty !== false) return;
    const previous = acceptedBaseline.current;
    // A field value can publish before its dirty flag. Only an accepted clean
    // datasource version (load/reset/save) may replace the reset baseline.
    if (typeof formStatus.version === 'number' && previous.owner === baselineOwner && previous.version === formStatus.version) return;
    acceptedBaseline.current = {owner: baselineOwner, version: formStatus.version};
    setBaseline(snapshot);
  }, [formStatus.dirty, formStatus.version, baselineOwner, snapshot]);
  const dirty = spec.dirtyWhen ? evaluatePlainVisibleWhen(spec.dirtyWhen, dataContext) : typeof formStatus.dirty === 'boolean' ? formStatus.dirty : snapshot !== baseline;
  const validationMessage = validateDraft(spec, dataContext, form);
  const valid = !validationMessage && (!spec.validWhen || evaluatePlainVisibleWhen(spec.validWhen, dataContext));
  const reset = () => {
    if (!resetDraft(dataContext, baseline, busy)) return;
    if (spec.onReset && typeof dataContext?.lookupHandler === 'function') {
      const handler = dataContext.lookupHandler(spec.onReset);
      if (typeof handler === 'function') handler({context: dataContext, values: JSON.parse(baseline)});
    }
  };
  const body = children ? <fieldset className="forge-draft-form__fields" data-forge-part="draft-fields" disabled={busy} style={{border: 0, padding: 0, margin: 0, minWidth: 0}}>{children}</fieldset> : null;
  return <div className={`forge-draft-form${children ? ' forge-draft-form--editor' : ''}`} data-forge-primitive="draftForm" aria-busy={busy || undefined}>
    <div className="forge-draft-form__actions" data-forge-part="draft-actions">
      {spec.submit ? <MutationCommand command={command} context={dataContext} extras={{data: form}} disabled={!dirty || !valid} onSettled={({status}) => {
        if (status !== 'succeeded') return;
        // A child editor is locked for the full command, including synchronization.
        // Standalone draft toolbars must also preserve programmatic edits made in flight.
        const current = dataContext?.handlers?.dataSource?.getFormData?.() || dataContext?.signals?.form?.value || {};
        if (draftSnapshot(current) === snapshot) {
          setBaseline(snapshot);
          dataContext?.handlers?.dataSource?.resetFormDirty?.();
        }
      }}/>: null}
      <Button data-forge-part="button" disabled={!dirty || busy} onClick={() => spec.confirmDiscard ? setConfirmReset(true) : reset()}>{spec.resetLabel || 'Reset'}</Button>
      <span className="forge-draft-form__status" aria-live="polite">{dirty ? 'Unsaved changes' : 'No unsaved changes'}</span>
      {dirty && validationMessage ? <span data-forge-part="validation-message" role="status">{validationMessage}</span> : null}
    </div>
    {body}
    <Alert isOpen={confirmReset} intent="warning" confirmButtonText={spec.resetLabel || 'Reset'} cancelButtonText="Cancel" onCancel={() => setConfirmReset(false)} onConfirm={() => { setConfirmReset(false); reset(); }}>{spec.confirmDiscard}</Alert>
  </div>;
}
