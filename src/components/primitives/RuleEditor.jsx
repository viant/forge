import React from 'react';
import {Button, InputGroup} from '@blueprintjs/core';
import {resolveSelector, setSelector} from '../../utils/selector.js';
import {evaluatePlainVisibleWhen} from '../visibleWhen.js';
import {usePredicateSignals} from './usePredicateSignals.js';
import {changeRule, removeRule, ruleChildren, ruleOperators, newEditorRule, sameRuleChoice} from './ruleEditorModel.js';
import './RuleEditor.css';

const encode = value => JSON.stringify(value ?? null);
function Choice({label, value, choices, onChange}) {
  const known = choices.some(choice => sameRuleChoice(choice.value, value));
  return <select className="forge-rule-editor__select" aria-label={label} value={encode(value)} onChange={event => onChange(JSON.parse(event.currentTarget.value))}>
    {!known ? <option value={encode(value)}>{value == null ? 'Select…' : `Unknown (${String(value)})`}</option> : null}
    {choices.map(choice => <option key={encode(choice.value)} value={encode(choice.value)}>{choice.label}</option>)}
  </select>;
}
export default function RuleEditor({container, context}) {
  const spec = container.ruleEditor || {};
  const ref = spec.dataSourceRef || container.dataSourceRef;
  const scoped = !ref || context.identity?.dataSourceRef === ref ? context : context.Context?.(ref) || context;
  usePredicateSignals(scoped);
  const form = scoped.signals?.form?.value || scoped.handlers?.dataSource?.getFormData?.() || {};
  const root = resolveSelector(form, spec.field || 'rule');
  const optionHandler = spec.optionsHandler && scoped.lookupHandler?.(spec.optionsHandler);
  const options = typeof optionHandler === 'function' ? optionHandler({context: scoped}) : spec;
  const readonly = spec.readOnlyWhen ? evaluatePlainVisibleWhen(spec.readOnlyWhen, scoped) : false;
  const operatorField = spec.operatorField || 'operator', parameterField = spec.parameterField || 'field', valueField = spec.valueField || 'value';
  const childField = spec.childrenField || 'children';
  const write = transform => {
    if (spec.readOnlyWhen && evaluatePlainVisibleWhen(spec.readOnlyWhen, scoped)) return false;
    const current = scoped.handlers?.dataSource?.getFormData?.() || scoped.signals?.form?.peek?.() || {};
    const tree = resolveSelector(current, spec.field || 'rule');
    scoped.handlers?.dataSource?.setEditedFormData?.({values: setSelector(current, spec.field || 'rule', transform(tree))});
    return true;
  };
  const patch = (path, values) => write(tree => changeRule(tree, path, node => ({...node, ...values}), spec));
  const renderNode = (node, path = []) => {
    const label = path.length ? path.map(index => index + 1).join('.') : 'root';
    const isGroup = (options.groups || []).some(group => sameRuleChoice(group.value, node?.[operatorField]));
    if (isGroup) return <div className="forge-rule-editor__group" key={label}>
      <div className="forge-rule-editor__row">
        <span>Match</span><Choice label={`Rule group ${label}`} value={node[operatorField]} choices={options.groups || []} onChange={value => patch(path, {[operatorField]: value})}/>
        <Button small onClick={() => write(tree => changeRule(tree, path, group => ({...group, [childField]: [...ruleChildren(group, spec), newEditorRule(spec, options)]}), spec))}>Add rule</Button>
        <Button small onClick={() => write(tree => changeRule(tree, path, group => ({...group, [childField]: [...ruleChildren(group, spec), newEditorRule(spec, options, true)]}), spec))}>Add group</Button>
        {path.length ? <Button small minimal icon="cross" aria-label={`Remove group ${label}`} onClick={() => write(tree => removeRule(tree, path, spec))}/> : null}
      </div>
      <div className="forge-rule-editor__children">{ruleChildren(node, spec).map((child, index) => renderNode(child, [...path, index]))}</div>
    </div>;
    const operators = ruleOperators(node, spec, options);
    return <div className="forge-rule-editor__row" key={label}>
      <Choice label={`Rule ${label} parameter`} value={node?.[parameterField]} choices={options.fields || []} onChange={value => {
        const candidate = {...node, [parameterField]: value};
        const allowed = ruleOperators(candidate, spec, options);
        patch(path, {[parameterField]: value, [operatorField]: allowed.some(op => sameRuleChoice(op.value, node[operatorField])) ? node[operatorField] : null});
      }}/>
      <Choice label={`Rule ${label} operator`} value={node?.[operatorField]} choices={operators} onChange={value => patch(path, {[operatorField]: value})}/>
      <InputGroup aria-label={`Rule ${label} value`} value={node?.[valueField] ?? ''} maxLength={spec.maxValueLength} onChange={event => patch(path, {[valueField]: event.currentTarget.value})}/>
      <Button small minimal icon="cross" aria-label={`Remove rule ${label}`} onClick={() => write(tree => removeRule(tree, path, spec))}/>
    </div>;
  };
  return <fieldset className="forge-rule-editor" data-forge-primitive="ruleEditor" disabled={readonly}>
    <legend>{spec.label || 'Rules'}</legend>
    {root ? renderNode(root) : <span>Select a record to edit its rules.</span>}
  </fieldset>;
}
