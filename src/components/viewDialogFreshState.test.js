import assert from 'node:assert/strict';
import {dialogFreshFormSeed, inlineDialogSeedRows, shouldRefreshDialogDataSourceOnOpen} from './viewDialogFreshState.js';

assert.equal(shouldRefreshDialogDataSourceOnOpen({backend: {kind: 'inline'}}), true);
assert.equal(shouldRefreshDialogDataSourceOnOpen({backend: {kind: 'INLINE'}}), true);
assert.equal(shouldRefreshDialogDataSourceOnOpen({backend: {kind: 'mcp_tool'}}), true);
assert.equal(shouldRefreshDialogDataSourceOnOpen({}), true);
assert.equal(shouldRefreshDialogDataSourceOnOpen({preserveDialogStateOnReopen: true}), false);

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
