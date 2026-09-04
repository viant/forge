import assert from 'node:assert/strict';
import {normalizeLifetimeStart, resolveDateRangePreset} from './dateRangePreset.js';

const afterMidnightUtc = new Date('2026-09-04T03:15:00.000Z');

assert.deepEqual(
    resolveDateRangePreset('month', afterMidnightUtc, '2025-07-09', 'America/Los_Angeles'),
    {start: '2026-08-03', end: '2026-09-03', granularity: 'day'},
    'campaign-local dates must not roll forward merely because UTC crossed midnight',
);

assert.deepEqual(
    resolveDateRangePreset('month', afterMidnightUtc, '2025-07-09', 'UTC'),
    {start: '2026-08-04', end: '2026-09-04', granularity: 'day'},
    'UTC remains available for UTC-scoped resources',
);

assert.deepEqual(
    resolveDateRangePreset('lifetime', afterMidnightUtc, '2025-07-09', 'America/Los_Angeles'),
    {start: '2025-07-09', end: '2026-09-03', granularity: 'day'},
);

assert.equal(normalizeLifetimeStart('2025-07-09T07:00:00Z'), '2025-07-09');
assert.equal(normalizeLifetimeStart('', '2024-01-01'), '2024-01-01');

console.log('dateRangePreset ✓ resolves presets in the resource timezone');
