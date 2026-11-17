import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect, it, vi} from 'vitest';
import GuidedResult from './GuidedResult.jsx';

it('keeps structured status, escaped examples, disclosure and the host action usable', async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement('div'); document.body.append(host);
    const root = createRoot(host);
    let complete;
    const onAction = vi.fn(() => new Promise(resolve => {complete = resolve;}));
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', {configurable:true, value:{writeText}});
    const action = {label:'Review the next check', prompt:'Help me review the source settings.'};
    const input = {title:'A value needs review', scope:'Historical example', status:{label:'Needs review',tone:'warning'},
        checks:[{label:'Records received',status:'Confirmed',tone:'success'},{label:'Outcome',status:'Not verified'}],
        example:{label:'Recorded request',code:'https://example.test/collect?value=[Amount]&note=<script>',copyValue:'https://example.test/collect?value=%5BAmount%5D',highlights:['[Amount]']},
        nextStep:{title:'Review the source mapping',description:'1. **Provide** the evidence.\n2. Review the result, including `<script>` and [unsafe](javascript:alert).',action},evidence:{title:'What was checked',items:[{label:'Limit',value:'The outcome has not been verified.\n\n1. First missing check.\n2. Second missing check.'}]}};
    const button = label => [...host.querySelectorAll('button')].find(node => node.textContent === label || node.getAttribute('aria-label') === label);
    try {
        await act(async () => root.render(<GuidedResult {...input} onAction={onAction}/>));
        expect(host.querySelectorAll('dl.forge-guided-result__checks > div')).toHaveLength(2);
        expect(host.querySelector('[data-forge-status="success"]').classList.contains('bp6-minimal')).toBe(false);
        expect(host.querySelector('mark').textContent).toBe('[Amount]');
        expect(host.querySelector('script')).toBeNull();
        expect(host.querySelectorAll('.forge-guided-result__next ol > li')).toHaveLength(2);
        expect(host.querySelector('.forge-guided-result__next li strong').textContent).toBe('Provide');
        expect(host.querySelector('.forge-guided-result__next a')).toBeNull();
        expect(button('Expand What was checked').getAttribute('aria-expanded')).toBe('false');
        await act(async () => button('Expand What was checked').click());
        expect(button('Collapse What was checked').getAttribute('aria-expanded')).toBe('true');
        expect(host.textContent).toContain('The outcome has not been verified.');
        expect(host.querySelectorAll('.forge-guided-result__evidence ol > li')).toHaveLength(2);
        await act(async () => button('Copy').click());
        expect(writeText).toHaveBeenCalledWith(input.example.copyValue);
        expect(host.querySelector('[role="status"]').textContent).toBe('Copied Recorded request');
        await act(async () => button(action.label).click());
        expect(onAction).toHaveBeenCalledWith(action);
        expect(button(action.label).disabled).toBe(true);
        await act(async () => {complete();});
        expect(button(action.label).disabled).toBe(false);
        await act(async () => root.render(<GuidedResult {...input} onAction={async () => {throw Error('Try again');}}/>));
        await act(async () => button(action.label).click());
        expect(host.querySelector('[role="alert"]').textContent).toBe('Try again');
        expect(button(action.label).disabled).toBe(false);
    } finally {await act(async () => root.unmount()); host.remove();}
});

it('separates a check receipt from its finding and independently discloses supplied steps and evidence', async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement('div'); document.body.append(host);
    const root = createRoot(host);
    const onAction = vi.fn();
    const button = name => host.querySelector(`button[aria-label="${name}"]`);
    const input = {
        receipt:{title:'Source checked',subject:'public.example.test',detail:'Public settings reviewed October 5',tone:'success'},
        title:'A value is still placeholder text',scope:'Found the expected item in the published setup.',status:{tone:'warning'},
        values:[{label:'Amount',value:'[Amount]',tone:'warning'},{label:'Reference',value:'<script>example</script>'}],
        summary:'This field needs the actual amount.',limit:'A completed transaction was not tested.',
        nextStep:{title:'How to fix this',collapsible:true,description:'1. Replace the placeholder.\n2. Validate the resolved value.'},
        evidence:{title:'Check details',items:[{label:'Source',value:'The public published definition.'}]},
    };
    try {
        await act(async () => root.render(<GuidedResult {...input} onAction={onAction}/>));
        expect(host.querySelector('.forge-guided-result--receipt')).not.toBeNull();
        expect(host.querySelector('[data-forge-part="section-title"]').textContent).toBe('Source checked');
        expect(host.querySelector('.forge-guided-result__subject').textContent).toBe(input.receipt.subject);
        expect(host.querySelector('.forge-guided-result__receipt-icon').getAttribute('data-forge-status')).toBe('success');
        expect(host.querySelector('.forge-guided-result__finding h4').textContent).toBe(input.title);
        expect([...host.querySelectorAll('.forge-guided-result__values code')].map(node => node.textContent)).toEqual(input.values.map(value => value.value));
        expect(host.querySelector('script')).toBeNull();
        expect(host.querySelector('.forge-guided-result__limit').textContent).toBe(input.limit);
        expect(host.querySelector('.forge-guided-result__checks')).toBeNull();
        expect(button('Expand How to fix this').getAttribute('aria-expanded')).toBe('false');
        expect(button('Expand Check details').getAttribute('aria-expanded')).toBe('false');
        expect(button('Expand How to fix this').getAttribute('aria-controls')).not.toBe(button('Expand Check details').getAttribute('aria-controls'));
        await act(async () => button('Expand How to fix this').click());
        expect(host.querySelectorAll('.forge-guided-result__next ol > li')).toHaveLength(2);
        expect(button('Collapse How to fix this').getAttribute('aria-expanded')).toBe('true');
        expect(button('Expand Check details').getAttribute('aria-expanded')).toBe('false');
        await act(async () => button('Expand Check details').click());
        expect(host.querySelector('.forge-guided-result__evidence').textContent).toContain('The public published definition.');
        expect(button('Collapse How to fix this').getAttribute('aria-expanded')).toBe('true');
        expect(button('Collapse Check details').getAttribute('aria-expanded')).toBe('true');
        expect(onAction).not.toHaveBeenCalled();
    } finally {await act(async () => root.unmount()); host.remove();}
});

it('does not turn an incomplete inspection or unavailable values into a successful check', async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement('div'); document.body.append(host);
    const root = createRoot(host);
    try {
        await act(async () => root.render(<GuidedResult receipt={{title:'Check incomplete',subject:'example.test',tone:'info'}}
            title="The source could not be read" limit="The current setup remains unknown."/>));
        expect(host.textContent).toContain('Check incomplete');
        expect(host.querySelector('[data-forge-status="success"]')).toBeNull();
        expect(host.querySelector('.forge-guided-result__values')).toBeNull();
        expect(host.querySelector('.forge-guided-result__next')).toBeNull();
        expect(host.querySelector('.forge-guided-result__limit').textContent).toBe('The current setup remains unknown.');
    } finally {await act(async () => root.unmount()); host.remove();}
});
