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
  return ["line", "area", "bar", "horizontal_bar"].includes(normalized) ? normalized : "";
}

function formatAxisTick(value) {
  const numeric = normalizeNumber(value);
  if (numeric == null) {
    return normalizeString(value);
  }
  const absolute = Math.abs(numeric);
  if (absolute >= 1000000) {
    return `${(numeric / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (absolute >= 1000) {
    return `${(numeric / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  }
  if (Number.isInteger(numeric)) {
    return String(numeric);
  }
  return numeric.toFixed(1).replace(/\.0$/, "");
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
    const largeArc = angle > Math.PI ? 1 : 0;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const fill = palette[index % palette.length];
    const outerPath = slices.length === 1
      ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${escapeXml(fill)}" />`
      : `<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2} Z" fill="${escapeXml(fill)}" />`;
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
    <text x="${leftPad - 8}" y="${tick.y + 4}" text-anchor="end" font-size="10" fill="#667085">${escapeXml(formatAxisTick(tick.value))}</text>
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
        return `
          <rect x="${x}" y="${y}" width="${barWidth - 1}" height="${barHeight}" rx="2" fill="${escapeXml(series.color)}" />
        `;
      }).join("\n");
      return bars;
    }

    const path = buildPolylinePath(points);
    const markers = points.map((point) => `
      <circle cx="${point.x}" cy="${point.y}" r="2.5" fill="${escapeXml(series.color)}" />
    `).join("\n");
    if (supportedType === "area") {
      return `
        <path d="${buildAreaPath(points, baselineY)}" fill="${escapeXml(series.color)}" fill-opacity="0.18" stroke="none" />
        <path d="${path}" fill="none" stroke="${escapeXml(series.color)}" stroke-width="2" />
        ${markers}
      `;
    }
    return `
      <path d="${path}" fill="none" stroke="${escapeXml(series.color)}" stroke-width="2" />
      ${markers}
    `;
  }).join("\n");

  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
      ${gridLines}
      <line x1="${leftPad}" y1="${baselineY}" x2="${leftPad + plotWidth}" y2="${baselineY}" stroke="#98a2b3" stroke-width="1" />
      <line x1="${leftPad}" y1="${topPad}" x2="${leftPad}" y2="${topPad + plotHeight}" stroke="#98a2b3" stroke-width="1" />
      ${renderedSeries}
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
    <text x="${tick.x}" y="${topPad + plotHeight + 18}" text-anchor="middle" font-size="10" fill="#667085">${escapeXml(formatAxisTick(tick.value))}</text>
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
      return `
        <rect x="${x}" y="${barY}" width="${barWidth}" height="${perSeriesHeight}" rx="2" fill="${escapeXml(series.color)}" />
        <text x="${labelX}" y="${barY + perSeriesHeight - 2}" text-anchor="${labelAnchor}" font-size="10" fill="#667085">${escapeXml(formatAxisTick(value))}</text>
      `;
    }).join("\n")
  )).join("\n");

  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
      ${gridLines}
      <line x1="${baselineX}" y1="${topPad}" x2="${baselineX}" y2="${topPad + plotHeight}" stroke="#98a2b3" stroke-width="1" />
      ${categoryLabels}
      ${renderedSeries}
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
    if (normalizeString(chartModel?.type || resolvedChart?.type).toLowerCase() === "horizontal_bar") {
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
