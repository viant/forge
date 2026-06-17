import assert from "node:assert/strict";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DashboardBlock } from "./DashboardBlocks.jsx";
import { buildHydratedReportBuilderDocument } from "./reportBuilderHydratedReportDocument.js";
import { buildReportBuilderGetReportDocumentResponse } from "./reportBuilderReportDocumentReadResponse.js";
import { buildPreviewAuthoredReport } from "../../demos/reportBuilder/previewAuthoredReport.js";
import { RAW_ROWS } from "../../demos/reportBuilder/previewDemoRows.js";
import { buildPreviewSavedReportPayloadRecord } from "../../demos/reportBuilder/previewSavedReportPayload.js";

const container = {
  id: "dashboardReportRuntimeDemo",
  stateKey: "dashboardReportRuntimeDemo",
  title: "Dashboard Report Runtime Demo",
  dataSourceRef: "demoReportSource",
};

const semanticModel = {
  modelRef: "model://steward/performance/ad_delivery@v1",
  version: 1,
  label: "Ad Delivery",
  entities: [
    {
      id: "line_delivery",
      label: "Line Delivery",
      dimensions: [
        { id: "event_date", label: "Event Date", dataType: "date" },
        { id: "channel", label: "Channel", dataType: "string" },
        {
          id: "country_code",
          label: "Market",
          dataType: "string",
          governance: {
            status: "deprecated",
            ownerRef: "team://steward/performance",
          },
        },
        { id: "region", label: "Region", dataType: "string" },
        { id: "metro_code", label: "Metro Area", dataType: "string" },
      ],
      measures: [
        {
          id: "available_impressions",
          label: "Available Impressions",
          format: "compactNumber",
          dataType: "number",
          aggregation: "sum",
          governance: {
            status: "draft",
            ownerRef: "team://steward/performance",
          },
        },
        {
          id: "household_uniques",
          label: "Household Uniques",
          format: "compactNumber",
          dataType: "number",
          aggregation: "sum",
        },
      ],
    },
  ],
};

const reportBuilderConfig = {
  title: "Dashboard Report Runtime Demo",
  binding: {
    mode: "semantic",
    modelRef: "model://steward/performance/ad_delivery@v1",
    entity: "line_delivery",
    selectedDimensions: ["event_date", "country_code"],
    selectedMeasures: ["available_impressions", "household_uniques"],
  },
  measures: [
    { id: "avails", key: "avails", semanticRef: "available_impressions", label: "Avails", default: true, format: "compactNumber" },
    { id: "hhUniqs", key: "hhUniqs", semanticRef: "household_uniques", label: "HH Uniques", format: "compactNumber" },
  ],
  dimensions: [
    { id: "eventDate", key: "eventDate", semanticRef: "event_date", label: "Date", default: true, chartAxis: true, format: "date" },
    {
      id: "channelV2",
      key: "channelV2",
      semanticRef: "channel",
      label: "Channel",
      default: true,
      runtimeFilter: {
        includeParamPath: "filters.includeChannelV2",
        excludeParamPath: "filters.excludeChannelV2",
      },
    },
    {
      id: "country",
      key: "country",
      semanticRef: "country_code",
      label: "Market",
      runtimeFilter: {
        includeParamPath: "filters.includeCountry",
        excludeParamPath: "filters.excludeCountry",
      },
    },
    {
      id: "region",
      key: "region",
      semanticRef: "region",
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
      semanticRef: "metro_code",
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
      type: "dateRange",
      required: true,
      startParamPath: "filters.From",
      endParamPath: "filters.To",
    },
  ],
  drillMetadata: {
    hierarchies: [
      {
        id: "forecast_location",
        label: "Forecast Location",
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
    defaultMode: "chart",
    pageSize: 50,
    defaultTablePresets: [
      {
        title: "Location Ladder",
        dimensions: ["country"],
        measures: ["avails", "hhUniqs"],
        primaryMeasure: "avails",
        orderField: "avails",
        orderDir: "desc",
        pageSize: 12,
        clearChart: true,
      },
    ],
    orderFields: [
      { value: "eventDate", field: "eventDate", default: true, defaultDirection: "asc" },
      { value: "avails", field: "avails", defaultDirection: "desc" },
      { value: "hhUniqs", field: "hhUniqs", defaultDirection: "desc" },
    ],
    defaultChartSpecs: [
      {
        title: "Locations · Top Markets",
        type: "horizontal_bar",
        xField: "country",
        yFields: ["avails"],
      },
    ],
  },
};

const savedRecord = buildPreviewSavedReportPayloadRecord({
  container,
  reportBuilderConfig,
  rows: RAW_ROWS,
  semanticModel,
  reportId: "forecastingLocationRuntimeVisibility",
  title: "Forecasting Location Runtime Visibility",
  presetKind: "table",
  presetTitle: "Location Ladder",
  documentVersion: 5,
  artifactId: "forecasting_location_runtime_visibility",
  savedAt: 9200,
});

const savedReportPayload = structuredClone(savedRecord.savedReportPayload);
savedReportPayload.compileState = {
  ...(savedReportPayload.compileState || {}),
  diagnostics: [
    ...((savedReportPayload.compileState?.diagnostics || [])),
    {
      code: "documentBlockColumnUnavailable",
      severity: "error",
      blockId: "primaryTable",
      path: "reportDocument.blocks.primaryTable.columns[0]",
      message: "Primary Table references unavailable table column 'country'.",
      suggestedFix: "Re-select the field in the builder or edit the table block to use one of the current selected dimensions or measures.",
    },
  ],
};

const getResponse = buildReportBuilderGetReportDocumentResponse(savedReportPayload, {
  documentVersion: 5,
  savedAt: 9200,
});

assert.ok(getResponse);

const hydrated = buildHydratedReportBuilderDocument(getResponse, {
  container,
  builderIdentity: {
    containerId: container.id,
    stateKey: container.stateKey,
    dataSourceRef: container.dataSourceRef,
  },
});

assert.equal(hydrated.valid, true);

const reopened = buildPreviewAuthoredReport({
  container,
  config: hydrated.config,
  state: hydrated.state,
  rows: RAW_ROWS,
  semanticSummary: getResponse.reportSpec?.semanticSummary || getResponse.document?.semanticSummary || null,
  additionalDiagnostics: hydrated.compileState?.diagnostics || [],
});

const html = renderToStaticMarkup(
  React.createElement(DashboardBlock, {
    container: reopened.runtimeBlock,
    context: {
      handlers: {},
      locale: "en-US",
    },
  }),
);

assert.ok(html.includes("Authored Semantic Report"));
assert.ok(html.includes("Live builder state compiled into the current authored report runtime contract."));
assert.ok(html.includes("Model Ad Delivery"));
assert.ok(html.includes("Entity Line Delivery"));
assert.ok(html.includes("Dimensions Market"));
assert.ok(html.includes("Measures Available Impressions, Household Uniques"));
assert.ok(html.includes("1 deprecated"));
assert.ok(html.includes("1 draft"));
assert.ok(html.includes("Runtime Diagnostics"));
assert.ok(html.includes("Market • Deprecated"));
assert.ok(html.includes("Available Impressions • Draft"));
assert.ok(html.includes("Primary Table references unavailable table column"));
assert.ok(html.includes("Re-select the field in the builder or edit the table block to use one of the current selected dimensions or measures."));
assert.ok(html.includes("documentBlockColumnUnavailable"));
assert.ok(html.includes("Block primaryTable"));
assert.ok(html.includes("reportDocument.blocks.primaryTable.columns[0]"));

console.log("DashboardReportRuntime ✓ renders reopened semantic runtime blocks with binding chips and actionable diagnostics");
