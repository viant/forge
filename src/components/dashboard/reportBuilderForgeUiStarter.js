import { normalizeReportBuilderDocumentBlocks } from "../../reporting/reportDocumentModel.js";

function normalizeString(value = "") {
  return String(value || "").trim();
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
  const matches = [...source.matchAll(/```forge-ui\s*([\s\S]*?)```/g)];
  return matches.map((match) => normalizeString(match?.[1] || "")).filter(Boolean);
}

function buildSectionMarkdown(paragraphs = []) {
  const body = (Array.isArray(paragraphs) ? paragraphs : [])
    .map((entry) => normalizeString(entry))
    .filter(Boolean);
  return body.join("\n");
}

function buildMessageMarkdown(title = "", items = []) {
  const lines = (Array.isArray(items) ? items : [])
    .map((item) => {
      const label = normalizeString(item?.title);
      const body = normalizeString(item?.body);
      if (!label && !body) {
        return "";
      }
      return label && body ? `${label}: ${body}` : (label || body);
    })
    .filter(Boolean);
  return lines.join("\n");
}

function buildForgeUiDashboardSummaryBlocks(block = {}, prefix = "") {
  const blockTitle = normalizeString(block?.title || "Summary");
  const metrics = Array.isArray(block?.metrics) ? block.metrics : [];
  const sectionId = `${prefix}_section`;
  const authoredBlocks = [
    {
      id: sectionId,
      kind: "markdownBlock",
      title: blockTitle,
      markdown: "",
    },
  ];
  const layoutItems = [
    { blockId: sectionId },
  ];
  metrics.forEach((metric, index) => {
    const field = normalizeString(metric?.field);
    if (!field) {
      return;
    }
    const metricId = `${prefix}_metric_${sanitizeId(field || String(index + 1)) || index + 1}`;
    authoredBlocks.push({
      id: metricId,
      kind: "kpiBlock",
      title: normalizeString(metric?.label || humanizeLabel(field) || "Metric"),
      datasetRef: normalizeString(block?.dataSourceRef || "primary") || "primary",
      valueField: field,
      valueLabel: normalizeString(metric?.label || humanizeLabel(field) || field),
      ...(normalizeString(metric?.tone) ? { tone: normalizeString(metric.tone) } : {}),
      emptyLabel: `No ${normalizeString(metric?.label || humanizeLabel(field) || "metric").toLowerCase()} value available.`,
    });
    layoutItems.push({ blockId: metricId, size: "half" });
  });
  return {
    blocks: authoredBlocks,
    layoutItems,
    datasetFieldHints: {},
  };
}

function buildForgeUiDashboardTableBlock(block = {}, prefix = "") {
  const columns = (Array.isArray(block?.columns) ? block.columns : [])
    .map((column) => {
      const key = normalizeString(column?.key);
      if (!key) {
        return null;
      }
      return {
        key,
        label: normalizeString(column?.label || humanizeLabel(key) || key),
        ...(normalizeString(column?.format) ? { format: normalizeString(column.format) } : {}),
      };
    })
    .filter(Boolean);
  if (columns.length === 0) {
    return null;
  }
  const blockId = `${prefix}_table`;
  return {
    blocks: [{
      id: blockId,
      kind: "tableBlock",
      title: normalizeString(block?.title || "Table") || "Table",
      datasetRef: normalizeString(block?.dataSourceRef || "primary") || "primary",
      columns,
    }],
    layoutItems: [{ blockId }],
    datasetFieldHints: {},
  };
}

function buildForgeUiDashboardDimensionsBlock(block = {}, prefix = "") {
  const dimensionKey = normalizeString(block?.dimension?.key);
  const metricKey = normalizeString(block?.metric?.key);
  if (!dimensionKey || !metricKey) {
    return null;
  }
  const blockId = `${prefix}_chart`;
  return {
    blocks: [{
      id: blockId,
      kind: "chartBlock",
      title: normalizeString(block?.title || "Chart") || "Chart",
      datasetRef: normalizeString(block?.dataSourceRef || "primary") || "primary",
      chartSpec: {
        title: normalizeString(block?.title || "Chart") || "Chart",
        type: "horizontal_bar",
        xField: dimensionKey,
        yFields: [metricKey],
      },
    }],
    layoutItems: [{ blockId }],
    datasetFieldHints: {
      [normalizeString(block?.dataSourceRef || "primary") || "primary"]: {
        [dimensionKey]: "dimension",
        [metricKey]: "measure",
      },
    },
  };
}

function buildForgeUiDashboardReportBlock(block = {}, prefix = "") {
  const paragraphs = (Array.isArray(block?.sections) ? block.sections : [])
    .flatMap((section) => Array.isArray(section?.body) ? section.body : []);
  const markdown = buildSectionMarkdown(paragraphs);
  if (!markdown) {
    return null;
  }
  const blockId = `${prefix}_report`;
  return {
    blocks: [{
      id: blockId,
      kind: "markdownBlock",
      title: normalizeString(block?.title || "Report") || "Report",
      markdown,
    }],
    layoutItems: [{ blockId }],
    datasetFieldHints: {},
  };
}

function buildForgeUiDashboardMessagesBlock(block = {}, prefix = "") {
  const markdown = buildMessageMarkdown(block?.title || "Messages", block?.items);
  if (!markdown) {
    return null;
  }
  const blockId = `${prefix}_messages`;
  return {
    blocks: [{
      id: blockId,
      kind: "markdownBlock",
      title: normalizeString(block?.title || "Messages") || "Messages",
      markdown,
    }],
    layoutItems: [{ blockId }],
    datasetFieldHints: {},
  };
}

function buildForgeUiDashboardBadgesBlock(block = {}, prefix = "") {
  const items = (Array.isArray(block?.items) ? block.items : [])
    .map((item, index) => {
      const label = normalizeString(item?.label);
      const value = normalizeString(item?.value);
      const valueField = normalizeString(item?.valueField);
      const format = normalizeString(item?.format);
      const tone = normalizeString(item?.tone || item?.severity);
      if (!label && !value && !valueField) {
        return null;
      }
      return {
        id: normalizeString(item?.id || `${prefix}_badge_${index + 1}`) || `${prefix}_badge_${index + 1}`,
        ...(label ? { label } : {}),
        ...(value ? { value } : {}),
        ...(valueField ? { valueField } : {}),
        ...(format ? { format } : {}),
        ...(tone ? { tone } : {}),
      };
    })
    .filter(Boolean);
  if (items.length === 0) {
    return null;
  }
  const blockId = `${prefix}_badges`;
  return {
    blocks: [{
      id: blockId,
      kind: "badgesBlock",
      title: normalizeString(block?.title || "Status Pills") || "Status Pills",
      datasetRef: normalizeString(block?.dataSourceRef || "primary") || "primary",
      items,
    }],
    layoutItems: [{ blockId }],
    datasetFieldHints: {},
  };
}

function buildForgeUiBlockProjection(block = {}, index = 0) {
  const kind = normalizeString(block?.kind);
  const titleId = sanitizeId(block?.title || `${kind}_${index + 1}`) || `block_${index + 1}`;
  if (kind === "dashboard.summary") {
    return buildForgeUiDashboardSummaryBlocks(block, titleId);
  }
  if (kind === "dashboard.table") {
    return buildForgeUiDashboardTableBlock(block, titleId);
  }
  if (kind === "dashboard.dimensions") {
    return buildForgeUiDashboardDimensionsBlock(block, titleId);
  }
  if (kind === "dashboard.report") {
    return buildForgeUiDashboardReportBlock(block, titleId);
  }
  if (kind === "dashboard.messages") {
    return buildForgeUiDashboardMessagesBlock(block, titleId);
  }
  if (kind === "dashboard.badges") {
    return buildForgeUiDashboardBadgesBlock(block, titleId);
  }
  return null;
}

export function buildReportBuilderImportedStarterFromJsonFile({
  fileName = "",
  json = "",
} = {}) {
  const forgeUiBlocks = extractForgeUiJsonBlocks(json);
  if (forgeUiBlocks.length === 0) {
    return null;
  }
  if (forgeUiBlocks.length > 1) {
    throw new Error("The imported JSON file contains multiple forge-ui report definitions. Import one report blueprint at a time.");
  }
  const parsed = JSON.parse(forgeUiBlocks[0]);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("The forge-ui block must contain a JSON object.");
  }
  const blocks = Array.isArray(parsed?.blocks) ? parsed.blocks : [];
  const projections = blocks
    .map((block, index) => buildForgeUiBlockProjection(block, index))
    .filter(Boolean);
  const authoredBlocks = normalizeReportBuilderDocumentBlocks(
    projections.flatMap((projection) => Array.isArray(projection?.blocks) ? projection.blocks : []),
  );
  if (authoredBlocks.length === 0) {
    throw new Error("The forge-ui report definition does not contain any supported dashboard blocks for report-builder import.");
  }
  const layoutItems = [
    { blockId: "primaryBuilder" },
    ...projections.flatMap((projection) => Array.isArray(projection?.layoutItems) ? projection.layoutItems : []),
  ];
  const unsupportedKinds = blocks
    .map((block) => normalizeString(block?.kind))
    .filter(Boolean)
    .filter((kind) => ![
      "dashboard.summary",
      "dashboard.table",
      "dashboard.dimensions",
      "dashboard.report",
      "dashboard.messages",
      "dashboard.badges",
    ].includes(kind));
  const title = normalizeString(parsed?.title || humanizeLabel(normalizeString(fileName).replace(/\.[^.]+$/, "")) || "Imported report") || "Imported report";
  const datasetFieldHints = projections.reduce((acc, projection) => {
    const hints = projection?.datasetFieldHints && typeof projection.datasetFieldHints === "object" && !Array.isArray(projection.datasetFieldHints)
      ? projection.datasetFieldHints
      : {};
    Object.entries(hints).forEach(([datasetRef, fieldHintMap]) => {
      const normalizedDatasetRef = normalizeString(datasetRef);
      if (!normalizedDatasetRef || !fieldHintMap || typeof fieldHintMap !== "object" || Array.isArray(fieldHintMap)) {
        return;
      }
      acc[normalizedDatasetRef] = {
        ...(acc[normalizedDatasetRef] || {}),
        ...fieldHintMap,
      };
    });
    return acc;
  }, {});
  return {
    id: sanitizeId(`${title}_imported`) || "imported_report",
    label: title,
    title,
    subtitle: normalizeString(parsed?.subtitle),
    description: normalizeString(parsed?.description),
    blocks: authoredBlocks,
    layout: {
      type: "stack",
      items: layoutItems,
    },
    datasetFieldHints,
    unsupportedKinds,
  };
}
