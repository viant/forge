import assert from 'node:assert/strict';
import {shouldDispatchSelectionEvent} from './selectionEventModel.js';

assert.equal(shouldDispatchSelectionEvent('multi', {selection: []}), true, 'clearing the final selection is a meaningful assignment change');
assert.equal(shouldDispatchSelectionEvent('multi', {selection: [{id: 1}]}), true);
assert.equal(shouldDispatchSelectionEvent('multi', {}), false);
assert.equal(shouldDispatchSelectionEvent('single', {selected: null, rowIndex: -1}), false);
assert.equal(shouldDispatchSelectionEvent('single', {selected: {id: 1}, rowIndex: 0}), true);
assert.equal(shouldDispatchSelectionEvent('single', {selected: {id: 1}, nodePath: ['root', '1']}, {selfReference: true}), true);

console.log('selection event model contract passed');
