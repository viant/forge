import React, {useState, useEffect} from "react";
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

const Chart = ({container, context, isActive = true, embedded = false}) => {
    const {chart} = container;
    const [chartRef, chartSize] = useMeasuredContainer();
    const [chartReady, setChartReady] = useState(false);

    // Extract chart configuration
    const {
        type = "line",
        xAxis,
        yAxis = {},
        axes = {},
        cartesianGrid = {strokeDasharray: "3 3"},
        width,
        height,
        series,
    } = chart;
    const {palette = []} = series;
    const directSeriesChart = isDirectSeriesChart(chart);
    const seriesDefinitions = getSeriesDefinitions(chart);
    const leftAxis = {...yAxis, ...(axes.left || {})};
    const rightAxis = axes.right || null;
    const hasRightAxis = !!rightAxis || seriesDefinitions.some((entry) => entry.axis === "right");

    const [chartData, setChartData] = useState([]);
    const [selectedDataKeys, setSelectedDataKeys] = useState([]);
    const [availableDataKeys, setAvailableDataKeys] = useState([]);
    const [viewMode, setViewMode] = useState("chart");
    const [showColumnDialog, setShowColumnDialog] = useState(false);
    const [columnWidths, setColumnWidths] = useState({});
    const [expandedCell, setExpandedCell] = useState(null);

    const [selectedValueKey, setSelectedValueKey] = useState(series.valueKey || seriesDefinitions[0]?.value || "");
    const [yAxisLabel, setYAxisLabel] = useState(leftAxis.label || "");

    const { collection, loading, error } = useDataSourceState(context);

    const isPieChart = type === "pie" || type === "donut";

    function prepareData() {
        if (isPieChart) {
            const nameKey = series.nameKey || "name";
            const valueKey = series.valueKey || selectedValueKey || "value";
            const rows = (collection || []).map((row) => ({
                name: row[nameKey] ?? "unknown",
                value: Number(row[valueKey]) || 0,
                _raw: row,
            })).filter((row) => row.value > 0);
            setChartData(rows);
            setAvailableDataKeys(rows.map((row) => row.name));
            setYAxisLabel("");
            return;
        }

        if (directSeriesChart) {
            const sorted = [...(collection || [])].sort(
                (a, b) => new Date(a?.[xAxis?.dataKey]) - new Date(b?.[xAxis?.dataKey])
            );
            const keys = seriesDefinitions.map((entry) => entry.value);
            setChartData(sorted);
            setAvailableDataKeys(keys);
            setYAxisLabel(leftAxis.label || "");
            return;
        }

        const {data, keys} = transformData(collection, chart, selectedValueKey);
        setChartData(data);
        setAvailableDataKeys(keys); // Update available data keys

        // Update yAxis label based on selectedValueKey
        const selectedValue = (series.values || []).find((val) => val.value === selectedValueKey);
        if (selectedValue) {
            setYAxisLabel(selectedValue.name);
        }
    }

    useEffect(() => {
        prepareData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [collection, selectedValueKey, directSeriesChart, xAxis.dataKey, leftAxis.label, seriesDefinitions]);

    useEffect(() => {
        // Keep selectedDataKeys in sync with availableDataKeys
        if (selectedDataKeys.length === 0) {
            // Initialize selectedDataKeys to all availableDataKeys
            setSelectedDataKeys(availableDataKeys);
        } else {
            // Remove unavailable keys from selectedDataKeys
            const filteredSelectedKeys = selectedDataKeys.filter(key => availableDataKeys.includes(key));
            if (filteredSelectedKeys.length !== selectedDataKeys.length) {
                setSelectedDataKeys(filteredSelectedKeys);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
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

    const allTableColumns = [xAxis.dataKey, ...availableDataKeys];
    const [visibleColumns, setVisibleColumns] = useState(allTableColumns);

    useEffect(() => {
        setVisibleColumns((prev) => {
            const keep = prev.filter((k) => allTableColumns.includes(k));
            const add = allTableColumns.filter((k) => !keep.includes(k));
            const next = [...keep, ...add];
            return next.length ? next : [...allTableColumns];
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [xAxis.dataKey, availableDataKeys.join("|")]);




    // Function to handle selection changes for dataKeys
    const handleDataKeySelect = (dataKey) => {
        if (selectedDataKeys.includes(dataKey)) {
            // Remove dataKey
            setSelectedDataKeys(selectedDataKeys.filter((key) => key !== dataKey));
        } else {
            // Add dataKey
            setSelectedDataKeys([...selectedDataKeys, dataKey]);
        }
    };

    const handleClearSelection = () => {
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
                dataKey={xAxis.dataKey}
                tickFormatter={(val) => formatTimestamp(val, xAxis.tickFormat)}
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
                labelFormatter={(val) => formatTimestamp(val, xAxis.tickFormat)}
                formatter={(value, name, item) => {
                    const formatType = item?.payload?.__seriesFormats?.[item?.dataKey] || item?.payload?.__seriesAxes?.[item?.dataKey];
                    return [tooltipFormatterForFormat(formatType)(value), name];
                }}
                contentStyle={embedded ? {fontSize: "11px", borderRadius: "8px", border: "1px solid #d8e1e8"} : undefined}
            />
            <Legend {...legendProps}/>
            {selectedSeriesDefinitions.map((entry, index) => {
                const commonProps = {
                    key: entry.value,
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
                    return <Bar {...commonProps} stackId={entry.stackId} />;
                }
                if (entry.type === "area") {
                    return <Area {...commonProps} type="monotone" dot={embedded ? { r: 4, strokeWidth: 1, fill: "#ffffff" } : false} activeDot={embedded ? { r: 6, strokeWidth: 1.5 } : { r: 4 }} />;
                }
                return <Line {...commonProps} type="monotone" strokeLinecap="round" strokeLinejoin="round" dot={embedded ? { r: 4, strokeWidth: 1, fill: "#ffffff" } : false} activeDot={embedded ? { r: 6, strokeWidth: 1.5 } : { r: 4 }} />;
            })}
        </>
    );

    const normalizedChartData = chartData.map((row) => ({
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
            <Legend
                {...(embedded ? {wrapperStyle: {fontSize: "11px"}, iconSize: 10} : {})}
            />
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

    const resolvedWidth = width || "100%";
    const resolvedHeight = height || (embedded ? 460 : "100%");

    return (
        <div
            style={{width: resolvedWidth, height: resolvedHeight}}
            ref={chartRef}
            data-dashboard-chart-id={chartExportId}
        >
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
                chartReady && isActive && chartSize.width > 0 && chartSize.height > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        {isPieChart
                            ? pieChart
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
