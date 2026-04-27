import assert from 'node:assert/strict';
import { resolvePagingValues } from './paging.js';
import { buildDatasourceFetchInputs } from './datasourceRequest.js';

const pagingValues = resolvePagingValues(4, {
  enabled: true,
  size: 25,
  parameters: {
    page: 'offset',
    size: 'limit',
  },
});

assert.deepEqual(
  buildDatasourceFetchInputs({
    inputParameters: { advertiserId: 17 },
    filter: { adOrderName: '%northwind%' },
    pagingValues,
  }),
  {
    advertiserId: 17,
    offset: 75,
    limit: 25,
    adOrderName: '%northwind%',
  }
);
console.log('buildDatasourceFetchInputs ✓ merges paging, inputs, and filters for datasource fetch POST');

assert.deepEqual(
  buildDatasourceFetchInputs({
    inputParameters: { advertiserId: 17 },
    filter: {},
    pagingValues: null,
  }),
  { advertiserId: 17 }
);
console.log('buildDatasourceFetchInputs ✓ leaves plain inputs unchanged when paging is absent');

const pageNumberPaging = resolvePagingValues(6, {
  enabled: true,
  size: 20,
  parameters: {
    page: 'Page',
    size: 'Limit',
  },
});

assert.deepEqual(
  buildDatasourceFetchInputs({
    inputParameters: { AdOrderId: 2659776 },
    filter: {},
    pagingValues: pageNumberPaging,
  }),
  {
    AdOrderId: 2659776,
    Page: 6,
    Limit: 20,
  }
);
console.log('buildDatasourceFetchInputs ✓ preserves Page/Limit query-selector paging contracts');

console.log('\nDATASOURCE REQUEST TESTS PASSED');
