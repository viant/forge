import {
  aggregateDirectSeriesData,
  buildPieChartData,
  materializeChartDisplayRows,
  normalizeChartKey,
  transformData,
} from "../components/chartData.js";

function normalizeString(value = "") {
  return String(value || "").trim();
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function isDirectSeriesChart(chart = {}) {
  return !normalizeString(chart?.series?.nameKey)
    && Array.isArray(chart?.series?.values)
    && chart.series.values.length > 0;
}

function cloneChartRows(rows = []) {
  return (Array.isArray(rows) ? rows : []).map((row) => cloneValue(row));
}

export function buildReportFillChartPayload(chart = {}, rows = []) {
  const type = normalizeString(chart?.type).toLowerCase();
  const chartRows = materializeChartDisplayRows(chart, rows);
  if (!type || chartRows.length === 0) {
    return null;
  }
  if (type === "pie" || type === "donut") {
    const nameKey = normalizeString(chart?.series?.nameKey || "name");
    const valueKey = normalizeString(chart?.series?.valueKey || "value");
    if (!nameKey || !valueKey) {
      return null;
    }
    const resolvedRows = buildPieChartData(chartRows, nameKey, valueKey);
    return {
      kind: "category",
      type,
      nameKey,
      valueKey,
      rows: cloneChartRows(resolvedRows),
      seriesKeys: resolvedRows.map((row) => normalizeString(row?.name)).filter(Boolean),
    };
  }
  if (isDirectSeriesChart(chart)) {
    const xAxisKey = normalizeString(chart?.xAxis?.dataKey);
    if (!xAxisKey) {
      return null;
    }
    const seriesValues = Array.isArray(chart?.series?.values) ? chart.series.values : [];
    const seriesKeys = seriesValues
      .map((entry) => normalizeChartKey(entry?.value))
      .filter(Boolean);
    const resolvedRows = aggregateDirectSeriesData(chartRows, xAxisKey, seriesValues);
    return {
      kind: "directSeries",
      type,
      xAxisKey,
      seriesKeys,
      rows: cloneChartRows(resolvedRows),
    };
  }
  const xAxisKey = normalizeString(chart?.xAxis?.dataKey);
  const nameKey = normalizeString(chart?.series?.nameKey);
  const valueKey = normalizeString(chart?.series?.valueKey);
  if (!xAxisKey || !nameKey || !valueKey) {
    return null;
  }
  const { data, keys } = transformData(chartRows, chart, valueKey);
  return {
    kind: "groupedSeries",
    type,
    xAxisKey,
    nameKey,
    valueKey,
    rows: cloneChartRows(data),
    seriesKeys: Array.isArray(keys) ? keys.map((entry) => String(entry)) : [],
  };
}
