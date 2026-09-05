import assert from 'node:assert/strict';
import {defaultDateInputMaxDate, defaultDateInputMinDate} from './dateInputBounds.js';

const now = new Date(2026, 8, 4, 12, 30, 0, 0);
const min = defaultDateInputMinDate(now);
const max = defaultDateInputMaxDate(now);

assert.equal(min.getFullYear(), 1976);
assert.equal(min.getMonth(), 0);
assert.equal(min.getDate(), 1);
assert.equal(max.getFullYear(), 2046);
assert.equal(max.getMonth(), 11);
assert.equal(max.getDate(), 31);
assert.ok(new Date(2031, 11, 31) >= min && new Date(2031, 11, 31) <= max);

console.log('date input default bounds passed');
