import assert from 'node:assert/strict';
import {normalizeDateInputValue, serializeDateInputValue} from './civilDate.js';

const civil = normalizeDateInputValue('2031-12-02', 'civil');
assert.equal(civil, '2031-12-02T12:00:00.000Z');
assert.equal(serializeDateInputValue(civil, 'civil'), '2031-12-02');

const instant = '2031-12-02T00:00:00.000Z';
assert.equal(normalizeDateInputValue(instant, undefined), instant);
assert.equal(serializeDateInputValue(instant, undefined), instant);
assert.equal(serializeDateInputValue(null, 'civil'), '');

console.log('civil date input contract passed');
