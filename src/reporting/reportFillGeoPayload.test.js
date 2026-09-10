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
