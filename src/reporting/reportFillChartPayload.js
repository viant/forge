import {resolvePieSliceLabel} from '../components/pieSliceLabel.js';
import {buildChartTooltipEntries,chartTooltipPieFields} from '../components/chartTooltip.js';
import {resolveDonutCenter} from '../components/donutCenter.js';
import {buildCategoryRange,categoryRangeFields} from '../components/categoryRange.js';
import {buildHeatmap} from '../components/categoricalHeatmap.js';
import {
  aggregateDirectSeriesData,
  buildPieChartData,
  chartCategoryRowOptions,
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

function buildBaseReportFillChartPayload(chart = {}, rows = [], centerRows, centerInputs, requestFilters) {
  const type = normalizeString(chart?.type).toLowerCase();
  if(type === "category-range") {
    const model=buildCategoryRange(chart.categoryRange,rows);
    return {kind:"category-range",type,seriesKeys:categoryRangeFields(model.config),rows:cloneChartRows(rows)};
  }
  if(type === "heatmap") {
    buildHeatmap(chart.heatmap,rows);
    return {kind:"heatmap",type,seriesKeys:[chart.heatmap.valueField],rows:cloneChartRows(rows)};
  }
  const center=resolveDonutCenter(chart.center,rows,type,centerRows,centerInputs);
  const chartRows = materializeChartDisplayRows(chart, rows);
  if (!type || (chartRows.length === 0&&!center&&!chart.tooltip?.lines?.some(line=>line.some(segment=>segment.input)))) {
    return null;
  }
  if (type === "pie" || type === "donut") {
    const nameKey = normalizeString(chart.tooltip ? chartTooltipPieFields(chart).nameKey : chart?.series?.nameKey || "name");
    const valueKey = normalizeString(chart.tooltip ? chartTooltipPieFields(chart).valueKey : chart?.series?.valueKey || "value");
    if (!nameKey || !valueKey) {
      return null;
    }
    const resolvedRows = buildPieChartData(chartRows, nameKey, valueKey, chartCategoryRowOptions(chart));
    if(chart.sliceLabel)for(const row of resolvedRows)row.sliceLabel=resolvePieSliceLabel(chart.sliceLabel,row.__chartSelectionRows||[]);
    return {
      kind: "category",
      ...(center?{center}:{}),
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

export function buildReportFillChartPayload(chart = {}, rows = [], centerRows, centerInputs, requestFilters) {
  // An authored chart may not compile yet; retain the legacy absent-model result.
  if (chart == null) return null;
  const result = buildBaseReportFillChartPayload(chart, rows, centerRows, centerInputs, requestFilters);
  if(chart.tooltip) {
    const tooltipEntries=buildChartTooltipEntries(chart,rows,requestFilters);
    if(result)return {...result,tooltipEntries};
  }
  return result;
}
