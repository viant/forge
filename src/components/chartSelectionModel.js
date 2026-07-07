import { resolveKey } from "../utils/selector.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function cloneSelectionRows(rows = []) {
    return (Array.isArray(rows) ? rows : []).map((entry) => cloneValue(entry));
}

function resolveChartSelectionRows(selectionRows = null, seriesKey = "") {
    const normalizedSeriesKey = normalizeString(seriesKey);
    if (Array.isArray(selectionRows)) {
        return cloneSelectionRows(selectionRows);
    }
    if (normalizedSeriesKey && Array.isArray(selectionRows?.[normalizedSeriesKey])) {
        return cloneSelectionRows(selectionRows[normalizedSeriesKey]);
    }
    return [];
}

export function collectChartLegendSelectionRows(rows = [], seriesKey = "") {
  const normalizedSeriesKey = normalizeString(seriesKey);
  if (!normalizedSeriesKey) {
    return [];
  }
    return (Array.isArray(rows) ? rows : []).flatMap((row) => {
        if (Array.isArray(row?.__chartSelectionRows?.[normalizedSeriesKey])) {
            return row.__chartSelectionRows[normalizedSeriesKey];
        }
        if (Array.isArray(row?.__chartSelectionRows)) {
            if (normalizeString(row?.name) === normalizedSeriesKey) {
                return row.__chartSelectionRows;
            }
            if (Object.prototype.hasOwnProperty.call(row || {}, normalizedSeriesKey)) {
                return row.__chartSelectionRows;
            }
        }
        return [];
  }).map((entry) => cloneValue(entry));
}

export function collectChartSeriesDatumSelectionRows(rows = [], {
  seriesKey = "",
  xAxisDataKey = "",
  xValue = undefined,
} = {}) {
  const normalizedSeriesKey = normalizeString(seriesKey);
  const normalizedXAxisKey = normalizeString(xAxisDataKey);
  if (!normalizedSeriesKey || !normalizedXAxisKey || xValue === undefined || xValue === null || xValue === "") {
    return [];
  }
    const matchingRow = (Array.isArray(rows) ? rows : []).find((row) => {
        if (!row || typeof row !== "object") {
            return false;
        }
        return resolveKey(row, normalizedXAxisKey) === xValue;
    });
  return resolveChartSelectionRows(matchingRow?.__chartSelectionRows, normalizedSeriesKey);
}

export function normalizeChartDatumSelection({
    event = null,
    chart = {},
    xAxisDataKey = "",
} = {}) {
    const normalizedXAxisKey = normalizeString(xAxisDataKey || chart?.xAxis?.dataKey || "");
    if (event && typeof event === "object" && Array.isArray(event?.activePayload) && event.activePayload.length > 0) {
        const payloadEntry = event.activePayload[0];
        const row = payloadEntry?.payload && typeof payloadEntry.payload === "object" ? cloneValue(payloadEntry.payload) : null;
        const seriesKey = normalizeString(payloadEntry?.dataKey || payloadEntry?.name);
        const xValue = row && normalizedXAxisKey ? resolveKey(row, normalizedXAxisKey) : event?.activeLabel;
        const selectionRows = resolveChartSelectionRows(row?.__chartSelectionRows, seriesKey);
        if (!row || (xValue === undefined || xValue === null || xValue === "")) {
            return null;
        }
        return {
            source: "cartesian",
            row,
            selectionRows,
            xDataKey: normalizedXAxisKey,
            xValue,
            ...(seriesKey ? { seriesKey } : {}),
        };
    }

    const piePayload = event?.payload && typeof event.payload === "object" ? event.payload : null;
    const pieName = normalizeString(event?.name || piePayload?.name);
    if (piePayload && pieName) {
        return {
            source: "pie",
            row: cloneValue(piePayload),
            selectionRows: resolveChartSelectionRows(piePayload?.__chartSelectionRows),
            xDataKey: normalizedXAxisKey || "name",
            xValue: resolveKey(piePayload, normalizedXAxisKey) ?? pieName,
            seriesKey: pieName,
        };
    }

    return null;
}

export function normalizeChartSeriesDatumSelection({
    event = null,
    seriesKey = "",
    xAxisDataKey = "",
    chartRows = [],
} = {}) {
    const normalizedSeriesKey = normalizeString(seriesKey);
    const normalizedXAxisKey = normalizeString(xAxisDataKey || "name");
    const candidateRow = event?.payload && typeof event.payload === "object"
        ? event.payload
        : (event && typeof event === "object" ? event : null);
    if (!candidateRow || !normalizedSeriesKey || !normalizedXAxisKey) {
        return null;
    }
    const xValue = resolveKey(candidateRow, normalizedXAxisKey);
    if (xValue === undefined || xValue === null || xValue === "") {
        return null;
    }
    const selectionRows = resolveChartSelectionRows(candidateRow?.__chartSelectionRows, normalizedSeriesKey);
    return {
        source: "cartesian",
        row: cloneValue(candidateRow),
        selectionRows: selectionRows.length > 0
            ? selectionRows
            : collectChartSeriesDatumSelectionRows(chartRows, {
                seriesKey: normalizedSeriesKey,
                xAxisDataKey: normalizedXAxisKey,
                xValue,
            }),
        xDataKey: normalizedXAxisKey,
        xValue,
        seriesKey: normalizedSeriesKey,
    };
}

export function normalizeChartLegendSelection({
    entry = null,
    selectionRows = [],
} = {}) {
    const seriesKey = normalizeString(entry?.value || entry?.dataKey || entry?.payload?.value || entry?.payload?.dataKey);
    if (!seriesKey) {
        return null;
    }
    return {
        source: "legend",
        row: null,
        selectionRows: cloneSelectionRows(selectionRows),
        xDataKey: "",
        xValue: undefined,
        seriesKey,
    };
}
