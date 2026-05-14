import React, {useState, useEffect, useMemo} from "react";
import {useSignalEffect} from "@preact/signals-react";
import {
    Button,
    Dialog,
    MenuItem,
    RadioGroup,
    Radio,
    Tooltip as BpTooltip,
} from "@blueprintjs/core";
import {MultiSelect} from "@blueprintjs/select";
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
import {format} from "date-fns";
import { useDataSourceState } from "../hooks/useDataSourceState.js";
import { reconcileSelectedDataKeys, toggleSelectedDataKey } from "./chartSeriesSelection.js";
import { resolveSelector } from "../utils/selector.js";
import { getLogger } from "../utils/logger.js";

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

// Function to transform rawData into chartData
export function transformData(rawData, chart, valueKey) {
    const {xAxis, series} = chart;
    const groupedData = {};
    const keysSet = new Set();

    rawData.forEach((item) => {
        const seriesName = item[series.nameKey];
        const timestamp = item[xAxis.dataKey];
        const value = item[valueKey]; // Use dynamic valueKey
        keysSet.add(seriesName);

        if (!groupedData[timestamp]) {
            groupedData[timestamp] = {[xAxis.dataKey]: timestamp};
        }

        groupedData[timestamp][seriesName] = value;
    });

    // Convert grouped data into an array and sort by timestamp
    const data = Object.values(groupedData).sort(
        (a, b) => new Date(a[xAxis.dataKey]) - new Date(b[xAxis.dataKey])
    );
    const keys = Array.from(keysSet);
    return {data, keys};
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

function formatTimestamp(timestamp, fmt = "MM/dd") {
    try {
        return format(new Date(timestamp), fmt);
    } catch (err) {
        console.error("Invalid timestamp:", timestamp);
        return timestamp;
    }
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
    const key = resolveSelector(scope, selector);
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

const Chart = ({container, context, isActive = true, embedded = false}) => {
    const log = getLogger('chart');
    const {chart} = container;
    const [chartRef, chartSize] = useMeasuredContainer();
    const [chartReady, setChartReady] = useState(false);
    const [, forceRender] = useState(0);

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
    const [viewMode, setViewMode] = useState("chart");
    const [showColumnDialog, setShowColumnDialog] = useState(false);
    const [columnWidths, setColumnWidths] = useState({});
    const [expandedCell, setExpandedCell] = useState(null);

    const [selectedValueKey, setSelectedValueKey] = useState(series.valueKey || seriesDefinitions[0]?.value || "");
    const resolveChartContext = () => {
        if (!chart) return context;
        const refs = chart.dataSourceRefs || {};
        const selector = chart.dataSourceRefSelector || chart.dataSourceSelector;
        const source = String(chart.dataSourceRefSource || 'windowForm').toLowerCase();
        let directRef = chart.dataSourceRef || null;
        if (!directRef && selector && refs && typeof refs === 'object') {
            let scope = {};
            switch (source) {
                case 'form':
                    scope = context?.signals?.form?.peek?.() || {};
                    break;
                case 'filter':
                case 'filters':
                    scope = context?.handlers?.dataSource?.peekFilter?.() || {};
                    break;
                case 'input':
                    scope = context?.signals?.input?.peek?.() || {};
                    break;
                case 'windowform':
                default:
                    scope = context?.signals?.windowForm?.peek?.() || {};
                    break;
            }
            const key = resolveSelector(scope, selector);
            if (key != null && refs[key]) {
                directRef = refs[key];
            }
        }
        return directRef ? context.Context(directRef) : context;
    };

    useSignalEffect(() => {
        if (!chart?.dataSourceRefSelector) return;
        const source = String(chart.dataSourceRefSource || 'windowForm').toLowerCase();
        switch (source) {
            case 'form':
                context?.signals?.form?.value;
                break;
            case 'filter':
            case 'filters':
                context?.signals?.input?.value?.filter;
                break;
            case 'input':
                context?.signals?.input?.value;
                break;
            case 'windowform':
            default:
                context?.signals?.windowForm?.value;
                break;
        }
        forceRender((x) => x + 1);
    });

    const chartContext = resolveChartContext();
    useEffect(() => {
        try {
            log.debug('[chart] resolved datasource', {
                containerId: container?.id,
                baseDs: context?.identity?.dataSourceRef,
                resolvedDs: chartContext?.identity?.dataSourceRef,
                selector: chart?.dataSourceRefSelector || chart?.dataSourceSelector || null,
            });
        } catch (_) {}
    }, [chartContext, chart?.dataSourceRefSelector, chart?.dataSourceSelector, container?.id, context?.identity?.dataSourceRef]);
    const resolvedTickFormat = resolveMappedConfigValue(context, xAxis, "tickFormat", "windowForm");
    const { collection, loading, error } = useDataSourceState(chartContext);

    const isPieChart = type === "pie" || type === "donut";
    const isHorizontalBar = isHorizontalBarType(type);
    const prepared = useMemo(() => {
        if (isPieChart) {
            const nameKey = series.nameKey || "name";
            const valueKey = series.valueKey || selectedValueKey || "value";
            const rows = (collection || []).map((row) => ({
                name: row[nameKey] ?? "unknown",
                value: Number(row[valueKey]) || 0,
                _raw: row,
            })).filter((row) => row.value > 0);
            return {
                chartData: rows,
                availableDataKeys: rows.map((row) => row.name),
                yAxisLabel: "",
            };
        }

        if (directSeriesChart) {
            const sorted = [...(collection || [])].sort(
                (a, b) => new Date(a?.[xAxis?.dataKey]) - new Date(b?.[xAxis?.dataKey])
            );
            return {
                chartData: sorted,
                availableDataKeys: seriesDefinitions.map((entry) => entry.value),
                yAxisLabel: leftAxis.label || "",
            };
        }

        const {data, keys} = transformData(collection, chart, selectedValueKey);
        const selectedValue = (series.values || []).find((val) => val.value === selectedValueKey);
        return {
            chartData: data,
            availableDataKeys: keys,
            yAxisLabel: selectedValue ? selectedValue.name : (leftAxis.label || ""),
        };
    }, [chart, collection, directSeriesChart, isPieChart, leftAxis.label, selectedValueKey, series, seriesDefinitions, xAxis?.dataKey]);

    const chartData = prepared.chartData;
    const availableDataKeys = prepared.availableDataKeys;
    const yAxisLabel = prepared.yAxisLabel;

    useEffect(() => {
        setSelectedDataKeys((previousKeys) => {
            const nextSelection = reconcileSelectedDataKeys(previousKeys, availableDataKeys, selectionStateRef.current);
            selectionStateRef.current = {
                ...selectionStateRef.current,
                initialized: nextSelection.initialized,
            };
            return areKeyListsEqual(previousKeys, nextSelection.selectedDataKeys)
                ? previousKeys
                : nextSelection.selectedDataKeys;
        });
    }, [availableDataKeys]);

    useEffect(() => {
        if (!isActive || viewMode !== "chart" || chartSize.width <= 0 || chartSize.height <= 0) {
            setChartReady(false);
            return undefined;
        }
        const raf = window.requestAnimationFrame(() => setChartReady(true));
        return () => window.cancelAnimationFrame(raf);
    }, [isActive, viewMode, chartSize.width, chartSize.height]);

    useEffect(() => {
        if (embedded && viewMode !== "chart") {
            setViewMode("chart");
        }
    }, [embedded, viewMode]);

    const allTableColumns = [xAxis?.dataKey, ...availableDataKeys].filter(Boolean);
    const [visibleColumns, setVisibleColumns] = useState(allTableColumns);

    useEffect(() => {
        setVisibleColumns((prev) => {
            const keep = prev.filter((k) => allTableColumns.includes(k));
            const add = allTableColumns.filter((k) => !keep.includes(k));
            const next = [...keep, ...add];
            return next.length ? next : [...allTableColumns];
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [xAxis?.dataKey, availableDataKeys.join("|")]);




    // Function to handle selection changes for dataKeys
    const handleDataKeySelect = (dataKey) => {
        selectionStateRef.current = {initialized: true, touched: true};
        setSelectedDataKeys((previousKeys) => toggleSelectedDataKey(previousKeys, dataKey));
    };

    const handleClearSelection = () => {
        selectionStateRef.current = {initialized: true, touched: true};
        setSelectedDataKeys([]);
    };

    const renderDataKeyItem = (dataKey, {modifiers, handleClick}) => {
        const seriesDef = seriesDefinitions.find((entry) => entry.value === dataKey);
        return (
            <MenuItem
                key={dataKey}
                text={seriesDef?.label || dataKey}
                active={modifiers.active}
                icon={selectedDataKeys.includes(dataKey) ? "tick" : "blank"}
                onClick={handleClick}
                shouldDismissPopover={false}
            />
        );
    };

    // Handle valueKey change
    const handleValueKeyChange = (e) => {
        const newValueKey = e.target.value;
        setSelectedValueKey(newValueKey); // Just update the state
    };

    const chartMargin = embedded
        ? {top: 24, right: 12, left: 4, bottom: 8}
        : {top: 10, right: 60, left: 10, bottom: 10};
    const legendProps = embedded
        ? {verticalAlign: "top", align: "center", wrapperStyle: {fontSize: "10px", lineHeight: 1.1, paddingBottom: "6px", color: "#5f6b7c"}}
        : {};
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

    const sharedChartChildren = (
        <>
            <CartesianGrid strokeDasharray={cartesianGrid.strokeDasharray} stroke={embedded ? "rgba(95,107,124,0.18)" : undefined}/>
            <XAxis
                dataKey={xAxis?.dataKey || "name"}
                tickFormatter={(val) => formatTimestamp(val, resolvedTickFormat)}
                tick={embedded ? {fontSize: 11, fill: "#5f6b7c"} : undefined}
                minTickGap={embedded ? 24 : 5}
                label={{
                    value: embedded ? "" : xAxis.label,
                    position: "insideBottomRight",
                    offset: 0,
                }}
            />
            <YAxis
                yAxisId="left"
                width={embedded ? 56 : 100}
                tickFormatter={createAxisTickFormatter(leftAxis.format)}
                tick={embedded ? {fontSize: 11, fill: "#5f6b7c"} : undefined}
                label={{
                    value: embedded ? "" : (leftAxis.label || yAxisLabel),
                    angle: -90,
                    position: "insideLeft",
                }}
                domain={leftAxis.domain}
            />
            {hasRightAxis ? (
                <YAxis
                    yAxisId="right"
                    orientation="right"
                    width={embedded ? 56 : 80}
                    tickFormatter={createAxisTickFormatter(rightAxis?.format)}
                    tick={embedded ? {fontSize: 11, fill: "#5f6b7c"} : undefined}
                    label={rightAxis?.label ? {
                        value: embedded ? "" : rightAxis.label,
                        angle: 90,
                        position: "insideRight",
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
            {showChartLegend ? <Legend {...legendProps}/> : null}
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
                    return <Bar key={entry.value} {...commonProps} stackId={entry.stackId} />;
                }
                if (entry.type === "area") {
                    return <Area key={entry.value} {...commonProps} type="monotone" dot={embedded ? { r: 4, strokeWidth: 1, fill: "#ffffff" } : false} activeDot={embedded ? { r: 6, strokeWidth: 1.5 } : { r: 4 }} />;
                }
                return <Line key={entry.value} {...commonProps} type="monotone" strokeLinecap="round" strokeLinejoin="round" dot={embedded ? { r: 4, strokeWidth: 1, fill: "#ffffff" } : false} activeDot={embedded ? { r: 6, strokeWidth: 1.5 } : { r: 4 }} />;
            })}
        </>
    );

    const normalizedChartData = (isHorizontalBar
        ? [...chartData].sort((a, b) => {
            const primaryKey = selectedSeriesDefinitions[0]?.value;
            return Number(b?.[primaryKey] || 0) - Number(a?.[primaryKey] || 0);
        })
        : chartData
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
                ...normalizedChartData.map((row) => String(row?.[categoryKey] ?? "").length * 6 + 20)
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
                {selectedSeriesDefinitions.length > 1 ? <Legend {...legendProps} /> : null}
                {selectedSeriesDefinitions.length === 1 ? (
                    <Bar dataKey={primarySeries.value} name={primarySeries.name || primarySeries.label} fill={primarySeries.color} barSize={barSize}>
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
                cx="50%"
                cy="50%"
                innerRadius={pieInnerRadius}
                outerRadius="78%"
                paddingAngle={pieFilteredData.length > 1 ? 2 : 0}
                label={embedded ? false : ({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={!embedded}
            >
                {pieFilteredData.map((entry, index) => (
                    <Cell key={entry.name || index} fill={piePalette[index % piePalette.length]} />
                ))}
            </Pie>
            <Tooltip
                formatter={(value) => formatLargeNumber(value)}
                contentStyle={embedded ? {fontSize: "11px", borderRadius: "8px", border: "1px solid #d8e1e8"} : undefined}
            />
            {showChartLegend ? (
                <Legend
                    {...(embedded ? {wrapperStyle: {fontSize: "11px"}, iconSize: 10} : {})}
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
                const len = String(row?.[key] ?? "").length;
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
            lines.push(cols.map((c) => escapeCsvCell(row?.[c])).join(","));
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
                const raw = chartData[rowIndex]?.[columnKey] ?? "";
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

    const resolvedWidth = isHorizontalBar
        ? (width || (embedded ? "82%" : "85%"))
        : (width || "100%");
    const resolvedHeight = isHorizontalBar
        ? (height || (embedded ? 320 : "100%"))
        : (height || (embedded ? 460 : "100%"));
    const canRenderChartSelection = isPieChart ? pieFilteredData.length > 0 : selectedSeriesDefinitions.length > 0;

    return (
        <div
            style={{width: resolvedWidth, height: resolvedHeight, minWidth: 0, minHeight: 0, margin: isHorizontalBar ? "0 auto" : undefined}}
            ref={chartRef}
            data-dashboard-chart-id={chartExportId}
        >
            {showEmbeddedSeriesSelector ? (
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
            {!embedded ? (
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

                    <MultiSelect
                        items={availableDataKeys}
                        itemRenderer={renderDataKeyItem}
                        onItemSelect={handleDataKeySelect}
                        tagRenderer={(dataKey) => seriesDefinitions.find((entry) => entry.value === dataKey)?.label || dataKey}
                        selectedItems={selectedDataKeys}
                        fill={true}
                        placeholder="Select data keys..."
                        popoverProps={{minimal: true}}
                        resetOnSelect={false}
                        tagInputProps={{
                            onRemove: (dataKey) => {
                                handleDataKeySelect(dataKey);
                            },
                            rightElement: (
                                <Button
                                    icon="cross"
                                    minimal={true}
                                    onClick={handleClearSelection}
                                />
                            ),
                        }}
                    />
                    <div style={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 8}}>
                        <div style={{display: "flex", gap: 6}}>
                            <Button small minimal={viewMode !== "chart"} intent={viewMode === "chart" ? "primary" : "none"} onClick={() => setViewMode("chart")}>
                                Chart
                            </Button>
                            <Button small minimal={viewMode !== "table"} intent={viewMode === "table" ? "primary" : "none"} onClick={() => setViewMode("table")}>
                                Table
                            </Button>
                        </div>
                        {viewMode === "table" ? (
                            <div style={{display: "flex", gap: 6}}>
                                <Button small icon="cog" onClick={() => setShowColumnDialog(true)}>Columns</Button>
                                <Button small icon="download" onClick={downloadCsv}>CSV</Button>
                            </div>
                        ) : null}
                    </div>
                </>
            ) : null}
            {loading && (
                <div style={{textAlign: 'center', padding: 4}}>Loading…</div>
            )}
            {error && (
                <div style={{color: 'red', padding: 4}}>{`${error}`}</div>
            )}

            {viewMode === "chart" ? (
                !canRenderChartSelection && !loading && !error ? (
                    <div
                        style={{
                            height: "100%",
                            minHeight: embedded ? 220 : 260,
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
                ) : chartReady && isActive && chartSize.width > 0 && chartSize.height > 0 ? (
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
                ) : null
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
