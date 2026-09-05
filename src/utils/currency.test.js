import assert from 'node:assert/strict';
import {currencyInputIcon, normalizeCurrencyCode} from './currency.js';

assert.equal(normalizeCurrencyCode(' eur '), 'EUR');
assert.equal(normalizeCurrencyCode('invalid'), 'USD');
assert.equal(currencyInputIcon('EUR'), 'euro');
assert.equal(currencyInputIcon('GBP'), 'pound');
assert.equal(currencyInputIcon('USD'), 'dollar');
assert.equal(currencyInputIcon('CHF'), undefined);

console.log('currency tests passed');
