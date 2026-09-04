import React, { useState, useEffect, useRef, useMemo } from "react";
import { HTMLTable, Spinner } from "@blueprintjs/core";
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
import TableEmptyState from "./basic/TableEmptyState.jsx";
import FullContentDialog from "./FullContentDialog.jsx";
import {matchingRules, mergeClassNames, mergeStyles, normalizeRuleList} from "./formattingRules.js";
import {resolveTableCellText, resolveTableLink} from "../../utils/tableLink.js";
import {resolveKey} from "../../utils/selector.js";
import {filterEmptyStateToolbarItems, resolveTableEmptyState, shouldRenderTableEmptyState} from "./tableEmptyState.js";
import {preserveDeclaredColumnWidths, scrollableTableWidth, tableBackfillCount, withStickyColumnOffsets} from './tableSizing.js';
import {evaluatePlainVisibleWhen} from '../visibleWhen.js';
import {resolveClientPagination} from './clientPagination.js';
import {useSignals} from '@preact/signals-react/runtime';
import {applyClientFilters} from './clientFilters.js';

const defaultCellWidth = 30; // Adjust as needed

const isFooterToolbarItem = (item = {}) => ["footer", "bottom"].includes(String(item.placement || "").toLowerCase());

function stableColumnsSignature(columns = []) {
    return JSON.stringify(
        (Array.isArray(columns) ? columns : []).map((col) => ({
            id: col?.id,
            visible: col?.visible,
            displayName: col?.displayName,
            width: col?.width,
            sticky: col?.sticky,
            widthPct: col?.widthPct,
            minWidth: col?.minWidth,
            type: col?.type,
            format: col?.format,
	        timeZone: col?.timeZone,
	        timeZoneSelector: col?.timeZoneSelector,
            link: col?.link,
            badge: col?.badge,
            valueMap: col?.valueMap,
            cellProperties: col?.cellProperties,
            visibleWhen: col?.visibleWhen,
            hiddenWhen: col?.hiddenWhen,
            multiSelect: col?.multiSelect,
            nonExcludable: col?.nonExcludable,
        }))
    );
}

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

export function resolveTableColumnsForSelection(columns = [], context = null, selectionEnabled = true) {
    const baseColumns = Array.isArray(columns) ? columns : [];
    if (selectionEnabled === false) {
        return baseColumns.filter((col) => col?.multiSelect !== true);
    }
    const selectionMode = String(context?.dataSource?.selectionMode || "").trim().toLowerCase();
    if (selectionMode !== "multi") {
        return baseColumns;
    }
    const hasSelectionColumn = baseColumns.some((col) => col?.multiSelect === true);
    if (hasSelectionColumn) {
        return baseColumns;
    }
    return [
        {
            id: "__select__",
            name: "",
            displayName: "",
            type: "checkbox",
            width: 42,
            align: "center",
            multiSelect: true,
            sortable: false,
            visible: true,
            ...(baseColumns.some((col) => String(col?.sticky || '').toLowerCase() === 'left') ? {sticky: 'left'} : {}),
            nonExcludable: true,
            enforceColumnSize: false,
            cellProperties: {
                disabled: false,
            },
        },
        ...baseColumns,
    ];
}

export function reconcileConfiguredColumns(savedColumns = [], sourceColumns = []) {
    const saved = Array.isArray(savedColumns) ? savedColumns : [];
    const source = Array.isArray(sourceColumns) ? sourceColumns : [];
    if (saved.length === 0) {
        return source;
    }
    const savedById = new Map(
        saved
            .filter((col) => col && col.id)
            .map((col) => [col.id, col]),
    );
    return source.map((column) => {
        const savedColumn = savedById.get(column.id);
        if (!savedColumn) {
            return column;
        }
        return {
            ...column,
            visible: savedColumn.visible ?? column.visible,
            displayName: savedColumn.displayName || column.displayName || column.name,
            width: savedColumn.width ?? column.width,
        };
    });
}

const Basic = ({ context, container, columns, pagination, children }) => {
    useSignals();
    const tableRef = useRef(null);
    const scrollRef = useRef(null);

    const [tableWidth, setTableWidth] = useState(0);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [popupContent, setPopupContent] = useState("");
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [horizontalOverflow, setHorizontalOverflow] = useState({left: false, right: false});
    const { collection: collectionData, loading, error } = useDataSourceState(context);
    const collection = collectionData; // keep old variable name for compatibility

    const initialSortColumnId = String(container?.table?.defaultSort?.columnId || '').trim() || null;
    const initialSortDirection = String(container?.table?.defaultSort?.direction || '').trim().toLowerCase() === 'desc'
        ? 'desc'
        : 'asc';
    const [sortColumnId, setSortColumnId] = useState(initialSortColumnId);
    const [sortDirection, setSortDirection] = useState(initialSortDirection);

    // loading & error come from useDataSourceState hook

    const { dataSource, handlers } = context;
    const selectionEnabled = container?.table?.selectionEnabled !== false
        && evaluatePlainVisibleWhen(container?.table?.selectionVisibleWhen, context);
    const resolvedColumns = useMemo(
        () => resolveTableColumnsForSelection(columns, context, selectionEnabled),
        [columns, context, selectionEnabled],
    );
    const columnsHandlers = useMemo(
        () => useColumnsHandlers(context, resolvedColumns),
        [context, resolvedColumns],
    );
    const formattingRules = useMemo(
        () => normalizeRuleList(container?.table?.formattingRules || container?.table?.formatting || []),
        [container?.table?.formattingRules, container?.table?.formatting]
    );

    const events = tableHandlers(context, container);

    const filterSets = handlers?.dataSource?.getFilterSets?.()
        || handlers?.dataSource?.getFilterSet?.()
        || [...(dataSource?.filterSet || [])];
    const activeFilterSet = filterSets.find((entry) => entry?.default) || filterSets[0];
    const currentFilter = context?.signals?.input?.value?.filter || {};
    const displayedCollection = dataSource?.filterMode === 'client'
        ? applyClientFilters(collection, activeFilterSet, currentFilter)
        : collection;
    const pagingEnabled = dataSource?.paging?.enabled || false;
    const pagingSize = dataSource?.paging?.size || 0;
    const clientPagination = pagingEnabled
        && String(dataSource?.paginationMode || '').toLowerCase() === 'client'
        && pagingSize > 0;
    const requestedClientPage = Number(context?.signals?.input?.value?.page || 1);
    const clientPageState = resolveClientPagination(displayedCollection, requestedClientPage, pagingSize, clientPagination);
    const clientPage = clientPageState.page;
    const toolbarContext = useMemo(() => {
        if (dataSource?.filterMode !== 'client' && !clientPagination) return context;
        return {
            ...context,
            handlers: {
                ...context.handlers,
                dataSource: {
                    ...context.handlers.dataSource,
                    getCollectionInfo: () => {
                        const sourceRows = context?.signals?.collection?.value || [];
                        const liveRows = dataSource?.filterMode === 'client'
                            ? applyClientFilters(sourceRows, activeFilterSet, context?.signals?.input?.value?.filter || {})
                            : sourceRows;
                        return {
                            pageCount: clientPagination ? Math.max(1, Math.ceil(liveRows.length / pagingSize)) : (liveRows.length ? 1 : 0),
                            recordCount: liveRows.length,
                        };
                    },
                },
            },
        };
    }, [context, dataSource?.filterMode, clientPagination, pagingSize, activeFilterSet]);

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
        const resolveNextConfiguredColumns = () => {
            if (savedColumns) {
                try {
                    const parsedColumns = JSON.parse(savedColumns);
                    return reconcileConfiguredColumns(parsedColumns, initConfiguredColumns(resolvedColumns));
                } catch (e) {
                    console.error('Error parsing saved column settings:', e);
                }
            }
            return initConfiguredColumns(resolvedColumns);
        };
        const nextColumns = resolveNextConfiguredColumns();
        const nextSignature = stableColumnsSignature(nextColumns);

        setConfiguredColumns((previousColumns) => (
            stableColumnsSignature(previousColumns) === nextSignature
                ? previousColumns
                : nextColumns
        ));
    }, [resolvedColumns, container.id]);

    // Ensure non-excludable columns are always visible
    const visibleColumns = useMemo(
        () => configuredColumns.filter((col) => col.visible || col.nonExcludable),
        [configuredColumns]
    );

    const [columnsToUse, setColumnsToUse] = useState(visibleColumns);

    useEffect(() => {
        const data = handlers.dataSource.getCollection();
        if (!data?.length && collection?.length === 0) {
            events.onInit.execute({});
        }
    }, []);

    // Apply sorting to collection when it changes or when sort parameters change
    const sortedCollection = useMemo(() => {
        if (!sortColumnId || !displayedCollection?.length) {
            return displayedCollection;
        }

        const sortColumn = columnsToUse.find((col) => col.id === sortColumnId) || resolvedColumns.find((col) => col.id === sortColumnId);

        return [...displayedCollection].sort((a, b) => {
            const aRaw = resolveKey(a, sortColumnId);
            const bRaw = resolveKey(b, sortColumnId);
            const aLink = resolveTableLink({row: a, column: sortColumn, value: aRaw});
            const bLink = resolveTableLink({row: b, column: sortColumn, value: bRaw});
            const aVal = aLink ? aLink.text : aRaw;
            const bVal = bLink ? bLink.text : bRaw;

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
    }, [displayedCollection, sortColumnId, sortDirection]);

    const renderedCollection = useMemo(() => {
        return resolveClientPagination(sortedCollection, clientPage, pagingSize, clientPagination).rows;
    }, [sortedCollection, clientPagination, clientPage, pagingSize]);

    useEffect(() => {
        if (!clientPagination || requestedClientPage === clientPage) return;
        handlers?.dataSource?.setPage?.(clientPage);
    }, [clientPagination, requestedClientPage, clientPage, handlers]);



    useEffect(() => {
        const sizedColumns = enforceColumnSize && tableWidth > 0
            ? convertWidthsToPct(visibleColumns, tableWidth)
            : preserveDeclaredColumnWidths(visibleColumns);
        const nextColumns = withStickyColumnOffsets(sizedColumns);
        const nextSignature = stableColumnsSignature(nextColumns);
        if (enforceColumnSize && tableWidth > 0) {
            setColumnsToUse((previousColumns) => (
                stableColumnsSignature(previousColumns) === nextSignature
                    ? previousColumns
                    : nextColumns
            ));
            return;
        }
        setColumnsToUse((previousColumns) => (
            stableColumnsSignature(previousColumns) === nextSignature
                ? previousColumns
                : nextColumns
        ));
    }, [enforceColumnSize, tableWidth, visibleColumns]);
    const resolvedTableWidth = enforceColumnSize ? '100%' : `${scrollableTableWidth(columnsToUse, tableWidth)}px`;

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

    // Use useMemo to compute preparedData from the active server/client page.
    const preparedData = useMemo(() => {
        const newPreparedData = [];
        for (let rowIndex = 0; rowIndex < renderedCollection.length; rowIndex++) {
            const item = renderedCollection[rowIndex];
            const rowArray = [];
            const rowRules = matchingRules(item, formattingRules, "row");
            const rowStyle = mergeStyles(rowRules);
            const rowClassName = mergeClassNames(rowRules);

            for (let colIndex = 0; colIndex < columnsToUse.length; colIndex++) {
                const col = columnsToUse[colIndex];
                const rawValue = resolveKey(item, col.id);
                let displayedText = resolveTableCellText({row: item, column: col, value: rawValue});
                if (col.numericFormat && rawValue != null && rawValue !== "") {
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
                const cellRules = matchingRules(item, formattingRules, "cell", col.id);
                rowArray.push({
                    id: cellKey,
                    align: align || "left",
                    displayedText: displayedText,
                    value: rawValue,
                    style: mergeStyles(cellRules),
                    className: mergeClassNames(cellRules),
                });
            }
            newPreparedData.push({
                cells: rowArray,
                style: rowStyle,
                className: rowClassName,
            });
        }
        return newPreparedData;
    }, [renderedCollection, columnsToUse, loading, formattingRules]);

    const handleOpenFilter = () => setIsFilterOpen(true);
    const handleCloseFilter = () => setIsFilterOpen(false);

    const handleOpenSettings = () => setIsSettingsOpen(true);
    const handleCloseSettings = () => setIsSettingsOpen(false);

    const handleApplyFilters = (args) => {
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
        if (String(dataSource?.sortMode || '').toLowerCase() === 'server') {
            handlers?.dataSource?.setSort?.({columnId, direction: newDirection, fetch: !!dataSource?.service});
        }
    };

    const backfillCount = tableBackfillCount(pagingSize, renderedCollection.length, loading);

    const tableTitle = container?.table?.title || "";
    handlers["table"] = {
        openSetting: handleOpenSettings,
    };
    handlers["dataSource"]["openFilter"] = handleOpenFilter;

    const tableDisplayWidth = container?.table?.width || (container?.table?.fullWidth === true ? "100%" : "90%");
    const toolbarConfig = container?.table?.toolbar || {};
    const emptyState = container?.table?.emptyState;
    const resolvedEmptyState = resolveTableEmptyState(emptyState, currentFilter);
    const showEmptyState = shouldRenderTableEmptyState({
        emptyState: resolvedEmptyState,
        collection: sortedCollection,
        loading,
        error,
    });
    const toolbarItems = container?.table?.toolbar?.items || [];
    const footerToolbarItems = toolbarItems.filter(isFooterToolbarItem);
    const primaryToolbarItems = filterEmptyStateToolbarItems(
        toolbarItems.filter((item) => !isFooterToolbarItem(item)),
        resolvedEmptyState,
        showEmptyState,
    );
    const hasFooterToolbar = footerToolbarItems.length > 0;

    useEffect(() => {
        const scroller = scrollRef.current;
        if (!scroller || showEmptyState) {
            setHorizontalOverflow({left: false, right: false});
            return undefined;
        }
        const update = () => {
            const maxLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
            const next = {
                left: scroller.scrollLeft > 2,
                right: scroller.scrollLeft < maxLeft - 2,
            };
            setHorizontalOverflow((previous) => (
                previous.left === next.left && previous.right === next.right ? previous : next
            ));
        };
        update();
        scroller.addEventListener('scroll', update, {passive: true});
        const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null;
        observer?.observe(scroller);
        if (scroller.firstElementChild) observer?.observe(scroller.firstElementChild);
        return () => {
            scroller.removeEventListener('scroll', update);
            observer?.disconnect();
        };
    }, [showEmptyState, resolvedTableWidth, columnsToUse.length, renderedCollection.length]);

    const scrollTableHorizontally = (direction) => {
        const scroller = scrollRef.current;
        if (!scroller) return;
        scroller.scrollTo({
            left: scroller.scrollLeft + direction * Math.max(240, scroller.clientWidth * 0.72),
            behavior: 'smooth',
        });
    };

    return (
        <div
            className={`basic-table-wrapper${String(container?.table?.density || '').toLowerCase() === 'compact' ? " is-compact-density" : ""}${loading && sortedCollection.length > 0 ? " is-loading" : ""}${showEmptyState ? " has-metadata-empty-state" : ""}${horizontalOverflow.left ? " has-table-overflow-left" : ""}${horizontalOverflow.right ? " has-table-overflow-right" : ""}`}
            style={{
                height: "100%",
                width: tableDisplayWidth,
                boxSizing: "border-box",
            }}
            ref={tableRef}
        >
            {primaryToolbarItems.length > 0 ? (
                <div
                    className={`basic-table-filterbar${toolbarConfig.density === 'compact' ? ' is-compact' : ''}${toolbarConfig.className ? ` ${toolbarConfig.className}` : ''}`}
                    style={toolbarConfig.style || undefined}
                >
                    <Toolbar
                        context={toolbarContext}
                        toolbarItems={primaryToolbarItems}
                        density={toolbarConfig.density}
                        layout={toolbarConfig.layout}
                    />
                </div>
            ) : null}

            {showEmptyState ? (
                <TableEmptyState context={context} config={resolvedEmptyState}/>
            ) : (
                <div className="basic-table-scroll" ref={scrollRef}>
                    <HTMLTable style={{width: resolvedTableWidth, minWidth: resolvedTableWidth, tableLayout: "fixed"}}>
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
                        collection={renderedCollection}
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
                    {pagingSize > 0 && !hasFooterToolbar ? (
                        <TableFooter
                            columnsLength={columnsToUse.length}
                            context={context}
                            pagingEnabled={pagingEnabled}
                        />
                    ) : null}
                    </HTMLTable>
                </div>
            )}

            {!showEmptyState && horizontalOverflow.left ? (
                <button type="button" className="basic-table-overflow-cue is-left"
                    aria-label="Scroll table left" title="More columns to the left"
                    onClick={() => scrollTableHorizontally(-1)}><span aria-hidden="true">‹</span></button>
            ) : null}
            {!showEmptyState && horizontalOverflow.right ? (
                <button type="button" className="basic-table-overflow-cue is-right"
                    aria-label="Scroll table right" title="More columns to the right"
                    onClick={() => scrollTableHorizontally(1)}><span aria-hidden="true">›</span></button>
            ) : null}

            {hasFooterToolbar && !showEmptyState ? (
                <div className="basic-table-paginationbar">
                    <Toolbar
                        context={toolbarContext}
                        toolbarItems={footerToolbarItems}
                        density={toolbarConfig.density}
                        layout={toolbarConfig.layout}
                    />
                </div>
            ) : null}

            {loading && sortedCollection.length > 0 ? (
                <div className="table-loading-overlay" role="status" aria-live="polite">
                    <div className="table-loading-card">
                        <Spinner size={18} />
                        <div>
                            <div className="table-loading-title">Loading data</div>
                            <div className="table-loading-text">Waiting for the latest rows.</div>
                        </div>
                    </div>
                </div>
            ) : null}

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
