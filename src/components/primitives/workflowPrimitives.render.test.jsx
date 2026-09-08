import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import AssignmentPicker from './AssignmentPicker.jsx';
import HistoryDiff from './HistoryDiff.jsx';
import PermissionBoundary, {permissionBoundaryAllows} from './PermissionBoundary.jsx';
import ScheduleEditor from './ScheduleEditor.jsx';
import StatusWorkflow from './StatusWorkflow.jsx';
import TreeEditor from './TreeEditor.jsx';
import UploadCollection from './UploadCollection.jsx';
import Wizard from './Wizard.jsx';
import {ResponsiveCardRows, responsiveCardsSupported, responsiveTarget} from './ResponsiveDataGrid.jsx';
import {derivedSourceState} from './DerivedDataSource.jsx';

const signal = (value) => ({value, peek: () => value});
const data = {
  available: [{id: 1, name: 'One'}],
  assigned: [{id: 2, name: 'Two'}],
  tree: [{id: 'root', name: 'Root', children: [{id: 'leaf', name: 'Leaf'}]}],
  history: [{before: {name: 'Old'}, after: {name: 'New'}}],
  schedule: [{start: '2026-01-01T00:00:00Z', end: '2026-01-02T00:00:00Z'}],
};
const root = {
  authorization: {resource: {capabilities: {write: true}}},
  identity: {dataSourceRef: 'root'},
  signals: {form: signal({status: 'inactive'}), windowForm: signal({})},
  handlers: {dataSource: {getFormData: () => ({status: 'inactive'}), peekFormData: () => ({ready: true})}},
  Context(ref) {
    return {
      ...root,
      identity: {dataSourceRef: ref},
      signals: {...root.signals, collection: signal(data[ref] || []), selection: signal({})},
    };
  },
};

function includes(markup, value) {
  if (!markup.includes(value)) throw new Error(`expected rendered primitive to include ${value}: ${markup}`);
}

includes(renderToStaticMarkup(<AssignmentPicker context={root} container={{assignmentPicker: {availableDataSourceRef: 'available', assignedDataSourceRef: 'assigned', identityFields: ['id'], labelField: 'name'}}}/>), 'forge-assignment-picker');
includes(renderToStaticMarkup(<StatusWorkflow context={root} container={{statusWorkflow: {stateField: 'status', transitions: [{id: 'activate', from: ['inactive'], to: 'active', label: 'Activate', command: {dataSourceRef: 'patch'}}]}}}/>), 'Activate');
includes(renderToStaticMarkup(<TreeEditor context={root} container={{treeEditor: {dataSourceRef: 'tree', identityField: 'id', labelField: 'name', childrenField: 'children'}}}/>), 'Leaf');
includes(renderToStaticMarkup(<Wizard context={root} container={{wizard: {steps: [{id: 'one', label: 'One', containerId: 'one'}]}}} renderStep={() => <div>Step content</div>}/>), 'Step content');
includes(renderToStaticMarkup(<UploadCollection context={root} container={{uploadCollection: {accept: ['text/csv'], upload: {dataSourceRef: 'upload'}}}}/>), 'forge-upload-collection');
includes(renderToStaticMarkup(<HistoryDiff context={root} container={{historyDiff: {dataSourceRef: 'history', beforeField: 'before', afterField: 'after'}}}/>), 'Old');
includes(renderToStaticMarkup(<ScheduleEditor context={root} container={{scheduleEditor: {dataSourceRef: 'schedule', startField: 'start', endField: 'end'}}}/>), 'forge-schedule-editor');
includes(renderToStaticMarkup(<PermissionBoundary context={root} container={{permissionBoundary: {capability: 'write'}}}><span>Allowed</span></PermissionBoundary>), 'Allowed');
if (!permissionBoundaryAllows({capability: 'write'}, root)) throw new Error('permission boundary rejected an allowed capability');
if (!permissionBoundaryAllows({mode: 'selection', dataSourceRef: 'authorization', identityField: 'id', capability: 'write'}, {...root, signals: {...root.signals, selection: signal({selection: []})}})) throw new Error('selection boundary hid its producer before any selection existed');
const selectionRoot = {
  ...root,
  signals: {...root.signals, selection: signal({selection: [{id: 1}]})},
  Context: () => ({signals: {collection: signal([{resourceId: 1, capabilities: {write: true}}])}}),
};
if (!permissionBoundaryAllows({mode: 'selection', dataSourceRef: 'authorization', identityField: 'id', capability: 'write'}, selectionRoot)) throw new Error('selection permission rejected an authorized row');
selectionRoot.Context = () => ({signals: {collection: signal([{resourceId: 1, capabilities: {write: false}}])}});
if (permissionBoundaryAllows({mode: 'selection', dataSourceRef: 'authorization', identityField: 'id', capability: 'write'}, selectionRoot)) throw new Error('selection permission allowed a denied row');
if (!permissionBoundaryAllows({mode: 'resource', capability: 'write'}, root)) throw new Error('resource permission must not be rewritten as selection permission');
if (responsiveTarget(390) !== 'phone' || responsiveTarget(900) !== 'narrow' || responsiveTarget(1200) !== 'desktop') throw new Error('responsive targets are not stable');
const cards = renderToStaticMarkup(<ResponsiveCardRows rows={[{id: 1, name: 'Example'}]} columns={[{id: 'name', name: 'Name'}]}/>);
includes(cards, '<dt>Name</dt><dd>Example</dd>');
const handler = (value) => ({isDefined: () => true, execute: () => value});
const actionCards = renderToStaticMarkup(<ResponsiveCardRows
  rows={[{id: 1, watching: false}]}
  columns={[{id: 'watching', type: 'button', icon: 'star-empty', iconFromValue: true, pressedWhenValue: 'star', cellProperties: {'aria-label': 'Campaign watch'}}]}
  context={root}
  columnHandlers={{watching: {onValue: handler('star'), onProperties: handler({'aria-label': 'Unwatch Campaign'}), onReadonly: handler(true), onClick: handler(true)}}}
  onRowClick={() => true}
/>);
includes(actionCards, 'aria-label="Unwatch Campaign"');
includes(actionCards, 'aria-pressed="true"');
includes(actionCards, 'disabled=""');
if (!responsiveCardsSupported({selectionEnabled: false, toolbar: {items: []}, pagination: {pageSize: 20}}, {selectionMode: 'none'})) throw new Error('read-only cards rejected toolbar or pagination');
if (responsiveCardsSupported({}, {selectionMode: 'multi'})) throw new Error('editable multi-selection table was unsafely rendered as read-only cards');
if (derivedSourceState([{loaded: false}, {loaded: true}]).ready) throw new Error('derived source published before all inputs loaded');
if (!derivedSourceState([{loaded: true}, {loaded: true}]).ready) throw new Error('derived source did not publish completed inputs');

console.log('workflow primitive render contracts passed');
