import assert from 'node:assert/strict';
import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import {signal} from '@preact/signals-react';
import DataSourceFetcher from './DataSourceFetcher.jsx';
import QuickFilterInputs from './table/basic/QuickFilterInputs.jsx';

const denial = {status: 403, code: 'datasource_denied', scope: 'dataset', message: 'Datasource access denied. Adjust the filter or retry.'};
const input = signal({filter: {}, fetch: false});
const control = signal({loading: false, error: denial});
const fetchCollection = () => { calls += 1; };
let calls = 0;
const context = {
  identity: {dataSourceId: 'denied-windowDSrows', dataSourceRef: 'rows'},
  dataSource: {quickFilterSet: 'creativeId', filterSet: [{name: 'creativeId', filters: [{field: 'Id', placeholder: 'Creative ID'}]}]},
  signals: {input, control, collection: signal([]), selection: signal({})},
  handlers: {dataSource: {
    fetchCollection,
    peekFilter: () => input.peek().filter || {},
    setSilentFilterValues: ({filter = {}}) => { input.value = {...input.peek(), filter}; },
    setPage: page => { input.value = {...input.peek(), page, fetch: true}; fetchCollection(); },
  }},
};
function Screen({instance}) {
  return React.createElement(React.Fragment, null,
    React.createElement(DataSourceFetcher, {key: instance, context, fetchData: true}),
    React.createElement(QuickFilterInputs, {context}),
    React.createElement('div', {role: 'alert'}, control.value.error?.message || ''),
  );
}

let renderer;
await act(async () => { renderer = TestRenderer.create(React.createElement(Screen, {instance: 0})); });
assert.equal(calls, 0, 'terminal dataset denial stops fetchData mount request');
assert.equal(typeof renderer.root.findByProps({placeholder: 'Creative ID'}).props.onChange, 'function');
assert.match(renderer.root.findByProps({role: 'alert'}).children.join(''), /Datasource access denied/);

await act(async () => renderer.update(React.createElement(Screen, {instance: 1})));
assert.equal(calls, 0, 'remount does not retry the same terminal denial');
assert.ok(renderer.root.findByProps({placeholder: 'Creative ID'}));
assert.match(renderer.root.findByProps({role: 'alert'}).children.join(''), /Datasource access denied/);

await act(async () => {
  const filter = renderer.root.findByProps({placeholder: 'Creative ID'});
  filter.props.onChange({target: {value: '999999999'}});
  filter.props.onBlur();
});
assert.deepEqual(input.peek(), {filter: {Id: '999999999'}, fetch: true, page: 1});
assert.equal(calls, 1, 'committing an explicit quick filter still requests a fetch');
await act(async () => renderer.unmount());
console.log('rendered datasource denial retry behavior passed');
