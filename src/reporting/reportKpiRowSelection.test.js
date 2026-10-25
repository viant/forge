import assert from 'node:assert/strict';
import test from 'node:test';
import {buildReportFillFromReportSpec} from './reportFillModel.js';

function select(rows, rowSelector = 'maxbyvalue') {
  return buildReportFillFromReportSpec({
    version: 1, kind: 'reportSpec',
    datasets: [{id: 'primary', dataSourceRef: 'observations', request: {}}],
    blocks: [{id: 'latest', kind: 'kpiBlock', datasetRef: 'primary',
      valueField: 'value', secondaryField: 'label', rowSelector}],
  }, {primary: {rows}}).blocks[0].content;
}

test('latest and earliest ISO dates select the matching whole row', () => {
  const rows = [{value: '2026-10-01T00:00:00Z', label: 'first'},
    {value: '2026-10-02T00:00:00Z', label: 'latest'}];
  assert.equal(select(rows).value, rows[1].value);
  assert.equal(select(rows).secondaryValue, 'latest');
  assert.equal(select([...rows].reverse(), 'minbyvalue').secondaryValue, 'first');
  assert.equal(select(rows, 'firstrow').secondaryValue, 'first');
  assert.equal(select([{value: '2026-10-01'}, {value: '2026-10-02'}]).value, '2026-10-02');
});

test('timestamps compare instants rather than their textual offset order', () => {
  const rows = [{value: '2026-10-02T00:30:00+02:00', label: 'earlier'},
    {value: '2026-10-01T23:00:00Z', label: 'later'}];
  assert.equal(select(rows).secondaryValue, 'later');
  assert.equal(select(rows, 'minbyvalue').secondaryValue, 'earlier');
});

test('invalid and missing observations do not displace valid dates or negative numbers', () => {
  const missing = [null, '', ' ', false, 'not a date', '2026-02-30', '2026-01-01T25:00:00Z']
    .map(value => ({value, label: 'invalid'}));
  assert.equal(select([...missing, {value: '2026-02-28', label: 'valid'}]).secondaryValue, 'valid');
  assert.equal(select([{value: null}, {value: ''}, {value: false},
    {value: -4, label: 'lower'}, {value: '-2', label: 'higher'}]).secondaryValue, 'higher');
  assert.equal(select([{value: 0, label: 'zero'}, {value: 4}], 'minbyvalue').secondaryValue, 'zero');
});

test('ties preserve the first row and unlike value kinds are not compared', () => {
  const rows = [{value: '2026-10-02', label: 'first'},
    {value: '2026-10-02T00:00:00Z', label: 'same instant'}, {value: 999999999999999}];
  assert.equal(select(rows).secondaryValue, 'first');
  assert.equal(select([]).value, null);
});
