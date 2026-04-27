import assert from 'node:assert/strict';
import { extractData } from './dataSourceExtract.js';

const payload = {
  data: [
    { adOrderId: 1, adOrderName: 'Northwind' },
    { adOrderId: 2, adOrderName: 'Contoso' },
  ],
  meta: {
    recordCount: 1227774,
    pageCount: 61389,
  },
};

const { records, info } = extractData(
  { data: 'data', dataInfo: 'meta' },
  { enabled: true, size: 20, dataInfoSelectors: {} },
  payload
);

assert.equal(records.length, 2);
assert.equal(info.pageCount, 61389);
assert.equal(info.totalCount, 1227774);
console.log('extractData ✓ falls back to recordCount for totalCount');

console.log('\nDATASOURCE EXTRACT TESTS PASSED');
