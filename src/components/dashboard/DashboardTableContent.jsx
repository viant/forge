import React, { useMemo, useState } from "react";
import { useSignalEffect } from "@preact/signals-react";
import { Icon } from "@blueprintjs/core";

import { useDataSourceState } from "../../hooks/useDataSourceState.js";
import { resolveKey } from "../../utils/selector.js";
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
import { buildReportTableRuntimeColumns } from "./reportTableCellVisuals.js";
import { renderDashboardTableCell, titleizeDashboardKey } from "./dashboardVisualUtils.jsx";

const DEFAULT_SUBTITLE_STYLE = {
    fontSize: '12px',
    color: '#5f6b7c',
    margin: 0,
};

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
}) {
    const {collection, loading, error} = useDataSourceState(context);
    const dashboardFilterSignal = context?.dashboardKey ? getDashboardFilterSignal(context.dashboardKey) : null;
    const dashboardSelectionSignal = context?.dashboardKey ? getDashboardSelectionSignal(context.dashboardKey) : null;
    const dashboardFilters = useSignalSnapshot(dashboardFilterSignal, {});
    const dashboardSelection = useSignalSnapshot(dashboardSelectionSignal, {});
    const limit = container.dashboard?.table?.limit || container.limit || 200;
    const [quickFilter, setQuickFilter] = useState("");
    const quickFilterEnabled = container.dashboard?.table?.quickFilter === true || container.quickFilter === true;
    const density = container.dashboard?.table?.density || container.density || "comfortable";
    const rowActions = container.dashboard?.table?.rowActions || container.rowActions || [];
    const rowActionDisplayMode = container.dashboard?.table?.rowActionDisplay || container.rowActionDisplay || "compact";
    const formattingRules = useMemo(
        () => normalizeRuleList(container.dashboard?.table?.formattingRules || container.dashboard?.table?.formatting || container.formattingRules || []),
        [container.dashboard?.table?.formattingRules, container.dashboard?.table?.formatting, container.formattingRules]
    );

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
            label: col?.label || titleizeDashboardKey(key),
            format: col?.format,
            align: col?.align,
            type: col?.type,
            link: col?.link,
            cellVisual: col?.cellVisual,
        };
    }).filter((col) => !!col.key), [rawColumns]);

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
        () => buildReportTableRuntimeColumns(normalizedColumns, quickFilteredCollection),
        [normalizedColumns, quickFilteredCollection],
    );

    const [sortKey, setSortKey] = useState(null);
    const [sortDir, setSortDir] = useState('asc');

    const sortedRows = useMemo(() => {
        const rows = quickFilteredCollection.slice(0, limit);
        if (!sortKey) return rows;
        const sortColumn = runtimeColumns.find((col) => col.key === sortKey);
        return [...rows].sort((a, b) => {
            const avRaw = resolveDashboardTableColumnValue(a, sortColumn, { preferDisplay: true });
            const bvRaw = resolveDashboardTableColumnValue(b, sortColumn, { preferDisplay: true });
            const avLink = resolveTableLink({row: a, column: sortColumn, value: avRaw});
            const bvLink = resolveTableLink({row: b, column: sortColumn, value: bvRaw});
            const av = avLink ? avLink.text : avRaw;
            const bv = bvLink ? bvLink.text : bvRaw;
            const an = Number(av);
            const bn = Number(bv);
            const numeric = Number.isFinite(an) && Number.isFinite(bn);
            const cmp = numeric ? an - bn : String(av ?? '').localeCompare(String(bv ?? ''));
            return sortDir === 'desc' ? -cmp : cmp;
        });
    }, [quickFilteredCollection, limit, runtimeColumns, sortKey, sortDir]);

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
            {loading ? <div style={subtitleStyle}>Loading…</div> : null}
            {error ? <div style={{...subtitleStyle, color: '#a82a2a'}}>{String(error)}</div> : null}
            {!loading && !error && sortedRows.length === 0 ? <div style={subtitleStyle}>No data.</div> : null}
            {quickFilterEnabled ? (
                <div className="forge-dashboard-table-tools">
                    <input
                        type="search"
                        className="forge-dashboard-search"
                        value={quickFilter}
                        placeholder="Quick filter rows..."
                        onChange={(event) => setQuickFilter(event.target.value)}
                    />
                    <span style={subtitleStyle}>{sortedRows.length} rows</span>
                </div>
            ) : null}
            {sortedRows.length > 0 ? (
                <div className="forge-dashboard-table-wrap">
                    <table className={density === "compact" ? "forge-dashboard-table forge-dashboard-table--compact" : "forge-dashboard-table"}>
                        <thead>
                        <tr>
                            {runtimeColumns.map((col) => {
                                const active = sortKey === col.key;
                                const arrow = active ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';
                                return (
                                    <th
                                        key={col.key}
                                        onClick={() => handleSort(col.key)}
                                        style={{textAlign: col.align || 'left', color: active ? '#2367d1' : undefined, cursor: 'pointer', userSelect: 'none'}}
                                    >
                                        {col.label}{arrow}
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
                            const rowClassName = mergeClassNames(rowRules);
                            return (
                                <tr key={index} className={rowClassName} style={rowStyle}>
                                    {runtimeColumns.map((col, ci) => {
                                        const cellRules = matchingRules(row, formattingRules, "cell", col.key);
                                        const cellStyle = {...rowStyle, ...mergeStyles(cellRules), textAlign: col.align || 'left'};
                                        const cellClassName = [rowClassName, mergeClassNames(cellRules)].filter(Boolean).join(" ");
                                        const value = resolveDashboardTableColumnValue(row, col, { preferDisplay: true });
                                        return (
                                            <td key={`${index}-${ci}`} className={cellClassName} style={cellStyle}>
                                                {renderDashboardTableCell(value, row, col, locale, context)}
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
            ) : null}
        </>
    );
}
