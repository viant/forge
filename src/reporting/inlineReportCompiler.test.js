import assert from "node:assert/strict";

import {
  compileInlineReport,
  compileInlineReportDefinition,
  materializeInlineReport,
  normalizeInlineReportAssemblyDataSources,
} from "./inlineReportCompiler.js";

const dashboard = compileInlineReport({
  reportId: "campaign:delivery",
  grammar: "dashboard-v1",
  source: {
    title: "Delivery Brief",
    blocks: [{
      id: "deliveryTable",
      kind: "dashboard.table",
      title: "Delivery",
      dataSourceRef: "delivery_rows",
      columns: [
        { key: "channel", label: "Channel" },
        { key: "spend", label: "Spend", format: "currency" },
      ],
    }],
  },
  dataSources: {
    delivery_rows: { rows: [{ channel: "CTV", spend: 125 }] },
  },
});

assert.equal(dashboard.reportDocument.kind, "reportDocument");
assert.equal(dashboard.reportSpec.kind, "reportSpec");
assert.equal(dashboard.reportFill.kind, "reportFill");
assert.equal(dashboard.reportPrint.kind, "reportPrint");
assert.equal(dashboard.reportFill.datasets.find((entry) => entry.id === "delivery_rows")?.rows[0]?.spend, 125);
assert.ok(dashboard.reportSpec.blocks.some((entry) => entry.kind === "tableBlock"));
assert.equal(dashboard.promotion.eligible, false);
assert.deepEqual(dashboard.promotion.materializedDatasetIds, ["delivery_rows"]);

const zeroSummary = compileInlineReport({
  reportId: "zero-summary",
  grammar: "dashboard-v1",
  source: {
    title: "Zero Summary",
    blocks: [{
      id: "summary",
      kind: "dashboard.summary",
      dataSourceRef: "forecast_summary",
      metrics: [{ id: "avails", label: "Avails", selector: "0.total_avails" }],
    }],
  },
  dataSources: { forecast_summary: { rows: [{ total_avails: 0 }] } },
});
assert.equal(zeroSummary.reportSpec.blocks[0]?.valueField, "total_avails");
assert.equal(zeroSummary.reportFill.blocks[0]?.content?.value, 0);

const canonical = compileInlineReport({
  reportId: "canonical-brief",
  grammar: "report-document-v1",
  source: {
    title: "Canonical Brief",
    blocks: [
      { id: "intro", kind: "markdownBlock", title: "Overview", markdown: "## Overview\nCurrent delivery." },
      { id: "detail", kind: "tableBlock", title: "Detail", datasetRef: "rows", columns: [{ key: "market", label: "Market" }] },
    ],
  },
  dataSources: { rows: { rows: [{ market: "US" }] } },
});

assert.deepEqual(canonical.reportSpec.blocks.map((entry) => entry.id), ["intro", "detail"]);
assert.equal(canonical.reportFill.datasets.find((entry) => entry.id === "rows")?.rows[0]?.market, "US");

const live = compileInlineReport({
  reportId: "live-brief",
  grammar: "report-document-v1",
  source: {
    title: "Live Brief",
    datasets: [{ id: "delivery", kind: "workspaceRef", dataSourceRef: "metrics_delivery", request: { orderId: 2680567 } }],
    blocks: [{ id: "deliveryTable", kind: "tableBlock", title: "Delivery", datasetRef: "delivery", columns: [{ key: "spend", label: "Spend" }] }],
  },
});

assert.equal(live.workspaceDatasetRequests.length, 1);
assert.equal(live.promotion.eligible, true);
assert.deepEqual(live.promotion.reusableDataSourceRefs, ["metrics_delivery"]);
const materialized = await materializeInlineReport(live, {
  fetchDataset: async (request) => {
    assert.equal(request.dataSourceRef, "metrics_delivery");
    assert.equal(request.request.orderId, 2680567);
    return { rows: [{ spend: 404 }] };
  },
});
assert.equal(materialized.reportFill.datasets.find((entry) => entry.id === "delivery")?.rows[0]?.spend, 404);
assert.equal(materialized.reportPrint.kind, "reportPrint");

assert.throws(() => compileInlineReport({
  source: {
    blocks: [{ id: "table", kind: "dashboard.table", dataSourceRef: "camelCaseRows", columns: [{ key: "value" }] }],
  },
  dataSources: { camelCaseRows: { rows: [{ value: 1 }] } },
}), /must use canonical lowercase/i);

const assembled = compileInlineReportDefinition({
  scope: "campaign",
  id: "delivery",
  grammar: "dashboard-v1",
  status: "committed",
  source: {
    title: "Assembled delivery",
    blocks: [{
      id: "summary",
      kind: "dashboard.summary",
      dataSourceRef: "summary_rows",
      metrics: [{ id: "spend", label: "Spend", selector: "0.spend" }],
    }],
  },
  dataSources: {
    summary_rows: {
      id: "summary_rows",
      format: "json",
      payload: [{ spend: 125 }],
    },
  },
});
assert.equal(assembled.reportDocument.id, "campaign_delivery");
assert.equal(assembled.reportDocument.title, "Assembled delivery");
assert.equal(assembled.reportFill.datasets.find((entry) => entry.id === "summary_rows")?.rows[0]?.spend, 125);
assert.deepEqual(normalizeInlineReportAssemblyDataSources({
  csv_rows: { format: "csv", payload: "channel,spend\nCTV,42" },
}).csv_rows.rows, [{ channel: "CTV", spend: 42 }]);
assert.deepEqual(normalizeInlineReportAssemblyDataSources({
  summary: { format: "json", payload: { spend: 42 } },
}).summary.rows, [{ spend: 42 }]);
assert.throws(() => compileInlineReportDefinition({
  id: "pending",
  status: "incomplete",
  source: { blocks: [] },
}), /incomplete and cannot be opened/i);

console.log("inlineReportCompiler ✓ compiles dashboard and canonical inline reports with static and live datasets");
