import assert from 'node:assert/strict';
import { buildQuickFilterSeed } from './viewDialogQuickFilters.js';

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

console.log('\nVIEW DIALOG QUICK FILTER TESTS PASSED');
