import React from 'react';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import DraftForm from './DraftForm.jsx';
import MutationCommand from './MutationCommand.jsx';
import QueryToolbar from './QueryToolbar.jsx';
import ResourceHeader from './ResourceHeader.jsx';
import DataStateBoundary from './DataStateBoundary.jsx';
import RelationDrill from './RelationDrill.jsx';
import NotificationRules from './NotificationRules.jsx';
import MetricSummary from './MetricSummary.jsx';
import DetailView, {resolveDetailRecord} from './DetailView.jsx';
import MasterDetail from './MasterDetail.jsx';

const signal = (value) => ({value, peek: () => value});
let form = {id: 1, name: 'Alpha', childCount: 0};
const dataContext = {
  identity: {dataSourceRef: 'record'},
  resource: {timeZone: 'UTC'},
  signals: {form: signal(form), collection: signal([form]), selection: signal({selected: form, rowIndex: 0}), windowForm: signal({}), metrics: signal({total: 12.5, delta: 1}), control: signal({loaded: true})},
  handlers: {dataSource: {getFormData: () => form, setFormData: ({values}) => { form = values; }}},
};
const context = {...dataContext, Context: () => dataContext, lookupHandler: () => () => true};
const has = (markup, value) => { if (!markup.includes(value)) throw new Error(`missing ${value}: ${markup}`); };

has(renderToStaticMarkup(<DraftForm context={context} container={{draftForm: {dataSourceRef: 'record', submit: {dataSourceRef: 'patch'}}}}/>), 'forge-draft-form');
has(renderToStaticMarkup(<MutationCommand context={context} command={{dataSourceRef: 'patch'}}/>), 'data-command-phase="idle"');
has(renderToStaticMarkup(<QueryToolbar context={context} container={{queryToolbar: {items: []}}}/>), 'queryToolbar');
has(renderToStaticMarkup(<ResourceHeader context={context} container={{resourceHeader: {titleField: 'name', fields: [{label: 'ID', field: 'id'}], actions: [{id: 'watch', label: 'Watch', handler: 'Host.watch'}]}}}/>), 'Alpha');
has(renderToStaticMarkup(<DataStateBoundary context={context} container={{dataSourceRef: 'record', dataStateBoundary: {dataSourceRefs: ['record']}}}><span>Ready content</span></DataStateBoundary>), 'Ready content');
const emptyDataContext = {...dataContext, signals: {...dataContext.signals, form: signal({}), collection: signal([]), metrics: signal({}), control: signal({loaded: true})}};
const emptyBoundaryContext = {...context, Context: () => emptyDataContext};
has(renderToStaticMarkup(<DataStateBoundary context={emptyBoundaryContext} container={{dataSourceRef: 'record', dataStateBoundary: {dataSourceRefs: ['record'], renderEmptyContent: true}}}><span>Table-owned empty state</span></DataStateBoundary>), 'Table-owned empty state');
has(renderToStaticMarkup(<RelationDrill context={context} container={{relationDrill: {countField: 'childCount', emptyText: 'No children', link: {windowKey: 'children'}}}}/>), 'No children');
has(renderToStaticMarkup(<NotificationRules context={context} container={{notificationRules: {rules: [{id: 'notice', message: 'Review input', intent: 'warning'}]}}}/>), 'Review input');
has(renderToStaticMarkup(<MetricSummary context={context} container={{metricSummary: {dataSourceRef: 'summary', metrics: [{id: 'total', label: 'Total', field: 'total', format: 'currency2'}]}}}/>), '$12.50');
has(renderToStaticMarkup(<DetailView context={context} container={{detailView: {dataSourceRef: 'record', sections: [{id: 'general', label: 'General', fields: [{id: 'name', label: 'Name', field: 'name'}]}]}}}/>), 'data-detail-field-id="name"');
const collectionDetailContext = {...dataContext, signals: {...dataContext.signals, form: signal({name: 'Seed'}), collection: signal([{name: 'Fetched'}])}};
assert.equal(resolveDetailRecord(collectionDetailContext, 'collection').name, 'Fetched');
has(renderToStaticMarkup(<DetailView context={{...context, Context: () => collectionDetailContext}} container={{detailView: {dataSourceRef: 'record', source: 'collection', fields: [{id: 'name', label: 'Name', field: 'name'}]}}}/>), 'Fetched');
const detailContext = {...dataContext, identity: {dataSourceRef: 'detail'}, signals: {...dataContext.signals, form: signal({}), collection: signal([]), selection: signal({})}};
const coordinatedContext = {...context, Context: (ref) => ref === 'detail' ? detailContext : dataContext};
has(renderToStaticMarkup(<MasterDetail context={coordinatedContext} container={{containers: [{id: 'master', dataSourceRef: 'record'}, {id: 'detail', dataSourceRef: 'detail'}], masterDetail: {identityFields: ['id'], master: {containerId: 'master'}, detail: {containerId: 'detail'}, responsive: {wide: 'split'}}}} renderRegion={(entry) => <div>{entry.id}</div>}/>), 'forge-master-detail');
has(renderToStaticMarkup(<MasterDetail context={context} container={{containers: [{id: 'master', dataSourceRef: 'record'}, {id: 'detail', dataSourceRef: 'record'}], masterDetail: {identityFields: ['id'], master: {containerId: 'master'}, detail: {containerId: 'detail'}}}}/>), 'Master and detail must use distinct datasource contexts');

console.log('presentation primitive render contracts passed');
