import assert from 'node:assert/strict';

import {resolveToolbarSelectOption, toolbarSelectLabel} from './toolbarSelect.js';

const options = [
    {value: 8, label: 'Xandr (AppNexus)'},
    {value: 45, label: 'Google Ad Exchange'},
];

assert.equal(resolveToolbarSelectOption(options, '45')?.value, 45);
assert.equal(toolbarSelectLabel(options, 8), 'Xandr (AppNexus)');
assert.equal(toolbarSelectLabel(options, 999, 'Choose exchange'), 'Choose exchange');

console.log('toolbarSelect ✓');
