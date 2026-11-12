import React, {useState} from 'react';
import {Button, Callout, Checkbox, FormGroup, HTMLSelect, InputGroup} from '@blueprintjs/core';
import {LazyEditor} from './LazyEditor.jsx';
import {previewParameterKind, serializePreviewParameters} from './previewParameters.js';
import './ReaderPreviewParameters.css';

export function ReaderPreviewParameters({metadata, diagnostics = [], pending, onRun, onRefresh, onClose}) {
  const [drafts, setDrafts] = useState({});
  const [errors, setErrors] = useState({});
  const schema = metadata?.schema;
  const properties = schema?.properties || {};
  const available = schema?.type === 'object';
  const update = (name, patch) => {
    setDrafts(current => ({...current, [name]: {...current[name], ...patch}}));
    setErrors(current => ({...current, [name]: ''}));
  };
  const run = event => {
    event.preventDefault();
    const result = serializePreviewParameters(properties, drafts);
    setErrors(result.errors);
    if (Object.keys(result.errors).length === 0) onRun(result.input);
  };
  return <section aria-label="Preview parameters" className="studio-card studio-preview-parameters">
    <div className="studio-panel-heading"><h2>Preview parameters</h2><Button minimal icon="cross" aria-label="Close preview parameters" disabled={pending} onClick={onClose}/></div>
    {!available ? <Callout intent="warning" role="alert">
      {diagnostics.find(item => item.code === 'preview_input_unavailable')?.message || 'Preview parameter metadata is unavailable. Refresh the reader to try again.'}
      <Button onClick={onRefresh} disabled={pending}>Refresh parameters</Button>
    </Callout> : <form onSubmit={run} noValidate className="studio-preview-parameters-form">
      <p className="studio-muted studio-preview-parameters-hint">Select parameters to supply. Unselected values are omitted; the reader applies its defaults and validation.</p>
      <div className="studio-preview-parameters-fields">
      {Object.entries(properties).map(([name, field], index) => {
        const draft = drafts[name] || {}, kind = previewParameterKind(field), id = `preview-parameter-${index}`;
        const text = draft.text ?? (kind === 'boolean' ? 'false' : '');
        const disabled = pending || !draft.supplied;
        return <div key={name} className={`studio-preview-parameter${kind === 'json' && draft.supplied ? ' studio-preview-parameter-expanded' : ''}`}>
          <Checkbox className="forge-blueprint-checkbox-compat" label={name} aria-label={`Supply ${name}`} checked={Boolean(draft.supplied)} disabled={pending} onChange={event => update(name, {supplied:event.target.checked})}/>
          <FormGroup helperText={errors[name] || field.description || field.format} intent={errors[name] ? 'danger' : undefined}>
            {kind === 'boolean' ? <Checkbox className="forge-blueprint-checkbox-compat" label={text === 'true' ? 'True' : 'False'} id={id} aria-label={name} checked={text === 'true'} disabled={disabled} onChange={event => update(name, {text:String(event.target.checked)})}/>
              : kind === 'enum' ? <HTMLSelect id={id} aria-label={name} value={text} disabled={disabled} onChange={event => update(name, {text:event.target.value})}>
                <option value="">Choose a value</option>{field.enum.map((value, i) => <option key={i} value={JSON.stringify(value)}>{JSON.stringify(value)}</option>)}
              </HTMLSelect>
              : kind === 'json' && draft.supplied ? <LazyEditor value={text} language="json" height="96px" ariaLabel={name} readOnly={disabled} onChange={value => update(name, {text:value})}/>
              : <InputGroup id={id} aria-label={name} value={text} disabled={disabled} inputMode={kind === 'number' ? 'decimal' : undefined} onChange={event => update(name, {text:event.target.value})}/>}
          </FormGroup>
        </div>;
      })}
      </div>
      <div className="studio-preview-parameters-actions">
      {Object.values(errors).some(Boolean) && <Callout role="alert" intent="danger">Correct the values that cannot be serialized before running.</Callout>}
      <Button type="submit" intent="primary" icon="play" disabled={pending} loading={pending}>Run with parameters</Button>
      </div>
    </form>}
  </section>;
}
