import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import Container from './Container.jsx';
import {registerContainerRenderer} from '../runtime/containerRendererRegistry.js';

const context = {
    identity: {windowId: 'hosted-window', dataSourceRef: 'fixture'},
    signals: {message: {value: [], peek: () => []}},
    handlers: {dataSource: {}},
    authorization: {canOpen: false},
};
const calls = [];
function HostRenderer(props) {
    calls.push(props);
    return <div data-host-renderer={props.container.kind}>Hosted content</div>;
}
registerContainerRenderer('mcpApp', HostRenderer);
registerContainerRenderer('custom.hostedFixture', HostRenderer);

// Host renderers own their visual output; no built-in panel or item is needed.
for (const kind of ['mcpApp', 'custom.hostedFixture']) {
    const container = {id: 'hosted-content', kind};
    const html = renderToStaticMarkup(<Container container={container} context={context} isActive={true} />);
    assert.match(html, /Hosted content/, `${kind} must reach the registered renderer`);
    assert.equal(calls.at(-1).container, container);
    assert.equal(calls.at(-1).context, context);
    assert.equal(calls.at(-1).isActive, true);
}

// Registration must still respect the normal container visibility condition.
const callsBeforeHidden = calls.length;
const hidden = renderToStaticMarkup(<Container context={context} container={{
    id: 'hidden-hosted', kind: 'custom.hostedFixture',
    visibleWhen: {source: 'authorization', field: 'canOpen', equals: true},
}} />);
assert.equal(hidden, '');
assert.equal(calls.length, callsBeforeHidden);

// Empty legacy and unknown kinds retain their invisible fetcher-only behavior.
for (const container of [
    {id: 'empty-legacy'},
    {id: 'unknown', kind: 'custom.uninstalledFixture'},
    {id: 'fetch-only', fetchData: true},
]) {
    assert.equal(renderToStaticMarkup(<Container container={container} context={context} />), '');
}
assert.equal(calls.length, callsBeforeHidden);
console.log('registered container renderer render tests passed');
