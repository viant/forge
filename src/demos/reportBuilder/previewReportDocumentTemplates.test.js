import assert from "node:assert/strict";

import { instantiateReportBuilderDocumentTemplate } from "../../components/dashboard/reportBuilderDocumentTemplates.js";
import {
  buildReportBuilderRuntimePreview,
  buildReportBuilderRuntimePreviewModel,
} from "../../components/dashboard/reportBuilderRuntimePreview.js";
import { resolveReportRuntimeDrillMetadataProvider } from "../../components/dashboard/reportRuntimeDrillProvider.js";
import { RAW_ROWS } from "./previewDemoRows.js";
import { buildPreviewReportDocumentTemplates } from "./previewReportDocumentTemplates.js";
import { runPreviewRuntimeRequest } from "./previewRuntimeQuery.js";

const container = {
  id: "capacityPreview",
  stateKey: "capacityPreview",
  title: "Capacity Preview",
  dataSourceRef: "demoReportSource",
};

const config = {
  title: "Capacity Preview",
  binding: {
    mode: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    entity: "line_delivery",
    selectedDimensions: ["channel", "country_code"],
    selectedMeasures: ["available_impressions", "household_uniques"],
  },
  measures: [
    { id: "avails", key: "avails", label: "Avails", default: true, format: "compactNumber" },
    { id: "hhUniqs", key: "hhUniqs", label: "HH Uniques", default: true, format: "compactNumber" },
  ],
  computedMeasures: [
    {
      id: "reachRate",
      key: "reachRate",
      label: "Reach Rate",
      format: "percent",
      compute: {
        type: "ratio",
        numerator: "hhUniqs",
        denominator: "avails",
        scale: 100,
        decimals: 2,
      },
    },
  ],
  dimensions: [
    {
      id: "channelV2",
      key: "channelV2",
      label: "Channel",
      runtimeFilter: {
        includeParamPath: "filters.includeChannelV2",
        excludeParamPath: "filters.excludeChannelV2",
      },
    },
    {
      id: "publisher",
      key: "publisher",
      label: "Publisher",
      runtimeFilter: {
        includeParamPath: "filters.includePublisher",
        excludeParamPath: "filters.excludePublisher",
      },
    },
    {
      id: "siteType",
      key: "siteType",
      label: "Site Type",
      runtimeFilter: {
        includeParamPath: "filters.includeSiteType",
        excludeParamPath: "filters.excludeSiteType",
      },
    },
    {
      id: "country",
      key: "country",
      label: "Market",
      runtimeFilter: {
        includeParamPath: "filters.includeCountry",
        excludeParamPath: "filters.excludeCountry",
      },
    },
    {
      id: "region",
      key: "region",
      label: "Region",
      runtimeFilter: {
        includeParamPath: "filters.includeLocationDim",
        excludeParamPath: "filters.excludeLocationDim",
        format: "locationTuple",
        parentField: "country",
      },
    },
    {
      id: "metrocode",
      key: "metrocode",
      label: "Metro Area",
      runtimeFilter: {
        includeParamPath: "filters.includeMetrocode",
        excludeParamPath: "filters.excludeMetrocode",
      },
    },
  ],
  staticFilters: [
    {
      id: "dateRange",
      label: "Date Range",
      type: "dateRange",
      required: true,
      startParamPath: "filters.From",
      endParamPath: "filters.To",
    },
    {
      id: "channelsFilter",
      label: "Channels",
      multiple: true,
      options: [
        { label: "Display", value: "Display" },
        { label: "CTV", value: "CTV" },
      ],
    },
  ],
  drillMetadata: {
    hierarchies: [
      {
        id: "capacity_inventory",
        label: "Capacity Inventory",
        levels: [
          { field: "channelV2", label: "Channel" },
          { field: "publisher", label: "Publisher" },
          { field: "siteType", label: "Site Type" },
        ],
      },
      {
        id: "capacity_location",
        label: "Capacity Location",
        levels: [
          { field: "country", label: "Market" },
          { field: "region", label: "Region" },
          { field: "metrocode", label: "Metro Area" },
        ],
      },
    ],
  },
  result: {
    chartCreationMode: "explicit",
    defaultMode: "table",
    viewModes: ["table", "chart"],
    supportedChartTypes: ["line", "horizontal_bar"],
    orderFields: [
      { value: "avails", field: "avails", default: true, defaultDirection: "desc" },
      { value: "channelV2", field: "channelV2", defaultDirection: "asc" },
      { value: "country", field: "country", defaultDirection: "asc" },
    ],
    pageSize: 50,
  },
};

const templates = buildPreviewReportDocumentTemplates();
assert.deepEqual(
  templates.map((template) => template.id),
  ["market_brief", "market_efficiency_brief", "capacity_inventory_brief", "capacity_location_brief"],
);

function buildTemplateRuntime(templateId = "", {
  refinements = [],
  drillTransitions = [],
  orderBy = "",
} = {}) {
  const template = templates.find((entry) => entry.id === templateId);
  assert.ok(template, `Template '${templateId}' should exist.`);
  const instantiated = instantiateReportBuilderDocumentTemplate(config, template);
  assert.equal(instantiated.valid, true, `Template '${templateId}' should instantiate cleanly.`);
  const model = buildReportBuilderRuntimePreviewModel({
    container,
    config,
    state: instantiated.nextState,
    refinements,
    drillTransitions,
    requestTransform: orderBy
      ? (({ request }) => ({
        ...request,
        orderBy: [orderBy],
      }))
      : null,
  });
  assert.ok(model?.reportSpec, `Template '${templateId}' should build a runtime preview model.`);
  const runtimeRows = runPreviewRuntimeRequest(
    RAW_ROWS,
    model.reportSpec.datasets[0].request,
    config,
  );
  const preview = buildReportBuilderRuntimePreview({
    model,
    rows: runtimeRows.rows,
    hasMore: runtimeRows.hasMore,
  });
  return {
    template,
    instantiated,
    model,
    preview,
  };
}

function hasDrillAction(actions = [], nextFieldRef = "") {
  return (Array.isArray(actions) ? actions : []).some((action) => (
    action?.kind === "drill"
    && action?.nextFieldRef === nextFieldRef
  ));
}

const inventoryBase = buildTemplateRuntime("capacity_inventory_brief");
assert.equal(inventoryBase.instantiated.nextState.reportDocumentTitle, "Capacity Inventory Brief");
assert.deepEqual(inventoryBase.instantiated.nextState.reportDocumentLayout, {
  type: "stack",
  items: [
    { blockId: "scopeFilters" },
    { blockId: "activeDrillPath" },
    { blockId: "primaryBuilder" },
    { blockId: "narrativeIntro", size: "half" },
    { blockId: "headlineKpi", size: "half" },
  ],
});
assert.deepEqual(inventoryBase.model.reportSpec.layoutIntent.items, [
  { blockId: "scopeFilters" },
  { blockId: "activeDrillPath" },
  { blockId: "primaryTable" },
  { blockId: "primaryChart" },
  { blockId: "narrativeIntro", size: "half" },
  { blockId: "headlineKpi", size: "half" },
]);
const inventoryProvider = resolveReportRuntimeDrillMetadataProvider({
  reportSpec: inventoryBase.model.reportSpec,
});
assert.ok(inventoryProvider, "Capacity inventory template should expose runtime drill metadata.");
assert.equal(
  hasDrillAction(await inventoryProvider.listAvailableRefinements("tableBlock", "channelV2"), "publisher"),
  true,
);
assert.equal(
  hasDrillAction(await inventoryProvider.listAvailableRefinements("tableBlock", "publisher"), "siteType"),
  true,
);

const marketEfficiencyBase = buildTemplateRuntime("market_efficiency_brief");
assert.equal(marketEfficiencyBase.instantiated.nextState.reportDocumentTitle, "Market Efficiency Brief");
assert.deepEqual(marketEfficiencyBase.instantiated.nextState.selectedMeasures, ["avails"]);
assert.deepEqual(marketEfficiencyBase.instantiated.nextState.selectedDimensions, ["country"]);
assert.deepEqual(marketEfficiencyBase.instantiated.nextState.reportDocumentLayout, {
  type: "stack",
  items: [
    { blockId: "scopeFilters" },
    { blockId: "activeDrillPath" },
    { blockId: "primaryBuilder" },
    { blockId: "reachRateTrend" },
    { blockId: "narrativeIntro", size: "half" },
    { blockId: "reachRateTable", size: "half" },
    { blockId: "headlineKpi" },
  ],
});
assert.equal(marketEfficiencyBase.model.reportSpec.calculatedFields.some((field) => field.id === "reachRate" && field.kind === "rowCalc"), true);
assert.equal(marketEfficiencyBase.model.reportSpec.datasets[0].request.measures.avails, true);
assert.equal(marketEfficiencyBase.model.reportSpec.datasets[0].request.measures.hhUniqs, true);
assert.equal(marketEfficiencyBase.model.reportSpec.datasets[0].request.measures.reachRate, undefined);
assert.equal(marketEfficiencyBase.model.reportSpec.datasets[0].request.dimensions.country, true);
assert.equal(marketEfficiencyBase.model.reportSpec.datasets[0].request.dimensions.channelV2, true);
assert.equal(marketEfficiencyBase.model.reportSpec.blocks.find((block) => block.id === "activeDrillPath")?.kind, "refinementBarBlock");
assert.deepEqual(
  marketEfficiencyBase.model.reportSpec.layoutIntent.items.filter((item) => item.blockId === "activeDrillPath"),
  [{ blockId: "activeDrillPath" }],
);
assert.equal(marketEfficiencyBase.model.reportSpec.blocks.find((block) => block.id === "headlineKpi")?.valueField, "reachRate");
assert.equal(marketEfficiencyBase.model.reportSpec.blocks.find((block) => block.id === "reachRateTrend")?.chartSpec?.yFields?.[0], "reachRate");
assert.equal(marketEfficiencyBase.model.reportSpec.blocks.find((block) => block.id === "reachRateTrend")?.chartSpec?.seriesField, "channelV2");
assert.equal(marketEfficiencyBase.model.reportSpec.blocks.find((block) => block.id === "reachRateTable")?.columns?.some((column) => column.key === "reachRate"), true);
assert.equal(marketEfficiencyBase.preview.reportFill.datasets[0].rows[0].reachRate, 40.82);
assert.deepEqual(marketEfficiencyBase.preview.reportFill.blocks.find((block) => block.id === "activeDrillPath")?.content, {
  title: "Active Drill Path",
  actionKinds: ["remove", "clearAll"],
  emptyLabel: "No active market drill path",
  refinements: [],
});
assert.equal(marketEfficiencyBase.preview.reportFill.blocks.find((block) => block.id === "reachRateTrend")?.content?.chartSpec?.yFields?.[0], "reachRate");
assert.equal(marketEfficiencyBase.preview.reportFill.blocks.find((block) => block.id === "reachRateTrend")?.content?.chartSpec?.seriesField, "channelV2");
assert.equal(marketEfficiencyBase.preview.reportFill.blocks.find((block) => block.id === "reachRateTrend")?.content?.chartModel?.series?.values?.[0]?.value, "reachRate");
assert.equal(marketEfficiencyBase.preview.reportFill.blocks.find((block) => block.id === "reachRateTable")?.content?.columns?.some((column) => column.key === "reachRate"), true);
assert.equal(marketEfficiencyBase.preview.reportFill.blocks.find((block) => block.id === "reachRateTable")?.content?.resolvedRows?.[0]?.cells?.some((cell) => cell.key === "reachRate" && cell.value === 40.82), true);
assert.equal(marketEfficiencyBase.preview.reportFill.blocks.find((block) => block.id === "headlineKpi")?.content?.valueField, "reachRate");
assert.equal(marketEfficiencyBase.preview.reportFill.blocks.find((block) => block.id === "headlineKpi")?.content?.value, 40.82);
assert.equal(marketEfficiencyBase.preview.reportFill.blocks.find((block) => block.id === "headlineKpi")?.content?.secondaryValue, "US");
assert.equal(marketEfficiencyBase.preview.reportPrint.bookmarks.some((bookmark) => bookmark.id === "bookmark.activeDrillPath"), false);
assert.equal(
  marketEfficiencyBase.preview.reportPrint.pages.flatMap((page) => page.elements || []).some((element) => element.kind === "text" && element.text === "No active market drill path"),
  false,
);

const marketEfficiencyDrilled = buildTemplateRuntime("market_efficiency_brief", {
  refinements: [
    {
      id: "drill:country:reachRateTrend",
      op: "drill",
      field: "country",
      values: ["US"],
      sourceBlockId: "reachRateTrend",
      label: "Drill to Region = US",
    },
  ],
  drillTransitions: [
    {
      refinementId: "drill:country:reachRateTrend",
      sourceField: "country",
      nextFieldRef: "region",
      sourceBlockId: "reachRateTrend",
    },
  ],
  orderBy: "region asc",
});
assert.equal(marketEfficiencyDrilled.model.reportSpec.datasets[0].request.dimensions.region, true);
assert.deepEqual(marketEfficiencyDrilled.model.reportSpec.datasets[0].request.filters.includeCountry, ["US"]);
assert.deepEqual(marketEfficiencyDrilled.model.reportSpec.datasets[0].request.orderBy, ["region asc"]);
assert.deepEqual(marketEfficiencyDrilled.preview.reportFill.blocks.find((block) => block.id === "activeDrillPath")?.content, {
  title: "Active Drill Path",
  actionKinds: ["remove", "clearAll"],
  emptyLabel: "No active market drill path",
  refinements: [
    {
      id: "drill:country:reachRateTrend",
      op: "drill",
      field: "country",
      values: ["US"],
      sourceBlockId: "reachRateTrend",
      label: "Drill to Region = US",
    },
  ],
});
assert.equal(
  marketEfficiencyDrilled.preview.reportPrint.pages.flatMap((page) => page.elements || []).some((element) => element.kind === "text" && element.text === "Drill to Region = US"),
  true,
);
assert.equal(marketEfficiencyDrilled.preview.reportPrint.bookmarks.some((bookmark) => bookmark.id === "bookmark.activeDrillPath"), true);
assert.equal(
  marketEfficiencyDrilled.preview.reportPrint.pages.flatMap((page) => page.elements || []).some((element) => element.kind === "text" && element.text === "No active market drill path"),
  false,
);

const inventoryDrilled = buildTemplateRuntime("capacity_inventory_brief", {
  refinements: [
    {
      id: "drill:channelV2:primaryTable",
      op: "drill",
      field: "channelV2",
      values: ["Display"],
      sourceBlockId: "primaryTable",
      label: "Drill to Publisher = Display",
    },
    {
      id: "drill:publisher:primaryTable",
      op: "drill",
      field: "publisher",
      values: ["Acme Media"],
      sourceBlockId: "primaryTable",
      label: "Drill to Site Type = Acme Media",
    },
  ],
  drillTransitions: [
    {
      refinementId: "drill:channelV2:primaryTable",
      sourceField: "channelV2",
      nextFieldRef: "publisher",
      sourceBlockId: "primaryTable",
    },
    {
      refinementId: "drill:publisher:primaryTable",
      sourceField: "publisher",
      nextFieldRef: "siteType",
      sourceBlockId: "primaryTable",
    },
  ],
  orderBy: "siteType asc",
});
assert.equal(inventoryDrilled.model.reportSpec.datasets[0].request.dimensions.publisher, true);
assert.equal(inventoryDrilled.model.reportSpec.datasets[0].request.dimensions.siteType, true);
assert.deepEqual(
  inventoryDrilled.preview.reportFill.datasets[0].rows.map((row) => row.siteType),
  ["Open Web", "Private Marketplace"],
);

const locationBase = buildTemplateRuntime("capacity_location_brief");
assert.equal(locationBase.instantiated.nextState.reportDocumentTitle, "Capacity Location Brief");
assert.deepEqual(locationBase.instantiated.nextState.reportDocumentLayout, {
  type: "stack",
  items: [
    { blockId: "scopeFilters" },
    { blockId: "activeDrillPath" },
    { blockId: "primaryBuilder" },
    { blockId: "narrativeIntro", size: "half" },
    { blockId: "headlineKpi", size: "half" },
  ],
});
const locationProvider = resolveReportRuntimeDrillMetadataProvider({
  reportSpec: locationBase.model.reportSpec,
});
assert.ok(locationProvider, "Capacity location template should expose runtime drill metadata.");
assert.equal(
  hasDrillAction(await locationProvider.listAvailableRefinements("tableBlock", "country"), "region"),
  true,
);
assert.equal(
  hasDrillAction(await locationProvider.listAvailableRefinements("tableBlock", "region"), "metrocode"),
  true,
);

const locationDrilled = buildTemplateRuntime("capacity_location_brief", {
  refinements: [
    {
      id: "drill:country:primaryTable",
      op: "drill",
      field: "country",
      values: ["US"],
      sourceBlockId: "primaryTable",
      label: "Drill to Region = US",
    },
    {
      id: "drill:region:primaryTable",
      op: "drill",
      field: "region",
      values: ["West"],
      sourceBlockId: "primaryTable",
      label: "Drill to Metro = West",
    },
  ],
  drillTransitions: [
    {
      refinementId: "drill:country:primaryTable",
      sourceField: "country",
      nextFieldRef: "region",
      sourceBlockId: "primaryTable",
    },
    {
      refinementId: "drill:region:primaryTable",
      sourceField: "region",
      nextFieldRef: "metrocode",
      sourceBlockId: "primaryTable",
    },
  ],
  orderBy: "metrocode asc",
});
assert.equal(locationDrilled.model.reportSpec.datasets[0].request.dimensions.region, true);
assert.equal(locationDrilled.model.reportSpec.datasets[0].request.dimensions.metrocode, true);
assert.deepEqual(
  locationDrilled.preview.reportFill.datasets[0].rows.map((row) => row.metrocode),
  ["Los Angeles DMA", "New York DMA"],
);

console.log("previewReportDocumentTemplates ✓ capacity authored templates preserve layout sizing and align with 3-step drill ladders");
