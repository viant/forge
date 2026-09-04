import assert from 'node:assert/strict';
import {formatDisplayValue, mapDisplayValue, resolveEmptyDisplayText} from './formatValue.js';

const formatted = formatDisplayValue('2026-08-27T22:33:00Z', 'dateTime24', 'en-US', {timeZone: 'America/Los_Angeles'});
assert.match(formatted, /Aug 27, 2026/);
assert.match(formatted, /15:33/);
assert.doesNotMatch(formatted, /AM|PM/);
assert.equal(formatDisplayValue(0.123, 'percentFraction'), '12.3%');
assert.equal(formatDisplayValue(0.1234, 'percentFraction2'), '12.34%');
assert.equal(mapDisplayValue(1, {'0': 'Inactive', '1': 'Active'}), 'Active');
assert.equal(mapDisplayValue('BANNER', {BANNER: 'Banner'}), 'Banner');
assert.equal(mapDisplayValue('unknown', {known: 'Known'}), 'unknown');
assert.equal(resolveEmptyDisplayText({properties: {emptyText: 'Auto'}}), 'Auto');
assert.equal(resolveEmptyDisplayText({}), 'No data');
assert.equal(formatDisplayValue({width: 300, height: 250}, 'dimensions'), '300x250');
assert.equal(formatDisplayValue({width: 0, height: 0}, 'dimensions'), '0x0');

console.log('formatValue ✓ 24-hour date-time rendering');
