import { formatExportNumericValue } from "./reportExportValueFormatter.js";
import { normalizeChartAnnotations, resolveChartAnnotationStrokeDasharray } from "./reportChartAnnotations.js";

function normalizeString(value = "") {
  return String(value || "").trim();
}

function normalizeNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function escapeXml(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const DEFAULT_REPORT_PRINT_CHART_PALETTE = [
  "#137cbd",
  "#0f9960",
  "#d9822b",
  "#8f398f",
  "#c23030",
  "#5c7080",
  "#2965cc",
  "#29a634",
];

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function buildChartDiagnostic(code = "", message = "") {
  const normalizedCode = normalizeString(code);
  const normalizedMessage = normalizeString(message);
  if (!normalizedCode || !normalizedMessage) {
    return null;
  }
  return {
    code: normalizedCode,
    severity: "warning",
    message: normalizedMessage,
  };
}

function resolveChartPalette(chartModel = {}) {
  const palette = Array.isArray(chartModel?.series?.palette) ? chartModel.series.palette : [];
  return palette.filter((entry) => normalizeString(entry)).length > 0
    ? palette.map((entry) => normalizeString(entry)).filter(Boolean)
    : DEFAULT_REPORT_PRINT_CHART_PALETTE;
}

function resolveCartesianSeriesDescriptors(chartModel = {}, resolvedChart = {}) {
  const chartType = normalizeString(chartModel?.type || resolvedChart?.type).toLowerCase();
  const palette = resolveChartPalette(chartModel);
  if (normalizeString(resolvedChart?.kind) === "directSeries") {
    const values = Array.isArray(chartModel?.series?.values) ? chartModel.series.values : [];
    return (Array.isArray(resolvedChart?.seriesKeys) ? resolvedChart.seriesKeys : [])
      .map((seriesKey, index) => {
        const normalizedKey = normalizeString(seriesKey);
        const matched = values.find((entry) => normalizeString(entry?.value) === normalizedKey) || null;
        if (!normalizedKey) {
          return null;
        }
        return {
          key: normalizedKey,
          label: normalizeString(matched?.label || normalizedKey),
          type: normalizeString(matched?.type || chartType) || chartType,
          color: normalizeString(matched?.color || palette[index % palette.length]) || palette[index % palette.length],
          format: normalizeString(matched?.format),
          dataLabels: normalizeString(matched?.dataLabels).toLowerCase(),
          pointColorMode: normalizeString(matched?.pointColorMode),
        };
      })
      .filter(Boolean);
  }
  if (normalizeString(resolvedChart?.kind) === "groupedSeries") {
    return (Array.isArray(resolvedChart?.seriesKeys) ? resolvedChart.seriesKeys : [])
      .map((seriesKey, index) => {
        const normalizedKey = normalizeString(seriesKey);
        if (!normalizedKey) {
          return null;
        }
        return {
          key: normalizedKey,
          label: normalizedKey,
          type: chartType,
          color: palette[index % palette.length],
          format: "",
          dataLabels: "",
          pointColorMode: "",
        };
      })
      .filter(Boolean);
  }
  return [];
}

function resolveCategorySlices(resolvedChart = {}) {
  return (Array.isArray(resolvedChart?.rows) ? resolvedChart.rows : [])
    .map((row) => ({
      name: normalizeString(row?.name),
      value: normalizeNumber(row?.value) || 0,
    }))
    .filter((entry) => entry.name);
}

function resolveCartesianRows(resolvedChart = {}) {
  return (Array.isArray(resolvedChart?.rows) ? resolvedChart.rows : [])
    .map((row) => cloneValue(row))
    .filter((row) => row && typeof row === "object" && !Array.isArray(row));
}

function resolveChartSupportedSeriesType(type = "") {
  const normalized = normalizeString(type).toLowerCase();
  if (normalized === "funnel_bar") {
    return "horizontal_bar";
  }
  return ["line", "area", "bar", "horizontal_bar"].includes(normalized) ? normalized : "";
}

function formatAxisTick(value, format = "") {
  return formatExportNumericValue(value, format, { axis: true });
}

function formatSeriesDataLabel(value, format = "") {
  const normalizedFormat = normalizeString(format);
  if (!normalizedFormat) {
    const numeric = normalizeNumber(value);
    if (numeric != null) {
      if (Number.isInteger(numeric)) {
        return numeric.toLocaleString("en-US");
      }
      return numeric.toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
    }
  }
  return formatExportNumericValue(value, normalizedFormat || "number", { axis: false });
}

function resolveSeriesPointColor(series = {}, value, fallbackColor = "") {
  const mode = normalizeString(series?.pointColorMode);
  if (mode !== "bySign") {
    return fallbackColor || series?.color || "#137cbd";
  }
  const numericValue = normalizeNumber(value);
  if (numericValue == null) {
    return fallbackColor || series?.color || "#137cbd";
  }
  if (numericValue > 0) {
    return "#0f9960";
  }
  if (numericValue < 0) {
    return "#db3737";
  }
  return "#98a2b3";
}

function shouldRenderReportPrintSeriesDataLabels(series = {}, chartType = "", rowCount = 0, {
  defaultHorizontal = false,
} = {}) {
  const mode = normalizeString(series?.dataLabels).toLowerCase();
  if (mode === "none") {
    return false;
  }
  if (mode === "always") {
    return true;
  }
  if (mode === "auto") {
    if (chartType === "horizontal_bar" || chartType === "funnel_bar") {
      return rowCount <= 12;
    }
    if (chartType === "bar") {
      return rowCount <= 10;
    }
    if (chartType === "line" || chartType === "area") {
      return rowCount <= 8;
    }
    return false;
  }
  return defaultHorizontal && (chartType === "horizontal_bar" || chartType === "funnel_bar");
}

function computeCartesianValueBounds(rows = [], seriesDescriptors = []) {
  const values = [];
  rows.forEach((row) => {
    seriesDescriptors.forEach((series) => {
      const numeric = normalizeNumber(row?.[series.key]);
      if (numeric != null) {
        values.push(numeric);
      }
    });
  });
  if (values.length === 0) {
    return null;
  }
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(0, ...values);
  return {
    minValue,
    maxValue: maxValue === minValue ? maxValue + 1 : maxValue,
  };
}

function normalizeComparableValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const normalized = normalizeString(value);
  if (!normalized) {
    return null;
  }
  const numeric = Number(normalized);
  if (Number.isFinite(numeric) && /^-?\d+(\.\d+)?$/.test(normalized)) {
    return numeric;
  }
  return normalized;
}

function escapeStrokeDasharray(value = "") {
  const normalized = normalizeString(value);
  return normalized ? ` stroke-dasharray="${escapeXml(normalized)}"` : "";
}

function buildAnnotationTextSvg({
  label = "",
  x = 0,
  y = 0,
  anchor = "start",
  color = "#475467",
} = {}) {
  const normalizedLabel = normalizeString(label);
  if (!normalizedLabel) {
    return "";
  }
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="10" font-weight="600" fill="${escapeXml(color)}">${escapeXml(normalizedLabel)}</text>`;
}

function resolveCategoricalIndex(rows = [], fieldKey = "", value) {
  const normalizedFieldKey = normalizeString(fieldKey);
  const comparableValue = normalizeComparableValue(value);
  if (!normalizedFieldKey || comparableValue == null) {
    return -1;
  }
  return rows.findIndex((row) => normalizeComparableValue(row?.[normalizedFieldKey]) === comparableValue);
}

function resolveCartesianCategoryXPosition(rows = [], xAxisKey = "", xPositions = [], value) {
  const index = resolveCategoricalIndex(rows, xAxisKey, value);
  return index >= 0 ? xPositions[index] ?? null : null;
}

function renderCartesianAnnotationsSvg({
  chartModel = {},
  rows = [],
  xAxisKey = "",
  xPositions = [],
  leftPad = 0,
  plotWidth = 0,
  topPad = 0,
  plotHeight = 0,
  bounds = null,
} = {}) {
  const annotations = normalizeChartAnnotations(chartModel);
  if (annotations.length === 0 || !bounds) {
    return {
      background: "",
      foreground: "",
    };
  }

  const valueRange = bounds.maxValue - bounds.minValue || 1;
  const categoryHalfStep = rows.length > 1
    ? Math.abs((xPositions[1] || leftPad) - (xPositions[0] || leftPad)) / 2
    : Math.max(18, plotWidth * 0.08);
  const resolveY = (value) => {
    const numeric = normalizeNumber(value);
    if (numeric == null) {
      return null;
    }
    return topPad + (((bounds.maxValue - numeric) / valueRange) * plotHeight);
  };

  const background = [];
  const foreground = [];

  annotations.forEach((annotation) => {
    if (annotation?.kind === "band") {
      if (annotation.axis === "y") {
        const y1 = resolveY(annotation.from);
        const y2 = resolveY(annotation.to);
        if (y1 == null || y2 == null) {
          return;
        }
        const y = Math.min(y1, y2);
        const height = Math.max(1, Math.abs(y2 - y1));
        background.push(
          `<rect x="${leftPad}" y="${y}" width="${plotWidth}" height="${height}" fill="${escapeXml(annotation.color)}" fill-opacity="${annotation.opacity ?? 0.12}" />`,
        );
        if (annotation.label) {
          background.push(buildAnnotationTextSvg({
            label: annotation.label,
            x: leftPad + 8,
            y: y + 12,
            color: annotation.color,
          }));
        }
        return;
      }
      const x1 = resolveCartesianCategoryXPosition(rows, xAxisKey, xPositions, annotation.from);
      const x2 = resolveCartesianCategoryXPosition(rows, xAxisKey, xPositions, annotation.to);
      if (x1 == null || x2 == null) {
        return;
      }
      const x = Math.min(x1, x2) - categoryHalfStep;
      const width = Math.max(2, Math.abs(x2 - x1) + (categoryHalfStep * 2));
      background.push(
        `<rect x="${x}" y="${topPad}" width="${width}" height="${plotHeight}" fill="${escapeXml(annotation.color)}" fill-opacity="${annotation.opacity ?? 0.12}" />`,
      );
      if (annotation.label) {
        background.push(buildAnnotationTextSvg({
          label: annotation.label,
          x: x + 8,
          y: topPad + 12,
          color: annotation.color,
        }));
      }
      return;
    }

    if (annotation?.kind === "note") {
      const x = resolveCartesianCategoryXPosition(rows, xAxisKey, xPositions, annotation.x);
      const y = resolveY(annotation.y);
      if (x == null || y == null) {
        return;
      }
      foreground.push(`<circle cx="${x}" cy="${y}" r="4" fill="${escapeXml(annotation.color)}" />`);
      foreground.push(buildAnnotationTextSvg({
        label: annotation.label,
        x: x + 8,
        y: y - 8,
        color: annotation.color,
      }));
      return;
    }

    const dash = escapeStrokeDasharray(resolveChartAnnotationStrokeDasharray(annotation?.lineStyle));
    if (annotation?.kind === "verticalMarker" || (annotation?.kind === "referenceLine" && annotation?.axis === "x")) {
      const x = resolveCartesianCategoryXPosition(rows, xAxisKey, xPositions, annotation.value);
      if (x == null) {
        return;
      }
      foreground.push(`<line x1="${x}" y1="${topPad}" x2="${x}" y2="${topPad + plotHeight}" stroke="${escapeXml(annotation.color)}" stroke-width="2"${dash} />`);
      if (annotation.label) {
        foreground.push(buildAnnotationTextSvg({
          label: annotation.label,
          x: x + 6,
          y: topPad + 12,
          color: annotation.color,
        }));
      }
      return;
    }

    if (annotation?.kind === "referenceLine" && annotation?.axis === "y") {
      const y = resolveY(annotation.value);
      if (y == null) {
        return;
      }
      foreground.push(`<line x1="${leftPad}" y1="${y}" x2="${leftPad + plotWidth}" y2="${y}" stroke="${escapeXml(annotation.color)}" stroke-width="2"${dash} />`);
      if (annotation.label) {
        foreground.push(buildAnnotationTextSvg({
          label: annotation.label,
          x: leftPad + plotWidth - 6,
          y: y - 6,
          anchor: "end",
          color: annotation.color,
        }));
      }
    }
  });

  return {
    background: background.join("\n"),
    foreground: foreground.join("\n"),
  };
}

function renderHorizontalBarAnnotationsSvg({
  chartModel = {},
  rows = [],
  xAxisKey = "",
  leftPad = 0,
  plotWidth = 0,
  topPad = 0,
  plotHeight = 0,
  rowHeight = 0,
  groupGap = 0,
  bounds = null,
} = {}) {
  const annotations = normalizeChartAnnotations(chartModel);
  if (annotations.length === 0 || !bounds) {
    return {
      background: "",
      foreground: "",
    };
  }

  const valueRange = bounds.maxValue - bounds.minValue || 1;
  const resolveX = (value) => {
    const numeric = normalizeNumber(value);
    if (numeric == null) {
      return null;
    }
    return leftPad + (((numeric - bounds.minValue) / valueRange) * plotWidth);
  };
  const resolveCategoryCenterY = (value) => {
    const rowIndex = resolveCategoricalIndex(rows, xAxisKey, value);
    if (rowIndex < 0) {
      return null;
    }
    const groupTop = topPad + (rowIndex * (rowHeight + groupGap));
    return groupTop + (rowHeight / 2);
  };
  const categoryHalfStep = rowHeight / 2;
  const background = [];
  const foreground = [];

  annotations.forEach((annotation) => {
    if (annotation?.kind === "band") {
      if (annotation.axis === "y") {
        const y1 = resolveCategoryCenterY(annotation.from);
        const y2 = resolveCategoryCenterY(annotation.to);
        if (y1 == null || y2 == null) {
          return;
        }
        const y = Math.min(y1, y2) - categoryHalfStep;
        const height = Math.max(2, Math.abs(y2 - y1) + (categoryHalfStep * 2));
        background.push(
          `<rect x="${leftPad}" y="${y}" width="${plotWidth}" height="${height}" fill="${escapeXml(annotation.color)}" fill-opacity="${annotation.opacity ?? 0.12}" />`,
        );
        if (annotation.label) {
          background.push(buildAnnotationTextSvg({
            label: annotation.label,
            x: leftPad + 8,
            y: y + 12,
            color: annotation.color,
          }));
        }
        return;
      }
      const x1 = resolveX(annotation.from);
      const x2 = resolveX(annotation.to);
      if (x1 == null || x2 == null) {
        return;
      }
      const x = Math.min(x1, x2);
      const width = Math.max(2, Math.abs(x2 - x1));
      background.push(
        `<rect x="${x}" y="${topPad}" width="${width}" height="${plotHeight}" fill="${escapeXml(annotation.color)}" fill-opacity="${annotation.opacity ?? 0.12}" />`,
      );
      if (annotation.label) {
        background.push(buildAnnotationTextSvg({
          label: annotation.label,
          x: x + 8,
          y: topPad + 12,
          color: annotation.color,
        }));
      }
      return;
    }

    if (annotation?.kind === "note") {
      const x = resolveX(annotation.x);
      const y = typeof annotation.y === "string"
        ? resolveCategoryCenterY(annotation.y)
        : null;
      if (x == null || y == null) {
        return;
      }
      foreground.push(`<circle cx="${x}" cy="${y}" r="4" fill="${escapeXml(annotation.color)}" />`);
      foreground.push(buildAnnotationTextSvg({
        label: annotation.label,
        x: x + 8,
        y: y - 8,
        color: annotation.color,
      }));
      return;
    }

    const dash = escapeStrokeDasharray(resolveChartAnnotationStrokeDasharray(annotation?.lineStyle));
    if (annotation?.kind === "verticalMarker" || (annotation?.kind === "referenceLine" && annotation?.axis === "x")) {
      const x = resolveX(annotation.value);
      if (x == null) {
        return;
      }
      foreground.push(`<line x1="${x}" y1="${topPad}" x2="${x}" y2="${topPad + plotHeight}" stroke="${escapeXml(annotation.color)}" stroke-width="2"${dash} />`);
      if (annotation.label) {
        foreground.push(buildAnnotationTextSvg({
          label: annotation.label,
          x: x + 6,
          y: topPad + 12,
          color: annotation.color,
        }));
      }
      return;
    }

    if (annotation?.kind === "referenceLine" && annotation?.axis === "y") {
      const y = resolveCategoryCenterY(annotation.value);
      if (y == null) {
        return;
      }
      foreground.push(`<line x1="${leftPad}" y1="${y}" x2="${leftPad + plotWidth}" y2="${y}" stroke="${escapeXml(annotation.color)}" stroke-width="2"${dash} />`);
      if (annotation.label) {
        foreground.push(buildAnnotationTextSvg({
          label: annotation.label,
          x: leftPad + plotWidth - 6,
          y: y - 6,
          anchor: "end",
          color: annotation.color,
        }));
      }
    }
  });

  return {
    background: background.join("\n"),
    foreground: foreground.join("\n"),
  };
}

function buildLegendSvg(seriesDescriptors = [], width = 680, y = 0) {
  const itemWidth = 160;
  const rowHeight = 18;
  const perRow = Math.max(1, Math.floor(Math.max(width, itemWidth) / itemWidth));
  const items = seriesDescriptors.map((series, index) => {
    const column = index % perRow;
    const row = Math.floor(index / perRow);
    const itemX = 12 + (column * itemWidth);
    const itemY = y + (row * rowHeight);
    return `
      <rect x="${itemX}" y="${itemY + 3}" width="12" height="12" rx="2" fill="${escapeXml(series.color)}" />
      <text x="${itemX + 18}" y="${itemY + 14}" font-size="11" fill="#344054">${escapeXml(series.label)}</text>
    `;
  }).join("\n");
  return {
    svg: items,
    height: (Math.ceil(seriesDescriptors.length / perRow) * rowHeight) + 4,
  };
}

function buildPolylinePath(points = []) {
  if (points.length === 0) {
    return "";
  }
  return points.map((point, index) => (
    `${index === 0 ? "M" : "L"}${point.x},${point.y}`
  )).join(" ");
}

function buildAreaPath(points = [], baselineY = 0) {
  if (points.length === 0) {
    return "";
  }
  const line = buildPolylinePath(points);
  const closing = [
    `L${points[points.length - 1].x},${baselineY}`,
    `L${points[0].x},${baselineY}`,
    "Z",
  ].join(" ");
  return `${line} ${closing}`;
}

function resolveArcSegmentCount(angle = 0) {
  const fraction = Math.max(0, Math.abs(angle) / (Math.PI * 2));
  return Math.max(6, Math.ceil(fraction * 48));
}

function buildArcPoints({
  cx = 0,
  cy = 0,
  radius = 0,
  startAngle = 0,
  endAngle = 0,
  segmentCount = 12,
} = {}) {
  if (radius <= 0 || segmentCount < 1) {
    return [];
  }
  return Array.from({ length: segmentCount + 1 }, (_, index) => {
    const t = index / segmentCount;
    const angle = startAngle + ((endAngle - startAngle) * t);
    return {
      x: cx + (radius * Math.cos(angle)),
      y: cy + (radius * Math.sin(angle)),
    };
  });
}

function buildClosedPath(points = []) {
  if (points.length === 0) {
    return "";
  }
  return points.map((point, index) => (
    `${index === 0 ? "M" : "L"}${point.x},${point.y}`
  )).join(" ") + " Z";
}

function renderCategoryChartSvg({
  chartModel = {},
  resolvedChart = {},
  width = 680,
} = {}) {
  const slices = resolveCategorySlices(resolvedChart);
  if (slices.length === 0) {
    return {
      svg: "",
      height: 0,
      diagnostics: [
        buildChartDiagnostic("emptyReportPrintChart", "Chart block has no category rows to lower into ReportPrint."),
      ].filter(Boolean),
    };
  }
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  if (total <= 0) {
    return {
      svg: "",
      height: 0,
      diagnostics: [
        buildChartDiagnostic("emptyReportPrintChart", "Chart block category values are empty for ReportPrint."),
      ].filter(Boolean),
    };
  }
  const palette = resolveChartPalette(chartModel);
  const chartType = normalizeString(chartModel?.type || resolvedChart?.type).toLowerCase();
  const size = Math.max(180, Math.min(240, Math.floor(width * 0.42)));
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.36;
  const innerRadius = chartType === "donut" ? r * 0.56 : 0;
  let startAngle = -Math.PI / 2;
  const paths = slices.map((slice, index) => {
    const fraction = slice.value / total;
    const angle = fraction * 2 * Math.PI;
    const endAngle = startAngle + angle;
    const fill = palette[index % palette.length];
    const outerPath = (() => {
      if (slices.length === 1) {
        return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${escapeXml(fill)}" />`;
      }
      const segmentCount = resolveArcSegmentCount(angle);
      const outerArcPoints = buildArcPoints({
        cx,
        cy,
        radius: r,
        startAngle,
        endAngle,
        segmentCount,
      });
      if (innerRadius > 0) {
        const innerArcPoints = buildArcPoints({
          cx,
          cy,
          radius: innerRadius,
          startAngle: endAngle,
          endAngle: startAngle,
          segmentCount,
        });
        return `<path d="${buildClosedPath([...outerArcPoints, ...innerArcPoints])}" fill="${escapeXml(fill)}" />`;
      }
      return `<path d="${buildClosedPath([{ x: cx, y: cy }, ...outerArcPoints])}" fill="${escapeXml(fill)}" />`;
    })();
    startAngle = endAngle;
    return outerPath;
  }).join("\n");
  const legendX = size + 20;
  const legendY = 18;
  const legend = slices.map((slice, index) => {
    const fill = palette[index % palette.length];
    const pct = ((slice.value / total) * 100).toFixed(0);
    const y = legendY + (index * 20);
    return `
      <rect x="${legendX}" y="${y}" width="12" height="12" rx="2" fill="${escapeXml(fill)}" />
      <text x="${legendX + 18}" y="${y + 11}" font-size="11" fill="#344054">${escapeXml(slice.name)} — ${escapeXml(pct)}%</text>
    `;
  }).join("\n");
  const donutHole = innerRadius > 0
    ? `<circle cx="${cx}" cy="${cy}" r="${innerRadius}" fill="#ffffff" />`
    : "";
  const height = Math.max(size, (slices.length * 20) + 24);
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
      ${paths}
      ${donutHole}
      ${legend}
    </svg>`,
    height,
    diagnostics: [],
  };
}

function renderCartesianChartSvg({
  chartModel = {},
  resolvedChart = {},
  width = 680,
} = {}) {
  const rows = resolveCartesianRows(resolvedChart);
  const seriesDescriptors = resolveCartesianSeriesDescriptors(chartModel, resolvedChart);
  if (rows.length === 0 || seriesDescriptors.length === 0) {
    return {
      svg: "",
      height: 0,
      diagnostics: [
        buildChartDiagnostic("emptyReportPrintChart", "Chart block has no cartesian rows to lower into ReportPrint."),
      ].filter(Boolean),
    };
  }
  const unsupportedSeries = seriesDescriptors.filter((series) => !resolveChartSupportedSeriesType(series.type));
  if (unsupportedSeries.length > 0) {
    return {
      svg: "",
      height: 0,
      diagnostics: [
        buildChartDiagnostic(
          "unsupportedReportPrintChartType",
          `ReportPrint chart lowering does not yet support series types: ${unsupportedSeries.map((series) => series.type).join(", ")}.`,
        ),
      ],
    };
  }
  const bounds = computeCartesianValueBounds(rows, seriesDescriptors);
  if (!bounds) {
    return {
      svg: "",
      height: 0,
      diagnostics: [
        buildChartDiagnostic("emptyReportPrintChart", "Chart block has no numeric series values to lower into ReportPrint."),
      ].filter(Boolean),
    };
  }

  const leftPad = 52;
  const rightPad = 16;
  const topPad = 16;
  const bottomPad = 34;
  const plotHeight = 180;
  const plotWidth = Math.max(200, width - leftPad - rightPad);
  const xAxisKey = normalizeString(resolvedChart?.xAxisKey);
  const valueRange = bounds.maxValue - bounds.minValue || 1;
  const baselineY = topPad + ((bounds.maxValue - 0) / valueRange) * plotHeight;
  const xPositions = rows.map((row, index) => {
    if (rows.length === 1) {
      return leftPad + (plotWidth / 2);
    }
    return leftPad + (index * (plotWidth / (rows.length - 1)));
  });
  const labelStep = Math.max(1, Math.ceil(rows.length / 6));
  const legend = buildLegendSvg(seriesDescriptors, width, plotHeight + bottomPad + 4);
  const height = topPad + plotHeight + bottomPad + legend.height + 12;
  const annotations = renderCartesianAnnotationsSvg({
    chartModel,
    rows,
    xAxisKey,
    xPositions,
    leftPad,
    plotWidth,
    topPad,
    plotHeight,
    bounds,
  });

  const yTicks = Array.from({ length: 4 }, (_, index) => {
    const fraction = index / 3;
    const value = bounds.maxValue - (fraction * valueRange);
    const y = topPad + (fraction * plotHeight);
    return {
      value,
      y,
    };
  });

  const gridLines = yTicks.map((tick) => `
    <line x1="${leftPad}" y1="${tick.y}" x2="${leftPad + plotWidth}" y2="${tick.y}" stroke="#eaecf0" stroke-width="1" />
    <text x="${leftPad - 8}" y="${tick.y + 4}" text-anchor="end" font-size="10" fill="#667085">${escapeXml(formatAxisTick(tick.value, seriesDescriptors[0]?.format))}</text>
  `).join("\n");

  const xAxisLabels = rows.map((row, index) => {
    if (index % labelStep !== 0 && index !== rows.length - 1) {
      return "";
    }
    const label = normalizeString(row?.[xAxisKey]).slice(0, 14);
    return `
      <text x="${xPositions[index]}" y="${topPad + plotHeight + 18}" text-anchor="middle" font-size="10" fill="#667085">${escapeXml(label)}</text>
    `;
  }).join("\n");

  const barSeries = seriesDescriptors.filter((series) => resolveChartSupportedSeriesType(series.type) === "bar");
  const groupWidth = Math.min(48, Math.max(14, (plotWidth / Math.max(rows.length, 1)) * 0.56));
  const barWidth = barSeries.length > 0 ? Math.max(8, groupWidth / barSeries.length) : 0;

  const renderedSeries = seriesDescriptors.map((series, seriesIndex) => {
    const supportedType = resolveChartSupportedSeriesType(series.type);
    const points = rows.map((row, rowIndex) => {
      const value = normalizeNumber(row?.[series.key]);
      if (value == null) {
        return null;
      }
      const x = xPositions[rowIndex];
      const y = topPad + (((bounds.maxValue - value) / valueRange) * plotHeight);
      return { x, y, value, rowIndex };
    }).filter(Boolean);

    if (supportedType === "bar") {
      const barOffset = barSeries.findIndex((entry) => entry.key === series.key);
      const bars = points.map((point) => {
        const x = point.x - (groupWidth / 2) + (barOffset * barWidth);
        const y = Math.min(point.y, baselineY);
        const barHeight = Math.max(1, Math.abs(baselineY - point.y));
        const fillColor = resolveSeriesPointColor(series, point.value, series.color);
        const label = shouldRenderReportPrintSeriesDataLabels(series, supportedType, rows.length)
          ? `<text x="${x + ((barWidth - 1) / 2)}" y="${y - 4}" text-anchor="middle" font-size="10" fill="#667085">${escapeXml(formatSeriesDataLabel(point.value, series.format))}</text>`
          : "";
        return `
          <rect x="${x}" y="${y}" width="${barWidth - 1}" height="${barHeight}" rx="2" fill="${escapeXml(fillColor)}" />
          ${label}
        `;
      }).join("\n");
      return bars;
    }

    const path = buildPolylinePath(points);
    const markers = points.map((point) => `
      <circle cx="${point.x}" cy="${point.y}" r="2.5" fill="${escapeXml(resolveSeriesPointColor(series, point.value, series.color))}" />
    `).join("\n");
    const labels = shouldRenderReportPrintSeriesDataLabels(series, supportedType, rows.length)
      ? points.map((point) => `
      <text x="${point.x}" y="${point.y - 6}" text-anchor="middle" font-size="10" fill="#667085">${escapeXml(formatSeriesDataLabel(point.value, series.format))}</text>
    `).join("\n")
      : "";
    if (supportedType === "area") {
      return `
        <path d="${buildAreaPath(points, baselineY)}" fill="${escapeXml(series.color)}" fill-opacity="0.18" stroke="none" />
        <path d="${path}" fill="none" stroke="${escapeXml(series.color)}" stroke-width="2" />
        ${markers}
        ${labels}
      `;
    }
    return `
      <path d="${path}" fill="none" stroke="${escapeXml(series.color)}" stroke-width="2" />
      ${markers}
      ${labels}
    `;
  }).join("\n");

  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
      ${gridLines}
      ${annotations.background}
      <line x1="${leftPad}" y1="${baselineY}" x2="${leftPad + plotWidth}" y2="${baselineY}" stroke="#98a2b3" stroke-width="1" />
      <line x1="${leftPad}" y1="${topPad}" x2="${leftPad}" y2="${topPad + plotHeight}" stroke="#98a2b3" stroke-width="1" />
      ${renderedSeries}
      ${annotations.foreground}
      ${xAxisLabels}
      ${legend.svg}
    </svg>`,
    height,
    diagnostics: [],
  };
}

function renderHorizontalBarChartSvg({
  chartModel = {},
  resolvedChart = {},
  width = 680,
} = {}) {
  const rows = resolveCartesianRows(resolvedChart);
  const seriesDescriptors = resolveCartesianSeriesDescriptors(chartModel, resolvedChart);
  if (rows.length === 0 || seriesDescriptors.length === 0) {
    return {
      svg: "",
      height: 0,
      diagnostics: [
        buildChartDiagnostic("emptyReportPrintChart", "Chart block has no cartesian rows to lower into ReportPrint."),
      ].filter(Boolean),
    };
  }
  const unsupportedSeries = seriesDescriptors.filter((series) => resolveChartSupportedSeriesType(series.type) !== "horizontal_bar");
  if (unsupportedSeries.length > 0) {
    return {
      svg: "",
      height: 0,
      diagnostics: [
        buildChartDiagnostic(
          "unsupportedReportPrintChartType",
          `ReportPrint chart lowering does not yet support series types: ${unsupportedSeries.map((series) => series.type).join(", ")}.`,
        ),
      ],
    };
  }
  const bounds = computeCartesianValueBounds(rows, seriesDescriptors);
  if (!bounds) {
    return {
      svg: "",
      height: 0,
      diagnostics: [
        buildChartDiagnostic("emptyReportPrintChart", "Chart block has no numeric series values to lower into ReportPrint."),
      ].filter(Boolean),
    };
  }

  const leftPad = 116;
  const rightPad = 20;
  const topPad = 16;
  const bottomPad = 34;
  const plotWidth = Math.max(200, width - leftPad - rightPad);
  const xAxisKey = normalizeString(resolvedChart?.xAxisKey);
  const valueRange = bounds.maxValue - bounds.minValue || 1;
  const baselineX = leftPad + (((0 - bounds.minValue) / valueRange) * plotWidth);
  const groupGap = 10;
  const rowHeight = seriesDescriptors.length > 1 ? 42 : 28;
  const perSeriesHeight = Math.max(10, Math.floor((rowHeight - (Math.max(0, seriesDescriptors.length - 1) * 4)) / Math.max(seriesDescriptors.length, 1)));
  const plotHeight = Math.max(80, (rows.length * rowHeight) + (Math.max(0, rows.length - 1) * groupGap));
  const legend = buildLegendSvg(seriesDescriptors, width, topPad + plotHeight + bottomPad + 4);
  const height = topPad + plotHeight + bottomPad + legend.height + 12;
  const annotations = renderHorizontalBarAnnotationsSvg({
    chartModel,
    rows,
    xAxisKey,
    leftPad,
    plotWidth,
    topPad,
    plotHeight,
    rowHeight,
    groupGap,
    bounds,
  });

  const xTicks = Array.from({ length: 4 }, (_, index) => {
    const fraction = index / 3;
    const value = bounds.minValue + (fraction * valueRange);
    const x = leftPad + (fraction * plotWidth);
    return {
      value,
      x,
    };
  });

  const gridLines = xTicks.map((tick) => `
    <line x1="${tick.x}" y1="${topPad}" x2="${tick.x}" y2="${topPad + plotHeight}" stroke="#eaecf0" stroke-width="1" />
    <text x="${tick.x}" y="${topPad + plotHeight + 18}" text-anchor="middle" font-size="10" fill="#667085">${escapeXml(formatAxisTick(tick.value, seriesDescriptors[0]?.format))}</text>
  `).join("\n");

  const categoryLabels = rows.map((row, rowIndex) => {
    const groupTop = topPad + (rowIndex * (rowHeight + groupGap));
    const label = normalizeString(row?.[xAxisKey]).slice(0, 18);
    return `
      <text x="${leftPad - 8}" y="${groupTop + (rowHeight / 2) + 4}" text-anchor="end" font-size="10" fill="#344054">${escapeXml(label)}</text>
    `;
  }).join("\n");

  const renderedSeries = seriesDescriptors.map((series, seriesIndex) => (
    rows.map((row, rowIndex) => {
      const value = normalizeNumber(row?.[series.key]);
      if (value == null) {
        return "";
      }
      const groupTop = topPad + (rowIndex * (rowHeight + groupGap));
      const barY = groupTop + (seriesIndex * (perSeriesHeight + 4));
      const valueX = leftPad + (((value - bounds.minValue) / valueRange) * plotWidth);
      const x = Math.min(baselineX, valueX);
      const barWidth = Math.max(1, Math.abs(valueX - baselineX));
      const labelX = value >= 0 ? valueX + 6 : valueX - 6;
      const labelAnchor = value >= 0 ? "start" : "end";
      const fillColor = resolveSeriesPointColor(series, value, series.color);
      const valueLabel = shouldRenderReportPrintSeriesDataLabels(series, "horizontal_bar", rows.length, { defaultHorizontal: true })
        ? `<text x="${labelX}" y="${barY + perSeriesHeight - 2}" text-anchor="${labelAnchor}" font-size="10" fill="#667085">${escapeXml(formatSeriesDataLabel(value, series.format))}</text>`
        : "";
      return `
        <rect x="${x}" y="${barY}" width="${barWidth}" height="${perSeriesHeight}" rx="2" fill="${escapeXml(fillColor)}" />
        ${valueLabel}
      `;
    }).join("\n")
  )).join("\n");

  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
      ${gridLines}
      ${annotations.background}
      <line x1="${baselineX}" y1="${topPad}" x2="${baselineX}" y2="${topPad + plotHeight}" stroke="#98a2b3" stroke-width="1" />
      ${categoryLabels}
      ${renderedSeries}
      ${annotations.foreground}
      ${legend.svg}
    </svg>`,
    height,
    diagnostics: [],
  };
}

export function buildReportPrintChartSvg({
  chartModel = {},
  resolvedChart = {},
  width = 680,
} = {}) {
  const kind = normalizeString(resolvedChart?.kind);
  if (kind === "category") {
    return renderCategoryChartSvg({ chartModel, resolvedChart, width });
  }
  if (kind === "directSeries" || kind === "groupedSeries") {
    const normalizedChartType = normalizeString(chartModel?.type || resolvedChart?.type).toLowerCase();
    if (normalizedChartType === "horizontal_bar" || normalizedChartType === "funnel_bar") {
      return renderHorizontalBarChartSvg({ chartModel, resolvedChart, width });
    }
    return renderCartesianChartSvg({ chartModel, resolvedChart, width });
  }
  return {
    svg: "",
    height: 0,
    diagnostics: [
      buildChartDiagnostic(
        "unsupportedReportPrintChartPayload",
        `ReportPrint chart lowering does not support resolved chart kind ${kind || "unknown"}.`,
      ),
    ].filter(Boolean),
  };
}
