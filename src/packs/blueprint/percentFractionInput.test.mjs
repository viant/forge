import assert from 'node:assert/strict';
import {formatPercentFraction2Input, parsePercentFraction2Input} from './percentFractionInput.js';

assert.equal(formatPercentFraction2Input(0), '0.00');
assert.equal(formatPercentFraction2Input(0.1234), '12.34');
assert.equal(formatPercentFraction2Input(null), '');
assert.equal(parsePercentFraction2Input(12.34, '12.34'), 0.1234);
assert.equal(parsePercentFraction2Input(Number.NaN, ''), null);

console.log('percentFractionInput ✓ renders percent precision while preserving fractional storage');
