import { format } from "date-fns";

import { resolveKey, setSelector } from "../utils/selector.js";

function normalizeChartKey(key = "") {
    return String(key || "").trim();
}

export function readChartDataValue(row, key) {
    const normalizedKey = normalizeChartKey(key);
    if (!normalizedKey || row == null) {
        return undefined;
    }
    if (typeof row === "object" && Object.prototype.hasOwnProperty.call(row, normalizedKey)) {
        return row[normalizedKey];
    }
    return resolveKey(row, normalizedKey);
}

export function seedChartBucket(key, value) {
    const normalizedKey = normalizeChartKey(key);
    if (!normalizedKey) {
        return {};
    }
    if (!normalizedKey.includes(".")) {
        return { [normalizedKey]: value };
    }
    return setSelector({}, normalizedKey, value);
}

export function transformData(rawData, chart, valueKey) {
    const { xAxis, series } = chart;
    const groupedData = {};
    const keysSet = new Set();
    const xAxisKey = normalizeChartKey(xAxis?.dataKey);
    const seriesNameKey = normalizeChartKey(series?.nameKey);
    const resolvedValueKey = normalizeChartKey(valueKey);

    rawData.forEach((item) => {
        const seriesName = readChartDataValue(item, seriesNameKey);
        const timestamp = readChartDataValue(item, xAxisKey);
        const value = readChartDataValue(item, resolvedValueKey);
        if (timestamp == null || timestamp === "") {
            return;
        }
        const normalizedSeriesName = seriesName == null || seriesName === "" ? "unknown" : String(seriesName);
        keysSet.add(normalizedSeriesName);

        if (!groupedData[timestamp]) {
            groupedData[timestamp] = seedChartBucket(xAxisKey, timestamp);
        }

        groupedData[timestamp][normalizedSeriesName] = value;
    });

    const data = Object.values(groupedData).sort(
        (a, b) => new Date(readChartDataValue(a, xAxisKey)) - new Date(readChartDataValue(b, xAxisKey)),
    );
    const keys = Array.from(keysSet);
    return { data, keys };
}

export function aggregateDirectSeriesData(rawData = [], xAxisKey = "", seriesDefinitions = []) {
    const key = normalizeChartKey(xAxisKey);
    if (!key || !Array.isArray(rawData) || rawData.length === 0) {
        return Array.isArray(rawData) ? rawData : [];
    }
    const valueKeys = (Array.isArray(seriesDefinitions) ? seriesDefinitions : [])
        .map((entry) => normalizeChartKey(entry?.value))
        .filter(Boolean);
    if (valueKeys.length === 0) {
        return rawData;
    }
    const grouped = new Map();
    rawData.forEach((row) => {
        const bucketKey = readChartDataValue(row, key);
        if (bucketKey == null || bucketKey === "") {
            return;
        }
        const existing = grouped.get(bucketKey) || seedChartBucket(key, bucketKey);
        valueKeys.forEach((valueKey) => {
            const rawValue = readChartDataValue(row, valueKey);
            const numeric = Number(rawValue);
            if (!Number.isFinite(numeric)) {
                if (!(valueKey in existing) && rawValue !== undefined) {
                    existing[valueKey] = rawValue;
                }
                return;
            }
            existing[valueKey] = Number(existing[valueKey] || 0) + numeric;
        });
        grouped.set(bucketKey, existing);
    });
    return Array.from(grouped.values()).sort(
        (left, right) => new Date(readChartDataValue(left, key)) - new Date(readChartDataValue(right, key)),
    );
}

export function buildPieChartData(rawData = [], nameKey = "", valueKey = "") {
    const resolvedNameKey = normalizeChartKey(nameKey);
    const resolvedValueKey = normalizeChartKey(valueKey);
    if (!resolvedNameKey || !resolvedValueKey || !Array.isArray(rawData) || rawData.length === 0) {
        return [];
    }
    const grouped = new Map();
    rawData.forEach((row) => {
        const label = readChartDataValue(row, resolvedNameKey);
        const numericValue = Number(readChartDataValue(row, resolvedValueKey));
        const category = label == null || label === "" ? "unknown" : String(label);
        if (!Number.isFinite(numericValue)) {
            return;
        }
        const existing = grouped.get(category) || { name: category, value: 0 };
        existing.value += numericValue;
        grouped.set(category, existing);
    });
    return Array.from(grouped.values()).filter((row) => row.value > 0);
}

export function formatTimestamp(timestamp, fmt = "MM/dd") {
    if (timestamp === null || timestamp === undefined || timestamp === "") {
        return "";
    }
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
        return String(timestamp);
    }
    return format(date, fmt);
}

export function fillMissingTemporalBuckets(chartData = [], xAxisKey = "", seriesDefinitions = [], step = "") {
    const rows = Array.isArray(chartData) ? chartData : [];
    const key = normalizeChartKey(xAxisKey);
    const interval = String(step || "").trim().toLowerCase();
    if (rows.length === 0 || key === "" || interval !== "day") {
        return rows;
    }
    const dated = rows
        .map((row) => {
            const raw = readChartDataValue(row, key);
            const parsed = new Date(raw);
            if (Number.isNaN(parsed.getTime())) {
                return null;
            }
            const normalized = new Date(parsed);
            normalized.setHours(0, 0, 0, 0);
            return { row, date: normalized };
        })
        .filter(Boolean);
    if (dated.length === 0) {
        return rows;
    }
    dated.sort((left, right) => left.date - right.date);
    const byDay = new Map(dated.map((entry) => [entry.date.toISOString(), entry.row]));
    const template = dated[0].row || {};
    const seriesKeys = (Array.isArray(seriesDefinitions) ? seriesDefinitions : [])
        .map((entry) => normalizeChartKey(entry?.value))
        .filter(Boolean);
    const result = [];
    const cursor = new Date(dated[0].date);
    const end = dated[dated.length - 1].date;
    while (cursor <= end) {
        const bucketKey = cursor.toISOString();
        const existing = byDay.get(bucketKey);
        if (existing) {
            result.push(existing);
        } else {
            const nextRow = seedChartBucket(key, bucketKey);
            Object.keys(template).forEach((field) => {
                if (field === key || seriesKeys.includes(field)) {
                    return;
                }
                nextRow[field] = template[field];
            });
            seriesKeys.forEach((seriesKey) => {
                nextRow[seriesKey] = 0;
            });
            result.push(nextRow);
        }
        cursor.setDate(cursor.getDate() + 1);
    }
    return result;
}

export function resolveVisibleChartState({ chartData = [], availableDataKeys = [], yAxisLabel = "", loading = false, error = null, previousState = null, sourceKey = "" } = {}) {
    const currentRows = Array.isArray(chartData) ? chartData : [];
    const currentKeys = Array.isArray(availableDataKeys) ? availableDataKeys : [];
    const previousRows = Array.isArray(previousState?.chartData) ? previousState.chartData : [];
    const previousKeys = Array.isArray(previousState?.availableDataKeys) ? previousState.availableDataKeys : [];
    const sameSourceKey = String(previousState?.sourceKey || "") === String(sourceKey || "");
    const canReusePrevious = loading && !error && sameSourceKey && currentRows.length === 0 && previousRows.length > 0;
    if (canReusePrevious) {
        return {
            chartData: previousRows,
            availableDataKeys: previousKeys,
            yAxisLabel: String(previousState?.yAxisLabel || "").trim(),
            staleWhileLoading: true,
        };
    }
    return {
        chartData: currentRows,
        availableDataKeys: currentKeys,
        yAxisLabel,
        staleWhileLoading: false,
    };
}

export function resolveChartBodyState({
    loading = false,
    error = null,
    hasUnderlyingChartRows = false,
    canRenderChartSelection = false,
    hasChartRows = false,
    hasRenderableSeriesValues = false,
    showResolvedEmptyStateWhileLoading = false,
} = {}) {
    const showSelectionMessage = !loading && !error && hasUnderlyingChartRows && !canRenderChartSelection;
    const showEmptyDataMessage = !error
        && (!hasUnderlyingChartRows || (canRenderChartSelection && (!hasChartRows || !hasRenderableSeriesValues)))
        && (!loading || showResolvedEmptyStateWhileLoading);
    return {
        showSelectionMessage,
        showEmptyDataMessage,
    };
}
