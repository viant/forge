import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {signal} from '@preact/signals-react';

import DataStateBoundary from '../../primitives/DataStateBoundary.jsx';
import {normalizeDataSourceError} from '../../../utils/dataSourceError.js';
import {tableBackfillCount} from '../tableSizing.js';
import TableBody from './TableBody.jsx';

// Independently invented backend errors and records exercise the real renderer.
// No permission service or application-specific datasource participates.
for (const count of [1, 4, 0]) {
    const records = Array.from({length: count}, (_, index) => ({id: index + 1}));
    const error = normalizeDataSourceError({status: 502, code: 'upstream_failed', message: 'Upstream request failed.'});
    let requests = 0;
    const context = {
        identity: {dataSourceRef: 'records'},
        signals: {
            collection: signal(records), control: signal({loaded: true, loading: false, stale: true, error}),
            form: signal({}), metrics: signal({}),
        },
        handlers: {dataSource: {fetchCollection() { requests += 1; }}},
    };
    context.Context = () => context;
    const container = {
        dataSourceRef: 'records', table: {columns: []},
        dataStateBoundary: {dataSourceRefs: ['records'], errorMessage: 'Records could not be loaded.'},
    };
    const backfillCount = tableBackfillCount(10, count, false);
    const markup = renderToStaticMarkup(
        <DataStateBoundary container={container} context={context}>
            <button>Change filters</button>
            <table><TableBody context={context} collection={records} columns={[{id: 'id', name: 'ID'}]}
                preparedData={[]} backfillCount={backfillCount} loading={false} error={error}/></table>
        </DataStateBoundary>,
    );
    assert.match(markup, /class="forge-data-error" role="alert"/, 'the outer boundary already reports the generic error');
    assert.match(markup, /Records could not be loaded\./);
    assert.match(markup, /Change filters/);
    assert.match(markup, /class="table-state-message" role="alert"/, 'a retained collection must not suppress the table error row');
    assert.match(markup, /This data is temporarily unavailable\. Retry in a moment\./);
    assert.doesNotMatch(markup, /This data source denied|No data\./, 'a generic backend failure is not reclassified as denial or empty success');
    assert.equal((markup.match(/class="table-state-message"/g) || []).length, 1);
    assert.equal(context.signals.collection.peek(), records, 'rendering preserves the existing stale-data policy');
    assert.equal(context.signals.control.peek().error, error);
    assert.equal(requests, 0, 'rendering never preflights, retries or authorizes');
}
console.log('Failed table refresh retains data and renders generic outer and inner alerts.');
