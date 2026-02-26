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
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";
import {format} from "date-fns";
import { useDataSourceState } from "../hooks/useDataSourceState.js";

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

const Chart = ({container, context}) => {
    const {chart} = container;

    // Extract chart configuration
    const {
        xAxis,
        yAxis,
        cartesianGrid,
        width,
        height,
        series,
    } = chart;
    const {palette} = series;

    const [chartData, setChartData] = useState([]);
    const [selectedDataKeys, setSelectedDataKeys] = useState([]);
    const [availableDataKeys, setAvailableDataKeys] = useState([]);
    const [viewMode, setViewMode] = useState("chart");
    const [showColumnDialog, setShowColumnDialog] = useState(false);
    const [columnWidths, setColumnWidths] = useState({});
    const [expandedCell, setExpandedCell] = useState(null);

    const [selectedValueKey, setSelectedValueKey] = useState(series.valueKey || "");
    const [yAxisLabel, setYAxisLabel] = useState(yAxis.label || "");

    const { collection, loading, error } = useDataSourceState(context);

    function prepareData() {
        const {data, keys} = transformData(collection, chart, selectedValueKey);
        setChartData(data);
        setAvailableDataKeys(keys); // Update available data keys

        // Update yAxis label based on selectedValueKey
        const selectedValue = series.values.find((val) => val.value === selectedValueKey);
        if (selectedValue) {
            setYAxisLabel(selectedValue.name);
        }
    }

    useEffect(() => {
        prepareData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [collection, selectedValueKey]);

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
        return (
            <MenuItem
                key={dataKey}
                text={dataKey}
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

    // Prepare lineChart component
    const lineChart = (
        <LineChart
            data={chartData}
            margin={{top: 10, right: 60, left: 10, bottom: 10}}
        >
            {/* CARTESIAN GRID */}
            <CartesianGrid strokeDasharray={cartesianGrid.strokeDasharray}/>

            {/* X-AXIS */}
            <XAxis
                dataKey={xAxis.dataKey}
                tickFormatter={(val) => formatTimestamp(val, xAxis.tickFormat)}
                label={{
                    value: xAxis.label,
                    position: "insideBottomRight",
                    offset: 0,
                }}
            />

            {/* Y-AXIS */}
            <YAxis
                width={100} // Added width to prevent label truncation
                tickFormatter={formatLargeNumber} // Format large numbers
                label={{
                    value: yAxisLabel, // Use dynamic yAxis label
                    angle: -90,
                    position: "insideLeft",
                }}
            />

            {/* TOOLTIP */}
            <Tooltip
                labelFormatter={(val) => formatTimestamp(val, xAxis.tickFormat)}
                formatter={(value) => formatLargeNumber(value)}
            />

            {/* LEGEND */}
            <Legend/>

            {/* Dynamically create <Line> components for each selected dataKey */}
            {selectedDataKeys.map((dataKey, index) => (
                <Line
                    key={dataKey}
                    type="monotone"
                    dataKey={dataKey}
                    name={dataKey}
                    stroke={palette[index % palette.length]}
                    dot={false}
                />
            ))}
        </LineChart>
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

    return (
        <div style={{width: width, height: height}}>
            {/* RadioGroup component for valueKey selection */}
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

            {/* MultiSelect component for dataKey selection */}
            <MultiSelect
                items={availableDataKeys} // Use availableDataKeys instead of selectedDataKeys
                itemRenderer={renderDataKeyItem}
                onItemSelect={handleDataKeySelect}
                tagRenderer={(dataKey) => dataKey}
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
            {loading && (
                <div style={{textAlign: 'center', padding: 4}}>Loading…</div>
            )}
            {error && (
                <div style={{color: 'red', padding: 4}}>{`${error}`}</div>
            )}

            {viewMode === "chart" ? (
                <ResponsiveContainer width="100%" height="100%">
                    {lineChart}
                </ResponsiveContainer>
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

            <Dialog isOpen={showColumnDialog} onClose={() => setShowColumnDialog(false)} title="Column customization">
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

            <Dialog isOpen={!!expandedCell} onClose={() => setExpandedCell(null)} title={expandedCell?.title || "Cell content"}>
                <div style={{padding: 12, whiteSpace: "pre-wrap", wordBreak: "break-word"}}>
                    {expandedCell?.content || ""}
                </div>
            </Dialog>
        </div>
    );
};

export default Chart;
