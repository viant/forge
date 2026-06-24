import assert from "node:assert/strict";

import { buildReportBuilderGetReportDocumentResponse } from "../../components/dashboard/reportBuilderReportDocumentReadResponse.js";
import {
  applyReportBuilderHydratedDocumentSessionState,
  buildHydratedReportBuilderDocument,
  buildReportBuilderHydratedDocumentSession,
  resolveReportBuilderHydratedDocumentSessionFromState,
  setReportBuilderHydratedDocumentSessionRuntimePreviewInteraction,
} from "../../components/dashboard/reportBuilderHydratedReportDocument.js";
import {
  applyReportRuntimeInteractionDrillTransition,
  applyReportRuntimeInteractionRefinement,
  clearReportRuntimeInteractionState,
  clearReportRuntimeInteractionDetailState,
  createReportRuntimeInteractionState,
  removeReportRuntimeInteractionRefinement,
  replaceReportRuntimeInteractionState,
  setReportRuntimeInteractionDetailDiagnostic,
  setReportRuntimeInteractionHostIntent,
} from "../../components/dashboard/reportRuntimeInteractionStateModel.js";
import {
  buildReportRuntimeHandlers,
  createReportRuntimeDetailTargetOpener,
  resolveReportRuntimePreviewDetailProvider,
} from "../../components/dashboard/reportRuntimePreviewHandlers.js";
import {
  clearReportRuntimeChartSelection,
  setReportRuntimeChartSelection,
} from "../../components/dashboard/reportRuntimeChartSelectionState.js";
import { resolveReportRuntimeDrillMetadataProvider } from "../../components/dashboard/reportRuntimeDrillProvider.js";
import { buildReportRuntimeTableInteractionState } from "../../components/dashboard/reportRuntimeTableInteractionState.js";
import { buildReportRuntimeChartInteractionState } from "../../components/dashboard/reportRuntimeChartInteractionState.js";
import { executeReportRuntimeAction } from "../../components/dashboard/reportRuntimeActionExecutor.js";
import {
  resolveReportRuntimeChartActionFields,
  resolveReportRuntimePrimaryBlocks,
  resolveReportRuntimeRefinementFields,
} from "../../components/dashboard/reportRuntimeModel.js";
import { buildReportBuilderRuntimePreviewModel } from "../../components/dashboard/reportBuilderRuntimePreview.js";
import {
  buildReportRuntimeRefinementBarClearExecution,
  buildReportRuntimeRefinementBarRedoExecution,
  buildReportRuntimeRefinementBarRemoveExecution,
  buildReportRuntimeRefinementBarUndoExecution,
} from "../../components/dashboard/reportRuntimeRefinementBarExecutionModel.js";
import {
  createReportRuntimeInteractionHistoryState,
  recordReportRuntimeInteractionHistory,
  redoReportRuntimeInteractionHistory,
  summarizeReportRuntimeInteractionHistoryState,
  undoReportRuntimeInteractionHistory,
} from "../../components/dashboard/useReportRuntimeInteractionState.js";
import { validateReportExportRequest, validateReportPrint } from "../../reporting/schema/reportSchemas.js";
import { RAW_ROWS } from "./previewDemoRows.js";
import { buildPreviewAuthoredReport, buildPreviewAuthoredReportModel } from "./previewAuthoredReport.js";
import {
  PREVIEW_LANDSCAPE_PAGE_GEOMETRY,
  buildPreviewSavedReportPayloadRecordFromSeed,
  buildPreviewSavedReportPayloadRecord,
} from "./previewSavedReportPayload.js";
import { buildCapacityDirectSeriesFixtureState } from "../../reporting/fixtures/capacityDirectSeriesFixtureState.js";

const container = {
  id: "demoReportBuilder",
  stateKey: "demoReportBuilder",
  title: "Report Builder Demo",
  dataSourceRef: "demoReportSource",
};

const semanticModel = {
  modelRef: "model://example/performance/delivery@v1",
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
          id: "audience_index",
          label: "Audience Index",
          format: "number",
          dataType: "number",
          aggregation: "avg",
          category: "Audience",
          definitionRef: "harmonizer://feature/user.segment.index",
          governance: {
            status: "approved",
            certification: "reviewed",
            classification: "harmonizer.audience",
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
      parameters: [
        {
          id: "reporting_window",
          label: "Date Range",
          dataType: "date",
        },
        {
          id: "delivery_channels_filter",
          label: "Channels",
          dataType: "string",
        },
        {
          id: "audience_segment",
          label: "Audience Segment",
          dataType: "string",
          category: "Audience",
          definitionRef: "harmonizer://feature/user.segment",
          governance: {
            status: "approved",
            classification: "harmonizer.audience",
          },
        },
      ],
    },
  ],
};

const flatFieldSemanticModel = {
  modelRef: "model://example/performance/delivery@v1",
  version: 1,
  label: "Ad Delivery",
  entities: [
    {
      id: "line_delivery",
      label: "Line Delivery",
      fields: [
        { id: "event_date", label: "Event Date", featureType: "dimension", dataType: "date" },
        { id: "channel", label: "Channel", featureType: "dimension", dataType: "string" },
        {
          id: "country_code",
          label: "Market",
          featureType: "dimension",
          dataType: "string",
          category: "Location",
          definitionRef: "harmonizer://feature/location",
          governance: {
            status: "approved",
            classification: "harmonizer.audience",
          },
        },
        {
          id: "available_impressions",
          label: "Available Impressions",
          featureType: "measure",
          format: "compactNumber",
          dataType: "number",
          aggregation: "sum",
        },
        {
          id: "audience_index",
          label: "Audience Index",
          featureType: "measure",
          format: "number",
          dataType: "number",
          aggregation: "avg",
          category: "Audience",
          definitionRef: "harmonizer://feature/user.segment.index",
          governance: {
            status: "approved",
            certification: "reviewed",
            classification: "harmonizer.audience",
          },
        },
        {
          id: "audience_segment",
          label: "Audience Segment",
          featureType: "parameter",
          dataType: "string",
          category: "Audience",
          definitionRef: "harmonizer://feature/user.segment",
          governance: {
            status: "approved",
            classification: "harmonizer.audience",
          },
        },
        {
          id: "reporting_window",
          label: "Date Range",
          featureType: "parameter",
          dataType: "date",
        },
      ],
    },
  ],
};

const reportBuilderConfig = {
  title: "Report Builder Demo",
  binding: {
    mode: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    entity: "line_delivery",
    selectedDimensions: ["event_date", "channel", "country_code"],
    selectedMeasures: ["available_impressions"],
  },
  measures: [
    { id: "avails", key: "avails", semanticRef: "available_impressions", label: "Avails", default: true, format: "compactNumber" },
    { id: "audienceIndex", key: "audienceIndex", semanticRef: "audience_index", label: "Audience Index", format: "number", aggregation: "avg" },
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
      semanticRef: "reporting_window",
      type: "dateRange",
      label: "Date Range",
      required: true,
      startParamPath: "filters.From",
      endParamPath: "filters.To",
    },
    {
      id: "channelsFilter",
      semanticRef: "delivery_channels_filter",
      label: "Channels",
      multiple: true,
      options: [
        { label: "Display", value: "Display" },
        { label: "CTV", value: "CTV" },
      ],
    },
    {
      id: "audienceSegmentFilter",
      semanticRef: "audience_segment",
      label: "Audience Segment",
      multiple: true,
      options: [
        { label: "Young Adults", value: "Young Adults" },
        { label: "Established Adults", value: "Established Adults" },
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
    fieldActions: [
      {
        fieldRef: "channelV2",
        actions: [
          { id: "drill_market", label: "Drill to Market", kind: "drill", nextFieldRef: "country" },
          { id: "detail_channel", label: "Show channel details", kind: "detail", targetRef: "target://example/performance/channel-detail" },
        ],
      },
      {
        fieldRef: "country",
        actions: [
          { id: "detail_market", label: "Show market details", kind: "detail", targetRef: "target://example/performance/market-detail" },
        ],
      },
    ],
    detailTargets: [
      {
        targetRef: "target://example/performance/channel-detail",
        navigationMode: "hostRoute",
        parameters: {
          channel: "$value",
          campaign: "$row.campaign",
        },
      },
      {
        targetRef: "target://example/performance/market-detail",
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
      { value: "audienceIndex", field: "audienceIndex", defaultDirection: "desc" },
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
};

function buildHydratedFromRecord(record = null, documentVersion = 0, savedAt = 0) {
  const response = buildReportBuilderGetReportDocumentResponse(record?.savedReportPayload, {
    documentVersion,
    savedAt,
  });
  return buildHydratedReportBuilderDocument(response, {
    container,
    builderIdentity: {
      containerId: container.id,
      stateKey: container.stateKey,
      dataSourceRef: container.dataSourceRef,
    },
  });
}

function findHierarchy(reportSpec = {}, hierarchyId = "") {
  return (Array.isArray(reportSpec?.drillMetadata?.hierarchies) ? reportSpec.drillMetadata.hierarchies : [])
    .find((entry) => entry?.id === hierarchyId) || null;
}

function findChartBlock(reportSpec = {}) {
  return (Array.isArray(reportSpec?.blocks) ? reportSpec.blocks : [])
    .find((block) => block?.kind === "chartBlock") || null;
}

function findTablePresetState(state = {}) {
  return {
    active: state?.activeTablePreset || null,
    last: state?.lastTablePreset || null,
  };
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function resolveSavedSemanticSummary(record = null) {
  const savedReportPayload = record?.savedReportPayload && typeof record.savedReportPayload === "object"
    ? record.savedReportPayload
    : null;
  return savedReportPayload?.reportSpec?.semanticSummary ?? savedReportPayload?.reportDocument?.semanticSummary ?? null;
}

function summarizeRuntimeRows(rows = [], key = "", measureKey = "") {
  return (Array.isArray(rows) ? rows : []).reduce((acc, row) => {
    const groupValue = String(row?.[key] ?? "");
    acc[groupValue] = Number(acc[groupValue] || 0) + Number(row?.[measureKey] || 0);
    return acc;
  }, {});
}

function summarizeAverageRuntimeRows(rows = [], key = "", measureKey = "") {
  const groups = (Array.isArray(rows) ? rows : []).reduce((acc, row) => {
    const groupValue = String(row?.[key] ?? "");
    const numericValue = Number(row?.[measureKey] || 0);
    if (!acc[groupValue]) {
      acc[groupValue] = { sum: 0, count: 0 };
    }
    acc[groupValue].sum += numericValue;
    acc[groupValue].count += 1;
    return acc;
  }, {});
  return Object.keys(groups).reduce((acc, groupValue) => {
    const group = groups[groupValue];
    acc[groupValue] = group.count > 0 ? (group.sum / group.count) : 0;
    return acc;
  }, {});
}

function summarizeExpectedRawRows(rows = [], {
  filterKey = "",
  filterValue = "",
  groupKey = "",
  measureKey = "",
} = {}) {
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => row?.[filterKey] === filterValue)
    .reduce((acc, row) => {
      const groupValue = String(row?.[groupKey] ?? "");
      acc[groupValue] = Number(acc[groupValue] || 0) + Number(row?.[measureKey] || 0);
      return acc;
    }, {});
}

async function buildReopenedRuntimeDrillScenario({
  container: runtimeContainer = null,
  record = null,
  hydrated = null,
  blockId = "",
  item = null,
  selection = null,
  nextFieldRef = "",
  modelFactory = null,
} = {}) {
  assert.ok(runtimeContainer && typeof runtimeContainer === "object", "A container is required for reopened runtime drill scenarios.");
  assert.ok(hydrated?.config && hydrated?.state, "A hydrated saved report is required for reopened runtime drill scenarios.");
  const semanticSummary = resolveSavedSemanticSummary(record);
  const resolveModel = ({ refinements = [], drillTransitions = [] } = {}) => (
    typeof modelFactory === "function"
      ? modelFactory({
        container: runtimeContainer,
        hydrated,
        semanticSummary,
        refinements,
        drillTransitions,
      })
      : buildPreviewAuthoredReportModel({
        container: runtimeContainer,
        config: hydrated.config,
        state: hydrated.state,
        refinements,
        drillTransitions,
        semanticSummary,
      })
  );
  const baseModel = resolveModel();
  const basePreview = buildPreviewAuthoredReport({
    container: runtimeContainer,
    config: hydrated.config,
    state: hydrated.state,
    rows: RAW_ROWS,
    semanticSummary,
    model: baseModel,
  });
  assert.ok(basePreview?.reportSpec && basePreview?.reportFill, "A reopened runtime preview is required for drill scenario assertions.");
  const { beforePrimary, primary, afterPrimary } = resolveReportRuntimePrimaryBlocks(basePreview.reportSpec, basePreview.reportFill);
  const allRuntimeBlocks = [...beforePrimary, ...primary, ...afterPrimary];
  const runtimeBlock = allRuntimeBlocks.find((block) => block?.id === blockId) || null;
  assert.ok(runtimeBlock, `Runtime block '${blockId}' is required for reopened runtime drill scenarios.`);
  const provider = resolveReportRuntimeDrillMetadataProvider({
    reportSpec: baseModel?.reportSpec || {},
    runtimeHandlers: {},
  });
  assert.ok(provider && typeof provider.listAvailableRefinements === "function", "A runtime drill metadata provider is required for reopened runtime drill scenarios.");
  const fields = runtimeBlock?.kind === "chartBlock"
    ? resolveReportRuntimeChartActionFields(basePreview.reportSpec, runtimeBlock)
    : resolveReportRuntimeRefinementFields(basePreview.reportSpec, runtimeBlock);
  const providerActionsByField = new Map();
  for (const field of fields) {
    const providerActions = await provider.listAvailableRefinements(runtimeBlock.kind, field.valueKey, {
      reportSpec: basePreview.reportSpec,
      block: runtimeBlock,
    });
    providerActionsByField.set(
      `${runtimeBlock.id}:${field.valueKey}`,
      Array.isArray(providerActions) ? providerActions : [],
    );
  }
  let interactionState = createReportRuntimeInteractionState();
  const runtimeHandlers = {
    applyRefinement(refinement) {
      interactionState = applyReportRuntimeInteractionRefinement(interactionState, refinement);
      return interactionState;
    },
    applyDrillTransition(payload) {
      interactionState = applyReportRuntimeInteractionDrillTransition(interactionState, payload);
      return interactionState;
    },
  };
  const execution = runtimeBlock?.kind === "chartBlock"
    ? (buildReportRuntimeChartInteractionState({
      blockId: runtimeBlock.id,
      blockTitle: runtimeBlock.title,
      fields,
      selection,
      providerActionsByField,
    }).executions.find((entry) => entry?.kind === "drill" && entry?.transition?.nextFieldRef === nextFieldRef) || null)
    : (() => {
      const tableInteractionState = buildReportRuntimeTableInteractionState({
        blockId: runtimeBlock.id,
        fields,
        providerActionsByField,
      });
      const drillAction = tableInteractionState.actions.find((entry) => entry?.kind === "drill" && entry?.resolveExecution?.(item)?.transition?.nextFieldRef === nextFieldRef) || null;
      return drillAction ? drillAction.resolveExecution(item) : null;
    })();
  assert.ok(execution && execution.kind === "drill", `A drill execution to '${nextFieldRef}' is required for reopened runtime drill scenarios.`);
  const executionResult = executeReportRuntimeAction(execution, runtimeHandlers);
  assert.equal(executionResult.executed, true);
  const drilledModel = resolveModel({
    refinements: interactionState.refinements,
    drillTransitions: interactionState.drillTransitions,
  });
  const preview = buildPreviewAuthoredReport({
    container: runtimeContainer,
    config: hydrated.config,
    state: hydrated.state,
    rows: RAW_ROWS,
    refinements: interactionState.refinements,
    drillTransitions: interactionState.drillTransitions,
    semanticSummary,
    model: drilledModel,
  });
  return {
    basePreview,
    runtimeBlock,
    fields,
    providerActionsByField,
    execution,
    baseModel,
    interactionState,
    drilledModel,
    preview,
  };
}

async function buildReopenedRuntimeDetailScenario({
  container: runtimeContainer = null,
  record = null,
  hydrated = null,
  blockId = "",
  item = null,
  selection = null,
  targetRef = "",
} = {}) {
  assert.ok(runtimeContainer && typeof runtimeContainer === "object", "A container is required for reopened runtime detail scenarios.");
  assert.ok(hydrated?.config && hydrated?.state, "A hydrated saved report is required for reopened runtime detail scenarios.");
  const semanticSummary = resolveSavedSemanticSummary(record);
  const basePreview = buildPreviewAuthoredReport({
    container: runtimeContainer,
    config: hydrated.config,
    state: hydrated.state,
    rows: RAW_ROWS,
    semanticSummary,
  });
  assert.ok(basePreview?.reportSpec && basePreview?.reportFill, "A reopened runtime preview is required for detail scenario assertions.");
  const {
    beforePrimary = [],
    primary = [],
    afterPrimary = [],
  } = resolveReportRuntimePrimaryBlocks(basePreview.reportSpec, basePreview.reportFill);
  const allRuntimeBlocks = [...beforePrimary, ...primary, ...afterPrimary];
  const runtimeBlock = allRuntimeBlocks.find((block) => block?.id === blockId) || null;
  assert.ok(runtimeBlock, `Runtime block '${blockId}' is required for reopened runtime detail scenarios.`);
  const fields = runtimeBlock?.kind === "chartBlock"
    ? resolveReportRuntimeChartActionFields(basePreview.reportSpec, runtimeBlock)
    : resolveReportRuntimeRefinementFields(basePreview.reportSpec, runtimeBlock);
  assert.ok(Array.isArray(fields), "Runtime fields are required for reopened runtime detail scenarios.");
  const drillMetadataProvider = resolveReportRuntimePreviewDetailProvider({
    semanticModelHandler: null,
    reportSpec: basePreview.reportSpec,
  });
  assert.ok(drillMetadataProvider && typeof drillMetadataProvider.listAvailableRefinements === "function", "A runtime detail metadata provider is required for reopened runtime detail scenarios.");
  const providerActionsByField = new Map();
  for (const field of fields) {
    const providerActions = await drillMetadataProvider.listAvailableRefinements(runtimeBlock.kind, field.valueKey, {
      reportSpec: basePreview.reportSpec,
      block: runtimeBlock,
    });
    providerActionsByField.set(
      `${runtimeBlock.id}:${field.valueKey}`,
      Array.isArray(providerActions) ? providerActions : [],
    );
  }
  const execution = runtimeBlock?.kind === "chartBlock"
    ? (buildReportRuntimeChartInteractionState({
      blockId: runtimeBlock.id,
      blockTitle: runtimeBlock.title,
      fields,
      selection,
      providerActionsByField,
    }).executions.find((entry) => entry?.kind === "detail" && entry?.detailRequest?.action?.targetRef === targetRef) || null)
    : (() => {
      const tableInteractionState = buildReportRuntimeTableInteractionState({
        blockId: runtimeBlock.id,
        fields,
        providerActionsByField,
      });
      for (const action of tableInteractionState.actions) {
        if (action?.kind !== "detail") {
          continue;
        }
        const resolvedExecution = action.resolveExecution?.(item) || null;
        if (resolvedExecution?.detailRequest?.action?.targetRef === targetRef) {
          return resolvedExecution;
        }
      }
      return null;
    })();
  assert.ok(execution && execution.kind === "detail", `A detail execution for '${targetRef}' is required for reopened runtime detail scenarios.`);
  let hostIntent = "sentinel";
  let detailDiagnostic = undefined;
  const openDetailTarget = createReportRuntimeDetailTargetOpener({
    drillMetadataProvider,
    setHostIntent(next) {
      hostIntent = next;
    },
    setDetailDiagnostic(next) {
      detailDiagnostic = next;
    },
  });
  const executionResult = executeReportRuntimeAction(execution, {
    openDetailTarget,
  });
  assert.equal(executionResult.executed, true);
  const resolvedDetailTarget = await executionResult.result;
  return {
    basePreview,
    runtimeBlock,
    fields,
    providerActionsByField,
    execution,
    resolvedDetailTarget,
    hostIntent,
    detailDiagnostic,
  };
}

async function buildReopenedRuntimeActionContext({
  container: runtimeContainer = null,
  record = null,
  hydrated = null,
  blockId = "",
  refinements = [],
  drillTransitions = [],
} = {}) {
  assert.ok(runtimeContainer && typeof runtimeContainer === "object", "A container is required for reopened runtime action scenarios.");
  assert.ok(record && typeof record === "object", "A saved report record is required for reopened runtime action scenarios.");
  assert.ok(hydrated?.config && hydrated?.state, "A hydrated saved report is required for reopened runtime action scenarios.");
  const semanticSummary = resolveSavedSemanticSummary(record);
  const basePreview = buildPreviewAuthoredReport({
    container: runtimeContainer,
    config: hydrated.config,
    state: hydrated.state,
    rows: RAW_ROWS,
    refinements,
    drillTransitions,
    semanticSummary,
  });
  assert.ok(basePreview?.reportSpec && basePreview?.reportFill, "A reopened runtime preview is required for action scenario assertions.");
  const {
    beforePrimary = [],
    primary = [],
    afterPrimary = [],
  } = resolveReportRuntimePrimaryBlocks(basePreview.reportSpec, basePreview.reportFill);
  const allRuntimeBlocks = [...beforePrimary, ...primary, ...afterPrimary];
  const runtimeBlock = allRuntimeBlocks.find((block) => block?.id === blockId) || null;
  assert.ok(runtimeBlock, `Runtime block '${blockId}' is required for reopened runtime action scenarios.`);
  const fields = runtimeBlock?.kind === "chartBlock"
    ? resolveReportRuntimeChartActionFields(basePreview.reportSpec, runtimeBlock)
    : resolveReportRuntimeRefinementFields(basePreview.reportSpec, runtimeBlock);
  assert.ok(Array.isArray(fields), "Runtime fields are required for reopened runtime action scenarios.");
  const drillMetadataProvider = resolveReportRuntimePreviewDetailProvider({
    semanticModelHandler: null,
    reportSpec: basePreview.reportSpec,
  });
  assert.ok(drillMetadataProvider && typeof drillMetadataProvider.listAvailableRefinements === "function", "A runtime action metadata provider is required for reopened runtime action scenarios.");
  const providerActionsByField = new Map();
  for (const field of fields) {
    const providerActions = await drillMetadataProvider.listAvailableRefinements(runtimeBlock.kind, field.valueKey, {
      reportSpec: basePreview.reportSpec,
      block: runtimeBlock,
    });
    providerActionsByField.set(
      `${runtimeBlock.id}:${field.valueKey}`,
      Array.isArray(providerActions) ? providerActions : [],
    );
  }
  return {
    semanticSummary,
    basePreview,
    runtimeBlock,
    fields,
    drillMetadataProvider,
    providerActionsByField,
  };
}

const inventoryLadderRecord = buildPreviewSavedReportPayloadRecord({
  container,
  reportBuilderConfig,
  rows: RAW_ROWS,
  semanticModel,
  reportId: "capacityQ3",
  title: "Capacity Q3",
  templateId: "capacity_inventory_brief",
  presetKind: "table",
  presetTitle: "Inventory Ladder",
  documentVersion: 4,
  artifactId: "capacity_q3_inventory_ladder",
  savedAt: 9100,
});

assert.equal(inventoryLadderRecord.savedReportPayload.sourceArtifactId, "capacity_q3_inventory_ladder");
assert.equal(inventoryLadderRecord.savedReportPayload.sourceSession.sourceRef.kind, "reportBuilder.reportTemplate");
assert.equal(inventoryLadderRecord.savedReportPayload.sourceSession.sourceRef.templateId, "capacity_inventory_brief");
assert.equal(inventoryLadderRecord.savedReportPayload.sourceSession.sourceRef.templateLabel, "Capacity Inventory Brief");
assert.equal(inventoryLadderRecord.savedReportPayload.reportDocument.blocks[0].state.viewMode, "table");
assert.equal(inventoryLadderRecord.savedReportPayload.reportDocument.blocks[0].state.chartSpec?.xField, "channelV2");
assert.equal(inventoryLadderRecord.savedReportPayload.reportDocument.blocks[0].state.reportDocumentTemplateId, "capacity_inventory_brief");
assert.equal(inventoryLadderRecord.savedReportPayload.reportDocument.blocks[0].state.reportDocumentTemplateLabel, "Capacity Inventory Brief");
assert.equal(inventoryLadderRecord.savedReportPayload.reportDocument.blocks[0].state.activeTablePreset?.title, "Inventory Ladder");
assert.equal(inventoryLadderRecord.savedReportPayload.reportDocument.blocks[0].state.lastTablePreset?.title, "Inventory Ladder");
assert.equal(inventoryLadderRecord.reportFill.kind, "reportFill");
assert.equal(inventoryLadderRecord.reportPrint.kind, "reportPrint");
assert.equal(validateReportPrint(inventoryLadderRecord.reportPrint).valid, true);
assert.equal(validateReportExportRequest(inventoryLadderRecord.exportRequest).valid, true);
assert.equal(inventoryLadderRecord.reportPrint.title, "Capacity Q3");
assert.equal(inventoryLadderRecord.runtimeBlock.title, "Capacity Q3");
assert.equal(inventoryLadderRecord.runtimeBlock.dashboard.reportRuntime.reportSpec.title, "Capacity Q3");
assert.equal(inventoryLadderRecord.runtimeBlock.dashboard.reportRuntime.reportPrint.title, "Capacity Q3");
assert.equal(inventoryLadderRecord.runtimeBlock.dashboard.reportRuntime.reportPrint.kind, "reportPrint");
assert.equal(inventoryLadderRecord.exportRequest.source.from, "savedPayload");
assert.equal(inventoryLadderRecord.exportRequest.source.payloadId, inventoryLadderRecord.savedReportPayload.payloadId);
assert.equal(inventoryLadderRecord.exportRequest.source.documentVersion, 4);
assert.equal(inventoryLadderRecord.savedReportPayload.compileState.status, "clean");
assert.deepEqual(inventoryLadderRecord.savedReportPayload.compileState.diagnostics || [], []);
assert.equal(inventoryLadderRecord.reportPrint.bookmarks.some((bookmark) => bookmark.id === "bookmark.primaryTable"), true);
assert.deepEqual(
  findHierarchy(inventoryLadderRecord.savedReportPayload.reportSpec, "capacity_inventory")?.levels?.map((level) => level.field),
  ["channelV2", "publisher", "siteType"],
);

const hydratedInventoryLadder = buildHydratedFromRecord(inventoryLadderRecord, 4, 9100);
assert.equal(hydratedInventoryLadder.valid, true);
assert.equal(hydratedInventoryLadder.compileState.status, "clean");
assert.equal(hydratedInventoryLadder.state.viewMode, "table");
assert.equal(hydratedInventoryLadder.state.chartSpec?.xField, "channelV2");
assert.deepEqual(hydratedInventoryLadder.state.selectedDimensions, ["channelV2"]);
assert.deepEqual(hydratedInventoryLadder.state.selectedMeasures, ["avails", "hhUniqs", "reachRate"]);
assert.equal(hydratedInventoryLadder.state.reportDocumentTemplateId, "capacity_inventory_brief");
assert.equal(hydratedInventoryLadder.state.reportDocumentTemplateLabel, "Capacity Inventory Brief");
assert.equal(findTablePresetState(hydratedInventoryLadder.state).active?.title, "Inventory Ladder");
assert.equal(findTablePresetState(hydratedInventoryLadder.state).last?.title, "Inventory Ladder");
assert.deepEqual(
  findHierarchy({ drillMetadata: hydratedInventoryLadder.config.drillMetadata }, "capacity_inventory")?.levels?.map((level) => level.field),
  ["channelV2", "publisher", "siteType"],
);

const reopenedInventoryPreviewWithDiagnostics = buildPreviewAuthoredReport({
  container,
  config: hydratedInventoryLadder.config,
  state: hydratedInventoryLadder.state,
  rows: RAW_ROWS,
  semanticSummary: resolveSavedSemanticSummary(inventoryLadderRecord),
  additionalDiagnostics: hydratedInventoryLadder.compileState?.diagnostics || [],
});
assert.deepEqual(reopenedInventoryPreviewWithDiagnostics.reportFill.diagnostics || [], []);

const reopenedInventoryRuntime = await buildReopenedRuntimeDrillScenario({
  container,
  record: inventoryLadderRecord,
  hydrated: hydratedInventoryLadder,
  blockId: "primaryTable",
  item: {
    channelV2: "Display",
    avails: 82800,
    hhUniqs: 34800,
  },
  nextFieldRef: "publisher",
});

assert.deepEqual(reopenedInventoryRuntime.execution, {
  id: "drill:channelV2:publisher",
  label: "Drill to Publisher",
  kind: "drill",
  transition: {
    sourceField: "channelV2",
    nextFieldRef: "publisher",
    sourceBlockId: "primaryTable",
  },
  refinement: {
    op: "drill",
    field: "channelV2",
    value: "Display",
    sourceBlockId: "primaryTable",
    fieldLabel: "Channel",
    label: "Drill to Publisher = Display",
  },
});
assert.deepEqual(reopenedInventoryRuntime.interactionState.drillTransitions, [{
  refinementId: "drill:channelV2:primaryTable",
  sourceField: "channelV2",
  nextFieldRef: "publisher",
  sourceBlockId: "primaryTable",
}]);
assert.ok(reopenedInventoryRuntime.drilledModel.reportSpec.datasets[0].request.dimensions.publisher);
assert.deepEqual(reopenedInventoryRuntime.drilledModel.reportSpec.datasets[0].request.filters.includeChannelV2, ["Display"]);
assert.deepEqual(
  summarizeRuntimeRows(reopenedInventoryRuntime.preview.reportFill.datasets[0].rows, "publisher", "avails"),
  summarizeExpectedRawRows(RAW_ROWS, {
    filterKey: "channelV2",
    filterValue: "Display",
    groupKey: "publisher",
    measureKey: "avails",
  }),
);

const locationLadderRecord = buildPreviewSavedReportPayloadRecord({
  container,
  reportBuilderConfig,
  rows: RAW_ROWS,
  semanticModel,
  reportId: "capacityLocationQ3",
  title: "Capacity Location Q3",
  templateId: "capacity_location_brief",
  presetKind: "table",
  presetTitle: "Location Ladder",
  documentVersion: 5,
  artifactId: "capacity_q3_location_ladder",
  savedAt: 9200,
});

assert.equal(locationLadderRecord.savedReportPayload.sourceArtifactId, "capacity_q3_location_ladder");
assert.equal(locationLadderRecord.savedReportPayload.sourceSession.sourceRef.kind, "reportBuilder.reportTemplate");
assert.equal(locationLadderRecord.savedReportPayload.sourceSession.sourceRef.templateId, "capacity_location_brief");
assert.equal(locationLadderRecord.savedReportPayload.sourceSession.sourceRef.templateLabel, "Capacity Location Brief");
assert.equal(locationLadderRecord.savedReportPayload.reportDocument.blocks[0].state.viewMode, "table");
assert.equal(locationLadderRecord.savedReportPayload.reportDocument.blocks[0].state.chartSpec?.xField, "country");
assert.equal(locationLadderRecord.savedReportPayload.reportDocument.blocks[0].state.reportDocumentTemplateId, "capacity_location_brief");
assert.equal(locationLadderRecord.savedReportPayload.reportDocument.blocks[0].state.reportDocumentTemplateLabel, "Capacity Location Brief");
assert.equal(locationLadderRecord.savedReportPayload.reportDocument.blocks[0].state.activeTablePreset?.title, "Location Ladder");
assert.equal(locationLadderRecord.savedReportPayload.reportDocument.blocks[0].state.lastTablePreset?.title, "Location Ladder");
assert.deepEqual(
  findHierarchy(locationLadderRecord.savedReportPayload.reportSpec, "capacity_location")?.levels?.map((level) => level.field),
  ["country", "region", "metrocode"],
);

const hydratedLocationLadder = buildHydratedFromRecord(locationLadderRecord, 5, 9200);
assert.equal(hydratedLocationLadder.valid, true);
assert.equal(hydratedLocationLadder.state.viewMode, "table");
assert.equal(hydratedLocationLadder.state.chartSpec?.xField, "country");
assert.deepEqual(hydratedLocationLadder.state.selectedDimensions, ["country"]);
assert.deepEqual(hydratedLocationLadder.state.selectedMeasures, ["avails", "hhUniqs", "reachRate"]);
assert.equal(hydratedLocationLadder.state.reportDocumentTemplateId, "capacity_location_brief");
assert.equal(hydratedLocationLadder.state.reportDocumentTemplateLabel, "Capacity Location Brief");
assert.equal(findTablePresetState(hydratedLocationLadder.state).active?.title, "Location Ladder");
assert.equal(findTablePresetState(hydratedLocationLadder.state).last?.title, "Location Ladder");
assert.deepEqual(
  findHierarchy({ drillMetadata: hydratedLocationLadder.config.drillMetadata }, "capacity_location")?.levels?.map((level) => level.field),
  ["country", "region", "metrocode"],
);

const landscapeInventoryLadderRecord = buildPreviewSavedReportPayloadRecord({
  container,
  reportBuilderConfig,
  rows: RAW_ROWS,
  semanticModel,
  reportId: "capacityQ3Landscape",
  title: "Capacity Q3 Landscape",
  templateId: "capacity_inventory_brief",
  presetKind: "table",
  presetTitle: "Inventory Ladder",
  documentVersion: 9,
  artifactId: "capacity_q3_inventory_ladder_landscape",
  savedAt: 9600,
  pageGeometry: PREVIEW_LANDSCAPE_PAGE_GEOMETRY,
});

assert.equal(landscapeInventoryLadderRecord.reportPrint.pageGeometry.width, 792);
assert.equal(landscapeInventoryLadderRecord.reportPrint.pageGeometry.height, 612);
assert.equal(landscapeInventoryLadderRecord.exportRequest.reportPrint.pageGeometry.width, 792);
assert.equal(landscapeInventoryLadderRecord.exportRequest.reportPrint.pageGeometry.height, 612);
assert.equal(landscapeInventoryLadderRecord.runtimeBlock.dashboard.reportRuntime.reportPrint.pageGeometry.width, 792);
assert.equal(landscapeInventoryLadderRecord.runtimeBlock.dashboard.reportRuntime.reportPrint.pageGeometry.height, 612);
assert.equal(landscapeInventoryLadderRecord.savedReportPayload.reportDocument.blocks[0].state.reportDocumentTemplateId, "capacity_inventory_brief");
assert.deepEqual(
  findHierarchy(landscapeInventoryLadderRecord.savedReportPayload.reportSpec, "capacity_inventory")?.levels?.map((level) => level.field),
  ["channelV2", "publisher", "siteType"],
);

const landscapeLocationRecord = buildPreviewSavedReportPayloadRecord({
  container,
  reportBuilderConfig,
  rows: RAW_ROWS,
  semanticModel,
  reportId: "capacityLocationsTopMarketsQ3Landscape",
  title: "Capacity Locations Top Markets Q3 Landscape",
  templateId: "capacity_location_brief",
  presetKind: "chart",
  presetTitle: "Locations · Top Markets",
  documentVersion: 10,
  artifactId: "capacity_q3_locations_top_markets_landscape",
  savedAt: 9700,
  pageGeometry: PREVIEW_LANDSCAPE_PAGE_GEOMETRY,
});

assert.equal(landscapeLocationRecord.reportPrint.pageGeometry.width, 792);
assert.equal(landscapeLocationRecord.reportPrint.pageGeometry.height, 612);
assert.equal(landscapeLocationRecord.exportRequest.reportPrint.pageGeometry.width, 792);
assert.equal(landscapeLocationRecord.exportRequest.reportPrint.pageGeometry.height, 612);
assert.equal(landscapeLocationRecord.runtimeBlock.dashboard.reportRuntime.reportPrint.pageGeometry.width, 792);
assert.equal(landscapeLocationRecord.runtimeBlock.dashboard.reportRuntime.reportPrint.pageGeometry.height, 612);
assert.equal(landscapeLocationRecord.savedReportPayload.reportDocument.blocks[0].state.reportDocumentTemplateId, "capacity_location_brief");
assert.equal(landscapeLocationRecord.reportPrint.bookmarks.some((bookmark) => bookmark.id === "bookmark.primaryChart"), true);
assert.deepEqual(
  findHierarchy(landscapeLocationRecord.savedReportPayload.reportSpec, "capacity_location")?.levels?.map((level) => level.field),
  ["country", "region", "metrocode"],
);

const authoredChannelChartRecord = buildPreviewSavedReportPayloadRecord({
  container,
  reportBuilderConfig,
  rows: RAW_ROWS,
  semanticModel,
  reportId: "authoredChannelChartQ3",
  title: "Authored Channel Chart Q3",
  artifactId: "authored_channel_chart_q3",
  documentVersion: 6,
  savedAt: 9350,
  baseState: {
    selectedMeasures: ["avails"],
    primaryMeasure: "avails",
    selectedDimensions: ["channelV2"],
    viewMode: "chart",
    chartSpec: {
      title: "Inventory · Top Channels",
      type: "horizontal_bar",
      xField: "channelV2",
      yFields: ["avails"],
    },
    orderField: "avails",
    orderDir: "desc",
    pageSize: 50,
    staticFilters: {
      dateRange: {
        start: "2026-05-01",
        end: "2026-05-04",
      },
    },
    binding: cloneValue(reportBuilderConfig.binding || null),
    reportDocumentBlocks: [
      {
        id: "channelDetailChart",
        kind: "chartBlock",
        title: "Channel Detail Chart",
        datasetRef: "primary",
        chartSpec: {
          title: "Channel Detail Chart",
          type: "horizontal_bar",
          xField: "channelV2",
          yFields: ["avails"],
        },
      },
    ],
    reportDocumentLayout: {
      type: "stack",
      items: [
        { blockId: "primaryBuilder" },
        { blockId: "channelDetailChart" },
      ],
    },
  },
});
const authoredChannelChartBlock = (Array.isArray(authoredChannelChartRecord.savedReportPayload.reportSpec?.blocks)
  ? authoredChannelChartRecord.savedReportPayload.reportSpec.blocks
  : []).find((block) => block?.id === "channelDetailChart") || null;
assert.ok(authoredChannelChartBlock, "An authored chart block should be preserved in the saved ReportSpec.");
assert.equal(authoredChannelChartBlock?.chartSpec?.xField, "channelV2");
assert.equal(authoredChannelChartBlock?.chartModel?.type, "horizontal_bar");
assert.equal(
  authoredChannelChartRecord.savedReportPayload.reportDocument.blocks.some((block) => block.id === "channelDetailChart" && block.kind === "chartBlock"),
  true,
);

const authoredUnselectedMeasureKpiRecord = buildPreviewSavedReportPayloadRecord({
  container,
  reportBuilderConfig,
  rows: RAW_ROWS,
  semanticModel,
  reportId: "authoredUnselectedMeasureKpiQ3",
  title: "Authored Unselected Measure KPI Q3",
  artifactId: "authored_unselected_measure_kpi_q3",
  documentVersion: 9,
  savedAt: 9365,
  baseState: {
    selectedMeasures: ["hhUniqs"],
    primaryMeasure: "hhUniqs",
    selectedDimensions: ["eventDate"],
    viewMode: "table",
    chartSpec: null,
    orderField: "eventDate",
    orderDir: "asc",
    pageSize: 50,
    staticFilters: {
      dateRange: {
        start: "2026-05-01",
        end: "2026-05-04",
      },
    },
    binding: cloneValue(reportBuilderConfig.binding || null),
    reportDocumentBlocks: [
      {
        id: "headlineReachKpi",
        kind: "kpiBlock",
        title: "Reach KPI",
        datasetRef: "primary",
        valueField: "avails",
        valueLabel: "Avails",
      },
    ],
    reportDocumentLayout: {
      type: "stack",
      items: [
        { blockId: "primaryBuilder" },
        { blockId: "headlineReachKpi" },
      ],
    },
  },
});
assert.equal(authoredUnselectedMeasureKpiRecord.savedReportPayload.compileState.status, "clean");
assert.deepEqual(authoredUnselectedMeasureKpiRecord.savedReportPayload.compileState.diagnostics || [], []);
assert.deepEqual(authoredUnselectedMeasureKpiRecord.savedReportPayload.reportDocument.blocks[0].state.selectedMeasures, ["hhUniqs"]);
assert.equal(
  authoredUnselectedMeasureKpiRecord.savedReportPayload.reportSpec.datasets[0]?.request?.measures?.avails,
  true,
);
const hydratedAuthoredUnselectedMeasureKpi = buildHydratedFromRecord(authoredUnselectedMeasureKpiRecord, 9, 9365);
assert.equal(hydratedAuthoredUnselectedMeasureKpi.valid, true);
assert.equal(hydratedAuthoredUnselectedMeasureKpi.compileState.status, "clean");
assert.deepEqual(hydratedAuthoredUnselectedMeasureKpi.state.selectedMeasures, ["hhUniqs"]);
assert.equal(
  hydratedAuthoredUnselectedMeasureKpi.state.reportDocumentBlocks.some((block) => block.id === "headlineReachKpi" && block.valueField === "avails"),
  true,
);

const authoredAudienceSegmentRecord = buildPreviewSavedReportPayloadRecord({
  container,
  reportBuilderConfig,
  rows: RAW_ROWS,
  semanticModel,
  reportId: "authoredAudienceSegmentIndexQ3",
  title: "Authored Audience Segment Index Q3",
  artifactId: "authored_audience_segment_index_q3",
  documentVersion: 13,
  savedAt: 9375,
  baseState: {
    selectedMeasures: ["audienceIndex"],
    primaryMeasure: "audienceIndex",
    selectedDimensions: ["country"],
    viewMode: "table",
    chartSpec: null,
    orderField: "audienceIndex",
    orderDir: "desc",
    pageSize: 50,
    staticFilters: {
      dateRange: {
        start: "2026-05-01",
        end: "2026-05-04",
      },
      audienceSegmentFilter: ["Young Adults"],
    },
    binding: cloneValue(reportBuilderConfig.binding || null),
  },
});
assert.equal(authoredAudienceSegmentRecord.savedReportPayload.compileState.status, "clean");
assert.deepEqual(authoredAudienceSegmentRecord.savedReportPayload.compileState.diagnostics || [], []);
assert.equal(validateReportPrint(authoredAudienceSegmentRecord.reportPrint).valid, true);
assert.equal(validateReportExportRequest(authoredAudienceSegmentRecord.exportRequest).valid, true);
assert.deepEqual(authoredAudienceSegmentRecord.savedReportPayload.reportDocument.blocks[0].state.selectedMeasures, ["audienceIndex"]);
assert.deepEqual(authoredAudienceSegmentRecord.savedReportPayload.reportDocument.blocks[0].state.staticFilters?.audienceSegmentFilter, ["Young Adults"]);
assert.equal(authoredAudienceSegmentRecord.savedReportPayload.reportSpec.datasets[0]?.request?.measures?.audienceIndex, true);
assert.deepEqual(authoredAudienceSegmentRecord.savedReportPayload.reportSpec.datasets[0]?.request?.filters?.audienceSegmentFilter, ["Young Adults"]);
const authoredAudienceSemanticSummary = resolveSavedSemanticSummary(authoredAudienceSegmentRecord);
assert.deepEqual(
  authoredAudienceSemanticSummary?.selectedMeasures?.find((field) => field?.id === "audience_index"),
  {
    id: "audience_index",
    rawId: "audienceIndex",
    label: "Audience Index",
    format: "number",
    category: "Audience",
    definitionRef: "harmonizer://feature/user.segment.index",
    governance: {
      status: "approved",
      certification: "reviewed",
      classification: "harmonizer.audience",
    },
  },
);
assert.deepEqual(
  authoredAudienceSemanticSummary?.selectedParameters?.find((field) => field?.id === "audience_segment"),
  {
    id: "audience_segment",
    rawId: "audienceSegmentFilter",
    label: "Audience Segment",
    category: "Audience",
    definitionRef: "harmonizer://feature/user.segment",
    governance: {
      status: "approved",
      classification: "harmonizer.audience",
    },
  },
);
assert.deepEqual(
  summarizeAverageRuntimeRows(authoredAudienceSegmentRecord.reportFill.datasets[0]?.rows, "country", "audienceIndex"),
  {
    US: 118,
    CA: 112,
  },
);
const hydratedAuthoredAudienceSegment = buildHydratedFromRecord(authoredAudienceSegmentRecord, 13, 9375);
assert.equal(hydratedAuthoredAudienceSegment.valid, true);
assert.equal(hydratedAuthoredAudienceSegment.compileState.status, "clean");
assert.deepEqual(hydratedAuthoredAudienceSegment.state.selectedMeasures, ["audienceIndex"]);
assert.deepEqual(hydratedAuthoredAudienceSegment.state.selectedDimensions, ["country"]);
assert.deepEqual(hydratedAuthoredAudienceSegment.state.staticFilters?.audienceSegmentFilter, ["Young Adults"]);
const reopenedAudienceSegmentPreview = buildPreviewAuthoredReport({
  container,
  config: hydratedAuthoredAudienceSegment.config,
  state: hydratedAuthoredAudienceSegment.state,
  rows: RAW_ROWS,
  semanticSummary: authoredAudienceSemanticSummary,
  additionalDiagnostics: hydratedAuthoredAudienceSegment.compileState?.diagnostics || [],
});
assert.deepEqual(
  summarizeAverageRuntimeRows(reopenedAudienceSegmentPreview.reportFill.datasets[0]?.rows, "country", "audienceIndex"),
  {
    US: 118,
    CA: 112,
  },
);

const authoredAudienceSegmentFlatFieldRecord = buildPreviewSavedReportPayloadRecord({
  container,
  reportBuilderConfig,
  rows: RAW_ROWS,
  semanticModel: flatFieldSemanticModel,
  reportId: "authoredAudienceSegmentIndexFlatFieldQ3",
  title: "Authored Audience Segment Index Flat Field Q3",
  artifactId: "authored_audience_segment_index_flat_field_q3",
  documentVersion: 14,
  savedAt: 9376,
  baseState: {
    selectedMeasures: ["audienceIndex"],
    primaryMeasure: "audienceIndex",
    selectedDimensions: ["country"],
    viewMode: "table",
    chartSpec: null,
    orderField: "audienceIndex",
    orderDir: "desc",
    pageSize: 50,
    staticFilters: {
      dateRange: {
        start: "2026-05-01",
        end: "2026-05-04",
      },
      audienceSegmentFilter: ["Young Adults"],
    },
    binding: cloneValue(reportBuilderConfig.binding || null),
  },
});
assert.equal(authoredAudienceSegmentFlatFieldRecord.savedReportPayload.compileState.status, "clean");
assert.deepEqual(authoredAudienceSegmentFlatFieldRecord.savedReportPayload.compileState.diagnostics || [], []);
assert.deepEqual(
  resolveSavedSemanticSummary(authoredAudienceSegmentFlatFieldRecord)?.selectedMeasures?.find((field) => field?.id === "audience_index"),
  {
    id: "audience_index",
    rawId: "audienceIndex",
    label: "Audience Index",
    format: "number",
    category: "Audience",
    definitionRef: "harmonizer://feature/user.segment.index",
    governance: {
      status: "approved",
      certification: "reviewed",
      classification: "harmonizer.audience",
    },
  },
);
assert.deepEqual(
  resolveSavedSemanticSummary(authoredAudienceSegmentFlatFieldRecord)?.selectedParameters?.find((field) => field?.id === "audience_segment"),
  {
    id: "audience_segment",
    rawId: "audienceSegmentFilter",
    label: "Audience Segment",
    category: "Audience",
    definitionRef: "harmonizer://feature/user.segment",
    governance: {
      status: "approved",
      classification: "harmonizer.audience",
    },
  },
);
const hydratedAuthoredAudienceSegmentFlatField = buildHydratedFromRecord(authoredAudienceSegmentFlatFieldRecord, 14, 9376);
assert.equal(hydratedAuthoredAudienceSegmentFlatField.valid, true);
assert.equal(hydratedAuthoredAudienceSegmentFlatField.compileState.status, "clean");
assert.deepEqual(hydratedAuthoredAudienceSegmentFlatField.state.selectedMeasures, ["audienceIndex"]);
assert.deepEqual(hydratedAuthoredAudienceSegmentFlatField.state.selectedDimensions, ["country"]);
assert.deepEqual(hydratedAuthoredAudienceSegmentFlatField.state.staticFilters?.audienceSegmentFilter, ["Young Adults"]);

const authoredAudienceSegmentFlatFieldSeededRecord = buildPreviewSavedReportPayloadRecordFromSeed({
  container,
  reportBuilderConfig,
  rows: RAW_ROWS,
  semanticModel,
  seed: {
    semanticModel: flatFieldSemanticModel,
    reportId: "authoredAudienceSegmentIndexFlatFieldSeededQ3",
    title: "Authored Audience Segment Index Flat Field Seeded Q3",
    artifactId: "authored_audience_segment_index_flat_field_seeded_q3",
    documentVersion: 15,
    savedAt: 9377,
    baseState: {
      selectedMeasures: ["audienceIndex"],
      primaryMeasure: "audienceIndex",
      selectedDimensions: ["country"],
      viewMode: "table",
      chartSpec: null,
      orderField: "audienceIndex",
      orderDir: "desc",
      pageSize: 50,
      staticFilters: {
        dateRange: {
          start: "2026-05-01",
          end: "2026-05-04",
        },
        audienceSegmentFilter: ["Young Adults"],
      },
      binding: cloneValue(reportBuilderConfig.binding || null),
    },
  },
});
assert.equal(authoredAudienceSegmentFlatFieldSeededRecord.savedReportPayload.compileState.status, "clean");
assert.deepEqual(
  resolveSavedSemanticSummary(authoredAudienceSegmentFlatFieldSeededRecord)?.selectedMeasures?.find((field) => field?.id === "audience_index"),
  {
    id: "audience_index",
    rawId: "audienceIndex",
    label: "Audience Index",
    format: "number",
    category: "Audience",
    definitionRef: "harmonizer://feature/user.segment.index",
    governance: {
      status: "approved",
      certification: "reviewed",
      classification: "harmonizer.audience",
    },
  },
);

const inventoryRecord = buildPreviewSavedReportPayloadRecord({
  container,
  reportBuilderConfig,
  rows: RAW_ROWS,
  semanticModel,
  reportId: "capacityInventoryTopChannelsQ3",
  title: "Capacity Inventory Top Channels Q3",
  templateId: "capacity_inventory_brief",
  presetKind: "chart",
  presetTitle: "Inventory · Top Channels",
  documentVersion: 7,
  artifactId: "capacity_q3_inventory_top_channels",
  savedAt: 9400,
});

const standaloneInventoryRecord = buildPreviewSavedReportPayloadRecord({
  container,
  reportBuilderConfig,
  rows: RAW_ROWS,
  semanticModel,
  reportId: "capacityStandaloneTrendQ3",
  title: "Capacity Standalone Trend Q3",
  presetKind: "chart",
  presetTitle: "Inventory · Top Channels",
  documentVersion: 6,
  artifactId: "capacity_q3_standalone_trend",
  savedAt: 9350,
});

assert.equal(standaloneInventoryRecord.savedReportPayload.sourceSession.sourceRef.kind, "reportBuilder.chartResult");
assert.equal(standaloneInventoryRecord.runtimeBlock.title, "Capacity Standalone Trend Q3");
assert.equal(standaloneInventoryRecord.runtimeBlock.dashboard.reportRuntime.reportSpec.title, "Capacity Standalone Trend Q3");
assert.equal(standaloneInventoryRecord.reportPrint.title, "Capacity Standalone Trend Q3");
assert.equal(standaloneInventoryRecord.runtimeBlock.dashboard.reportRuntime.reportPrint.title, "Capacity Standalone Trend Q3");
assert.equal(validateReportPrint(standaloneInventoryRecord.reportPrint).valid, true);
assert.equal(validateReportExportRequest(standaloneInventoryRecord.exportRequest).valid, true);
assert.equal(standaloneInventoryRecord.exportRequest.source.from, "savedPayload");
assert.equal(standaloneInventoryRecord.exportRequest.source.payloadId, standaloneInventoryRecord.savedReportPayload.payloadId);
assert.equal(standaloneInventoryRecord.exportRequest.source.documentVersion, 6);

const landscapeStandaloneInventoryRecord = buildPreviewSavedReportPayloadRecord({
  container,
  reportBuilderConfig,
  rows: RAW_ROWS,
  semanticModel,
  reportId: "capacityStandaloneTrendQ3Landscape",
  title: "Capacity Standalone Trend Q3 Landscape",
  presetKind: "chart",
  presetTitle: "Inventory · Top Channels",
  documentVersion: 11,
  artifactId: "capacity_q3_standalone_trend_landscape",
  savedAt: 9360,
  pageGeometry: PREVIEW_LANDSCAPE_PAGE_GEOMETRY,
});

assert.equal(landscapeStandaloneInventoryRecord.reportPrint.pageGeometry.width, 792);
assert.equal(landscapeStandaloneInventoryRecord.reportPrint.pageGeometry.height, 612);
assert.equal(landscapeStandaloneInventoryRecord.exportRequest.reportPrint.pageGeometry.width, 792);
assert.equal(landscapeStandaloneInventoryRecord.exportRequest.reportPrint.pageGeometry.height, 612);
assert.equal(landscapeStandaloneInventoryRecord.runtimeBlock.dashboard.reportRuntime.reportPrint.pageGeometry.width, 792);
assert.equal(landscapeStandaloneInventoryRecord.runtimeBlock.dashboard.reportRuntime.reportPrint.pageGeometry.height, 612);

const marketEfficiencyRecord = buildPreviewSavedReportPayloadRecord({
  container,
  reportBuilderConfig,
  rows: RAW_ROWS,
  semanticModel,
  reportId: "marketEfficiencyBriefQ3",
  title: "Market Efficiency Brief Q3",
  templateId: "market_efficiency_brief",
  presetKind: "chart",
  presetTitle: "Locations · Top Markets",
  documentVersion: 12,
  artifactId: "market_efficiency_brief_q3",
  savedAt: 9800,
});

assert.equal(marketEfficiencyRecord.savedReportPayload.sourceSession.sourceRef.kind, "reportBuilder.reportTemplate");
assert.equal(marketEfficiencyRecord.savedReportPayload.sourceSession.sourceRef.templateId, "market_efficiency_brief");
assert.equal(marketEfficiencyRecord.savedReportPayload.sourceSession.sourceRef.templateLabel, "Market Efficiency Brief");
assert.deepEqual(marketEfficiencyRecord.savedReportPayload.reportDocument.blocks[0].state.selectedMeasures, ["avails"]);
assert.equal(marketEfficiencyRecord.savedReportPayload.reportDocument.blocks[0].state.reportDocumentTemplateId, "market_efficiency_brief");
assert.equal(marketEfficiencyRecord.savedReportPayload.reportDocument.blocks[0].state.reportDocumentTemplateLabel, "Market Efficiency Brief");
assert.equal(marketEfficiencyRecord.savedReportPayload.reportSpec.calculatedFields.some((field) => field.id === "reachRate" && field.kind === "rowCalc"), true);
assert.equal(marketEfficiencyRecord.savedReportPayload.reportSpec.datasets[0].request.measures.avails, true);
assert.equal(marketEfficiencyRecord.savedReportPayload.reportSpec.datasets[0].request.measures.hhUniqs, true);
assert.equal(marketEfficiencyRecord.savedReportPayload.reportSpec.datasets[0].request.measures.reachRate, undefined);
assert.equal(marketEfficiencyRecord.savedReportPayload.reportSpec.datasets[0].request.dimensions.country, true);
assert.equal(marketEfficiencyRecord.savedReportPayload.reportSpec.datasets[0].request.dimensions.channelV2, true);
assert.equal(marketEfficiencyRecord.savedReportPayload.reportSpec.blocks.find((block) => block.id === "activeDrillPath")?.kind, "refinementBarBlock");
assert.equal(marketEfficiencyRecord.savedReportPayload.reportSpec.blocks.find((block) => block.id === "headlineKpi")?.valueField, "reachRate");
assert.equal(marketEfficiencyRecord.savedReportPayload.reportSpec.blocks.find((block) => block.id === "reachRateTrend")?.chartSpec?.yFields?.[0], "reachRate");
assert.equal(marketEfficiencyRecord.savedReportPayload.reportSpec.blocks.find((block) => block.id === "reachRateTrend")?.chartSpec?.seriesField, "channelV2");
assert.equal(marketEfficiencyRecord.savedReportPayload.reportSpec.blocks.find((block) => block.id === "reachRateTable")?.columns?.some((column) => column.key === "reachRate"), true);
assert.deepEqual(marketEfficiencyRecord.exportRequest.reportFill.blocks.find((block) => block.id === "activeDrillPath")?.content, {
  title: "Active Drill Path",
  actionKinds: ["remove", "clearAll"],
  emptyLabel: "No active market drill path",
  refinements: [],
});
assert.equal(marketEfficiencyRecord.exportRequest.reportFill.blocks.find((block) => block.id === "headlineKpi")?.content?.valueField, "reachRate");
assert.equal(marketEfficiencyRecord.exportRequest.reportFill.blocks.find((block) => block.id === "headlineKpi")?.content?.value, 40.82);
assert.equal(marketEfficiencyRecord.exportRequest.reportFill.blocks.find((block) => block.id === "reachRateTrend")?.content?.chartSpec?.yFields?.[0], "reachRate");
assert.equal(marketEfficiencyRecord.exportRequest.reportFill.blocks.find((block) => block.id === "reachRateTrend")?.content?.chartSpec?.seriesField, "channelV2");
assert.equal(marketEfficiencyRecord.exportRequest.reportFill.blocks.find((block) => block.id === "reachRateTrend")?.content?.chartModel?.series?.values?.[0]?.value, "reachRate");
assert.equal(marketEfficiencyRecord.exportRequest.reportFill.blocks.find((block) => block.id === "reachRateTable")?.content?.columns?.some((column) => column.key === "reachRate"), true);
assert.equal(marketEfficiencyRecord.exportRequest.reportFill.blocks.find((block) => block.id === "reachRateTable")?.content?.resolvedRows?.[0]?.cells?.some((cell) => cell.key === "reachRate" && cell.value === 40.82), true);
assert.equal(marketEfficiencyRecord.exportRequest.reportPrint.bookmarks.some((bookmark) => bookmark.id === "bookmark.activeDrillPath"), false);
assert.equal(marketEfficiencyRecord.exportRequest.reportPrint.pages.flatMap((page) => page.elements || []).some((element) => element.kind === "text" && element.text === "No active market drill path"), false);
assert.equal(marketEfficiencyRecord.exportRequest.reportPrint.pages.flatMap((page) => page.elements || []).some((element) => element.kind === "text" && element.text === "Reach Rate: 40.82"), true);
assert.equal(marketEfficiencyRecord.exportRequest.reportPrint.pages.flatMap((page) => page.elements || []).some((element) => element.kind === "svg" && element.id.includes("reachRateTrend")), true);
assert.equal(marketEfficiencyRecord.exportRequest.reportPrint.pages.flatMap((page) => page.elements || []).some((element) => element.kind === "tableCellText" && element.columnKey === "reachRate"), true);

const hydratedMarketEfficiency = buildHydratedFromRecord(marketEfficiencyRecord, 12, 9800);
assert.equal(hydratedMarketEfficiency.valid, true);
assert.equal(hydratedMarketEfficiency.compileState.status, "clean");
assert.deepEqual(hydratedMarketEfficiency.state.selectedMeasures, ["avails"]);
assert.equal(hydratedMarketEfficiency.state.reportDocumentTemplateId, "market_efficiency_brief");
assert.equal(hydratedMarketEfficiency.state.reportDocumentTemplateLabel, "Market Efficiency Brief");

const reopenedMarketEfficiencyModel = buildReportBuilderRuntimePreviewModel({
  container,
  config: hydratedMarketEfficiency.config,
  state: hydratedMarketEfficiency.state,
  semanticSummary: resolveSavedSemanticSummary(marketEfficiencyRecord),
});
const reopenedMarketEfficiencyPreview = buildPreviewAuthoredReport({
  container,
  config: hydratedMarketEfficiency.config,
  state: hydratedMarketEfficiency.state,
  rows: RAW_ROWS,
  semanticSummary: resolveSavedSemanticSummary(marketEfficiencyRecord),
  additionalDiagnostics: hydratedMarketEfficiency.compileState?.diagnostics || [],
  model: reopenedMarketEfficiencyModel,
});
assert.equal(reopenedMarketEfficiencyPreview.reportSpec.calculatedFields.some((field) => field.id === "reachRate"), true);
assert.deepEqual(reopenedMarketEfficiencyPreview.reportFill.blocks.find((block) => block.id === "activeDrillPath")?.content, {
  title: "Active Drill Path",
  actionKinds: ["remove", "clearAll"],
  emptyLabel: "No active market drill path",
  refinements: [],
});
assert.equal(reopenedMarketEfficiencyPreview.reportFill.blocks.find((block) => block.id === "headlineKpi")?.content?.value, 40.82);
assert.equal(reopenedMarketEfficiencyPreview.reportFill.blocks.find((block) => block.id === "reachRateTrend")?.content?.chartSpec?.seriesField, "channelV2");
assert.equal(reopenedMarketEfficiencyPreview.reportFill.blocks.find((block) => block.id === "reachRateTable")?.content?.resolvedRows?.[0]?.cells?.some((cell) => cell.key === "reachRate" && cell.value === 40.82), true);
assert.equal(reopenedMarketEfficiencyPreview.reportPrint.pages.flatMap((page) => page.elements || []).some((element) => element.kind === "text" && element.text === "No active market drill path"), false);
assert.equal(reopenedMarketEfficiencyPreview.reportPrint.pages.flatMap((page) => page.elements || []).some((element) => element.kind === "text" && element.text === "Reach Rate: 40.82"), true);

const marketEfficiencyRuntimeDrill = await buildReopenedRuntimeDrillScenario({
  container,
  record: marketEfficiencyRecord,
  hydrated: hydratedMarketEfficiency,
  blockId: "reachRateTrend",
  selection: {
    source: "cartesian",
    xValue: "US",
    row: {
      country: "US",
      channelV2: "Display",
      reachRate: 40.82,
    },
    selectionRows: reopenedMarketEfficiencyPreview.reportFill.datasets[0].rows.filter((row) => row.country === "US"),
  },
  nextFieldRef: "region",
  modelFactory: ({
    container: runtimeContainer,
    hydrated,
    semanticSummary,
    refinements = [],
    drillTransitions = [],
  }) => buildReportBuilderRuntimePreviewModel({
    container: runtimeContainer,
    config: hydrated.config,
    state: hydrated.state,
    semanticSummary,
    refinements,
    drillTransitions,
  }),
});

assert.deepEqual(marketEfficiencyRuntimeDrill.interactionState.drillTransitions, [{
  refinementId: "drill:country:reachRateTrend",
  sourceField: "country",
  nextFieldRef: "region",
  sourceBlockId: "reachRateTrend",
}]);
assert.equal(marketEfficiencyRuntimeDrill.drilledModel.reportSpec.calculatedFields.some((field) => field.id === "reachRate"), true);
assert.equal(marketEfficiencyRuntimeDrill.drilledModel.reportSpec.datasets[0].request.measures.hhUniqs, true);
assert.equal(marketEfficiencyRuntimeDrill.drilledModel.reportSpec.datasets[0].request.dimensions.region, true);
assert.equal(marketEfficiencyRuntimeDrill.drilledModel.reportSpec.datasets[0].request.dimensions.channelV2, true);
assert.deepEqual(marketEfficiencyRuntimeDrill.drilledModel.reportSpec.datasets[0].request.filters.includeCountry, ["US"]);
assert.equal(marketEfficiencyRuntimeDrill.drilledModel.reportSpec.blocks.find((block) => block.id === "activeDrillPath")?.kind, "refinementBarBlock");
assert.equal(marketEfficiencyRuntimeDrill.drilledModel.reportSpec.blocks.find((block) => block.id === "reachRateTrend")?.chartSpec?.seriesField, "channelV2");
assert.equal(marketEfficiencyRuntimeDrill.drilledModel.reportSpec.blocks.find((block) => block.id === "reachRateTable")?.columns?.some((column) => column.key === "reachRate"), true);
assert.equal(marketEfficiencyRuntimeDrill.drilledModel.reportSpec.blocks.find((block) => block.id === "headlineKpi")?.valueField, "reachRate");
assert.deepEqual(marketEfficiencyRuntimeDrill.preview.reportFill.blocks.find((block) => block.id === "activeDrillPath")?.content, {
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
assert.equal(marketEfficiencyRuntimeDrill.preview.reportFill.blocks.find((block) => block.id === "reachRateTrend")?.content?.chartModel?.series?.values?.[0]?.value, "reachRate");
assert.equal(marketEfficiencyRuntimeDrill.preview.reportFill.blocks.find((block) => block.id === "reachRateTable")?.content?.resolvedRows?.some((row) => row.cells?.some((cell) => cell.key === "reachRate")), true);
assert.equal(marketEfficiencyRuntimeDrill.preview.reportFill.blocks.find((block) => block.id === "headlineKpi")?.content?.valueField, "reachRate");
assert.equal(marketEfficiencyRuntimeDrill.preview.reportPrint.bookmarks.some((bookmark) => bookmark.id === "bookmark.activeDrillPath"), true);
assert.equal(marketEfficiencyRuntimeDrill.preview.reportPrint.pages.flatMap((page) => page.elements || []).some((element) => element.kind === "text" && element.text === "Drill to Region = US"), true);

const restoredMarketEfficiencySession = setReportBuilderHydratedDocumentSessionRuntimePreviewInteraction(
  buildReportBuilderHydratedDocumentSession(hydratedMarketEfficiency, {
    liveConfig: hydratedMarketEfficiency.config,
    liveState: hydratedMarketEfficiency.state,
  }),
  marketEfficiencyRuntimeDrill.interactionState,
);
assert.ok(restoredMarketEfficiencySession?.runtimePreviewInteraction, "A restored market efficiency runtime interaction snapshot is required.");
const restoredMarketEfficiencyState = applyReportBuilderHydratedDocumentSessionState(
  hydratedMarketEfficiency.state,
  restoredMarketEfficiencySession,
);
const resolvedMarketEfficiencySession = resolveReportBuilderHydratedDocumentSessionFromState(restoredMarketEfficiencyState);
assert.deepEqual(
  resolvedMarketEfficiencySession?.runtimePreviewInteraction,
  restoredMarketEfficiencySession.runtimePreviewInteraction,
);
const resumedMarketEfficiencyModel = buildReportBuilderRuntimePreviewModel({
  container,
  config: hydratedMarketEfficiency.config,
  state: hydratedMarketEfficiency.state,
  refinements: resolvedMarketEfficiencySession?.runtimePreviewInteraction?.refinements || [],
  drillTransitions: resolvedMarketEfficiencySession?.runtimePreviewInteraction?.drillTransitions || [],
  semanticSummary: resolveSavedSemanticSummary(marketEfficiencyRecord),
});
const resumedMarketEfficiencyRequest = resumedMarketEfficiencyModel?.reportSpec?.datasets?.[0]?.request;
assert.ok(resumedMarketEfficiencyRequest, "A resumed market efficiency request is required.");
assert.deepEqual(resumedMarketEfficiencyRequest.filters.includeCountry, ["US"]);
assert.equal(resumedMarketEfficiencyRequest.dimensions.region, true);
assert.equal(resumedMarketEfficiencyRequest.dimensions.channelV2, true);
assert.equal(resumedMarketEfficiencyModel.reportSpec.blocks.find((block) => block.id === "activeDrillPath")?.kind, "refinementBarBlock");
assert.equal(resumedMarketEfficiencyModel.reportSpec.blocks.find((block) => block.id === "reachRateTrend")?.chartSpec?.seriesField, "channelV2");
assert.equal(resumedMarketEfficiencyModel.reportSpec.blocks.find((block) => block.id === "reachRateTable")?.columns?.some((column) => column.key === "reachRate"), true);
assert.equal(resumedMarketEfficiencyModel.reportSpec.blocks.find((block) => block.id === "headlineKpi")?.valueField, "reachRate");
const resumedMarketEfficiencyPreview = buildPreviewAuthoredReport({
  container,
  config: hydratedMarketEfficiency.config,
  state: hydratedMarketEfficiency.state,
  rows: RAW_ROWS,
  refinements: resolvedMarketEfficiencySession?.runtimePreviewInteraction?.refinements || [],
  drillTransitions: resolvedMarketEfficiencySession?.runtimePreviewInteraction?.drillTransitions || [],
  semanticSummary: resolveSavedSemanticSummary(marketEfficiencyRecord),
  model: resumedMarketEfficiencyModel,
});
assert.deepEqual(resumedMarketEfficiencyModel.reportSpec, marketEfficiencyRuntimeDrill.drilledModel.reportSpec);
assert.deepEqual(resumedMarketEfficiencyPreview.reportFill, marketEfficiencyRuntimeDrill.preview.reportFill);
assert.deepEqual(resumedMarketEfficiencyPreview.reportPrint, marketEfficiencyRuntimeDrill.preview.reportPrint);
assert.equal(resumedMarketEfficiencyPreview.reportPrint.bookmarks.some((bookmark) => bookmark.id === "bookmark.activeDrillPath"), true);

const {
  beforePrimary: marketEfficiencyAfterChartBeforePrimary = [],
  primary: marketEfficiencyAfterChartPrimary = [],
  afterPrimary: marketEfficiencyAfterChartAfterPrimary = [],
} = resolveReportRuntimePrimaryBlocks(
  marketEfficiencyRuntimeDrill.preview.reportSpec,
  marketEfficiencyRuntimeDrill.preview.reportFill,
);
const marketEfficiencyAfterChartBlocks = [
  ...marketEfficiencyAfterChartBeforePrimary,
  ...marketEfficiencyAfterChartPrimary,
  ...marketEfficiencyAfterChartAfterPrimary,
];
const marketEfficiencyReachRateTableBlock = marketEfficiencyAfterChartBlocks.find((block) => block?.id === "reachRateTable") || null;
assert.ok(marketEfficiencyReachRateTableBlock, "A market efficiency chart-to-table reachRateTable block is required.");
const marketEfficiencyPrimaryTableFields = resolveReportRuntimeRefinementFields(
  marketEfficiencyRuntimeDrill.preview.reportSpec,
  marketEfficiencyReachRateTableBlock,
);
assert.ok(Array.isArray(marketEfficiencyPrimaryTableFields), "A market efficiency reachRateTable field set is required.");
assert.deepEqual(
  marketEfficiencyPrimaryTableFields.map((field) => ({
    valueKey: field.valueKey,
    displayValueKey: field.displayValueKey,
    runtimeFilterable: field.runtimeFilterable,
  })),
  [
    { valueKey: "country", displayValueKey: "country", runtimeFilterable: true },
    { valueKey: "channelV2", displayValueKey: "channelV2", runtimeFilterable: true },
  ],
);
const marketEfficiencyPrimaryTableProvider = resolveReportRuntimePreviewDetailProvider({
  semanticModelHandler: null,
  reportSpec: marketEfficiencyRuntimeDrill.preview.reportSpec,
});
assert.ok(marketEfficiencyPrimaryTableProvider, "A market efficiency reachRateTable provider is required.");
const marketEfficiencyPrimaryTableActionsByField = new Map();
for (const field of marketEfficiencyPrimaryTableFields) {
  const providerActions = await marketEfficiencyPrimaryTableProvider.listAvailableRefinements(
    marketEfficiencyReachRateTableBlock.kind,
    field.valueKey,
    {
      reportSpec: marketEfficiencyRuntimeDrill.preview.reportSpec,
      block: marketEfficiencyReachRateTableBlock,
    },
  );
  marketEfficiencyPrimaryTableActionsByField.set(
    `${marketEfficiencyReachRateTableBlock.id}:${field.valueKey}`,
    Array.isArray(providerActions) ? providerActions : [],
  );
}
const marketEfficiencyTableInteraction = buildReportRuntimeTableInteractionState({
  blockId: marketEfficiencyReachRateTableBlock.id,
  fields: marketEfficiencyPrimaryTableFields,
  providerActionsByField: marketEfficiencyPrimaryTableActionsByField,
});
const marketEfficiencyDisplayRow = (Array.isArray(marketEfficiencyRuntimeDrill.preview?.reportFill?.datasets?.[0]?.rows)
  ? marketEfficiencyRuntimeDrill.preview.reportFill.datasets[0].rows
  : []
).find((row) => row?.country === "US" && row?.channelV2 === "Display") || null;
assert.ok(marketEfficiencyDisplayRow, "A market efficiency Display row is required after the chart drill.");
assert.ok(Array.isArray(marketEfficiencyTableInteraction.actions), "A market efficiency reachRateTable action list is required.");
let marketEfficiencyTableKeepAction = null;
let marketEfficiencyTableKeepExecution = null;
for (const action of marketEfficiencyTableInteraction.actions) {
  if (action?.kind !== "keep") {
    continue;
  }
  const execution = action.resolveExecution?.(marketEfficiencyDisplayRow) || null;
  if (execution?.refinement?.field === "channelV2") {
    marketEfficiencyTableKeepAction = action;
    marketEfficiencyTableKeepExecution = execution;
    break;
  }
}
assert.ok(marketEfficiencyTableKeepAction, "A market efficiency reachRateTable keep action is required.");

let marketEfficiencyMixedState = marketEfficiencyRuntimeDrill.interactionState;
const marketEfficiencyMixedHandlers = buildReportRuntimeHandlers({
  applyRefinement(refinement) {
    marketEfficiencyMixedState = applyReportRuntimeInteractionRefinement(marketEfficiencyMixedState, refinement);
    return marketEfficiencyMixedState;
  },
  applyDrillTransition(payload) {
    marketEfficiencyMixedState = applyReportRuntimeInteractionDrillTransition(marketEfficiencyMixedState, payload);
    return marketEfficiencyMixedState;
  },
  clearDetailState() {
    marketEfficiencyMixedState = clearReportRuntimeInteractionDetailState(marketEfficiencyMixedState);
    return marketEfficiencyMixedState;
  },
});
const marketEfficiencyTableKeepResult = executeReportRuntimeAction(marketEfficiencyTableKeepExecution, marketEfficiencyMixedHandlers);
assert.equal(marketEfficiencyTableKeepResult.executed, true);
await Promise.resolve(marketEfficiencyTableKeepResult.result);

const marketEfficiencyMixedModel = buildReportBuilderRuntimePreviewModel({
  container,
  config: hydratedMarketEfficiency.config,
  state: hydratedMarketEfficiency.state,
  refinements: marketEfficiencyMixedState.refinements,
  drillTransitions: marketEfficiencyMixedState.drillTransitions,
  semanticSummary: resolveSavedSemanticSummary(marketEfficiencyRecord),
});
const marketEfficiencyMixedRequest = marketEfficiencyMixedModel?.reportSpec?.datasets?.[0]?.request;
assert.ok(marketEfficiencyMixedRequest, "A market efficiency chart-to-table kept request is required.");
assert.deepEqual(marketEfficiencyMixedRequest.filters.includeCountry, ["US"]);
assert.deepEqual(marketEfficiencyMixedRequest.filters.includeChannelV2, ["Display"]);
assert.equal(marketEfficiencyMixedRequest.dimensions.region, true);
assert.equal(marketEfficiencyMixedRequest.dimensions.channelV2, true);
assert.equal(marketEfficiencyMixedModel.reportSpec.blocks.find((block) => block.id === "reachRateTrend")?.chartSpec?.seriesField, "channelV2");
assert.equal(marketEfficiencyMixedModel.reportSpec.blocks.find((block) => block.id === "reachRateTable")?.columns?.some((column) => column.key === "reachRate"), true);
assert.equal(marketEfficiencyMixedModel.reportSpec.blocks.find((block) => block.id === "headlineKpi")?.valueField, "reachRate");

const marketEfficiencyMixedPreview = buildPreviewAuthoredReport({
  container,
  config: hydratedMarketEfficiency.config,
  state: hydratedMarketEfficiency.state,
  rows: RAW_ROWS,
  refinements: marketEfficiencyMixedState.refinements,
  drillTransitions: marketEfficiencyMixedState.drillTransitions,
  semanticSummary: resolveSavedSemanticSummary(marketEfficiencyRecord),
  model: marketEfficiencyMixedModel,
});
assert.deepEqual(
  summarizeRuntimeRows(marketEfficiencyMixedPreview.reportFill.datasets[0].rows, "region", "avails"),
  { West: 37100, Midwest: 45700 },
);
assert.ok(
  (marketEfficiencyMixedPreview.reportFill.datasets[0].rows || []).every((row) => row?.channelV2 === "Display"),
  "A market efficiency mixed preview should keep only Display rows after the table interaction.",
);
assert.deepEqual(marketEfficiencyMixedPreview.reportFill.blocks.find((block) => block.id === "activeDrillPath")?.content, {
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
    {
      id: "keep:channelV2:reachRateTable",
      op: "keep",
      field: "channelV2",
      values: ["Display"],
      sourceBlockId: "reachRateTable",
      label: "Keep Channel = Display",
    },
  ],
});
assert.equal(marketEfficiencyMixedPreview.reportFill.blocks.find((block) => block.id === "reachRateTrend")?.content?.chartModel?.series?.values?.[0]?.value, "reachRate");
assert.equal(marketEfficiencyMixedPreview.reportFill.blocks.find((block) => block.id === "reachRateTable")?.content?.resolvedRows?.some((row) => row.cells?.some((cell) => cell.key === "reachRate")), true);
assert.equal(marketEfficiencyMixedPreview.reportFill.blocks.find((block) => block.id === "headlineKpi")?.content?.valueField, "reachRate");
assert.equal(marketEfficiencyMixedPreview.reportPrint.bookmarks.some((bookmark) => bookmark.id === "bookmark.activeDrillPath"), true);
assert.equal(marketEfficiencyMixedPreview.reportPrint.pages.flatMap((page) => page.elements || []).some((element) => element.kind === "text" && element.text === "Drill to Region = US"), true);
assert.equal(marketEfficiencyMixedPreview.reportPrint.pages.flatMap((page) => page.elements || []).some((element) => element.kind === "text" && element.text === "Keep Channel = Display"), true);
assert.equal(marketEfficiencyMixedPreview.reportPrint.pages.flatMap((page) => page.elements || []).some((element) => element.kind === "text" && element.text === "No active market drill path"), false);

const restoredMarketEfficiencyMixedSession = setReportBuilderHydratedDocumentSessionRuntimePreviewInteraction(
  buildReportBuilderHydratedDocumentSession(hydratedMarketEfficiency, {
    liveConfig: hydratedMarketEfficiency.config,
    liveState: hydratedMarketEfficiency.state,
  }),
  marketEfficiencyMixedState,
);
assert.ok(restoredMarketEfficiencyMixedSession?.runtimePreviewInteraction, "A restored mixed market efficiency runtime interaction snapshot is required.");
const restoredMarketEfficiencyMixedState = applyReportBuilderHydratedDocumentSessionState(
  hydratedMarketEfficiency.state,
  restoredMarketEfficiencyMixedSession,
);
const resolvedMarketEfficiencyMixedSession = resolveReportBuilderHydratedDocumentSessionFromState(restoredMarketEfficiencyMixedState);
assert.deepEqual(
  resolvedMarketEfficiencyMixedSession?.runtimePreviewInteraction,
  restoredMarketEfficiencyMixedSession.runtimePreviewInteraction,
);
assert.deepEqual(resolvedMarketEfficiencyMixedSession?.runtimePreviewInteraction, {
  refinements: [
    {
      id: "drill:country:reachRateTrend",
      op: "drill",
      field: "country",
      values: ["US"],
      sourceBlockId: "reachRateTrend",
      label: "Drill to Region = US",
    },
    {
      id: "keep:channelV2:reachRateTable",
      op: "keep",
      field: "channelV2",
      values: ["Display"],
      sourceBlockId: "reachRateTable",
      label: "Keep Channel = Display",
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
  hostIntent: null,
  detailDiagnostic: null,
});
const resumedMarketEfficiencyMixedModel = buildReportBuilderRuntimePreviewModel({
  container,
  config: hydratedMarketEfficiency.config,
  state: hydratedMarketEfficiency.state,
  refinements: resolvedMarketEfficiencyMixedSession?.runtimePreviewInteraction?.refinements || [],
  drillTransitions: resolvedMarketEfficiencyMixedSession?.runtimePreviewInteraction?.drillTransitions || [],
  semanticSummary: resolveSavedSemanticSummary(marketEfficiencyRecord),
});
const resumedMarketEfficiencyMixedRequest = resumedMarketEfficiencyMixedModel?.reportSpec?.datasets?.[0]?.request;
assert.ok(resumedMarketEfficiencyMixedRequest, "A resumed mixed market efficiency request is required.");
assert.deepEqual(resumedMarketEfficiencyMixedRequest.filters.includeCountry, ["US"]);
assert.deepEqual(resumedMarketEfficiencyMixedRequest.filters.includeChannelV2, ["Display"]);
assert.equal(resumedMarketEfficiencyMixedRequest.dimensions.region, true);
assert.equal(resumedMarketEfficiencyMixedRequest.dimensions.channelV2, true);
const resumedMarketEfficiencyMixedPreview = buildPreviewAuthoredReport({
  container,
  config: hydratedMarketEfficiency.config,
  state: hydratedMarketEfficiency.state,
  rows: RAW_ROWS,
  refinements: resolvedMarketEfficiencyMixedSession?.runtimePreviewInteraction?.refinements || [],
  drillTransitions: resolvedMarketEfficiencyMixedSession?.runtimePreviewInteraction?.drillTransitions || [],
  semanticSummary: resolveSavedSemanticSummary(marketEfficiencyRecord),
  model: resumedMarketEfficiencyMixedModel,
});
assert.deepEqual(resumedMarketEfficiencyMixedModel.reportSpec, marketEfficiencyMixedModel.reportSpec);
assert.deepEqual(resumedMarketEfficiencyMixedPreview.reportFill, marketEfficiencyMixedPreview.reportFill);
assert.deepEqual(resumedMarketEfficiencyMixedPreview.reportPrint, marketEfficiencyMixedPreview.reportPrint);

function buildMarketEfficiencyInteractionPreview(interactionState = null) {
  const normalizedInteractionState = replaceReportRuntimeInteractionState(interactionState);
  const model = buildReportBuilderRuntimePreviewModel({
    container,
    config: hydratedMarketEfficiency.config,
    state: hydratedMarketEfficiency.state,
    refinements: normalizedInteractionState.refinements,
    drillTransitions: normalizedInteractionState.drillTransitions,
    semanticSummary: resolveSavedSemanticSummary(marketEfficiencyRecord),
  });
  const request = model?.reportSpec?.datasets?.[0]?.request;
  assert.ok(request, "A market efficiency interaction request is required.");
  const preview = buildPreviewAuthoredReport({
    container,
    config: hydratedMarketEfficiency.config,
    state: hydratedMarketEfficiency.state,
    rows: RAW_ROWS,
    refinements: normalizedInteractionState.refinements,
    drillTransitions: normalizedInteractionState.drillTransitions,
    semanticSummary: resolveSavedSemanticSummary(marketEfficiencyRecord),
    model,
  });
  return {
    interactionState: normalizedInteractionState,
    model,
    request,
    preview,
  };
}

const expectedMarketEfficiencyMixedInteraction = {
  refinements: [
    {
      id: "drill:country:reachRateTrend",
      op: "drill",
      field: "country",
      values: ["US"],
      sourceBlockId: "reachRateTrend",
      label: "Drill to Region = US",
    },
    {
      id: "keep:channelV2:reachRateTable",
      op: "keep",
      field: "channelV2",
      values: ["Display"],
      sourceBlockId: "reachRateTable",
      label: "Keep Channel = Display",
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
  hostIntent: null,
  detailDiagnostic: null,
};

let marketEfficiencyHistoryState = createReportRuntimeInteractionHistoryState();
let marketEfficiencyHistoryInteractionState = marketEfficiencyRuntimeDrill.interactionState;
assert.deepEqual(summarizeReportRuntimeInteractionHistoryState(marketEfficiencyHistoryState), {
  canUndo: false,
  canRedo: false,
});
const marketEfficiencyHistoryHandlers = buildReportRuntimeHandlers({
  applyRefinement(refinement) {
    const nextState = applyReportRuntimeInteractionRefinement(marketEfficiencyHistoryInteractionState, refinement);
    const historyUpdate = recordReportRuntimeInteractionHistory(
      marketEfficiencyHistoryState,
      marketEfficiencyHistoryInteractionState,
      nextState,
    );
    marketEfficiencyHistoryState = historyUpdate.historyState;
    marketEfficiencyHistoryInteractionState = historyUpdate.nextState;
    return marketEfficiencyHistoryInteractionState;
  },
  undoRefinements() {
    const historyUpdate = undoReportRuntimeInteractionHistory(
      marketEfficiencyHistoryState,
      marketEfficiencyHistoryInteractionState,
    );
    marketEfficiencyHistoryState = historyUpdate.historyState;
    marketEfficiencyHistoryInteractionState = historyUpdate.nextState;
    return marketEfficiencyHistoryInteractionState;
  },
  redoRefinements() {
    const historyUpdate = redoReportRuntimeInteractionHistory(
      marketEfficiencyHistoryState,
      marketEfficiencyHistoryInteractionState,
    );
    marketEfficiencyHistoryState = historyUpdate.historyState;
    marketEfficiencyHistoryInteractionState = historyUpdate.nextState;
    return marketEfficiencyHistoryInteractionState;
  },
});
const marketEfficiencyHistoryKeepResult = executeReportRuntimeAction(
  marketEfficiencyTableKeepExecution,
  marketEfficiencyHistoryHandlers,
);
assert.equal(marketEfficiencyHistoryKeepResult.executed, true);
assert.deepEqual(marketEfficiencyHistoryInteractionState, expectedMarketEfficiencyMixedInteraction);
assert.deepEqual(summarizeReportRuntimeInteractionHistoryState(marketEfficiencyHistoryState), {
  canUndo: true,
  canRedo: false,
});

const marketEfficiencyUndoExecution = buildReportRuntimeRefinementBarUndoExecution({
  blockId: "activeDrillPath",
});
const marketEfficiencyUndoResult = executeReportRuntimeAction(
  marketEfficiencyUndoExecution,
  marketEfficiencyHistoryHandlers,
);
assert.deepEqual(marketEfficiencyUndoResult, {
  executed: true,
  branch: "undoRefinements",
  result: {
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
    hostIntent: null,
    detailDiagnostic: null,
  },
});
assert.deepEqual(marketEfficiencyHistoryInteractionState, marketEfficiencyUndoResult.result);
assert.deepEqual(summarizeReportRuntimeInteractionHistoryState(marketEfficiencyHistoryState), {
  canUndo: false,
  canRedo: true,
});
const marketEfficiencyAfterUndo = buildMarketEfficiencyInteractionPreview(marketEfficiencyHistoryInteractionState);
assert.deepEqual(marketEfficiencyAfterUndo.preview.reportFill.blocks.find((block) => block.id === "activeDrillPath")?.content, {
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
assert.deepEqual(marketEfficiencyAfterUndo.request.filters.includeCountry, ["US"]);
assert.equal(marketEfficiencyAfterUndo.request.filters.includeChannelV2, undefined);
assert.equal(marketEfficiencyAfterUndo.request.dimensions.region, true);
assert.equal(marketEfficiencyAfterUndo.request.dimensions.channelV2, true);
assert.deepEqual(marketEfficiencyAfterUndo.model.reportSpec, marketEfficiencyRuntimeDrill.drilledModel.reportSpec);
assert.deepEqual(marketEfficiencyAfterUndo.preview.reportFill, marketEfficiencyRuntimeDrill.preview.reportFill);
assert.deepEqual(marketEfficiencyAfterUndo.preview.reportPrint, marketEfficiencyRuntimeDrill.preview.reportPrint);
assert.equal(marketEfficiencyAfterUndo.preview.reportPrint.pages.flatMap((page) => page.elements || []).some((element) => element.kind === "text" && element.text === "Drill to Region = US"), true);
assert.equal(marketEfficiencyAfterUndo.preview.reportPrint.pages.flatMap((page) => page.elements || []).some((element) => element.kind === "text" && element.text === "Keep Channel = Display"), false);
const persistedMarketEfficiencyUndoSession = setReportBuilderHydratedDocumentSessionRuntimePreviewInteraction(
  buildReportBuilderHydratedDocumentSession(hydratedMarketEfficiency, {
    liveConfig: hydratedMarketEfficiency.config,
    liveState: hydratedMarketEfficiency.state,
  }),
  marketEfficiencyHistoryInteractionState,
);
assert.deepEqual(persistedMarketEfficiencyUndoSession?.runtimePreviewInteraction, marketEfficiencyHistoryInteractionState);
assert.equal(Object.prototype.hasOwnProperty.call(persistedMarketEfficiencyUndoSession?.runtimePreviewInteraction || {}, "past"), false);
assert.equal(Object.prototype.hasOwnProperty.call(persistedMarketEfficiencyUndoSession?.runtimePreviewInteraction || {}, "future"), false);
const restoredMarketEfficiencyUndoState = applyReportBuilderHydratedDocumentSessionState(
  hydratedMarketEfficiency.state,
  persistedMarketEfficiencyUndoSession,
);
const resolvedMarketEfficiencyUndoSession = resolveReportBuilderHydratedDocumentSessionFromState(restoredMarketEfficiencyUndoState);
assert.deepEqual(resolvedMarketEfficiencyUndoSession?.runtimePreviewInteraction, marketEfficiencyHistoryInteractionState);

const marketEfficiencyRedoExecution = buildReportRuntimeRefinementBarRedoExecution({
  blockId: "activeDrillPath",
});
const marketEfficiencyRedoResult = executeReportRuntimeAction(
  marketEfficiencyRedoExecution,
  marketEfficiencyHistoryHandlers,
);
assert.deepEqual(marketEfficiencyRedoResult, {
  executed: true,
  branch: "redoRefinements",
  result: expectedMarketEfficiencyMixedInteraction,
});
assert.deepEqual(marketEfficiencyHistoryInteractionState, expectedMarketEfficiencyMixedInteraction);
assert.deepEqual(summarizeReportRuntimeInteractionHistoryState(marketEfficiencyHistoryState), {
  canUndo: true,
  canRedo: false,
});
const marketEfficiencyAfterRedo = buildMarketEfficiencyInteractionPreview(marketEfficiencyHistoryInteractionState);
assert.deepEqual(marketEfficiencyAfterRedo.request.filters.includeCountry, ["US"]);
assert.deepEqual(marketEfficiencyAfterRedo.request.filters.includeChannelV2, ["Display"]);
assert.equal(marketEfficiencyAfterRedo.request.dimensions.region, true);
assert.equal(marketEfficiencyAfterRedo.request.dimensions.channelV2, true);
assert.deepEqual(marketEfficiencyAfterRedo.model.reportSpec, marketEfficiencyMixedModel.reportSpec);
assert.deepEqual(marketEfficiencyAfterRedo.preview.reportFill, marketEfficiencyMixedPreview.reportFill);
assert.deepEqual(marketEfficiencyAfterRedo.preview.reportPrint, marketEfficiencyMixedPreview.reportPrint);
const persistedMarketEfficiencyRedoSession = setReportBuilderHydratedDocumentSessionRuntimePreviewInteraction(
  buildReportBuilderHydratedDocumentSession(hydratedMarketEfficiency, {
    liveConfig: hydratedMarketEfficiency.config,
    liveState: hydratedMarketEfficiency.state,
  }),
  marketEfficiencyHistoryInteractionState,
);
assert.deepEqual(persistedMarketEfficiencyRedoSession?.runtimePreviewInteraction, expectedMarketEfficiencyMixedInteraction);
assert.equal(Object.prototype.hasOwnProperty.call(persistedMarketEfficiencyRedoSession?.runtimePreviewInteraction || {}, "past"), false);
assert.equal(Object.prototype.hasOwnProperty.call(persistedMarketEfficiencyRedoSession?.runtimePreviewInteraction || {}, "future"), false);
const restoredMarketEfficiencyRedoState = applyReportBuilderHydratedDocumentSessionState(
  hydratedMarketEfficiency.state,
  persistedMarketEfficiencyRedoSession,
);
const resolvedMarketEfficiencyRedoSession = resolveReportBuilderHydratedDocumentSessionFromState(restoredMarketEfficiencyRedoState);
assert.deepEqual(resolvedMarketEfficiencyRedoSession?.runtimePreviewInteraction, expectedMarketEfficiencyMixedInteraction);

let marketEfficiencyRemoveState = replaceReportRuntimeInteractionState(
  resolvedMarketEfficiencyMixedSession?.runtimePreviewInteraction,
);
assert.deepEqual(marketEfficiencyRemoveState, expectedMarketEfficiencyMixedInteraction);
const marketEfficiencyRefinementHandlers = buildReportRuntimeHandlers({
  removeRefinement(refinementId) {
    marketEfficiencyRemoveState = removeReportRuntimeInteractionRefinement(marketEfficiencyRemoveState, refinementId);
    return marketEfficiencyRemoveState;
  },
});
const marketEfficiencyDrillRefinement = marketEfficiencyRemoveState.refinements.find((refinement) => refinement?.id === "drill:country:reachRateTrend") || null;
assert.ok(marketEfficiencyDrillRefinement, "A market efficiency drill refinement is required before remove execution.");
const marketEfficiencyRemoveExecution = buildReportRuntimeRefinementBarRemoveExecution({
  blockId: "activeDrillPath",
  refinement: marketEfficiencyDrillRefinement,
});
assert.ok(marketEfficiencyRemoveExecution, "A market efficiency remove execution is required.");
const marketEfficiencyRemoveResult = executeReportRuntimeAction(
  marketEfficiencyRemoveExecution,
  marketEfficiencyRefinementHandlers,
);
assert.deepEqual(marketEfficiencyRemoveResult, {
  executed: true,
  branch: "removeRefinement",
  result: {
    refinements: [
      {
        id: "keep:channelV2:reachRateTable",
        op: "keep",
        field: "channelV2",
        values: ["Display"],
        sourceBlockId: "reachRateTable",
        label: "Keep Channel = Display",
      },
    ],
    drillTransitions: [],
    hostIntent: null,
    detailDiagnostic: null,
  },
});
assert.deepEqual(marketEfficiencyRemoveState, {
  refinements: [
    {
      id: "keep:channelV2:reachRateTable",
      op: "keep",
      field: "channelV2",
      values: ["Display"],
      sourceBlockId: "reachRateTable",
      label: "Keep Channel = Display",
    },
  ],
  drillTransitions: [],
  hostIntent: null,
  detailDiagnostic: null,
});
assert.deepEqual(marketEfficiencyRemoveState, marketEfficiencyRemoveResult.result);
const marketEfficiencyAfterRemove = buildMarketEfficiencyInteractionPreview(marketEfficiencyRemoveState);
assert.equal(marketEfficiencyAfterRemove.request.filters.includeCountry, undefined);
assert.deepEqual(marketEfficiencyAfterRemove.request.filters.includeChannelV2, ["Display"]);
assert.equal(marketEfficiencyAfterRemove.request.dimensions.region, undefined);
assert.equal(marketEfficiencyAfterRemove.request.dimensions.channelV2, true);
assert.deepEqual(
  summarizeRuntimeRows(marketEfficiencyAfterRemove.preview.reportFill.datasets[0].rows, "country", "avails"),
  summarizeRuntimeRows(
    (reopenedMarketEfficiencyPreview.reportFill.datasets[0].rows || []).filter((row) => row?.channelV2 === "Display"),
    "country",
    "avails",
  ),
);
assert.deepEqual(marketEfficiencyAfterRemove.preview.reportFill.blocks.find((block) => block.id === "activeDrillPath")?.content, {
  title: "Active Drill Path",
  actionKinds: ["remove", "clearAll"],
  emptyLabel: "No active market drill path",
  refinements: [
    {
      id: "keep:channelV2:reachRateTable",
      op: "keep",
      field: "channelV2",
      values: ["Display"],
      sourceBlockId: "reachRateTable",
      label: "Keep Channel = Display",
    },
  ],
});
assert.equal(marketEfficiencyAfterRemove.preview.reportPrint.bookmarks.some((bookmark) => bookmark.id === "bookmark.activeDrillPath"), true);
assert.equal(marketEfficiencyAfterRemove.preview.reportPrint.pages.flatMap((page) => page.elements || []).some((element) => element.kind === "text" && element.text === "Keep Channel = Display"), true);
assert.equal(marketEfficiencyAfterRemove.preview.reportPrint.pages.flatMap((page) => page.elements || []).some((element) => element.kind === "text" && element.text === "Drill to Region = US"), false);
assert.equal(marketEfficiencyAfterRemove.preview.reportPrint.pages.flatMap((page) => page.elements || []).some((element) => element.kind === "text" && element.text === "No active market drill path"), false);

let marketEfficiencyClearState = replaceReportRuntimeInteractionState(
  resolvedMarketEfficiencyMixedSession?.runtimePreviewInteraction,
);
assert.deepEqual(marketEfficiencyClearState, expectedMarketEfficiencyMixedInteraction);
const marketEfficiencyClearHandlers = buildReportRuntimeHandlers({
  clearRefinements() {
    marketEfficiencyClearState = clearReportRuntimeInteractionState();
    return marketEfficiencyClearState;
  },
});
const marketEfficiencyClearExecution = buildReportRuntimeRefinementBarClearExecution({
  blockId: "activeDrillPath",
});
const marketEfficiencyClearResult = executeReportRuntimeAction(
  marketEfficiencyClearExecution,
  marketEfficiencyClearHandlers,
);
assert.deepEqual(marketEfficiencyClearResult, {
  executed: true,
  branch: "clearRefinements",
  result: {
    refinements: [],
    drillTransitions: [],
    hostIntent: null,
    detailDiagnostic: null,
  },
});
assert.deepEqual(marketEfficiencyClearState, {
  refinements: [],
  drillTransitions: [],
  hostIntent: null,
  detailDiagnostic: null,
});
assert.deepEqual(marketEfficiencyClearState, marketEfficiencyClearResult.result);
const marketEfficiencyAfterClear = buildMarketEfficiencyInteractionPreview(marketEfficiencyClearState);
assert.equal(marketEfficiencyAfterClear.request.filters.includeCountry, undefined);
assert.equal(marketEfficiencyAfterClear.request.filters.includeChannelV2, undefined);
assert.equal(marketEfficiencyAfterClear.request.dimensions.region, undefined);
assert.equal(marketEfficiencyAfterClear.request.dimensions.channelV2, true);
assert.deepEqual(marketEfficiencyAfterClear.preview.reportFill.blocks.find((block) => block.id === "activeDrillPath")?.content, {
  title: "Active Drill Path",
  actionKinds: ["remove", "clearAll"],
  emptyLabel: "No active market drill path",
  refinements: [],
});
assert.equal(marketEfficiencyAfterClear.preview.reportPrint.bookmarks.some((bookmark) => bookmark.id === "bookmark.activeDrillPath"), false);
assert.equal(marketEfficiencyAfterClear.preview.reportPrint.pages.flatMap((page) => page.elements || []).some((element) => element.kind === "text" && element.text === "No active market drill path"), false);
assert.equal(marketEfficiencyAfterClear.preview.reportPrint.pages.flatMap((page) => page.elements || []).some((element) => element.kind === "text" && element.text === "Drill to Region = US"), false);
assert.equal(marketEfficiencyAfterClear.preview.reportPrint.pages.flatMap((page) => page.elements || []).some((element) => element.kind === "text" && element.text === "Keep Channel = Display"), false);
assert.deepEqual(marketEfficiencyAfterClear.model.reportSpec, reopenedMarketEfficiencyModel.reportSpec);
assert.deepEqual(marketEfficiencyAfterClear.preview.reportFill, reopenedMarketEfficiencyPreview.reportFill);
assert.deepEqual(marketEfficiencyAfterClear.preview.reportPrint, reopenedMarketEfficiencyPreview.reportPrint);

assert.equal(inventoryRecord.savedReportPayload.sourceArtifactId, "capacity_q3_inventory_top_channels");
assert.equal(inventoryRecord.savedReportPayload.sourceSession.sourceRef.kind, "reportBuilder.reportTemplate");
assert.equal(inventoryRecord.savedReportPayload.sourceSession.sourceRef.templateId, "capacity_inventory_brief");
assert.equal(inventoryRecord.savedReportPayload.sourceSession.sourceRef.templateLabel, "Capacity Inventory Brief");
assert.equal(inventoryRecord.savedReportPayload.reportDocument.blocks[0].state.viewMode, "chart");
assert.deepEqual(inventoryRecord.savedReportPayload.reportDocument.blocks[0].state.selectedMeasures, ["avails"]);
assert.deepEqual(inventoryRecord.savedReportPayload.reportDocument.blocks[0].state.selectedDimensions, ["channelV2"]);
assert.equal(inventoryRecord.savedReportPayload.reportDocument.blocks[0].state.chartSpec.xField, "channelV2");
assert.equal(inventoryRecord.savedReportPayload.reportDocument.blocks[0].state.chartSpec.title, "Inventory · Top Channels");
assert.equal(inventoryRecord.savedReportPayload.reportDocument.blocks[0].state.reportDocumentTemplateId, "capacity_inventory_brief");
assert.equal(inventoryRecord.savedReportPayload.reportDocument.blocks[0].state.reportDocumentTemplateLabel, "Capacity Inventory Brief");
assert.equal(inventoryRecord.reportPrint.kind, "reportPrint");
assert.equal(validateReportPrint(inventoryRecord.reportPrint).valid, true);
assert.equal(validateReportExportRequest(inventoryRecord.exportRequest).valid, true);
assert.equal(inventoryRecord.reportPrint.title, "Capacity Inventory Top Channels Q3");
assert.equal(inventoryRecord.runtimeBlock.title, "Capacity Inventory Top Channels Q3");
assert.equal(inventoryRecord.runtimeBlock.dashboard.reportRuntime.reportPrint.title, "Capacity Inventory Top Channels Q3");
assert.equal(inventoryRecord.exportRequest.source.from, "savedPayload");
assert.equal(inventoryRecord.reportPrint.bookmarks.some((bookmark) => bookmark.id === "bookmark.primaryChart"), true);
assert.equal(inventoryRecord.runtimeBlock.dashboard.reportRuntime.reportPrint.kind, "reportPrint");
assert.equal(findChartBlock(inventoryRecord.savedReportPayload.reportSpec)?.chartSpec?.xField, "channelV2");
const inventoryExportRequestSnapshot = cloneValue(inventoryLadderRecord.exportRequest);
const inventoryReportPrintSnapshot = cloneValue(inventoryLadderRecord.reportPrint);
assert.deepEqual(
  findHierarchy(inventoryRecord.savedReportPayload.reportSpec, "capacity_inventory")?.levels?.map((level) => level.field),
  ["channelV2", "publisher", "siteType"],
);

const hydratedInventory = buildHydratedFromRecord(inventoryRecord, 7, 9400);
assert.equal(hydratedInventory.valid, true);
assert.equal(hydratedInventory.state.viewMode, "chart");
assert.equal(hydratedInventory.state.chartSpec.xField, "channelV2");
assert.equal(hydratedInventory.state.chartSpec.title, "Inventory · Top Channels");
assert.deepEqual(hydratedInventory.state.selectedMeasures, ["avails"]);
assert.deepEqual(hydratedInventory.state.selectedDimensions, ["channelV2"]);
assert.equal(hydratedInventory.state.reportDocumentTemplateId, "capacity_inventory_brief");
assert.equal(hydratedInventory.state.reportDocumentTemplateLabel, "Capacity Inventory Brief");
assert.equal(hydratedInventory.state.binding.modelRef, "model://example/performance/delivery@v1");
assert.deepEqual(
  findHierarchy({ drillMetadata: hydratedInventory.config.drillMetadata }, "capacity_inventory")?.levels?.map((level) => level.field),
  ["channelV2", "publisher", "siteType"],
);

const locationRecord = buildPreviewSavedReportPayloadRecord({
  container,
  reportBuilderConfig,
  rows: RAW_ROWS,
  semanticModel,
  reportId: "capacityLocationsTopMarketsQ3",
  title: "Capacity Locations Top Markets Q3",
  templateId: "capacity_location_brief",
  presetKind: "chart",
  presetTitle: "Locations · Top Markets",
  documentVersion: 8,
  artifactId: "capacity_q3_locations_top_markets",
  savedAt: 9500,
});

assert.equal(locationRecord.savedReportPayload.sourceArtifactId, "capacity_q3_locations_top_markets");
assert.equal(locationRecord.savedReportPayload.sourceSession.sourceRef.kind, "reportBuilder.reportTemplate");
assert.equal(locationRecord.savedReportPayload.sourceSession.sourceRef.templateId, "capacity_location_brief");
assert.equal(locationRecord.savedReportPayload.sourceSession.sourceRef.templateLabel, "Capacity Location Brief");
assert.deepEqual(locationRecord.savedReportPayload.reportDocument.blocks[0].state.selectedMeasures, ["avails"]);
assert.deepEqual(locationRecord.savedReportPayload.reportDocument.blocks[0].state.selectedDimensions, ["country"]);
assert.equal(locationRecord.savedReportPayload.reportDocument.blocks[0].state.chartSpec.xField, "country");
assert.equal(locationRecord.savedReportPayload.reportDocument.blocks[0].state.chartSpec.title, "Locations · Top Markets");
assert.equal(locationRecord.savedReportPayload.reportDocument.blocks[0].state.reportDocumentTemplateId, "capacity_location_brief");
assert.equal(locationRecord.savedReportPayload.reportDocument.blocks[0].state.reportDocumentTemplateLabel, "Capacity Location Brief");
assert.equal(findChartBlock(locationRecord.savedReportPayload.reportSpec)?.chartSpec?.xField, "country");
const locationExportRequestSnapshot = cloneValue(locationRecord.exportRequest);
const locationReportPrintSnapshot = cloneValue(locationRecord.reportPrint);
assert.deepEqual(
  findHierarchy(locationRecord.savedReportPayload.reportSpec, "capacity_location")?.levels?.map((level) => level.field),
  ["country", "region", "metrocode"],
);

const hydratedLocation = buildHydratedFromRecord(locationRecord, 8, 9500);
assert.equal(hydratedLocation.valid, true);
assert.equal(hydratedLocation.state.viewMode, "chart");
assert.equal(hydratedLocation.state.chartSpec.xField, "country");
assert.equal(hydratedLocation.state.chartSpec.title, "Locations · Top Markets");
assert.deepEqual(hydratedLocation.state.selectedMeasures, ["avails"]);
assert.deepEqual(hydratedLocation.state.selectedDimensions, ["country"]);
assert.equal(hydratedLocation.state.reportDocumentTemplateId, "capacity_location_brief");
assert.equal(hydratedLocation.state.reportDocumentTemplateLabel, "Capacity Location Brief");
assert.deepEqual(
  findHierarchy({ drillMetadata: hydratedLocation.config.drillMetadata }, "capacity_location")?.levels?.map((level) => level.field),
  ["country", "region", "metrocode"],
);

const reopenedLocationRuntime = await buildReopenedRuntimeDrillScenario({
  container,
  record: locationRecord,
  hydrated: hydratedLocation,
  blockId: "primaryChart",
  selection: {
    source: "cartesian",
    xValue: "US",
    row: {
      country: "US",
      avails: 153100,
    },
    selectionRows: RAW_ROWS.filter((row) => row.country === "US"),
  },
  nextFieldRef: "region",
});

assert.deepEqual(reopenedLocationRuntime.execution, {
  id: "drill:country:region",
  label: "Drill to Region",
  kind: "drill",
  transition: {
    sourceField: "country",
    nextFieldRef: "region",
    sourceBlockId: "primaryChart",
  },
  refinement: {
    op: "drill",
    field: "country",
    value: "US",
    sourceBlockId: "primaryChart",
    fieldLabel: "Market",
    label: "Drill to Region = US",
  },
});
assert.deepEqual(reopenedLocationRuntime.interactionState.drillTransitions, [{
  refinementId: "drill:country:primaryChart",
  sourceField: "country",
  nextFieldRef: "region",
  sourceBlockId: "primaryChart",
}]);
assert.ok(reopenedLocationRuntime.drilledModel.reportSpec.datasets[0].request.dimensions.region);
assert.deepEqual(reopenedLocationRuntime.drilledModel.reportSpec.datasets[0].request.filters.includeCountry, ["US"]);
assert.deepEqual(
  summarizeRuntimeRows(reopenedLocationRuntime.preview.reportFill.datasets[0].rows, "region", "avails"),
  summarizeExpectedRawRows(RAW_ROWS, {
    filterKey: "country",
    filterValue: "US",
    groupKey: "region",
    measureKey: "avails",
  }),
);

const reopenedInventoryDetail = await buildReopenedRuntimeDetailScenario({
  container,
  record: inventoryLadderRecord,
  hydrated: hydratedInventoryLadder,
  blockId: "primaryTable",
  item: {
    channelV2: "Display",
    avails: 82800,
    hhUniqs: 34800,
  },
  targetRef: "target://example/performance/channel-detail",
});

assert.equal(reopenedInventoryDetail.execution.detailRequest.action.targetRef, "target://example/performance/channel-detail");
assert.deepEqual(reopenedInventoryDetail.resolvedDetailTarget, {
  targetRef: "target://example/performance/channel-detail",
  navigationMode: "hostRoute",
  parameters: {
    channel: "Display",
  },
  unresolvedParameters: [
    {
      parameter: "campaign",
      field: "campaign",
    },
  ],
});
assert.deepEqual(reopenedInventoryDetail.hostIntent, {
  intentKind: "detailTarget",
  title: "Resolved detail target",
  description: "Ready for host routing from the authored runtime preview.",
  targetRef: "target://example/performance/channel-detail",
  navigationMode: "hostRoute",
  parameters: {
    channel: "Display",
  },
});
assert.deepEqual(reopenedInventoryDetail.detailDiagnostic, {
  code: "detailTargetPartial",
  severity: "warning",
  message: "Detail target resolved with omitted parameters: campaign.",
});
assert.deepEqual(inventoryLadderRecord.exportRequest, inventoryExportRequestSnapshot);
assert.deepEqual(inventoryLadderRecord.reportPrint, inventoryReportPrintSnapshot);
assert.equal(Object.prototype.hasOwnProperty.call(inventoryLadderRecord.exportRequest, "hostIntent"), false);
assert.equal(Object.prototype.hasOwnProperty.call(inventoryLadderRecord.reportPrint, "hostIntent"), false);

const reopenedLocationDetail = await buildReopenedRuntimeDetailScenario({
  container,
  record: locationRecord,
  hydrated: hydratedLocation,
  blockId: "primaryChart",
  selection: {
    source: "cartesian",
    xValue: "US",
    row: {
      country: "US",
      avails: 153100,
    },
    selectionRows: RAW_ROWS.filter((row) => row.country === "US"),
  },
  targetRef: "target://example/performance/market-detail",
});

assert.equal(reopenedLocationDetail.execution.detailRequest.action.targetRef, "target://example/performance/market-detail");
assert.deepEqual(reopenedLocationDetail.resolvedDetailTarget, {
  targetRef: "target://example/performance/market-detail",
  navigationMode: "hostRoute",
  parameters: {
    country: "US",
  },
  unresolvedParameters: [],
});
assert.deepEqual(reopenedLocationDetail.hostIntent, {
  intentKind: "detailTarget",
  title: "Resolved detail target",
  description: "Ready for host routing from the authored runtime preview.",
  targetRef: "target://example/performance/market-detail",
  navigationMode: "hostRoute",
  parameters: {
    country: "US",
  },
});
assert.equal(reopenedLocationDetail.detailDiagnostic, null);
assert.deepEqual(locationRecord.exportRequest, locationExportRequestSnapshot);
assert.deepEqual(locationRecord.reportPrint, locationReportPrintSnapshot);
assert.equal(Object.prototype.hasOwnProperty.call(locationRecord.exportRequest, "hostIntent"), false);
assert.equal(Object.prototype.hasOwnProperty.call(locationRecord.reportPrint, "hostIntent"), false);

const authoredChannelChartExportRequestSnapshot = cloneValue(authoredChannelChartRecord.exportRequest);
const authoredChannelChartReportPrintSnapshot = cloneValue(authoredChannelChartRecord.reportPrint);
const hydratedAuthoredChannelChart = buildHydratedFromRecord(authoredChannelChartRecord, 6, 9350);
assert.equal(hydratedAuthoredChannelChart.valid, true);
assert.equal(
  hydratedAuthoredChannelChart.state.reportDocumentBlocks.some((block) => block.id === "channelDetailChart" && block.kind === "chartBlock"),
  true,
);

const reopenedAuthoredChannelChartDrill = await buildReopenedRuntimeDrillScenario({
  container,
  record: authoredChannelChartRecord,
  hydrated: hydratedAuthoredChannelChart,
  blockId: "channelDetailChart",
  selection: {
    source: "category",
    xValue: "Display",
    row: {
      channelV2: "Display",
      avails: 79200,
    },
    selectionRows: RAW_ROWS.filter((row) => row.channelV2 === "Display"),
  },
  nextFieldRef: "country",
});
assert.deepEqual(reopenedAuthoredChannelChartDrill.interactionState.drillTransitions, [{
  refinementId: "drill:channelV2:channelDetailChart",
  sourceField: "channelV2",
  nextFieldRef: "country",
  sourceBlockId: "channelDetailChart",
}]);
assert.deepEqual(reopenedAuthoredChannelChartDrill.drilledModel.reportSpec.datasets[0].request.filters.includeChannelV2, ["Display"]);
assert.equal(reopenedAuthoredChannelChartDrill.drilledModel.reportSpec.datasets[0].request.dimensions.country, true);
assert.equal(reopenedAuthoredChannelChartDrill.drilledModel.reportSpec.blocks.find((block) => block.id === "channelDetailChart")?.chartSpec?.xField, "channelV2");
assert.deepEqual(
  summarizeRuntimeRows(reopenedAuthoredChannelChartDrill.preview.reportFill.datasets[0].rows, "country", "avails"),
  summarizeExpectedRawRows(RAW_ROWS, {
    filterKey: "channelV2",
    filterValue: "Display",
    groupKey: "country",
    measureKey: "avails",
  }),
);

const reopenedAuthoredChannelChartDetail = await buildReopenedRuntimeDetailScenario({
  container,
  record: authoredChannelChartRecord,
  hydrated: hydratedAuthoredChannelChart,
  blockId: "channelDetailChart",
  selection: {
    source: "category",
    xValue: "Display",
    row: {
      channelV2: "Display",
      avails: 79200,
    },
    selectionRows: RAW_ROWS.filter((row) => row.channelV2 === "Display"),
  },
  targetRef: "target://example/performance/channel-detail",
});
assert.equal(reopenedAuthoredChannelChartDetail.execution.detailRequest.action.targetRef, "target://example/performance/channel-detail");
assert.deepEqual(reopenedAuthoredChannelChartDetail.resolvedDetailTarget, {
  targetRef: "target://example/performance/channel-detail",
  navigationMode: "hostRoute",
  parameters: {
    channel: "Display",
  },
  unresolvedParameters: [
    {
      parameter: "campaign",
      field: "campaign",
      ambiguous: true,
    },
  ],
});
assert.deepEqual(reopenedAuthoredChannelChartDetail.hostIntent, {
  intentKind: "detailTarget",
  title: "Resolved detail target",
  description: "Ready for host routing from the authored runtime preview.",
  targetRef: "target://example/performance/channel-detail",
  navigationMode: "hostRoute",
  parameters: {
    channel: "Display",
  },
});
assert.deepEqual(reopenedAuthoredChannelChartDetail.detailDiagnostic, {
  code: "detailTargetPartial",
  severity: "warning",
  message: "Detail target resolved with omitted parameters: campaign.",
});
assert.deepEqual(authoredChannelChartRecord.exportRequest, authoredChannelChartExportRequestSnapshot);
assert.deepEqual(authoredChannelChartRecord.reportPrint, authoredChannelChartReportPrintSnapshot);
assert.equal(Object.prototype.hasOwnProperty.call(authoredChannelChartRecord.exportRequest, "hostIntent"), false);
assert.equal(Object.prototype.hasOwnProperty.call(authoredChannelChartRecord.reportPrint, "hostIntent"), false);

const directSeriesRecord = buildCapacityDirectSeriesFixtureState().record;
const directSeriesExportRequestSnapshot = cloneValue(directSeriesRecord.exportRequest);
const directSeriesReportPrintSnapshot = cloneValue(directSeriesRecord.reportPrint);
const hydratedDirectSeries = buildHydratedFromRecord(directSeriesRecord, 9, 9600);
assert.equal(hydratedDirectSeries.valid, true);
assert.equal(hydratedDirectSeries.state.viewMode, "chart");
assert.equal(hydratedDirectSeries.state.chartSpec?.title, "Avails + HH Uniques by Date");
assert.equal(hydratedDirectSeries.state.chartSpec?.type, "bar");
assert.deepEqual(hydratedDirectSeries.state.selectedMeasures, ["avails", "hhUniqs"]);
assert.deepEqual(hydratedDirectSeries.state.selectedDimensions, ["eventDate"]);

const reopenedDirectSeriesDetail = await buildReopenedRuntimeDetailScenario({
  container,
  record: directSeriesRecord,
  hydrated: hydratedDirectSeries,
  blockId: "primaryChart",
  selection: {
    source: "cartesian",
    xValue: "2026-05-01",
    seriesKey: "avails",
    row: {
      eventDate: "2026-05-01",
      avails: 74700,
      hhUniqs: 31200,
    },
    selectionRows: [
      { eventDate: "2026-05-01", channelV2: "Display", avails: 40000, hhUniqs: 16000, country: "US" },
      { eventDate: "2026-05-01", channelV2: "CTV", avails: 34700, hhUniqs: 15200, country: "US" },
    ],
  },
  targetRef: "target://example/performance/date-detail",
});

assert.equal(reopenedDirectSeriesDetail.execution.detailRequest.action.targetRef, "target://example/performance/date-detail");
assert.deepEqual(reopenedDirectSeriesDetail.resolvedDetailTarget, {
  targetRef: "target://example/performance/date-detail",
  navigationMode: "hostRoute",
  parameters: {
    eventDate: "2026-05-01",
    country: "US",
  },
  unresolvedParameters: [],
});
assert.deepEqual(reopenedDirectSeriesDetail.hostIntent, {
  intentKind: "detailTarget",
  title: "Resolved detail target",
  description: "Ready for host routing from the authored runtime preview.",
  targetRef: "target://example/performance/date-detail",
  navigationMode: "hostRoute",
  parameters: {
    eventDate: "2026-05-01",
    country: "US",
  },
});
assert.equal(reopenedDirectSeriesDetail.detailDiagnostic, null);
assert.deepEqual(directSeriesRecord.exportRequest, directSeriesExportRequestSnapshot);
assert.deepEqual(directSeriesRecord.reportPrint, directSeriesReportPrintSnapshot);
assert.equal(Object.prototype.hasOwnProperty.call(directSeriesRecord.exportRequest, "hostIntent"), false);
assert.equal(Object.prototype.hasOwnProperty.call(directSeriesRecord.reportPrint, "hostIntent"), false);

const mixedInventoryContext = await buildReopenedRuntimeActionContext({
  container,
  record: inventoryLadderRecord,
  hydrated: hydratedInventoryLadder,
  blockId: "primaryTable",
});
const mixedInventoryExportRequestSnapshot = cloneValue(mixedInventoryContext.basePreview.exportRequest);
const mixedInventoryReportPrintSnapshot = cloneValue(mixedInventoryContext.basePreview.reportPrint);

const mixedInventoryInteraction = buildReportRuntimeTableInteractionState({
  blockId: mixedInventoryContext.runtimeBlock.id,
  fields: mixedInventoryContext.fields,
  providerActionsByField: mixedInventoryContext.providerActionsByField,
});

let mixedInventoryState = createReportRuntimeInteractionState();
const mixedInventoryHandlers = buildReportRuntimeHandlers({
  applyRefinement(refinement) {
    mixedInventoryState = applyReportRuntimeInteractionRefinement(mixedInventoryState, refinement);
    return mixedInventoryState;
  },
  applyDrillTransition(payload) {
    mixedInventoryState = applyReportRuntimeInteractionDrillTransition(mixedInventoryState, payload);
    return mixedInventoryState;
  },
  clearDetailState() {
    mixedInventoryState = clearReportRuntimeInteractionDetailState(mixedInventoryState);
    return mixedInventoryState;
  },
  openDetailTarget: createReportRuntimeDetailTargetOpener({
    drillMetadataProvider: mixedInventoryContext.drillMetadataProvider,
    setHostIntent(next) {
      mixedInventoryState = setReportRuntimeInteractionHostIntent(mixedInventoryState, next);
    },
    setDetailDiagnostic(next) {
      mixedInventoryState = setReportRuntimeInteractionDetailDiagnostic(mixedInventoryState, next);
    },
  }),
});

const mixedInventoryDetailAction = mixedInventoryInteraction.actions.find((action) => action?.kind === "detail") || null;
assert.ok(mixedInventoryDetailAction, "A reopened mixed-flow detail action is required.");
const mixedInventoryDetailExecution = mixedInventoryDetailAction.resolveExecution({
  channelV2: "Display",
  avails: 82800,
  hhUniqs: 34800,
});
const mixedInventoryDetailResult = executeReportRuntimeAction(mixedInventoryDetailExecution, mixedInventoryHandlers);
assert.equal(mixedInventoryDetailResult.executed, true);
await mixedInventoryDetailResult.result;
assert.deepEqual(mixedInventoryState.hostIntent, {
  intentKind: "detailTarget",
  title: "Resolved detail target",
  description: "Ready for host routing from the authored runtime preview.",
  targetRef: "target://example/performance/channel-detail",
  navigationMode: "hostRoute",
  parameters: {
    channel: "Display",
  },
});
assert.deepEqual(mixedInventoryState.detailDiagnostic, {
  code: "detailTargetPartial",
  severity: "warning",
  message: "Detail target resolved with omitted parameters: campaign.",
});
assert.deepEqual(mixedInventoryContext.basePreview.exportRequest, mixedInventoryExportRequestSnapshot);
assert.deepEqual(mixedInventoryContext.basePreview.reportPrint, mixedInventoryReportPrintSnapshot);

mixedInventoryHandlers.clearDetailState();
assert.equal(mixedInventoryState.hostIntent, null);
assert.equal(mixedInventoryState.detailDiagnostic, null);
assert.deepEqual(mixedInventoryContext.basePreview.exportRequest, mixedInventoryExportRequestSnapshot);
assert.deepEqual(mixedInventoryContext.basePreview.reportPrint, mixedInventoryReportPrintSnapshot);

const mixedInventoryDrillAction = mixedInventoryInteraction.actions.find((action) => action?.kind === "drill" && action.resolveExecution({
  channelV2: "Display",
  avails: 82800,
  hhUniqs: 34800,
})?.transition?.nextFieldRef === "publisher") || null;
assert.ok(mixedInventoryDrillAction, "A reopened mixed-flow drill action is required.");
const mixedInventoryDrillExecution = mixedInventoryDrillAction.resolveExecution({
  channelV2: "Display",
  avails: 82800,
  hhUniqs: 34800,
});
const mixedInventoryDrillResult = executeReportRuntimeAction(mixedInventoryDrillExecution, mixedInventoryHandlers);
assert.equal(mixedInventoryDrillResult.executed, true);
await Promise.resolve(mixedInventoryDrillResult.result);
assert.deepEqual(mixedInventoryState.drillTransitions, [{
  refinementId: "drill:channelV2:primaryTable",
  sourceField: "channelV2",
  nextFieldRef: "publisher",
  sourceBlockId: "primaryTable",
}]);

const mixedInventoryDrilledModel = buildPreviewAuthoredReportModel({
  container,
  config: hydratedInventoryLadder.config,
  state: hydratedInventoryLadder.state,
  refinements: mixedInventoryState.refinements,
  drillTransitions: mixedInventoryState.drillTransitions,
  semanticSummary: mixedInventoryContext.semanticSummary,
});
const mixedInventoryDrilledRequest = mixedInventoryDrilledModel?.reportSpec?.datasets?.[0]?.request;
assert.ok(mixedInventoryDrilledRequest, "A reopened mixed-flow drilled table request is required.");
assert.ok(mixedInventoryDrilledRequest.dimensions.publisher);
assert.deepEqual(mixedInventoryDrilledRequest.filters.includeChannelV2, ["Display"]);

const mixedLocationContext = await buildReopenedRuntimeActionContext({
  container,
  record: locationRecord,
  hydrated: hydratedLocation,
  blockId: "primaryChart",
});
const mixedLocationExportRequestSnapshot = cloneValue(mixedLocationContext.basePreview.exportRequest);
const mixedLocationReportPrintSnapshot = cloneValue(mixedLocationContext.basePreview.reportPrint);

const baseLocationSelection = {
  source: "cartesian",
  xValue: "US",
  row: {
    country: "US",
    avails: 153100,
  },
  selectionRows: RAW_ROWS.filter((row) => row.country === "US"),
};

let mixedLocationSelectionByBlock = setReportRuntimeChartSelection({}, mixedLocationContext.runtimeBlock.id, baseLocationSelection);
let mixedLocationState = createReportRuntimeInteractionState();
const mixedLocationHandlers = buildReportRuntimeHandlers({
  applyRefinement(refinement) {
    mixedLocationState = applyReportRuntimeInteractionRefinement(mixedLocationState, refinement);
    return mixedLocationState;
  },
  applyDrillTransition(payload) {
    mixedLocationState = applyReportRuntimeInteractionDrillTransition(mixedLocationState, payload);
    return mixedLocationState;
  },
  clearDetailState() {
    mixedLocationState = clearReportRuntimeInteractionDetailState(mixedLocationState);
    return mixedLocationState;
  },
  openDetailTarget: createReportRuntimeDetailTargetOpener({
    drillMetadataProvider: mixedLocationContext.drillMetadataProvider,
    setHostIntent(next) {
      mixedLocationState = setReportRuntimeInteractionHostIntent(mixedLocationState, next);
    },
    setDetailDiagnostic(next) {
      mixedLocationState = setReportRuntimeInteractionDetailDiagnostic(mixedLocationState, next);
    },
  }),
});

const mixedLocationDetailInteraction = buildReportRuntimeChartInteractionState({
  blockId: mixedLocationContext.runtimeBlock.id,
  blockTitle: mixedLocationContext.runtimeBlock.title,
  fields: mixedLocationContext.fields,
  selection: mixedLocationSelectionByBlock[mixedLocationContext.runtimeBlock.id],
  providerActionsByField: mixedLocationContext.providerActionsByField,
  interactionSupport: {
    enabled: true,
    legendEnabled: false,
  },
  canClearSelection: true,
});

const mixedLocationDetailExecution = mixedLocationDetailInteraction.executions.find((entry) => entry?.kind === "detail" && entry?.detailRequest?.action?.targetRef === "target://example/performance/market-detail") || null;
assert.ok(mixedLocationDetailExecution, "A reopened mixed-flow chart detail action is required.");
const mixedLocationDetailResult = executeReportRuntimeAction(mixedLocationDetailExecution, mixedLocationHandlers);
assert.equal(mixedLocationDetailResult.executed, true);
await mixedLocationDetailResult.result;
assert.deepEqual(mixedLocationState.hostIntent, {
  intentKind: "detailTarget",
  title: "Resolved detail target",
  description: "Ready for host routing from the authored runtime preview.",
  targetRef: "target://example/performance/market-detail",
  navigationMode: "hostRoute",
  parameters: {
    country: "US",
  },
});
assert.equal(mixedLocationState.detailDiagnostic, null);
assert.deepEqual(mixedLocationContext.basePreview.exportRequest, mixedLocationExportRequestSnapshot);
assert.deepEqual(mixedLocationContext.basePreview.reportPrint, mixedLocationReportPrintSnapshot);

mixedLocationHandlers.clearDetailState();
assert.equal(mixedLocationState.hostIntent, null);
assert.equal(mixedLocationState.detailDiagnostic, null);
assert.deepEqual(mixedLocationContext.basePreview.exportRequest, mixedLocationExportRequestSnapshot);
assert.deepEqual(mixedLocationContext.basePreview.reportPrint, mixedLocationReportPrintSnapshot);

mixedLocationSelectionByBlock = clearReportRuntimeChartSelection(
  mixedLocationSelectionByBlock,
  mixedLocationContext.runtimeBlock.id,
);
const mixedLocationIdleInteraction = buildReportRuntimeChartInteractionState({
  blockId: mixedLocationContext.runtimeBlock.id,
  blockTitle: mixedLocationContext.runtimeBlock.title,
  fields: mixedLocationContext.fields,
  selection: mixedLocationSelectionByBlock[mixedLocationContext.runtimeBlock.id],
  providerActionsByField: mixedLocationContext.providerActionsByField,
  interactionSupport: {
    enabled: true,
    legendEnabled: false,
  },
  canClearSelection: false,
});
assert.deepEqual(mixedLocationIdleInteraction.viewModel, {
  kind: "idle",
  message: "Click a chart mark to apply authored runtime actions.",
});

mixedLocationSelectionByBlock = setReportRuntimeChartSelection(
  mixedLocationSelectionByBlock,
  mixedLocationContext.runtimeBlock.id,
  baseLocationSelection,
);
const mixedLocationDrillInteraction = buildReportRuntimeChartInteractionState({
  blockId: mixedLocationContext.runtimeBlock.id,
  blockTitle: mixedLocationContext.runtimeBlock.title,
  fields: mixedLocationContext.fields,
  selection: mixedLocationSelectionByBlock[mixedLocationContext.runtimeBlock.id],
  providerActionsByField: mixedLocationContext.providerActionsByField,
  interactionSupport: {
    enabled: true,
    legendEnabled: false,
  },
  canClearSelection: true,
});
const mixedLocationDrillExecution = mixedLocationDrillInteraction.executions.find((entry) => entry?.kind === "drill" && entry?.transition?.nextFieldRef === "region") || null;
assert.ok(mixedLocationDrillExecution, "A reopened mixed-flow chart drill action is required.");
const mixedLocationDrillResult = executeReportRuntimeAction(mixedLocationDrillExecution, mixedLocationHandlers);
assert.equal(mixedLocationDrillResult.executed, true);
await Promise.resolve(mixedLocationDrillResult.result);
assert.deepEqual(mixedLocationState.drillTransitions, [{
  refinementId: "drill:country:primaryChart",
  sourceField: "country",
  nextFieldRef: "region",
  sourceBlockId: "primaryChart",
}]);
const mixedLocationDrilledModel = buildPreviewAuthoredReportModel({
  container,
  config: hydratedLocation.config,
  state: hydratedLocation.state,
  refinements: mixedLocationState.refinements,
  drillTransitions: mixedLocationState.drillTransitions,
  semanticSummary: mixedLocationContext.semanticSummary,
});
const mixedLocationDrilledRequest = mixedLocationDrilledModel?.reportSpec?.datasets?.[0]?.request;
assert.ok(mixedLocationDrilledRequest, "A reopened mixed-flow drilled chart request is required.");
assert.ok(mixedLocationDrilledRequest.dimensions.region);
assert.deepEqual(mixedLocationDrilledRequest.filters.includeCountry, ["US"]);
const mixedLocationDrilledPreview = buildPreviewAuthoredReport({
  container,
  config: hydratedLocation.config,
  state: hydratedLocation.state,
  rows: RAW_ROWS,
  refinements: mixedLocationState.refinements,
  drillTransitions: mixedLocationState.drillTransitions,
  semanticSummary: mixedLocationContext.semanticSummary,
  model: mixedLocationDrilledModel,
});
assert.deepEqual(
  summarizeRuntimeRows(mixedLocationDrilledPreview.reportFill.datasets[0].rows, "region", "avails"),
  summarizeExpectedRawRows(RAW_ROWS, {
    filterKey: "country",
    filterValue: "US",
    groupKey: "region",
    measureKey: "avails",
  }),
);

const {
  beforePrimary: mixedLocationAfterChartBeforePrimary = [],
  primary: mixedLocationAfterChartPrimary = [],
  afterPrimary: mixedLocationAfterChartAfterPrimary = [],
} = resolveReportRuntimePrimaryBlocks(
  mixedLocationDrilledPreview.reportSpec,
  mixedLocationDrilledPreview.reportFill,
);
const mixedLocationAfterChartBlocks = [
  ...mixedLocationAfterChartBeforePrimary,
  ...mixedLocationAfterChartPrimary,
  ...mixedLocationAfterChartAfterPrimary,
];
const mixedLocationPrimaryTableBlock = mixedLocationAfterChartBlocks.find((block) => block?.id === "primaryTable") || null;
assert.ok(mixedLocationPrimaryTableBlock, "A reopened chart-to-table primaryTable block is required.");
const mixedLocationPrimaryTableFields = resolveReportRuntimeRefinementFields(
  mixedLocationDrilledPreview.reportSpec,
  mixedLocationPrimaryTableBlock,
);
assert.ok(Array.isArray(mixedLocationPrimaryTableFields), "A reopened chart-to-table field set is required.");
const mixedLocationPrimaryTableProvider = resolveReportRuntimePreviewDetailProvider({
  semanticModelHandler: null,
  reportSpec: mixedLocationDrilledPreview.reportSpec,
});
assert.ok(mixedLocationPrimaryTableProvider, "A reopened chart-to-table provider is required.");
const mixedLocationPrimaryTableActionsByField = new Map();
for (const field of mixedLocationPrimaryTableFields) {
  const providerActions = await mixedLocationPrimaryTableProvider.listAvailableRefinements(
    mixedLocationPrimaryTableBlock.kind,
    field.valueKey,
    {
      reportSpec: mixedLocationDrilledPreview.reportSpec,
      block: mixedLocationPrimaryTableBlock,
    },
  );
  mixedLocationPrimaryTableActionsByField.set(
    `${mixedLocationPrimaryTableBlock.id}:${field.valueKey}`,
    Array.isArray(providerActions) ? providerActions : [],
  );
}
const mixedLocationTableInteraction = buildReportRuntimeTableInteractionState({
  blockId: mixedLocationPrimaryTableBlock.id,
  fields: mixedLocationPrimaryTableFields,
  providerActionsByField: mixedLocationPrimaryTableActionsByField,
});
const mixedLocationWestRow = (Array.isArray(mixedLocationDrilledPreview?.reportFill?.datasets?.[0]?.rows)
  ? mixedLocationDrilledPreview.reportFill.datasets[0].rows
  : []
).find((row) => row?.region === "West") || null;
assert.ok(mixedLocationWestRow, "A reopened chart-to-table West region row is required.");
assert.ok(Array.isArray(mixedLocationTableInteraction.actions), "A reopened chart-to-table action list is required.");
let mixedLocationTableKeepAction = null;
let mixedLocationTableKeepExecution = null;
for (const action of mixedLocationTableInteraction.actions) {
  if (action?.kind !== "keep") {
    continue;
  }
  const execution = action.resolveExecution?.(mixedLocationWestRow) || null;
  if (execution?.refinement?.field === "region") {
    mixedLocationTableKeepAction = action;
    mixedLocationTableKeepExecution = execution;
    break;
  }
}
assert.ok(mixedLocationTableKeepAction, "A reopened chart-to-table keep action is required.");
const mixedLocationTableKeepResult = executeReportRuntimeAction(mixedLocationTableKeepExecution, mixedLocationHandlers);
assert.equal(mixedLocationTableKeepResult.executed, true);
await Promise.resolve(mixedLocationTableKeepResult.result);
assert.strictEqual(mixedLocationState.hostIntent, null);
assert.strictEqual(mixedLocationState.detailDiagnostic, null);
const mixedLocationTableKeepModel = buildPreviewAuthoredReportModel({
  container,
  config: hydratedLocation.config,
  state: hydratedLocation.state,
  refinements: mixedLocationState.refinements,
  drillTransitions: mixedLocationState.drillTransitions,
  semanticSummary: mixedLocationContext.semanticSummary,
});
const mixedLocationTableKeepRequest = mixedLocationTableKeepModel?.reportSpec?.datasets?.[0]?.request;
assert.ok(mixedLocationTableKeepRequest, "A reopened chart-to-table kept request is required.");
assert.ok(mixedLocationTableKeepRequest.filters, "A reopened chart-to-table kept filter map is required.");
assert.deepEqual(mixedLocationTableKeepRequest.filters.includeCountry, ["US"]);
assert.deepEqual(mixedLocationTableKeepRequest.filters.includeLocationDim, ["US/West"]);
const mixedLocationTableKeepPreview = buildPreviewAuthoredReport({
  container,
  config: hydratedLocation.config,
  state: hydratedLocation.state,
  rows: RAW_ROWS,
  refinements: mixedLocationState.refinements,
  drillTransitions: mixedLocationState.drillTransitions,
  semanticSummary: mixedLocationContext.semanticSummary,
  model: mixedLocationTableKeepModel,
});
assert.ok(Array.isArray(mixedLocationTableKeepPreview?.reportFill?.datasets?.[0]?.rows), "A reopened chart-to-table kept row set is required.");
assert.deepEqual(
  summarizeRuntimeRows(mixedLocationTableKeepPreview.reportFill.datasets[0].rows, "region", "avails"),
  { West: 66400 },
);

const rebuiltMixedLocationContext = await buildReopenedRuntimeActionContext({
  container,
  record: locationRecord,
  hydrated: hydratedLocation,
  blockId: "primaryTable",
  refinements: mixedLocationState.refinements,
  drillTransitions: mixedLocationState.drillTransitions,
});
const rebuiltMixedLocationRequest = rebuiltMixedLocationContext.basePreview?.reportSpec?.datasets?.[0]?.request;
assert.ok(rebuiltMixedLocationRequest, "A rebuilt chart-to-table runtime request is required.");
assert.deepEqual(rebuiltMixedLocationRequest.refinements, mixedLocationState.refinements);
assert.deepEqual(rebuiltMixedLocationRequest.filters.includeCountry, ["US"]);
assert.deepEqual(rebuiltMixedLocationRequest.filters.includeLocationDim, ["US/West"]);
assert.deepEqual(
  summarizeRuntimeRows(rebuiltMixedLocationContext.basePreview.reportFill.datasets[0].rows, "region", "avails"),
  { West: 66400 },
);
assert.ok(
  rebuiltMixedLocationContext.providerActionsByField.has(`${rebuiltMixedLocationContext.runtimeBlock.id}:region`),
  "A rebuilt chart-to-table runtime action map for region is required.",
);

const restoredMixedLocationSession = setReportBuilderHydratedDocumentSessionRuntimePreviewInteraction(
  buildReportBuilderHydratedDocumentSession(hydratedLocation, {
    liveConfig: hydratedLocation.config,
    liveState: hydratedLocation.state,
  }),
  mixedLocationState,
);
assert.ok(restoredMixedLocationSession?.runtimePreviewInteraction, "A restored mixed chart/table runtime interaction snapshot is required.");
const restoredMixedLocationSessionState = applyReportBuilderHydratedDocumentSessionState(
  hydratedLocation.state,
  restoredMixedLocationSession,
);
const resolvedMixedLocationSession = resolveReportBuilderHydratedDocumentSessionFromState(restoredMixedLocationSessionState);
assert.deepEqual(
  resolvedMixedLocationSession?.runtimePreviewInteraction,
  restoredMixedLocationSession.runtimePreviewInteraction,
);
const rebuiltFromSessionMixedLocationContext = await buildReopenedRuntimeActionContext({
  container,
  record: locationRecord,
  hydrated: hydratedLocation,
  blockId: "primaryTable",
  refinements: resolvedMixedLocationSession?.runtimePreviewInteraction?.refinements || [],
  drillTransitions: resolvedMixedLocationSession?.runtimePreviewInteraction?.drillTransitions || [],
});
const rebuiltFromSessionRequest = rebuiltFromSessionMixedLocationContext.basePreview?.reportSpec?.datasets?.[0]?.request;
assert.ok(rebuiltFromSessionRequest, "A rebuilt-from-session chart-to-table runtime request is required.");
assert.deepEqual(rebuiltFromSessionRequest.filters.includeCountry, ["US"]);
assert.deepEqual(rebuiltFromSessionRequest.filters.includeLocationDim, ["US/West"]);

console.log("previewSavedReportPayload ✓ capacity table and chart presets preserve drill ladders through saved payload and reopen flows");
