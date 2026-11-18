import assert from "node:assert/strict";

import { buildReportFillGeoPayload } from "./reportFillGeoPayload.js";
import { resolveGeoTextColor } from "../components/dashboard/geoMapUtils.js";

assert.equal(resolveGeoTextColor("#0c4d52"), "#ffffff");
assert.equal(resolveGeoTextColor("#d9f0ea"), "#102a43");

const payload = buildReportFillGeoPayload({
  geo: {
    key: "stateCode",
    labelKey: "stateName",
    metric: {
      key: "spend",
      label: "Spend",
      format: "currency",
    },
    aggregate: "sum",
    color: {
      field: "status",
      rules: [
        { value: "critical", label: "Critical", color: "#db3737" },
      ],
    },
  },
}, [
  { stateCode: "CA", stateName: "California", spend: 100, status: "critical" },
  { stateCode: "CA", stateName: "California", spend: 40, status: "critical" },
  { stateCode: "WA", stateName: "Washington", spend: 80, status: "healthy" },
]);

assert.deepEqual(payload, {
  shape: "us-states",
  keyField: "stateCode",
  labelField: "stateName",
  metricKey: "spend",
  metricLabel: "Spend",
  format: "currency",
  aggregate: "sum",
  regions: [
    {
      key: "CA",
      label: "California",
      rawValue: 140,
      displayValue: "$140",
      color: "#db3737",
      statusColor: "#db3737",
      statusLabel: "Critical",
      rowCount: 2,
    },
    {
      key: "WA",
      label: "Washington",
      rawValue: 80,
      displayValue: "$80",
      color: "#d9f0ea",
      statusColor: "",
      statusLabel: "",
      rowCount: 1,
    },
  ],
  ranking: [
    {
      key: "CA",
      label: "California",
      rawValue: 140,
      displayValue: "$140",
      color: "#db3737",
      statusColor: "#db3737",
      statusLabel: "Critical",
      rowCount: 2,
    },
    {
      key: "WA",
      label: "Washington",
      rawValue: 80,
      displayValue: "$80",
      color: "#d9f0ea",
      statusColor: "",
      statusLabel: "",
      rowCount: 1,
    },
  ],
  activeRegion: {
    key: "CA",
    label: "California",
    rawValue: 140,
    displayValue: "$140",
    color: "#db3737",
    statusColor: "#db3737",
    statusLabel: "Critical",
    rowCount: 2,
  },
  summary: {
    regionCount: 2,
    totalValue: "$220",
    topKey: "CA",
  },
  legend: {
    rules: [
      {
        color: "#db3737",
        label: "Critical",
      },
    ],
  },
});

const fullNamePayload = buildReportFillGeoPayload({
  geo: {
    key: "stateName",
    metric: { key: "visits", label: "Visits", format: "number" },
    aggregate: "sum",
  },
}, [
  { stateName: "Florida", visits: 142.7 },
  { stateName: "Virginia", visits: 55.1 },
]);
assert.deepEqual(fullNamePayload.regions.map(({ key, label, rawValue }) => ({ key, label, rawValue })), [
  { key: "FL", label: "Florida", rawValue: 142.7 },
  { key: "VA", label: "Virginia", rawValue: 55.1 },
]);

console.log("reportFillGeoPayload ✓ builds deterministic resolved geo payloads for ReportFill");

const missingAndZero = buildReportFillGeoPayload({geo: {
  key: 'region', metric: {key: 'amount', format: 'number'}, aggregate: 'sum',
  color: {empty: '#eeeeee'},
}}, [
  {region: 'NY', amount: null}, {region: 'MA'},
  {region: 'CA', amount: 0}, {region: 'TX', amount: '0'},
  {region: 'WA', amount: null}, {region: 'WA', amount: '6'},
]);
assert.deepEqual(missingAndZero.ranking.map(({key, rawValue}) => ({key, rawValue})), [
  {key: 'WA', rawValue: 6}, {key: 'CA', rawValue: 0}, {key: 'TX', rawValue: 0},
]);
for (const key of ['NY', 'MA']) {
  const region = missingAndZero.regions.find(region => region.key === key);
  assert.equal(region.rawValue, null);
  assert.equal(region.displayValue, '-');
  assert.equal(region.color, '#eeeeee');
  assert.equal(region.rowCount, 1);
}
assert.equal(missingAndZero.regions.find(region => region.key === 'CA').displayValue, '0');
const negativeOnly = buildReportFillGeoPayload({geo: {key: 'region', metric: {key: 'amount'}}}, [
  {region: 'NY', amount: null}, {region: 'WA', amount: -4},
]);
assert.equal(negativeOnly.legend.min, '-4');
assert.equal(negativeOnly.legend.max, '-4');
const unavailableOnly = buildReportFillGeoPayload({geo: {key: 'region', metric: {key: 'amount'}}}, [{region: 'NY', amount: null}]);
assert.deepEqual(unavailableOnly.ranking, []);
assert.equal(unavailableOnly.activeRegion.rawValue, null);
