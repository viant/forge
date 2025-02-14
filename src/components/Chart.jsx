import React, { useState, useEffect } from "react";
import {
    Button,
    MenuItem,
    RadioGroup,
    Radio,
} from "@blueprintjs/core";
import { MultiSelect } from "@blueprintjs/select";
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
import { format } from "date-fns";

// Function to transform rawData into chartData
export function transformData(rawData, chart, valueKey) {
    const { xAxis, series } = chart;
    const groupedData = {};
    const keysSet = new Set();

    rawData.forEach((item) => {
        const seriesName = item[series.nameKey];
        const timestamp = item[xAxis.dataKey];
        const value = item[valueKey]; // Use dynamic valueKey
        keysSet.add(seriesName);

        if (!groupedData[timestamp]) {
            groupedData[timestamp] = { [xAxis.dataKey]: timestamp };
        }

        groupedData[timestamp][seriesName] = value;
    });

    // Convert grouped data into an array and sort by timestamp
    const data = Object.values(groupedData).sort(
        (a, b) => new Date(a[xAxis.dataKey]) - new Date(b[xAxis.dataKey])
    );
    const keys = Array.from(keysSet);
    return { data, keys };
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

const Chart = ({ container, context }) => {
    const { chart } = container;
    const { handlers } = context;

    // Extract chart configuration
    const {
        xAxis,
        yAxis,
        cartesianGrid,
        width,
        height,
        series,
    } = chart;
    const { palette } = series;

    const [chartData, setChartData] = useState([]);
    const [selectedDataKeys, setSelectedDataKeys] = useState([]);
    const [availableDataKeys, setAvailableDataKeys] = useState([]);

    const [selectedValueKey, setSelectedValueKey] = useState(series.valueKey || "");
    const [yAxisLabel, setYAxisLabel] = useState(yAxis.label || "");

    function prepareData() {
        const collection = handlers.dataSource.getCollection();
        const { data, keys } = transformData(collection, chart, selectedValueKey);
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
    }, [handlers.dataSource.getCollection(), selectedValueKey]);

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

    const renderDataKeyItem = (dataKey, { modifiers, handleClick }) => {
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
            margin={{ top: 10, right: 60, left: 10, bottom: 10 }}
        >
            {/* CARTESIAN GRID */}
            <CartesianGrid strokeDasharray={cartesianGrid.strokeDasharray} />

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
            <Legend />

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

    return (
        <div style={{ width: width, height: height }}>
            {/* RadioGroup component for valueKey selection */}
            <RadioGroup
                inline={true}
                name={container.id}
                onChange={handleValueKeyChange}
                selectedValue={selectedValueKey}
            >
                {series.values.map((option, index) => (
                    <Radio key={option.value + index} label={option.label} value={option.value} />
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
                popoverProps={{ minimal: true }}
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
            <ResponsiveContainer width="100%" height="100%">
                {lineChart}
            </ResponsiveContainer>
        </div>
    );
};

export default Chart;
