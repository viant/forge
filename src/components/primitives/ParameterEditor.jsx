import React from 'react';
import Container from '../Container.jsx';
import DraftForm from './DraftForm.jsx';
import {evaluatePlainVisibleWhen} from '../visibleWhen.js';
import {usePredicateSignals} from './usePredicateSignals.js';
import './ParameterEditor.css';

// A parameter is an authored record. The window supplies its field semantics,
// lookup datasources and commands; this primitive only owns editing composition.
export default function ParameterEditor({container, context}) {
  const spec = container.parameterEditor || {};
  const ref = spec.dataSourceRef || container.dataSourceRef;
  const scoped = !ref || context.identity?.dataSourceRef === ref ? context : context.Context(ref);
  usePredicateSignals(scoped, [spec.readOnlyWhen, ...(spec.sections || []).map(section => section.visibleWhen)]);
  const readOnly = Boolean(spec.readOnlyWhen && evaluatePlainVisibleWhen(spec.readOnlyWhen, scoped));
  const id = container.id || 'parameter';
  const fields = (items, suffix) => <Container context={scoped} container={{id:`${id}-${suffix}`,dataSourceRef:ref,fetchData:false,items:items || [],className:'forge-parameter-editor__fields'}}/>;
  const content = <div className="forge-parameter-editor__content">
    {spec.label && <h3>{spec.label}</h3>}
    {fields(spec.fields, 'core')}
    {(spec.sections || []).filter(section => !section.visibleWhen || evaluatePlainVisibleWhen(section.visibleWhen, scoped)).map(section =>
      <details key={section.id} className="forge-parameter-editor__section" open={section.open || undefined}>
        <summary>{section.label}</summary>
        {fields(section.fields, section.id)}
      </details>)}
  </div>;
  return <section className="forge-parameter-editor" data-forge-primitive="parameterEditor" aria-label={spec.label || 'Parameter editor'}>
    <fieldset className="forge-parameter-editor__body" disabled={readOnly}>
    {spec.draft ? <DraftForm container={{id, dataSourceRef:ref, draftForm:spec.draft}} context={scoped}>{content}</DraftForm> : content}
    </fieldset>
  </section>;
}
