import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ViewDialogFooterAction} from './ViewDialog.jsx';

const context = {
    authorization: {resource: {capabilities: {write: true}}},
    Context: () => ({handlers: {dataSource: {setInputParameters() {}, fetchCollection() {}}}}),
};

const html = renderToStaticMarkup(<div className="dialog-footer-proof">
    <ViewDialogFooterAction
        action={{id: 'close', label: 'Close', close: true}}
        context={context}
    />
    <ViewDialogFooterAction
        action={{id: 'unsafe', label: 'Unsafe Save', tooltip: 'Disabled until sparse updates are safe.'}}
        context={context}
        disabled={true}
    />
    <ViewDialogFooterAction
        action={{
            id: 'save',
            label: 'Save Record',
            intent: 'primary',
            mutationCommand: {dataSourceRef: 'record_patch'},
        }}
        context={context}
        disabled={true}
    />
</div>);

assert.match(html, /dialog-footer-proof/);
assert.match(html, /bp6-button-text">Close<\/span>/);
assert.match(html, /forge-disabled-action-shell/);
assert.match(html, /title="Disabled until sparse updates are safe\." tabindex="0"/);
assert.match(html, /forge-mutation-command/);
assert.match(html, /bp6-intent-primary/);
assert.match(html, /title="Save Record"[^>]*disabled=""[^>]*bp6-intent-primary/);
assert.match(html, /bp6-button-text">Save Record<\/span>/);
assert.match(html, /aria-live="polite"/);

const closeIndex = html.indexOf('>Close</span>');
const saveIndex = html.indexOf('>Save Record</span>');
assert.ok(closeIndex >= 0 && saveIndex > closeIndex, 'Close and Save Record must render together in authored footer order');

console.log('viewDialogFooterActions ✓ mutation and ordinary actions share the dialog footer contract');
