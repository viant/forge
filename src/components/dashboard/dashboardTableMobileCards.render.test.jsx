import React from 'react';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import DashboardTableContent from './DashboardTableContent.jsx';

const rows = [{code: 'CA', name: 'California', rationale: 'National campaign priority.'}];
const context = {
    dataSource: {selectionMode: 'multi', uniqueKey: ['code']},
    signals: {
        collection: {value: rows},
        control: {value: {}},
        selection: {value: {selection: rows}},
    },
    handlers: {dataSource: {toggleSelection: () => true}},
};
const container = {
    selectionMode: 'multi',
    mobileCards: {
        enabled: true,
        titleField: 'name',
        metaField: 'code',
        metaLabel: 'Code',
        fields: ['rationale'],
    },
    columns: [
        {key: 'code', label: 'State code'},
        {key: 'name', label: 'State'},
        {key: 'rationale', label: 'Rationale'},
    ],
};

const markup = renderToStaticMarkup(
    <DashboardTableContent container={container} context={context}/>,
);
for (const expected of [
    'forge-dashboard-table-wrap--mobile-cards',
    'class="forge-dashboard-table"',
    'class="forge-dashboard-table-cards"',
    'class="forge-dashboard-table-card"',
    'aria-label="Select California"',
    'checked=""',
    '<strong>California</strong>',
    'Code: CA',
    '<dt>Rationale</dt>',
    '<dd>National campaign priority.</dd>',
]) assert.ok(markup.includes(expected), `missing read-only dashboard mobile-card contract: ${expected}`);

const styles = fs.readFileSync(new URL('./Dashboard.css', import.meta.url), 'utf8');
assert.match(styles, /\.forge-dashboard-table-cards\s*\{\s*display:\s*none/);
assert.match(styles, /@media \(max-width:\s*600px\)[\s\S]*\.forge-dashboard-table-wrap--mobile-cards,[\s\S]*\.forge-dashboard-table-scroll-hint--mobile-cards\s*\{\s*display:\s*none/);
assert.match(styles, /@media \(max-width:\s*600px\)[\s\S]*\.forge-dashboard-table-cards\s*\{\s*display:\s*grid/);
assert.match(styles, /\.forge-dashboard-table-card__title\s*\{[^}]*min-height:\s*44px/s);
assert.match(styles, /\.forge-dashboard-table-card\s*\{[^}]*var\(--forge-dashboard-table-border/s);

console.log('dashboard read-only table mobile cards render and CSS contract passed');
