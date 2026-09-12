import {normalizeChartExtent} from './chartExtent.js';
import React, {useState, useEffect, useMemo} from "react";
import {useSignals} from '@preact/signals-react/runtime';
import {
    Dialog,
    RadioGroup,
    Radio,
    Tooltip as BpTooltip,
} from "@blueprintjs/core";
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    AreaChart,
    Area,
    ComposedChart,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    LabelList,
    ReferenceArea,
    ReferenceDot,
    ReferenceLine,
    ResponsiveContainer,
} from "recharts";
import { useDataSourceState } from "../hooks/useDataSourceState.js";
import {
    aggregateDirectSeriesData,
    applyChartRowLimit,
    buildPieSliceCellKey,
    buildPieChartData,
    fillMissingTemporalBuckets,
    formatChartNumber,
    formatChartXAxisValue,
    hasNonZeroChartSeriesValue,
    materializeChartDisplayRows,
    normalizeChartKey,
    readChartDataValue,
    resolveChartBodyState,
    resolveChartAnimationActive,
    resolveChartLoadingState,
    resolveHorizontalBarDataLabelLayout,
    resolveHorizontalBarLayout,
    resolveResponsiveCivilDateAxis,
    resolveResponsiveChartType,
    resolveChartValueAxisDomain,
    resolveVisibleChartState,
    transformData,
    resolveChartTableMinWidth,
} from "./chartData.js";
import {
    normalizeSelectorLookupKey,
    resolveChartDataSourceRef,
} from "./chartContextRef.js";
import {
    createKeyListSignature,
    normalizeKeys,
    reconcileSelectedDataKeys,
    reconcileVisibleColumns,
    resolveSelectedValueKey,
    toggleSelectedDataKey,
} from "./chartSeriesSelection.js";
import {
    collectChartLegendSelectionRows,
    normalizeChartDatumSelection,
    normalizeChartLegendSelection,
    normalizeChartSeriesDatumSelection,
} from "./chartSelectionModel.js";
import { SoftBlock } from "./SoftSkeleton.jsx";
import { resolveSelector } from "../utils/selector.js";
import { getLogger } from "../utils/logger.js";
import { normalizeServiceErrorText } from "../utils/errorText.js";
import { normalizeChartAnnotations, resolveChartAnnotationStrokeDasharray } from "../reporting/reportChartAnnotations.js";
import { buildChartCategoryTickLabel, buildMeasuredChartCategoryTickLabel, normalizeChartCategoryLabelConfig } from "./chartCategoryLabel.js";
import "./Chart.css";

let categoryTickMeasureCanvas = null;

function measureCategoryTickText(value, style = {}) {
    if (typeof document === "undefined") return String(value || "").length * 6.5;
    categoryTickMeasureCanvas ||= document.createElement("canvas");
    const context = categoryTickMeasureCanvas.getContext("2d");
    if (!context) return String(value || "").length * 6.5;
    const fontSize = Math.max(8, Number(style?.fontSize || 12));
    const fontWeight = style?.fontWeight || 400;
    context.font = `${fontWeight} ${fontSize}px ${style?.fontFamily || "Arial, sans-serif"}`;
    return context.measureText(String(value || "")).width;
}

function ClampedCategoryTick({ x = 0, y = 0, payload = {}, config = null, valueFormatter = null, orientation = "x", style = {}, availableWidth = 0 }) {
    const rawValue = payload?.value;
    const formattedValue = typeof valueFormatter === "function" ? valueFormatter(rawValue) : rawValue;
    const isYAxis = orientation === "y";
    const label = isYAxis
        ? buildMeasuredChartCategoryTickLabel(formattedValue, config, availableWidth, (text) => measureCategoryTickText(text, style))
        : buildChartCategoryTickLabel(formattedValue, config);
    if (!label) return null;
    const lineHeight = Math.max(11, Number(style?.fontSize || 12) + 2);
    return (
        <g transform={`translate(${x},${y})`}>
            <title>{label.fullText}</title>
            <text
                x={isYAxis ? -6 : 0}
                y={isYAxis ? -((label.lines.length - 1) * lineHeight) / 2 : 8}
                textAnchor={isYAxis ? "end" : "middle"}
                dominantBaseline={isYAxis ? "middle" : "hanging"}
                {...style}
            >
                {label.lines.map((line, index) => (
                    <tspan key={`${line}-${index}`} x={isYAxis ? -6 : 0} dy={index === 0 ? 0 : lineHeight}>
                        {line}
                    </tspan>
                ))}
            </text>
        </g>
    );
}

function HorizontalBarValueLabel({ x = 0, y = 0, width = 0, height = 0, value = 0, formatter = null }) {
    const layout = resolveHorizontalBarDataLabelLayout({ x, width, value });
    const label = typeof formatter === "function" ? formatter(value) : value;
    return (
        <text
            x={layout.x}
            y={(Number(y) || 0) + (Number(height) || 0) / 2}
            textAnchor={layout.textAnchor}
            dominantBaseline="middle"
            fill={layout.fill}
            fontSize={11}
            fontWeight={600}
        >
            {label}
        </text>
    );
}

function ChartActionButton({
    children,
    onClick,
    active = false,
    disabled = false,
    title = '',
    style = {},
}) {
    return (
        <button
            type="button"
            className="forge-chart-action"
            disabled={disabled}
            title={title || undefined}
            onClick={onClick}
            style={{
                minHeight: 30,
                padding: '0 12px',
                borderRadius: 8,
                border: `1px solid ${active ? '#2f6de1' : '#d0daea'}`,
                background: active ? '#2f6de1' : '#f5f8fd',
                color: active ? '#fff' : '#2d5a9e',
                cursor: disabled ? 'default' : 'pointer',
                font: 'inherit',
                fontSize: 12,
                fontWeight: 600,
                lineHeight: 1.2,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                ...style,
            }}
        >
            {children}
        </button>
    );
}

function useMeasuredContainer() {
    const ref = React.useRef(null);
    const [size, setSize] = useState({width: 0, height: 0});

    useEffect(() => {
        const node = ref.current;
        if (!node || typeof ResizeObserver === "undefined") return undefined;
        const update = () => {
            const nextWidth = Number(node.clientWidth || 0);
            const nextHeight = Number(node.clientHeight || 0);
            setSize((prev) => (
                prev.width === nextWidth && prev.height === nextHeight
                    ? prev
                    : {width: nextWidth, height: nextHeight}
            ));
        };
        update();
        const observer = new ResizeObserver(() => update());
        observer.observe(node);
        return () => observer.disconnect();
    }, []);

    return [ref, size];
}

function isDirectSeriesChart(chart = {}) {
    return !chart?.series?.nameKey && Array.isArray(chart?.series?.values) && chart.series.values.length > 0;
}

function isHorizontalBarType(type = "") {
    return type === "horizontal_bar" || type === "funnel_bar";
}

function defaultCategoricalPalette() {
    return [
        '#2f6de1', '#7a46d8', '#db2f7d', '#f55d1f', '#d79619',
        '#2aa84a', '#24a0c7', '#5a5ce6', '#d13b5c', '#8a6b0f',
        '#0f8f6b', '#4d7cff', '#9b51e0', '#ff5c8a', '#ff7a1a',
        '#c89b14', '#27ae60', '#1f9ac0', '#6c63ff', '#e74c3c',
        '#b9770e', '#16a085', '#3498db', '#8e44ad', '#e91e63',
        '#ff7043', '#f4b400', '#43a047', '#00acc1', '#3f51b5',
        '#ef5350', '#ffa726', '#9ccc65', '#26c6da', '#7e57c2',
        '#ec407a', '#ffca28', '#66bb6a', '#29b6f6', '#5c6bc0',
        '#ab47bc', '#ff704d', '#d4e157', '#26a69a', '#42a5f5',
        '#7e57c2', '#f06292', '#ffb300', '#4db6ac', '#7986cb'
    ];
}

function getSeriesDefinitions(chart = {}) {
    const palette = chart?.series?.palette || [];
    return (chart?.series?.values || []).map((entry, index) => ({
        ...entry,
        value: entry?.value,
        label: entry?.label || entry?.name || entry?.value || `Series ${index + 1}`,
        name: entry?.name || entry?.label || entry?.value || `Series ${index + 1}`,
        type: entry?.type || chart?.type || "line",
        axis: entry?.axis || "left",
        color: entry?.color || palette[index % Math.max(palette.length, 1)] || "#137cbd",
        dataLabels: entry?.dataLabels,
    })).filter((entry) => !!entry.value);
}

function formatValueByFormat(value, formatType) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return value;
    }
    switch (formatType) {
        case "currency":
            return new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD', maximumFractionDigits: 0}).format(numeric);
        case "currency2":
            return new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2}).format(numeric);
        case "compactNumber":
            return formatLargeNumber(numeric);
        case "percent":
            return `${numeric.toFixed(1)}%`;
        case "percentFraction":
            return `${(numeric * 100).toFixed(1)}%`;
        default:
            return formatLargeNumber(numeric);
    }
}

export function chartTableColumnMeta(columnKey, xAxis = {}, seriesDefinitions = []) {
    if (columnKey === xAxis?.dataKey) {
        return {key: columnKey, label: xAxis?.label || 'Date', format: 'xAxis'};
    }
    const series = seriesDefinitions.find((entry) => entry?.value === columnKey) || {};
    return {key: columnKey, label: series.label || series.name || columnKey, format: series.format || ''};
}

export function formatChartTableCell(value, meta = {}, resolvedTickFormat = '', resolvedTickValueMode = '') {
    if (meta.format === 'xAxis') return formatChartXAxisValue(value, resolvedTickFormat, resolvedTickValueMode);
    return formatValueByFormat(value, meta.format);
}

function shouldRenderSeriesDataLabels(series = {}, chartType = "", rowCount = 0, embedded = false) {
    if (embedded) {
        return false;
    }
    const mode = String(series?.dataLabels || "").trim().toLowerCase();
    if (mode === "none") {
        return false;
    }
    if (mode === "always") {
        return true;
    }
    if (mode && mode !== "auto") {
        return false;
    }
    if (chartType === "horizontal_bar" || chartType === "funnel_bar") {
        return rowCount <= 12;
    }
    if (chartType === "bar") {
        return rowCount <= 10;
    }
    if (!mode) {
        return false;
    }
    if (chartType === "line" || chartType === "area") {
        return rowCount <= 8;
    }
    return false;
}

function buildDataLabelFormatter(formatType = "") {
    return (value) => formatValueByFormat(value, formatType);
}

export function resolveConditionalSeriesColor(series = {}, value, fallbackColor = "") {
    const mode = String(series?.pointColorMode || "").trim();
    if (mode !== "bySign") {
        return fallbackColor || series?.color || "#137cbd";
    }
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
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

function createAxisTickFormatter(formatType) {
    return (value) => formatValueByFormat(value, formatType);
}

function tooltipFormatterForFormat(formatType) {
    return (value) => formatValueByFormat(value, formatType);
}

function formatChartErrorMessage(error) {
    return normalizeServiceErrorText(error, { serviceLabel: "chart data service" }) || "Chart data failed to load.";
}

function resolveMappedConfigValue(baseContext, entry = {}, valueKey = "", defaultSource = "windowForm") {
    const selector = String(entry?.[`${valueKey}Selector`] || "").trim();
    const mapping = entry?.[`${valueKey}s`];
    if (!selector || !mapping || typeof mapping !== "object" || Array.isArray(mapping)) {
        return entry?.[valueKey];
    }
    let scope = {};
    const source = String(entry?.[`${valueKey}Source`] || defaultSource).toLowerCase();
    switch (source) {
        case "form":
            scope = baseContext?.signals?.form?.peek?.() || {};
            break;
        case "filter":
        case "filters":
            scope = baseContext?.handlers?.dataSource?.peekFilter?.() || {};
            break;
        case "input":
            scope = baseContext?.signals?.input?.peek?.() || {};
            break;
        case "windowform":
        default:
            scope = baseContext?.signals?.windowForm?.peek?.() || {};
            break;
    }
    const key = normalizeSelectorLookupKey(resolveSelector(scope, selector));
    if (key == null) {
        return entry?.[valueKey];
    }
    return mapping[key] ?? entry?.[valueKey];
}

function buildAnnotationLabel(label = "", color = "", embedded = false, position = "end") {
    const normalizedLabel = String(label || "").trim();
    if (!normalizedLabel) {
        return undefined;
    }
    return {
        value: normalizedLabel,
        position,
        fill: color || "#41566d",
        fontSize: embedded ? 10 : 11,
        fontWeight: 600,
    };
}

function buildRuntimeChartAnnotationElements(annotations = [], { embedded = false } = {}) {
    const background = [];
    const foreground = [];

    annotations.forEach((annotation, index) => {
        const color = annotation?.color || "#5f6b7c";
        const dash = resolveChartAnnotationStrokeDasharray(annotation?.lineStyle);
        const key = annotation?.id || `${annotation?.kind || "annotation"}-${index}`;

        if (annotation?.kind === "band") {
            const commonProps = {
                key,
                ifOverflow: "extendDomain",
                fill: color,
                fillOpacity: annotation?.opacity ?? 0.12,
                stroke: color,
                strokeOpacity: 0.25,
                label: buildAnnotationLabel(annotation?.label, color, embedded, "insideTop"),
            };
            background.push(
                annotation?.axis === "y"
                    ? <ReferenceArea {...commonProps} y1={annotation.from} y2={annotation.to} />
                    : <ReferenceArea {...commonProps} x1={annotation.from} x2={annotation.to} />,
            );
            return;
        }

        if (annotation?.kind === "note") {
            foreground.push(
                <ReferenceDot
                    key={key}
                    ifOverflow="extendDomain"
                    x={annotation.x}
                    y={annotation.y}
                    r={embedded ? 4 : 5}
                    fill={color}
                    stroke={color}
                    strokeWidth={2}
                    label={buildAnnotationLabel(annotation?.label, color, embedded, "top")}
                />,
            );
            return;
        }

        const label = buildAnnotationLabel(annotation?.label, color, embedded, annotation?.position || "end");
        const commonLineProps = {
            key,
            ifOverflow: "extendDomain",
            stroke: color,
            strokeWidth: embedded ? 1.5 : 2,
            strokeDasharray: dash || undefined,
            position: annotation?.position || "end",
            label,
        };
        if (annotation?.kind === "verticalMarker" || (annotation?.kind === "referenceLine" && annotation?.axis === "x")) {
            foreground.push(<ReferenceLine {...commonLineProps} x={annotation?.value} />);
            return;
        }
        if (annotation?.kind === "referenceLine" && annotation?.axis === "y") {
            foreground.push(<ReferenceLine {...commonLineProps} y={annotation?.value} />);
        }
    });

    return {
        background,
        foreground,
    };
}

// Function to format large numbers with commas
function formatLargeNumber(value) {
    return formatChartNumber(value);
}

function escapeCsvCell(value) {
    const v = String(value ?? "");
    if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
}

function areKeyListsEqual(left = [], right = []) {
    if (left === right) return true;
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    if (left.length !== right.length) return false;
    for (let i = 0; i < left.length; i += 1) {
        if (left[i] !== right[i]) return false;
    }
    return true;
}


export function hasNonEmptySummary(metrics = {}) {
    if (!metrics || typeof metrics !== 'object') {
        return false;
    }
    return Object.entries(metrics).some(([key, value]) => {
        if (!/summary/i.test(String(key || ''))) {
            return false;
        }
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return false;
        }
        return Object.values(value).some((item) => {
            if (item == null) return false;
            if (typeof item === 'string') return item.trim().length > 0;
            return true;
        });
    });
}

export function resolveEmptyChartMessage(metrics = {}) {
    if (hasNonEmptySummary(metrics)) {
        return 'No detailed chart rows were returned for the selected period. Summary totals may still be available below.';
    }
    return 'No data for the selected period.';
}

const Chart = ({container, context, isActive = true, embedded = false, onDatumSelect = null, onLegendItemSelect = null, showControls = true}) => {
    const controlsVisible = container?.chart?.showControls !== false && showControls !== false;
    useSignals();
    const log = getLogger('chart');
    const {chart} = container;
    const [chartRef, chartSize] = useMeasuredContainer();

    // Extract chart configuration
    const {
        type = "line",
        xAxis = {},
        yAxis = {},
        axes = {},
        cartesianGrid = {strokeDasharray: "3 3"},
        width,
        height,
        series,
    } = chart;
    const {palette = []} = series;
    const directSeriesChart = isDirectSeriesChart(chart);
    const seriesDefinitions = useMemo(() => getSeriesDefinitions(chart), [chart]);
    const leftAxis = useMemo(() => ({...yAxis, ...(axes.left || {})}), [yAxis, axes]);
    const rightAxis = useMemo(() => axes.right || null, [axes]);
    const hasRightAxis = !!rightAxis || seriesDefinitions.some((entry) => entry.axis === "right");
    const [selectedDataKeys, setSelectedDataKeys] = useState([]);
    const selectionStateRef = React.useRef({initialized: false, touched: false});
    const lastRenderableStateRef = React.useRef(null);
    const [viewMode, setViewMode] = useState("chart");
    const [showColumnDialog, setShowColumnDialog] = useState(false);
    const [columnWidths, setColumnWidths] = useState({});
    const [expandedCell, setExpandedCell] = useState(null);

    const [selectedValueKey, setSelectedValueKey] = useState(series.valueKey || seriesDefinitions[0]?.value || "");

    const resolvedChartDataSourceRef = resolveChartDataSourceRef(context, chart);
    const chartContext = (typeof context?.useDsContext === "function")
        ? context.useDsContext(resolvedChartDataSourceRef || context?.identity?.dataSourceRef)
        : (
            resolvedChartDataSourceRef
            && resolvedChartDataSourceRef !== context?.identity?.dataSourceRef
            && typeof context?.Context === "function"
                ? context.Context(resolvedChartDataSourceRef)
                : context
        );
    useEffect(() => {
        try {
            log.debug('[chart] resolved datasource', {
                containerId: container?.id,
                baseDs: context?.identity?.dataSourceRef,
                resolvedDs: chartContext?.identity?.dataSourceRef,
                selector: chart?.dataSourceRefSelector || chart?.dataSourceSelector || null,
            });
        } catch (_) {}
    }, [chart?.dataSourceRefSelector, chart?.dataSourceSelector, chartContext, container?.id, context?.identity?.dataSourceRef]);
    const resolvedTickFormat = resolveMappedConfigValue(context, xAxis, "tickFormat", "windowForm");
    const resolvedTickValueMode = resolveMappedConfigValue(context, xAxis, "valueMode", "windowForm");
    const { collection, loading, error } = useDataSourceState(chartContext);
    const chartMetrics = chartContext?.signals?.metrics?.value || {};
    const collectionOverride = Array.isArray(container?.collection) ? container.collection : null;
    const effectiveCollection = collectionOverride || collection;
    const effectiveLoading = resolveChartLoadingState({
        loading,
        collectionOverride,
    });
    const chartSourceKey = useMemo(() => {
        const dataSourceId = String(chartContext?.identity?.dataSourceId || chartContext?.identity?.dataSourceRef || "");
        const inputSnapshot = chartContext?.signals?.input?.peek?.() || {};
        const params = inputSnapshot.parameters || {};
        const filter = inputSnapshot.filter || {};
        return JSON.stringify({ dataSourceId, params, filter });
    }, [chartContext, chartContext?.signals?.input?.value]);

    const responsiveChartType = resolveResponsiveChartType(type, chartSize.width, {
        xAxis,
        rows: effectiveCollection,
    });
    const responsiveCivilDateAxis = resolveResponsiveCivilDateAxis(
        effectiveCollection,
        xAxis?.dataKey,
        chartSize.width,
    );
    const isPieChart = responsiveChartType === "pie" || responsiveChartType === "donut";
    const isHorizontalBar = isHorizontalBarType(responsiveChartType);
    const prepared = useMemo(() => {
        const chartRows = applyChartRowLimit(
            materializeChartDisplayRows(chart, effectiveCollection || []),
            chart?.rowLimit,
        );
        if (isPieChart) {
            const nameKey = series.nameKey || "name";
            const valueKey = series.valueKey || selectedValueKey || "value";
            const rows = buildPieChartData(chartRows, nameKey, valueKey);
            return {
                chartData: rows,
                availableDataKeys: rows.map((row) => row.name),
                yAxisLabel: "",
            };
        }

        if (directSeriesChart) {
            const sorted = aggregateDirectSeriesData(chartRows, xAxis?.dataKey, seriesDefinitions);
            return {
                chartData: sorted,
                availableDataKeys: seriesDefinitions.map((entry) => entry.value),
                yAxisLabel: leftAxis.label || "",
            };
        }

        const {data, keys} = transformData(chartRows, chart, selectedValueKey);
        const selectedValue = (series.values || []).find((val) => val.value === selectedValueKey);
        return {
            chartData: data,
            availableDataKeys: keys,
            yAxisLabel: selectedValue ? selectedValue.name : (leftAxis.label || ""),
        };
    }, [chart, directSeriesChart, effectiveCollection, isPieChart, leftAxis.label, selectedValueKey, series, seriesDefinitions, xAxis?.dataKey]);

    const visibleState = resolveVisibleChartState({
        chartData: prepared.chartData,
        availableDataKeys: prepared.availableDataKeys,
        yAxisLabel: prepared.yAxisLabel,
        loading: effectiveLoading,
        error,
        sourceKey: chartSourceKey,
        previousState: lastRenderableStateRef.current,
    });

    const chartData = visibleState.chartData;
    const availableDataKeys = visibleState.availableDataKeys;
    const yAxisLabel = visibleState.yAxisLabel;
    const staleWhileLoading = visibleState.staleWhileLoading;
    const availableDataKeysSignature = useMemo(
        () => createKeyListSignature(availableDataKeys),
        [availableDataKeys],
    );
    const seriesValueKeysSignature = useMemo(
        () => createKeyListSignature(
            Array.isArray(series?.values)
                ? series.values.map((entry) => entry?.value)
                : [],
        ),
        [series?.values],
    );
    const seriesDefinitionKeysSignature = useMemo(
        () => createKeyListSignature(seriesDefinitions.map((entry) => entry?.value)),
        [seriesDefinitions],
    );
    const stableAvailableDataKeys = useMemo(
        () => normalizeKeys(availableDataKeys),
        [availableDataKeysSignature],
    );

    useEffect(() => {
        if (!effectiveLoading && !error && Array.isArray(prepared.chartData) && prepared.chartData.length > 0) {
            lastRenderableStateRef.current = {
                chartData: prepared.chartData,
                availableDataKeys: prepared.availableDataKeys,
                yAxisLabel: prepared.yAxisLabel,
                sourceKey: chartSourceKey,
            };
        }
    }, [prepared.chartData, prepared.availableDataKeys, prepared.yAxisLabel, effectiveLoading, error, chartSourceKey]);

    useEffect(() => {
        setSelectedDataKeys((previousKeys) => {
            const nextSelection = reconcileSelectedDataKeys(previousKeys, stableAvailableDataKeys, selectionStateRef.current);
            selectionStateRef.current = {
                ...selectionStateRef.current,
                initialized: nextSelection.initialized,
            };
            return areKeyListsEqual(previousKeys, nextSelection.selectedDataKeys)
                ? previousKeys
                : nextSelection.selectedDataKeys;
        });
    }, [availableDataKeysSignature, stableAvailableDataKeys]);

    useEffect(() => {
        setSelectedValueKey((previousValueKey) => {
            const nextValueKey = resolveSelectedValueKey(previousValueKey, series, seriesDefinitions);
            return nextValueKey === previousValueKey ? previousValueKey : nextValueKey;
        });
    }, [series?.valueKey, seriesDefinitionKeysSignature, seriesDefinitions, seriesValueKeysSignature, series]);

    useEffect(() => {
        if ((embedded || !controlsVisible) && viewMode !== "chart") {
            setViewMode("chart");
        }
    }, [embedded, controlsVisible, viewMode]);

    const allTableColumns = useMemo(
        () => [xAxis?.dataKey, ...stableAvailableDataKeys].filter(Boolean),
        [xAxis?.dataKey, stableAvailableDataKeys],
    );
    const [visibleColumns, setVisibleColumns] = useState(allTableColumns);

    useEffect(() => {
        setVisibleColumns((prev) => reconcileVisibleColumns(prev, allTableColumns));
    }, [allTableColumns]);




    // Function to handle selection changes for dataKeys
    const handleDataKeySelect = (dataKey) => {
        selectionStateRef.current = {initialized: true, touched: true};
        setSelectedDataKeys((previousKeys) => toggleSelectedDataKey(previousKeys, dataKey));
    };

    const handleClearSelection = () => {
        selectionStateRef.current = {initialized: true, touched: true};
        setSelectedDataKeys([]);
    };

    // Handle valueKey change
    const handleValueKeyChange = (e) => {
        const newValueKey = e.target.value;
        setSelectedValueKey(newValueKey); // Just update the state
    };

    const authoredCategoryLabelConfig = normalizeChartCategoryLabelConfig(xAxis?.categoryLabel);
    const horizontalBarLayout = resolveHorizontalBarLayout({
        containerWidth: chartSize.width,
        embedded,
        categoryLabel: authoredCategoryLabelConfig,
    });
    const categoryLabelConfig = isHorizontalBar
        ? horizontalBarLayout.categoryLabel
        : authoredCategoryLabelConfig;
    const categoryLabelBottomOffset = categoryLabelConfig?.lines === 2 ? 14 : 0;
    const cartesianAxisTitleBottomMargin = !embedded && String(xAxis?.label || "").trim() ? 64 : 0;
    const chartMargin = isHorizontalBar
        ? horizontalBarLayout.margin
        : (embedded
            ? {top: 24, right: 12, left: 6, bottom: 34 + categoryLabelBottomOffset}
            : {top: 24, right: 60, left: 14, bottom: Math.max(42 + categoryLabelBottomOffset, cartesianAxisTitleBottomMargin, responsiveCivilDateAxis.bottomMargin)});
    const horizontalLegendSeriesCount = directSeriesChart
        ? seriesDefinitions.length
        : availableDataKeys.length;
    const legendProps = embedded
        ? {verticalAlign: "top", align: "center", wrapperStyle: {fontSize: "10px", lineHeight: 1.1, paddingBottom: "6px", color: "#5f6b7c"}}
        : (isHorizontalBar && horizontalLegendSeriesCount > 1
            ? {verticalAlign: "top", align: "center", wrapperStyle: {fontSize: "12px", lineHeight: 1.2, paddingBottom: "8px", color: "#5f6b7c"}}
            : {});
    const axisTickStyle = embedded
        ? {fontSize: 11, fill: "#5f6b7c"}
        : {fontSize: 12, fill: "#667085"};
    const axisLabelStyle = embedded
        ? undefined
        : {fontSize: 12, fill: "#667085", fontWeight: 500};
    const renderXAxisCategoryTick = categoryLabelConfig
        ? ((props) => <ClampedCategoryTick {...props} config={categoryLabelConfig} valueFormatter={(value) => formatChartXAxisValue(value, resolvedTickFormat, resolvedTickValueMode)} style={axisTickStyle} />)
        : axisTickStyle;
    const renderYAxisCategoryTick = categoryLabelConfig
        ? ((props) => <ClampedCategoryTick {...props} config={categoryLabelConfig} orientation="y" style={axisTickStyle} availableWidth={Math.max(0, horizontalBarLayout.categoryWidth - 10)} />)
        : (embedded ? {fontSize: 11, fill: "#5f6b7c"} : undefined);
    const gridStroke = embedded ? "rgba(95,107,124,0.18)" : "rgba(152,162,179,0.22)";
    const showEmbeddedSeriesSelector = embedded && !isPieChart && availableDataKeys.length > 1;
    const showChartLegend = !showEmbeddedSeriesSelector && (embedded || !controlsVisible);

    const seriesToggleOptions = useMemo(() => availableDataKeys.map((dataKey, index) => {
        const seriesDef = seriesDefinitions.find((entry) => entry.value === dataKey);
        return {
            value: dataKey,
            label: seriesDef?.label || seriesDef?.name || dataKey,
            color: seriesDef?.color || palette[index % Math.max(palette.length, 1)] || "#137cbd",
        };
    }), [availableDataKeys, palette, seriesDefinitions]);

    const interactiveDatumSelection = typeof onDatumSelect === "function";
    const interactiveLegendSelection = typeof onLegendItemSelect === "function";

    const selectedSeriesDefinitions = directSeriesChart
        ? seriesDefinitions.filter((entry) => selectedDataKeys.includes(entry.value))
        : selectedDataKeys.map((dataKey, index) => ({
            value: dataKey,
            label: dataKey,
            name: dataKey,
            type,
            axis: "left",
            color: palette[index % Math.max(palette.length, 1)] || "#137cbd",
        }));
    const renderableSeriesDefinitions = selectedSeriesDefinitions.filter((entry) => (
        chartData.some((row) => {
            const value = readChartDataValue(row, entry.value);
            return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
        })
    ));

    const emitDatumSelection = React.useCallback((event) => {
        if (!interactiveDatumSelection) {
            return;
        }
        const selection = normalizeChartDatumSelection({
            event,
            chart,
            xAxisDataKey: normalizeChartKey(xAxis?.dataKey || "name"),
        });
        if (!selection) {
            return;
        }
        onDatumSelect(selection);
    }, [interactiveDatumSelection, onDatumSelect, chart, xAxis?.dataKey]);

    const emitLegendSelection = React.useCallback((entry) => {
        if (!interactiveLegendSelection) {
            return;
        }
        const legendSeriesKey = String(entry?.value || entry?.dataKey || entry?.payload?.value || entry?.payload?.dataKey || "").trim();
        const selection = normalizeChartLegendSelection({
            entry,
            selectionRows: collectChartLegendSelectionRows(chartData, legendSeriesKey),
        });
        if (!selection) {
            return;
        }
        onLegendItemSelect(selection);
    }, [chartData, interactiveLegendSelection, onLegendItemSelect]);

    const emitSeriesDatumSelection = React.useCallback((seriesKey, event) => {
        if (!interactiveDatumSelection) {
            return;
        }
        const selection = normalizeChartSeriesDatumSelection({
            event,
            seriesKey,
            xAxisDataKey: normalizeChartKey(xAxis?.dataKey || "name"),
            chartRows: chartData,
        });
        if (!selection) {
            return;
        }
        onDatumSelect(selection);
    }, [chartData, interactiveDatumSelection, onDatumSelect, xAxis?.dataKey]);

    const interactiveLegendContent = interactiveLegendSelection ? ((legendPropsInput = {}) => {
        const payload = Array.isArray(legendPropsInput?.payload) ? legendPropsInput.payload : [];
        return (
            <div
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    justifyContent: "center",
                    paddingTop: embedded ? 0 : 6,
                }}
            >
                {payload.map((entry, index) => {
                    const label = String(entry?.value || entry?.dataKey || `Series ${index + 1}`);
                    const color = entry?.color || entry?.payload?.color || palette[index % Math.max(palette.length, 1)] || "#137cbd";
                    return (
                        <button
                            key={`${label}-${index}`}
                            type="button"
                            className="forge-chart-legend-action"
                            onClick={() => emitLegendSelection(entry)}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                border: "1px solid #d8e1e8",
                                background: "#ffffff",
                                color: "#30404d",
                                borderRadius: 999,
                                padding: "4px 10px",
                                cursor: "pointer",
                                fontSize: 11,
                                fontWeight: 600,
                            }}
                        >
                            <span
                                aria-hidden="true"
                                style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: "999px",
                                    background: color,
                                }}
                            />
                            <span>{label}</span>
                        </button>
                    );
                })}
            </div>
        );
    }) : null;

    const denseChartData = fillMissingTemporalBuckets(
        chartData,
        xAxis?.dataKey || "name",
        renderableSeriesDefinitions,
        chart?.fillMissingTemporalBuckets,
    );

    const normalizedAllChartData = (isHorizontalBar
        ? [...denseChartData].sort((a, b) => {
            const primaryKey = renderableSeriesDefinitions[0]?.value;
            return Number(b?.[primaryKey] || 0) - Number(a?.[primaryKey] || 0);
        })
        : denseChartData
    ).map((row) => ({
        ...row,
        __seriesFormats: Object.fromEntries(renderableSeriesDefinitions.map((entry) => [entry.value, entry.format || leftAxis.format])),
        __seriesAxes: Object.fromEntries(renderableSeriesDefinitions.map((entry) => [entry.value, entry.axis === "right" ? rightAxis?.format : leftAxis.format])),
    }));
    const normalizedChartData = normalizedAllChartData;

    const resolvedChartAnnotations = React.useMemo(() => (
        buildRuntimeChartAnnotationElements(normalizeChartAnnotations(chart), { embedded })
    ), [chart, embedded]);

    const cartesianSeriesElements = renderableSeriesDefinitions.map((entry, seriesIndex) => {
        const defaultLineDash = renderableSeriesDefinitions.length > 1 && (entry.type === "line" || entry.type === "area")
            ? [undefined, "8 4", "3 3", "10 3 2 3"][seriesIndex % 4]
            : undefined;
        const commonProps = {
            dataKey: entry.value,
            name: entry.name || entry.label,
            yAxisId: entry.axis || "left",
            stroke: entry.color,
            fill: entry.color,
            strokeWidth: entry.strokeWidth || (embedded ? 3 : 2),
            strokeDasharray: entry.strokeDasharray || defaultLineDash,
            fillOpacity: entry.fillOpacity ?? (entry.type === "area" ? 0.22 : 1),
            opacity: entry.opacity,
            isAnimationActive: resolveChartAnimationActive(chart),
        };
        const showSeriesDataLabels = shouldRenderSeriesDataLabels(entry, type, normalizedChartData.length, embedded);
        const dataLabelFormatter = buildDataLabelFormatter(entry.format || leftAxis.format);

        if (entry.type === "bar") {
            return (
                <Bar key={entry.value} {...commonProps} stackId={entry.stackId} {...(interactiveDatumSelection ? { onClick: (payload) => emitSeriesDatumSelection(entry.value, payload) } : {})}>
                    {entry.pointColorMode === "bySign"
                        ? normalizedChartData.map((row, index) => (
                            <Cell key={`${entry.value}-cell-${index}`} fill={resolveConditionalSeriesColor(entry, row?.[entry.value], entry.color)} />
                        ))
                        : null}
                    {showSeriesDataLabels ? (
                        <LabelList dataKey={entry.value} position="top" formatter={dataLabelFormatter} fill="#5f6b7c" fontSize={11} />
                    ) : null}
                </Bar>
            );
        }
        if (entry.type === "area") {
            const dotRenderer = embedded || interactiveDatumSelection || entry.pointColorMode === "bySign"
                ? ((props = {}) => (
                    <circle
                        cx={props.cx}
                        cy={props.cy}
                        r={embedded || interactiveDatumSelection ? 4 : 3}
                        strokeWidth={1}
                        stroke="#ffffff"
                        fill={resolveConditionalSeriesColor(entry, props?.payload?.[entry.value], entry.color)}
                    />
                ))
                : false;
            return (
                <Area key={entry.value} {...commonProps} type="monotone" connectNulls={true} dot={dotRenderer} activeDot={embedded || interactiveDatumSelection ? { r: 6, strokeWidth: 1.5 } : { r: 4 }} {...(interactiveDatumSelection ? { onClick: (payload) => emitSeriesDatumSelection(entry.value, payload) } : {})}>
                    {showSeriesDataLabels ? (
                        <LabelList dataKey={entry.value} position="top" formatter={dataLabelFormatter} fill="#5f6b7c" fontSize={11} />
                    ) : null}
                </Area>
            );
        }
        const lineDotRenderer = embedded || interactiveDatumSelection || entry.pointColorMode === "bySign"
            ? ((props = {}) => (
                <circle
                    cx={props.cx}
                    cy={props.cy}
                    r={embedded || interactiveDatumSelection ? 4 : 3}
                    strokeWidth={1}
                    stroke="#ffffff"
                    fill={resolveConditionalSeriesColor(entry, props?.payload?.[entry.value], entry.color)}
                />
            ))
            : false;
        return (
            <Line key={entry.value} {...commonProps} type="monotone" connectNulls={true} strokeLinecap="round" strokeLinejoin="round" dot={lineDotRenderer} activeDot={embedded || interactiveDatumSelection ? { r: 6, strokeWidth: 1.5 } : { r: 4 }} {...(interactiveDatumSelection ? { onClick: (payload) => emitSeriesDatumSelection(entry.value, payload) } : {})}>
                {showSeriesDataLabels ? (
                    <LabelList dataKey={entry.value} position="top" formatter={dataLabelFormatter} fill="#5f6b7c" fontSize={11} />
                ) : null}
            </Line>
        );
    });

    const sharedChartChildren = (
        <>
            <CartesianGrid strokeDasharray={cartesianGrid.strokeDasharray} stroke={gridStroke}/>
            {resolvedChartAnnotations.background}
            <XAxis
                dataKey={xAxis?.dataKey || "name"}
                ticks={responsiveCivilDateAxis.ticks}
                tickFormatter={(val) => formatChartXAxisValue(
                    val,
                    responsiveCivilDateAxis.tickFormat || resolvedTickFormat,
                    responsiveCivilDateAxis.compact ? "civil" : resolvedTickValueMode,
                )}
                tick={renderXAxisCategoryTick}
                axisLine={false}
                tickLine={false}
                minTickGap={responsiveCivilDateAxis.compact ? 18 : (embedded ? 24 : 5)}
                label={{
                    value: embedded ? "" : (xAxis.label || ""),
                    position: String(xAxis?.label || "").trim() ? "bottom" : responsiveCivilDateAxis.labelPosition,
                    offset: String(xAxis?.label || "").trim() ? 18 : responsiveCivilDateAxis.labelOffset,
                    ...axisLabelStyle,
                }}
            />
            <YAxis
                yAxisId="left"
                width={embedded ? 56 : 76}
                tickFormatter={createAxisTickFormatter(leftAxis.format)}
                tick={axisTickStyle}
                axisLine={false}
                tickLine={false}
                label={{
                    value: embedded ? "" : (leftAxis.label || yAxisLabel),
                    angle: -90,
                    position: "insideLeft",
                    ...axisLabelStyle,
                }}
                domain={resolveChartValueAxisDomain(type, leftAxis.domain)}
            />
            {hasRightAxis ? (
                <YAxis
                    yAxisId="right"
                    orientation="right"
                    width={embedded ? 56 : 68}
                    tickFormatter={createAxisTickFormatter(rightAxis?.format)}
                    tick={axisTickStyle}
                    axisLine={false}
                    tickLine={false}
                    label={rightAxis?.label ? {
                        value: embedded ? "" : rightAxis.label,
                        angle: 90,
                        position: "insideRight",
                        ...axisLabelStyle,
                    } : undefined}
                    domain={rightAxis?.domain}
                />
            ) : null}
            <Tooltip
                labelFormatter={(val) => formatChartXAxisValue(val, resolvedTickFormat, resolvedTickValueMode)}
                formatter={(value, name, item) => {
                    const formatType = item?.payload?.__seriesFormats?.[item?.dataKey] || item?.payload?.__seriesAxes?.[item?.dataKey];
                    return [tooltipFormatterForFormat(formatType)(value), name];
                }}
                contentStyle={embedded ? {fontSize: "11px", borderRadius: "8px", border: "1px solid #d8e1e8"} : undefined}
            />
            {showChartLegend ? <Legend {...legendProps} {...(interactiveLegendContent ? { content: interactiveLegendContent } : {})}/> : null}
            {cartesianSeriesElements}
            {resolvedChartAnnotations.foreground}
        </>
    );

    const composedChart = (
        <ComposedChart data={normalizedChartData} margin={chartMargin}>
            {sharedChartChildren}
        </ComposedChart>
    );

    const lineChart = (
        <LineChart data={normalizedChartData} margin={chartMargin}>
            {sharedChartChildren}
        </LineChart>
    );

    const barChart = (
        <BarChart data={normalizedChartData} margin={chartMargin}>
            {sharedChartChildren}
        </BarChart>
    );

    const horizontalBarChart = (() => {
        const categoryKey = xAxis?.dataKey;
        const primarySeries = selectedSeriesDefinitions[0];
        if (!categoryKey || !primarySeries) return null;

        const activePalette = (palette && palette.length > 0) ? palette : defaultCategoricalPalette();
        const categoryWidth = horizontalBarLayout.categoryWidth;
        const barSize = embedded ? 10 : 12;
        const showHorizontalDataLabels = shouldRenderSeriesDataLabels(primarySeries, responsiveChartType, normalizedChartData.length, embedded);
        const primaryDataLabelFormatter = buildDataLabelFormatter(primarySeries.format || leftAxis.format);

        return (
            <BarChart data={normalizedChartData} margin={chartMargin} layout="vertical">
                <CartesianGrid strokeDasharray={cartesianGrid.strokeDasharray} stroke={embedded ? "rgba(95,107,124,0.18)" : undefined}/>
                {resolvedChartAnnotations.background}
                <XAxis
                    type="number"
                    tickFormatter={createAxisTickFormatter(primarySeries.format || leftAxis.format)}
                    tick={axisTickStyle}
                    label={{
                        value: embedded ? "" : (leftAxis.label || primarySeries.label || ""),
                        position: "insideBottomRight",
                        offset: 0,
                    }}
                    domain={resolveChartValueAxisDomain(responsiveChartType, leftAxis.domain)}
                    tickCount={horizontalBarLayout.numericTickCount}
                    minTickGap={horizontalBarLayout.numericMinTickGap}
                    interval="preserveStartEnd"
                />
                <YAxis
                    type="category"
                    dataKey={categoryKey}
                    width={categoryWidth}
                    tick={renderYAxisCategoryTick}
                />
                <Tooltip
                    formatter={(value) => tooltipFormatterForFormat(primarySeries.format || leftAxis.format)(value)}
                    contentStyle={embedded ? {fontSize: "11px", borderRadius: "8px", border: "1px solid #d8e1e8"} : undefined}
                />
                {selectedSeriesDefinitions.length > 1 ? <Legend {...legendProps} {...(interactiveLegendContent ? { content: interactiveLegendContent } : {})} /> : null}
                {selectedSeriesDefinitions.length === 1 ? (
                    <Bar
                        dataKey={primarySeries.value}
                        name={primarySeries.name || primarySeries.label}
                        fill={primarySeries.color}
                        barSize={barSize}
                        isAnimationActive={resolveChartAnimationActive(chart)}
                        {...(interactiveDatumSelection ? { onClick: (payload) => emitSeriesDatumSelection(primarySeries.value, payload) } : {})}
                    >
                        {showHorizontalDataLabels ? (
                            <LabelList dataKey={primarySeries.value} content={(props) => <HorizontalBarValueLabel {...props} formatter={primaryDataLabelFormatter} />} />
                        ) : null}
                        {normalizedChartData.map((row, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={primarySeries.pointColorMode === "bySign"
                                    ? resolveConditionalSeriesColor(primarySeries, row?.[primarySeries.value], activePalette[index % activePalette.length])
                                    : activePalette[index % activePalette.length]}
                            />
                        ))}
                    </Bar>
                ) : (
                    selectedSeriesDefinitions.map((entry) => (
                        <Bar
                            key={entry.value}
                            dataKey={entry.value}
                            name={entry.name || entry.label}
                            fill={entry.color}
                            barSize={barSize}
                            isAnimationActive={resolveChartAnimationActive(chart)}
                            stackId={responsiveChartType === "funnel_bar" ? undefined : entry.stackId}
                            {...(interactiveDatumSelection ? { onClick: (payload) => emitSeriesDatumSelection(entry.value, payload) } : {})}
                        >
                            {entry.pointColorMode === "bySign"
                                ? normalizedChartData.map((row, index) => (
                                    <Cell key={`${entry.value}-cell-${index}`} fill={resolveConditionalSeriesColor(entry, row?.[entry.value], entry.color)} />
                                ))
                                : null}
                            {shouldRenderSeriesDataLabels(entry, responsiveChartType, normalizedChartData.length, embedded) ? (
                                <LabelList dataKey={entry.value} content={(props) => <HorizontalBarValueLabel {...props} formatter={buildDataLabelFormatter(entry.format || leftAxis.format)} />} />
                            ) : null}
                        </Bar>
                    ))
                )}
                {resolvedChartAnnotations.foreground}
            </BarChart>
        );
    })();

    const areaChart = (
        <AreaChart data={normalizedChartData} margin={chartMargin}>
            {sharedChartChildren}
        </AreaChart>
    );

    const pieFilteredData = isPieChart
        ? chartData.filter((row) => selectedDataKeys.includes(row.name))
        : [];
    const piePalette = palette.length > 0 ? palette : ['#137cbd', '#0f9960', '#d9822b', '#8f398f', '#c23030', '#5c7080', '#2965cc', '#29a634'];
    const compactPie = isPieChart && Number(chartSize.width || 0) > 0 && Number(chartSize.width || 0) <= 520;
    const pieInnerRadius = type === "donut" ? (compactPie ? "34%" : "45%") : 0;
    const pieChart = (
        <PieChart margin={embedded ? {top: 8, right: 8, bottom: 8, left: 8} : {top: 10, right: 10, bottom: 10, left: 10}}>
            <Pie
                data={pieFilteredData}
                dataKey="value"
                nameKey="name"
                isAnimationActive={resolveChartAnimationActive(chart)}
                {...(interactiveDatumSelection ? { onClick: emitDatumSelection } : {})}
                cx="50%"
                cy={compactPie ? "38%" : "50%"}
                innerRadius={pieInnerRadius}
                outerRadius={compactPie ? "52%" : "78%"}
                paddingAngle={pieFilteredData.length > 1 ? 2 : 0}
                label={embedded || compactPie ? false : ({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={!embedded && !compactPie}
            >
                {pieFilteredData.map((entry, index) => (
                    <Cell key={buildPieSliceCellKey(entry, index)} fill={piePalette[index % piePalette.length]} />
                ))}
            </Pie>
            <Tooltip
                formatter={(value) => formatLargeNumber(value)}
                contentStyle={embedded ? {fontSize: "11px", borderRadius: "8px", border: "1px solid #d8e1e8"} : undefined}
            />
            {showChartLegend ? (
                <Legend
                    {...(embedded ? {wrapperStyle: {fontSize: "11px"}, iconSize: 10} : {})}
                    {...(compactPie ? {verticalAlign: "bottom", align: "center", wrapperStyle: {fontSize: "11px", lineHeight: 1.4, paddingTop: "8px"}, iconSize: 9} : {})}
                    {...(interactiveLegendContent ? { content: interactiveLegendContent } : {})}
                />
            ) : null}
        </PieChart>
    );

    const computedWidthByCol = React.useMemo(() => {
        const out = {};
        allTableColumns.forEach((key) => {
            const meta = chartTableColumnMeta(key, xAxis, seriesDefinitions);
            const headerLen = String(meta.label || key || "").length;
            let maxLen = headerLen;
            chartData.forEach((row) => {
                const raw = readChartDataValue(row, key) ?? "";
                const len = String(formatChartTableCell(raw, meta, resolvedTickFormat, resolvedTickValueMode) ?? "").length;
                if (len > maxLen) maxLen = len;
            });
            const w = Math.max(110, Math.min(420, maxLen * 8 + 28));
            out[key] = w;
        });
        return out;
    }, [allTableColumns, chartData, resolvedTickFormat, resolvedTickValueMode, seriesDefinitions, xAxis]);

    const tableColumnWidths = visibleColumns.map((key) => {
        const persisted = Number(columnWidths[key]);
        if (Number.isFinite(persisted) && persisted > 60) return persisted;
        return computedWidthByCol[key] || 140;
    });

    const toggleColumnVisibility = (key) => {
        setVisibleColumns((prev) => {
            if (prev.includes(key)) return prev.filter((k) => k !== key);
            return [...prev, key];
        });
    };

    const downloadCsv = () => {
        const cols = visibleColumns.length ? visibleColumns : allTableColumns;
        const lines = [cols.map((key) => escapeCsvCell(chartTableColumnMeta(key, xAxis, seriesDefinitions).label)).join(",")];
        chartData.forEach((row) => {
            lines.push(cols.map((c) => escapeCsvCell(readChartDataValue(row, c))).join(","));
        });
        const blob = new Blob(["\ufeff" + lines.join("\n")], {type: "text/csv;charset=utf-8"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const ts = new Date().toISOString().replace(/[:.]/g, "-");
        a.href = url;
        a.download = `chart-table-${ts}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const tableColumnMeta = visibleColumns.map((columnKey) => chartTableColumnMeta(columnKey, xAxis, seriesDefinitions));

    const chartExportId = container?.id && String(container?.kind || '').startsWith('dashboard.')
        ? container.id
        : undefined;

    const hasUnderlyingChartRows = isPieChart ? chartData.length > 0 : normalizedChartData.length > 0;
    const canRenderChartSelection = isPieChart ? pieFilteredData.length > 0 : selectedSeriesDefinitions.length > 0;
    const hasChartRows = isPieChart ? pieFilteredData.length > 0 : normalizedChartData.length > 0;
    const hasRenderableSeriesValues = isPieChart
        ? pieFilteredData.some((entry) => Number.isFinite(Number(entry?.value)))
        : normalizedChartData.some((row) => selectedSeriesDefinitions.some((entry) => Number.isFinite(Number(row?.[entry.value]))));
    const hasNonZeroRenderableSeriesValues = isPieChart
        ? pieFilteredData.some((entry) => Number.isFinite(Number(entry?.value)) && Number(entry.value) !== 0)
        : hasNonZeroChartSeriesValue(normalizedChartData, selectedSeriesDefinitions.map((entry) => entry.value));
    const showZeroDataMessage = !effectiveLoading
        && !error
        && hasChartRows
        && hasRenderableSeriesValues
        && !hasNonZeroRenderableSeriesValues;
    const hasResolvedMetricsPayload = chartMetrics && typeof chartMetrics === 'object' && Object.keys(chartMetrics).length > 0;
    const showResolvedEmptyStateWhileLoading =
        effectiveLoading
        && !staleWhileLoading
        && !error
        && !hasChartRows
        && hasResolvedMetricsPayload;
    const emptyChartMessage = resolveEmptyChartMessage(chartMetrics);
    const showSeriesSelectionControls = !showResolvedEmptyStateWhileLoading
        && !(chart?.hideControlsWhenEmpty === true && !hasUnderlyingChartRows);
    const { showSelectionMessage, showEmptyDataMessage } = resolveChartBodyState({
        loading: effectiveLoading,
        error,
        hasUnderlyingChartRows,
        canRenderChartSelection,
        hasChartRows,
        hasRenderableSeriesValues,
        showResolvedEmptyStateWhileLoading,
    });

    const renderSeriesSelectionControls = ({compact = false} = {}) => (
        <div
            aria-label="Chart series selector"
            style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                alignItems: "center",
                justifyContent: compact ? "flex-end" : "flex-start",
                marginTop: compact ? 0 : 8,
                marginBottom: compact ? 0 : 8,
            }}
        >
            {seriesToggleOptions.map((option) => {
                const checked = selectedDataKeys.includes(option.value);
                return (
                    <label
                        key={option.value}
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "6px 10px",
                            borderRadius: 999,
                            border: checked ? "1px solid rgba(47,109,225,0.28)" : "1px solid rgba(138,155,168,0.18)",
                            background: checked ? "rgba(47,109,225,0.08)" : "#fff",
                            color: checked ? "#2f6de1" : "#4b5563",
                            cursor: "pointer",
                            userSelect: "none",
                            fontSize: 12,
                            lineHeight: 1.2,
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleDataKeySelect(option.value)}
                            style={{margin: 0}}
                        />
                        <span
                            aria-hidden="true"
                            style={{
                                width: 8,
                                height: 8,
                                borderRadius: "999px",
                                background: option.color,
                                opacity: checked ? 1 : 0.4,
                            }}
                        />
                        <span>{option.label}</span>
                    </label>
                );
            })}
            <ChartActionButton
                title="Clear series selection"
                onClick={handleClearSelection}
            >
                Clear
            </ChartActionButton>
        </div>
    );

    const resolvedWidth = isHorizontalBar
        ? normalizeChartExtent(width, horizontalBarLayout.width)
        : normalizeChartExtent(width, "100%");
    const estimatedHorizontalRowHeight = categoryLabelConfig?.lines === 2
        ? (embedded ? 34 : 40)
        : (embedded ? 28 : 32);
    const horizontalBarDefaultHeight = Math.max(
        embedded ? 150 : 160,
        Math.min(embedded ? 380 : 440, 96 + normalizedChartData.length * estimatedHorizontalRowHeight),
    );
    const resolvedHeight = isHorizontalBar
        ? normalizeChartExtent(height, horizontalBarDefaultHeight)
        : normalizeChartExtent(height, embedded ? 380 : 240);
    const effectiveViewportHeight = showEmptyDataMessage
        ? normalizeChartExtent(chart?.emptyHeight, resolvedHeight)
        : resolvedHeight;
    const resolvedMinHeight = (() => {
        if (typeof effectiveViewportHeight === 'number') {
            return effectiveViewportHeight;
        }
        const normalized = typeof effectiveViewportHeight === 'string' ? effectiveViewportHeight.trim().toLowerCase() : '';
        if (normalized === '100%') {
            return embedded ? 220 : 420;
        }
        return 0;
    })();
    const chartViewportStyle = {
        width: "100%",
        height: effectiveViewportHeight,
        minHeight: resolvedMinHeight || undefined,
        minWidth: 0,
        flex: "0 0 auto",
        margin: isHorizontalBar ? "0 auto" : undefined,
        position: "relative",
    };
    const chartCanRenderViewport = chartSize.width > 0 && chartSize.height > 0;
    return (
        <div
            style={{width: resolvedWidth, minWidth: 0, display: "flex", flexDirection: "column", gap: 8, position: "relative"}}
            data-dashboard-chart-id={chartExportId}
            data-chart-loading={effectiveLoading ? "true" : "false"}
            data-chart-stale={staleWhileLoading ? "true" : "false"}
        >
            {controlsVisible && showEmbeddedSeriesSelector && showSeriesSelectionControls ? (
                <div
                    aria-label="Chart series selector"
                    style={{
                        display: "flex",
                        flexWrap: "wrap",
                        justifyContent: "center",
                        gap: "6px 12px",
                        padding: "0 4px 10px",
                    }}
                >
                    {seriesToggleOptions.map((option) => {
                        const checked = selectedDataKeys.includes(option.value);
                        return (
                            <label
                                key={option.value}
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 6,
                                    fontSize: 11,
                                    lineHeight: 1.2,
                                    color: checked ? "#41566d" : "#7d8da1",
                                    cursor: "pointer",
                                    userSelect: "none",
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => handleDataKeySelect(option.value)}
                                    style={{margin: 0}}
                                />
                                <span
                                    aria-hidden="true"
                                    style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: "999px",
                                        background: option.color,
                                        opacity: checked ? 1 : 0.35,
                                    }}
                                />
                                <span>{option.label}</span>
                            </label>
                        );
                    })}
                </div>
            ) : null}
            {controlsVisible && !embedded && showSeriesSelectionControls ? (
                <>
                    {!directSeriesChart && !isPieChart ? (
                        <RadioGroup
                            inline={true}
                            name={container.id}
                            onChange={handleValueKeyChange}
                            selectedValue={selectedValueKey}
                        >
                            {series.values.map((option, index) => (
                                <Radio key={option.value + index} label={option.label} value={option.value}/>
                            ))}
                        </RadioGroup>
                    ) : null}
                    <div style={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 8, flexWrap: "wrap"}}>
                        <div style={{display: "flex", gap: 6}}>
                            <ChartActionButton active={viewMode === "chart"} onClick={() => setViewMode("chart")}>
                                Chart
                            </ChartActionButton>
                            <ChartActionButton active={viewMode === "table"} onClick={() => setViewMode("table")}>
                                Table
                            </ChartActionButton>
                        </div>
                        {viewMode === "chart"
                            ? renderSeriesSelectionControls({compact: true})
                            : (
                                <div style={{display: "flex", gap: 6}}>
                                    <ChartActionButton onClick={() => setShowColumnDialog(true)}>Columns</ChartActionButton>
                                    <ChartActionButton onClick={downloadCsv}>CSV</ChartActionButton>
                                </div>
                            )}
                    </div>
                </>
            ) : null}
            {error && (
                <div style={{color: 'red', padding: 4}}>{formatChartErrorMessage(error)}</div>
            )}

            {viewMode === "chart" ? (
                <div ref={chartRef} style={chartViewportStyle}>
                    {effectiveLoading && !staleWhileLoading && !showResolvedEmptyStateWhileLoading && !error ? (
                        <div
                            style={{
                                height: "100%",
                                minHeight: embedded ? 110 : 180,
                                position: "relative",
                                overflow: "hidden",
                                borderRadius: 12,
                            }}
                        >
                            <SoftBlock
                                height="100%"
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    borderRadius: 12,
                                }}
                            />
                            <div
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "#7d8da1",
                                    fontSize: 12,
                                    fontWeight: 600,
                                    pointerEvents: "none",
                                }}
                            >
                                Loading chart…
                            </div>
                        </div>
                    ) : showZeroDataMessage ? (
                        <div
                            style={{
                                height: "100%",
                                minHeight: embedded ? 110 : 180,
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 6,
                                textAlign: "center",
                                color: "#5f6b7c",
                                fontSize: 12,
                            }}
                        >
                            <strong style={{ color: "#30404d" }}>All values are zero for the selected period.</strong>
                            <span>Adjust the report filters or choose a wider date interval.</span>
                        </div>
                    ) : showEmptyDataMessage ? (
                        <div
                            style={{
                                height: "100%",
                                minHeight: embedded ? 110 : 180,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                textAlign: "center",
                                color: "#7d8da1",
                                fontSize: 12,
                            }}
                        >
                            {emptyChartMessage}
                        </div>
                    ) : showSelectionMessage ? (
                        <div
                            style={{
                                height: "100%",
                                minHeight: embedded ? 110 : 180,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                textAlign: "center",
                                color: "#7d8da1",
                                fontSize: 12,
                            }}
                        >
                            Select at least one series to render the chart.
                        </div>
                    ) : chartCanRenderViewport ? (
                        <ResponsiveContainer width={chartSize.width} height={chartSize.height}>
                            {isPieChart
                                ? pieChart
                                : isHorizontalBar
                                    ? horizontalBarChart
                                : type === "composed" || directSeriesChart || hasRightAxis
                                    ? composedChart
                                    : type === "bar"
                                        ? barChart
                                        : type === "area"
                                            ? areaChart
                                            : lineChart}
                        </ResponsiveContainer>
                    ) : null}
                </div>
            ) : (
                <div className="forge-chart-table-scroll">
                    <table className="forge-chart-table" style={{minWidth: resolveChartTableMinWidth(tableColumnWidths)}}>
                        <colgroup>
                            {tableColumnWidths.map((widthValue, index) => <col key={`${visibleColumns[index]}-width`} style={{width: widthValue}}/>)}
                        </colgroup>
                        <thead>
                            <tr>{tableColumnMeta.map((meta) => <th key={meta.key} scope="col">{meta.label}</th>)}</tr>
                        </thead>
                        <tbody>
                            {chartData.map((row, rowIndex) => (
                                <tr key={row?.[xAxis?.dataKey] || rowIndex}>
                                    {tableColumnMeta.map((meta) => {
                                        const raw = readChartDataValue(row, meta.key) ?? '';
                                        const formatted = formatChartTableCell(raw, meta, resolvedTickFormat, resolvedTickValueMode);
                                        const text = String(formatted ?? '');
                                        const isLong = text.length > 120;
                                        return (
                                            <td key={meta.key} title={isLong ? text : undefined}
                                                onClick={() => isLong && setExpandedCell({title: meta.label, content: text})}>
                                                {isLong ? `${text.slice(0, 120)}…` : text}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {staleWhileLoading ? (
                <div
                    style={{
                        position: "absolute",
                        top: embedded ? 6 : 10,
                        right: embedded ? 6 : 10,
                        padding: "2px 8px",
                        borderRadius: 999,
                        background: "rgba(255,255,255,0.9)",
                        border: "1px solid rgba(148,163,184,0.35)",
                        color: "#5f6b7c",
                        fontSize: 11,
                        lineHeight: 1.4,
                        backdropFilter: "blur(4px)",
                        pointerEvents: "none",
                    }}
                >
                    Refreshing…
                </div>
            ) : null}

            <Dialog isOpen={!embedded && showColumnDialog} onClose={() => setShowColumnDialog(false)} title="Column customization">
                <div style={{padding: 12, display: "flex", flexDirection: "column", gap: 10}}>
                    {allTableColumns.map((key) => {
                        const meta = chartTableColumnMeta(key, xAxis, seriesDefinitions);
                        return (
                        <div key={key} style={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12}}>
                            <label className="bp4-control bp4-checkbox" style={{marginBottom: 0}}>
                                <input
                                    type="checkbox"
                                    checked={visibleColumns.includes(key)}
                                    onChange={() => toggleColumnVisibility(key)}
                                />
                                <span className="bp4-control-indicator"/>
                                {meta.label}
                            </label>
                            <input
                                className="bp4-input bp4-small"
                                type="number"
                                min={80}
                                max={640}
                                value={Number(columnWidths[key] || computedWidthByCol[key] || 140)}
                                onChange={(e) => {
                                    const v = Number(e.target.value || 0);
                                    if (Number.isFinite(v) && v >= 80) {
                                        setColumnWidths((prev) => ({...prev, [key]: Math.min(640, v)}));
                                    }
                                }}
                                style={{width: 90}}
                            />
                        </div>
                        );
                    })}
                </div>
            </Dialog>

            <Dialog isOpen={!embedded && !!expandedCell} onClose={() => setExpandedCell(null)} title={expandedCell?.title || "Cell content"}>
                <div style={{padding: 12, whiteSpace: "pre-wrap", wordBreak: "break-word"}}>
                    {expandedCell?.content || ""}
                </div>
            </Dialog>
        </div>
    );
};

export default Chart;
