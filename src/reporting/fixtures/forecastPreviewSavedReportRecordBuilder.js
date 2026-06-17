import { RAW_ROWS } from "../../demos/reportBuilder/previewDemoRows.js";
import {
  PREVIEW_LANDSCAPE_PAGE_GEOMETRY,
  buildPreviewSavedReportPayloadRecord,
} from "../../demos/reportBuilder/previewSavedReportPayload.js";

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

const FORECAST_PREVIEW_CONTAINER = Object.freeze({
  id: "demoReportBuilder",
  stateKey: "demoReportBuilder",
  title: "Report Builder Demo",
  dataSourceRef: "demoReportSource",
});

const FORECAST_PREVIEW_SEMANTIC_MODEL = Object.freeze({
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
        { id: "country_code", label: "Market", dataType: "string" },
        { id: "publisher", label: "Publisher", dataType: "string" },
        { id: "site_type", label: "Site Type", dataType: "string" },
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
});

const FORECAST_PREVIEW_REPORT_BUILDER_CONFIG = Object.freeze({
  title: "Report Builder Demo",
  binding: {
    mode: "semantic",
    modelRef: "model://steward/performance/ad_delivery@v1",
    entity: "line_delivery",
    selectedDimensions: ["event_date", "channel", "country_code"],
    selectedMeasures: ["available_impressions"],
  },
  measures: [
    { id: "avails", key: "avails", semanticRef: "available_impressions", label: "Avails", default: true, format: "compactNumber" },
    { id: "hhUniqs", key: "hhUniqs", semanticRef: "household_uniques", label: "HH Uniques", format: "compactNumber" },
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
      id: "publisher",
      key: "publisher",
      semanticRef: "publisher",
      label: "Publisher",
      runtimeFilter: {
        includeParamPath: "filters.includePublisher",
        excludeParamPath: "filters.excludePublisher",
      },
    },
    {
      id: "siteType",
      key: "siteType",
      semanticRef: "site_type",
      label: "Site Type",
      runtimeFilter: {
        includeParamPath: "filters.includeSiteType",
        excludeParamPath: "filters.excludeSiteType",
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
        id: "forecast_inventory",
        label: "Forecast Inventory",
        levels: [
          { field: "channelV2", label: "Channel" },
          { field: "publisher", label: "Publisher" },
          { field: "siteType", label: "Site Type" },
        ],
      },
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
    fieldActions: [
      {
        fieldRef: "channelV2",
        actions: [
          { id: "drill_market", label: "Drill to Market", kind: "drill", nextFieldRef: "country" },
          { id: "detail_channel", label: "Show channel details", kind: "detail", targetRef: "target://steward/performance/channel-detail" },
        ],
      },
      {
        fieldRef: "country",
        actions: [
          { id: "detail_market", label: "Show market details", kind: "detail", targetRef: "target://steward/performance/market-detail" },
        ],
      },
    ],
    detailTargets: [
      {
        targetRef: "target://steward/performance/channel-detail",
        navigationMode: "hostRoute",
        parameters: {
          channel: "$value",
          campaign: "$row.campaign",
        },
      },
      {
        targetRef: "target://steward/performance/market-detail",
        navigationMode: "hostRoute",
        parameters: {
          country: "$value",
        },
      },
    ],
  },
  result: {
    chartCreationMode: "explicit",
    defaultMode: "chart",
    pageSize: 50,
    defaultTablePresets: [
      {
        title: "Inventory Ladder",
        dimensions: ["channelV2"],
        measures: ["avails", "hhUniqs"],
        primaryMeasure: "avails",
        orderField: "avails",
        orderDir: "desc",
        pageSize: 12,
        clearChart: true,
      },
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
        title: "Inventory · Top Channels",
        type: "horizontal_bar",
        xField: "channelV2",
        yFields: ["avails"],
      },
      {
        title: "Locations · Top Markets",
        type: "horizontal_bar",
        xField: "country",
        yFields: ["avails"],
      },
    ],
  },
});

const FORECAST_DIRECT_SERIES_ROWS = Object.freeze([
  { eventDate: "2026-05-01", channelV2: "Display", avails: 40000, hhUniqs: 16000, country: "US" },
  { eventDate: "2026-05-01", channelV2: "CTV", avails: 34700, hhUniqs: 15200, country: "US" },
  { eventDate: "2026-05-02", channelV2: "Display", avails: 42000, hhUniqs: 17000, country: "US" },
  { eventDate: "2026-05-02", channelV2: "CTV", avails: 36400, hhUniqs: 15600, country: "US" },
  { eventDate: "2026-05-03", channelV2: "Display", avails: 36000, hhUniqs: 14800, country: "CA" },
  { eventDate: "2026-05-03", channelV2: "CTV", avails: 33700, hhUniqs: 14200, country: "CA" },
  { eventDate: "2026-05-04", channelV2: "Display", avails: 38000, hhUniqs: 15500, country: "CA" },
  { eventDate: "2026-05-04", channelV2: "CTV", avails: 35800, hhUniqs: 14900, country: "CA" },
]);

export function buildForecastLandscapeSavedReportRecord({
  reportId = "",
  title = "",
  templateId = "",
  presetKind = "table",
  presetTitle = "",
  documentVersion = 0,
  artifactId = "",
  savedAt = 0,
} = {}) {
  return buildPreviewSavedReportPayloadRecord({
    container: FORECAST_PREVIEW_CONTAINER,
    reportBuilderConfig: FORECAST_PREVIEW_REPORT_BUILDER_CONFIG,
    rows: RAW_ROWS,
    semanticModel: FORECAST_PREVIEW_SEMANTIC_MODEL,
    reportId,
    title,
    templateId,
    presetKind,
    presetTitle,
    documentVersion,
    artifactId,
    savedAt,
    pageGeometry: PREVIEW_LANDSCAPE_PAGE_GEOMETRY,
  });
}

export function buildForecastInventoryTopChannelsLandscapeSavedReportRecord() {
  return buildForecastLandscapeSavedReportRecord({
    reportId: "forecastingInventoryTopChannelsQ3",
    title: "Forecasting Inventory Top Channels Q3",
    templateId: "forecast_inventory_brief",
    presetKind: "chart",
    presetTitle: "Inventory · Top Channels",
    documentVersion: 7,
    artifactId: "forecasting_q3_inventory_top_channels",
    savedAt: 9400,
  });
}

export function buildForecastLocationsTopMarketsLandscapeSavedReportRecord() {
  return buildForecastLandscapeSavedReportRecord({
    reportId: "forecastingLocationsTopMarketsQ3",
    title: "Forecasting Locations Top Markets Q3",
    templateId: "forecast_location_brief",
    presetKind: "chart",
    presetTitle: "Locations · Top Markets",
    documentVersion: 8,
    artifactId: "forecasting_q3_locations_top_markets",
    savedAt: 9500,
  });
}

function buildForecastDirectSeriesReportBuilderConfig() {
  const next = cloneValue(FORECAST_PREVIEW_REPORT_BUILDER_CONFIG);
  next.drillMetadata = next.drillMetadata || {};
  next.drillMetadata.fieldActions = [
    {
      fieldRef: "eventDate",
      actions: [
        { id: "detail_date", label: "Show date details", kind: "detail", targetRef: "target://steward/performance/date-detail" },
      ],
    },
    ...(Array.isArray(next.drillMetadata.fieldActions) ? next.drillMetadata.fieldActions : []),
  ];
  next.drillMetadata.detailTargets = [
    ...(Array.isArray(next.drillMetadata.detailTargets) ? next.drillMetadata.detailTargets : []),
    {
      targetRef: "target://steward/performance/date-detail",
      navigationMode: "hostRoute",
      parameters: {
        eventDate: "$value",
        country: "$row.country",
      },
    },
  ];
  next.result = next.result || {};
  next.result.defaultChartSpecs = [
    ...(Array.isArray(next.result.defaultChartSpecs) ? next.result.defaultChartSpecs : []),
    {
      title: "Avails + HH Uniques by Date",
      eyebrow: "KPI Blend",
      accentTone: "household",
      highlights: ["Dual Axis", "Reach + Volume", "Full Query"],
      type: "bar",
      xField: "eventDate",
      yFields: ["avails", "hhUniqs"],
      seriesOptions: {
        avails: { type: "bar", axis: "left", stackId: "reach" },
        hhUniqs: { type: "line", axis: "right" },
      },
    },
  ];
  return next;
}

export function buildForecastKpiBlendByDateLandscapeSavedReportRecord() {
  return buildPreviewSavedReportPayloadRecord({
    container: FORECAST_PREVIEW_CONTAINER,
    reportBuilderConfig: buildForecastDirectSeriesReportBuilderConfig(),
    rows: FORECAST_DIRECT_SERIES_ROWS,
    semanticModel: FORECAST_PREVIEW_SEMANTIC_MODEL,
    reportId: "forecastingKpiBlendByDateQ3",
    title: "Forecasting KPI Blend Q3",
    presetKind: "chart",
    presetTitle: "Avails + HH Uniques by Date",
    documentVersion: 9,
    artifactId: "forecasting_q3_kpi_blend_by_date",
    savedAt: 9600,
    pageGeometry: PREVIEW_LANDSCAPE_PAGE_GEOMETRY,
  });
}
