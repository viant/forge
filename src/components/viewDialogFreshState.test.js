import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {consumeDialogFocusRevision, dialogFreshFormSeed, inlineDialogSeedRows, shouldRefreshDialogDataSourceForMount, shouldRefreshDialogDataSourceOnOpen} from './viewDialogFreshState.js';

assert.equal(shouldRefreshDialogDataSourceOnOpen({backend: {kind: 'inline'}}), true);
assert.equal(shouldRefreshDialogDataSourceOnOpen({backend: {kind: 'INLINE'}}), true);
assert.equal(shouldRefreshDialogDataSourceOnOpen({backend: {kind: 'mcp_tool'}}), true);
assert.equal(shouldRefreshDialogDataSourceOnOpen({}), true);
assert.equal(shouldRefreshDialogDataSourceOnOpen({preserveDialogStateOnReopen: true}), false);
assert.equal(shouldRefreshDialogDataSourceForMount({preserveDialogStateOnReopen: true}, 7, null), true, 'a newly opened preserved dialog still receives its intentional fresh seed');
assert.equal(shouldRefreshDialogDataSourceForMount({preserveDialogStateOnReopen: true}, 7, 7), false, 'a responsive remount of the same open revision preserves its live form');
assert.equal(shouldRefreshDialogDataSourceForMount({preserveDialogStateOnReopen: true}, 8, 7), true, 'a later explicit open may reset the form');
assert.equal(shouldRefreshDialogDataSourceForMount({}, 7, 7), true, 'ordinary dialogs retain fresh-on-mount behavior');
const firstWindowOwner = {};
const recreatedWindowOwner = {};
assert.equal(consumeDialogFocusRevision(firstWindowOwner, 'campaignCreate', 7), null);
assert.equal(consumeDialogFocusRevision(firstWindowOwner, 'campaignCreate', 7), 7, 'the same live window owner recognizes a responsive remount');
assert.equal(consumeDialogFocusRevision(recreatedWindowOwner, 'campaignCreate', 7), null, 'a recreated window with the same string ID cannot inherit a stale revision');

const viewDialogSource = readFileSync(new URL('./ViewDialog.jsx', import.meta.url), 'utf8');
assert.match(viewDialogSource, /if \(refreshOnOpen && fetchOnOpen\)/, 'preserved dialogs must not reset live form state when responsive remount makes caller input appear changed');
assert.doesNotMatch(viewDialogSource, /if \(\(inputChanged \|\| refreshOnOpen\) && fetchOnOpen\)/);

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
