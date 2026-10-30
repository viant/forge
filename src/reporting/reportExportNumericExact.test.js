import assert from 'node:assert/strict';
import { formatExportNumericValue } from './reportExportValueFormatter.js';

const formats = ['number', 'number2', 'number5', '', 'currency', 'currency2'];
const values = [0, -0, 1, -1, 999, 1000, -1234567, 0.01, -0.11, 1234.56, 1.005, 2.675,
  0.00001, 0.000001, 1e-7, -1e-7, 1e20, 1e21, Number.MAX_SAFE_INTEGER, Number.MIN_VALUE,
  Number.MAX_VALUE, 13.151637212662237, 95.000000409];
let seed = 1729;
for (let i = 0; i < 1000; i++) {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  values.push((seed - 2147483648) / 10 ** (i % 8));
}
for (const axis of [false, true]) for (const format of formats) for (const value of values) {
  const currency = format.startsWith('currency');
  const minimumFractionDigits = currency ? 2 : format === 'number5' ? 5 : 0;
  const maximumFractionDigits = currency || format === 'number2' ? 2 : format === 'number5' ? 5
    : format === 'number' ? axis ? Number.isInteger(value) ? 0 : 1 : 5
    : Number.isInteger(value) ? 0 : 2;
  const expected = new Intl.NumberFormat('en-US', {minimumFractionDigits, maximumFractionDigits,
    useGrouping: true, ...(currency ? {style: 'currency', currency: 'USD'} : {})}).format(value);
  assert.equal(formatExportNumericValue(value, format, {axis}), expected, `${format} axis=${axis} value=${value}`);
}
// A wide table contains many distinct cells; avoiding formatter construction
// alone still runs the bundled decimal arithmetic for every distinct value.
const property = Object.getOwnPropertyDescriptor(Intl.NumberFormat.prototype, 'format');
let calls = 0;
Object.defineProperty(Intl.NumberFormat.prototype, 'format', {...property, get() {
  const format = property.get.call(this);
  return value => { calls++; return format(value); };
}});
try {
  for (let value = 0; value < 500; value++) {
    assert.equal(formatExportNumericValue(value + 1000, 'number'), String(value + 1000).replace(/\B(?=(\d{3})+(?!\d))/g, ','));
    assert.equal(formatExportNumericValue(value + 0.25, 'currency2'), `$${value}.25`);
  }
  assert.equal(calls, 0, 'exact decimals should not invoke Intl decimal rounding');
} finally { Object.defineProperty(Intl.NumberFormat.prototype, 'format', property); }
console.log('Exact export decimals match native Intl; rounded and exponent values preserve fallback');
