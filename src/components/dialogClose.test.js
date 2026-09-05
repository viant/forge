import assert from 'node:assert/strict';
import {dialogCloseDisabledWhen, isDialogCloseDisabled} from './dialogClose.js';

const condition = {source: 'form', field: 'submitting', equals: true};
const dialog = {properties: {closeDisabledWhen: condition}};
const context = (submitting) => ({handlers: {dataSource: {peekFormData: () => ({submitting})}}});

assert.equal(dialogCloseDisabledWhen(dialog), condition);
assert.equal(isDialogCloseDisabled(dialog, context(true)), true);
assert.equal(isDialogCloseDisabled(dialog, context(false)), false);
assert.equal(isDialogCloseDisabled({}, context(true)), false);

console.log('dialog close tests passed');
