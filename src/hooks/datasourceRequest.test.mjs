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

console.log('\nDATASOURCE REQUEST TESTS PASSED');
