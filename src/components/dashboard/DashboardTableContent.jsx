import React, { useMemo, useState } from "react";
import { useSignalEffect } from "@preact/signals-react";

import { useDataSourceState } from "../../hooks/useDataSourceState.js";
import { resolveKey } from "../../utils/selector.js";
import { resolveTableLink } from "../../utils/tableLink.js";
import { getDashboardFilterSignal, getDashboardSelectionSignal } from "../../core/store/signals.js";
import { matchingRules, mergeClassNames, mergeStyles, normalizeRuleList } from "../table/formattingRules.js";
import { applyDashboardFiltersToCollection, applyDashboardSelectionToCollection, publishDashboardSelection } from "./dashboardUtils.js";
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
            {!loading && sortedRows.length === 0 ? <div style={subtitleStyle}>No data.</div> : null}
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
                            {rowActions.length > 0 ? <th style={{textAlign: 'right'}}>Actions</th> : null}
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
                                        <td style={{textAlign: 'right'}}>
                                            <div style={{display: 'inline-flex', gap: 6}}>
                                                {rowActions.map((action) => (
                                                    <button
                                                        key={action.id || action.label}
                                                        type="button"
                                                        className="forge-dashboard-row-action"
                                                        onClick={() => handleRowAction(action, row, index)}
                                                    >
                                                        {action.label || action.id || 'Action'}
                                                    </button>
                                                ))}
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
