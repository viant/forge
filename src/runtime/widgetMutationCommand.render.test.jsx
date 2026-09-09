import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import WidgetRenderer from './WidgetRenderer.jsx';

const signal = (value) => ({value, peek: () => value});
const context = {
    signals: {
        control: signal({}),
        form: signal({name: 'Ready'}),
        formStatus: signal({dirty: true}),
        input: signal({}),
        windowForm: signal({}),
    },
    Context: () => ({handlers: {dataSource: {setInputParameters() {}, fetchCollection() {}}}}),
};

const html = renderToStaticMarkup(<WidgetRenderer
    context={context}
    item={{
        id: 'saveRecord',
        label: 'Save Record',
        type: 'button',
        intent: 'primary',
        mutationCommand: {dataSourceRef: 'record_patch'},
    }}
/>);

assert.match(html, /forge-mutation-command/);
assert.match(html, /data-command-phase="idle"/);
assert.match(html, /bp6-intent-primary/);
assert.match(html, /bp6-button-text">Save Record<\/span>/);
assert.match(html, /aria-live="polite"/);

const disabledButton = renderToStaticMarkup(<WidgetRenderer
    context={context}
    item={{
        id: 'unsafeSave',
        label: 'Save',
        type: 'button',
        tooltip: 'Disabled until sparse updates are safe.',
        disabledWhen: {source: 'windowForm', field: 'sparseSafe', notEquals: true},
    }}
/>);
assert.match(disabledButton, /title="Disabled until sparse updates are safe\."/);
assert.match(disabledButton, /tabindex="0"/);
assert.match(disabledButton, /disabled=""/);

const readOnlyInput = renderToStaticMarkup(<WidgetRenderer
    context={context}
    item={{
        id: 'unsafeName',
        label: 'Name',
        type: 'text',
        scope: 'form',
        dataField: 'name',
        readOnlyWhen: {source: 'windowForm', field: 'sparseSafe', notEquals: true},
    }}
/>);
assert.match(readOnlyInput, /forge-control-wrapper is-readonly/);
assert.match(readOnlyInput, /readonly=""/);

console.log('widgetMutationCommand ✓ item actions use the generic mutation lifecycle');
