import React, {useState, useEffect, useMemo} from "react";
import {useSignals} from '@preact/signals-react/runtime';
import {
    Dialog,
    RadioGroup,
    Radio,
    Tooltip as BpTooltip,
} from "@blueprintjs/core";
import { Table as BpTable, Column as BpColumn, Cell as BpCell, ColumnHeaderCell as BpColumnHeaderCell } from "@blueprintjs/table";
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
    ResponsiveContainer,
} from "recharts";
import { useDataSourceState } from "../hooks/useDataSourceState.js";
import {
    aggregateDirectSeriesData,
    buildPieSliceCellKey,
    buildPieChartData,
    fillMissingTemporalBuckets,
    formatTimestamp,
    materializeChartDisplayRows,
    normalizeChartKey,
    readChartDataValue,
    resolveChartBodyState,
    resolveChartLoadingState,
    resolveVisibleChartState,
    transformData,
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
    })).filter((entry) => !!entry.value);
}

function formatValueByFormat(value, formatType) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return value;
    }
    switch (formatType) {
        case "currency":
            return `$${numeric.toFixed(2)}`;
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

// Function to format large numbers with commas
function formatLargeNumber(value) {
    if (value >= 1e9) {
        return `${(value / 1e9).toFixed(1)}B`;
    } else if (value >= 1e6) {
        return `${(value / 1e6).toFixed(1)}M`;
    } else if (value >= 1e3) {
        return `${(value / 1e3).toFixed(1)}K`;
    } else {
        return value;
    }
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

function normalizeChartExtent(value, fallback) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string') {
        const normalized = value.trim();
        return normalized || fallback;
    }
    return fallback;
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

    const isPieChart = type === "pie" || type === "donut";
    const isHorizontalBar = isHorizontalBarType(type);
    const prepared = useMemo(() => {
        const chartRows = materializeChartDisplayRows(chart, effectiveCollection || []);
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
        if ((embedded || !showControls) && viewMode !== "chart") {
            setViewMode("chart");
        }
    }, [embedded, showControls, viewMode]);

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

    const chartMargin = embedded
        ? {top: 24, right: 12, left: 6, bottom: 34}
        : {top: 10, right: 60, left: 14, bottom: 42};
    const legendProps = embedded
        ? {verticalAlign: "top", align: "center", wrapperStyle: {fontSize: "10px", lineHeight: 1.1, paddingBottom: "6px", color: "#5f6b7c"}}
        : {};
    const axisTickStyle = embedded
        ? {fontSize: 11, fill: "#5f6b7c"}
        : {fontSize: 12, fill: "#667085"};
    const axisLabelStyle = embedded
        ? undefined
        : {fontSize: 12, fill: "#667085", fontWeight: 500};
    const gridStroke = embedded ? "rgba(95,107,124,0.18)" : "rgba(152,162,179,0.22)";
    const showEmbeddedSeriesSelector = embedded && !isPieChart && availableDataKeys.length > 1;
    const showChartLegend = !showEmbeddedSeriesSelector;

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

    const sharedChartChildren = (
        <>
            <CartesianGrid strokeDasharray={cartesianGrid.strokeDasharray} stroke={gridStroke}/>
            <XAxis
                dataKey={xAxis?.dataKey || "name"}
                tickFormatter={(val) => formatTimestamp(val, resolvedTickFormat)}
                tick={axisTickStyle}
                axisLine={false}
                tickLine={false}
                minTickGap={embedded ? 24 : 5}
                label={{
                    value: embedded ? "" : xAxis.label,
                    position: "insideBottomRight",
                    offset: 0,
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
                domain={leftAxis.domain}
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
                labelFormatter={(val) => formatTimestamp(val, resolvedTickFormat)}
                formatter={(value, name, item) => {
                    const formatType = item?.payload?.__seriesFormats?.[item?.dataKey] || item?.payload?.__seriesAxes?.[item?.dataKey];
                    return [tooltipFormatterForFormat(formatType)(value), name];
                }}
                contentStyle={embedded ? {fontSize: "11px", borderRadius: "8px", border: "1px solid #d8e1e8"} : undefined}
            />
            {showChartLegend ? <Legend {...legendProps} {...(interactiveLegendContent ? { content: interactiveLegendContent } : {})}/> : null}
            {selectedSeriesDefinitions.map((entry, index) => {
                const commonProps = {
                    dataKey: entry.value,
                    name: entry.name || entry.label,
                    yAxisId: entry.axis || "left",
                    stroke: entry.color,
                    fill: entry.color,
                    strokeWidth: entry.strokeWidth || (embedded ? 3 : 2),
                    strokeDasharray: entry.strokeDasharray,
                    fillOpacity: entry.fillOpacity ?? (entry.type === "area" ? 0.22 : 1),
                    opacity: entry.opacity,
                };

                if (entry.type === "bar") {
                    return <Bar key={entry.value} {...commonProps} stackId={entry.stackId} {...(interactiveDatumSelection ? { onClick: (payload) => emitSeriesDatumSelection(entry.value, payload) } : {})} />;
                }
                if (entry.type === "area") {
                    return <Area key={entry.value} {...commonProps} type="monotone" connectNulls={true} dot={embedded || interactiveDatumSelection ? { r: 4, strokeWidth: 1, fill: "#ffffff" } : false} activeDot={embedded || interactiveDatumSelection ? { r: 6, strokeWidth: 1.5 } : { r: 4 }} {...(interactiveDatumSelection ? { onClick: (payload) => emitSeriesDatumSelection(entry.value, payload) } : {})} />;
                }
                return <Line key={entry.value} {...commonProps} type="monotone" connectNulls={true} strokeLinecap="round" strokeLinejoin="round" dot={embedded || interactiveDatumSelection ? { r: 4, strokeWidth: 1, fill: "#ffffff" } : false} activeDot={embedded || interactiveDatumSelection ? { r: 6, strokeWidth: 1.5 } : { r: 4 }} {...(interactiveDatumSelection ? { onClick: (payload) => emitSeriesDatumSelection(entry.value, payload) } : {})} />;
            })}
        </>
    );

    const denseChartData = fillMissingTemporalBuckets(
        chartData,
        xAxis?.dataKey || "name",
        selectedSeriesDefinitions,
        chart?.fillMissingTemporalBuckets,
    );

    const normalizedChartData = (isHorizontalBar
        ? [...denseChartData].sort((a, b) => {
            const primaryKey = selectedSeriesDefinitions[0]?.value;
            return Number(b?.[primaryKey] || 0) - Number(a?.[primaryKey] || 0);
        })
        : denseChartData
    ).map((row) => ({
        ...row,
        __seriesFormats: Object.fromEntries(selectedSeriesDefinitions.map((entry) => [entry.value, entry.format || leftAxis.format])),
        __seriesAxes: Object.fromEntries(selectedSeriesDefinitions.map((entry) => [entry.value, entry.axis === "right" ? rightAxis?.format : leftAxis.format])),
    }));

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
        const categoryWidth = Math.min(
            220,
            Math.max(
                110,
                ...normalizedChartData.map((row) => String(readChartDataValue(row, categoryKey) ?? "").length * 6 + 20)
            )
        );
        const barSize = embedded ? 10 : 12;

        return (
            <BarChart data={normalizedChartData} margin={chartMargin} layout="vertical">
                <CartesianGrid strokeDasharray={cartesianGrid.strokeDasharray} stroke={embedded ? "rgba(95,107,124,0.18)" : undefined}/>
                <XAxis
                    type="number"
                    tickFormatter={createAxisTickFormatter(primarySeries.format || leftAxis.format)}
                    tick={embedded ? {fontSize: 11, fill: "#5f6b7c"} : undefined}
                    label={{
                        value: embedded ? "" : (leftAxis.label || primarySeries.label || ""),
                        position: "insideBottomRight",
                        offset: 0,
                    }}
                    domain={leftAxis.domain}
                />
                <YAxis
                    type="category"
                    dataKey={categoryKey}
                    width={categoryWidth}
                    tick={embedded ? {fontSize: 11, fill: "#5f6b7c"} : undefined}
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
                        {...(interactiveDatumSelection ? { onClick: (payload) => emitSeriesDatumSelection(primarySeries.value, payload) } : {})}
                    >
                        {normalizedChartData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={activePalette[index % activePalette.length]} />
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
                            stackId={type === "funnel_bar" ? undefined : entry.stackId}
                            {...(interactiveDatumSelection ? { onClick: (payload) => emitSeriesDatumSelection(entry.value, payload) } : {})}
                        />
                    ))
                )}
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
    const pieInnerRadius = type === "donut" ? "45%" : 0;
    const pieChart = (
        <PieChart margin={embedded ? {top: 8, right: 8, bottom: 8, left: 8} : {top: 10, right: 10, bottom: 10, left: 10}}>
            <Pie
                data={pieFilteredData}
                dataKey="value"
                nameKey="name"
                {...(interactiveDatumSelection ? { onClick: emitDatumSelection } : {})}
                cx="50%"
                cy="50%"
                innerRadius={pieInnerRadius}
                outerRadius="78%"
                paddingAngle={pieFilteredData.length > 1 ? 2 : 0}
                label={embedded ? false : ({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={!embedded}
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
                    {...(interactiveLegendContent ? { content: interactiveLegendContent } : {})}
                />
            ) : null}
        </PieChart>
    );

    const computedWidthByCol = React.useMemo(() => {
        const out = {};
        allTableColumns.forEach((key) => {
            const headerLen = String(key || "").length;
            let maxLen = headerLen;
            chartData.forEach((row) => {
                const len = String(readChartDataValue(row, key) ?? "").length;
                if (len > maxLen) maxLen = len;
            });
            const w = Math.max(110, Math.min(420, maxLen * 8 + 28));
            out[key] = w;
        });
        return out;
    }, [allTableColumns, chartData]);

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
        const lines = [cols.map(escapeCsvCell).join(",")];
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

    const tableColumns = visibleColumns.map((columnKey) => (
        <BpColumn
            key={columnKey}
            columnHeaderCellRenderer={() => <BpColumnHeaderCell name={columnKey}/>}
            cellRenderer={(rowIndex) => {
                const raw = readChartDataValue(chartData[rowIndex], columnKey) ?? "";
                const text = String(raw);
                const isLong = text.length > 120;
                const display = isLong ? `${text.slice(0, 120)}…` : text;
                const content = <span>{display}</span>;
                return (
                    <BpCell
                        style={{whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor: isLong ? "pointer" : "default"}}
                        onClick={() => isLong && setExpandedCell({title: columnKey, content: text})}
                    >
                        {isLong ? (
                            <BpTooltip content={<div style={{maxWidth: 640, whiteSpace: "pre-wrap", wordBreak: "break-word"}}>{text}</div>}>
                                {content}
                            </BpTooltip>
                        ) : content}
                    </BpCell>
                );
            }}
        />
    ));

    const chartExportId = container?.id && String(container?.kind || '').startsWith('dashboard.')
        ? container.id
        : undefined;

    const hasUnderlyingChartRows = isPieChart ? chartData.length > 0 : normalizedChartData.length > 0;
    const canRenderChartSelection = isPieChart ? pieFilteredData.length > 0 : selectedSeriesDefinitions.length > 0;
    const hasChartRows = isPieChart ? pieFilteredData.length > 0 : normalizedChartData.length > 0;
    const hasRenderableSeriesValues = isPieChart
        ? pieFilteredData.some((entry) => Number.isFinite(Number(entry?.value)))
        : normalizedChartData.some((row) => selectedSeriesDefinitions.some((entry) => Number.isFinite(Number(row?.[entry.value]))));
    const hasResolvedMetricsPayload = chartMetrics && typeof chartMetrics === 'object' && Object.keys(chartMetrics).length > 0;
    const showResolvedEmptyStateWhileLoading =
        effectiveLoading
        && !staleWhileLoading
        && !error
        && !hasChartRows
        && hasResolvedMetricsPayload;
    const emptyChartMessage = resolveEmptyChartMessage(chartMetrics);
    const showSeriesSelectionControls = !showResolvedEmptyStateWhileLoading;
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
        ? normalizeChartExtent(width, embedded ? "82%" : "85%")
        : normalizeChartExtent(width, "100%");
    const resolvedHeight = isHorizontalBar
        ? normalizeChartExtent(height, embedded ? 320 : 260)
        : normalizeChartExtent(height, embedded ? 380 : 240);
    const resolvedMinHeight = (() => {
        if (typeof resolvedHeight === 'number') {
            return resolvedHeight;
        }
        const normalized = typeof resolvedHeight === 'string' ? resolvedHeight.trim().toLowerCase() : '';
        if (normalized === '100%') {
            return embedded ? 220 : 420;
        }
        return 0;
    })();
    const chartViewportStyle = {
        width: "100%",
        height: resolvedHeight,
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
            {showControls && showEmbeddedSeriesSelector && showSeriesSelectionControls ? (
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
            {showControls && !embedded && showSeriesSelectionControls ? (
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
                <div style={{width: "100%", marginTop: 8, overflowX: "auto"}}>
                    <BpTable
                        numRows={chartData.length}
                        columnWidths={tableColumnWidths}
                        onColumnWidthChanged={(indexOrSize, sizeOrIndex) => {
                            let idx = indexOrSize;
                            let size = sizeOrIndex;
                            if (idx > 2000 && size < 200) {
                                const t = idx;
                                idx = size;
                                size = t;
                            }
                            const key = visibleColumns[idx];
                            if (key && Number.isFinite(size) && size > 60) {
                                setColumnWidths((prev) => ({...prev, [key]: size}));
                            }
                        }}
                        enableGhostCells={false}
                        enableRowHeader={false}
                        defaultRowHeight={28}
                    >
                        {tableColumns}
                    </BpTable>
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
                    {allTableColumns.map((key) => (
                        <div key={key} style={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12}}>
                            <label className="bp4-control bp4-checkbox" style={{marginBottom: 0}}>
                                <input
                                    type="checkbox"
                                    checked={visibleColumns.includes(key)}
                                    onChange={() => toggleColumnVisibility(key)}
                                />
                                <span className="bp4-control-indicator"/>
                                {key}
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
                    ))}
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
