import { format } from "date-fns";

import { resolveKey, setSelector } from "../utils/selector.js";

function normalizeChartKey(key = "") {
    return String(key || "").trim();
}

export { normalizeChartKey };

function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function resolveChartLoadingState({
    loading = false,
    collectionOverride = null,
} = {}) {
    if (!loading) {
        return false;
    }
    const overrideRows = Array.isArray(collectionOverride) ? collectionOverride : [];
    return overrideRows.length === 0;
}

export function formatChartNumber(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return value;
    const magnitude = Math.abs(numeric);
    const formatValue = (scaled, suffix = "") => `${new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 2,
    }).format(scaled)}${suffix}`;
    if (magnitude >= 1e9) return formatValue(numeric / 1e9, "B");
    if (magnitude >= 1e6) return formatValue(numeric / 1e6, "M");
    if (magnitude >= 1e3) return formatValue(numeric / 1e3, "K");
    return formatValue(numeric);
}

export function resolveHorizontalBarDataLabelLayout({ x = 0, width = 0, value = 0 } = {}) {
    const numericX = Number(x) || 0;
    const numericWidth = Number(width) || 0;
    const barLeft = Math.min(numericX, numericX + numericWidth);
    const barRight = Math.max(numericX, numericX + numericWidth);
    const negative = Number(value) < 0;
    const renderInside = Math.abs(numericWidth) >= 56;
    if (renderInside) {
        return {
            x: negative ? barLeft + 6 : barRight - 6,
            textAnchor: negative ? "start" : "end",
            fill: "#ffffff",
        };
    }
    return {
        x: negative ? barLeft - 6 : barRight + 6,
        textAnchor: negative ? "end" : "start",
        fill: "#5f6b7c",
    };
}

export function resolveHorizontalBarLayout({
    containerWidth = 0,
    embedded = false,
    categoryLabel = null,
} = {}) {
    const width = Math.max(0, Number(containerWidth) || 0);
    const compact = width > 0 && width <= 520;
    const lines = Math.max(1, Math.min(2, Number(categoryLabel?.lines) || 2));
    const categoryShare = compact ? 0.4 : 0.42;
    const categoryWidth = Math.round(Math.max(
        compact ? 84 : 110,
        Math.min(compact ? 120 : 420, width * categoryShare || (compact ? 104 : 220)),
    ));
    const charactersPerLine = Math.max(compact ? 10 : 12, Math.floor(Math.max(64, categoryWidth - 16) / 6.5));
    const responsiveMaxCharacters = charactersPerLine;
    const authoredMaxCharacters = Math.max(0, Number(categoryLabel?.maxCharacters) || 0);
    const maxCharacters = authoredMaxCharacters > 0
        ? Math.min(authoredMaxCharacters, responsiveMaxCharacters)
        : responsiveMaxCharacters;
    const bottomOffset = lines === 2 ? 14 : 0;
    const margin = compact
        ? { top: embedded ? 20 : 10, right: 36, left: 8, bottom: (embedded ? 32 : 40) + bottomOffset }
        : (embedded
            ? { top: 24, right: 12, left: 6, bottom: 34 + bottomOffset }
            : { top: 10, right: 60, left: 14, bottom: 42 + bottomOffset });
    return {
        compact,
        width: compact ? "100%" : (embedded ? "82%" : "85%"),
        categoryWidth,
        categoryLabel: { lines, maxCharacters },
        margin,
        numericTickCount: compact ? 3 : undefined,
        numericMinTickGap: compact ? 18 : 5,
        estimatedPlotWidth: width > 0 ? Math.max(0, width - categoryWidth - margin.left - margin.right) : 0,
    };
}

export function applyChartRowLimit(rows = [], rowLimit = 0) {
    const source = Array.isArray(rows) ? rows : [];
    const limit = Math.trunc(Number(rowLimit) || 0);
    return Number.isInteger(limit) && limit > 0 ? source.slice(0, limit) : source;
}

export function resolveResponsiveChartType(chartType = "", containerWidth = 0, {
    xAxis = null,
    rows = [],
} = {}) {
    const normalizedType = String(chartType || "").trim().toLowerCase();
    const width = Math.max(0, Number(containerWidth) || 0);
    if (normalizedType !== "bar" || width <= 0 || width > 520) {
        return normalizedType;
    }
    const key = String(xAxis?.dataKey || "").trim();
    const values = key ? (Array.isArray(rows) ? rows : []).slice(0, 8).map((row) => readChartDataValue(row, key)) : [];
    const temporal = values.length > 0 && values.every((value) => (
        value instanceof Date || /^\d{4}-\d{2}-\d{2}(?:[T\s]|$)/.test(String(value ?? "").trim())
    ));
    return temporal ? normalizedType : "horizontal_bar";
}

export function resolveResponsiveCivilDateAxis(rows = [], dataKey = "", containerWidth = 0) {
    const source = Array.isArray(rows) ? rows : [];
    const key = String(dataKey || "").trim();
    const width = Math.max(0, Number(containerWidth) || 0);
    const values = key ? source.map((row) => readChartDataValue(row, key)).filter((value) => value != null) : [];
    const temporal = values.length > 0 && values.every((value) => /^\d{4}-\d{2}-\d{2}(?:[T\s]|$)/.test(String(value).trim()));
    if (!temporal || width <= 0 || width > 520) {
        return { compact: false, ticks: undefined, tickFormat: "", bottomMargin: 0, labelPosition: "insideBottomRight", labelOffset: 0 };
    }
    const unique = values.filter((value, index) => index === 0 || String(value) !== String(values[index - 1]));
    const targetCount = Math.min(unique.length, width < 360 ? 2 : 4);
    const ticks = Array.from({ length: targetCount }, (_, index) => (
        unique[Math.round((index * (unique.length - 1)) / Math.max(1, targetCount - 1))]
    )).filter((value, index, all) => index === 0 || String(value) !== String(all[index - 1]));
    return { compact: true, ticks, tickFormat: "MM/dd", bottomMargin: 72, labelPosition: "bottom", labelOffset: 18 };
}

export function hasNonZeroChartSeriesValue(rows = [], seriesKeys = []) {
    const keys = Array.isArray(seriesKeys) ? seriesKeys : [];
    return (Array.isArray(rows) ? rows : []).some((row) => keys.some((key) => {
        const value = Number(readChartDataValue(row, key));
        return Number.isFinite(value) && value !== 0;
    }));
}

function attachChartSelectionRowsMetadata(target, initialValue) {
    if (!target || typeof target !== "object") {
        return target;
    }
    if (!Object.prototype.hasOwnProperty.call(target, "__chartSelectionRows")) {
        Object.defineProperty(target, "__chartSelectionRows", {
            value: initialValue,
            enumerable: false,
            writable: true,
            configurable: true,
        });
    }
    return target;
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

function resolveDisplayValueMapValue(value = undefined, displayValueMap = null) {
    if (value === undefined || value === null || value === "") {
        return undefined;
    }
    if (!displayValueMap || typeof displayValueMap !== "object" || Array.isArray(displayValueMap)) {
        return undefined;
    }
    const key = String(value);
    return Object.prototype.hasOwnProperty.call(displayValueMap, key)
        ? displayValueMap[key]
        : undefined;
}

function resolveChartDisplayValue(row = null, {
    sourceKey = "",
    displayKey = "",
    displayValueMap = null,
} = {}) {
    const normalizedSourceKey = normalizeChartKey(sourceKey);
    const normalizedDisplayKey = normalizeChartKey(displayKey);
    if (!row || typeof row !== "object" || Array.isArray(row) || !normalizedSourceKey) {
        return null;
    }
    const rawValue = resolveKey(row, normalizedSourceKey);
    if (normalizedDisplayKey && normalizedDisplayKey !== normalizedSourceKey) {
        const displayValue = resolveKey(row, normalizedDisplayKey);
        if (displayValue !== undefined && displayValue !== null && displayValue !== "") {
            return displayValue;
        }
    }
    const mappedDisplayValue = resolveDisplayValueMapValue(rawValue, displayValueMap);
    if (mappedDisplayValue !== undefined && mappedDisplayValue !== null && mappedDisplayValue !== "") {
        return mappedDisplayValue;
    }
    return rawValue;
}

export function materializeChartDisplayRows(chart = {}, rows = []) {
    const normalizedRows = Array.isArray(rows) ? rows : [];
    if (normalizedRows.length === 0) {
        return [];
    }
    const xAxisDisplayKey = normalizeChartKey(chart?.xAxis?.dataKey);
    const xAxisSourceKey = normalizeChartKey(chart?.xAxis?.sourceDataKey);
    const xAxisDisplayValueMap = chart?.xAxis?.displayValueMap;
    const seriesDisplayKey = normalizeChartKey(chart?.series?.nameKey);
    const seriesSourceKey = normalizeChartKey(chart?.series?.sourceNameKey);
    const seriesDisplayValueMap = chart?.series?.displayValueMap;
    const shouldMaterializeXAxis = xAxisDisplayKey && xAxisSourceKey
        && (xAxisDisplayKey !== xAxisSourceKey || (xAxisDisplayValueMap && typeof xAxisDisplayValueMap === "object" && !Array.isArray(xAxisDisplayValueMap)));
    const shouldMaterializeSeries = seriesDisplayKey && seriesSourceKey
        && (seriesDisplayKey !== seriesSourceKey || (seriesDisplayValueMap && typeof seriesDisplayValueMap === "object" && !Array.isArray(seriesDisplayValueMap)));
    if (!shouldMaterializeXAxis && !shouldMaterializeSeries) {
        return normalizedRows.map((row) => row && typeof row === "object" ? attachChartSelectionRowsMetadata(cloneValue(row), row?.__chartSelectionRows) : row);
    }
    return normalizedRows.map((row) => {
        const selectionRows = row?.__chartSelectionRows;
        let nextRow = row && typeof row === "object" && !Array.isArray(row)
            ? attachChartSelectionRowsMetadata(cloneValue(row), selectionRows)
            : row;
        if (!nextRow || typeof nextRow !== "object" || Array.isArray(nextRow)) {
            return nextRow;
        }
        if (shouldMaterializeXAxis) {
            const displayValue = resolveChartDisplayValue(nextRow, {
                sourceKey: xAxisSourceKey,
                displayKey: xAxisDisplayKey,
                displayValueMap: xAxisDisplayValueMap,
            });
            if (displayValue !== undefined && displayValue !== null && displayValue !== "") {
                nextRow = setSelector(nextRow, xAxisDisplayKey, displayValue);
                nextRow = attachChartSelectionRowsMetadata(nextRow, selectionRows);
            }
        }
        if (shouldMaterializeSeries) {
            const displayValue = resolveChartDisplayValue(nextRow, {
                sourceKey: seriesSourceKey,
                displayKey: seriesDisplayKey,
                displayValueMap: seriesDisplayValueMap,
            });
            if (displayValue !== undefined && displayValue !== null && displayValue !== "") {
                nextRow = setSelector(nextRow, seriesDisplayKey, displayValue);
                nextRow = attachChartSelectionRowsMetadata(nextRow, selectionRows);
            }
        }
        return nextRow;
    });
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
            groupedData[timestamp] = attachChartSelectionRowsMetadata(
                seedChartBucket(xAxisKey, timestamp),
                {},
            );
        }

        groupedData[timestamp][normalizedSeriesName] = value;
        groupedData[timestamp].__chartSelectionRows[normalizedSeriesName] = [
            ...((groupedData[timestamp].__chartSelectionRows[normalizedSeriesName]) || []),
            item,
        ];
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
        const existing = grouped.get(bucketKey) || attachChartSelectionRowsMetadata(
            seedChartBucket(key, bucketKey),
            [],
        );
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
        existing.__chartSelectionRows.push(row);
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
        const existing = grouped.get(category) || attachChartSelectionRowsMetadata({ name: category, value: 0 }, []);
        existing.value += numericValue;
        existing.__chartSelectionRows.push(row);
        grouped.set(category, existing);
    });
    return Array.from(grouped.values()).filter((row) => row.value > 0);
}

export function buildPieSliceCellKey(entry = {}, index = 0) {
    const label = String(entry?.name || entry?.payload?.name || "unknown").trim() || "unknown";
    return `${label}-${index}`;
}

export function formatTimestamp(timestamp, fmt = "MM/dd", valueMode = "") {
    if (timestamp === null || timestamp === undefined || timestamp === "") {
        return "";
    }
    const civilMatch = valueMode === "civil" && typeof timestamp === "string"
        ? timestamp.match(/^(\d{4})-(\d{2})-(\d{2})/)
        : null;
    const date = civilMatch
        ? new Date(Number(civilMatch[1]), Number(civilMatch[2]) - 1, Number(civilMatch[3]), 12)
        : new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
        return String(timestamp);
    }
    return format(date, fmt);
}

export function formatChartXAxisValue(value, tickFormat = "", valueMode = "") {
    const normalizedTickFormat = String(tickFormat || "").trim();
    if (!normalizedTickFormat) {
        return value === null || value === undefined ? "" : String(value);
    }
    return formatTimestamp(value, normalizedTickFormat, valueMode);
}

export function resolveChartTableMinWidth(widths = []) {
    const total = (Array.isArray(widths) ? widths : []).reduce((sum, value) => {
        const width = Number(value);
        return sum + (Number.isFinite(width) && width > 0 ? width : 0);
    }, 0);
    return Math.max(320, total);
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

// Bar lengths encode magnitude, so an auto-zoomed value axis can materially
// misrepresent a small range (especially a single negative business delta).
// Preserve an authored domain, but make every default bar domain include zero.
export function resolveChartValueAxisDomain(chartType = "", explicitDomain = undefined) {
    if (explicitDomain !== undefined && explicitDomain !== null) {
        return explicitDomain;
    }
    const normalized = String(chartType || "").trim().toLowerCase();
    if (!['bar', 'horizontal_bar', 'funnel_bar'].includes(normalized)) {
        return undefined;
    }
    return [
        (dataMin) => Math.min(0, Number.isFinite(Number(dataMin)) ? Number(dataMin) : 0),
        (dataMax) => Math.max(0, Number.isFinite(Number(dataMax)) ? Number(dataMax) : 0),
    ];
}

export function resolveChartAnimationActive(chart = {}) {
    return chart?.animate === true || chart?.animation === true;
}
