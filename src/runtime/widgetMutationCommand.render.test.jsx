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

console.log('widgetMutationCommand ✓ item actions use the generic mutation lifecycle');
