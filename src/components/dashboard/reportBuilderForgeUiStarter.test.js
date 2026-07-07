import assert from "node:assert/strict";

import { buildReportBuilderImportedStarterFromJsonFile } from "./reportBuilderForgeUiStarter.js";

const starter = buildReportBuilderImportedStarterFromJsonFile({
  fileName: "diagnosis.json",
  json: [
    "```forge-ui",
    "{",
    "  \"version\": 1,",
    "  \"title\": \"Diagnosis Summary\",",
    "  \"subtitle\": \"Primary blocker review\",",
    "  \"blocks\": [",
    "    {",
    "      \"kind\": \"dashboard.summary\",",
    "      \"dataSourceRef\": \"summary_rows\",",
    "      \"title\": \"Posture\",",
    "      \"metrics\": [",
    "        { \"field\": \"primary_blocker_family\", \"label\": \"Primary blocker family\", \"tone\": \"danger\" },",
    "        { \"field\": \"delivery_posture\", \"label\": \"Delivery posture\" }",
    "      ]",
    "    },",
    "    {",
    "      \"kind\": \"dashboard.badges\",",
    "      \"title\": \"Signals\",",
    "      \"items\": [",
    "        { \"label\": \"Setup\", \"valueField\": \"setup_posture\", \"tone\": \"success\" },",
    "        { \"label\": \"Pacing\", \"value\": \"Behind\", \"tone\": \"warning\" }",
    "      ]",
    "    },",
    "    {",
    "      \"kind\": \"dashboard.table\",",
    "      \"dataSourceRef\": \"summary_rows\",",
    "      \"title\": \"Evidence\",",
    "      \"columns\": [",
    "        { \"key\": \"ad_order_name\", \"label\": \"Ad Order\" },",
    "        { \"key\": \"spend\", \"label\": \"Spend\", \"format\": \"currency\" }",
    "      ]",
    "    },",
    "    {",
    "      \"kind\": \"dashboard.dimensions\",",
    "      \"dataSourceRef\": \"signal_rows\",",
    "      \"title\": \"Restricting factors by share\",",
    "      \"dimension\": { \"key\": \"feature\", \"label\": \"Feature\" },",
    "      \"metric\": { \"key\": \"pct\", \"label\": \"Restriction share\", \"format\": \"percentFraction\" }",
    "    },",
    "    {",
    "      \"kind\": \"dashboard.report\",",
    "      \"title\": \"Interpretation\",",
    "      \"sections\": [",
    "        { \"body\": [\"Supply restriction is the primary cause.\", \"Bid pressure is secondary.\"] }",
    "      ]",
    "    },",
    "    {",
    "      \"kind\": \"dashboard.messages\",",
    "      \"title\": \"Takeaways\",",
    "      \"items\": [",
    "        { \"title\": \"Primary cause\", \"body\": \"Supply restriction.\" },",
    "        { \"title\": \"Secondary\", \"body\": \"Bid pressure.\" }",
    "      ]",
    "    }",
    "  ]",
    "}",
    "```",
  ].join("\n"),
});

assert.ok(starter);
assert.equal(starter.title, "Diagnosis Summary");
assert.equal(starter.subtitle, "Primary blocker review");
assert.equal(starter.blocks.length, 8);
assert.deepEqual(starter.datasetFieldHints, {
  signal_rows: {
    feature: "dimension",
    pct: "measure",
  },
});
assert.deepEqual(starter.layout.items.slice(0, 8), [
  { blockId: "primaryBuilder" },
  { blockId: "posture_section" },
  { blockId: "posture_metric_primary_blocker_family", size: "half" },
  { blockId: "posture_metric_delivery_posture", size: "half" },
  { blockId: "signals_badges" },
  { blockId: "evidence_table" },
  { blockId: "restricting_factors_by_share_chart" },
  { blockId: "interpretation_report" },
]);
assert.equal(starter.blocks[1].kind, "kpiBlock");
assert.equal(starter.blocks[1].datasetRef, "summary_rows");
assert.equal(starter.blocks[1].tone, "danger");
assert.equal(starter.blocks[2].kind, "kpiBlock");
assert.equal(starter.blocks[3].kind, "badgesBlock");
assert.equal(starter.blocks[3].items[0].label, "Setup");
assert.equal(starter.blocks[3].items[0].valueField, "setup_posture");
assert.equal(starter.blocks[4].kind, "tableBlock");
assert.equal(starter.blocks[5].kind, "chartBlock");
assert.equal(starter.blocks[5].chartSpec.type, "horizontal_bar");
assert.equal(starter.blocks[6].kind, "markdownBlock");
assert.equal(starter.blocks[7].kind, "markdownBlock");

assert.throws(
  () => buildReportBuilderImportedStarterFromJsonFile({
    fileName: "multiple.json",
    json: "```forge-ui\n{}\n```\n```forge-ui\n{}\n```",
  }),
  /multiple forge-ui report definitions/i,
);

console.log("reportBuilderForgeUiStarter ✓ maps forge-ui dashboard blocks into authored report-builder blocks");
