import React from 'react';
import {Alert, Button} from '@blueprintjs/core';
import {evaluatePlainVisibleWhen} from '../visibleWhen.js';
import MutationCommand from './MutationCommand.jsx';
import {usePredicateSignals} from './usePredicateSignals.js';

export default function DraftForm({container, context}) {
  usePredicateSignals(context);
  const spec = container.draftForm || {};
  const dataContext = context.Context?.(spec.dataSourceRef || container.dataSourceRef) || context;
  const form = dataContext?.signals?.form?.value || dataContext?.handlers?.dataSource?.getFormData?.() || {};
  const formStatus = dataContext?.signals?.formStatus?.value || {};
  const [baseline, setBaseline] = React.useState(() => JSON.stringify(form));
  const [confirmReset, setConfirmReset] = React.useState(false);
  React.useEffect(() => { if (formStatus.dirty === false) setBaseline(JSON.stringify(form)); }, [formStatus.version, spec.dataSourceRef]);
  const dirty = spec.dirtyWhen ? evaluatePlainVisibleWhen(spec.dirtyWhen, dataContext) : typeof formStatus.dirty === 'boolean' ? formStatus.dirty : JSON.stringify(form) !== baseline;
  const valid = !spec.validWhen || evaluatePlainVisibleWhen(spec.validWhen, dataContext);
  const reset = () => {
    const values = JSON.parse(baseline || '{}');
    dataContext?.handlers?.dataSource?.setFormData?.({values});
    dataContext?.handlers?.dataSource?.resetFormDirty?.();
    if (spec.onReset && typeof dataContext?.lookupHandler === 'function') {
      const handler = dataContext.lookupHandler(spec.onReset);
      if (typeof handler === 'function') setTimeout(() => handler({context: dataContext, values}), 0);
    }
  };
  return <div className="forge-draft-form" data-forge-primitive="draftForm">
    <span className="forge-draft-form__status" aria-live="polite">{dirty ? 'Unsaved changes' : 'No unsaved changes'}</span>
    <Button disabled={!dirty} onClick={() => spec.confirmDiscard ? setConfirmReset(true) : reset()}>{spec.resetLabel || 'Reset'}</Button>
    {spec.submit ? <MutationCommand command={{...spec.submit, commandId: spec.submit.commandId || `${container.id || 'draft'}:submit`, label: spec.saveLabel || spec.submit.label || 'Save'}} context={dataContext} extras={{data: form}} disabled={!dirty || !valid} onSettled={({status}) => { if (status === 'succeeded') { setBaseline(JSON.stringify(form)); dataContext?.handlers?.dataSource?.resetFormDirty?.(); } }}/>: null}
    <Alert isOpen={confirmReset} intent="warning" confirmButtonText={spec.resetLabel || 'Reset'} cancelButtonText="Cancel" onCancel={() => setConfirmReset(false)} onConfirm={() => { setConfirmReset(false); reset(); }}>{spec.confirmDiscard}</Alert>
  </div>;
}
