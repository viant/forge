import assert from "node:assert/strict";

import {
  adaptDashboardToReportDocument,
  applyDashboardReportAdapterConfig,
  buildReportBuilderImportedStarterFromJsonFile,
  DASHBOARD_REPORT_ADAPTER_KINDS,
  DASHBOARD_REPORT_ADAPTER_OUTPUT_KINDS,
} from "./reportBuilderForgeUiStarter.js";
import {
  mergeReportBuilderState,
  sanitizeReportBuilderState,
} from "./reportBuilderUtils.js";

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
  summary_rows: {
    primary_blocker_family: "measure",
    delivery_posture: "measure",
    ad_order_name: "dimension",
    spend: "measure",
  },
  signal_rows: {
    feature: "dimension",
    pct: "measure",
  },
});
const interpretationBlockId = starter.blocks.find((block) => block.kind === "markdownBlock")?.id;
assert.deepEqual(starter.layout.items.slice(0, 8), [
  { blockId: "primaryBuilder" },
  { blockId: "posture_metric_primary_blocker_family", span: 6 },
  { blockId: "posture_metric_delivery_posture", span: 6 },
  { blockId: "signals_badges" },
  { blockId: "evidence_table" },
  { blockId: "restricting_factors_by_share_chart" },
  { blockId: interpretationBlockId },
  { blockId: "takeaways_message_primary_cause" },
]);
assert.equal(starter.blocks[0].kind, "kpiBlock");
assert.equal(starter.blocks[0].datasetRef, "summary_rows");
assert.equal(starter.blocks[0].tone, "danger");
assert.equal(starter.blocks[1].kind, "kpiBlock");
assert.equal(starter.blocks[2].kind, "badgesBlock");
assert.equal(starter.blocks[2].items[0].label, "Setup");
assert.equal(starter.blocks[2].items[0].valueField, "setup_posture");
assert.equal(starter.blocks[3].kind, "tableBlock");
assert.equal(starter.blocks[4].kind, "chartBlock");
assert.equal(starter.blocks[4].chartSpec.type, "horizontal_bar");
assert.equal(starter.blocks[5].kind, "markdownBlock");
assert.equal(starter.blocks[6].kind, "calloutBlock");
assert.equal(starter.unsupportedKinds.length, 0);

const completeDashboard = {
  version: 1,
  title: "Complete Dashboard",
  dataSources: [{
    id: "trend",
    dataSourceRef: "trend_api",
    label: "Delivery Trend",
    request: { path: "/delivery/trend" },
  }],
  blocks: [
    { id: "summary", kind: "dashboard.summary", title: "Summary", columnSpan: 12, dataSourceRef: "metrics", metrics: [{ id: "spend", label: "Spend", selector: "totalSpend", format: "currency" }] },
    { id: "kpi", kind: "dashboard.kpiTable", title: "KPI table", columnSpan: 6, dataSourceRef: "metrics", rows: [{ id: "reach", label: "Reach", value: "reach", format: "compactNumber", context: "Audience" }] },
    { id: "compare", kind: "dashboard.compare", title: "Compare", columnSpan: 6, dataSourceRef: "metrics", items: [{ id: "spendDelta", label: "Spend", current: "totalSpend", previous: "previousSpend", format: "currency" }] },
    { id: "timeline", kind: "dashboard.timeline", title: "Trend", columnSpan: 8, dataSourceRef: "trend", filterBindings: { region: "region" }, chart: { type: "line", xAxis: { dataKey: "date" }, series: { nameKey: "channel", valueKey: "spend", values: [{ label: "Spend", value: "spend" }] } } },
    { id: "composition", kind: "dashboard.composition", title: "Mix", columnSpan: 4, dataSourceRef: "mix", chart: { type: "donut", categoryKey: "channel", valueKey: "spend" } },
    { id: "dimensions", kind: "dashboard.dimensions", title: "Markets", columnSpan: 6, dataSourceRef: "markets", dimension: { key: "market" }, metric: { key: "spend", format: "currency" } },
    { id: "geo", kind: "dashboard.geoMap", title: "Map", columnSpan: 6, dataSourceRef: "geo", geo: { shape: "us-states", key: "state", labelKey: "stateName", metric: { key: "spend", label: "Spend", format: "currency" } } },
    { id: "status", kind: "dashboard.status", title: "Health", columnSpan: 6, dataSourceRef: "metrics", checks: [{ id: "fresh", label: "Freshness", selector: "freshness", format: "number" }] },
    { id: "filters", kind: "dashboard.filters", title: "Filters", columnSpan: 12, items: [{ id: "dateRange", field: "dateRange", label: "Date Range", type: "dateRange" }, { id: "region", field: "region", label: "Region", multiple: true, collapsed: true, options: [{ label: "NA", value: "NA", default: true }] }] },
    { id: "feed", kind: "dashboard.feed", title: "Trail", columnSpan: 6, dataSourceRef: "audit", fields: { title: "title", body: "body", timestamp: "timestamp" } },
    { id: "table", kind: "dashboard.table", title: "Evidence", columnSpan: 12, dataSourceRef: "rows", columns: [{ key: "channel", label: "Channel" }, { key: "spend", label: "Spend", format: "currency" }] },
    { id: "report", kind: "dashboard.report", title: "Narrative", columnSpan: 6, dataSourceRef: "metrics", sections: [{ id: "finding", title: "Finding", body: ["Spend is ${totalSpend}."] }] },
    { id: "detail", kind: "dashboard.detail", title: "Selected detail", columnSpan: 12, visibleWhen: { selector: "dashboard.selection.entityKey", notEmpty: true }, containers: [{ id: "detailTable", kind: "dashboard.table", title: "Detail rows", dataSourceRef: "detail", selectionBindings: { market: "market" }, columns: [{ key: "market" }, { key: "spend", format: "currency" }] }] },
    { id: "messages", kind: "dashboard.messages", title: "Messages", columnSpan: 6, items: [{ id: "warning", severity: "warning", title: "Watch", body: "Spend is elevated.", visibleWhen: { selector: "quality.alert", equals: true } }] },
    { id: "badges", kind: "dashboard.badges", title: "Signals", columnSpan: 6, dataSourceRef: "metrics", items: [{ id: "quality", label: "Quality", valueField: "quality", tone: "success" }] },
  ],
};

const complete = adaptDashboardToReportDocument(completeDashboard);
assert.equal(complete.source.blockCount, DASHBOARD_REPORT_ADAPTER_KINDS.length);
assert.equal(complete.unsupportedKinds.length, 0);
assert.equal(complete.diagnostics.filter((entry) => entry.severity === "error").length, 0);
assert.deepEqual(new Set(completeDashboard.blocks.map((block) => block.kind)), new Set(DASHBOARD_REPORT_ADAPTER_KINDS));
assert.ok(complete.blocks.every((block) => DASHBOARD_REPORT_ADAPTER_OUTPUT_KINDS.includes(block.kind)));
assert.ok(complete.blocks.some((block) => block.kind === "filterBarBlock"));
assert.ok(complete.blocks.some((block) => block.kind === "geoMapBlock"));
assert.ok(complete.blocks.some((block) => block.kind === "collectionBlock"));
assert.ok(complete.blocks.some((block) => block.kind === "compositeBlock"));
assert.equal(complete.layout.type, "grid");
assert.ok(complete.layout.items.some((item) => item.blockId === "timeline_chart" && item.span === 8));
assert.deepEqual(complete.filterDefinitions.map((item) => item.field), ["dateRange", "region"]);
assert.ok(complete.interactionBindings.some((entry) => entry.sourceBlockId === "timeline" && entry.filterBindings.region === "region"));
assert.ok(complete.interactionBindings.some((entry) => entry.sourceBlockId === "detail" && entry.visibleWhen.notEmpty === true));
assert.deepEqual(complete.blocks.find((block) => block.id === "timeline_chart")?.runtime?.filterBindings, { region: "region" });
assert.equal(complete.blocks.find((block) => block.id === "detail_detail")?.runtime?.visibleWhen?.notEmpty, true);
assert.equal(complete.blocks.find((block) => block.id === "messages_message_warning")?.runtime?.visibleWhen?.equals, true);
assert.ok(complete.dataSourceRefs.includes("detail"));
assert.ok(complete.dataSources.some((source) => source.id === "trend" && source.dimensions.some((field) => field.key === "date")));
assert.ok(complete.dataSources.some((source) => source.id === "trend" && source.measures.some((field) => field.key === "spend")));
assert.equal(complete.dataSources.find((source) => source.id === "trend")?.dataSourceRef, "trend_api");
assert.equal(complete.dataSources.find((source) => source.id === "trend")?.label, "Delivery Trend");
assert.equal(complete.dataSources.find((source) => source.id === "trend")?.request?.path, "/delivery/trend");

const configuredFilters = applyDashboardReportAdapterConfig({
  staticFilters: [{ id: "dateRange", field: "dateRange", label: "Workspace Date", type: "dateRange" }],
}, {
  reportDashboardAdapter: {
    filterDefinitions: complete.filterDefinitions,
    dataSources: complete.dataSources,
  },
});
assert.deepEqual(configuredFilters.staticFilters.map((filter) => filter.id), ["dateRange", "region"]);
assert.equal(configuredFilters.staticFilters[0].label, "Workspace Date");
assert.deepEqual(configuredFilters.staticFilters[1].default, ["NA"]);
assert.equal(configuredFilters.staticFilters[1].paramPath, undefined);
assert.ok(configuredFilters.dataSources.some((source) => source.id === "trend"));
const importedOnlyFilters = applyDashboardReportAdapterConfig({}, {
  reportDashboardAdapter: { filterDefinitions: complete.filterDefinitions },
});
assert.equal(importedOnlyFilters.staticFilters[0].startParamPath, "filters.from");
assert.equal(importedOnlyFilters.staticFilters[0].endParamPath, "filters.to");

const persistedAdapterState = {
  reportDashboardAdapter: {
    source: complete.source,
    dataSources: complete.dataSources,
    filterDefinitions: complete.filterDefinitions,
    interactionBindings: complete.interactionBindings,
    diagnostics: complete.diagnostics,
  },
};
assert.deepEqual(
  mergeReportBuilderState({}, persistedAdapterState).reportDashboardAdapter,
  persistedAdapterState.reportDashboardAdapter,
);
assert.deepEqual(
  sanitizeReportBuilderState({}, persistedAdapterState).reportDashboardAdapter,
  persistedAdapterState.reportDashboardAdapter,
);

const unsupported = adaptDashboardToReportDocument({
  title: "Mixed",
  blocks: [
    completeDashboard.blocks[0],
    { id: "unknown", kind: "dashboard.futurePrimitive" },
  ],
});
assert.deepEqual(unsupported.unsupportedKinds, ["dashboard.futurePrimitive"]);
assert.equal(unsupported.diagnostics[0].code, "dashboardAdapterUnsupportedKind");

const invalidKnownBlock = adaptDashboardToReportDocument({
  title: "Partially invalid",
  blocks: [completeDashboard.blocks[0], { id: "emptyTimeline", kind: "dashboard.timeline", title: "Empty timeline" }],
});
assert.equal(invalidKnownBlock.diagnostics[0].code, "dashboardAdapterInvalidSourceBlock");
assert.equal(invalidKnownBlock.diagnostics[0].sourceBlockId, "emptyTimeline");

assert.throws(
  () => buildReportBuilderImportedStarterFromJsonFile({
    fileName: "multiple.json",
    json: "```forge-ui\n{}\n```\n```forge-ui\n{}\n```",
  }),
  /multiple forge-ui report definitions/i,
);

console.log("reportBuilderForgeUiStarter ✓ maps forge-ui dashboard blocks into authored report-builder blocks");
