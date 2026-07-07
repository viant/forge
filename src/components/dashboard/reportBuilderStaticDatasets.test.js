import assert from "node:assert/strict";

import {
  buildReportBuilderStaticDatasetDeclarations,
  buildReportBuilderStaticDatasetFromCsvFile,
  buildReportBuilderStaticDatasetsFromJsonFile,
  buildReportBuilderStaticDatasetOptions,
  buildReportBuilderStaticDatasetPayloadMap,
  normalizeReportBuilderStaticDatasets,
} from "./reportBuilderStaticDatasets.js";

const staticDataset = buildReportBuilderStaticDatasetFromCsvFile({
  id: "regional_mix_csv",
  fileName: "regional_mix.csv",
  csv: "region,revenue,orders\nNorth,1200,12\nSouth,980,9\n",
});

assert.equal(staticDataset.id, "regional_mix_csv");
assert.equal(staticDataset.label, "Regional Mix");
assert.equal(staticDataset.dataSourceRef, "static_csv_regional_mix_csv");
assert.equal(staticDataset.rowCount, 2);
assert.deepEqual(staticDataset.columns.map((column) => ({ key: column.key, kind: column.kind })), [
  { key: "region", kind: "dimension" },
  { key: "revenue", kind: "measure" },
  { key: "orders", kind: "measure" },
]);

const normalizedDatasets = normalizeReportBuilderStaticDatasets([staticDataset]);
assert.equal(normalizedDatasets.length, 1);
assert.equal(normalizedDatasets[0].valueFieldOptions.length, 2);
assert.equal(normalizedDatasets[0].secondaryFieldOptions.length, 1);

assert.deepEqual(buildReportBuilderStaticDatasetOptions([staticDataset]), [
  {
    value: "regional_mix_csv",
    label: "Regional Mix",
    description: "CSV • 2 rows • 3 columns",
    kindLabel: "static csv",
    dataSourceRef: "static_csv_regional_mix_csv",
    columnOptions: [
      { key: "region", label: "Region", kind: "dimension" },
      { key: "revenue", label: "Revenue", kind: "measure" },
      { key: "orders", label: "Orders", kind: "measure" },
    ],
    valueFieldOptions: [
      { value: "revenue", label: "Revenue" },
      { value: "orders", label: "Orders" },
    ],
    secondaryFieldOptions: [
      { value: "region", label: "Region" },
    ],
  },
]);

assert.deepEqual(buildReportBuilderStaticDatasetDeclarations([staticDataset]), [
  {
    id: "regional_mix_csv",
    dataSourceRef: "static_csv_regional_mix_csv",
    request: {
      kind: "staticCsv",
      format: "csv",
      rowCount: 2,
      columnKeys: ["region", "revenue", "orders"],
    },
  },
]);

const jsonDatasets = buildReportBuilderStaticDatasetsFromJsonFile({
  fileName: "ds.json",
  json: [
    "```forge-data",
    "{",
    "  \"version\": 1,",
    "  \"id\": \"summary_cards\",",
    "  \"data\": [",
    "    { \"posture\": \"live\", \"pacing\": 0.027, \"quotaVisible\": 0 }",
    "  ]",
    "}",
    "```",
    "",
    "```forge-data",
    "{",
    "  \"version\": 1,",
    "  \"id\": \"restrictive_signals\",",
    "  \"data\": [",
    "    { \"feature\": \"channelV2\", \"pct\": 0.1642 },",
    "    { \"feature\": \"offer.bid.floor\", \"pct\": 0.0016 }",
    "  ]",
    "}",
    "```",
  ].join("\n"),
});

assert.equal(jsonDatasets.length, 2);
assert.equal(jsonDatasets[0].id, "summary_cards");
assert.equal(jsonDatasets[0].label, "Summary Cards");
assert.equal(jsonDatasets[0].kindLabel, "static json");
assert.equal(jsonDatasets[0].dataSourceRef, "static_json_summary_cards");
assert.equal(jsonDatasets[0].description, "JSON • 1 row • 3 columns");
assert.deepEqual(jsonDatasets[1].columns.map((column) => ({ key: column.key, kind: column.kind })), [
  { key: "feature", kind: "dimension" },
  { key: "pct", kind: "measure" },
]);

assert.deepEqual(buildReportBuilderStaticDatasetDeclarations(jsonDatasets), [
  {
    id: "summary_cards",
    dataSourceRef: "static_json_summary_cards",
    request: {
      kind: "staticJson",
      format: "json",
      rowCount: 1,
      columnKeys: ["posture", "pacing", "quotaVisible"],
    },
  },
  {
    id: "restrictive_signals",
    dataSourceRef: "static_json_restrictive_signals",
    request: {
      kind: "staticJson",
      format: "json",
      rowCount: 2,
      columnKeys: ["feature", "pct"],
    },
  },
]);

assert.throws(
  () => buildReportBuilderStaticDatasetsFromJsonFile({
    fileName: "primary.json",
    json: JSON.stringify([{ posture: "live" }]),
  }),
  /reserved/i,
);

assert.throws(
  () => buildReportBuilderStaticDatasetsFromJsonFile({
    fileName: "duplicate.json",
    json: [
      "```forge-data",
      "{ \"version\": 1, \"id\": \"same\", \"data\": [{ \"value\": 1 }] }",
      "```",
      "```forge-data",
      "{ \"version\": 1, \"id\": \"same\", \"data\": [{ \"value\": 2 }] }",
      "```",
    ].join("\n"),
  }),
  /appears more than once/i,
);

assert.throws(
  () => buildReportBuilderStaticDatasetsFromJsonFile({
    fileName: "scalars.json",
    json: JSON.stringify([1, 2, 3]),
  }),
  /row objects/i,
);

assert.equal(
  buildReportBuilderStaticDatasetsFromJsonFile({
    fileName: "ds.json",
    json: JSON.stringify({
      version: 1,
      id: "ao2661999_messages",
      data: [
        { title: "Primary blocker family", severity: "warning" },
      ],
    }),
  })[0]?.label,
  "Ao2661999 Messages",
);

assert.deepEqual(buildReportBuilderStaticDatasetPayloadMap([staticDataset]), {
  regional_mix_csv: {
    rows: [
      { region: "North", revenue: 1200, orders: 12 },
      { region: "South", revenue: 980, orders: 9 },
    ],
    hasMore: false,
    diagnostics: [],
  },
});

console.log("reportBuilderStaticDatasets ✓ normalizes CSV and JSON-backed static datasets for designer and runtime use");
