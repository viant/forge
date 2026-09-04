import assert from 'node:assert/strict';

import {resolveTableCellBadge} from './tableCellBadge.js';

const context = {signals: {authorization: {peek: () => ({principal: {features: ['FEATURE_PRIORITY']}})}}};
const badge = {
  label: 'Priority',
  icon: 'endorsed',
  field: 'planType',
  equals: 2,
  tone: 'accent',
  visibleWhen: {source: 'authorization', field: 'principal.features', contains: 'FEATURE_PRIORITY'},
};

assert.equal(resolveTableCellBadge({planType: 1}, badge, context), null);
assert.deepEqual(resolveTableCellBadge({planType: 2}, badge, context), {
  label: 'Priority', icon: 'endorsed', tone: 'accent', className: '', tooltip: 'Priority', replaceValue: false,
});
assert.equal(resolveTableCellBadge({planType: 2}, badge, {signals: {authorization: {peek: () => ({principal: {features: []}})}}}), null);

assert.deepEqual(resolveTableCellBadge({status: 4}, {
  field: 'status',
  valueMap: {'0': 'Inactive', '4': 'Completed'},
  toneMap: {'0': 'neutral', '4': 'info'},
  replaceValue: true,
}), {
  label: 'Completed', icon: '', tone: 'info', className: '', tooltip: 'Completed', replaceValue: true,
});

assert.deepEqual(resolveTableCellBadge({status: 0}, {
  field: 'status',
  valueMap: {'0': 'Inactive'},
  toneMap: {'0': 'neutral'},
  replaceValue: true,
}), {
  label: 'Inactive', icon: '', tone: 'neutral', className: '', tooltip: 'Inactive', replaceValue: true,
});

console.log('tableCellBadge ✓ conditionally resolves a generic row decoration');
