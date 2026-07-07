import {
  buildReportBuilderReportDocument,
  buildReportDocumentChartBlock,
  buildReportDocumentTableBlock,
  lowerReportDocumentToReportSpec,
} from "../reportDocumentModel.js";
import { buildReportFillFromReportSpec } from "../reportFillModel.js";
import { buildReportPrintFromReportFill } from "../reportPrintModel.js";

const DEFAULT_TITLE = "Authored Derived Compact Report";
const DEFAULT_DATA_SOURCE_REF = "demoReportSource";
const DEFAULT_CONTAINER_ID = "authoredDerivedCompactBuilder";
const DEFAULT_DATE_RANGE = Object.freeze({
  start: "2026-05-01",
  end: "2026-05-04",
});

export const AUTHORED_DERIVED_COMPACT_ROWS = Object.freeze([
  Object.freeze({ country: "US", channelId: "Display", totalSpend: 82800, hhUniqs: 33800 }),
  Object.freeze({ country: "US", channelId: "CTV", totalSpend: 70300, hhUniqs: 30100 }),
  Object.freeze({ country: "CA", channelId: "Display", totalSpend: 75800, hhUniqs: 31100 }),
  Object.freeze({ country: "CA", channelId: "CTV", totalSpend: 67700, hhUniqs: 28300 }),
]);

function normalizeString(value = "") {
  return String(value || "").trim();
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeMeasure(definition, fallback) {
  const id = normalizeString(definition?.id || fallback.id) || fallback.id;
  return {
    id,
    key: normalizeString(definition?.key || id) || id,
    label: normalizeString(definition?.label || fallback.label) || fallback.label,
    paramPath: normalizeString(definition?.paramPath || fallback.paramPath || `measures.${id}`) || `measures.${id}`,
    format: normalizeString(definition?.format || fallback.format),
  };
}

function normalizeDimension(definition, fallback) {
  const id = normalizeString(definition?.id || fallback.id) || fallback.id;
  const key = normalizeString(definition?.key || id) || id;
  const hasRuntimeFilterOverride = Object.prototype.hasOwnProperty.call(definition || {}, "runtimeFilter");
  const hasChartAxisOverride = Object.prototype.hasOwnProperty.call(definition || {}, "chartAxis");
  const normalized = {
    id,
    key,
    label: normalizeString(definition?.label || fallback.label) || fallback.label,
    paramPath: normalizeString(definition?.paramPath || fallback.paramPath || `dimensions.${key}`) || `dimensions.${key}`,
  };
  if (definition?.format || fallback.format) {
    normalized.format = normalizeString(definition?.format || fallback.format);
  }
  if (hasRuntimeFilterOverride) {
    if (definition?.runtimeFilter) {
      normalized.runtimeFilter = cloneValue(definition.runtimeFilter);
    }
  } else if (fallback.runtimeFilter) {
    normalized.runtimeFilter = cloneValue(fallback.runtimeFilter);
  }
  if (hasChartAxisOverride ? definition?.chartAxis : fallback.chartAxis) {
    normalized.chartAxis = true;
  }
  return normalized;
}

function buildMeasureDefinition(measure, isDefault) {
  return {
    id: measure.id,
    key: measure.key,
    label: measure.label,
    paramPath: measure.paramPath,
    ...(isDefault ? { default: true } : {}),
    ...(measure.format ? { format: measure.format } : {}),
  };
}

function buildDimensionDefinition(dimension, isDefault) {
  return {
    id: dimension.id,
    key: dimension.key,
    label: dimension.label,
    paramPath: dimension.paramPath,
    ...(isDefault ? { default: true } : {}),
    ...(dimension.format ? { format: dimension.format } : {}),
    ...(dimension.chartAxis ? { chartAxis: true } : {}),
    ...(dimension.runtimeFilter ? { runtimeFilter: cloneValue(dimension.runtimeFilter) } : {}),
  };
}

function buildCalculatedField(primaryMeasure, dependencyMeasure, overrides) {
  const calculatedFieldId = normalizeString(overrides?.id || "reachRate") || "reachRate";
  const calculatedFieldLabel = normalizeString(overrides?.label || "Reach Rate") || "Reach Rate";
  return {
    id: calculatedFieldId,
    key: normalizeString(overrides?.key || calculatedFieldId) || calculatedFieldId,
    kind: normalizeString(overrides?.kind || "rowCalc") || "rowCalc",
    label: calculatedFieldLabel,
    dataType: normalizeString(overrides?.dataType || "number") || "number",
    format: normalizeString(overrides?.format || "percent") || "percent",
    datasetRef: normalizeString(overrides?.datasetRef || "primary") || "primary",
    dependencies: Array.isArray(overrides?.dependencies) && overrides.dependencies.length > 0
      ? [...overrides.dependencies]
      : [dependencyMeasure.id, primaryMeasure.id],
    expr: normalizeString(overrides?.expr || `if(${primaryMeasure.id} = 0, null, round((${dependencyMeasure.id} / ${primaryMeasure.id}) * 100, 2))`)
      || `if(${primaryMeasure.id} = 0, null, round((${dependencyMeasure.id} / ${primaryMeasure.id}) * 100, 2))`,
  };
}

export function buildAuthoredDerivedCompactConfigState({
  title = DEFAULT_TITLE,
  container = {},
  primaryMeasure,
  dependencyMeasure,
  xDimension,
  seriesDimension = {
    id: "channelId",
    label: "Channel",
  },
  selectedMeasures,
  selectedDimensions,
  staticFilterDefault = DEFAULT_DATE_RANGE,
  orderField,
  orderDir = "asc",
  viewMode = "table",
  chart = {},
  table = {},
  calculatedField,
  layoutType,
  layoutItems,
  resultOverrides = {},
  rows = AUTHORED_DERIVED_COMPACT_ROWS,
} = {}) {
  const normalizedTitle = normalizeString(title || container?.title) || DEFAULT_TITLE;
  const normalizedContainerId = normalizeString(container?.id) || DEFAULT_CONTAINER_ID;
  const normalizedContainer = {
    id: normalizedContainerId,
    stateKey: normalizeString(container?.stateKey || normalizedContainerId) || normalizedContainerId,
    title: normalizedTitle,
    dataSourceRef: normalizeString(container?.dataSourceRef) || DEFAULT_DATA_SOURCE_REF,
  };
  const normalizedPrimaryMeasure = normalizeMeasure(primaryMeasure, {
    id: "totalSpend",
    label: "Spend",
    paramPath: "measures.totalSpend",
    format: "currency",
  });
  const normalizedDependencyMeasure = normalizeMeasure(dependencyMeasure, {
    id: "hhUniqs",
    label: "HH Uniques",
    paramPath: "measures.hhUniqs",
    format: "compactNumber",
  });
  const normalizedXDimension = normalizeDimension(xDimension, {
    id: "country",
    label: "Market",
    paramPath: "dimensions.country",
  });
  const normalizedSeriesDimension = seriesDimension == null
    ? null
    : normalizeDimension(seriesDimension, {
      id: "channelId",
      label: "Channel",
      paramPath: "dimensions.channelId",
    });
  const normalizedSelectedMeasures = Array.isArray(selectedMeasures) && selectedMeasures.length > 0
    ? [...selectedMeasures]
    : [normalizedPrimaryMeasure.id];
  const normalizedSelectedDimensions = Array.isArray(selectedDimensions) && selectedDimensions.length > 0
    ? [...selectedDimensions]
    : [normalizedXDimension.id];
  const normalizedCalculatedField = buildCalculatedField(
    normalizedPrimaryMeasure,
    normalizedDependencyMeasure,
    calculatedField,
  );
  const chartId = normalizeString(chart?.id || "reachRateTrend") || "reachRateTrend";
  const tableId = normalizeString(table?.id || "reachRateTable") || "reachRateTable";
  const normalizedChart = buildReportDocumentChartBlock({
    id: chartId,
    title: normalizeString(chart?.title || `Reach Rate by ${normalizedXDimension.label}`) || `Reach Rate by ${normalizedXDimension.label}`,
    datasetRef: normalizeString(chart?.datasetRef || "primary") || "primary",
    chartSpec: {
      type: normalizeString(chart?.type || "line") || "line",
      xField: normalizeString(chart?.xField || normalizedXDimension.id) || normalizedXDimension.id,
      yFields: Array.isArray(chart?.yFields) && chart.yFields.length > 0
        ? [...chart.yFields]
        : [normalizedCalculatedField.id],
      ...(normalizeString(chart?.seriesField || normalizedSeriesDimension?.id)
        ? { seriesField: normalizeString(chart?.seriesField || normalizedSeriesDimension?.id) }
        : {}),
    },
  });
  const normalizedTableColumns = Array.isArray(table?.columns) && table.columns.length > 0
    ? table.columns.map((column) => cloneValue(column))
    : [
      {
        key: normalizedXDimension.id,
        label: normalizedXDimension.label,
      },
      ...(normalizedSeriesDimension && normalizedSeriesDimension.id !== normalizedXDimension.id
        ? [{
          key: normalizedSeriesDimension.id,
          label: normalizedSeriesDimension.label,
        }]
        : []),
      {
        key: normalizedCalculatedField.id,
        label: normalizedCalculatedField.label,
        format: normalizedCalculatedField.format,
      },
    ];
  const normalizedTable = buildReportDocumentTableBlock({
    id: tableId,
    title: normalizeString(table?.title || "Reach Rate Table") || "Reach Rate Table",
    datasetRef: normalizeString(table?.datasetRef || "primary") || "primary",
    columns: normalizedTableColumns,
  });
  const normalizedOrderField = normalizeString(orderField || normalizedSelectedDimensions[0] || normalizedXDimension.id)
    || normalizedXDimension.id;
  const normalizedRows = Array.isArray(rows) ? rows.map((row) => cloneValue(row)) : AUTHORED_DERIVED_COMPACT_ROWS.map((row) => cloneValue(row));

  return {
    container: normalizedContainer,
    config: {
      title: normalizedTitle,
      measures: [
        buildMeasureDefinition(
          normalizedPrimaryMeasure,
          normalizedSelectedMeasures.includes(normalizedPrimaryMeasure.id),
        ),
        buildMeasureDefinition(normalizedDependencyMeasure, false),
      ],
      dimensions: [
        buildDimensionDefinition(
          normalizedXDimension,
          normalizedSelectedDimensions.includes(normalizedXDimension.id),
        ),
        ...(normalizedSeriesDimension
          ? [
            buildDimensionDefinition(
              normalizedSeriesDimension,
              normalizedSelectedDimensions.includes(normalizedSeriesDimension.id),
            ),
          ]
          : []),
      ],
      staticFilters: [
        {
          id: "dateRange",
          type: "dateRange",
          required: true,
          startParamPath: "filters.From",
          endParamPath: "filters.To",
          default: cloneValue(staticFilterDefault),
        },
      ],
      result: {
        defaultMode: "table",
        chartCreationMode: "explicit",
        resultPanePosition: "left",
        orderFields: [
          {
            value: normalizedOrderField,
            field: normalizedOrderField,
            default: true,
            defaultDirection: normalizeString(orderDir) || "asc",
          },
          {
            value: normalizedPrimaryMeasure.id,
            field: normalizedPrimaryMeasure.id,
            defaultDirection: "desc",
          },
        ],
        pageSize: 50,
        ...cloneValue(resultOverrides),
      },
    },
    state: {
      selectedMeasures: normalizedSelectedMeasures,
      primaryMeasure: normalizedPrimaryMeasure.id,
      selectedDimensions: normalizedSelectedDimensions,
      viewMode: normalizeString(viewMode) || "table",
      chartSpec: null,
      orderField: normalizedOrderField,
      orderDir: normalizeString(orderDir) || "asc",
      scopeParams: {
        dateRange: cloneValue(staticFilterDefault),
      },
      localCalculatedFields: [normalizedCalculatedField],
      reportDocumentBlocks: [normalizedChart, normalizedTable],
      reportDocumentLayout: {
        ...(normalizeString(layoutType) ? { type: normalizeString(layoutType) } : {}),
        items: Array.isArray(layoutItems) && layoutItems.length > 0
          ? layoutItems.map((item) => cloneValue(item))
          : [
            { blockId: "primaryBuilder" },
            { blockId: chartId },
            { blockId: tableId },
          ],
      },
    },
    rows: normalizedRows,
    chartId,
    tableId,
    calculatedFieldId: normalizedCalculatedField.id,
  };
}

export function buildAuthoredDerivedCompactArtifacts(options = {}) {
  const scenario = buildAuthoredDerivedCompactConfigState(options);
  const document = buildReportBuilderReportDocument({
    container: scenario.container,
    config: scenario.config,
    state: scenario.state,
  });
  const reportSpec = lowerReportDocumentToReportSpec(document);
  const reportFill = buildReportFillFromReportSpec(reportSpec, {
    primary: {
      rows: scenario.rows,
    },
  });
  const reportPrint = buildReportPrintFromReportFill({
    reportSpec,
    reportFill,
  });

  return {
    ...scenario,
    document,
    reportSpec,
    reportFill,
    reportPrint,
  };
}
