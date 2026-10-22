import React, {act, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {expect, it, vi} from 'vitest';
import LookupPickerDialog from './LookupPickerDialog.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const button = label => [...document.querySelectorAll('button')].find(el => el.textContent === label);
async function mount(component) {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => root.render(component));
    return {root, async close() {await act(async () => root.unmount()); host.remove();}};
}
async function until(check) {
    await vi.waitFor(async () => {
        await act(async () => {await new Promise(resolve => setTimeout(resolve, 0));});
        check();
    });
}

it('preserves the default single-selection contract', async () => {
    const select = vi.fn();
    const view = await mount(<LookupPickerDialog isOpen loadRows={async () => [{id: 1, name: 'First'}]} onSelect={select}/>);
    try {
        await until(() => expect(document.querySelector('[aria-label="Select First"]')).not.toBeNull());
        expect(document.querySelector('[role="checkbox"]')).toBeNull();
        await act(async () => document.querySelector('[aria-label="Select First"]').click());
        expect(select).toHaveBeenCalledWith({id: 1, name: 'First'});
        expect(button('Cancel')).toBeDefined();
    } finally {await view.close();}
});

it('keeps controlled multiple selections, clear and Done without closing on a row click', async () => {
    const source = async () => [{id: 1, name: 'First'}, {id: 2, name: 'Second'}];
    const done = vi.fn();
    function Fixture() {
        const [selected, setSelected] = useState(['1']);
        return <LookupPickerDialog isOpen multiple selectedKeys={selected} loadRows={source}
            onSelect={row => setSelected(old => old.includes(String(row.id)) ? old.filter(key => key !== String(row.id)) : [...old, String(row.id)])}
            onClearSelection={() => setSelected([])} onCancel={done}/>;
    }
    const view = await mount(<Fixture/>);
    try {
        await until(() => expect(document.querySelector('[aria-label="First"]')?.getAttribute('aria-checked')).toBe('true'));
        await act(async () => document.querySelector('[aria-label="Second"]').click());
        expect(document.querySelector('[aria-label="Second"]').getAttribute('aria-checked')).toBe('true');
        expect(done).not.toHaveBeenCalled();
        expect(document.body.textContent).toContain('2 selected');
        await act(async () => button('Clear selection').click());
        expect([...document.querySelectorAll('[role="checkbox"]')].every(el => el.getAttribute('aria-checked') === 'false')).toBe(true);
        await act(async () => button('Done').click());
        expect(done).toHaveBeenCalledTimes(1);
    } finally {await view.close();}
});

it('retries an explicit provider failure without changing selected keys', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('Temporary provider failure')).mockResolvedValue([{id: 1, name: 'First'}]);
    const select = vi.fn();
    const view = await mount(<LookupPickerDialog isOpen multiple selectedKeys={['1']} loadRows={load} onSelect={select}/>);
    try {
        await until(() => expect(document.querySelector('[role="alert"]')?.textContent).toContain('Temporary provider failure'));
        await act(async () => button('Try again').click());
        await until(() => expect(document.querySelector('[aria-label="First"]')?.getAttribute('aria-checked')).toBe('true'));
        expect(load).toHaveBeenCalledTimes(2);
        expect(select).not.toHaveBeenCalled();
    } finally {await view.close();}
});

it('aborts an obsolete lookup and ignores its late rows', async () => {
    let settle; let oldSignal;
    const oldLoad = ({signal}) => {oldSignal = signal; return new Promise(resolve => {settle = resolve;});};
    const freshLoad = async () => [{id: 2, name: 'Current'}];
    const view = await mount(<LookupPickerDialog isOpen multiple loadRows={oldLoad}/>);
    try {
        await until(() => expect(oldSignal).toBeDefined());
        await act(async () => view.root.render(<LookupPickerDialog isOpen multiple loadRows={freshLoad}/>));
        await until(() => expect(document.querySelector('[aria-label="Current"]')).not.toBeNull());
        expect(oldSignal.aborted).toBe(true);
        await act(async () => settle([{id: 1, name: 'Obsolete'}]));
        expect(document.querySelector('[aria-label="Obsolete"]')).toBeNull();
    } finally {await view.close();}
});
