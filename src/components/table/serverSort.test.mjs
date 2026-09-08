import assert from 'node:assert/strict';
import {requestServerTableSort} from './serverSort.js';

for (const dataSource of [
    {sortMode: 'server', service: {URL: '/legacy'}},
    {sortMode: 'server', backend: {kind: 'mcp_tool', method: 'CampaignPerformance'}},
]) {
    const calls = [];
    assert.equal(requestServerTableSort({
        dataSource,
        handlers: {dataSource: {setSort: (input) => calls.push(input)}},
        columnId: 'name',
        direction: 'desc',
    }), true);
    assert.deepEqual(calls, [{columnId: 'name', direction: 'desc', fetch: true}]);
}

const mappedCalls = [];
assert.equal(requestServerTableSort({
    dataSource: {
        sortMode: 'server',
        backend: {kind: 'mcp_tool'},
        sortMapping: {
            parameter: 'OrderBy',
            template: '{{field}}:{{direction}}',
            fields: {campaignId: 'campaign_id'},
        },
    },
    handlers: {dataSource: {setSort: (input) => mappedCalls.push(input)}},
    columnId: 'campaignId',
    direction: 'desc',
}), true);
assert.deepEqual(mappedCalls, [{
    columnId: 'campaignId',
    direction: 'desc',
    fetch: true,
    parameter: 'OrderBy',
    value: ['campaign_id:desc'],
}]);

const unknownCalls = [];
assert.equal(requestServerTableSort({
    dataSource: {
        sortMode: 'server',
        backend: {kind: 'mcp_tool'},
        sortMapping: {parameter: 'OrderBy', template: '{{field}}:{{direction}}', fields: {campaignId: 'campaign_id'}},
    },
    handlers: {dataSource: {setSort: (input) => unknownCalls.push(input)}},
    columnId: 'unmappedField',
}), false);
assert.deepEqual(unknownCalls, []);

const clientCalls = [];
assert.equal(requestServerTableSort({
    dataSource: {sortMode: 'client', backend: {kind: 'mcp_tool'}},
    handlers: {dataSource: {setSort: (input) => clientCalls.push(input)}},
    columnId: 'name',
}), false);
assert.deepEqual(clientCalls, []);

console.log('serverSort ✓ backend and legacy server-sort interactions fetch; client sort stays local');
