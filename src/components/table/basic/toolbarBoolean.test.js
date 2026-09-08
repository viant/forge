import assert from 'node:assert/strict';
import {toolbarBooleanField, toolbarBooleanValue} from './toolbarBoolean.js';

assert.equal(toolbarBooleanValue(true), true);
assert.equal(toolbarBooleanValue('1'), true);
assert.equal(toolbarBooleanValue('false'), false);
assert.equal(toolbarBooleanField({dataField: 'enabled', field: 'fallback'}), 'enabled');
console.log('toolbar boolean model passed');
