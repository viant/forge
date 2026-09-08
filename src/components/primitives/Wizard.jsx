import React from 'react';
import {Button, ButtonGroup} from '@blueprintjs/core';
import {useSignals} from '@preact/signals-react/runtime';
import {wizardState} from './workflowModels.js';
import MutationCommand from './MutationCommand.jsx';

export default function Wizard({container, context, renderStep}) {
  useSignals();
  context?.signals?.form?.value;
  context?.signals?.windowForm?.value;
  context?.signals?.selection?.value;
  context?.signals?.authorization?.value;
  const spec = container.wizard || {};
  const persisted = spec.stateKey ? context?.signals?.windowForm?.value?.[spec.stateKey] : undefined;
  const [currentStep, setCurrentStep] = React.useState(persisted || spec.steps?.[0]?.id || '');
  const state = wizardState(spec, context, persisted || currentStep);
  const bodyRef = React.useRef(null);
  const selectStep = (step) => {
    if (!step) return;
    setCurrentStep(step.id);
    if (spec.stateKey && context?.signals?.windowForm) {
      const current = context.signals.windowForm.peek?.() || context.signals.windowForm.value || {};
      context.signals.windowForm.value = {...current, [spec.stateKey]: step.id};
    }
  };
  React.useEffect(() => { if (state.current?.id !== currentStep) setCurrentStep(state.current?.id || ''); }, [currentStep, state.current?.id]);
  React.useEffect(() => { bodyRef.current?.focus?.(); }, [state.current?.id]);
  return (
    <div className="forge-wizard" data-forge-primitive="wizard">
      <ol className="forge-wizard__steps" aria-label="Steps">
        {state.steps.map((step, stepIndex) => <li key={step.id} aria-current={stepIndex === state.index ? 'step' : undefined} className={stepIndex === state.index ? 'is-active' : stepIndex < state.index ? 'is-complete' : ''}>{step.label}</li>)}
      </ol>
      <div ref={bodyRef} tabIndex={-1} className="forge-wizard__body" aria-live="polite" aria-label={state.current ? `Step ${state.index + 1}: ${state.current.label}` : 'No active step'}>{state.current ? renderStep?.(state.current) : null}</div>
      <ButtonGroup className="forge-wizard__actions">
        <Button disabled={!state.canBack} onClick={() => selectStep(state.steps[state.index - 1])}>Back</Button>
        {state.canSubmit
          ? <MutationCommand command={{...spec.submit, label: 'Submit', intent: 'primary'}} context={context} extras={{stepId: state.current?.id}} onSettled={({status}) => { if (status === 'succeeded') selectStep(state.steps[0]); }}/>
          : <Button intent="primary" disabled={!state.canNext} onClick={() => selectStep(state.steps[state.index + 1])}>Next</Button>}
      </ButtonGroup>
    </div>
  );
}
