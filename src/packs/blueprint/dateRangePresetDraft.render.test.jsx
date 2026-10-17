import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {signal, effect} from '@preact/signals-react';
import {useSignals} from '@preact/signals-react/runtime';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {DateRangePresetInput} from './index.jsx';

let host, root;
beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div'); document.body.append(host);
    root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

function fixture() {
    const form = signal({period: 'year'}), changed = vi.fn();
    function Harness({revision = 0}) {
        useSignals();
        const current = form.value;
        // Hosts can recreate context when a bound value changes. Draft dates
        // must survive this without changing applied datasource parameters.
        const context = {signals: {windowForm: form}, revision};
        return <DateRangePresetInput context={context} value={current.period}
            onChange={value => { changed(value); form.value = {...form.peek(), period: value}; }}
            startField="start" endField="end" granularityField="grain" customApplyEnabled
            options={[{value: 'year', label: 'Year'}, {value: 'custom', label: 'Custom'}]}/>;
    }
    return {form, changed, Harness};
}
const input = label => document.querySelector(`input[aria-label="${label}"]`);
async function date(label, value) {
    await act(async () => {
        const node = input(label);
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(node, value);
        node.dispatchEvent(new Event('input', {bubbles: true}));
        node.dispatchEvent(new Event('change', {bubbles: true}));
    });
}
async function open() { await act(async () => host.querySelector('button').click()); }
const apply = () => [...document.querySelectorAll('button')].find(node => node.textContent === 'Apply dates');

it('keeps custom dates local across context changes and applies one coherent range', async () => {
    const {form, changed, Harness} = fixture();
    await act(async () => root.render(<Harness/>));
    const baseline = {...form.peek()};
    const ranges = [];
    const stop = effect(() => { const value = form.value; ranges.push([value.period, value.start, value.end, value.grain]); });
    await open();
    await date('Custom start date', '2026-01-02');
    await date('Custom end date', '2026-01-03');
    await act(async () => root.render(<Harness revision={1}/>));
    expect(input('Custom start date').value).toBe('2026-01-02');
    expect(input('Custom end date').value).toBe('2026-01-03');
    expect(form.peek()).toEqual(baseline);
    expect(changed).not.toHaveBeenCalled();
    expect(ranges).toHaveLength(1);
    await act(async () => apply().click());
    expect(form.peek()).toMatchObject({period: 'custom', start: '2026-01-02', end: '2026-01-03', grain: 'hour'});
    expect(changed).toHaveBeenCalledExactlyOnceWith('custom');
    expect(ranges).toHaveLength(2);
    stop();
});

it('rejects an inverted draft without committing datasource date parameters', async () => {
    const {form, changed, Harness} = fixture();
    await act(async () => root.render(<Harness/>));
    const baseline = {...form.peek()};
    await open();
    await date('Custom start date', '2026-01-04');
    await date('Custom end date', '2026-01-03');
    expect(apply().disabled).toBe(true);
    await act(async () => apply().click());
    expect(form.peek()).toEqual(baseline);
    expect(changed).not.toHaveBeenCalled();
});
