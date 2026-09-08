import assert from 'node:assert/strict';
import {bindingFinalizationAction, isCurrentBindingGeneration} from './bindingGeneration.js';

assert.equal(isCurrentBindingGeneration('B', 'A'), false);
assert.equal(isCurrentBindingGeneration('B', 'B'), true);
assert.equal(isCurrentBindingGeneration(undefined, undefined), true);
let visible = 'baseline';
const commit = (request, value, current) => { if (isCurrentBindingGeneration(current, request)) visible = value; };
commit('A', 'detail A', 'B');
assert.equal(visible, 'baseline');
commit('B', 'detail B', 'B');
assert.equal(visible, 'detail B');
assert.equal(bindingFinalizationAction(false, false), 'close');
assert.equal(bindingFinalizationAction(false, true), 'continue');
assert.equal(bindingFinalizationAction(true, false), 'complete');
console.log('binding generation commit guard passed');
