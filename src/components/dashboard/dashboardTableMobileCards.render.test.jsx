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
const renderedClasses = new Set([...markup.matchAll(/class="([^"]*)"/g)].flatMap((match) => match[1].split(/\s+/)));
for (const className of ["forge-dashboard-table", "forge-dashboard-table-cards", "forge-dashboard-table-card"]) {
    assert.ok(renderedClasses.has(className), `missing read-only dashboard mobile-card class: ${className}`);
}
// Text formatters may wrap values in spans; preserve the surrounding card structure.
const textMarkup = markup.replace(/<span\b[^>]*>([^<]*)<\/span>/g, "$1");
for (const expected of [
    'forge-dashboard-table-wrap--mobile-cards',
    'aria-label="Select California"',
    'checked=""',
    '<strong>California</strong>',
    'Code: CA',
    '<dt>Rationale</dt>',
    '<dd>National campaign priority.</dd>',
]) assert.ok(textMarkup.includes(expected), `missing read-only dashboard mobile-card contract: ${expected}`);

const styles = fs.readFileSync(new URL('./Dashboard.css', import.meta.url), 'utf8');
assert.match(styles, /\.forge-dashboard-table-cards\s*\{\s*display:\s*none/);
assert.match(styles, /@media \(max-width:\s*600px\)[\s\S]*\.forge-dashboard-table-wrap--mobile-cards,[\s\S]*\.forge-dashboard-table-scroll-hint--mobile-cards\s*\{\s*display:\s*none/);
assert.match(styles, /@media \(max-width:\s*600px\)[\s\S]*\.forge-dashboard-table-cards\s*\{\s*display:\s*grid/);
assert.match(styles, /\.forge-dashboard-table-card__title\s*\{[^}]*min-height:\s*44px/s);
assert.match(styles, /\.forge-dashboard-table-card\s*\{[^}]*var\(--forge-dashboard-table-border/s);

console.log('dashboard read-only table mobile cards render and CSS contract passed');
