import React, { useState, useEffect, useRef, useMemo } from "react";
import { HTMLTable, Dialog } from "@blueprintjs/core";
import numeral from "numeral";
import { useColumnsHandlers, tableHandlers } from "../../hooks/event.js";
import { useDataSourceState } from "../../hooks/useDataSourceState.js";
import TableBody from "./basic/TableBody.jsx";
import TableFooter from "./basic/TableFooter.jsx";
import TableHeader from "./basic/TableHeader.jsx";
import FilterDialog from "./FilterDialog.jsx";
import SettingsDialog from "./SettingsDialog.jsx";
import "./Basic.css";
import Toolbar from "./basic/Toolbar.jsx";
import FullContentDialog from "./FullContentDialog";

const defaultCellWidth = 30; // Adjust as needed

export const resolveKey = (holder, name) => {
    if (holder == null) return undefined;
    const keys = name.split(".");
    if (keys.length === 1) {
        return holder[name];
    }
    let result = holder;
    for (const key of keys) {
        result = result[key];
        if(result === undefined) {
            break;
        }
    }
    return result;
};

function convertWidthsToPct(columns, tableWidth) {
    const total = columns.reduce((acc, col) => acc + (col.width || defaultCellWidth), 0) || 1;

    const converted = columns.map((col) => {
        const colWidth = col.width || defaultCellWidth;
        const fraction = colWidth / total;
        const pct = fraction * 100;
        const widthPct = pct.toFixed(2) + "%";
        const px = fraction * tableWidth;
        const minWidth = px.toFixed(0) + "px";
        return { ...col, widthPct, minWidth };
    });

    return converted;
}

const Basic = ({ context, container, columns, pagination, children }) => {
    const tableRef = useRef(null);

    const [tableWidth, setTableWidth] = useState(0);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [popupContent, setPopupContent] = useState("");
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [columnsHandlers, setColumnsHandlers] = useState({});

    const { collection: collectionData, loading, error, selection } = useDataSourceState(context);
    const collection = collectionData; // keep old variable name for compatibility
    const [selectedRecord, setSelectedRecord] = useState({});

    // keep selectedRecord in sync with DataSource selection
    useEffect(() => {
        if (selection) {
            setSelectedRecord(selection);
        }
    }, [selection]);

    const [sortColumnId, setSortColumnId] = useState(null);
    const [sortDirection, setSortDirection] = useState("asc");

    // loading & error come from useDataSourceState hook

    const { dataSource, handlers } = context;

    const events = tableHandlers(context, container);

    const filterSets = handlers?.dataSource?.getFilterSets?.() || [...(dataSource?.filterSet || [])];

    const enforceColumnSize = container?.table?.enforceColumnSize !== false; // default to true

    const handleShowFullContent = (content) => {
        setPopupContent(content);
        setIsDialogOpen(true);
    };

    const initConfiguredColumns = (cols) => {
        return cols.map((col) => ({
            ...col,
            visible: col.visible !== false,
            displayName: col.displayName || col.name,
            nonExcludable: !(col.displayName || col.name),
        }));
    };

    // Initialize configuredColumns with nonExcludable property
    const [configuredColumns, setConfiguredColumns] = useState([]);

    // Load settings from localStorage on mount
    useEffect(() => {
        const key = context.tableSettingKey(container.id);
        const savedColumns = localStorage.getItem(key);

        if (savedColumns) {
            try {
                const parsedColumns = JSON.parse(savedColumns);
                setConfiguredColumns(parsedColumns);
            } catch (e) {
                console.error('Error parsing saved column settings:', e);
                setConfiguredColumns(initConfiguredColumns(columns));
            }
        } else {
            setConfiguredColumns(initConfiguredColumns(columns));
        }
    }, [columns, container.id]);

    // Ensure non-excludable columns are always visible
    const visibleColumns = useMemo(
        () => configuredColumns.filter((col) => col.visible || col.nonExcludable),
        [configuredColumns]
    );

    const [columnsToUse, setColumnsToUse] = useState(visibleColumns);

    useEffect(() => {
        setColumnsHandlers(useColumnsHandlers(context, columns));
        const data = handlers.dataSource.getCollection();
        if (!data?.length && collection?.length === 0) {
            events.onInit.execute({});
        }
    }, []);

    // Apply sorting to collection when it changes or when sort parameters change
    const sortedCollection = useMemo(() => {
        if (!sortColumnId || !collection?.length) {
            return collection;
        }

        return [...collection].sort((a, b) => {
            const aVal = resolveKey(a, sortColumnId);
            const bVal = resolveKey(b, sortColumnId);

            // Handle null/undefined values
            if (aVal === undefined || aVal === null) return sortDirection === "asc" ? -1 : 1;
            if (bVal === undefined || bVal === null) return sortDirection === "asc" ? 1 : -1;

            // Case insensitive sort for strings
            if (typeof aVal === 'string' && typeof bVal === 'string') {
                return sortDirection === "asc"
                    ? aVal.localeCompare(bVal)
                    : bVal.localeCompare(aVal);
            }

            if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
            if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
            return 0;
        });
    }, [collection, sortColumnId, sortDirection]);



    useEffect(() => {
        if (enforceColumnSize && tableWidth > 0) {
            const updatedColumns = convertWidthsToPct(visibleColumns, tableWidth);
            setColumnsToUse(updatedColumns);
        } else {
            setColumnsToUse(visibleColumns);
        }
    }, [enforceColumnSize, tableWidth, visibleColumns]);

    // Added useEffect to update tableWidth when the table's width changes
    useEffect(() => {
        const div = tableRef.current;
        if (!div) return;

        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                if (entry.contentRect) {
                    setTableWidth(entry.contentRect.width);
                }
            }
        });

        resizeObserver.observe(div);

        // Set initial width
        setTableWidth(div.clientWidth);

        return () => {
            resizeObserver.disconnect();
        };
    }, [tableRef]);

    const numeralFormats = {
        int: "0,0",
        numeric: "0,0.00",
        precision: "0,0.00000000",
        usdCurrency: "$0,0.00",
        percent: "0.00%",
    };

    // Use useMemo to compute preparedData from sortedCollection instead of collection
    const preparedData = useMemo(() => {
        const newPreparedData = [];
        for (let rowIndex = 0; rowIndex < sortedCollection.length; rowIndex++) {
            const item = sortedCollection[rowIndex];
            const rowArray = [];

            for (let colIndex = 0; colIndex < columnsToUse.length; colIndex++) {
                const col = columnsToUse[colIndex];
                const rawValue = resolveKey(item, col.id);
                let displayedText = rawValue
                if (col.numericFormat) {
                    const format = numeralFormats[col.numericFormat] || col.numericFormat
                    let numeralValue = 0.0
                    if (typeof rawValue !== 'number') {
                        numeralValue = parseFloat(rawValue).toFixed(10);
                    } else {
                        numeralValue = rawValue.toFixed(10)
                    }
                    displayedText = numeral(numeralValue).format(format)
                    if(displayedText === "NaN") {
                        displayedText = numeralValue + ''
                    }
                }
                const cellKey = `${rowIndex}-${col.id}`;
                let align = col.align;
                if (!align && col.numericFormat) {
                    align = "right";
                }
                rowArray.push({
                    id: cellKey,
                    align: align || "left",
                    displayedText: displayedText,
                    value: rawValue,
                });
            }
            newPreparedData.push(rowArray);
        }
        return newPreparedData;
    }, [sortedCollection, columnsToUse, loading]);

    const handleOpenFilter = () => setIsFilterOpen(true);
    const handleCloseFilter = () => setIsFilterOpen(false);

    const handleOpenSettings = () => setIsSettingsOpen(true);
    const handleCloseSettings = () => setIsSettingsOpen(false);

    const handleApplyFilters = (args) => {
        const { filter = {} } = args;
        handlers.dataSource.setSilentFilterValues(filter);
        return events.onApplyFilter.execute(args);
    };

    const handleSaveColumnSettings = (updatedCols) => {
        setConfiguredColumns(updatedCols);
        const key = context.tableSettingKey(container.id);
        localStorage.setItem(key, JSON.stringify(updatedCols));
    };

    const handleResetSettings = () => {
        const key = context.tableSettingKey(container.id);
        localStorage.removeItem(key);
        setConfiguredColumns(initConfiguredColumns(columns));
    };

    const handleSort = (columnId) => {
        let newDirection = "asc";
        if (sortColumnId === columnId) {
            newDirection = sortDirection === "asc" ? "desc" : "asc";
        }
        setSortColumnId(columnId);
        setSortDirection(newDirection);
    };

    const pagingEnabled = dataSource?.paging?.enabled || false;
    const pagingSize = dataSource?.paging?.size || 0;
    const backfillCount =
        pagingSize > sortedCollection.length ? pagingSize - sortedCollection.length : 0;

    const tableTitle = container?.table?.title || "";
    handlers["table"] = {
        openSetting: handleOpenSettings,
    };
    handlers["dataSource"]["openFilter"] = handleOpenFilter;

    const fullWidth = container?.table?.fullWidth === true;

    return (
        <div
            className="basic-table-wrapper"
            style={{
                overflow: "auto",
                width: fullWidth ? "100%" : "90%",
                boxSizing: "border-box",
            }}
            ref={tableRef}
        >
            <Toolbar
                context={context}
                toolbarItems={container?.table?.toolbar?.items || []}
            />

            <HTMLTable style={{ width: "100%", tableLayout: "fixed" }}>
                {/* Table Header */}
                <TableHeader
                    context={context}
                    columns={columnsToUse}
                    tableTitle={tableTitle}
                    sortConfig={{ onSort: handleSort, sortColumnId, sortDirection }}
                />

                {/* Table Body */}
                <TableBody
                    context={context}
                    collection={sortedCollection}
                    preparedData={preparedData}
                    columns={columnsToUse}
                    events={events}
                    columnsHandlers={columnsHandlers}
                    backfillCount={backfillCount}
                    loading={loading}
                    error={error}
                    enforceColumnSize={enforceColumnSize}
                    onShowFullContent={handleShowFullContent}
                />

                {/* Table Footer */}
                {pagingSize > 0 ? (
                    <TableFooter
                        columnsLength={columnsToUse.length}
                        pagination={pagination}
                        context={context}
                        pagingEnabled={pagingEnabled}
                    />
                ) : null}
            </HTMLTable>

            {/* Dialog for Full Cell Content */}
            <FullContentDialog
                isOpen={isDialogOpen}
                onClose={() => setIsDialogOpen(false)}
                content={popupContent}
            />

            {/* Filter Dialog */}
            <FilterDialog
                isOpen={isFilterOpen}
                onClose={handleCloseFilter}
                filterSets={filterSets}
                onApplyFilters={handleApplyFilters}
                filter={handlers.dataSource.peekFilter()}
            />

            {/* Settings Dialog */}
            <SettingsDialog
                isOpen={isSettingsOpen}
                onClose={handleCloseSettings}
                columns={configuredColumns}
                onSaveColumnSettings={handleSaveColumnSettings}
                onResetColumns={handleResetSettings}  // Pass the reset handler
            />
        </div>
    );
};

export default Basic;
