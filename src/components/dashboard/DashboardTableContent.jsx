import React, { useEffect, useMemo, useState } from "react";
import { useSignalEffect } from "@preact/signals-react";
import { Icon } from "@blueprintjs/core";

import { useDataSourceState } from "../../hooks/useDataSourceState.js";
import { resolveKey } from "../../utils/selector.js";
import {formatDataSourceError} from '../../utils/dataSourceError.js';
import { resolveTableLink } from "../../utils/tableLink.js";
import { getDashboardFilterSignal, getDashboardSelectionSignal } from "../../core/store/signals.js";
import { matchingRules, mergeClassNames, mergeStyles, normalizeRuleList } from "../table/formattingRules.js";
import { applyDashboardFiltersToCollection, applyDashboardSelectionToCollection, publishDashboardSelection } from "./dashboardUtils.js";
import {
    resolveDashboardRowActionIdentity,
    resolveDashboardRowActionKey,
    resolveDashboardRowActionPresentation,
    resolveDashboardRowActionVisibleLabel,
} from "./dashboardRowActionPresentation.js";
import { resolveDashboardTableColumnValue } from "./dashboardTableValue.js";
import { buildTableRuntimeColumns } from "./tableCellVisuals.js";
import { withFrozenIdentifierColumn } from "./tableFrozenIdentifier.js";
import { renderDashboardTableCell, titleizeDashboardKey } from "./dashboardVisualUtils.jsx";
import { clampPresentationText, normalizePresentationClampConfig, normalizePresentationText } from "../../utils/presentationText.js";
import "./documentTable.css";
import {documentTableLayout} from "./documentTable.js";
import { buildDashboardTableLayout } from "./dashboardTableLayout.js";
import Typography from '../Typography.jsx';
import ForgeIcon from '../Icon.jsx';
import { compareDashboardTableValues } from "./dashboardTableSort.js";

const DEFAULT_SUBTITLE_STYLE = {
    fontSize: 'var(--forge-dashboard-table-small-size, 12px)',
    lineHeight: 'var(--forge-dashboard-table-small-line-height, normal)',
    color: 'var(--forge-dashboard-table-muted-text, #5f6b7c)',
    margin: 0,
};

const categoricalRowClassField = (key = "") => /(?:status|type|category|scope)$/i.test(String(key).trim());
const rowClassToken = (value = "") => String(value)
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const categoricalRowClassNames = (row = {}, columns = []) => (Array.isArray(columns) ? columns : [])
    .filter((column) => categoricalRowClassField(column?.key))
    .map((column) => {
        const field = rowClassToken(column.key);
        const value = rowClassToken(resolveKey(row, column.key) || "unknown");
        return field && value ? `forge-table-row--${field}--${value}` : "";
    })
    .filter(Boolean);

function useSignalSnapshot(signalValue, fallbackValue) {
    const [value, setValue] = useState(() => signalValue?.peek?.() ?? signalValue?.value ?? fallbackValue);

    useSignalEffect(() => {
        setValue(signalValue?.value ?? fallbackValue);
    });

    return value;
}

export default function DashboardTableContent({
    container,
    context,
    locale = 'en-US',
    subtitleStyle = DEFAULT_SUBTITLE_STYLE,
    onPresentationStateChange = null,
    initialPresentationState = null,
}) {
    const {collection, loading, error, selection} = useDataSourceState(context);
    const dashboardFilterSignal = context?.dashboardKey ? getDashboardFilterSignal(context.dashboardKey) : null;
    const dashboardSelectionSignal = context?.dashboardKey ? getDashboardSelectionSignal(context.dashboardKey) : null;
    const dashboardFilters = useSignalSnapshot(dashboardFilterSignal, {});
    const dashboardSelection = useSignalSnapshot(dashboardSelectionSignal, {});
    const limit = container.dashboard?.table?.limit || container.limit || Number.MAX_SAFE_INTEGER;
    const [quickFilter, setQuickFilter] = useState(() => initialPresentationState?.filter || "");
    const quickFilterEnabled = container.dashboard?.table?.quickFilter === true || container.quickFilter === true;
    const density = container.dashboard?.table?.density || container.density || "comfortable";
    const rowActions = container.dashboard?.table?.rowActions || container.rowActions || [];
    const rowActionDisplayMode = container.dashboard?.table?.rowActionDisplay || container.rowActionDisplay || "compact";
    const mobileCards = container?.mobileCards?.enabled === true && rowActions.length === 0
        ? container.mobileCards
        : null;
    const mobileFieldKeys = Array.isArray(mobileCards?.fields) ? mobileCards.fields : [];
    const multiSelect = String(context?.dataSource?.selectionMode || container.selectionMode || '').trim().toLowerCase() === 'multi';
    const selectedRows = multiSelect && Array.isArray(selection?.selection) ? selection.selection : [];
    const uniqueFields = (Array.isArray(context?.dataSource?.uniqueKey) ? context.dataSource.uniqueKey : [])
        .map((entry) => String(entry?.field || entry || '').trim())
        .filter(Boolean);
    const rowIdentity = (row) => uniqueFields.length > 0
        ? uniqueFields.map((field) => JSON.stringify(resolveKey(row, field) ?? null)).join('|')
        : row;
    const selectedIdentities = new Set(selectedRows.map(rowIdentity));
    const rowSelected = (row) => selectedIdentities.has(rowIdentity(row));
    const selectionHandlers = context?.handlers?.dataSource || {};
    const formattingRules = useMemo(
        () => normalizeRuleList(container.dashboard?.table?.formattingRules || container.dashboard?.table?.formatting || container.formattingRules || []),
        [container.dashboard?.table?.formattingRules, container.dashboard?.table?.formatting, container.formattingRules]
    );

    const documentTable = container.tablePresentation?.variant === 'document';
    if (container.tablePresentation?.variant && !documentTable) throw new Error(`Unsupported table variant: ${container.tablePresentation.variant}`);
    const rawColumns = container.dashboard?.table?.columns || container.columns || [];
    const normalizedColumns = useMemo(() => rawColumns.map((col) => {
        if (typeof col === 'string') {
            return {key: col, label: titleizeDashboardKey(col)};
        }
        const key = String(col?.key || col?.field || col?.id || '').trim();
        return {
            key,
            sourceKey: String(col?.sourceKey || key).trim() || key,
            displayKey: String(col?.displayKey || '').trim(),
            displayValueMap: col?.displayValueMap && typeof col.displayValueMap === 'object' && !Array.isArray(col.displayValueMap)
                ? col.displayValueMap
                : undefined,
            displayIconMap: col?.displayIconMap && typeof col.displayIconMap === 'object' && !Array.isArray(col.displayIconMap)
                ? col.displayIconMap
                : undefined,
            label: col?.label || titleizeDashboardKey(key),
            format: col?.format,
            align: col?.align,
            type: col?.type,
            kind: col?.kind,
            link: col?.link,
            cellVisual: col?.cellVisual,
            frozen: col?.frozen === true,
            width: col?.width,
            minWidth: col?.minWidth,
            flex: col?.flex,
            statusPresentation: documentTable ? 'text' : col?.statusPresentation,
            labelClamp: normalizePresentationClampConfig(col?.labelClamp || container.dashboard?.table?.labelClamp || container.labelClamp),
        };
    }).filter((col) => !!col.key), [rawColumns, documentTable]);

    const filteredCollection = useMemo(() => {
        const afterFilters = applyDashboardFiltersToCollection(collection || [], container.filterBindings, dashboardFilters);
        return applyDashboardSelectionToCollection(afterFilters, container.selectionBindings, dashboardSelection);
    }, [collection, container.filterBindings, container.selectionBindings, dashboardFilters, dashboardSelection]);

    const quickFilteredCollection = useMemo(() => {
        const query = quickFilter.trim().toLowerCase();
        if (!query) return filteredCollection;
        return filteredCollection.filter((row) => normalizedColumns.some((col) => {
            const value = resolveDashboardTableColumnValue(row, col, { preferDisplay: true });
            const link = resolveTableLink({row, column: col, value});
            const candidate = link ? link.text : value;
            return String(candidate ?? '').toLowerCase().includes(query);
        }));
    }, [filteredCollection, normalizedColumns, quickFilter]);
    const runtimeColumns = useMemo(
        () => buildTableRuntimeColumns(normalizedColumns, quickFilteredCollection),
        [normalizedColumns, quickFilteredCollection],
    );
    const displayColumns = useMemo(() => documentTable ? runtimeColumns.map(column => ({...column, frozen: false})) : withFrozenIdentifierColumn(runtimeColumns), [runtimeColumns, documentTable]);
    // Read-only records keep the same data/formatting path. Interactive tables retain their actions and selection.
    const recordTitleColumn = documentTable && !multiSelect && rowActions.length === 0
        ? displayColumns.find(column => column.key === container.tablePresentation?.recordTitleField) : null;
    const mobileTitleColumn = mobileCards
        ? displayColumns.find((column) => column.key === mobileCards.titleField)
        : null;
    const mobileMetaColumn = mobileCards?.metaField
        ? displayColumns.find((column) => column.key === mobileCards.metaField)
        : null;
    const mobileCardColumns = mobileCards
        ? mobileFieldKeys.map((key) => displayColumns.find((column) => column.key === key)).filter(Boolean)
        : [];
    const tableLayout = useMemo(() => (documentTable ? documentTableLayout : buildDashboardTableLayout)(displayColumns, {
        multiSelect,
        hasRowActions: rowActions.length > 0,
    }), [displayColumns, multiSelect, rowActions.length, documentTable]);

    const [sortKey, setSortKey] = useState(() => initialPresentationState?.sort?.key || null);
    const [sortDir, setSortDir] = useState(() => initialPresentationState?.sort?.direction === 'desc' ? 'desc' : 'asc');
    const [page, setPage] = useState(1);
    const pagingEnabled = context?.dataSource?.paging?.enabled === true || container?.paging?.enabled === true;
    const pageSize = Math.max(1, Number(container?.paging?.size || context?.dataSource?.paging?.size || 20));

    const allSortedRows = useMemo(() => {
        if (!sortKey) return quickFilteredCollection.slice(0, limit);
        const sortColumn = runtimeColumns.find((col) => col.key === sortKey);
        const ordered = [...quickFilteredCollection].sort((a, b) => {
            const avRaw = resolveDashboardTableColumnValue(a, sortColumn, { preferDisplay: true });
            const bvRaw = resolveDashboardTableColumnValue(b, sortColumn, { preferDisplay: true });
            const avLink = resolveTableLink({row: a, column: sortColumn, value: avRaw});
            const bvLink = resolveTableLink({row: b, column: sortColumn, value: bvRaw});
            const av = avLink ? avLink.text : avRaw;
            const bv = bvLink ? bvLink.text : bvRaw;
            return compareDashboardTableValues(av, bv, sortColumn, sortDir);
        });
        return ordered.slice(0, limit);
    }, [quickFilteredCollection, limit, runtimeColumns, sortKey, sortDir]);
    const pageCount = pagingEnabled ? Math.max(1, Math.ceil(allSortedRows.length / pageSize)) : 1;
    const currentPage = Math.min(page, pageCount);
    const sortLabel = sortKey ? (displayColumns.find((column) => column.key === sortKey)?.label || sortKey) : "";
    const sortedRows = pagingEnabled
        ? allSortedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize)
        : allSortedRows;
    useEffect(() => { setPage(1); }, [quickFilter, sortKey, sortDir, pageSize, pagingEnabled, container?.paging?.resetKey]);
    useEffect(() => {
        onPresentationStateChange?.({
            rowCount: allSortedRows.length,
            filter: quickFilter.trim(),
            sort: sortKey ? {
                key: sortKey,
                label: sortLabel,
                direction: sortDir,
            } : null,
        });
    }, [allSortedRows.length, onPresentationStateChange, quickFilter, sortDir, sortKey, sortLabel]);
    const allSelected = multiSelect && sortedRows.length > 0 && sortedRows.every(rowSelected);
    const partiallySelected = multiSelect && !allSelected && sortedRows.some(rowSelected);
    const selectionLabelField = String(container?.selectionLabelField || displayColumns[0]?.key || '').trim();
    const selectionLabelFields = Array.isArray(container?.selectionLabelFields) && container.selectionLabelFields.length
        ? container.selectionLabelFields : [selectionLabelField];
    const selectionRowLabel = (row,index) => selectionLabelFields.map(field => resolveKey(row,field))
        .filter(value => value !== undefined && value !== null && value !== '').join(' · ') || `row ${index + 1}`;

    const handleSort = (key) => {
        if (sortKey === key) {
            setSortDir((prev) => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const handleRowAction = (action, row, rowIndex) => {
        if (action?.publishSelection !== false) {
            publishDashboardSelection({
                context,
                dimension: action.dimension || action.field || normalizedColumns[0]?.key,
                entityKey: action.field ? resolveKey(row, action.field) : resolveKey(row, normalizedColumns[0]?.key),
                selected: row,
                sourceBlockId: container.id,
            });
        }
        if (typeof action?.onExecute === 'function') {
            action.onExecute({action, context, item: row, rowIndex});
        }
        if (action.handler && typeof context?.lookupHandler === 'function') {
            const fn = context.lookupHandler(action.handler);
            if (typeof fn === 'function') {
                fn({execution: action, context, item: row, rowIndex});
            }
        }
    };

    return (
        <>
            {loading ? <div role="status" style={subtitleStyle}>Loading…</div> : null}
            {error ? <div role="alert" style={{...subtitleStyle, color: 'var(--forge-status-danger-foreground, #a82a2a)'}}>{formatDataSourceError(error)}</div> : null}
            {!loading && !error && sortedRows.length === 0 ? <div role="status" style={subtitleStyle}>No data.</div> : null}
            {quickFilterEnabled ? (
                <div className="forge-dashboard-table-tools">
                    <input
                        type="search"
                        className="forge-dashboard-search"
                        value={quickFilter}
                        placeholder="Quick filter rows..."
                        aria-label="Filter table rows"
                        onChange={(event) => setQuickFilter(event.target.value)}
                    />
                    <span style={subtitleStyle}>{allSortedRows.length} rows</span>
                </div>
            ) : null}
            {sortedRows.length > 0 ? (
                <>
                {recordTitleColumn ? <div className="forge-document-record-list">
                    {sortedRows.map(row => <details key={uniqueFields.length ? rowIdentity(row) : JSON.stringify(row)}>
                        <Typography as="summary" typeRole="body"><ForgeIcon name="lucide:chevron-right"/><div>{renderDashboardTableCell(resolveDashboardTableColumnValue(row,recordTitleColumn,{preferDisplay:true}),row,recordTitleColumn,locale,context)}</div></Typography>
                        <dl>{displayColumns.filter(column => column !== recordTitleColumn).map(column => <div key={column.key}>
                            <Typography as="dt" typeRole="metadata">{column.label || column.key}</Typography>
                            <Typography as="dd" typeRole="body">{renderDashboardTableCell(resolveDashboardTableColumnValue(row,column,{preferDisplay:true}),row,column,locale,context)}</Typography>
                        </div>)}</dl>
                    </details>)}
                </div> : <>
                {tableLayout.horizontallyScrollable ? (
                    <div className={`forge-dashboard-table-scroll-hint${mobileCards ? ' forge-dashboard-table-scroll-hint--mobile-cards' : ''}`}>Scroll horizontally to view all columns</div>
                ) : null}
                <div
                    className={`forge-dashboard-table-wrap${documentTable ? ' forge-document-table-wrap' : ''}${mobileCards ? ' forge-dashboard-table-wrap--mobile-cards' : ''}`}
                    role={tableLayout.horizontallyScrollable ? "region" : undefined}
                    aria-label={tableLayout.horizontallyScrollable ? "Scrollable data table" : undefined}
                    tabIndex={tableLayout.horizontallyScrollable ? 0 : undefined}
                    data-horizontal-scroll={tableLayout.horizontallyScrollable ? "true" : "false"}
                >
                    <table className={[
                        "forge-dashboard-table",
                        documentTable ? "forge-document-table" : "forge-dashboard-table--frozen-identifier",
                        density === "compact" ? "forge-dashboard-table--compact" : "",
                        rowActions.length > 0 ? "forge-dashboard-table--has-actions" : "",
                    ].filter(Boolean).join(" ")} style={{minWidth: `${tableLayout.minWidth}px`}}>
                        <colgroup>
                            {multiSelect ? <col style={{width: `${tableLayout.selectionWidth}px`}} /> : null}
                            {tableLayout.columnWidths.map((columnWidth, index) => <col key={`column-width-${displayColumns[index]?.key || index}`} style={columnWidth ? {width: `${columnWidth}px`} : undefined} />)}
                            {rowActions.length > 0 ? <col style={{width: `${tableLayout.actionsWidth}px`}} /> : null}
                        </colgroup>
                        <thead>
                        <tr>
                            {multiSelect ? (
                                <th style={{width: 42, textAlign: 'center'}}>
                                    <label className="forge-table-selection-target"><input
                                        type="checkbox"
                                        disabled={container.readOnly === true}
                                        aria-label="Select all rows"
                                        aria-checked={partiallySelected ? 'mixed' : undefined}
                                        ref={node => { if (node) node.indeterminate = partiallySelected; }}
                                        checked={allSelected}
                                        onChange={(event) => event.target.checked
                                            ? selectionHandlers.setAllSelection?.()
                                            : selectionHandlers.resetSelection?.()}
                                    /></label>
                                </th>
                            ) : null}
                            {displayColumns.map((col) => {
                                const active = sortKey === col.key;
                                const arrow = active ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';
                                return (
                                    <th
                                        key={col.key}
                                        className={col.frozen ? 'forge-table-frozen-identifier' : undefined}
                                        aria-sort={active ? sortDir === 'asc' ? 'ascending' : 'descending' : 'none'}
                                        style={{textAlign: col.align || 'left', color: active ? 'var(--forge-dashboard-table-link, #2367d1)' : undefined, ...(col.frozen ? {'--forge-frozen-column-width': `${col.resolvedCompactWidth}px`, '--forge-frozen-left': multiSelect ? '42px' : '0px'} : {})}}
                                    >
                                        <button type="button" className="forge-dashboard-table__sort-button" title={col.label || col.key} aria-label={`Sort by ${col.label || col.key}`} onClick={() => handleSort(col.key)}><span className="forge-dashboard-table__header-label">{col.label || col.key}</span><span aria-hidden="true">{arrow}</span></button>
                                    </th>
                                );
                            })}
                            {rowActions.length > 0 ? (
                                <th className="forge-dashboard-table__actions-head" style={{textAlign: 'right'}}>
                                    <span className="forge-dashboard-table__actions-head-inner">
                                        <span className="forge-dashboard-table__actions-head-icon" aria-hidden="true">
                                            <Icon icon="widget-button" size={12} />
                                        </span>
                                        <span>Actions</span>
                                    </span>
                                </th>
                            ) : null}
                        </tr>
                        </thead>
                        <tbody>
                        {sortedRows.map((row, index) => {
                            const rowRules = matchingRules(row, formattingRules, "row");
                            const rowStyle = mergeStyles(rowRules);
                            const rowClassName = [
                                mergeClassNames(rowRules),
                                ...categoricalRowClassNames(row, displayColumns),
                            ].filter(Boolean).join(" ");
                            return (
                                <tr key={index} className={rowClassName} style={rowStyle}>
                                    {multiSelect ? (
                                        <td style={{textAlign: 'center'}}>
                                            <label className="forge-table-selection-target"><input
                                                type="checkbox"
                                                disabled={container.readOnly === true}
                                                aria-label={`Select ${selectionRowLabel(row,index)}`}
                                                checked={rowSelected(row)}
                                                onChange={() => selectionHandlers.toggleSelection?.({row, rowIndex: index})}
                                            /></label>
                                        </td>
                                    ) : null}
                                    {displayColumns.map((col, ci) => {
                                        const cellRules = matchingRules(row, formattingRules, "cell", col.key);
                                        const cellStyle = {...rowStyle, ...mergeStyles(cellRules), textAlign: col.align || 'left'};
                                        const cellClassName = [rowClassName, mergeClassNames(cellRules)].filter(Boolean).join(" ");
                                        const value = resolveDashboardTableColumnValue(row, col, { preferDisplay: true });
                                        const presentationValue = typeof value === 'string' ? normalizePresentationText(value) : value;
                                        const clampedText = typeof presentationValue === 'string' && col.labelClamp
                                            ? clampPresentationText(presentationValue, col.labelClamp)
                                            : null;
                                        const renderedCell = renderDashboardTableCell(
                                            clampedText?.truncated ? clampedText.lines.join(' ') : presentationValue,
                                            row,
                                            col,
                                            locale,
                                            context,
                                        );
                                        return (
                                            <td key={`${index}-${ci}`} className={[cellClassName, col.frozen ? 'forge-table-frozen-identifier' : ''].filter(Boolean).join(' ')} style={{...cellStyle, ...(col.frozen ? {'--forge-frozen-column-width': `${col.resolvedCompactWidth}px`, '--forge-frozen-left': multiSelect ? '42px' : '0px'} : {})}}>
                                                {clampedText ? (
                                                    <span
                                                        className="forge-dashboard-table-cell-label-clamp"
                                                        title={clampedText.fullText}
                                                        style={{
                                                            display: '-webkit-box',
                                                            WebkitBoxOrient: 'vertical',
                                                            WebkitLineClamp: clampedText.lines.length,
                                                            overflow: 'hidden',
                                                        }}
                                                    >
                                                        {renderedCell}
                                                    </span>
                                                ) : renderedCell}
                                            </td>
                                        );
                                    })}
                                    {rowActions.length > 0 ? (
                                        <td className="forge-dashboard-table__actions-cell" style={{textAlign: 'right'}}>
                                            <div
                                                className={[
                                                    "forge-dashboard-row-actions",
                                                    rowActionDisplayMode === "compact" ? "forge-dashboard-row-actions--compact" : "",
                                                ].filter(Boolean).join(" ")}
                                            >
                                                {rowActions.map((action, actionIndex) => {
                                                    const presentation = resolveDashboardRowActionPresentation(action);
                                                    const label = action?.label == null
                                                        ? (action?.id == null ? 'Action' : String(action.id).trim() || 'Action')
                                                        : (String(action.label).trim() || 'Action');
                                                    const visibleLabel = resolveDashboardRowActionVisibleLabel(action, {
                                                        displayMode: rowActionDisplayMode,
                                                    });
                                                    const iconOnly = !visibleLabel;
                                                    return (
                                                    <button
                                                        key={resolveDashboardRowActionKey(action, actionIndex)}
                                                        type="button"
                                                        className={[
                                                            'forge-dashboard-row-action',
                                                            rowActionDisplayMode === 'compact' ? 'forge-dashboard-row-action--compact' : '',
                                                            iconOnly ? 'forge-dashboard-row-action--icon-only' : '',
                                                            presentation.className,
                                                        ].filter(Boolean).join(' ')}
                                                        data-testid="report-runtime-row-action"
                                                        data-action-id={resolveDashboardRowActionIdentity(action)}
                                                        data-action-kind={presentation.kind}
                                                        data-action-display={rowActionDisplayMode}
                                                        aria-label={label}
                                                        title={label}
                                                        onClick={() => handleRowAction(action, row, index)}
                                                    >
                                                        <span className="forge-dashboard-row-action__icon" aria-hidden="true">
                                                            <Icon icon={presentation.icon} size={12} />
                                                        </span>
                                                        {visibleLabel ? (
                                                            <span
                                                                className="forge-dashboard-row-action__label"
                                                            >
                                                                {visibleLabel}
                                                            </span>
                                                        ) : null}
                                                        <span className="forge-dashboard-row-action__sr-label">
                                                            {label}
                                                        </span>
                                                    </button>
                                                );
                                                })}
                                            </div>
                                        </td>
                                    ) : null}
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                </div>
                {mobileCards ? (
                    <div className="forge-dashboard-table-cards">
                        {sortedRows.map((row, index) => {
                            const titleValue = resolveDashboardTableColumnValue(row, mobileTitleColumn, {preferDisplay: true});
                            const titleLabel = String(titleValue ?? `Row ${index + 1}`);
                            return (
                                <section className="forge-dashboard-table-card" key={`mobile-${index}`}>
                                    <header className="forge-dashboard-table-card__header">
                                        {multiSelect ? (
                                            <label className="forge-dashboard-table-card__title">
                                                <label className="forge-table-selection-target"><input
                                                    type="checkbox"
                                                    disabled={container.readOnly === true}
                                                    aria-label={`Select ${titleLabel}`}
                                                    checked={rowSelected(row)}
                                                    onChange={() => selectionHandlers.toggleSelection?.({row, rowIndex: index})}
                                                /></label>
                                                <strong>{renderDashboardTableCell(titleValue, row, mobileTitleColumn, locale, context)}</strong>
                                            </label>
                                        ) : (
                                            <span className="forge-dashboard-table-card__title">
                                                <strong>{renderDashboardTableCell(titleValue, row, mobileTitleColumn, locale, context)}</strong>
                                            </span>
                                        )}
                                        {mobileMetaColumn ? (
                                            <span className="forge-dashboard-table-card__meta">
                                                {mobileCards.metaLabel ? `${mobileCards.metaLabel}: ` : ''}
                                                {renderDashboardTableCell(
                                                    resolveDashboardTableColumnValue(row, mobileMetaColumn, {preferDisplay: true}),
                                                    row,
                                                    mobileMetaColumn,
                                                    locale,
                                                    context,
                                                )}
                                            </span>
                                        ) : null}
                                    </header>
                                    {mobileCardColumns.length > 0 ? (
                                        <dl className="forge-dashboard-table-card__fields">
                                            {mobileCardColumns.map((column) => (
                                                <div className="forge-dashboard-table-card__field" key={column.key}>
                                                    <dt>{column.label || column.key}</dt>
                                                    <dd>{renderDashboardTableCell(
                                                        resolveDashboardTableColumnValue(row, column, {preferDisplay: true}),
                                                        row,
                                                        column,
                                                        locale,
                                                        context,
                                                    )}</dd>
                                                </div>
                                            ))}
                                        </dl>
                                    ) : null}
                                </section>
                            );
                        })}
                    </div>
                ) : null}
                </>}
                </>
            ) : null}
            {pagingEnabled && pageCount > 1 ? (
                <div className="forge-dashboard-table-pager">
                    <button type="button" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
                    <span>{container?.paging?.rangeLabel === 'complete'
                        ? `Rows ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, allSortedRows.length)} of ${allSortedRows.length}`
                        : `Page ${currentPage} of ${pageCount}`}</span>
                    <button type="button" disabled={currentPage >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>Next</button>
                </div>
            ) : null}
        </>
    );
}
