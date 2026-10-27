import React, {useEffect, useRef, useState} from 'react';
import Button from '../Button.jsx';
import SelectControl from '../SelectControl.jsx';
import ArrayFields from '../primitives/ArrayFields.jsx';
import {typographyProps} from '../Typography.jsx';
import './ReportFilterBar.css';

function Choice({control, values, onChange, loadChoices, scopeKey, onChoices}) {
    const [open, setOpen] = useState(false), [query, setQuery] = useState('');
    const [state, setState] = useState({}), [retry, setRetry] = useState(0);
    const inputs = Object.fromEntries(Object.entries(control.inputs || {}).map(([name, alias]) => [name, values[alias]]));
    const key = JSON.stringify([scopeKey, control.id, control.dataSourceId, inputs]);
    const callbacks = useRef({loadChoices, onChoices}); callbacks.current = {loadChoices, onChoices};
    const current = state.key === key ? state : {};
    const selected = Array.isArray(values[control.id]) ? values[control.id] : values[control.id] == null ? [] : [values[control.id]];
    useEffect(() => {
        if ((!open && !control.refreshSelected) || current.choices) return;
        const controller = new AbortController();
        setState({key, loading: true});
        Promise.resolve().then(() => {
            if (typeof callbacks.current.loadChoices !== 'function') throw new Error('Choice provider is unavailable.');
            return callbacks.current.loadChoices(control.dataSourceId, inputs, {signal: controller.signal});
        }).then(result => {
            if (controller.signal.aborted) return;
            const choices = Array.isArray(result) ? result : result?.choices;
            if (!Array.isArray(choices)) throw new Error('Choice provider returned an invalid response.');
            const valid = choices.filter(choice => choice && ['string', 'number', 'boolean'].includes(typeof choice.value) && typeof choice.label === 'string');
            setState({key, choices: valid, omitted: result?.omitted || 0});
            callbacks.current.onChoices?.(control.id, valid, key);
        }).catch(error => { if (!controller.signal.aborted) setState({key, error: error.message || 'Choices could not be loaded.'}); });
        return () => controller.abort();
    }, [key, open, retry, control.refreshSelected]);
    const choices = current.choices || [];
    return <fieldset className="forge-report-filter-choice">
        <legend>{control.label}{control.required ? ' (required)' : ''}</legend>
        <details open={open} onToggle={event => setOpen(event.currentTarget.open)}>
            <summary aria-label={control.label}>{current.loading ? 'Loading choices…' : current.error ? 'Choices unavailable' : selected.length ? `${selected.length} selected` : `Choose ${control.label.toLowerCase()}`}</summary>
            <div className="forge-report-filter-choice-panel">
                {current.error && <><span role="alert">{current.error}</span><Button onClick={() => setRetry(value => value + 1)}>Retry choices</Button></>}
                {current.choices && <>
                    {current.omitted > 0 && <span role="status">{current.omitted} {current.omitted === 1 ? 'entry has' : 'entries have'} no selectable ID and {current.omitted === 1 ? 'is' : 'are'} omitted.</span>}
                    <label>Find {control.label}<input type="search" value={query} onChange={event => setQuery(event.target.value)}/></label>
                    <div role="group" aria-label={control.label} className="forge-report-filter-choice-list">
                        {choices.filter(choice => choice.label.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(choice =>
                            <label key={JSON.stringify(choice.value)}><input type={control.multiple === false ? 'radio' : 'checkbox'} name={control.id}
                                checked={selected.includes(choice.value)} onChange={event => onChange(control.id, event.target.checked
                                    ? control.multiple === false ? [choice.value] : [...selected.filter(value => value !== choice.value), choice.value]
                                    : selected.filter(value => value !== choice.value))}/>{choice.label}</label>)}
                        {!choices.filter(choice => choice.label.toLocaleLowerCase().includes(query.toLocaleLowerCase())).length && <span>No matching {control.label.toLowerCase()}</span>}
                    </div>
                </>}
                <Button variant="ghost" size="compact" onClick={() => onChange(control.id, [])}>Clear {control.label}</Button>
            </div>
        </details>
    </fieldset>;
}

// Hosts normalize published metadata into controls and own authenticated choice
// transport. This component never constructs resource URIs or permission grants.
export default function ReportFilterBar({controls = [], values = {}, onChange, onApply, onReset, loadChoices,
    scopeKey = '', onChoices, busy = false, applyDisabled = false, error = '', placement = 'top', className = ''}) {
    if (!controls.length) return null;
    return <form className={`forge-report-filter-bar ${className}`.trim()} data-filter-placement={['left','rail-left'].includes(placement)?'left':['right','rail-right'].includes(placement)?'right':'top'} aria-label="Report filters"
        onSubmit={event => {event.preventDefault(); onApply?.();}} {...typographyProps('body')}>
        {controls.map(control => {
            if (control.kind === 'choice') return <Choice key={control.id} {...{control, values, onChange, loadChoices, scopeKey, onChoices}}/>;
            if (control.kind === 'dateRange') return <fieldset key={control.id}><legend>{control.label}</legend>
                {[['from', control.start], ['to', control.end]].map(([edge, alias]) => <label key={alias}>{control.label} {edge}
                    <input type="date" required={control.required} aria-required={control.required || undefined} value={values[alias] ?? ''} onChange={event => onChange(alias, event.target.value)}/></label>)}
            </fieldset>;
            if (control.kind === 'boolean') return <label key={control.id}><input aria-label={control.label} type="checkbox" checked={values[control.id] === true}
                onChange={event => onChange(control.id,event.target.checked)}/>{control.label}</label>;
            if (control.kind === 'select') return <label key={control.id}>{control.label}
                <SelectControl aria-label={control.label} value={String((control.choices || []).findIndex(choice => choice.value === values[control.id]))}
                    onChange={event => onChange(control.id, control.choices[Number(event.target.value)].value)}>
                    <option value="-1" disabled>Choose a value</option>
                    {(control.choices || []).map((choice, index) => <option key={index} value={index}>{choice.label}</option>)}
                </SelectControl></label>;
            if (control.kind === 'list') return <fieldset key={control.id} className="forge-report-filter-list"><legend>{control.label}{control.required ? ' (required)' : ''}</legend>
                <ArrayFields item={{id:`report-${control.id}`}} value={(Array.isArray(values[control.id]) ? values[control.id] : []).map(value=>({value}))}
                    onChange={rows=>onChange(control.id,rows.map(row=>row.value))} fields={[{field:'value',label:control.label,type:'text'}]} newRow={{value:''}}
                    addLabel={`Add ${control.label}`} removeLabel={`Remove ${control.label}`} rowLabel={`${control.label} row`}/></fieldset>;
            return <label key={control.id}>{control.label}{control.required ? ' (required)' : ''}
                <input aria-label={control.label} type={control.kind === 'number' ? 'number' : 'text'} required={control.required} value={values[control.id] ?? ''}
                    onChange={event => onChange(control.id, control.kind === 'number' && event.target.value !== '' ? Number(event.target.value) : event.target.value)}/></label>;
        })}
        <div className="forge-report-filter-actions"><Button type="submit" variant="primary" disabled={busy || applyDisabled}>Apply filters</Button>
            <Button variant="secondary" disabled={busy} onClick={onReset}>Reset filters</Button></div>
        {error && <span role="alert">{error}</span>}
    </form>;
}
