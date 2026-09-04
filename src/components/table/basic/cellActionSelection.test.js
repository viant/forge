import assert from 'node:assert/strict';
import {shouldSelectRowForCellAction} from './cellActionSelection.js';

assert.equal(shouldSelectRowForCellAction({col: {type: 'button'}}, false), false);
assert.equal(shouldSelectRowForCellAction({col: {type: 'link'}}, false), true);
assert.equal(shouldSelectRowForCellAction({col: {type: 'text'}}, true), false);
console.log('cellActionSelection ✓ keeps button actions independent from row selection');
