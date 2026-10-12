import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {signal} from '@preact/signals-react';
import Container from './Container.jsx';

const contexts = {};
function contextFor(ref, inactive, write = true) {
    return {
        identity: {windowId: 'toolbar-context', dataSourceRef: ref},
        signals: {control: signal({inactive}), message: signal([]), form: signal({}), windowForm: signal({}), formStatus: signal({dirty: false}), selection: signal({})},
        handlers: {dataSource: {}},
        authorization: {resource: {capabilities: {write}}},
        Context: target => contexts[target],
    };
}
contexts.related = contextFor('related', true);
contexts.details = contextFor('details', false);
contexts.denied = contextFor('denied', false, false);
const toolbar = {items: [{id: 'edit', label: 'Edit', disabledWhen: {source: 'authorization', field: 'resource.capabilities.write', notEquals: true}}]};
const render = (dataSourceRef, extra = {}) => renderToStaticMarkup(<Container context={contexts.related} container={{id: 'details-panel', dataSourceRef, toolbar: {...toolbar, ...extra}}} />);
assert.doesNotMatch(render('details'), /disabled=""/, 'active container toolbar must not inherit inactive related datasource');
assert.match(render('denied'), /disabled=""/, 'container authority still denies a toolbar action');
assert.match(render('details', {dataSourceRef: 'related'}), /disabled=""/, 'explicit toolbar datasource remains authoritative');
assert.match(render(undefined), /disabled=""/, 'unbound container preserves inherited inactive datasource');
console.log('container toolbar datasource context render tests passed');
