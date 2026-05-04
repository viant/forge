import assert from 'node:assert/strict';
import { buildQuickFilterSeed, mergeQuickFilterValue, getQuickFilterValue } from './viewDialogQuickFilters.js';

assert.deepEqual(
  buildQuickFilterSeed(
    { AdOrderId: 2659776, AdOrderName: 'ignored when blank field omitted' },
    [
      { field: 'AdOrderId' },
      { field: 'AdOrderName' },
    ],
  ),
  {
    AdOrderId: '2659776',
    AdOrderName: 'ignored when blank field omitted',
  },
);
console.log('buildQuickFilterSeed ✓ maps caller args into dialog quick-filter state');

assert.deepEqual(
  buildQuickFilterSeed(
    { CampaignId: null, CampaignName: '' },
    [
      { field: 'CampaignId' },
      { field: 'CampaignName' },
    ],
  ),
  {},
);
console.log('buildQuickFilterSeed ✓ ignores empty caller values');

const nested = mergeQuickFilterValue({}, 'Body.treeLookupParam.filter.filter', 'wood');
assert.deepEqual(
  nested,
  { Body: { treeLookupParam: { filter: { filter: 'wood' } } } },
);
assert.equal(
  getQuickFilterValue(nested, 'Body.treeLookupParam.filter.filter'),
  'wood',
);
console.log('quickFilter helpers ✓ build and read nested filter paths');

assert.deepEqual(
  mergeQuickFilterValue(
    { AdOrderId: '2659776', AdOrderName: 'Northwind' },
    'AdOrderId',
    '',
  ),
  { AdOrderName: 'Northwind' },
);
console.log('quickFilter helpers ✓ drop blank top-level values');

assert.deepEqual(
  mergeQuickFilterValue(
    { Body: { treeLookupParam: { filter: { filter: 'wood', mode: 'contains' } } } },
    'Body.treeLookupParam.filter.filter',
    '',
  ),
  { Body: { treeLookupParam: { filter: { mode: 'contains' } } } },
);
console.log('quickFilter helpers ✓ drop blank nested values without removing siblings');

console.log('\nVIEW DIALOG QUICK FILTER TESTS PASSED');
