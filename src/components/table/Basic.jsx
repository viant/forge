import {useSetting} from '../../core/context/Setting.jsx';
import {applyTableColumnPreferences,sanitizeTablePreferences} from '../../core/preferences/tablePreferences.js';
import {useTablePreferences} from './useTablePreferences.js';
import {tablePrimaryToolbarItems} from './tableToolbarLayout.js';
import { getViewSignal } from '../../core/store/signals.js';
import React, { useState, useEffect, useRef, useMemo } from "react";
import { HTMLTable, Spinner } from "@blueprintjs/core";
import numeral from "numeral";
import { useColumnsHandlers, tableHandlers } from "../../hooks/event.js";
import { useDataSourceState } from "../../hooks/useDataSourceState.js";
import TableBody from "./basic/TableBody.jsx";
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
import {tableTrailingSpace, tableSurfaceWidth, tableRowSlots, preserveDeclaredColumnWidths, scrollableTableWidth, tableBackfillCount, withStickyColumnOffsets} from './tableSizing.js';
import {evaluatePlainVisibleWhen} from '../visibleWhen.js';
import {resolveClientPagination} from './clientPagination.js';
import {requestServerTableSort} from './serverSort.js';
import {useSignals} from '@preact/signals-react/runtime';
import {applyClientFilters} from './clientFilters.js';
import {resetPaginationScroll} from './paginationScroll.js';
import PaginationBar from './basic/PaginationBar.jsx';
import {shouldInitializeEmptyTable} from './tableInitialization.js';
import {tableLoadingMode} from './tableLoadingState.js';

const defaultCellWidth = 30; // Adjust as needed


function stableColumnsSignature(columns = []) {
    return JSON.stringify(
        (Array.isArray(columns) ? columns : []).map((col) => ({
            id: col?.id,
            visible: col?.visible,
            align: col?.align,
            tooltip: col?.tooltip,
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
	        badges: col?.badges,
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

const Basic = ({ toolbarActions, sizingMode = 'fill', context, container, columns, pagination, children, renderRows }) => {
    useSignals();
    const {services = {}, connectorConfig = {}} = useSetting();
    const preferenceKey = context.tableSettingKey?.(container.id || 'table') || [context.identity?.windowId,context.identity?.dataSourceRef,container.id || 'table'].filter(Boolean).join(':');
    const tablePreferences = useTablePreferences({services,config:connectorConfig.tablePreferences || {},key:preferenceKey});
    const effectiveDensity = tablePreferences.preferences?.density || container.table?.density;
    const tableRef = useRef(null);
    const scrollRef = useRef(null);

    const [tableWidth, setTableWidth] = useState(0);
    const [availableWidth, setAvailableWidth] = useState(0);
    const [availableHeight, setAvailableHeight] = useState(0);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [popupContent, setPopupContent] = useState("");
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [horizontalOverflow, setHorizontalOverflow] = useState({left: false, right: false, cueTop: null});
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
    const pageScrollStateRef = useRef({
        page: requestedClientPage,
        collection,
        pending: false,
    });
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

    // Preferences contain IDs/values only; current metadata remains authoritative
    // for behavior, callbacks and newly added columns.
    useEffect(() => {
        const nextColumns = applyTableColumnPreferences(initConfiguredColumns(resolvedColumns), tablePreferences.preferences);
        const nextSignature = stableColumnsSignature(nextColumns);
        setConfiguredColumns(previous => stableColumnsSignature(previous) === nextSignature ? previous : nextColumns);
    }, [resolvedColumns, tablePreferences.preferences, container.id]);

    useEffect(() => {
        const savedSort = tablePreferences.preferences?.sort;
        const known = savedSort && resolvedColumns.some(column => column.id === savedSort.columnId && column.sortable);
        const columnId = known ? savedSort.columnId : initialSortColumnId;
        const direction = known ? savedSort.direction : initialSortDirection;
        if(columnId === sortColumnId && direction === sortDirection) return;
        if(columnId && String(dataSource?.sortMode || '').toLowerCase() === 'server') requestServerTableSort({dataSource,handlers,columnId,direction});
        setSortColumnId(columnId);setSortDirection(direction);
    }, [tablePreferences.preferences?.sort, initialSortColumnId, initialSortDirection, resolvedColumns]);

    // Ensure non-excludable columns are always visible
    const visibleColumns = useMemo(
        () => configuredColumns.filter((col) => col.visible || col.nonExcludable),
        [configuredColumns]
    );

    const [columnsToUse, setColumnsToUse] = useState(visibleColumns);
    // Fit wide tables when space allows; narrow panes retain readable declared widths.
    const enforceColumnSize = container?.table?.fillRemainingWidth !== true && (container?.table?.enforceColumnSize === true
        || (container?.table?.enforceColumnSize !== false && tableWidth >= scrollableTableWidth(visibleColumns)));

    useEffect(() => {
        const data = handlers.dataSource.getCollection();
        const control = context?.signals?.control?.peek?.() || context?.signals?.control?.value || {};
        if (shouldInitializeEmptyTable(data, collection, control)) {
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
        const state = pageScrollStateRef.current;
        const pageChanged = state.page !== requestedClientPage;
        const collectionChanged = state.collection !== collection;
        state.page = requestedClientPage;
        state.collection = collection;
        if (pageChanged) state.pending = true;
        if (!state.pending || (!pageChanged && !collectionChanged)) return;
        resetPaginationScroll(
            scrollRef.current,
            container?.table?.pagination?.preserveScrollPosition === true,
        );
        if (clientPagination || collectionChanged) state.pending = false;
    }, [
        requestedClientPage,
        collection,
        clientPagination,
        container?.table?.pagination?.preserveScrollPosition,
    ]);



    useEffect(() => {
        const sizedColumns = enforceColumnSize && tableWidth > 0
            ? convertWidthsToPct(visibleColumns, tableWidth)
            : preserveDeclaredColumnWidths(visibleColumns);
        const hasColumnOverflow = tableWidth > 0 && scrollableTableWidth(sizedColumns) > tableWidth + 1;
        const nextColumns = withStickyColumnOffsets(hasColumnOverflow ? sizedColumns : sizedColumns.map(column => ({...column, sticky: false})), tableWidth);
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
    const trailingSpace = container.table?.fillRemainingWidth === true ? tableTrailingSpace(columnsToUse,tableWidth) : null;
    const fillerWidth = trailingSpace?.fillerWidth || 0;
    const resolvedTableWidth = enforceColumnSize ? '100%' : `${scrollableTableWidth(columnsToUse, tableWidth)}px`;

    // Added useEffect to update tableWidth when the table's width changes
    useEffect(() => {
        const div = tableRef.current;
        if (!div) return;

        const parent = div.parentElement;
        const panel = div.closest('[role="tabpanel"]');
        const measure = () => {
            setTableWidth(div.clientWidth);
            setAvailableWidth(parent?.clientWidth || 0);
            // Content-sized tab panels cannot define their own remaining height:
            // doing so feeds the table's previous cap back into its next measure.
            const viewport = window.visualViewport;
            const bottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
            setAvailableHeight(Math.max(160, bottom - div.getBoundingClientRect().top - 16));
        };
        const resizeObserver = new ResizeObserver(measure);
        resizeObserver.observe(div);
        if (parent) resizeObserver.observe(parent);
        if (panel) resizeObserver.observe(panel);
        // Header/toolbar reflow can move a table without resizing its own box.
        // Observe the surrounding layout branches so the viewport cap is updated.
        for (let ancestor = parent; ancestor; ancestor = ancestor.parentElement) {
            resizeObserver.observe(ancestor);
            for (const child of ancestor.children) resizeObserver.observe(child);
        }
        const frame = requestAnimationFrame(measure);
        measure();
        window.addEventListener('resize', measure);
        window.visualViewport?.addEventListener('resize', measure);

        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener('resize', measure);
            window.visualViewport?.removeEventListener('resize', measure);
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

    const savePreferences = (updatedColumns, overrides = {}) => tablePreferences.save(sanitizeTablePreferences({
        version:1,
        ...tablePreferences.preferences,
        columns:updatedColumns,
        ...(sortColumnId ? {sort:{columnId:sortColumnId,direction:sortDirection}} : {}),
        ...overrides,
    }));
    const handleSaveColumnSettings = (updatedColumns, presentation = {}) => {
        setConfiguredColumns(updatedColumns);
        savePreferences(updatedColumns,presentation);
    };
    const handleResetSettings = () => {
        tablePreferences.reset();
        setConfiguredColumns(initConfiguredColumns(resolvedColumns));
        setSortColumnId(initialSortColumnId);setSortDirection(initialSortDirection);
    };

    const handleSort = (columnId) => {
        let newDirection = "asc";
        if (sortColumnId === columnId) {
            newDirection = sortDirection === "asc" ? "desc" : "asc";
        }
        if (
            String(dataSource?.sortMode || '').toLowerCase() === 'server'
            && !requestServerTableSort({dataSource, handlers, columnId, direction: newDirection})
        ) {
            return;
        }
        setSortColumnId(columnId);
        setSortDirection(newDirection);
        savePreferences(configuredColumns,{sort:{columnId,direction:newDirection}});
    };

    const rowSlots = tableRowSlots(container.table, renderedCollection.length);
    const backfillCount = rowSlots.minRows > 0 && !loading && !error ? Math.max(rowSlots.blanks, renderedCollection.length === 0 ? 1 : 0) : tableBackfillCount(pagingSize, renderedCollection.length, loading);

    const tableTitle = container?.table?.title || "";
    handlers["table"] = {
        openSetting: handleOpenSettings,
    };
    handlers["dataSource"]["openFilter"] = handleOpenFilter;

    const tableDisplayWidth = tableSurfaceWidth(container.table, visibleColumns, availableWidth);
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
    const primaryToolbarItems = filterEmptyStateToolbarItems(
        tablePrimaryToolbarItems(toolbarItems),
        resolvedEmptyState,
        showEmptyState,
    );
    const loadingMode = tableLoadingMode({loading, error, rowCount: sortedCollection.length});

    useEffect(() => {
        const scroller = scrollRef.current;
        if (!scroller || showEmptyState) {
            setHorizontalOverflow({left: false, right: false, cueTop: null});
            return undefined;
        }
        const windowId = context?.identity?.windowId;
        const viewSignal = windowId ? getViewSignal(windowId) : null;
        const scrollKey = container?.id || 'table';
        let wasVisible = false;
        let remembered = viewSignal?.peek?.()?.tableScroll?.[scrollKey] || { left: 0, top: 0 };
        const rememberScroll = () => {
            if (!scroller.getClientRects().length || !wasVisible) return;
            remembered = { left: scroller.scrollLeft, top: scroller.scrollTop };
            if (viewSignal) {
                const previous = viewSignal.peek() || {};
                const saved = previous.tableScroll?.[scrollKey];
                if (saved?.left !== remembered.left || saved?.top !== remembered.top) {
                    viewSignal.value = { ...previous, tableScroll: { ...previous.tableScroll, [scrollKey]: remembered } };
                }
            }
        };
        const update = () => {
            const visible = scroller.getClientRects().length > 0 && scroller.clientWidth > 0;
            if (visible && !wasVisible) {
                scroller.scrollLeft = remembered.left;
                scroller.scrollTop = remembered.top;
            }
            wasVisible = visible;
            const maxLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
            const wrapperRect = tableRef.current?.getBoundingClientRect?.();
            const scrollRect = scroller.getBoundingClientRect?.();
            const next = {
                left: scroller.scrollLeft > 2,
                right: scroller.scrollLeft < maxLeft - 2,
                cueTop: wrapperRect && scrollRect
                    ? Math.round((scrollRect.top - wrapperRect.top) + scrollRect.height / 2)
                    : null,
            };
            setHorizontalOverflow((previous) => (
                previous.left === next.left && previous.right === next.right && previous.cueTop === next.cueTop ? previous : next
            ));
        };
        update();
        scroller.addEventListener('scroll', rememberScroll, {passive: true});
        scroller.addEventListener('scroll', update, {passive: true});
        const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null;
        observer?.observe(scroller);
        if (scroller.firstElementChild) observer?.observe(scroller.firstElementChild);
        return () => {
            scroller.removeEventListener('scroll', rememberScroll);
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
            className={`basic-table-wrapper${container.table?.fullWidth !== true && !container.table?.width ? ' is-content-width' : ''}${rowSlots.rowHeight ? ' has-fixed-row-slots' : ''}${String(effectiveDensity || '').toLowerCase() === 'compact' ? " is-compact-density" : ""}${loadingMode === 'refresh' ? " is-refreshing" : ""}${showEmptyState ? " has-metadata-empty-state" : ""}${horizontalOverflow.left ? " has-table-overflow-left" : ""}${horizontalOverflow.right ? " has-table-overflow-right" : ""}`}
            style={{
                flex: sizingMode === 'fill' && !rowSlots.rowHeight ? '0 1 auto' : '0 0 auto',
                width: tableDisplayWidth,
                boxSizing: "border-box",
                '--forge-table-available-height': availableHeight ? `${availableHeight}px` : undefined,
                '--forge-table-row-height': rowSlots.rowHeight ? `${rowSlots.rowHeight}px` : undefined,
            }}
            ref={tableRef}
        >
                <div
                    className={`basic-table-filterbar${(tablePreferences.preferences?.density || toolbarConfig.density) === 'compact' ? ' is-compact' : ''}${toolbarConfig.className ? ` ${toolbarConfig.className}` : ''}`}
                    style={toolbarConfig.style || undefined}
                >
                    <Toolbar
                        context={toolbarContext}
                        toolbarItems={primaryToolbarItems}
                        leftContent={toolbarActions}
                        centerContent={<PaginationBar context={toolbarContext} pagingEnabled={!!pagingEnabled && pagingSize > 0}/>}
                        className="has-table-navigation"
                        exportRows={sortedCollection}
                        exportPageRows={renderedCollection}
                        exportColumns={columnsToUse}
                        density={tablePreferences.preferences?.density || toolbarConfig.density}
                        layout={toolbarConfig.layout}
                    />
                </div>

            {tablePreferences.error ? <div className="forge-table-preference-error" role="alert">Table preferences could not be loaded or saved. Changes may not survive reload.</div> : null}

            {showEmptyState ? (
                <TableEmptyState context={context} config={resolvedEmptyState}/>
            ) : (
                <div className={`basic-table-scroll${renderRows ? ' has-responsive-cards' : ''}`} ref={scrollRef} tabIndex={0} aria-label="Table data; scroll horizontally for more columns">
                    {renderRows ? renderRows({
                        rows: renderedCollection,
                        columns: columnsToUse,
                        context: toolbarContext,
                        columnHandlers: columnsHandlers,
                        onRowClick: events.onRowSelect.execute,
                    }) : (
                    <HTMLTable style={{width: resolvedTableWidth, minWidth: resolvedTableWidth, tableLayout: "fixed"}}>
                    {trailingSpace ? <colgroup>{trailingSpace.widths.map((width,index)=><col key={columnsToUse[index].id || index} style={{width}}/>)}{fillerWidth>0 ? <col style={{width:fillerWidth}}/> : null}</colgroup> : null}
                    {/* Table Header */}
                    <TableHeader
                        fillerWidth={fillerWidth}
                        context={context}
                        columns={columnsToUse}
                        tableTitle={tableTitle}
                        sortConfig={{ onSort: handleSort, sortColumnId, sortDirection }}
                    />

                    {/* Table Body */}
                    <TableBody
                        fillerWidth={fillerWidth}
                        fixedRowHeight={rowSlots.rowHeight}
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

                    </HTMLTable>
                    )}
                </div>
            )}

            {loadingMode === 'refresh' ? (
                <div className="table-refresh-indicator" role="status" aria-live="polite">
                    <Spinner size={14} />
                    <span>Refreshing rows…</span>
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
                density={effectiveDensity === 'compact' ? 'compact' : 'normal'}
                onSaveColumnSettings={handleSaveColumnSettings}
                onResetColumns={handleResetSettings}  // Pass the reset handler
            />
        </div>
    );
};

export default Basic;
