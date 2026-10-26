import React, {useEffect, useId, useState} from 'react';
import {Button, FormGroup, HTMLSelect, InputGroup} from '@blueprintjs/core';
import {applyTableColumnPreferences, sanitizeTablePreferences} from '../../core/preferences/tablePreferences.js';

export default function TableViewPresets({model, columns, baseColumns, density, onApply}) {
    const fieldId = useId();
    const [selected, setSelected] = useState('');
    const [name, setName] = useState('');
    const view = model.views.find(entry => String(entry.id) === selected);
    useEffect(() => {
        if (selected && !model.loading && !view) {setSelected(''); setName('');}
    }, [selected, model.loading, view]);
    const preferences = () => sanitizeTablePreferences({version: 1, columns, density,
        frozenColumnIds: columns.filter(column => column.sticky === 'left').map(column => column.id)});
    const choose = event => {
        const value = event.target.value;
        const current = model.views.find(entry => String(entry.id) === value);
        setSelected(value);
        setName(current?.name || '');
        if (current) onApply(applyTableColumnPreferences(baseColumns, current.preferences), current.preferences);
    };
    return <section className="forge-table-settings__presets" aria-label="Saved views">
        <FormGroup label="Custom views" labelFor={`${fieldId}-view`}>
            <HTMLSelect id={`${fieldId}-view`} value={selected} onChange={choose} disabled={model.loading}>
                <option value="">Current columns</option>
                {model.views.map(entry => <option key={entry.id} value={String(entry.id)}>{entry.name}</option>)}
            </HTMLSelect>
        </FormGroup>
        <div className="forge-table-settings__preset-actions">
            <Button text="Default columns" disabled={model.loading} onClick={() => {
                setSelected(''); setName(''); onApply(baseColumns, {});
            }}/>
            <Button text="All columns" disabled={model.loading} onClick={() => {
                setSelected(''); setName(''); onApply(baseColumns.map(column => ({...column, visible: true})), {});
            }}/>
        </div>
        <FormGroup label="View name" labelFor={`${fieldId}-name`}>
            <InputGroup id={`${fieldId}-name`} value={name} disabled={model.loading} onChange={event => setName(event.target.value)}/>
        </FormGroup>
        <div className="forge-table-settings__preset-actions">
            <Button text="Add selection as preset" disabled={model.loading || !model.canSave || name === ''}
                onClick={() => model.save({name, preferences: preferences()})}/>
            <Button text="Update view" disabled={model.loading || !model.canSave || !view || name === ''}
                onClick={() => model.save({id: view.id, name, preferences: preferences()})}/>
            <Button text="Delete view" disabled={model.loading || !model.canRemove || !view}
                onClick={() => model.remove(view.id)}/>
        </div>
        {model.loading && <p role="status">Loading saved views…</p>}
        {model.error && <div role="alert">
            <p>{model.error.message || 'Unable to load saved views.'}</p>
            <Button text="Retry saved views" onClick={() => model.reload()}/>
        </div>}
    </section>;
}
