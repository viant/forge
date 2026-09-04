import assert from 'node:assert/strict';

import {filterEmptyStateToolbarItems, resolveTableEmptyState, shouldRenderTableEmptyState} from './tableEmptyState.js';

const emptyState = {
    title: 'Create your first automation',
    hideToolbarItems: ['quickFilter', 'edit', 'run', 'delete'],
};

assert.equal(shouldRenderTableEmptyState({emptyState, collection: [], loading: false, error: null}), true);
assert.equal(shouldRenderTableEmptyState({emptyState, collection: [{id: 'schedule-1'}], loading: false, error: null}), false);
assert.equal(shouldRenderTableEmptyState({emptyState, collection: [], loading: true, error: null}), false);
assert.equal(shouldRenderTableEmptyState({emptyState, collection: [], loading: false, error: new Error('failed')}), false);

assert.deepEqual(
    filterEmptyStateToolbarItems([
        {id: 'refresh'},
        {id: 'addNew'},
        {id: 'quickFilter'},
        {id: 'edit'},
        {id: 'run'},
        {id: 'delete'},
    ], emptyState, true).map((item) => item.id),
    ['refresh', 'addNew'],
);

console.log('table empty state ✓ metadata controls zero-state visibility and toolbar actions');

assert.equal(resolveTableEmptyState({title: 'Create', filtered: {title: 'No matches'}}, {}).title, 'Create');
assert.equal(resolveTableEmptyState({title: 'Create', filtered: {title: 'No matches'}}, {Name: 'x'}).title, 'No matches');
