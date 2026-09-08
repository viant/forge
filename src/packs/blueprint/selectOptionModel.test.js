import assert from 'node:assert/strict';
import {commitSelectOption, isSelectOptionDisabled} from './selectOptionModel.js';

assert.equal(isSelectOptionDisabled({disabled: true}), true);
assert.equal(isSelectOptionDisabled({disabled: false}), false);

let selected = null;
assert.equal(commitSelectOption({value: 2, disabled: false}, (value) => { selected = value; }), true);
assert.equal(selected, 2);

assert.equal(commitSelectOption({value: 3, disabled: true}, (value) => { selected = value; }), false);
assert.equal(selected, 2, 'disabled select option must not change the current value');

console.log('Blueprint select disabled-option interaction contract passed');
