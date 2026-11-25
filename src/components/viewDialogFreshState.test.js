import assert from 'node:assert/strict';
import {consumeDialogFocusRevision, dialogFreshFormSeed, inlineDialogSeedRows, shouldFetchDialogOnOpen, shouldInitializeDialogRevision, shouldRefreshDialogDataSourceOnOpen} from './viewDialogFreshState.js';

assert.equal(shouldFetchDialogOnOpen({content: {fetchData: false}}), false);
assert.equal(shouldFetchDialogOnOpen({content: {fetchData: true}}), true);
assert.equal(shouldFetchDialogOnOpen({fetchOnOpen: true, content: {fetchData: false}}), true);
assert.equal(shouldFetchDialogOnOpen({fetchOnOpen: false, content: {fetchData: true}}), false);

assert.equal(shouldRefreshDialogDataSourceOnOpen({backend: {kind: 'inline'}}), true);
assert.equal(shouldRefreshDialogDataSourceOnOpen({backend: {kind: 'INLINE'}}), true);
assert.equal(shouldRefreshDialogDataSourceOnOpen({backend: {kind: 'mcp_tool'}}), true);
assert.equal(shouldRefreshDialogDataSourceOnOpen({}), true);
assert.equal(shouldRefreshDialogDataSourceOnOpen({preserveDialogStateOnReopen: true}), false);
assert.equal(shouldInitializeDialogRevision(7, null), true, 'a newly opened preserved dialog still receives its intentional fresh seed');
assert.equal(shouldInitializeDialogRevision(7, 7), false, 'a responsive remount of the same open revision preserves its live form');
assert.equal(shouldInitializeDialogRevision(8, 7), true, 'a later explicit open may reset the form');
assert.equal(shouldInitializeDialogRevision(0, 0), true, 'older dialog states without a revision still perform their initial read');
const firstWindowOwner = {};
const recreatedWindowOwner = {};
assert.equal(consumeDialogFocusRevision(firstWindowOwner, 'campaignCreate', 7), null);
assert.equal(consumeDialogFocusRevision(firstWindowOwner, 'campaignCreate', 7), 7, 'the same live window owner recognizes a responsive remount');
assert.equal(consumeDialogFocusRevision(recreatedWindowOwner, 'campaignCreate', 7), null, 'a recreated window with the same string ID cannot inherit a stale revision');

const source = {backend: {kind: 'inline', rows: [{id: 'draft', saved: false}]}};
const rows = inlineDialogSeedRows(source);
assert.deepEqual(rows, [{id: 'draft', saved: false}]);
assert.notEqual(rows[0], source.backend.rows[0]);
rows[0].saved = true;
assert.equal(source.backend.rows[0].saved, false);
assert.deepEqual(inlineDialogSeedRows({backend: {kind: 'mcp_tool', rows: [{id: 1}]}}), []);
assert.deepEqual(dialogFreshFormSeed({}, [{id: 'runtime-seed', saved: false}]), {id: 'runtime-seed', saved: false});
const runtimeSeed = [{id: 'runtime-seed', saved: false}];
const clonedSeed = dialogFreshFormSeed({}, runtimeSeed);
clonedSeed.saved = true;
assert.equal(runtimeSeed[0].saved, false);

console.log('viewDialogFreshState ✓ dialog datasources refresh on every open unless explicitly preserved');
