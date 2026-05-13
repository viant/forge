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

const projectedPayload = {
  rows: [{ spend: 251.927 }],
  metrics: {
    performanceSummary: {
      periodCtr: 1.23,
    },
  },
};

const { stats } = extractData(
  { data: 'data.0.performanceTimeline', metrics: 'data.0' },
  undefined,
  projectedPayload
);

assert.equal(stats.performanceSummary.periodCtr, 1.23);
console.log('extractData ✓ prefers explicit projected metrics when present');

const envelopePayload = {
  rows: [{ spend: 251.927 }],
  dataInfo: { pageCount: 1, totalCount: 1 },
};

const explicitEnvelope = extractData(
  { data: 'data.0.performanceTimeline', dataInfo: 'meta' },
  { enabled: true, size: 20, dataInfoSelectors: {} },
  envelopePayload
);

assert.equal(explicitEnvelope.records.length, 1);
assert.equal(explicitEnvelope.records[0].spend, 251.927);
assert.equal(explicitEnvelope.info.pageCount, 1);
assert.equal(explicitEnvelope.info.totalCount, 1);
console.log('extractData ✓ prefers explicit rows and dataInfo envelope when present');

console.log('\nDATASOURCE EXTRACT TESTS PASSED');
