import { normalizeReportBuilderDocumentBlocks } from "./reportDocumentModel.js";

export const DASHBOARD_REPORT_ADAPTER_KINDS = Object.freeze([
  "dashboard.summary",
  "dashboard.kpiTable",
  "dashboard.compare",
  "dashboard.timeline",
  "dashboard.composition",
  "dashboard.dimensions",
  "dashboard.geoMap",
  "dashboard.status",
  "dashboard.filters",
  "dashboard.feed",
  "dashboard.table",
  "dashboard.report",
  "dashboard.detail",
  "dashboard.messages",
  "dashboard.badges",
]);

export const DASHBOARD_REPORT_ADAPTER_OUTPUT_KINDS = Object.freeze([
  "markdownBlock",
  "filterBarBlock",
  "kpiBlock",
  "badgesBlock",
  "chartBlock",
  "tableBlock",
  "geoMapBlock",
  "sectionBlock",
  "compositeBlock",
  "infoPanelBlock",
  "calloutBlock",
  "timelineBlock",
  "collectionBlock",
]);

function normalizeString(value = "") {
  return String(value || "").trim();
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function sanitizeId(value = "") {
  return normalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function humanizeLabel(value = "") {
  const normalized = normalizeString(value);
  if (!normalized) {
    return "";
  }
  return normalized
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((segment) => segment.slice(0, 1).toUpperCase() + segment.slice(1))
    .join(" ");
}

function extractForgeUiJsonBlocks(text = "") {
  const source = String(text || "");
  return [...source.matchAll(/```forge-ui\s*([\s\S]*?)```/g)]
    .map((match) => normalizeString(match?.[1] || ""))
    .filter(Boolean);
}

function nestedConfig(block = {}, key = "") {
  const nested = block?.dashboard?.[key];
  return nested && typeof nested === "object" && !Array.isArray(nested) ? nested : {};
}

function listValue(...candidates) {
  return candidates.find((candidate) => Array.isArray(candidate)) || [];
}

function objectValue(...candidates) {
  return candidates.find((candidate) => candidate && typeof candidate === "object" && !Array.isArray(candidate)) || {};
}

function datasetRef(block = {}) {
  return normalizeString(block?.dataSourceRef || block?.dataSource || "primary") || "primary";
}

function clampSpan(value = 12) {
  const numeric = Math.trunc(Number(value));
  return Number.isFinite(numeric) ? Math.max(1, Math.min(12, numeric)) : 12;
}

function layoutItem(blockId = "", span = 12) {
  const normalizedSpan = clampSpan(span);
  return normalizedSpan === 12 ? { blockId } : { blockId, span: normalizedSpan };
}

function sourcePrefix(block = {}, index = 0, parentPrefix = "") {
  const candidate = sanitizeId(block?.id || block?.title || `${block?.kind || "block"}_${index + 1}`) || `block_${index + 1}`;
  return parentPrefix ? `${parentPrefix}_${candidate}` : candidate;
}

function resolveField(entry = {}, ...fallbackKeys) {
  const keys = ["selector", "field", "key", "valueField", ...fallbackKeys];
  return keys.map((key) => normalizeString(entry?.[key])).find(Boolean) || "";
}

function normalizeFormat(format = "") {
  const value = normalizeString(format);
  if (value === "compactNumber") return "compact";
  return value;
}

function normalizeScalarString(value = "") {
  return typeof value === "string" || typeof value === "number"
    ? normalizeString(value)
    : "";
}

function normalizeChartType(type = "line") {
  const value = normalizeString(type).toLowerCase().replace(/-/g, "_");
  if (value === "horizontalbar" || value === "horizontal_bar_chart") return "horizontal_bar";
  if (value === "doughnut") return "donut";
  return value || "line";
}

function addFieldHint(target, sourceRef, field, kind) {
  const normalizedField = normalizeString(field);
  if (!normalizedField) return;
  target[sourceRef] = target[sourceRef] || {};
  target[sourceRef][normalizedField] = kind;
}

function mergeFieldHints(projections = []) {
  return projections.reduce((result, projection) => {
    Object.entries(projection?.datasetFieldHints || {}).forEach(([sourceRef, hints]) => {
      result[sourceRef] = { ...(result[sourceRef] || {}), ...(hints || {}) };
    });
    return result;
  }, {});
}

function commonProjectionMetadata(block = {}, prefix = "") {
  const interactions = {
    sourceBlockId: normalizeString(block?.id || prefix) || prefix,
    sourceKind: normalizeString(block?.kind),
    ...(block?.filterBindings ? { filterBindings: cloneValue(block.filterBindings) } : {}),
    ...(block?.selectionBindings ? { selectionBindings: cloneValue(block.selectionBindings) } : {}),
    ...(block?.visibleWhen ? { visibleWhen: cloneValue(block.visibleWhen) } : {}),
    ...(Array.isArray(block?.on) && block.on.length > 0 ? { actions: cloneValue(block.on) } : {}),
  };
  const hasInteractions = Object.keys(interactions).length > 2;
  const runtime = {
    ...(block?.filterBindings ? { filterBindings: cloneValue(block.filterBindings) } : {}),
    ...(block?.selectionBindings ? { selectionBindings: cloneValue(block.selectionBindings) } : {}),
    ...(block?.visibleWhen ? { visibleWhen: cloneValue(block.visibleWhen) } : {}),
    ...(Array.isArray(block?.on) && block.on.length > 0 ? {
      actions: block.on.map((action) => {
        const handler = normalizeString(action?.handler);
        const event = normalizeString(action?.event || "onSelect") || "onSelect";
        const args = objectValue(action?.arguments, action?.args);
        if (handler === "dashboardSelect") {
          return {
            id: normalizeString(action?.id || `${prefix}_${event}_select`) || `${prefix}_${event}_select`,
            event,
            kind: "select",
            label: normalizeString(action?.label || "Select"),
            dimension: normalizeString(args?.dimension),
          };
        }
        return {
          id: normalizeString(action?.id || `${prefix}_${event}_${handler || "action"}`) || `${prefix}_${event}_action`,
          event,
          kind: "host",
          label: normalizeString(action?.label || handler || "Action"),
          handler,
          arguments: cloneValue(args),
        };
      }),
    } : {}),
  };
  return {
    dataSourceRefs: [datasetRef(block)],
    interactionBindings: hasInteractions ? [interactions] : [],
    runtime: Object.keys(runtime).length > 0 ? runtime : null,
    diagnostics: [],
  };
}

function projection(blocks = [], layoutItems = [], metadata = {}) {
  const runtime = metadata?.runtime && typeof metadata.runtime === "object" && !Array.isArray(metadata.runtime)
    ? cloneValue(metadata.runtime)
    : null;
  return {
    blocks: blocks.filter(Boolean).map((block) => runtime ? { ...block, runtime } : block),
    layoutItems: layoutItems.filter(Boolean),
    datasetFieldHints: metadata.datasetFieldHints || {},
    dataSourceRefs: metadata.dataSourceRefs || [],
    filterDefinitions: metadata.filterDefinitions || [],
    interactionBindings: metadata.interactionBindings || [],
    diagnostics: metadata.diagnostics || [],
  };
}

function buildSummaryProjection(block, prefix) {
  const config = nestedConfig(block, "summary");
  const metrics = listValue(config.items, config.metrics, block.items, block.metrics);
  const ref = datasetRef(block);
  const span = clampSpan(block?.columnSpan);
  const blocks = [];
  const items = [];
  const hints = {};
  metrics.forEach((metric, index) => {
    const field = resolveField(metric);
    if (!field) return;
    const id = `${prefix}_metric_${sanitizeId(metric?.id || field) || index + 1}`;
    const secondaryField = normalizeString(metric?.secondarySelector || metric?.secondaryField || metric?.secondaryKey || metric?.secondaryValueField);
    blocks.push({
      id,
      kind: "kpiBlock",
      title: normalizeString(metric?.label || humanizeLabel(field) || "Metric"),
      datasetRef: ref,
      valueField: field,
      valueLabel: normalizeString(metric?.label || humanizeLabel(field) || field),
      ...(normalizeFormat(metric?.format) ? { valueFormat: normalizeFormat(metric.format) } : {}),
      ...(secondaryField ? {
        secondaryField,
        secondaryLabel: normalizeString(metric?.secondaryLabel || humanizeLabel(secondaryField)),
        ...(normalizeFormat(metric?.secondaryFormat || metric?.format) ? { secondaryFormat: normalizeFormat(metric?.secondaryFormat || metric?.format) } : {}),
      } : {}),
      ...(normalizeString(metric?.tone) ? { tone: normalizeString(metric.tone) } : {}),
      emptyLabel: `No ${normalizeString(metric?.label || humanizeLabel(field) || "metric").toLowerCase()} value available.`,
    });
    items.push(layoutItem(id, metrics.length > 1 ? Math.max(3, Math.floor(span / Math.min(metrics.length, 4))) : span));
    addFieldHint(hints, ref, field, "measure");
    addFieldHint(hints, ref, secondaryField, "measure");
  });
  const metadata = commonProjectionMetadata(block, prefix);
  return projection(blocks, items, { ...metadata, datasetFieldHints: hints });
}

function normalizeTableColumns(columns = []) {
  return (Array.isArray(columns) ? columns : []).map((column) => {
    if (typeof column === "string") {
      return { key: column, label: humanizeLabel(column) || column };
    }
    const key = normalizeString(column?.key || column?.field || column?.id);
    if (!key) return null;
    return {
      key,
      label: normalizeString(column?.label || humanizeLabel(key) || key),
      ...(normalizeFormat(column?.format) ? { format: normalizeFormat(column.format) } : {}),
      ...(column?.cellVisual ? { cellVisual: cloneValue(column.cellVisual) } : {}),
    };
  }).filter(Boolean);
}

function buildTableProjection(block, prefix, key = "table") {
  const config = nestedConfig(block, key);
  const columns = normalizeTableColumns(listValue(config.columns, block.columns));
  if (columns.length === 0) return projection();
  const ref = datasetRef(block);
  const id = `${prefix}_table`;
  const hints = {};
  columns.forEach((column, index) => addFieldHint(hints, ref, column.key, index === 0 ? "dimension" : "measure"));
  const metadata = commonProjectionMetadata(block, prefix);
  return projection([{
    id,
    kind: "tableBlock",
    title: normalizeString(block?.title || "Table") || "Table",
    datasetRef: ref,
    columns,
    ...(Array.isArray(block?.formattingRules) ? { formattingRules: cloneValue(block.formattingRules) } : {}),
  }], [layoutItem(id, block?.columnSpan)], { ...metadata, datasetFieldHints: hints });
}

function buildKpiTableProjection(block, prefix) {
  const directTable = buildTableProjection(block, prefix, "kpiTable");
  if (directTable.blocks.length > 0) return directTable;
  const config = nestedConfig(block, "kpiTable");
  const rows = listValue(config.rows, block.rows);
  const ref = datasetRef(block);
  const hints = {};
  const blocks = rows.map((row, index) => {
    const field = normalizeString(row?.value || row?.selector || row?.field || row?.key);
    if (!field) return null;
    addFieldHint(hints, ref, field, "measure");
    return {
      id: `${prefix}_row_${sanitizeId(row?.id || field) || index + 1}`,
      kind: "kpiBlock",
      title: normalizeString(row?.label || humanizeLabel(field)),
      datasetRef: ref,
      valueField: field,
      valueLabel: normalizeString(row?.label || humanizeLabel(field)),
      ...(normalizeFormat(row?.format) ? { valueFormat: normalizeFormat(row.format) } : {}),
      ...(normalizeString(row?.context) ? { description: normalizeString(row.context) } : {}),
      ...(normalizeString(row?.contextTone) ? { tone: normalizeString(row.contextTone) } : {}),
    };
  }).filter(Boolean);
  const metadata = commonProjectionMetadata(block, prefix);
  return projection(blocks, blocks.map((entry) => layoutItem(entry.id, 6)), { ...metadata, datasetFieldHints: hints });
}

function buildCompareProjection(block, prefix) {
  const config = nestedConfig(block, "compare");
  const rows = listValue(config.items, block.items);
  const ref = datasetRef(block);
  const hints = {};
  const blocks = rows.map((item, index) => {
    const current = normalizeString(item?.current || item?.currentField);
    const previous = normalizeString(item?.previous || item?.previousField);
    if (!current) return null;
    addFieldHint(hints, ref, current, "measure");
    addFieldHint(hints, ref, previous, "measure");
    return {
      id: `${prefix}_compare_${sanitizeId(item?.id || current) || index + 1}`,
      kind: "kpiBlock",
      title: normalizeString(item?.label || humanizeLabel(current)),
      datasetRef: ref,
      valueField: current,
      valueLabel: normalizeString(item?.currentLabel || item?.label || "Current"),
      ...(normalizeFormat(item?.format) ? { valueFormat: normalizeFormat(item.format) } : {}),
      ...(previous ? {
        secondaryField: previous,
        secondaryLabel: normalizeString(item?.previousLabel || item?.deltaLabel || "Previous"),
        ...(normalizeFormat(item?.format) ? { secondaryFormat: normalizeFormat(item.format) } : {}),
      } : {}),
      ...(item?.positiveIsUp === false ? { tone: "warning" } : {}),
    };
  }).filter(Boolean);
  const metadata = commonProjectionMetadata(block, prefix);
  return projection(blocks, blocks.map((entry) => layoutItem(entry.id, 6)), { ...metadata, datasetFieldHints: hints });
}

function chartFields(block = {}, kind = "timeline") {
  const config = nestedConfig(block, kind);
  const chart = objectValue(config.chart, block.chart);
  const mapping = objectValue(block.mapping);
  const series = objectValue(chart.series);
  const xField = normalizeString(chart?.xAxis?.dataKey || chart?.categoryField || mapping?.dateColumn || block?.categoryKey || chart?.categoryKey || series?.nameKey);
  const configuredValues = listValue(series.values).map((entry) => normalizeString(entry?.value || entry?.key)).filter(Boolean);
  const yFields = configuredValues.length > 0
    ? configuredValues
    : [normalizeString(series?.valueKey || chart?.valueField || block?.valueKey || "value")].filter(Boolean);
  const seriesField = normalizeString(series?.nameKey || chart?.seriesField || (Array.isArray(mapping?.seriesColumns) ? mapping.seriesColumns[0] : ""));
  return { chart, xField, yFields, seriesField };
}

function buildChartProjection(block, prefix, kind = "timeline") {
  const ref = datasetRef(block);
  const { chart, xField, yFields, seriesField } = chartFields(block, kind);
  if (!xField || yFields.length === 0) return projection();
  const id = `${prefix}_chart`;
  const hints = {};
  addFieldHint(hints, ref, xField, "dimension");
  addFieldHint(hints, ref, seriesField, "dimension");
  yFields.forEach((field) => addFieldHint(hints, ref, field, "measure"));
  const metadata = commonProjectionMetadata(block, prefix);
  return projection([{
    id,
    kind: "chartBlock",
    title: normalizeString(block?.title || chart?.title || "Chart") || "Chart",
    datasetRef: ref,
    chartSpec: {
      title: normalizeString(block?.title || chart?.title || "Chart") || "Chart",
      type: normalizeChartType(chart?.type || (kind === "composition" ? "donut" : "line")),
      xField,
      yFields,
      ...(seriesField && seriesField !== xField ? { seriesField } : {}),
    },
  }], [layoutItem(id, block?.columnSpan)], { ...metadata, datasetFieldHints: hints });
}

function buildDimensionsProjection(block, prefix) {
  const config = nestedConfig(block, "dimensions");
  const dimension = objectValue(config.dimension, block.dimension);
  const metric = objectValue(config.metric, block.metric);
  const xField = resolveField(dimension);
  const yField = resolveField(metric);
  if (!xField || !yField) return projection();
  const chartBlock = {
    ...block,
    chart: { type: "horizontal_bar", xAxis: { dataKey: xField }, series: { valueKey: yField } },
  };
  return buildChartProjection(chartBlock, prefix, "dimensions");
}

function buildCompositionProjection(block, prefix) {
  const chart = objectValue(nestedConfig(block, "composition").chart, block.chart);
  const normalized = {
    ...block,
    chart: {
      ...chart,
      type: chart.type || block.type || "donut",
      categoryField: chart.categoryKey || chart.nameKey || block.categoryKey || chart.series?.nameKey || "name",
      valueField: chart.valueKey || block.valueKey || chart.series?.valueKey || "value",
    },
  };
  return buildChartProjection(normalized, prefix, "composition");
}

function buildGeoProjection(block, prefix) {
  const geo = objectValue(nestedConfig(block, "geo"), block.geo);
  const key = normalizeString(geo?.key || geo?.dimension || geo?.regionKey || "state");
  const metric = objectValue(geo?.metric);
  const metricKey = normalizeString(metric?.key || geo?.valueKey || block?.metric?.key || "value");
  const ref = datasetRef(block);
  const id = `${prefix}_geo`;
  const hints = {};
  addFieldHint(hints, ref, key, "dimension");
  addFieldHint(hints, ref, geo?.labelKey, "dimension");
  addFieldHint(hints, ref, metricKey, "measure");
  const metadata = commonProjectionMetadata(block, prefix);
  return projection([{
    id,
    kind: "geoMapBlock",
    title: normalizeString(block?.title || "Geo Map"),
    datasetRef: ref,
    geo: {
      ...cloneValue(geo),
      key,
      metric: {
        ...cloneValue(metric),
        key: metricKey,
        label: normalizeString(metric?.label || geo?.metricLabel || humanizeLabel(metricKey)),
        ...(normalizeFormat(metric?.format || geo?.format) ? { format: normalizeFormat(metric?.format || geo?.format) } : {}),
      },
    },
  }], [layoutItem(id, block?.columnSpan)], { ...metadata, datasetFieldHints: hints });
}

function buildStatusProjection(block, prefix) {
  const config = nestedConfig(block, "status");
  const checks = listValue(config.checks, block.checks);
  const ref = datasetRef(block);
  const hints = {};
  const blocks = checks.map((check, index) => {
    const field = resolveField(check);
    if (!field) return null;
    addFieldHint(hints, ref, field, "measure");
    return {
      id: `${prefix}_status_${sanitizeId(check?.id || field) || index + 1}`,
      kind: "kpiBlock",
      title: normalizeString(check?.label || humanizeLabel(field)),
      datasetRef: ref,
      valueField: field,
      valueLabel: normalizeString(check?.label || humanizeLabel(field)),
      ...(normalizeFormat(check?.format) ? { valueFormat: normalizeFormat(check.format) } : {}),
      ...(normalizeScalarString(check?.tone) ? { tone: normalizeScalarString(check.tone) } : {}),
    };
  }).filter(Boolean);
  const metadata = commonProjectionMetadata(block, prefix);
  return projection(blocks, blocks.map((entry) => layoutItem(entry.id, 6)), { ...metadata, datasetFieldHints: hints });
}

function buildFiltersProjection(block, prefix) {
  const config = nestedConfig(block, "filters");
  const definitions = listValue(config.items, block.items).map((item) => ({
    id: normalizeString(item?.id || item?.field),
    field: normalizeString(item?.field || item?.id),
    label: normalizeString(item?.label || humanizeLabel(item?.field || item?.id)),
    type: normalizeString(item?.type || (item?.multiple ? "multiSelect" : "select")),
    multiple: item?.multiple === true,
    collapsed: item?.collapsed === true,
    options: cloneValue(Array.isArray(item?.options) ? item.options : []),
    ...(item?.default != null ? { default: cloneValue(item.default) } : {}),
    ...(normalizeString(item?.paramPath) ? { paramPath: normalizeString(item.paramPath) } : {}),
    ...(normalizeString(item?.startParamPath) ? { startParamPath: normalizeString(item.startParamPath) } : {}),
    ...(normalizeString(item?.endParamPath) ? { endParamPath: normalizeString(item.endParamPath) } : {}),
  })).filter((item) => item.id && item.field);
  const id = `${prefix}_filters`;
  const paramIds = definitions.map((item) => item.field);
  const metadata = commonProjectionMetadata(block, prefix);
  return projection([{
    id,
    kind: "filterBarBlock",
    title: normalizeString(block?.title || "Filters") || "Filters",
    datasetRef: datasetRef(block),
    mode: normalizeString(config?.mode || block?.mode || "baseline"),
    placement: normalizeString(config?.placement || block?.placement || "inline"),
    paramIds,
    groupOrder: paramIds,
    visibleGroups: paramIds,
    collapsedGroups: definitions.filter((item) => item?.collapsed === true).map((item) => item.field),
  }], [layoutItem(id, block?.columnSpan)], { ...metadata, filterDefinitions: definitions });
}

function buildFeedProjection(block, prefix) {
  const config = nestedConfig(block, "feed");
  const fields = objectValue(config.fields, block.fields);
  const id = `${prefix}_feed`;
  const ref = datasetRef(block);
  const titleField = normalizeString(fields?.title);
  const bodyField = normalizeString(fields?.body);
  const timestampField = normalizeString(fields?.timestamp);
  const hints = {};
  addFieldHint(hints, ref, titleField, "dimension");
  addFieldHint(hints, ref, bodyField, "dimension");
  addFieldHint(hints, ref, timestampField, "dimension");
  const metadata = commonProjectionMetadata(block, prefix);
  return projection([{
    id,
    kind: "collectionBlock",
    title: normalizeString(block?.title || "Feed"),
    datasetRef: ref,
    itemTitleField: titleField,
    ...(timestampField ? { secondaryField: timestampField, secondaryLabel: "Time" } : {}),
    bodyTemplate: bodyField ? `\${row.${bodyField}}` : "",
    layout: "list",
    columns: 1,
    rowLimit: Number(config?.limit || block?.limit || 20),
  }], [layoutItem(id, block?.columnSpan)], { ...metadata, datasetFieldHints: hints });
}

function buildMessagesProjection(block, prefix) {
  const config = nestedConfig(block, "messages");
  const messages = listValue(config.items, block.items, block.messages);
  const metadata = commonProjectionMetadata(block, prefix);
  const blocks = messages.map((message, index) => {
    const source = typeof message === "string" ? { body: message } : message;
    const messageRuntime = {
      ...(metadata?.runtime || {}),
      ...(source?.visibleWhen ? { visibleWhen: cloneValue(source.visibleWhen) } : {}),
    };
    return {
      id: `${prefix}_message_${sanitizeId(source?.id || source?.title) || index + 1}`,
      kind: "calloutBlock",
      title: normalizeString(source?.title || `${block?.title || "Message"} ${index + 1}`),
      tone: normalizeString(source?.severity || source?.tone || "info"),
      body: String(source?.body || source?.text || (source?.field ? `\${row.${source.field}}` : "")),
      ...(Object.keys(messageRuntime).length > 0 ? { runtime: messageRuntime } : {}),
    };
  });
  return projection(blocks, blocks.map((entry) => layoutItem(entry.id, block?.columnSpan)), {
    ...metadata,
    runtime: null,
  });
}

function buildBadgesProjection(block, prefix) {
  const config = nestedConfig(block, "badges");
  const items = listValue(config.items, block.items).map((item, index) => ({
    id: normalizeString(item?.id || `${prefix}_badge_${index + 1}`),
    ...(normalizeString(item?.label) ? { label: normalizeString(item.label) } : {}),
    ...(normalizeString(item?.value) ? { value: normalizeString(item.value) } : {}),
    ...(normalizeString(item?.valueField || item?.selector || item?.field) ? { valueField: normalizeString(item?.valueField || item?.selector || item?.field) } : {}),
    ...(normalizeFormat(item?.format) ? { format: normalizeFormat(item.format) } : {}),
    ...(normalizeString(item?.tone || item?.severity) ? { tone: normalizeString(item?.tone || item?.severity) } : {}),
    ...(Array.isArray(item?.rules) ? { rules: cloneValue(item.rules) } : {}),
  })).filter((item) => item.label || item.value || item.valueField);
  const id = `${prefix}_badges`;
  const metadata = commonProjectionMetadata(block, prefix);
  return projection([{
    id,
    kind: "badgesBlock",
    title: normalizeString(block?.title || "Status Pills"),
    datasetRef: datasetRef(block),
    items,
  }], [layoutItem(id, block?.columnSpan)], metadata);
}

function buildReportProjection(block, prefix) {
  const config = nestedConfig(block, "report");
  const sections = listValue(config.sections, block.sections);
  const metadata = commonProjectionMetadata(block, prefix);
  const blocks = sections.map((section, index) => {
    const body = Array.isArray(section?.body) ? section.body.join("\n\n") : String(section?.body || "");
    return {
      id: `${prefix}_section_${sanitizeId(section?.id || section?.title) || index + 1}`,
      kind: normalizeString(section?.tone) ? "calloutBlock" : "markdownBlock",
      title: normalizeString(section?.title || (sections.length === 1 ? block?.title : `Section ${index + 1}`)),
      ...(normalizeString(section?.tone) ? { tone: normalizeString(section.tone), body } : { markdown: body }),
      ...(datasetRef(block) ? { datasetRef: datasetRef(block) } : {}),
    };
  });
  return projection(blocks, blocks.map((entry) => layoutItem(entry.id, block?.columnSpan)), metadata);
}

function buildDetailProjection(block, prefix, index) {
  const children = listValue(block?.containers, nestedConfig(block, "detail")?.containers);
  const childProjections = children.map((child, childIndex) => buildBlockProjection(child, childIndex, prefix));
  const childBlocks = childProjections.flatMap((entry) => entry.blocks);
  const childIds = childProjections.flatMap((entry) => entry.layoutItems.map((item) => item.blockId));
  const compositeId = `${prefix}_detail`;
  const metadata = commonProjectionMetadata(block, prefix);
  return projection([
    ...childBlocks,
    {
      id: compositeId,
      kind: "compositeBlock",
      title: normalizeString(block?.title || "Detail"),
      description: normalizeString(block?.subtitle),
      childBlockIds: childIds,
    },
  ], [layoutItem(compositeId, block?.columnSpan)], {
    ...metadata,
    datasetFieldHints: mergeFieldHints(childProjections),
    dataSourceRefs: [...metadata.dataSourceRefs, ...childProjections.flatMap((entry) => entry.dataSourceRefs)],
    filterDefinitions: childProjections.flatMap((entry) => entry.filterDefinitions),
    interactionBindings: [...metadata.interactionBindings, ...childProjections.flatMap((entry) => entry.interactionBindings)],
    diagnostics: childProjections.flatMap((entry) => entry.diagnostics),
  });
}

function buildBlockProjection(block = {}, index = 0, parentPrefix = "") {
  const kind = normalizeString(block?.kind);
  const prefix = sourcePrefix(block, index, parentPrefix);
  switch (kind) {
    case "dashboard.summary": return buildSummaryProjection(block, prefix);
    case "dashboard.kpiTable": return buildKpiTableProjection(block, prefix);
    case "dashboard.compare": return buildCompareProjection(block, prefix);
    case "dashboard.timeline": return buildChartProjection(block, prefix, "timeline");
    case "dashboard.composition": return buildCompositionProjection(block, prefix);
    case "dashboard.dimensions": return buildDimensionsProjection(block, prefix);
    case "dashboard.geoMap": return buildGeoProjection(block, prefix);
    case "dashboard.status": return buildStatusProjection(block, prefix);
    case "dashboard.filters": return buildFiltersProjection(block, prefix);
    case "dashboard.feed": return buildFeedProjection(block, prefix);
    case "dashboard.table": return buildTableProjection(block, prefix);
    case "dashboard.report": return buildReportProjection(block, prefix);
    case "dashboard.detail": return buildDetailProjection(block, prefix, index);
    case "dashboard.messages": return buildMessagesProjection(block, prefix);
    case "dashboard.badges": return buildBadgesProjection(block, prefix);
    default:
      return projection([], [], {
        diagnostics: [{
          severity: "error",
          code: "dashboardAdapterUnsupportedKind",
          sourceBlockId: normalizeString(block?.id || prefix),
          sourceKind: kind || "unknown",
          message: `Dashboard block kind '${kind || "unknown"}' cannot be adapted to a report block.`,
        }],
      });
  }
}

function dedupeStrings(values = []) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map(normalizeString).filter(Boolean)));
}

function normalizeDashboardDataSourceDeclarations(dashboard = {}, dataSourceRefs = [], datasetFieldHints = {}) {
  const declared = [dashboard?.datasets, dashboard?.dataSources].flatMap((value) => {
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") {
      return Object.entries(value).map(([id, entry]) => ({ id, ...(entry && typeof entry === "object" ? cloneValue(entry) : {}) }));
    }
    return [];
  });
  const index = new Map();
  declared.forEach((entry) => {
    const id = normalizeString(entry?.id || entry?.dataSourceRef);
    const ref = normalizeString(entry?.dataSourceRef || entry?.id);
    if (id && !index.has(id)) index.set(id, entry);
    if (ref && !index.has(ref)) index.set(ref, entry);
  });
  return dedupeStrings(dataSourceRefs).map((ref) => {
    const source = cloneValue(index.get(ref) || {});
    const hints = datasetFieldHints?.[ref] || {};
    const hintedDimensions = Object.entries(hints).filter(([, kind]) => kind === "dimension").map(([key]) => ({ key, label: humanizeLabel(key) }));
    const hintedMeasures = Object.entries(hints).filter(([, kind]) => kind === "measure").map(([key]) => ({ key, label: humanizeLabel(key) }));
    return {
      ...source,
      id: normalizeString(source?.id || ref) || ref,
      dataSourceRef: normalizeString(source?.dataSourceRef || ref) || ref,
      label: normalizeString(source?.label || humanizeLabel(ref) || ref),
      ...(Array.isArray(source?.dimensions) && source.dimensions.length > 0 ? {} : { dimensions: hintedDimensions }),
      ...(Array.isArray(source?.measures) && source.measures.length > 0 ? {} : { measures: hintedMeasures }),
    };
  });
}

export function adaptDashboardToReportDocument(dashboard = {}, { fileName = "" } = {}) {
  if (!dashboard || typeof dashboard !== "object" || Array.isArray(dashboard)) {
    throw new Error("The dashboard definition must be a JSON object.");
  }
  const sourceBlocks = listValue(dashboard?.blocks, dashboard?.containers);
  const projections = sourceBlocks.map((block, index) => buildBlockProjection(block, index));
  const rawBlocks = projections.flatMap((entry) => entry.blocks);
  const blocks = normalizeReportBuilderDocumentBlocks(rawBlocks);
  const droppedBlockIds = rawBlocks
    .map((block) => normalizeString(block?.id))
    .filter((id) => id && !blocks.some((block) => normalizeString(block?.id) === id));
  const diagnostics = [
    ...projections.flatMap((entry) => entry.diagnostics),
    ...projections.flatMap((entry, index) => {
      const sourceBlock = sourceBlocks[index] || {};
      const sourceKind = normalizeString(sourceBlock?.kind);
      if (entry.blocks.length > 0 || !DASHBOARD_REPORT_ADAPTER_KINDS.includes(sourceKind)) {
        return [];
      }
      return [{
        severity: "error",
        code: "dashboardAdapterInvalidSourceBlock",
        sourceBlockId: normalizeString(sourceBlock?.id || sourcePrefix(sourceBlock, index)),
        sourceKind,
        message: `Dashboard block '${sourceBlock?.title || sourceBlock?.id || sourceKind}' is missing fields required for report conversion.`,
        suggestedFix: "Add the required datasource fields to the dashboard block and import it again.",
      }];
    }),
    ...droppedBlockIds.map((id) => ({
      severity: "error",
      code: "dashboardAdapterNormalizationDroppedBlock",
      sourceBlockId: id,
      message: `Adapted block '${id}' was rejected by ReportDocument normalization.`,
    })),
  ];
  const unsupportedKinds = dedupeStrings(
    diagnostics.filter((entry) => entry.code === "dashboardAdapterUnsupportedKind").map((entry) => entry.sourceKind),
  );
  if (blocks.length === 0) {
    throw new Error("The dashboard definition does not contain any adaptable dashboard blocks.");
  }
  const title = normalizeString(dashboard?.title || humanizeLabel(normalizeString(fileName).replace(/\.[^.]+$/, "")) || "Imported report") || "Imported report";
  const datasetFieldHints = mergeFieldHints(projections);
  const dataSourceRefs = dedupeStrings(projections.flatMap((entry) => entry.dataSourceRefs));
  return {
    id: sanitizeId(`${title}_imported`) || "imported_report",
    label: title,
    title,
    subtitle: normalizeString(dashboard?.subtitle),
    description: normalizeString(dashboard?.description),
    blocks,
    layout: {
      type: "grid",
      columns: 12,
      items: [
        { blockId: "primaryBuilder" },
        ...projections.flatMap((entry) => entry.layoutItems),
      ],
    },
    datasetFieldHints,
    dataSourceRefs,
    dataSources: normalizeDashboardDataSourceDeclarations(dashboard, dataSourceRefs, datasetFieldHints),
    filterDefinitions: projections.flatMap((entry) => entry.filterDefinitions),
    interactionBindings: projections.flatMap((entry) => entry.interactionBindings),
    diagnostics,
    unsupportedKinds,
    source: {
      kind: "forgeDashboard",
      version: dashboard?.version || 1,
      blockCount: sourceBlocks.length,
      adaptedBlockCount: blocks.length,
    },
  };
}

export function applyDashboardReportAdapterConfig(config = {}, state = {}) {
  const baseConfig = config && typeof config === "object" && !Array.isArray(config) ? cloneValue(config) : {};
  const definitions = Array.isArray(state?.reportDashboardAdapter?.filterDefinitions)
    ? state.reportDashboardAdapter.filterDefinitions
    : [];
  const adapterSources = Array.isArray(state?.reportDashboardAdapter?.dataSources)
    ? cloneValue(state.reportDashboardAdapter.dataSources)
    : [];
  const existingSources = [
    ...(Array.isArray(baseConfig?.datasets) ? baseConfig.datasets : []),
    ...(Array.isArray(baseConfig?.dataSources) ? baseConfig.dataSources : []),
  ];
  const existingSourceIds = new Set(existingSources.flatMap((source) => [
    normalizeString(source?.id),
    normalizeString(source?.dataSourceRef),
  ]).filter(Boolean));
  const importedSources = adapterSources.filter((source) => {
    const id = normalizeString(source?.id);
    const ref = normalizeString(source?.dataSourceRef);
    if ((id && existingSourceIds.has(id)) || (ref && existingSourceIds.has(ref))) return false;
    if (id) existingSourceIds.add(id);
    if (ref) existingSourceIds.add(ref);
    return id || ref;
  });
  const configWithSources = importedSources.length > 0
    ? { ...baseConfig, dataSources: [...(Array.isArray(baseConfig?.dataSources) ? baseConfig.dataSources : []), ...importedSources] }
    : baseConfig;
  if (definitions.length === 0) return configWithSources;
  const existingFilters = Array.isArray(configWithSources?.staticFilters) ? cloneValue(configWithSources.staticFilters) : [];
  const existingIds = new Set(existingFilters.map((filter) => normalizeString(filter?.id || filter?.field)).filter(Boolean));
  const importedFilters = definitions.map((definition) => {
    const id = normalizeString(definition?.id || definition?.field);
    const field = normalizeString(definition?.field || definition?.id);
    if (!id || !field || existingIds.has(id)) return null;
    existingIds.add(id);
    const options = Array.isArray(definition?.options) ? cloneValue(definition.options) : [];
    const optionDefaults = options.filter((option) => option?.default === true).map((option) => cloneValue(option.value));
    const defaultValue = definition?.default != null
      ? cloneValue(definition.default)
      : (definition?.multiple === true ? optionDefaults : optionDefaults[0]);
    return {
      id,
      field,
      label: normalizeString(definition?.label || humanizeLabel(field)),
      type: normalizeString(definition?.type || (definition?.multiple ? "multiSelect" : "select")),
      multiple: definition?.multiple === true,
      ...(normalizeString(definition?.paramPath) ? { paramPath: normalizeString(definition.paramPath) } : {}),
      ...(normalizeString(definition?.type).toLowerCase() === "daterange" ? {
        startParamPath: normalizeString(definition?.startParamPath || (field === "dateRange" ? "filters.from" : `filters.${field}.start`)),
        endParamPath: normalizeString(definition?.endParamPath || (field === "dateRange" ? "filters.to" : `filters.${field}.end`)),
      } : {}),
      ...(options.length > 0 ? { options } : {}),
      ...(defaultValue != null ? { default: defaultValue } : {}),
    };
  }).filter(Boolean);
  return {
    ...configWithSources,
    staticFilters: [...existingFilters, ...importedFilters],
  };
}

export function buildReportBuilderImportedStarterFromJsonFile({
  fileName = "",
  json = "",
} = {}) {
  const forgeUiBlocks = extractForgeUiJsonBlocks(json);
  if (forgeUiBlocks.length === 0) return null;
  if (forgeUiBlocks.length > 1) {
    throw new Error("The imported JSON file contains multiple forge-ui report definitions. Import one report blueprint at a time.");
  }
  return adaptDashboardToReportDocument(JSON.parse(forgeUiBlocks[0]), { fileName });
}
