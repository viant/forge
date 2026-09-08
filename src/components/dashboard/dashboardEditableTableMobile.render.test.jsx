import React from 'react';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {DashboardEditableTable} from './DashboardBlocks.jsx';

const rows = [{tierLabel: 'Tier 1', thresholdFrom: 0, openMarketPercent: 1.11, clientNonPgPercent: 1.22, clientPgPercent: 1.33, managedPercent: 1.44}];
const collection = {value: rows, peek: () => rows};
const dataSource = {
    peekFullCollection: () => rows,
    peekCollection: () => rows,
    setCollection: () => true,
};
const authorization = {value: {principal: {features: ['EXPOSE_CO_MANAGED_FEE']}}};
const child = {signals: {collection}, handlers: {dataSource}};
const context = {signals: {authorization}, authorization: authorization.value, Context: () => child};
const container = {
    dataSourceRef: 'rates',
    allowAdd: false,
    allowRemove: false,
    quickFilter: false,
    mobileCards: {
        enabled: true,
        titleField: 'tierLabel',
        metaField: 'thresholdFrom',
        metaLabel: 'Threshold',
        metaFormat: 'currency',
        fields: ['openMarketPercent', 'clientNonPgPercent', 'clientPgPercent', 'managedPercent'],
        requiredFields: ['openMarketPercent', 'clientNonPgPercent', 'clientPgPercent'],
    },
    columns: [
        {key: 'tierLabel', label: 'Tier', frozen: true, editor: false},
        {key: 'thresholdFrom', label: 'Threshold', format: 'currency', editor: false},
        {key: 'openMarketPercent', label: 'Open Market %', cardLabel: 'Open Market and Marketplace/Custom Deals', tooltip: 'Open Market tech fee', required: true, editor: {type: 'number'}},
        {key: 'clientNonPgPercent', label: 'Non-PG %', cardLabel: 'Client Deals Non-PG', required: true, editor: {type: 'number'}},
        {key: 'clientPgPercent', label: 'PG %', cardLabel: 'Client Deals PG', required: true, editor: {type: 'number'}},
        {key: 'managedPercent', label: 'Co-Managed %', cardLabel: 'Co-Managed service rate', editor: {type: 'number'}},
    ],
};

const markup = renderToStaticMarkup(<DashboardEditableTable container={container} context={context}/>);
for (const expected of [
    'forge-editable-collection--mobile-cards',
    'forge-editable-collection__card-header',
    '<strong>Tier 1</strong>',
    'Threshold: $0',
    'Open Market and Marketplace/Custom Deals *',
    'Client Deals Non-PG *',
    'Client Deals PG *',
    'Co-Managed service rate',
    'class="forge-editable-collection__card-field is-required"',
    'title="Open Market tech fee"',
]) assert.ok(markup.includes(expected), `missing rendered mobile editable-table contract: ${expected}`);
assert.equal((markup.match(/required=""/g) || []).length, 6, 'required fields must be marked in both desktop and mobile render trees');

console.log('dashboard editable table mobile cards render ✓');

