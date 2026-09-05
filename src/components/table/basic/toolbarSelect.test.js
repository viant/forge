import assert from 'node:assert/strict';

import {dispatchToolbarSelectChange, resolveToolbarSelectOption, toolbarSelectLabel} from './toolbarSelect.js';

const options = [
    {value: 8, label: 'Xandr (AppNexus)'},
    {value: 45, label: 'Google Ad Exchange'},
];

assert.equal(resolveToolbarSelectOption(options, '45')?.value, 45);
assert.equal(toolbarSelectLabel(options, 8), 'Xandr (AppNexus)');
assert.equal(toolbarSelectLabel(options, 999, 'Choose exchange'), 'Choose exchange');

const calls = [];
dispatchToolbarSelectChange(
  {target: {value: '100'}},
  (event) => calls.push(`commit:${event.target.value}`),
  (event) => calls.push(`callback:${event.target.value}`),
);
assert.deepEqual(calls, ['commit:100', 'callback:100']);

console.log('toolbarSelect ✓');
