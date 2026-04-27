import assert from 'node:assert/strict';
import { resolvePagingValues, withPagingInputs } from './paging.js';

const offsetPaging = resolvePagingValues(3, {
  enabled: true,
  size: 20,
  parameters: {
    page: 'offset',
    size: 'limit',
  },
});

assert.deepEqual(offsetPaging, {
  pageParamName: 'offset',
  sizeParamName: 'limit',
  pageValue: 40,
  sizeValue: 20,
});
console.log('resolvePagingValues ✓ computes offset paging from page number');

assert.deepEqual(
  withPagingInputs({ q: 'adel' }, offsetPaging),
  { q: 'adel', offset: 40, limit: 20 }
);
console.log('withPagingInputs ✓ preserves caller inputs and injects paging inputs');

assert.deepEqual(
  withPagingInputs({ q: 'adel' }, null),
  { q: 'adel' }
);
console.log('withPagingInputs ✓ no-op when paging is absent');

console.log('\nDATACONNECTOR PAGING TESTS PASSED');
