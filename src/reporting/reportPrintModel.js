import { buildReportSpecHash, buildReportFillHash } from "./reportFillModel.js";
import { buildReportPrintChartSvg } from "./reportPrintChartSvg.js";
import { buildReportPrintGeoSvg } from "./reportPrintGeoSvg.js";
import { formatExportValue } from "./reportExportValueFormatter.js";
import { getIconPaths } from "@blueprintjs/icons";
import {
  REPORT_LAYOUT_GRID_COLUMNS,
  resolveReportLayoutSpan,
} from "./reportLayoutModel.js";

function normalizeString(value = "") {
  return String(value || "").trim();
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function buildReportPrintMappedIconSvg(iconName = "", color = "#425a70") {
  const paths = getIconPaths(normalizeString(iconName), 16);
  if (!Array.isArray(paths) || paths.length === 0) {
    return "";
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">${paths.map((path) => `<path d="${path}" fill="${color}"/>`).join("")}</svg>`;
}

function resolveReportPrintTheme(reportSpec = {}) {
  const source = reportSpec?.theme && typeof reportSpec.theme === "object" && !Array.isArray(reportSpec.theme)
    ? reportSpec.theme
    : {};
  const accentTone = normalizeString(source?.accentTone).toLowerCase();
  const badgePalette = normalizeString(source?.badgePalette).toLowerCase();
  return {
    accentTone: ["blue", "green", "amber", "rose", "slate"].includes(accentTone) ? accentTone : "blue",
    badgePalette: ["soft", "bold"].includes(badgePalette) ? badgePalette : "soft",
  };
}

function resolveReportPrintAccentPalette(accentTone = "blue") {
  switch (normalizeString(accentTone).toLowerCase()) {
    case "green":
      return { backgroundColor: "#eef8f0", borderColor: "#16a34a", textColor: "#0f6b3a" };
    case "amber":
      return { backgroundColor: "#fff7e1", borderColor: "#d9822b", textColor: "#8a5d00" };
    case "rose":
      return { backgroundColor: "#fff1f0", borderColor: "#d64545", textColor: "#a82a2a" };
    case "slate":
      return { backgroundColor: "#f5f7fa", borderColor: "#5f6b7c", textColor: "#486581" };
    case "blue":
    default:
      return { backgroundColor: "#eef4ff", borderColor: "#2f6de1", textColor: "#2457b8" };
  }
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeNonNegativeNumber(value, {
  minimum = 0,
  allowZero = true,
} = {}) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized < minimum) {
    return null;
  }
  if (!allowZero && normalized === 0) {
    return null;
  }
  return normalized;
}

function normalizePositiveInteger(value) {
  const normalized = Math.trunc(Number(value));
  return Number.isInteger(normalized) && normalized > 0 ? normalized : null;
}

function normalizeEnumValue(value = "", allowed = [], fallback = "") {
  const normalized = normalizeString(value).toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

function normalizeReportPrintBox(box = null) {
  if (!isPlainObject(box)) {
    return null;
  }
  const x = normalizeNonNegativeNumber(box.x);
  const y = normalizeNonNegativeNumber(box.y);
  const width = normalizeNonNegativeNumber(box.width);
  const height = normalizeNonNegativeNumber(box.height);
  if (x == null || y == null || width == null || height == null) {
    return null;
  }
  return { x, y, width, height };
}

export const DEFAULT_REPORT_PRINT_PAGE_GEOMETRY = Object.freeze({
  width: 612,
  height: 792,
  marginTop: 36,
  marginRight: 36,
  marginBottom: 36,
  marginLeft: 36,
  headerHeight: 36,
  footerHeight: 24,
});

export function buildReportPrintPageGeometry(value = DEFAULT_REPORT_PRINT_PAGE_GEOMETRY) {
  const source = isPlainObject(value) ? value : DEFAULT_REPORT_PRINT_PAGE_GEOMETRY;
  const width = normalizeNonNegativeNumber(source.width, { minimum: 1, allowZero: false });
  const height = normalizeNonNegativeNumber(source.height, { minimum: 1, allowZero: false });
  const marginTop = normalizeNonNegativeNumber(source.marginTop);
  const marginRight = normalizeNonNegativeNumber(source.marginRight);
  const marginBottom = normalizeNonNegativeNumber(source.marginBottom);
  const marginLeft = normalizeNonNegativeNumber(source.marginLeft);
  const headerHeight = normalizeNonNegativeNumber(source.headerHeight);
  const footerHeight = normalizeNonNegativeNumber(source.footerHeight);
  if (
    width == null
    || height == null
    || marginTop == null
    || marginRight == null
    || marginBottom == null
    || marginLeft == null
    || headerHeight == null
    || footerHeight == null
  ) {
    return null;
  }
  return {
    width,
    height,
    marginTop,
    marginRight,
    marginBottom,
    marginLeft,
    headerHeight,
    footerHeight,
  };
}

function buildReportPrintElementBase(element = {}, expectedKind = "") {
  if (!isPlainObject(element)) {
    return null;
  }
  const id = normalizeString(element.id);
  const box = normalizeReportPrintBox(element.box);
  if (!id || !box || normalizeString(element.kind) !== expectedKind) {
    return null;
  }
  const next = {
    id,
    kind: expectedKind,
    box,
  };
  const zIndex = normalizePositiveInteger(element.zIndex);
  if (zIndex != null) {
    next.zIndex = zIndex;
  }
  return next;
}

export function buildReportPrintTextElement(element = {}) {
  const next = buildReportPrintElementBase({
    ...element,
    kind: "text",
  }, "text");
  const text = String(element?.text || "");
  if (!next || !text) {
    return null;
  }
  const result = {
    ...next,
    text,
  };
  const fontFamily = normalizeString(element?.fontFamily);
  const fontWeight = normalizeString(element?.fontWeight);
  const color = normalizeString(element?.color);
  const align = normalizeEnumValue(element?.align, ["left", "center", "right"]);
  const verticalAlign = normalizeEnumValue(element?.verticalAlign, ["top", "middle", "bottom"]);
  const fontSize = normalizeNonNegativeNumber(element?.fontSize, { minimum: 1, allowZero: false });
  if (fontFamily) {
    result.fontFamily = fontFamily;
  }
  if (fontSize != null) {
    result.fontSize = fontSize;
  }
  if (fontWeight) {
    result.fontWeight = fontWeight;
  }
  if (color) {
    result.color = color;
  }
  if (align) {
    result.align = align;
  }
  if (verticalAlign) {
    result.verticalAlign = verticalAlign;
  }
  if (element?.wrap === true) {
    result.wrap = true;
  }
  return result;
}

export function buildReportPrintLineElement(element = {}) {
  const next = buildReportPrintElementBase({
    ...element,
    kind: "line",
  }, "line");
  const strokeColor = normalizeString(element?.strokeColor);
  const strokeWidth = normalizeNonNegativeNumber(element?.strokeWidth);
  if (!next || !strokeColor || strokeWidth == null) {
    return null;
  }
  const strokeStyle = normalizeEnumValue(element?.strokeStyle, ["solid", "dashed", "dotted"]);
  return {
    ...next,
    strokeColor,
    strokeWidth,
    ...(strokeStyle ? { strokeStyle } : {}),
  };
}

export function buildReportPrintRectElement(element = {}) {
  const next = buildReportPrintElementBase({
    ...element,
    kind: "rect",
  }, "rect");
  if (!next) {
    return null;
  }
  const fillColor = normalizeString(element?.fillColor);
  const strokeColor = normalizeString(element?.strokeColor);
  const strokeWidth = normalizeNonNegativeNumber(element?.strokeWidth);
  const radius = normalizeNonNegativeNumber(element?.radius);
  return {
    ...next,
    ...(fillColor ? { fillColor } : {}),
    ...(strokeColor ? { strokeColor } : {}),
    ...(strokeWidth != null ? { strokeWidth } : {}),
    ...(radius != null ? { radius } : {}),
  };
}

export function buildReportPrintImageElement(element = {}) {
  const next = buildReportPrintElementBase({
    ...element,
    kind: "image",
  }, "image");
  const mimeType = normalizeString(element?.image?.mimeType);
  const payload = normalizeString(element?.image?.payload);
  if (!next || !mimeType || !payload) {
    return null;
  }
  return {
    ...next,
    image: {
      mimeType,
      payload,
    },
  };
}

export function buildReportPrintSvgElement(element = {}) {
  const next = buildReportPrintElementBase({
    ...element,
    kind: "svg",
  }, "svg");
  const svg = String(element?.svg || "");
  if (!next || !svg) {
    return null;
  }
  return {
    ...next,
    svg,
  };
}

function buildReportPrintTableCellElementBase(element = {}, expectedKind = "") {
  const next = buildReportPrintElementBase({
    ...element,
    kind: expectedKind,
  }, expectedKind);
  const rowKey = normalizeString(element?.rowKey);
  const columnKey = normalizeString(element?.columnKey);
  if (!next || !rowKey || !columnKey) {
    return null;
  }
  return {
    ...next,
    rowKey,
    columnKey,
  };
}

export function buildReportPrintTableCellTextElement(element = {}) {
  const next = buildReportPrintTableCellElementBase(element, "tableCellText");
  const text = String(element?.text || "");
  if (!next || !text) {
    return null;
  }
  const format = normalizeString(element?.format);
  const align = normalizeEnumValue(element?.align, ["left", "center", "right"]);
  return {
    ...next,
    text,
    ...(format ? { format } : {}),
    ...(align ? { align } : {}),
  };
}

export function buildReportPrintTableCellDataBarElement(element = {}) {
  const next = buildReportPrintTableCellElementBase(element, "tableCellDataBar");
  const value = normalizeNonNegativeNumber(element?.value, { minimum: Number.NEGATIVE_INFINITY });
  const min = normalizeNonNegativeNumber(element?.min, { minimum: Number.NEGATIVE_INFINITY });
  const max = normalizeNonNegativeNumber(element?.max, { minimum: Number.NEGATIVE_INFINITY });
  const fillColor = normalizeString(element?.fillColor);
  const backgroundColor = normalizeString(element?.backgroundColor);
  if (!next || value == null || min == null || max == null || !fillColor) {
    return null;
  }
  return {
    ...next,
    value,
    min,
    max,
    fillColor,
    ...(backgroundColor ? { backgroundColor } : {}),
  };
}

export function buildReportPrintTableCellToneElement(element = {}) {
  const next = buildReportPrintTableCellElementBase(element, "tableCellTone");
  const tone = normalizeString(element?.tone);
  const label = normalizeString(element?.label);
  const backgroundColor = normalizeString(element?.backgroundColor);
  const borderColor = normalizeString(element?.borderColor);
  const textColor = normalizeString(element?.textColor);
  if (!next || !tone || !label || !backgroundColor) {
    return null;
  }
  return {
    ...next,
    tone,
    label,
    backgroundColor,
    ...(borderColor ? { borderColor } : {}),
    ...(textColor ? { textColor } : {}),
  };
}

export function buildReportPrintTableCellBadgeElement(element = {}) {
  const next = buildReportPrintTableCellElementBase(element, "tableCellBadge");
  const label = normalizeString(element?.label);
  const tone = normalizeString(element?.tone);
  const backgroundColor = normalizeString(element?.backgroundColor);
  const borderColor = normalizeString(element?.borderColor);
  const textColor = normalizeString(element?.textColor);
  if (!next || !label) {
    return null;
  }
  return {
    ...next,
    label,
    ...(tone ? { tone } : {}),
    ...(backgroundColor ? { backgroundColor } : {}),
    ...(borderColor ? { borderColor } : {}),
    ...(textColor ? { textColor } : {}),
  };
}

export function buildReportPrintElement(element = {}) {
  const kind = normalizeString(element?.kind);
  switch (kind) {
    case "text":
      return buildReportPrintTextElement(element);
    case "line":
      return buildReportPrintLineElement(element);
    case "rect":
      return buildReportPrintRectElement(element);
    case "image":
      return buildReportPrintImageElement(element);
    case "svg":
      return buildReportPrintSvgElement(element);
    case "tableCellText":
      return buildReportPrintTableCellTextElement(element);
    case "tableCellDataBar":
      return buildReportPrintTableCellDataBarElement(element);
    case "tableCellTone":
      return buildReportPrintTableCellToneElement(element);
    case "tableCellBadge":
      return buildReportPrintTableCellBadgeElement(element);
    default:
      return null;
  }
}

function normalizeReportPrintElementList(elements = []) {
  if (!Array.isArray(elements)) {
    return null;
  }
  const normalized = elements.map((element) => buildReportPrintElement(element));
  return normalized.every(Boolean) ? normalized : null;
}

export function buildReportPrintPage(page = {}) {
  if (!isPlainObject(page)) {
    return null;
  }
  const number = normalizePositiveInteger(page.number);
  const elements = normalizeReportPrintElementList(page.elements || []);
  const headerElements = normalizeReportPrintElementList(page.headerElements || []);
  const footerElements = normalizeReportPrintElementList(page.footerElements || []);
  if (number == null || !elements || !headerElements || !footerElements) {
    return null;
  }
  return {
    number,
    elements,
    headerElements,
    footerElements,
  };
}

export function buildReportPrintBookmark(bookmark = {}) {
  if (!isPlainObject(bookmark)) {
    return null;
  }
  const id = normalizeString(bookmark.id);
  const title = normalizeString(bookmark.title);
  const pageNumber = normalizePositiveInteger(bookmark.pageNumber);
  if (!id || !title || pageNumber == null) {
    return null;
  }
  const next = {
    id,
    title,
    pageNumber,
  };
  const level = normalizePositiveInteger(bookmark.level);
  const elementId = normalizeString(bookmark.elementId);
  const y = normalizeNonNegativeNumber(bookmark.y);
  if (level != null) {
    next.level = level;
  }
  if (elementId) {
    next.elementId = elementId;
  }
  if (y != null) {
    next.y = y;
  }
  return next;
}

export function buildReportPrintDiagnostic(diagnostic = {}) {
  if (!isPlainObject(diagnostic)) {
    return null;
  }
  const code = normalizeString(diagnostic.code);
  const severity = normalizeString(diagnostic.severity);
  const message = normalizeString(diagnostic.message);
  if (!code || !severity || !message) {
    return null;
  }
  const next = {
    code,
    severity,
    message,
  };
  const pageNumber = normalizePositiveInteger(diagnostic.pageNumber);
  const elementId = normalizeString(diagnostic.elementId);
  if (pageNumber != null) {
    next.pageNumber = pageNumber;
  }
  if (elementId) {
    next.elementId = elementId;
  }
  return next;
}

function normalizeSource(source = null) {
  if (!isPlainObject(source)) {
    return null;
  }
  const kind = normalizeString(source.kind);
  const containerId = normalizeString(source.containerId);
  const stateKey = normalizeString(source.stateKey);
  const dataSourceRef = normalizeString(source.dataSourceRef);
  if (!kind || !containerId || !stateKey || !dataSourceRef) {
    return null;
  }
  return {
    kind,
    containerId,
    stateKey,
    dataSourceRef,
  };
}

function stableSerialize(value) {
  return JSON.stringify(value == null ? null : value);
}

const REPORT_PRINT_THEME = Object.freeze({
  pagePaddingTop: 12,
  pagePaddingBottom: 8,
  blockGap: 16,
  columnGap: 24,
  titleFontSize: 14,
  titleLineHeight: 20,
  bodyFontSize: 12,
  bodyLineHeight: 16,
  kpiValueFontSize: 20,
  kpiValueLineHeight: 24,
  warningFontSize: 11,
  warningLineHeight: 14,
  tableHeaderHeight: 24,
  tableRowHeight: 24,
  tableCellPaddingX: 6,
  tableCellPaddingY: 4,
  titleColor: "#101828",
  bodyColor: "#344054",
  mutedColor: "#667085",
  warningColor: "#b54708",
  dangerColor: "#b42318",
  headerRuleColor: "#d0d5dd",
  tableHeaderBackground: "#f8fafc",
  tableBorderColor: "#d0d5dd",
  dataBarBackground: "#dbeafe",
  dataBarForeground: "#2563eb",
});

function buildOrderedReportFillBlocks(reportSpec = {}, reportFill = {}) {
  const blocksById = new Map(
    (Array.isArray(reportFill?.blocks) ? reportFill.blocks : [])
      .map((block) => [normalizeString(block?.id), block])
      .filter(([id, block]) => !!id && !!block),
  );
  const compositeChildBlockIds = new Set(
    (Array.isArray(reportFill?.blocks) ? reportFill.blocks : [])
      .filter((block) => normalizeString(block?.kind) === "compositeBlock")
      .flatMap((block) => (
        Array.isArray(block?.content?.childBlockIds)
          ? block.content.childBlockIds
          : (Array.isArray(block?.childBlockIds) ? block.childBlockIds : [])
      ))
      .map((blockId) => normalizeString(blockId))
      .filter(Boolean),
  );
  const ordered = [];
  const seen = new Set();
  (Array.isArray(reportSpec?.layoutIntent?.blockOrder) ? reportSpec.layoutIntent.blockOrder : [])
    .map((blockId) => normalizeString(blockId))
    .filter(Boolean)
    .forEach((blockId) => {
      const block = blocksById.get(blockId);
      if (!block || seen.has(blockId) || compositeChildBlockIds.has(blockId)) {
        return;
      }
      seen.add(blockId);
      ordered.push(block);
    });
  (Array.isArray(reportFill?.blocks) ? reportFill.blocks : []).forEach((block) => {
    const blockId = normalizeString(block?.id);
    if (blockId && (seen.has(blockId) || compositeChildBlockIds.has(blockId))) {
      return;
    }
    if (blockId) {
      seen.add(blockId);
    }
    ordered.push(block);
  });
  return ordered;
}

function buildLayoutSpanByBlockId(reportSpec = {}) {
  return new Map(
    (Array.isArray(reportSpec?.layoutIntent?.items) ? reportSpec.layoutIntent.items : [])
      .map((item) => [normalizeString(item?.blockId), resolveReportLayoutSpan(item)])
      .filter(([blockId]) => !!blockId),
  );
}

function normalizeMarkdownToPlainText(markdown = "") {
  return String(markdown || "")
    .replace(/\r\n/g, "\n")
    // Print blocks are text-only; preserve the content without exposing Markdown markers.
    .replace(/!?(?:\[([^\]]+)\])\([^\)]+\)/g, "$1")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "$1")
    .replace(/(?<!_)_([^_]+)_(?!_)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .split("\n")
    .map((line) => line
      .replace(/^\s{0,3}#{1,6}\s*/, "")
      .replace(/^\s*[-*+]\s+/, "")
      .replace(/^\s*\d+\.\s+/, "")
      .trimEnd())
    .join("\n")
    .trim();
}

function formatReportPrintValue(value, format = "") {
  return formatExportValue(value, format);
}

function formatReportPrintFilterParamValue(param = {}) {
  const value = param?.value;
  const unset = value == null
    || (Array.isArray(value) && value.length === 0)
    || (typeof value === "string" && !value.trim());
  if (unset && param?.multiple === true) {
    const optionLabels = (Array.isArray(param?.options) ? param.options : [])
      .map((option) => normalizeString(option?.label || option?.value))
      .filter(Boolean);
    return optionLabels.length > 0 ? `All (${optionLabels.join(", ")})` : "All";
  }
  return formatReportPrintValue(value);
}

function inferReportPrintNumericFormat(value, format = "") {
  const explicit = normalizeString(format);
  if (explicit) {
    return explicit;
  }
  const numeric = Number(value);
  if (Number.isFinite(numeric) && Number.isInteger(numeric) && Math.abs(numeric) >= 1000) {
    return "compactNumber";
  }
  return "";
}

function wrapReportPrintText(text = "", width = 0, fontSize = REPORT_PRINT_THEME.bodyFontSize) {
  const normalized = String(text || "");
  if (!normalized) {
    return [];
  }
  const maxChars = Math.max(8, Math.floor(Math.max(1, width) / Math.max(4, fontSize * 0.56)));
  const wrapped = [];
  normalized.split("\n").forEach((line) => {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      wrapped.push("");
      return;
    }
    const words = trimmedLine.split(/\s+/).filter(Boolean);
    let current = "";
    const pushChunk = (chunk = "") => {
      if (!chunk) {
        return;
      }
      if (chunk.length <= maxChars) {
        wrapped.push(chunk);
        return;
      }
      for (let index = 0; index < chunk.length; index += maxChars) {
        wrapped.push(chunk.slice(index, index + maxChars));
      }
    };
    words.forEach((word) => {
      if (!current) {
        current = word;
        return;
      }
      if (`${current} ${word}`.length <= maxChars) {
        current = `${current} ${word}`;
        return;
      }
      pushChunk(current);
      current = word;
    });
    pushChunk(current);
  });
  return wrapped;
}

function resolveReportPrintBlockTitle(block = {}) {
  const explicit = normalizeString(block?.title || block?.content?.title);
  if (explicit) {
    return explicit;
  }
  const kind = normalizeString(block?.kind);
  switch (kind) {
    case "markdownBlock":
      return "Narrative";
    case "filterBarBlock":
      return "Filters";
    case "refinementBarBlock":
      return "Refinements";
    case "kpiBlock":
      return normalizeString(block?.content?.valueLabel) || "KPI";
    case "badgesBlock":
      return "Signals";
    case "sectionBlock":
      return normalizeString(block?.content?.navigationLabel || block?.title) || "Section";
    case "compositeBlock":
      return normalizeString(block?.content?.title || block?.title) || "Grouped Panel";
    case "tabGroupBlock":
      return normalizeString(block?.content?.title || block?.title) || "Sections";
    case "stepperBlock":
      return "Process";
    case "infoPanelBlock":
      return normalizeString(block?.title || block?.content?.title) || "Info Panel";
    case "calloutBlock":
      return normalizeString(block?.title || block?.content?.title) || "Callout";
    case "kanbanBlock":
      return normalizeString(block?.title || block?.content?.title) || "Pipeline";
    case "timelineBlock":
      return normalizeString(block?.title || block?.content?.title) || "Timeline";
    case "collectionBlock":
      return "Collection";
    case "tableBlock":
      return "Table";
    case "chartBlock":
      return normalizeString(block?.chartSpec?.title || block?.content?.chartSpec?.title) || "Chart";
    case "geoMapBlock":
      return "Geo Map";
    default:
      return normalizeString(block?.id || kind);
  }
}

function buildReportPrintPageShell(pageNumber = 1, title = "", geometry = DEFAULT_REPORT_PRINT_PAGE_GEOMETRY) {
  const contentWidth = geometry.width - geometry.marginLeft - geometry.marginRight;
  const headerY = geometry.marginTop;
  const footerY = geometry.height - geometry.marginBottom - geometry.footerHeight;
  return {
    number: pageNumber,
    elements: [],
    headerElements: [
      buildReportPrintTextElement({
        id: `page_${pageNumber}__header_title`,
        kind: "text",
        box: {
          x: geometry.marginLeft,
          y: headerY,
          width: contentWidth,
          height: geometry.headerHeight - 8,
        },
        text: title,
        fontSize: 18,
        fontWeight: "700",
        color: REPORT_PRINT_THEME.titleColor,
      }),
      buildReportPrintLineElement({
        id: `page_${pageNumber}__header_rule`,
        kind: "line",
        box: {
          x: geometry.marginLeft,
          y: headerY + geometry.headerHeight - 2,
          width: contentWidth,
          height: 0,
        },
        strokeColor: REPORT_PRINT_THEME.headerRuleColor,
        strokeWidth: 1,
      }),
    ].filter(Boolean),
    footerElements: [
      buildReportPrintLineElement({
        id: `page_${pageNumber}__footer_rule`,
        kind: "line",
        box: {
          x: geometry.marginLeft,
          y: footerY + 2,
          width: contentWidth,
          height: 0,
        },
        strokeColor: REPORT_PRINT_THEME.headerRuleColor,
        strokeWidth: 1,
      }),
      buildReportPrintTextElement({
        id: `page_${pageNumber}__footer_page_number`,
        kind: "text",
        box: {
          x: geometry.marginLeft,
          y: footerY + 6,
          width: contentWidth,
          height: geometry.footerHeight - 8,
        },
        text: `Page ${pageNumber}`,
        fontSize: 11,
        align: "right",
        color: REPORT_PRINT_THEME.mutedColor,
      }),
    ].filter(Boolean),
  };
}

function buildReportPrintLayoutState(reportSpec = {}, reportFill = {}, geometry = DEFAULT_REPORT_PRINT_PAGE_GEOMETRY) {
  const normalizedGeometry = buildReportPrintPageGeometry(geometry);
  if (!normalizedGeometry) {
    return null;
  }
  const contentLeft = normalizedGeometry.marginLeft;
  const contentTop = normalizedGeometry.marginTop + normalizedGeometry.headerHeight + REPORT_PRINT_THEME.pagePaddingTop;
  const contentBottom = normalizedGeometry.height
    - normalizedGeometry.marginBottom
    - normalizedGeometry.footerHeight
    - REPORT_PRINT_THEME.pagePaddingBottom;
  const contentWidth = normalizedGeometry.width - normalizedGeometry.marginLeft - normalizedGeometry.marginRight;
  const blocksById = new Map(
    (Array.isArray(reportFill?.blocks) ? reportFill.blocks : [])
      .map((block) => [normalizeString(block?.id), block])
      .filter(([id, block]) => !!id && !!block),
  );
  return {
    reportSpec,
    reportFill,
    reportTheme: resolveReportPrintTheme(reportSpec),
    blocksById,
    layoutSpanByBlockId: buildLayoutSpanByBlockId(reportSpec),
    geometry: normalizedGeometry,
    contentLeft,
    contentTop,
    contentBottom,
    contentWidth,
    title: normalizeString(reportSpec?.title || reportFill?.title || "Report"),
    pages: [],
    bookmarks: [],
    diagnostics: [],
    currentPage: null,
    currentPageIndex: null,
    cursorY: contentTop,
  };
}

function moveToReportPrintPage(state = {}, pageIndex = 0) {
  const normalizedPageIndex = Math.max(0, Math.trunc(Number(pageIndex) || 0));
  while (state.pages.length <= normalizedPageIndex) {
    const nextPageNumber = state.pages.length + 1;
    state.pages.push(buildReportPrintPageShell(nextPageNumber, state.title, state.geometry));
  }
  state.currentPageIndex = normalizedPageIndex;
  state.currentPage = state.pages[normalizedPageIndex] || null;
  state.cursorY = state.contentTop;
  return state.currentPage;
}

function startNextReportPrintPage(state = {}) {
  const nextPageIndex = Number.isSafeInteger(state.currentPageIndex)
    ? state.currentPageIndex + 1
    : 0;
  return moveToReportPrintPage(state, nextPageIndex);
}

function ensureReportPrintPage(state = {}) {
  if (!state.currentPage) {
    moveToReportPrintPage(state, 0);
  }
}

function ensureReportPrintSpace(state = {}, requiredHeight = 0) {
  ensureReportPrintPage(state);
  if (
    state.cursorY + requiredHeight > state.contentBottom
    && state.cursorY > state.contentTop
  ) {
    startNextReportPrintPage(state);
  }
}

function pushReportPrintElement(state = {}, element = null, target = "elements") {
  ensureReportPrintPage(state);
  if (!element) {
    return null;
  }
  state.currentPage[target].push(element);
  return element;
}

function pushReportPrintDiagnostic(state = {}, diagnostic = {}) {
  const normalized = buildReportPrintDiagnostic(diagnostic);
  if (normalized) {
    state.diagnostics.push(normalized);
  }
}

function pushReportPrintBookmark(state = {}, bookmark = {}) {
  const normalized = buildReportPrintBookmark(bookmark);
  if (normalized) {
    state.bookmarks.push(normalized);
  }
}

function renderReportPrintTextLines(state = {}, {
  idPrefix = "text",
  lines = [],
  fontSize = REPORT_PRINT_THEME.bodyFontSize,
  lineHeight = REPORT_PRINT_THEME.bodyLineHeight,
  fontWeight = "",
  color = REPORT_PRINT_THEME.bodyColor,
  align = "",
  x = undefined,
  width = undefined,
} = {}) {
  const boxX = normalizeNonNegativeNumber(x) ?? state.contentLeft;
  const boxWidth = normalizeNonNegativeNumber(width, { minimum: 1, allowZero: false }) ?? state.contentWidth;
  let sequence = 0;
  let firstElement = null;
  (Array.isArray(lines) ? lines : []).forEach((line) => {
    if (!line && line !== "") {
      return;
    }
    if (line === "") {
      ensureReportPrintSpace(state, lineHeight / 2);
      state.cursorY += lineHeight / 2;
      return;
    }
    wrapReportPrintText(line, boxWidth, fontSize).forEach((wrappedLine) => {
      ensureReportPrintSpace(state, lineHeight);
      const element = pushReportPrintElement(state, buildReportPrintTextElement({
        id: `${idPrefix}_${sequence}`,
        kind: "text",
        box: {
          x: boxX,
          y: state.cursorY,
          width: boxWidth,
          height: lineHeight,
        },
        text: wrappedLine,
        fontSize,
        ...(fontWeight ? { fontWeight } : {}),
        ...(color ? { color } : {}),
        ...(align ? { align } : {}),
      }));
      if (!firstElement && element) {
        firstElement = element;
      }
      state.cursorY += lineHeight;
      sequence += 1;
    });
  });
  return firstElement;
}

function renderReportPrintSectionTitle(state = {}, block = {}, {
  layoutNote = "",
} = {}) {
  const title = resolveReportPrintBlockTitle(block);
  const firstTitleElement = renderReportPrintTextLines(state, {
    idPrefix: `${normalizeString(block?.id || block?.kind || "block")}__title`,
    lines: [title],
    fontSize: REPORT_PRINT_THEME.titleFontSize,
    lineHeight: REPORT_PRINT_THEME.titleLineHeight,
    fontWeight: "600",
    color: REPORT_PRINT_THEME.titleColor,
  });
  if (firstTitleElement) {
    pushReportPrintBookmark(state, {
      id: `bookmark.${normalizeString(block?.id || block?.kind || "block")}`,
      title,
      pageNumber: state.currentPage?.number,
      elementId: firstTitleElement.id,
      level: 1,
      y: firstTitleElement.box?.y,
    });
  }
  if (layoutNote) {
    renderReportPrintTextLines(state, {
      idPrefix: `${normalizeString(block?.id || block?.kind || "block")}__layout_note`,
      lines: [layoutNote],
      fontSize: REPORT_PRINT_THEME.warningFontSize,
      lineHeight: REPORT_PRINT_THEME.warningLineHeight,
      color: REPORT_PRINT_THEME.warningColor,
    });
  }
  if (firstTitleElement) {
    state.cursorY += 4;
  }
  return firstTitleElement;
}

function finishReportPrintBlock(state = {}, gap = REPORT_PRINT_THEME.blockGap) {
  ensureReportPrintPage(state);
  if (state.cursorY + gap > state.contentBottom) {
    state.cursorY = state.contentBottom;
    return;
  }
  state.cursorY += gap;
}

function buildScopedReportPrintState(state = {}, {
  contentLeft = 0,
  contentWidth = 0,
  startPageIndex = 0,
  startCursorY = 0,
} = {}) {
  return {
    ...state,
    contentLeft,
    contentWidth,
    currentPageIndex: startPageIndex,
    currentPage: state.pages[startPageIndex] || null,
    cursorY: startCursorY,
  };
}

function resolveReportPrintStatePosition(state = {}) {
  const pageIndex = Number.isSafeInteger(state.currentPageIndex)
    ? state.currentPageIndex
    : (
      Number.isSafeInteger(state.currentPage?.number)
        ? state.currentPage.number - 1
        : -1
    );
  return {
    pageIndex,
    cursorY: normalizeNonNegativeNumber(state.cursorY) ?? state.contentTop,
  };
}

function syncReportPrintStateFromChildren(state = {}, children = []) {
  let nextPosition = resolveReportPrintStatePosition(state);
  (Array.isArray(children) ? children : []).forEach((child) => {
    const candidate = resolveReportPrintStatePosition(child);
    if (candidate.pageIndex > nextPosition.pageIndex) {
      nextPosition = candidate;
      return;
    }
    if (candidate.pageIndex === nextPosition.pageIndex && candidate.cursorY > nextPosition.cursorY) {
      nextPosition = candidate;
    }
  });
  if (nextPosition.pageIndex >= 0) {
    state.currentPageIndex = nextPosition.pageIndex;
    state.currentPage = state.pages[nextPosition.pageIndex] || null;
    state.cursorY = nextPosition.cursorY;
  }
}

function renderReportPrintGridRow(state = {}, entries = []) {
  const rowEntries = (Array.isArray(entries) ? entries : [])
    .filter((entry) => !!entry?.block && Number.isFinite(entry?.span) && entry.span > 0)
    .map((entry) => ({
      block: entry.block,
      span: Math.max(1, Math.min(REPORT_LAYOUT_GRID_COLUMNS, Math.trunc(entry.span))),
    }));
  if (rowEntries.length === 0) {
    return;
  }
  ensureReportPrintPage(state);
  const startPosition = resolveReportPrintStatePosition(state);
  const unitWidth = Math.max(
    1,
    (state.contentWidth - (REPORT_PRINT_THEME.columnGap * (REPORT_LAYOUT_GRID_COLUMNS - 1))) / REPORT_LAYOUT_GRID_COLUMNS,
  );
  let consumedColumns = 0;
  const childStates = rowEntries.map((entry) => {
    const span = Math.max(1, Math.min(REPORT_LAYOUT_GRID_COLUMNS - consumedColumns, entry.span));
    const childState = buildScopedReportPrintState(state, {
      contentLeft: state.contentLeft + (consumedColumns * (unitWidth + REPORT_PRINT_THEME.columnGap)),
      contentWidth: (unitWidth * span) + (REPORT_PRINT_THEME.columnGap * Math.max(0, span - 1)),
      startPageIndex: startPosition.pageIndex,
      startCursorY: startPosition.cursorY,
    });
    consumedColumns += span;
    return childState;
  });
  childStates.forEach((childState, index) => {
    renderReportPrintBlock(childState, rowEntries[index].block, {});
  });
  syncReportPrintStateFromChildren(state, childStates);
}

function buildFilterBarLines(block = {}) {
  const params = Array.isArray(block?.content?.params) ? block.content.params : [];
  const criteria = Array.isArray(block?.content?.criteria) ? block.content.criteria : [];
  if (params.length === 0 && criteria.length === 0) {
    return ["No active filter parameters."];
  }
  const linesByGroup = new Map();
  const pushLines = (groupId = "", lines = []) => {
    const normalizedGroupId = normalizeString(groupId || "__ungrouped__") || "__ungrouped__";
    const current = linesByGroup.get(normalizedGroupId) || [];
    current.push(...lines.filter(Boolean));
    linesByGroup.set(normalizedGroupId, current);
  };
  params.forEach((param) => {
    const label = normalizeString(param?.label || param?.id) || "param";
    const description = normalizeString(param?.description);
    pushLines(param?.groupId || param?.id, [
      `${label}: ${formatReportPrintFilterParamValue(param)}`,
      ...(description ? [description] : []),
    ]);
  });
  criteria.forEach((criterion) => {
    const label = normalizeString(criterion?.label || criterion?.filterLabel || criterion?.id) || "criteria";
    const displayValues = Array.isArray(criterion?.displayValues)
      ? criterion.displayValues.map((value) => normalizeString(value)).filter(Boolean)
      : [];
    const rawValues = Array.isArray(criterion?.rawValues) ? criterion.rawValues : [];
    const values = displayValues.length > 0
      ? displayValues.join(", ")
      : rawValues.map((value) => formatReportPrintValue(value)).join(", ");
    const enabledSuffix = criterion?.enabled === false ? " (Off)" : "";
    pushLines(criterion?.groupId || criterion?.id, [`${label}${enabledSuffix}: ${values || "—"}`]);
  });
  const orderedGroups = Array.isArray(block?.content?.groupOrder)
    ? block.content.groupOrder.map((entry) => normalizeString(entry)).filter(Boolean)
    : [];
  const emitted = [];
  orderedGroups.forEach((groupId) => {
    const lines = linesByGroup.get(groupId) || [];
    emitted.push(...lines);
    linesByGroup.delete(groupId);
  });
  Array.from(linesByGroup.values()).forEach((lines) => emitted.push(...lines));
  return emitted;
}

function buildRefinementBarLines(block = {}) {
  const refinements = Array.isArray(block?.content?.refinements) ? block.content.refinements : [];
  if (refinements.length === 0) {
    return [];
  }
  return refinements.map((refinement) => {
    const label = normalizeString(refinement?.label);
    if (label) {
      return label;
    }
    const op = normalizeString(refinement?.op);
    const field = normalizeString(refinement?.field);
    const values = Array.isArray(refinement?.values) ? refinement.values.map((value) => formatReportPrintValue(value)).join(", ") : "";
    return `${op || "refinement"} ${field || "field"}: ${values || "—"}`;
  });
}

function renderReportPrintTextSectionBlock(state = {}, block = {}, lines = [], {
  layoutNote = "",
} = {}) {
  renderReportPrintSectionTitle(state, block, { layoutNote });
  renderReportPrintTextLines(state, {
    idPrefix: `${normalizeString(block?.id || block?.kind || "block")}__line`,
    lines,
  });
  finishReportPrintBlock(state);
}

function renderReportPrintMarkdownBlock(state = {}, block = {}, options = {}) {
  const markdown = normalizeMarkdownToPlainText(block?.content?.markdown || block?.markdown || "");
  const lines = markdown ? markdown.split("\n") : ["No narrative content."];
  renderReportPrintTextSectionBlock(state, block, lines, options);
}

function renderReportPrintFilterBarBlock(state = {}, block = {}, options = {}) {
  renderReportPrintTextSectionBlock(state, block, buildFilterBarLines(block), options);
}

function renderReportPrintRefinementBarBlock(state = {}, block = {}, options = {}) {
  const lines = buildRefinementBarLines(block);
  if (lines.length === 0) {
    return;
  }
  renderReportPrintTextSectionBlock(state, block, lines, options);
}

function normalizeReportPrintKpiPresentationMode(block = {}) {
  return normalizeEnumValue(
    block?.content?.presentationMode || block?.presentationMode,
    ["card", "body", "both"],
    "card",
  );
}

function buildReportPrintKpiBodyLines(block = {}) {
  const bodyMarkdown = normalizeMarkdownToPlainText(block?.content?.bodyMarkdown || "");
  return bodyMarkdown ? bodyMarkdown.split("\n").filter((line) => normalizeString(line)) : [];
}

function renderReportPrintKpiBlock(state = {}, block = {}, {
  layoutNote = "",
} = {}) {
  renderReportPrintSectionTitle(state, block, { layoutNote });
  const content = block?.content || {};
  const presentationMode = normalizeReportPrintKpiPresentationMode(block);
  const showCard = presentationMode !== "body";
  const bodyLines = presentationMode !== "card" ? buildReportPrintKpiBodyLines(block) : [];
  const valueFormat = inferReportPrintNumericFormat(
    content?.value,
    content?.valueFormat || content?.format,
  );
  if (showCard) {
    renderReportPrintTextLines(state, {
      idPrefix: `${normalizeString(block?.id || block?.kind || "block")}__value`,
      lines: [`${normalizeString(content?.valueLabel || content?.valueField || "Value")}: ${formatReportPrintValue(content?.value, valueFormat)}`],
      fontSize: REPORT_PRINT_THEME.kpiValueFontSize,
      lineHeight: REPORT_PRINT_THEME.kpiValueLineHeight,
      fontWeight: "700",
      color: REPORT_PRINT_THEME.titleColor,
    });
  }
  const detailLines = [];
  if (showCard && normalizeString(content?.secondaryField || content?.secondaryLabel)) {
    detailLines.push(`${normalizeString(content?.secondaryLabel || content?.secondaryField)}: ${formatReportPrintValue(content?.secondaryValue, normalizeString(content?.secondaryFormat))}`);
  }
  if (showCard && normalizeString(content?.description)) {
    detailLines.push(normalizeString(content.description));
  }
  detailLines.push(...bodyLines);
  if (!showCard && detailLines.length === 0) {
    detailLines.push(`${normalizeString(content?.valueLabel || content?.valueField || "Value")}: ${formatReportPrintValue(content?.value, valueFormat)}`);
  }
  if (detailLines.length > 0) {
    renderReportPrintTextLines(state, {
      idPrefix: `${normalizeString(block?.id || block?.kind || "block")}__detail`,
      lines: detailLines,
    });
  }
  finishReportPrintBlock(state);
}

function renderReportPrintBadgesBlock(state = {}, block = {}, {
  layoutNote = "",
} = {}) {
  renderReportPrintSectionTitle(state, block, { layoutNote });
  const items = Array.isArray(block?.content?.items)
    ? block.content.items
    : (Array.isArray(block?.items) ? block.items : []);
  const lines = items.map((item) => {
    const label = normalizeString(item?.label || item?.valueField || item?.id || "Signal");
    const displayValue = normalizeString(item?.displayValue)
      || formatReportPrintValue(item?.value, normalizeString(item?.format));
    return `${label}: ${displayValue || "-"}`;
  });
  renderReportPrintTextLines(state, {
    idPrefix: `${normalizeString(block?.id || "badges")}__signal`,
    lines: lines.length > 0 ? lines : ["No current signals available."],
  });
  finishReportPrintBlock(state);
}

function renderReportPrintSectionBlock(state = {}, block = {}, {
  layoutNote = "",
} = {}) {
  renderReportPrintSectionTitle(state, block, { layoutNote });
  const lines = [
    normalizeString(block?.content?.subtitle || block?.subtitle),
    normalizeString(block?.content?.description || block?.description),
  ].filter(Boolean);
  if (lines.length > 0) {
    renderReportPrintTextLines(state, {
      idPrefix: `${normalizeString(block?.id || block?.kind || "block")}__section`,
      lines,
    });
  }
  finishReportPrintBlock(state);
}

function renderReportPrintCompositeBlock(state = {}, block = {}, {
  layoutNote = "",
} = {}) {
  renderReportPrintSectionTitle(state, block, { layoutNote });
  const description = normalizeString(block?.content?.description || block?.description);
  if (description) {
    renderReportPrintTextLines(state, {
      idPrefix: `${normalizeString(block?.id || "composite")}__description`,
      lines: [description],
      color: REPORT_PRINT_THEME.mutedColor,
    });
    state.cursorY += 4;
  }
  const childBlockIds = Array.isArray(block?.content?.childBlockIds)
    ? block.content.childBlockIds
    : (Array.isArray(block?.childBlockIds) ? block.childBlockIds : []);
  const childBlocks = childBlockIds
    .map((blockId) => state.blocksById.get(normalizeString(blockId)) || null)
    .filter(Boolean);
  if (childBlocks.length === 0) {
    renderReportPrintTextLines(state, {
      idPrefix: `${normalizeString(block?.id || "composite")}__empty`,
      lines: ["No child blocks are assigned to this grouped panel."],
      color: REPORT_PRINT_THEME.mutedColor,
    });
    finishReportPrintBlock(state);
    return;
  }
  let pendingRow = [];
  let pendingSpan = 0;
  const flushPendingRow = () => {
    if (pendingRow.length === 0) {
      return;
    }
    renderReportPrintGridRow(state, pendingRow);
    pendingRow = [];
    pendingSpan = 0;
  };
  childBlocks.forEach((childBlock) => {
    const blockId = normalizeString(childBlock?.id);
    const span = resolveReportLayoutSpan(state.layoutSpanByBlockId.get(blockId));
    if (span >= REPORT_LAYOUT_GRID_COLUMNS) {
      flushPendingRow();
      renderReportPrintBlock(state, childBlock, {});
      return;
    }
    if (pendingRow.length > 0 && (pendingSpan + span) > REPORT_LAYOUT_GRID_COLUMNS) {
      flushPendingRow();
    }
    pendingRow.push({ block: childBlock, span });
    pendingSpan += span;
    if (pendingSpan >= REPORT_LAYOUT_GRID_COLUMNS) {
      flushPendingRow();
    }
  });
  flushPendingRow();
  finishReportPrintBlock(state);
}

function renderReportPrintTabGroupBlock(state = {}, block = {}, {
  layoutNote = "",
} = {}) {
  renderReportPrintSectionTitle(state, block, { layoutNote });
  const tabs = Array.isArray(block?.content?.tabs) ? block.content.tabs : [];
  const sectionIds = Array.isArray(block?.content?.sectionIds)
    ? block.content.sectionIds
    : (Array.isArray(block?.sectionIds) ? block.sectionIds : []);
  const lines = [];
  const description = normalizeString(block?.content?.description || block?.description);
  if (description) {
    lines.push(description);
  }
  if (tabs.length > 0) {
    lines.push(`Tabs: ${tabs.map((tab) => normalizeString(tab?.navigationLabel || tab?.title || tab?.id)).filter(Boolean).join(" • ")}`);
  } else if (sectionIds.length > 0) {
    lines.push(`Tabs: ${sectionIds.map((sectionId) => normalizeString(sectionId)).filter(Boolean).join(" • ")}`);
  } else {
    lines.push("No tab sections configured.");
  }
  renderReportPrintTextLines(state, {
    idPrefix: `${normalizeString(block?.id || "tabGroup")}__tabs`,
    lines,
    color: REPORT_PRINT_THEME.mutedColor,
  });
  finishReportPrintBlock(state);
}

function renderReportPrintStepperBlock(state = {}, block = {}, {
  layoutNote = "",
} = {}) {
  renderReportPrintSectionTitle(state, block, { layoutNote });
  const steps = Array.isArray(block?.content?.steps) ? block.content.steps : [];
  const lines = [];
  if (normalizeString(block?.content?.description || block?.description)) {
    lines.push(normalizeString(block?.content?.description || block?.description));
    lines.push("");
  }
  steps.forEach((step, index) => {
    const title = normalizeString(step?.title || `Step ${index + 1}`);
    lines.push(`${index + 1}. ${title}`);
    const body = normalizeMarkdownToPlainText(step?.body || "");
    if (body) {
      lines.push(body);
    }
    if (index < steps.length - 1) {
      lines.push("");
    }
  });
  if (lines.length === 0) {
    lines.push("No process steps configured.");
  }
  renderReportPrintTextLines(state, {
    idPrefix: `${normalizeString(block?.id || block?.kind || "block")}__stepper`,
    lines,
  });
  finishReportPrintBlock(state);
}

function renderReportPrintInfoPanelBlock(state = {}, block = {}, {
  layoutNote = "",
} = {}) {
  renderReportPrintSectionTitle(state, block, { layoutNote });
  const lines = [
    normalizeString(block?.content?.eyebrow || block?.eyebrow),
    normalizeString(block?.content?.description || block?.description),
    ...normalizeMarkdownToPlainText(block?.content?.body || block?.body || "").split("\n").map((entry) => normalizeString(entry)).filter(Boolean),
  ].filter(Boolean);
  renderReportPrintTextLines(state, {
    idPrefix: `${normalizeString(block?.id || block?.kind || "block")}__info`,
    lines: lines.length > 0 ? lines : ["No info panel content available."],
  });
  finishReportPrintBlock(state);
}

function renderReportPrintCalloutBlock(state = {}, block = {}, {
  layoutNote = "",
} = {}) {
  renderReportPrintSectionTitle(state, block, { layoutNote });
  const content = block?.content && typeof block.content === "object" && !Array.isArray(block.content)
    ? block.content
    : {};
  const icon = normalizeString(content?.icon || block?.icon);
  const description = normalizeString(content?.description || block?.description);
  const badges = (Array.isArray(content?.badges) ? content.badges : Array.isArray(block?.badges) ? block.badges : [])
    .map((badge) => normalizeString(badge))
    .filter(Boolean);
  const bodyLines = normalizeMarkdownToPlainText(content?.body || block?.body || "")
    .split("\n")
    .map((line) => normalizeString(line))
    .filter(Boolean);
  const lines = [
    ...(icon ? [`Icon: ${icon}`] : []),
    ...(description ? [description] : []),
    ...(badges.length > 0 ? [`Badges: ${badges.join(", ")}`] : []),
    ...bodyLines,
  ];
  renderReportPrintTextLines(state, {
    idPrefix: `${normalizeString(block?.id || "callout")}__line`,
    lines,
    color: REPORT_PRINT_THEME.bodyColor,
  });
  finishReportPrintBlock(state);
}

function renderReportPrintKanbanBlock(state = {}, block = {}, {
  layoutNote = "",
} = {}) {
  renderReportPrintSectionTitle(state, block, { layoutNote });
  const columns = Array.isArray(block?.content?.columns) ? block.content.columns : [];
  const lines = [];
  if (normalizeString(block?.content?.description || block?.description)) {
    lines.push(normalizeString(block?.content?.description || block?.description));
    lines.push("");
  }
  columns.forEach((column, columnIndex) => {
    const title = normalizeString(column?.title || `Column ${columnIndex + 1}`);
    lines.push(`## ${title}`);
    const cards = Array.isArray(column?.cards) ? column.cards : [];
    if (cards.length === 0) {
      lines.push("No cards.");
    } else {
      cards.forEach((card, cardIndex) => {
        const badge = normalizeString(card?.badge);
        const titleText = normalizeString(card?.title || `Card ${cardIndex + 1}`);
        lines.push(`- ${badge ? `[${badge}] ` : ""}${titleText}`);
        const body = normalizeMarkdownToPlainText(card?.body || "");
        if (body) {
          lines.push(body);
        }
      });
    }
    if (columnIndex < columns.length - 1) {
      lines.push("");
    }
  });
  if (lines.length === 0) {
    lines.push("No pipeline content available.");
  }
  renderReportPrintTextLines(state, {
    idPrefix: `${normalizeString(block?.id || block?.kind || "block")}__kanban`,
    lines,
  });
  finishReportPrintBlock(state);
}

function renderReportPrintTimelineBlock(state = {}, block = {}, {
  layoutNote = "",
} = {}) {
  renderReportPrintSectionTitle(state, block, { layoutNote });
  const events = Array.isArray(block?.content?.events) ? block.content.events : [];
  const lines = [];
  if (normalizeString(block?.content?.description || block?.description)) {
    lines.push(normalizeString(block?.content?.description || block?.description));
    lines.push("");
  }
  events.forEach((event, index) => {
    const title = normalizeString(event?.title || `Event ${index + 1}`);
    const date = normalizeString(event?.date);
    const badge = normalizeString(event?.badge);
    lines.push(`${date ? `${date} — ` : ""}${badge ? `[${badge}] ` : ""}${title}`);
    const body = normalizeMarkdownToPlainText(event?.body || "");
    if (body) {
      lines.push(body);
    }
    if (index < events.length - 1) {
      lines.push("");
    }
  });
  if (lines.length === 0) {
    lines.push("No timeline events configured.");
  }
  renderReportPrintTextLines(state, {
    idPrefix: `${normalizeString(block?.id || block?.kind || "block")}__timeline`,
    lines,
  });
  finishReportPrintBlock(state);
}

function renderReportPrintCollectionBlock(state = {}, block = {}, {
  layoutNote = "",
} = {}) {
  renderReportPrintSectionTitle(state, block, { layoutNote });
  const content = block?.content && typeof block.content === "object" && !Array.isArray(block.content)
    ? block.content
    : {};
  const items = Array.isArray(content?.items) ? content.items : [];
  const lines = [];
  if (items.length === 0) {
    lines.push(normalizeString(content?.emptyLabel || "No collection items available."));
  } else {
    items.forEach((item, index) => {
      const title = normalizeString(item?.title || `Item ${index + 1}`);
      lines.push(`## ${title}`);
      if (normalizeString(item?.valueField || item?.valueLabel)) {
        lines.push(`${normalizeString(item?.valueLabel || item?.valueField || "Value")}: ${formatReportPrintValue(item?.value, normalizeString(item?.valueFormat || item?.format))}`);
      }
      if (normalizeString(item?.secondaryField || item?.secondaryLabel)) {
        lines.push(`${normalizeString(item?.secondaryLabel || item?.secondaryField)}: ${formatReportPrintValue(item?.secondaryValue, normalizeString(item?.secondaryFormat))}`);
      }
      const bodyLines = normalizeMarkdownToPlainText(item?.bodyMarkdown || "").split("\n").map((entry) => normalizeString(entry)).filter(Boolean);
      lines.push(...bodyLines);
      if (index < items.length - 1) {
        lines.push("");
      }
    });
  }
  renderReportPrintTextLines(state, {
    idPrefix: `${normalizeString(block?.id || block?.kind || "block")}__collection`,
    lines,
  });
  finishReportPrintBlock(state);
}

function resolveReportPrintTableColumnAlign(column = {}, cell = {}) {
  const explicit = normalizeEnumValue(column?.align, ["left", "center", "right"]);
  if (explicit) {
    return explicit;
  }
  if (normalizeString(column?.kind) === "measure" || typeof cell?.value === "number") {
    return "right";
  }
  return "left";
}

function buildReportPrintDataBarRanges(block = {}) {
  const rows = Array.isArray(block?.content?.resolvedRows) ? block.content.resolvedRows : [];
  const ranges = new Map();
  rows.forEach((row) => {
    (Array.isArray(row?.cells) ? row.cells : []).forEach((cell) => {
      if (normalizeString(cell?.visualState?.kind) !== "dataBar" || typeof cell?.visualState?.value !== "number") {
        return;
      }
      const key = normalizeString(cell?.key);
      const current = ranges.get(key) || {
        min: cell.visualState.value,
        max: cell.visualState.value,
      };
      current.min = Math.min(current.min, cell.visualState.value);
      current.max = Math.max(current.max, cell.visualState.value);
      ranges.set(key, current);
    });
  });
  return ranges;
}

function resolveReportPrintTonePalette(tone = "", theme = {}) {
  const normalized = normalizeString(tone).toLowerCase();
  const bold = theme?.badgePalette === "bold";
  switch (normalized) {
    case "success":
      return { backgroundColor: bold ? "#d5f0dc" : "#eef8f0", borderColor: "#0f9960", textColor: "#0a6640" };
    case "danger":
    case "critical":
      return { backgroundColor: bold ? "#f8d0cc" : "#fdecea", borderColor: "#db3737", textColor: "#a82a2a" };
    case "warning":
      return { backgroundColor: bold ? "#ffe2a8" : "#fff5d6", borderColor: "#f5c542", textColor: "#8a5d00" };
    case "info":
      return resolveReportPrintAccentPalette(theme?.accentTone);
    case "reviewed":
      return { backgroundColor: "#eff8ff", borderColor: "#175cd3", textColor: "#175cd3" };
    case "certified":
      return { backgroundColor: "#eef8f0", borderColor: "#0f9960", textColor: "#0a6640" };
    default:
      return bold ? resolveReportPrintAccentPalette(theme?.accentTone) : { backgroundColor: "#f2f4f7", borderColor: "#d0d5dd", textColor: "#344054" };
  }
}

function renderReportPrintTableHeader(state = {}, block = {}, columns = [], rowY = 0, columnWidth = 0) {
  pushReportPrintElement(state, buildReportPrintRectElement({
    id: `${normalizeString(block?.id || "table")}__header_bg__page_${state.currentPage?.number}`,
    kind: "rect",
    box: {
      x: state.contentLeft,
      y: rowY,
      width: state.contentWidth,
      height: REPORT_PRINT_THEME.tableHeaderHeight,
    },
    fillColor: REPORT_PRINT_THEME.tableHeaderBackground,
    strokeColor: REPORT_PRINT_THEME.tableBorderColor,
    strokeWidth: 1,
  }));
  columns.forEach((column, columnIndex) => {
    pushReportPrintElement(state, buildReportPrintTextElement({
      id: `${normalizeString(block?.id || "table")}__header__${normalizeString(column?.key || columnIndex)}__page_${state.currentPage?.number}`,
      kind: "text",
      box: {
        x: state.contentLeft + (columnIndex * columnWidth) + REPORT_PRINT_THEME.tableCellPaddingX,
        y: rowY + REPORT_PRINT_THEME.tableCellPaddingY,
        width: Math.max(1, columnWidth - (REPORT_PRINT_THEME.tableCellPaddingX * 2)),
        height: REPORT_PRINT_THEME.tableHeaderHeight - (REPORT_PRINT_THEME.tableCellPaddingY * 2),
      },
      text: normalizeString(column?.label || column?.key || `Column ${columnIndex + 1}`),
      fontSize: 11,
      fontWeight: "600",
      color: REPORT_PRINT_THEME.titleColor,
      align: resolveReportPrintTableColumnAlign(column, {}),
    }));
  });
}

function renderReportPrintTableRow(state = {}, block = {}, columns = [], row = {}, rowPosition = 0, rowSequence = 0, columnWidth = 0, dataBarRanges = new Map()) {
  const rowKey = `row_${normalizePositiveInteger(row?.rowIndex + 1) || rowSequence}`;
  const cellByKey = new Map(
    (Array.isArray(row?.cells) ? row.cells : [])
      .map((cell) => [normalizeString(cell?.key), cell])
      .filter(([key]) => !!key),
  );
  pushReportPrintElement(state, buildReportPrintLineElement({
    id: `${normalizeString(block?.id || "table")}__row_rule_${rowSequence}`,
    kind: "line",
    box: {
      x: state.contentLeft,
      y: rowPosition + REPORT_PRINT_THEME.tableRowHeight,
      width: state.contentWidth,
      height: 0,
    },
    strokeColor: REPORT_PRINT_THEME.tableBorderColor,
    strokeWidth: 1,
  }));
  columns.forEach((column, columnIndex) => {
    const columnKey = normalizeString(column?.key || columnIndex);
    const cell = cellByKey.get(columnKey) || null;
    const cellX = state.contentLeft + (columnIndex * columnWidth);
    const cellWidth = columnWidth;
    const cellInnerX = cellX + REPORT_PRINT_THEME.tableCellPaddingX;
    const cellInnerY = rowPosition + REPORT_PRINT_THEME.tableCellPaddingY;
    const cellInnerWidth = Math.max(1, cellWidth - (REPORT_PRINT_THEME.tableCellPaddingX * 2));
    const cellInnerHeight = REPORT_PRINT_THEME.tableRowHeight - (REPORT_PRINT_THEME.tableCellPaddingY * 2);
    const visualState = cell?.visualState || null;
    if (["dataBar", "progressBar", "sparkBar"].includes(normalizeString(visualState?.kind)) && typeof visualState?.value === "number") {
      const range = dataBarRanges.get(columnKey) || {
        min: visualState.value,
        max: visualState.value,
      };
      const palette = Array.isArray(visualState?.palette) ? visualState.palette : [];
      const trackRadius = Math.min(cellInnerHeight / 2, 8);
      const fillWidth = Math.max(0, cellInnerWidth * Math.max(0, Math.min(1, Number(visualState?.percent) || 0)));
      const normalizedVisualKind = normalizeString(visualState?.kind);
      const trackHeight = normalizedVisualKind === "progressBar"
        ? Math.max(6, Math.min(10, cellInnerHeight - 6))
        : normalizedVisualKind === "sparkBar"
          ? Math.max(10, Math.min(12, cellInnerHeight - 4))
        : cellInnerHeight;
      const trackY = normalizedVisualKind === "progressBar" || normalizedVisualKind === "sparkBar"
        ? cellInnerY + Math.max(0, (cellInnerHeight - trackHeight) / 2)
        : cellInnerY;
      const trackWidth = normalizedVisualKind === "sparkBar"
        ? Math.min(cellInnerWidth, 40)
        : cellInnerWidth;
      pushReportPrintElement(state, buildReportPrintRectElement({
        id: `${normalizeString(block?.id || "table")}__${rowKey}__${columnKey}__${normalizedVisualKind === "progressBar" ? "progress_track" : normalizedVisualKind === "sparkBar" ? "spark_track" : "bar_track"}`,
        kind: "rect",
        box: {
          x: cellInnerX,
          y: trackY,
          width: trackWidth,
          height: trackHeight,
        },
        fillColor: normalizeString(palette[0]) || REPORT_PRINT_THEME.dataBarBackground,
        radius: trackRadius,
      }));
      pushReportPrintElement(state, buildReportPrintTableCellDataBarElement({
        id: `${normalizeString(block?.id || "table")}__${rowKey}__${columnKey}__${normalizedVisualKind === "progressBar" ? "progress" : normalizedVisualKind === "sparkBar" ? "spark" : "bar"}`,
        kind: "tableCellDataBar",
        box: {
          x: cellInnerX,
          y: trackY,
          width: fillWidth > 0 ? Math.min(trackWidth, Math.max(6, normalizedVisualKind === "sparkBar" ? Math.round(trackWidth * Math.max(0, Math.min(1, Number(visualState?.percent) || 0))) : fillWidth)) : 0,
          height: trackHeight,
        },
        rowKey,
        columnKey,
        value: visualState.value,
        min: range.min,
        max: range.max,
        fillColor: normalizeString(palette[1]) || REPORT_PRINT_THEME.dataBarForeground,
        backgroundColor: normalizeString(palette[0]) || REPORT_PRINT_THEME.dataBarBackground,
      }));
    } else if (normalizeString(visualState?.kind) === "shareBar") {
      const segments = Array.isArray(visualState?.segments) ? visualState.segments : [];
      const trackRadius = Math.min(cellInnerHeight / 2, 8);
      pushReportPrintElement(state, buildReportPrintRectElement({
        id: `${normalizeString(block?.id || "table")}__${rowKey}__${columnKey}__share_track`,
        kind: "rect",
        box: {
          x: cellInnerX,
          y: cellInnerY + Math.max(0, (cellInnerHeight - 8) / 2),
          width: Math.min(cellInnerWidth, 72),
          height: 8,
        },
        fillColor: "#e5edf5",
        radius: trackRadius,
      }));
      let left = 0;
      const trackWidth = Math.min(cellInnerWidth, 72);
      segments.forEach((segment, index) => {
        const width = Math.max(0, trackWidth * Math.max(0, Math.min(1, Number(segment?.percent) || 0)));
        pushReportPrintElement(state, buildReportPrintRectElement({
          id: `${normalizeString(block?.id || "table")}__${rowKey}__${columnKey}__share_${index}`,
          kind: "rect",
          box: {
            x: cellInnerX + left,
            y: cellInnerY + Math.max(0, (cellInnerHeight - 8) / 2),
            width,
            height: 8,
          },
          fillColor: normalizeString(segment?.color) || "#137cbd",
          radius: trackRadius,
        }));
        left += width;
      });
      pushReportPrintElement(state, buildReportPrintTableCellTextElement({
        id: `${normalizeString(block?.id || "table")}__${rowKey}__${columnKey}__share_text`,
        kind: "tableCellText",
        box: {
          x: cellInnerX + trackWidth + 8,
          y: cellInnerY,
          width: Math.max(1, cellInnerWidth - trackWidth - 8),
          height: cellInnerHeight,
        },
        rowKey,
        columnKey,
        text: segments.map((segment) => `${normalizeString(segment?.label)} ${formatReportPrintValue(Number(segment?.percent) || 0, "percentFraction")}`).join(" · "),
        align: "left",
      }));
      return;
    } else if (normalizeString(visualState?.kind) === "badge") {
      const colors = resolveReportPrintTonePalette(visualState?.tone, state.reportTheme);
      pushReportPrintElement(state, buildReportPrintTableCellBadgeElement({
        id: `${normalizeString(block?.id || "table")}__${rowKey}__${columnKey}__badge`,
        kind: "tableCellBadge",
        box: {
          x: cellInnerX,
          y: cellInnerY,
          width: Math.max(32, Math.min(cellInnerWidth, (normalizeString(visualState?.label).length * 7) + 20)),
          height: cellInnerHeight,
        },
        rowKey,
        columnKey,
        label: normalizeString(visualState?.label),
        tone: normalizeString(visualState?.tone),
        backgroundColor: normalizeString(visualState?.backgroundColor) || colors.backgroundColor,
        borderColor: normalizeString(visualState?.borderColor) || colors.borderColor,
        textColor: normalizeString(visualState?.textColor) || colors.textColor,
      }));
      return;
    } else if (["tone", "delta", "rank"].includes(normalizeString(visualState?.kind))) {
      const colors = resolveReportPrintTonePalette(visualState?.tone, state.reportTheme);
      pushReportPrintElement(state, buildReportPrintTableCellToneElement({
        id: `${normalizeString(block?.id || "table")}__${rowKey}__${columnKey}__${normalizeString(visualState?.kind) || "tone"}`,
        kind: "tableCellTone",
        box: {
          x: cellInnerX,
          y: cellInnerY,
          width: Math.max(32, Math.min(cellInnerWidth, (normalizeString(visualState?.label).length * 7) + 20)),
          height: cellInnerHeight,
        },
        rowKey,
        columnKey,
        tone: normalizeString(visualState?.tone),
        label: normalizeString(visualState?.label),
        backgroundColor: normalizeString(visualState?.backgroundColor) || colors.backgroundColor,
        borderColor: normalizeString(visualState?.borderColor) || colors.borderColor,
        textColor: normalizeString(visualState?.textColor) || colors.textColor,
      }));
      return;
    }
    const mappedIcon = column?.displayIconMap && typeof column.displayIconMap === "object"
      ? normalizeString(column.displayIconMap[String(cell?.value ?? "")])
      : "";
    const mappedIconSvg = mappedIcon ? buildReportPrintMappedIconSvg(mappedIcon) : "";
    const iconWidth = mappedIconSvg ? 14 : 0;
    if (mappedIconSvg) {
      pushReportPrintElement(state, buildReportPrintSvgElement({
        id: `${normalizeString(block?.id || "table")}__${rowKey}__${columnKey}__icon`,
        kind: "svg",
        zIndex: 3,
        box: {
          x: cellInnerX,
          y: cellInnerY + Math.max(0, (cellInnerHeight - 12) / 2),
          width: 12,
          height: 12,
        },
        svg: mappedIconSvg,
      }));
    }
    pushReportPrintElement(state, buildReportPrintTableCellTextElement({
      id: `${normalizeString(block?.id || "table")}__${rowKey}__${columnKey}__text`,
      kind: "tableCellText",
      box: {
        x: cellInnerX + iconWidth,
        y: cellInnerY,
        width: Math.max(1, cellInnerWidth - iconWidth),
        height: cellInnerHeight,
      },
      rowKey,
      columnKey,
      text: formatReportPrintValue(
        cell?.displayValue !== undefined && cell?.displayValue !== null && cell?.displayValue !== ""
          ? cell.displayValue
          : cell?.value,
        normalizeString(column?.format),
      ),
      ...(normalizeString(column?.format) ? { format: normalizeString(column.format) } : {}),
      align: resolveReportPrintTableColumnAlign(column, cell),
    }));
  });
}

function renderReportPrintTableBlock(state = {}, block = {}, {
  layoutNote = "",
} = {}) {
  renderReportPrintSectionTitle(state, block, { layoutNote });
  const columns = Array.isArray(block?.content?.columns) ? block.content.columns : [];
  const rows = Array.isArray(block?.content?.resolvedRows) ? block.content.resolvedRows : [];
  if (columns.length === 0) {
    renderReportPrintTextLines(state, {
      idPrefix: `${normalizeString(block?.id || "table")}__empty`,
      lines: ["No table columns are available for print."],
      color: REPORT_PRINT_THEME.warningColor,
    });
    finishReportPrintBlock(state);
    return;
  }
  if (rows.length === 0) {
    renderReportPrintTextLines(state, {
      idPrefix: `${normalizeString(block?.id || "table")}__empty_rows`,
      lines: ["No rows are available for print."],
      color: REPORT_PRINT_THEME.mutedColor,
    });
    finishReportPrintBlock(state);
    return;
  }
  const columnWidth = state.contentWidth / columns.length;
  const dataBarRanges = buildReportPrintDataBarRanges(block);
  let rowIndex = 0;
  while (rowIndex < rows.length) {
    ensureReportPrintSpace(state, REPORT_PRINT_THEME.tableHeaderHeight + REPORT_PRINT_THEME.tableRowHeight);
    const headerY = state.cursorY;
    renderReportPrintTableHeader(state, block, columns, headerY, columnWidth);
    state.cursorY += REPORT_PRINT_THEME.tableHeaderHeight;
    while (rowIndex < rows.length) {
      ensureReportPrintPage(state);
      if (state.cursorY + REPORT_PRINT_THEME.tableRowHeight > state.contentBottom && state.cursorY > state.contentTop) {
        startNextReportPrintPage(state);
        break;
      }
      renderReportPrintTableRow(
        state,
        block,
        columns,
        rows[rowIndex],
        state.cursorY,
        rowIndex,
        columnWidth,
        dataBarRanges,
      );
      state.cursorY += REPORT_PRINT_THEME.tableRowHeight;
      rowIndex += 1;
    }
  }
  finishReportPrintBlock(state);
}

function renderReportPrintChartBlock(state = {}, block = {}, {
  layoutNote = "",
} = {}) {
  const svgResult = buildReportPrintChartSvg({
    chartModel: block?.content?.chartModel || block?.chartModel || {},
    resolvedChart: block?.content?.resolvedChart || null,
    width: state.contentWidth,
  });
  const titleHeight = REPORT_PRINT_THEME.titleLineHeight + (layoutNote ? REPORT_PRINT_THEME.warningLineHeight : 0) + 8;
  const chartHeight = svgResult?.svg ? Math.max(120, Number(svgResult.height) || 0) : REPORT_PRINT_THEME.bodyLineHeight;
  ensureReportPrintSpace(state, titleHeight + chartHeight);
  renderReportPrintSectionTitle(state, block, { layoutNote });
  if (!svgResult?.svg) {
    const placeholder = renderReportPrintTextLines(state, {
      idPrefix: `${normalizeString(block?.id || "chart")}__unsupported`,
      lines: ["Chart output is not available for this ReportPrint block."],
      color: REPORT_PRINT_THEME.warningColor,
    });
    (Array.isArray(svgResult?.diagnostics) ? svgResult.diagnostics : []).forEach((diagnostic) => {
      pushReportPrintDiagnostic(state, {
        ...diagnostic,
        pageNumber: state.currentPage?.number,
        elementId: placeholder?.id,
      });
    });
    finishReportPrintBlock(state);
    return;
  }
  ensureReportPrintSpace(state, chartHeight);
  const svgElement = pushReportPrintElement(state, buildReportPrintSvgElement({
    id: `${normalizeString(block?.id || "chart")}__svg_page_${state.currentPage?.number}`,
    kind: "svg",
    box: {
      x: state.contentLeft,
      y: state.cursorY,
      width: state.contentWidth,
      height: chartHeight,
    },
    svg: svgResult.svg,
  }));
  state.cursorY += chartHeight;
  (Array.isArray(svgResult?.diagnostics) ? svgResult.diagnostics : []).forEach((diagnostic) => {
    pushReportPrintDiagnostic(state, {
      ...diagnostic,
      pageNumber: state.currentPage?.number,
      elementId: svgElement?.id,
    });
  });
  finishReportPrintBlock(state);
}

function renderReportPrintGeoBlock(state = {}, block = {}, {
  layoutNote = "",
} = {}) {
  const svgResult = buildReportPrintGeoSvg({
    resolvedGeo: block?.content?.resolvedGeo || null,
    width: state.contentWidth,
  });
  const titleHeight = REPORT_PRINT_THEME.titleLineHeight + (layoutNote ? REPORT_PRINT_THEME.warningLineHeight : 0) + 8;
  const geoHeight = svgResult?.svg ? Math.max(140, Number(svgResult.height) || 0) : REPORT_PRINT_THEME.bodyLineHeight;
  ensureReportPrintSpace(state, titleHeight + geoHeight);
  renderReportPrintSectionTitle(state, block, { layoutNote });
  if (!svgResult?.svg) {
    const placeholder = renderReportPrintTextLines(state, {
      idPrefix: `${normalizeString(block?.id || "geo")}__unsupported`,
      lines: ["Geo output is not available for this ReportPrint block."],
      color: REPORT_PRINT_THEME.warningColor,
    });
    (Array.isArray(svgResult?.diagnostics) ? svgResult.diagnostics : []).forEach((diagnostic) => {
      pushReportPrintDiagnostic(state, {
        ...diagnostic,
        pageNumber: state.currentPage?.number,
        elementId: placeholder?.id,
      });
    });
    finishReportPrintBlock(state);
    return;
  }
  ensureReportPrintSpace(state, geoHeight);
  const svgElement = pushReportPrintElement(state, buildReportPrintSvgElement({
    id: `${normalizeString(block?.id || "geo")}__svg_page_${state.currentPage?.number}`,
    kind: "svg",
    box: {
      x: state.contentLeft,
      y: state.cursorY,
      width: state.contentWidth,
      height: geoHeight,
    },
    svg: svgResult.svg,
  }));
  state.cursorY += geoHeight;
  (Array.isArray(svgResult?.diagnostics) ? svgResult.diagnostics : []).forEach((diagnostic) => {
    pushReportPrintDiagnostic(state, {
      ...diagnostic,
      pageNumber: state.currentPage?.number,
      elementId: svgElement?.id,
    });
  });
  finishReportPrintBlock(state);
}

function renderUnsupportedReportPrintBlock(state = {}, block = {}, {
  layoutNote = "",
} = {}) {
  const kind = normalizeString(block?.kind || "block");
  renderReportPrintSectionTitle(state, block, { layoutNote });
  const placeholder = renderReportPrintTextLines(state, {
    idPrefix: `${normalizeString(block?.id || kind)}__unsupported`,
    lines: [`Unsupported ${kind} print lowering. This block remains outside the current deterministic ReportPrint subset.`],
    color: REPORT_PRINT_THEME.dangerColor,
  });
  pushReportPrintDiagnostic(state, {
    code: "unsupportedReportPrintBlock",
    severity: "warning",
    message: `ReportPrint lowering does not yet support ${kind}.`,
    pageNumber: state.currentPage?.number,
    elementId: placeholder?.id,
  });
  finishReportPrintBlock(state);
}

function renderReportPrintBlock(state = {}, block = {}, options = {}) {
  const kind = normalizeString(block?.kind);
  switch (kind) {
    case "markdownBlock":
      renderReportPrintMarkdownBlock(state, block, options);
      return;
    case "filterBarBlock":
      renderReportPrintFilterBarBlock(state, block, options);
      return;
    case "refinementBarBlock":
      renderReportPrintRefinementBarBlock(state, block, options);
      return;
    case "kpiBlock":
      renderReportPrintKpiBlock(state, block, options);
      return;
    case "badgesBlock":
      renderReportPrintBadgesBlock(state, block, options);
      return;
    case "sectionBlock":
      renderReportPrintSectionBlock(state, block, options);
      return;
    case "compositeBlock":
      renderReportPrintCompositeBlock(state, block, options);
      return;
    case "tabGroupBlock":
      renderReportPrintTabGroupBlock(state, block, options);
      return;
    case "stepperBlock":
      renderReportPrintStepperBlock(state, block, options);
      return;
    case "infoPanelBlock":
      renderReportPrintInfoPanelBlock(state, block, options);
      return;
    case "calloutBlock":
      renderReportPrintCalloutBlock(state, block, options);
      return;
    case "kanbanBlock":
      renderReportPrintKanbanBlock(state, block, options);
      return;
    case "timelineBlock":
      renderReportPrintTimelineBlock(state, block, options);
      return;
    case "collectionBlock":
      renderReportPrintCollectionBlock(state, block, options);
      return;
    case "tableBlock":
      renderReportPrintTableBlock(state, block, options);
      return;
    case "chartBlock":
      renderReportPrintChartBlock(state, block, options);
      return;
    case "geoMapBlock":
      renderReportPrintGeoBlock(state, block, options);
      return;
    default:
      renderUnsupportedReportPrintBlock(state, block, options);
  }
}

export function buildReportPrintFromReportFill({
  reportSpec = null,
  reportFill = null,
  pageGeometry = DEFAULT_REPORT_PRINT_PAGE_GEOMETRY,
} = {}) {
  if (
    !isPlainObject(reportSpec)
    || !isPlainObject(reportFill)
    || normalizeString(reportSpec?.kind) !== "reportSpec"
    || normalizeString(reportFill?.kind) !== "reportFill"
  ) {
    return null;
  }
  const state = buildReportPrintLayoutState(reportSpec, reportFill, pageGeometry);
  if (!state) {
    return null;
  }
  const orderedBlocks = buildOrderedReportFillBlocks(reportSpec, reportFill);
  let pendingRow = [];
  let pendingSpan = 0;
  const flushPendingRow = () => {
    if (pendingRow.length === 0) {
      return;
    }
    renderReportPrintGridRow(state, pendingRow);
    pendingRow = [];
    pendingSpan = 0;
  };
  for (let index = 0; index < orderedBlocks.length; index += 1) {
    const block = orderedBlocks[index];
    const blockId = normalizeString(block?.id);
    const span = resolveReportLayoutSpan(state.layoutSpanByBlockId.get(blockId));
    if (span >= REPORT_LAYOUT_GRID_COLUMNS) {
      flushPendingRow();
      renderReportPrintBlock(state, block, {});
      continue;
    }
    if (pendingRow.length > 0 && (pendingSpan + span) > REPORT_LAYOUT_GRID_COLUMNS) {
      flushPendingRow();
    }
    pendingRow.push({ block, span });
    pendingSpan += span;
    if (pendingSpan >= REPORT_LAYOUT_GRID_COLUMNS) {
      flushPendingRow();
    }
  }
  flushPendingRow();
  if (state.pages.length === 0) {
    startNextReportPrintPage(state);
    renderReportPrintTextLines(state, {
      idPrefix: "report_print_empty",
      lines: ["No print-ready blocks were produced."],
      color: REPORT_PRINT_THEME.warningColor,
    });
  }
  return buildReportPrintArtifact({
    reportSpec,
    reportFill,
    title: reportSpec?.title,
    pageGeometry: state.geometry,
    pages: state.pages,
    bookmarks: state.bookmarks,
    diagnostics: state.diagnostics,
  });
}

export function buildReportPrintArtifact({
  reportSpec = null,
  reportFill = null,
  title = "",
  pageGeometry = DEFAULT_REPORT_PRINT_PAGE_GEOMETRY,
  pages = [],
  bookmarks = [],
  diagnostics = [],
} = {}) {
  if (
    !isPlainObject(reportSpec)
    || !isPlainObject(reportFill)
    || normalizeString(reportSpec.kind) !== "reportSpec"
    || normalizeString(reportFill.kind) !== "reportFill"
  ) {
    return null;
  }
  const specVersion = normalizePositiveInteger(reportSpec.version);
  const fillVersion = normalizePositiveInteger(reportFill.version);
  const fillSpecVersion = normalizePositiveInteger(reportFill.specVersion);
  const specHash = buildReportSpecHash(reportSpec);
  const recordedSpecHash = normalizeString(reportFill.specHash);
  const fillHash = buildReportFillHash(reportFill);
  const normalizedSource = normalizeSource(reportFill.source || reportSpec.source);
  const normalizedTitle = normalizeString(title || reportSpec.title);
  const normalizedGeometry = buildReportPrintPageGeometry(pageGeometry);
  const normalizedPages = Array.isArray(pages) ? pages.map((page) => buildReportPrintPage(page)) : null;
  const normalizedBookmarks = Array.isArray(bookmarks) ? bookmarks.map((bookmark) => buildReportPrintBookmark(bookmark)) : null;
  const normalizedDiagnostics = Array.isArray(diagnostics) ? diagnostics.map((entry) => buildReportPrintDiagnostic(entry)) : null;
  const specSource = normalizeSource(reportSpec.source);
  const fillSource = normalizeSource(reportFill.source);
  if (
    specVersion == null
    || fillVersion == null
    || fillSpecVersion == null
    || fillSpecVersion !== specVersion
    || !specHash
    || !recordedSpecHash
    || recordedSpecHash !== specHash
    || !normalizedSource
    || !normalizedTitle
    || !normalizedGeometry
    || !normalizedPages
    || normalizedPages.length === 0
    || normalizedPages.some((page) => !page)
    || !normalizedBookmarks
    || normalizedBookmarks.some((bookmark) => !bookmark)
    || !normalizedDiagnostics
    || normalizedDiagnostics.some((entry) => !entry)
  ) {
    return null;
  }
  if (
    specSource
    && fillSource
    && stableSerialize(specSource) !== stableSerialize(fillSource)
  ) {
    return null;
  }
  return {
    version: 1,
    kind: "reportPrint",
    specVersion,
    specHash,
    fillVersion,
    fillHash,
    source: cloneValue(normalizedSource),
    title: normalizedTitle,
    pageGeometry: normalizedGeometry,
    pages: normalizedPages.map((page) => cloneValue(page)),
    bookmarks: normalizedBookmarks.map((bookmark) => cloneValue(bookmark)),
    diagnostics: normalizedDiagnostics.map((entry) => cloneValue(entry)),
  };
}
