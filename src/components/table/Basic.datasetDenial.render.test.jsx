import assert from 'node:assert/strict';
import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import {signal} from '@preact/signals-react';
import Basic from './Basic.jsx';
import {SettingProvider} from '../../core/context/Setting.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const denial = {status: 403, code: 'datasource_denied', scope: 'dataset', message: 'Datasource access denied. Adjust the filter or retry.'};
const input = signal({fetch: false, filter: {}, page: 1});
const control = signal({loading: false, loaded: false, error: denial});
const collection = signal([]);
const selection = signal({selected: null, rowIndex: -1, selection: []});
const message = signal([]);
const form = signal({});
const formStatus = signal({dirty: false, version: 0});
const windowForm = signal({});
const filterSet = {name: 'creativeId', filters: [{field: 'Id', placeholder: 'Creative ID'}]};
let fetchCalls = 0;
const handlers = {dataSource: {
  fetchCollection: () => {fetchCalls += 1; return Promise.resolve();},
  getCollection: () => collection.peek() || [],
  peekCollection: () => collection.peek() || [],
  getCollectionInfo: () => ({}),
  isInactive: () => false,
  getSelection: () => selection.peek(),
  isSelected: () => false,
  getPage: () => input.peek().page || 1,
  getFilterSets: () => [filterSet],
  getFilterSet: () => [filterSet],
  peekFilter: () => input.peek().filter || {},
  setSilentFilterValues: ({filter = {}}) => {input.value = {...input.peek(), filter};},
  setPage: page => {input.value = {...input.peek(), page, fetch: true}; fetchCalls += 1;},
  setAllSelection() {},
  resetSelection() {},
}};
const context = {
  identity: {windowId: 'creative-denial-remount', dataSourceRef: 'creative_workspace_list'},
  dataSource: {selectionMode: 'none', quickFilterSet: 'creativeId', filterSet: [filterSet]},
  signals: {input, control, collection, selection, message, form, formStatus, windowForm},
  handlers,
  tableSettingKey: () => 'creative-denial-remount:table',
};
const container = {id: 'creative-list', table: {selectionEnabled: false, toolbar: {items: [
  {id: 'quickFilter'}, {id: 'refresh', type: 'refresh', label: 'Refresh'},
]}}};
const services = {tablePreferences: {get: async () => null, set: async () => null, reset: async () => null}};
const renderTable = instance => <SettingProvider endpoints={{}} connectorConfig={{}} services={services}>
  <Basic key={instance} context={context} container={container} columns={[]}/>
</SettingProvider>;

let initialRenderer, renderer;
await act(async () => {initialRenderer = TestRenderer.create(renderTable(0));});
assert.equal(fetchCalls, 0, 'a denied empty-table mount must not dispatch the default onInit fetch');
assert.ok(initialRenderer.root.findByProps({placeholder: 'Creative ID'}), 'the existing quick filter remains rendered');

// A new Basic instance models the table being remounted by the workspace after
// an error-state render. It shares the existing datasource signals.
await act(async () => {renderer = TestRenderer.create(renderTable(1));});
assert.equal(fetchCalls, 0, 'remounting an empty table with the terminal denial does not auto-fetch');
assert.ok(renderer.root.findByProps({placeholder: 'Creative ID'}), 'the filter remains available after remount');
assert.equal(control.peek().error.scope, 'dataset');

await act(async () => {
  const filter = renderer.root.findByProps({placeholder: 'Creative ID'});
  filter.props.onChange({target: {value: '999999999'}});
  filter.props.onBlur();
});
assert.equal(fetchCalls, 1, 'committing an explicit filter still dispatches a fetch');
assert.equal(input.peek().fetch, true);

await act(async () => {
  renderer.root.findByProps({'aria-label': 'Refresh data'}).props.onClick();
});
assert.equal(fetchCalls, 2, 'the explicit Refresh action still dispatches a fetch after denial');
console.log('Basic table dataset-denial remount regression passed');
