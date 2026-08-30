import React, {useEffect, useMemo, useState} from 'react';
import {useSignalEffect} from '@preact/signals-react';
import {useSignals} from '@preact/signals-react/runtime';
import {Icon} from '@blueprintjs/core';
import {useDataSourceState} from "../../hooks/useDataSourceState.js";
import Chart from "../Chart.jsx";
import {resolveKey} from "../../utils/selector.js";
import ReportBuilder from "./ReportBuilder.jsx";
import ReportCatalog from "./ReportCatalog.jsx";
import {applyDashboardFiltersToCollection, applyDashboardSelectionToCollection, buildDashboardDefaultFilters, createDashboardConditionSnapshot, evaluateDashboardCondition, formatDashboardDelta, formatDashboardValue, getDashboardToneName, getDashboardVisibleWhen, interpolateDashboardTemplate, publishDashboardSelection, shouldShowDashboardKPIContext} from "./dashboardUtils.js";
import {getDashboardFilterSignal, getDashboardSelectionSignal} from "../../core/store/signals.js";
import {aggregateGeoRows, buildGeoConfig, DEFAULT_GEO_PALETTE, findGeoColorRule, normalizeGeoKey, resolveGeoColor, US_STATE_TILES} from "./geoMapUtils.js";
import ReportRuntime from "./ReportRuntime.jsx";
import { resolveDashboardReportRuntimeHandlers } from "./dashboardReportRuntimeHandlers.js";
import DashboardTableContent from "./DashboardTableContent.jsx";
import { buildTableRuntimeColumns, resolveTableCellVisualState } from "./tableCellVisuals.js";
import { withFrozenIdentifierColumn } from "./tableFrozenIdentifier.js";
import LookupSelectionInput from "../lookup/LookupSelectionInput.jsx";
import { dashboardStatusTone, isDashboardStatusValue, titleizeDashboardKey, toneColors } from "./dashboardVisualUtils.jsx";
import { DashboardErrorBoundary } from "./dashboardErrorBoundary.js";
import "./Dashboard.css";

const EMPTY_REPORT_RUNTIME_SPEC = {};

const panelStyle = {
    width: '100%',
    height: 'auto',
    minHeight: 0,
    minWidth: 0,
    padding: '14px',
    border: '1px solid #dbe5ec',
    borderRadius: '14px',
    background: 'linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)',
    boxShadow: '0 8px 18px rgba(16, 22, 26, 0.035), 0 1px 2px rgba(16, 22, 26, 0.05)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    boxSizing: 'border-box',
    overflow: 'hidden',
};

const titleStyle = {
    fontSize: '12px',
    fontWeight: 800,
    color: '#182026',
    margin: 0,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
};

const subtitleStyle = {
    fontSize: '12px',
    color: '#5f6b7c',
    margin: 0,
};

const sectionRuleStyle = {
    height: '1px',
    width: '100%',
    background: 'linear-gradient(90deg, rgba(19,124,189,0.24) 0%, rgba(15,153,96,0.1) 50%, rgba(219,225,232,0.18) 100%)',
};

const metricCardAccent = ['#137cbd', '#0f9960', '#d9822b', '#8f3985', '#c23030'];

function useMetrics(context) {
    const metricsSignal = context?.signals?.metrics;
    const [metrics, setMetrics] = useState(metricsSignal?.peek() || {});

    useSignalEffect(() => {
        setMetrics(metricsSignal?.value || {});
    });

    return metrics;
}

function useSignalSnapshot(signalValue, fallbackValue) {
    const [value, setValue] = useState(() => signalValue?.peek?.() ?? signalValue?.value ?? fallbackValue);

    useSignalEffect(() => {
        setValue(signalValue?.value ?? fallbackValue);
    });

    return value;
}

function getDashboardLocale(context) {
    return context?.locale || context?.metadata?.view?.content?.locale || 'en-US';
}

function deltaTone(delta, positiveIsUp = true) {
    if (delta == null || Number.isNaN(Number(delta)) || Number(delta) === 0) {
        return toneColors.info;
    }
    const isPositive = Number(delta) > 0;
    const isGood = positiveIsUp ? isPositive : !isPositive;
    return isGood ? toneColors.success : toneColors.danger;
}

function Panel({container, children, actions = null}) {
    return (
        <div className="forge-dashboard-panel">
            {(container.title || actions) ? (
                <div className="forge-dashboard-panel-header">
                    <div className="forge-dashboard-panel-title">
                        {container.title ? <h3>{container.title}</h3> : null}
                        {container.subtitle ? <p>{container.subtitle}</p> : null}
                    </div>
                    {actions}
                </div>
            ) : null}
            {(container.title || actions) ? <div className="forge-dashboard-panel-rule" /> : null}
            <div className="forge-dashboard-panel-body">
                {children}
            </div>
        </div>
    );
}

export function DashboardSummary({container, context}) {
    const metricsData = useMetrics(context);
    const locale = getDashboardLocale(context);
    const summaryConfig = container.dashboard?.summary || {};
    const summaryContext = container?.dataSourceRef && typeof context?.Context === 'function'
        ? context.Context(container.dataSourceRef)
        : context;
    const {collection: summaryCollection = []} = useDataSourceState(summaryContext);
    const summaryRow = Array.isArray(summaryCollection) && summaryCollection.length > 0 && summaryCollection[0] && typeof summaryCollection[0] === 'object'
        ? summaryCollection[0]
        : null;
    const summaryEntries = summaryConfig.items || container.items || summaryConfig.metrics || container.metrics || [];
    const metricCards = Array.isArray(summaryEntries)
        ? summaryEntries.map((metric) => {
            const selector = metric.selector || metric.field || metric.key || metric.valueField;
            const rowValue = selector && summaryRow ? resolveKey(summaryRow, selector) : undefined;
            const value = rowValue !== undefined ? rowValue : (selector ? resolveKey(metricsData, selector) : metric.value);
            const secondarySelector = metric.secondarySelector || metric.secondaryField || metric.secondaryKey || metric.secondaryValueField;
            const secondaryRowValue = secondarySelector && summaryRow ? resolveKey(summaryRow, secondarySelector) : undefined;
            const secondaryValue = secondaryRowValue !== undefined
                ? secondaryRowValue
                : (secondarySelector ? resolveKey(metricsData, secondarySelector) : metric.secondaryValue);
            return {
                key: metric.id || selector || metric.label,
                label: metric.label,
                value,
                format: metric.format,
                icon: metric.icon,
                secondaryValue,
                secondaryFormat: metric.secondaryFormat || metric.format,
            };
        })
        : summaryEntries && typeof summaryEntries === 'object'
            ? Object.entries(summaryEntries).map(([key, value]) => ({
                key,
                label: titleizeDashboardKey(key),
                value,
                format: typeof value === 'number' && value > 0 && value < 1 ? 'percent' : undefined,
            }))
            : [];

    return (
        <Panel container={container}>
            <div className="forge-dashboard-metric-grid">
                {metricCards.map((metric) => {
                    const isStatus = isDashboardStatusValue(metric.value);
                    const tone = isStatus ? dashboardStatusTone(metric.value) : null;
                    const accent = metricCardAccent[Math.abs(String(metric.key || '').length) % metricCardAccent.length];
                    return (
                        <div
                            key={metric.key}
                            className="forge-dashboard-metric-card"
                            style={{"--forge-dashboard-accent": accent}}
                        >
                            <div className="forge-dashboard-metric-label" style={{display: 'flex', alignItems: 'center', gap: 7}}>
                                {metric.icon ? <Icon icon={metric.icon} size={14}/> : null}
                                <span>{metric.label}</span>
                            </div>
                            {isStatus ? (
                                <div>
                                    <span style={{display: 'inline-flex', alignItems: 'center', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: tone.text, background: tone.background, border: `1px solid ${tone.border}`, borderRadius: '999px', padding: '5px 10px'}}>
                                        {String(metric.value || '').replace(/_/g, ' ')}
                                    </span>
                                </div>
                            ) : (
                                <div>
                                    <div className="forge-dashboard-metric-value">{formatDashboardValue(metric.value, metric.format, locale)}</div>
                                    {metric.secondaryValue !== undefined && metric.secondaryValue !== null && metric.secondaryValue !== '' ? (
                                        <div className="forge-dashboard-metric-subvalue">
                                            {formatDashboardValue(metric.secondaryValue, metric.secondaryFormat, locale)}
                                        </div>
                                    ) : null}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </Panel>
    );
}

export function DashboardCompare({container, context}) {
    const metricsData = useMetrics(context);
    const locale = getDashboardLocale(context);
    const items = container.dashboard?.compare?.items || container.items || [];
    const compareAccent = ['#137cbd', '#0f9960', '#d9822b', '#8f3985', '#c23030'];

    return (
        <Panel container={container}>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px'}}>
                {items.map((item) => {
                    const currentValue = resolveKey(metricsData, item.current);
                    const previousValue = resolveKey(metricsData, item.previous);
                    const delta = currentValue == null || previousValue == null
                        ? null
                        : Number(currentValue) - Number(previousValue);
                    const positiveIsUp = item.positiveIsUp !== false;
                    const tone = deltaTone(delta, positiveIsUp);

                    return (
                        <div
                            key={item.id || item.label || item.current}
                            style={{
                                border: '1px solid #d8e1e8',
                                borderTop: `3px solid ${compareAccent[Math.abs(String(item.id || item.label || '').length) % compareAccent.length]}`,
                                borderRadius: '10px',
                                padding: '12px',
                                background: 'linear-gradient(180deg, #ffffff 0%, #f8fbfe 100%)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px',
                                boxShadow: '0 1px 2px rgba(16, 22, 26, 0.05)',
                            }}
                        >
                            <div style={{fontSize: '11px', letterSpacing: '0.02em', textTransform: 'uppercase', color: '#5f6b7c'}}>{item.label}</div>
                            <div style={{fontSize: '24px', fontWeight: 700, color: '#182026'}}>{formatDashboardValue(currentValue, item.format, locale)}</div>
                            {(item.currentLabel || item.previousLabel) ? (
                                <div style={{display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '2px'}}>
                                    {item.currentLabel ? (
                                        <span style={{display: 'inline-flex', alignItems: 'center', width: 'fit-content', fontSize: '11px', fontWeight: 700, color: '#30404d', background: '#edf4fa', border: '1px solid #d5e3ef', borderRadius: '999px', padding: '4px 9px'}}>
                                            {item.currentLabel}
                                        </span>
                                    ) : null}
                                    {item.previousLabel ? (
                                        <div style={{fontSize: '11px', color: '#5f6b7c', lineHeight: 1.35}}>
                                            <span style={{fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', fontSize: '10px'}}>Baseline</span>
                                            {' '}
                                            {item.previousLabel}
                                        </div>
                                    ) : null}
                                </div>
                            ) : null}
                            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', paddingTop: '2px'}}>
                                <span style={{fontSize: '12px', color: '#5f6b7c'}}>
                                    {item.deltaLabel || 'vs previous'}: {formatDashboardValue(previousValue, item.format, locale)}
                                </span>
                                <span
                                    style={{
                                        fontSize: '12px',
                                        fontWeight: 700,
                                        color: tone.text,
                                        background: tone.background,
                                        border: `1px solid ${tone.border}`,
                                        borderRadius: '999px',
                                        padding: '2px 8px',
                                    }}
                                >
                                    {formatDashboardDelta(delta, item.deltaFormat || `${item.format || 'number'}Delta`, locale)}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </Panel>
    );
}

export function DashboardKPITable({container, context}) {
    const metricsData = useMetrics(context);
    const locale = getDashboardLocale(context);
    const {collection = []} = useDataSourceState(context);
    const kpiTableConfig = container.dashboard?.kpiTable || {};
    const directRows = kpiTableConfig.rows || container.rows || [];
    const rows = Array.isArray(directRows) && directRows.length > 0 ? directRows : (Array.isArray(collection) ? collection : []);
    const columns = Array.isArray(kpiTableConfig.columns)
        ? kpiTableConfig.columns
        : Array.isArray(container.columns)
            ? container.columns
            : null;
    const usesDirectTable = Array.isArray(columns) && columns.length > 0;
    const normalizedColumns = usesDirectTable
        ? columns.map((column) => {
            if (typeof column === 'string') {
                const lower = column.toLowerCase();
                const format = lower === 'ctr' || lower === 'vtr' ? 'percent' : undefined;
                return {key: column, label: titleizeDashboardKey(column), format};
            }
            const key = String(column?.key || column?.field || column?.id || '').trim();
            const lower = key.toLowerCase();
            const inferredFormat = lower === 'ctr' || lower === 'vtr' ? 'percent' : undefined;
            return {
                key,
                label: column?.label || titleizeDashboardKey(key),
                format: column?.format || inferredFormat,
            };
        }).filter((column) => !!column.key)
        : [];
    const showContextColumn = shouldShowDashboardKPIContext(rows);

    return (
        <Panel container={container}>
            <div style={{overflow: 'auto'}}>
                <table style={{width: '100%', borderCollapse: 'separate', borderSpacing: 0}}>
                    {usesDirectTable ? (
                        <>
                            <thead>
                            <tr>
                                {normalizedColumns.map((column) => (
                                    <th key={column.key} style={{textAlign: 'left', borderBottom: '1px solid #d8e1e8', padding: '10px 8px', background: '#f7fafc', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.02em', color: '#5f6b7c', position: 'sticky', top: 0}}>
                                        {column.label}
                                    </th>
                                ))}
                            </tr>
                            </thead>
                            <tbody>
                            {rows.map((row, index) => {
                                const cells = Array.isArray(row) ? row : normalizedColumns.map((column) => row?.[column.key]);
                                return (
                                    <tr key={index} style={{background: index % 2 === 0 ? '#ffffff' : '#fbfdff'}}>
                                        {cells.map((cell, cellIndex) => (
                                            <td key={`${index}-${cellIndex}`} style={{padding: '10px 8px', borderBottom: '1px solid #ebf1f5', color: cellIndex === 0 ? '#182026' : '#30404d', fontWeight: cellIndex === 0 ? 600 : 400, fontSize: '12px', lineHeight: 1.45, verticalAlign: 'top', maxWidth: cellIndex >= normalizedColumns.length - 1 ? '320px' : undefined, whiteSpace: cellIndex >= normalizedColumns.length - 2 ? 'normal' : 'nowrap'}}>
                                                {renderDashboardTableCell(cell, row, normalizedColumns[cellIndex], locale, context)}
                                            </td>
                                        ))}
                                    </tr>
                                );
                            })}
                            </tbody>
                        </>
                    ) : (
                        <>
                            <thead>
                            <tr>
                                <th style={{textAlign: 'left', borderBottom: '1px solid #d8e1e8', padding: '8px'}}>Metric</th>
                                <th style={{textAlign: 'right', borderBottom: '1px solid #d8e1e8', padding: '8px'}}>Value</th>
                                {showContextColumn ? (
                                    <th style={{textAlign: 'right', borderBottom: '1px solid #d8e1e8', padding: '8px'}}>Context</th>
                                ) : null}
                            </tr>
                            </thead>
                            <tbody>
                            {rows.map((row, index) => {
                                const tone = toneColors[row.contextTone] || toneColors.info;
                                const value = resolveKey(metricsData, row.value);
                                return (
                                    <tr key={row.id || row.label || index}>
                                        <td style={{padding: '8px', borderBottom: '1px solid #ebf1f5', fontWeight: 600}}>{row.label}</td>
                                        <td style={{padding: '8px', textAlign: 'right', borderBottom: '1px solid #ebf1f5'}}>{formatDashboardValue(value, row.format, locale, {
                                            timeZone: row.timeZone || (row.timeZoneSelector ? resolveKey(metricsData, row.timeZoneSelector) : undefined),
                                        })}</td>
                                        {showContextColumn ? (
                                            <td style={{padding: '8px', textAlign: 'right', borderBottom: '1px solid #ebf1f5'}}>
                                                {row.context ? (
                                                    <span style={{fontSize: '12px', color: tone.text, background: tone.background, border: `1px solid ${tone.border}`, borderRadius: '999px', padding: '2px 8px'}}>
                                                        {row.context}
                                                    </span>
                                                ) : '-'}
                                            </td>
                                        ) : null}
                                    </tr>
                                );
                            })}
                            </tbody>
                        </>
                    )}
                </table>
            </div>
        </Panel>
    );
}

export function DashboardFilters({container, context}) {
    const items = container.dashboard?.filters?.items || container.items || [];
    const dashboardKey = context?.dashboardKey;
    const [filters, setFilters] = useState(dashboardKey ? getDashboardFilterSignal(dashboardKey).peek() : {});

    useSignalEffect(() => {
        if (!dashboardKey) {
            return;
        }
        const filterSignal = getDashboardFilterSignal(dashboardKey);
        const current = filterSignal.value || {};
        const defaults = buildDashboardDefaultFilters({
            kind: 'dashboard',
            containers: [{kind: 'dashboard.filters', items}],
        });
        const next = {...defaults, ...current};
        const changed = JSON.stringify(next) !== JSON.stringify(current);

        if (changed) {
            filterSignal.value = next;
            setFilters(next);
            return;
        }
        setFilters(current);
    });

    const toggleOption = (item, optionValue) => {
        if (!dashboardKey) {
            return;
        }
        const field = item.field || item.id;
        const filterSignal = getDashboardFilterSignal(dashboardKey);
        const current = filterSignal.peek() || {};
        if (item.multiple) {
            const list = Array.isArray(current[field]) ? current[field] : [];
            const nextList = list.includes(optionValue)
                ? list.filter((entry) => entry !== optionValue)
                : [...list, optionValue];
            filterSignal.value = {...current, [field]: nextList};
            return;
        }
        filterSignal.value = {...current, [field]: optionValue};
    };

    const setDateRange = (item, edge, value) => {
        if (!dashboardKey) return;
        const field = item.field || item.id;
        const filterSignal = getDashboardFilterSignal(dashboardKey);
        const current = filterSignal.peek() || {};
        const prev = current[field] && typeof current[field] === 'object' ? current[field] : {};
        filterSignal.value = {...current, [field]: {...prev, [edge]: value || undefined}};
    };

    return (
        <Panel container={container}>
            <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                {items.map((item) => {
                    const field = item.field || item.id;
                    const current = filters?.[field];
                    if (item.type === 'dateRange') {
                        const range = current && typeof current === 'object' ? current : {};
                        return (
                            <div key={field} style={{display: 'flex', flexDirection: 'column', gap: '6px'}}>
                                <div style={{fontSize: '12px', fontWeight: 600, color: '#5f6b7c'}}>{item.label}</div>
                                <div style={{display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center'}}>
                                    <input
                                        type="date"
                                        value={range.start || ''}
                                        onChange={(e) => setDateRange(item, 'start', e.target.value)}
                                        style={{border: '1px solid #ced9e0', borderRadius: '6px', padding: '4px 8px', fontSize: '12px', color: '#30404d'}}
                                    />
                                    <span style={{fontSize: '12px', color: '#5f6b7c'}}>to</span>
                                    <input
                                        type="date"
                                        value={range.end || ''}
                                        onChange={(e) => setDateRange(item, 'end', e.target.value)}
                                        style={{border: '1px solid #ced9e0', borderRadius: '6px', padding: '4px 8px', fontSize: '12px', color: '#30404d'}}
                                    />
                                </div>
                            </div>
                        );
                    }
                    return (
                        <div key={field} style={{display: 'flex', flexDirection: 'column', gap: '6px'}}>
                            <div style={{fontSize: '12px', fontWeight: 600, color: '#5f6b7c'}}>{item.label}</div>
                            <div style={{display: 'flex', flexWrap: 'wrap', gap: '8px'}}>
                                {(item.options || []).map((option) => {
                                    const active = item.multiple
                                        ? Array.isArray(current) && current.includes(option.value)
                                        : current === option.value;
                                    return (
                                        <button
                                            key={option.value}
                                            type="button"
                                            aria-pressed={active ? 'true' : 'false'}
                                            className={active ? 'forge-dashboard-filter-chip is-active' : 'forge-dashboard-filter-chip'}
                                            onClick={() => toggleOption(item, option.value)}
                                            style={{
                                                border: '1px solid #ced9e0',
                                                background: active ? '#137cbd' : '#ffffff',
                                                color: active ? '#ffffff' : '#30404d',
                                                borderRadius: '999px',
                                                padding: '4px 10px',
                                                cursor: 'pointer',
                                                fontSize: '12px',
                                            }}
                                        >
                                            {option.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </Panel>
    );
}

export function DashboardGeoMap({container, context}) {
    const {collection, loading, error} = useDataSourceState(context);
    const locale = getDashboardLocale(context);
    const config = useMemo(() => buildGeoConfig(container, titleizeDashboardKey), [container]);
    const [hoveredKey, setHoveredKey] = useState(null);
    const dashboardFilterSignal = context?.dashboardKey ? getDashboardFilterSignal(context.dashboardKey) : null;
    const dashboardSelectionSignal = context?.dashboardKey ? getDashboardSelectionSignal(context.dashboardKey) : null;
    const dashboardFilters = useSignalSnapshot(dashboardFilterSignal, {});
    const dashboardSelection = useSignalSnapshot(dashboardSelectionSignal, {});

    const filteredCollection = useMemo(() => {
        const afterFilters = applyDashboardFiltersToCollection(collection || [], container.filterBindings, dashboardFilters);
        return applyDashboardSelectionToCollection(afterFilters, container.selectionBindings, dashboardSelection);
    }, [collection, container.filterBindings, container.selectionBindings, dashboardFilters, dashboardSelection]);

    const geoRows = useMemo(
        () => aggregateGeoRows(filteredCollection, config),
        [filteredCollection, config],
    );

    const valueRange = useMemo(() => {
        const values = Array.from(geoRows.values()).map((entry) => Number(entry.value)).filter(Number.isFinite);
        if (!values.length) {
            return {min: 0, max: 0};
        }
        return {min: Math.min(...values), max: Math.max(...values)};
    }, [geoRows]);

    const regions = useMemo(() => {
        const tiles = config.shape === 'us-states' || config.shape === 'us-state-tiles'
            ? US_STATE_TILES
            : [];
        return tiles.map((tile) => {
            const entry = geoRows.get(tile.key);
            const dataRow = entry?.row || null;
            const label = config.labelKey && dataRow ? resolveKey(dataRow, config.labelKey) : tile.label;
            const value = entry ? entry.value : null;
            const color = entry
                ? resolveGeoColor({row: dataRow, value, minValue: valueRange.min, maxValue: valueRange.max, colorConfig: config.color})
                : config.color.empty;
            return {
                ...tile,
                label,
                dataRow,
                rows: entry?.rows || [],
                value,
                color,
                formattedValue: entry ? formatDashboardValue(value, config.format, locale) : '-',
            };
        });
    }, [config, geoRows, locale, valueRange]);

    const selectedKey = normalizeGeoKey(dashboardSelection?.entityKey);
    const sortedRegions = useMemo(
        () => regions
            .filter((region) => Number.isFinite(Number(region.value)))
            .sort((a, b) => Number(b.value) - Number(a.value)),
        [regions],
    );
    const activeRegion = regions.find((region) => region.key === hoveredKey)
        || regions.find((region) => region.key === selectedKey)
        || sortedRegions[0]
        || null;
    const activeRule = activeRegion ? findGeoColorRule(activeRegion.dataRow, config.color) : null;
    const colorRules = config.color.field && Array.isArray(config.color.rules)
        ? config.color.rules.filter((rule) => rule?.color)
        : [];

    const onSelect = (region, rowIndex = 0) => {
        if (!region?.key) {
            return;
        }
        const selected = region.dataRow || {[config.key]: region.key, label: region.label};
        context.handlers?.dataSource?.setSelected?.({selected, rowIndex});
        publishDashboardSelection({
            context,
            dimension: config.dimension,
            entityKey: region.key,
            selected,
            sourceBlockId: container.id,
        });

        const selectExecution = (container.on || []).find((entry) => entry?.event === 'onSelect');
        if (selectExecution && typeof context?.lookupHandler === 'function') {
            try {
                const fn = context.lookupHandler(selectExecution.handler);
                if (typeof fn === 'function') {
                    fn({execution: selectExecution, context, item: selected, rowIndex});
                }
            } catch (e) {
                console.error('dashboard geo onSelect handler failed', e);
            }
        }
    };

    if (config.shape !== 'us-states' && config.shape !== 'us-state-tiles') {
        return (
            <Panel container={container}>
                <div style={subtitleStyle}>Unsupported geo shape: {config.shape}</div>
            </Panel>
        );
    }

    const totalValue = sortedRegions.reduce((sum, region) => sum + (Number(region.value) || 0), 0);
    const topRegion = sortedRegions[0];

    return (
        <Panel container={container}>
            {loading ? <div style={subtitleStyle}>Loading…</div> : null}
            {error ? <div style={{...subtitleStyle, color: '#a82a2a'}}>{String(error)}</div> : null}
            {!loading && !error && sortedRegions.length === 0 ? <div style={subtitleStyle}>No geo data.</div> : null}
            <div className="forge-dashboard-geo">
                <div className="forge-dashboard-geo-stage">
                    <div className="forge-dashboard-geo-summary">
                        <span><strong>{sortedRegions.length}</strong> Regions</span>
                        <span><strong>{formatDashboardValue(totalValue, config.format, locale)}</strong> Total {config.metricLabel}</span>
                        <span><strong>{topRegion?.key || '-'}</strong> Top Region</span>
                    </div>
                    <div className="forge-dashboard-geo-map" role="list" aria-label={container.title || 'Geo map'}>
                        {regions.map((region, index) => {
                            const isSelected = selectedKey === region.key;
                            const isEmpty = !region.dataRow;
                            return (
                                <button
                                    key={region.key}
                                    type="button"
                                    role="listitem"
                                    className={[
                                        'forge-dashboard-geo-tile',
                                        isSelected ? 'is-selected' : '',
                                        isEmpty ? 'is-empty' : '',
                                    ].filter(Boolean).join(' ')}
                                    style={{
                                        gridColumn: region.col,
                                        gridRow: region.row,
                                        '--forge-dashboard-geo-fill': region.color,
                                    }}
                                    title={`${region.label} (${region.key}): ${region.formattedValue}`}
                                    onMouseEnter={() => setHoveredKey(region.key)}
                                    onMouseLeave={() => setHoveredKey(null)}
                                    onFocus={() => setHoveredKey(region.key)}
                                    onBlur={() => setHoveredKey(null)}
                                    onClick={() => onSelect(region, index)}
                                >
                                    <span>{region.key}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
                <aside className="forge-dashboard-geo-detail">
                    <div
                        className="forge-dashboard-geo-detail-card"
                        style={{'--forge-dashboard-geo-active-color': activeRule?.color || activeRegion?.color || '#2367d1'}}
                    >
                        <span className="forge-dashboard-geo-detail-label">Selected Area</span>
                        <strong>{activeRegion ? `${activeRegion.label} (${activeRegion.key})` : '-'}</strong>
                        <span className="forge-dashboard-geo-detail-value">{config.metricLabel}: {activeRegion?.formattedValue || '-'}</span>
                        {activeRule ? (
                            <span className="forge-dashboard-geo-detail-status" style={{'--forge-dashboard-geo-status-color': activeRule.color}}>
                                {activeRule.label || activeRule.value || activeRule.equals || activeRule.when}
                            </span>
                        ) : null}
                    </div>
                    {config.legend ? (
                        colorRules.length > 0 ? (
                            <div className="forge-dashboard-geo-rule-legend" aria-label="Geo legend">
                                {colorRules.map((rule) => (
                                    <span key={`${rule.value ?? rule.equals ?? rule.when}`}>
                                        <i style={{background: rule.color}}/>
                                        {rule.label || rule.value || rule.equals || rule.when}
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <div className="forge-dashboard-geo-legend" aria-label="Geo legend">
                                <span>{formatDashboardValue(valueRange.min, config.format, locale)}</span>
                                <div>
                                    {(config.color.palette || DEFAULT_GEO_PALETTE).map((color) => (
                                        <i key={color} style={{background: color}}/>
                                    ))}
                                </div>
                                <span>{formatDashboardValue(valueRange.max, config.format, locale)}</span>
                            </div>
                        )
                    ) : null}
                    <div className="forge-dashboard-geo-ranking">
                        <div className="forge-dashboard-geo-detail-label">Top Regions</div>
                        {sortedRegions.slice(0, container.dashboard?.geo?.limit || container.limit || 5).map((region) => {
                            const width = valueRange.max > 0 ? `${Math.max((Number(region.value) / valueRange.max) * 100, 4)}%` : '4%';
                            return (
                                <button
                                    key={region.key}
                                    type="button"
                                    className={selectedKey === region.key ? 'is-selected' : ''}
                                    onClick={() => onSelect(region)}
                                >
                                    <span>{region.key}</span>
                                    <div><i style={{width, background: region.color}}/></div>
                                    <strong>{region.formattedValue}</strong>
                                </button>
                            );
                        })}
                    </div>
                </aside>
            </div>
        </Panel>
    );
}

export function DashboardTimeline({container, context, isActive}) {
    const normalizedContainer = !container.chart && (container.dataSource || container.mapping)
        ? {
            ...container,
            dataSourceRef: container.dataSourceRef || container.dataSource,
            chart: {
                type: 'line',
                xAxis: {
                    dataKey: container.mapping?.dateColumn || 'date',
                    label: titleizeDashboardKey(container.mapping?.dateColumn || 'date'),
                },
                series: {
                    nameKey: Array.isArray(container.mapping?.seriesColumns) && container.mapping.seriesColumns.length > 0
                        ? container.mapping.seriesColumns[0]
                        : 'series',
                    valueKey: Array.isArray(container.mapping?.seriesColumns) && container.mapping.seriesColumns.length > 1
                        ? container.mapping.seriesColumns[1]
                        : 'value',
                    values: Array.isArray(container.mapping?.seriesColumns)
                        ? container.mapping.seriesColumns.slice(1).map((entry) => ({label: titleizeDashboardKey(entry), value: entry}))
                        : [{label: 'Value', value: 'value'}],
                },
            },
        }
        : container;

    const chartConfig = normalizedContainer.chart;
    const chartContainer = chartConfig && !chartConfig.xAxis
        ? {
            ...normalizedContainer,
            chart: {
                ...chartConfig,
                xAxis: {
                    dataKey: chartConfig.categoryField || chartConfig.series?.nameKey || 'name',
                    label: chartConfig.categoryLabel || chartConfig.categoryField || 'Category',
                },
                series: {
                    ...(chartConfig.series || {}),
                    valueKey: chartConfig.series?.valueKey || chartConfig.valueField || 'value',
                    values: chartConfig.series?.values || [
                        {
                            label: chartConfig.valueLabel || chartConfig.series?.valueKey || chartConfig.valueField || 'Value',
                            value: chartConfig.series?.valueKey || chartConfig.valueField || 'value',
                            format: chartConfig.format,
                        },
                    ],
                    palette: chartConfig.series?.palette || chartConfig.palette,
                },
            },
        }
        : normalizedContainer;

    const dashboardFilterSignal = context?.dashboardKey ? getDashboardFilterSignal(context.dashboardKey) : null;
    const dashboardSelectionSignal = context?.dashboardKey ? getDashboardSelectionSignal(context.dashboardKey) : null;
    const dashboardFilters = useSignalSnapshot(dashboardFilterSignal, {});
    const dashboardSelection = useSignalSnapshot(dashboardSelectionSignal, {});
    const {collection = [], control, selection} = context?.signals || {};
    const collectionValue = useSignalSnapshot(collection, []);
    const filteredCollection = useMemo(() => {
        const afterFilters = applyDashboardFiltersToCollection(collectionValue || [], normalizedContainer.filterBindings, dashboardFilters);
        return applyDashboardSelectionToCollection(afterFilters, normalizedContainer.selectionBindings, dashboardSelection);
    }, [collectionValue, normalizedContainer.filterBindings, normalizedContainer.selectionBindings, dashboardFilters, dashboardSelection]);
    const filteredContext = useMemo(() => ({
        ...context,
        signals: {
            ...context?.signals,
            collection: {
                value: filteredCollection,
                peek: () => filteredCollection,
            },
            control,
            selection,
        },
    }), [context, filteredCollection, control, selection]);

    if (!chartContainer.chart) {
        return (
            <Panel container={container}>
                <div style={subtitleStyle}>Timeline blocks require `container.chart`.</div>
            </Panel>
        );
    }

    return (
        <Panel container={container}>
            <div style={{flex: '1 1 auto', minHeight: '500px', overflow: 'hidden', border: '1px solid #dbe6ef', borderRadius: '14px', background: 'linear-gradient(180deg, #fdfefe 0%, #f4f8fb 100%)', padding: '12px', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.85)'}}>
                <Chart container={chartContainer} context={filteredContext} isActive={isActive} embedded={true}/>
            </div>
        </Panel>
    );
}

export function DashboardDimensions({container, context}) {
    const {collection, loading, error, selection} = useDataSourceState(context);
    const locale = getDashboardLocale(context);
    const dimensionsConfig = container.dashboard?.dimensions || {};
    const viewModes = dimensionsConfig.viewModes || container.viewModes || [];
    const [viewMode, setViewMode] = useState((viewModes || [])[0] || 'chart');
    const [dashboardSelection, setDashboardSelection] = useState(
        context?.dashboardKey ? getDashboardSelectionSignal(context.dashboardKey).peek() : null,
    );
    const limit = dimensionsConfig.limit || container.limit || 10;
    const dimension = dimensionsConfig.dimension || container.dimension || {};
    const dimensionKey = dimension.key || dimension.field;
    const metric = dimensionsConfig.metric || container.metric || {};
    const metricKey = metric.key || metric.field;
    const metricLabel = metric.label || metricKey;
    const palette = container.palette || dimensionsConfig.palette || metric.palette || [
        '#2f6de1',
        '#7a46d8',
        '#db2f7d',
        '#f55d1f',
        '#d79619',
        '#2aa84a',
        '#24a0c7',
        '#5a5ce6',
    ];

    useSignalEffect(() => {
        if (!context?.dashboardKey) {
            return;
        }
        setDashboardSelection(getDashboardSelectionSignal(context.dashboardKey).value);
    });

    const dashboardFilterSignal = context?.dashboardKey ? getDashboardFilterSignal(context.dashboardKey) : null;
    const dashboardSelectionSignal = context?.dashboardKey ? getDashboardSelectionSignal(context.dashboardKey) : null;
    const dashboardFilters = useSignalSnapshot(dashboardFilterSignal, {});
    const selectionSnapshot = useSignalSnapshot(dashboardSelectionSignal, {});
    const filteredCollection = useMemo(() => {
        const afterFilters = applyDashboardFiltersToCollection(collection || [], container.filterBindings, dashboardFilters);
        return applyDashboardSelectionToCollection(afterFilters, container.selectionBindings, selectionSnapshot);
    }, [collection, container.filterBindings, container.selectionBindings, dashboardFilters, selectionSnapshot]);

    const selectedEntityKey = context?.dashboardKey
        ? dashboardSelection?.entityKey
        : selection?.selected?.[dimensionKey];

    const rows = useMemo(() => {
        return [...(filteredCollection || [])]
            .sort((a, b) => Number(b?.[metricKey] || 0) - Number(a?.[metricKey] || 0))
            .slice(0, limit);
    }, [filteredCollection, metricKey, limit]);

    const maxValue = useMemo(
        () => rows.reduce((result, row) => Math.max(result, Number(row?.[metricKey] || 0)), 0) || 1,
        [rows, metricKey],
    );

    const onSelect = (row, rowIndex) => {
        context.handlers?.dataSource?.setSelected?.({selected: row, rowIndex});
        publishDashboardSelection({
            context,
            dimension: dimensionKey,
            entityKey: row?.[dimensionKey],
            selected: row,
            sourceBlockId: container.id,
        });

        const selectExecution = (container.on || []).find((entry) => entry?.event === 'onSelect');
        if (selectExecution && typeof context?.lookupHandler === 'function') {
            try {
                const fn = context.lookupHandler(selectExecution.handler);
                if (typeof fn === 'function') {
                    fn({execution: selectExecution, context, item: row, rowIndex});
                }
            } catch (e) {
                console.error('dashboard dimension onSelect handler failed', e);
            }
        }
    };

    return (
        <Panel
            container={container}
            actions={(viewModes || []).length > 1 ? (
                <div style={{display: 'flex', gap: '8px'}}>
                    {(viewModes || []).map((mode) => (
                        <button
                            key={mode}
                            type="button"
                            onClick={() => setViewMode(mode)}
                            style={{
                                border: '1px solid #ced9e0',
                                background: mode === viewMode ? '#137cbd' : '#ffffff',
                                color: mode === viewMode ? '#ffffff' : '#30404d',
                                borderRadius: '6px',
                                padding: '4px 10px',
                                cursor: 'pointer',
                            }}
                        >
                            {mode}
                        </button>
                    ))}
                </div>
            ) : null}
        >
            {loading ? <div style={subtitleStyle}>Loading…</div> : null}
            {error ? <div style={{...subtitleStyle, color: '#a82a2a'}}>{String(error)}</div> : null}
            {!loading && !error && viewMode === 'table' ? (
                <div style={{overflow: 'auto'}}>
                    <table style={{width: '100%', borderCollapse: 'collapse'}}>
                        <thead>
                        <tr>
                            <th style={{textAlign: 'left', borderBottom: '1px solid #d8e1e8', padding: '8px'}}>Dimension</th>
                            <th style={{textAlign: 'right', borderBottom: '1px solid #d8e1e8', padding: '8px'}}>{metricLabel}</th>
                        </tr>
                        </thead>
                        <tbody>
                        {rows.map((row, index) => (
                            <tr
                                key={`${row?.[dimensionKey] ?? 'dimension'}:${index}`}
                                onClick={() => onSelect(row, index)}
                                style={{cursor: 'pointer', background: selectedEntityKey === row?.[dimensionKey] ? '#ebf1f5' : 'transparent'}}
                            >
                                <td style={{padding: '8px', borderBottom: '1px solid #ebf1f5'}}>{row?.[dimensionKey] ?? '-'}</td>
                                <td style={{padding: '8px', textAlign: 'right', borderBottom: '1px solid #ebf1f5'}}>{formatDashboardValue(row?.[metricKey], metric.format, locale)}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                    {rows.map((row, index) => {
                        const value = Number(row?.[metricKey] || 0);
                        const width = `${Math.max((value / maxValue) * 100, 2)}%`;
                        const isSelected = selectedEntityKey === row?.[dimensionKey];
                        const barColor = palette[index % Math.max(palette.length, 1)] || '#137cbd';
                        return (
                            <button
                                key={`${row?.[dimensionKey] ?? 'dimension'}:${index}`}
                                type="button"
                                onClick={() => onSelect(row, index)}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '6px',
                                    border: isSelected ? `1px solid ${barColor}` : '1px solid #d8e1e8',
                                    background: '#ffffff',
                                    borderRadius: '8px',
                                    padding: '10px',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                }}
                            >
                                <div style={{display: 'flex', justifyContent: 'space-between', gap: '12px'}}>
                                    <span style={{fontWeight: 600, color: '#182026'}}>{row?.[dimensionKey] ?? '-'}</span>
                                    <span style={{color: '#30404d'}}>{formatDashboardValue(value, metric.format, locale)}</span>
                                </div>
                                <div style={{height: '8px', background: '#ebf1f5', borderRadius: '999px', overflow: 'hidden'}}>
                                    <div style={{height: '100%', width, background: barColor}}/>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </Panel>
    );
}

export function DashboardMessages({container, context}) {
    const metricsData = useMetrics(context);
    const {collection} = useDataSourceState(context);
    const items = container.dashboard?.messages?.items || container.items || [];
    const normalizedItems = Array.isArray(items) && items.length > 0
        ? items
        : Array.isArray(container.messages)
            ? container.messages.map((message, index) => ({
                severity: 'info',
                title: `Note ${index + 1}`,
                body: String(message ?? ''),
            }))
            : [];
    const dashboardFilterSignal = context?.dashboardKey ? getDashboardFilterSignal(context.dashboardKey) : null;
    const dashboardSelectionSignal = context?.dashboardKey ? getDashboardSelectionSignal(context.dashboardKey) : null;
    const dashboardFilters = useSignalSnapshot(dashboardFilterSignal, {});
    const dashboardSelection = useSignalSnapshot(dashboardSelectionSignal, {});
    const interpolationScope = {
        ...metricsData,
        metrics: metricsData,
        filters: dashboardFilters,
        selection: dashboardSelection,
    };
    const sourceRows = Array.isArray(collection) ? collection : [];
    const conditionSnapshot = createDashboardConditionSnapshot({
        context: {
            ...context,
            signals: {
                ...context?.signals,
                metrics: {value: metricsData},
            },
        },
        dashboardKey: context?.dashboardKey,
        metrics: metricsData,
        dashboardFilters,
        dashboardSelection,
    });
    const visibleItems = normalizedItems.filter((item) => evaluateDashboardCondition(item.visibleWhen, {
        ...conditionSnapshot,
    }));

    return (
        <Panel container={container}>
            {visibleItems.length === 0 ? <div style={subtitleStyle}>No active messages.</div> : null}
            {visibleItems.map((item, index) => {
                const tone = toneColors[item.severity] || toneColors.info;
                const sourceRow = sourceRows[Math.max(0, Number(item.rowIndex) || 0)] || sourceRows[0] || {};
                const resolvedTitle = item.title
                    ? interpolateDashboardTemplate(item.title, interpolationScope)
                    : '';
                const resolvedBody = item.body
                    ? interpolateDashboardTemplate(item.body, interpolationScope)
                    : item.text
                        ? interpolateDashboardTemplate(item.text, interpolationScope)
                        : item.field
                            ? resolveKey(sourceRow, item.field)
                            : item.bodyField
                                ? resolveKey(sourceRow, item.bodyField)
                                : '';
                return (
                    <div
                        key={`${resolvedTitle || resolvedBody || index}`}
                        style={{padding: '16px', borderRadius: '12px', border: `1px solid ${tone.border}`, borderLeft: `4px solid ${tone.border}`, background: tone.background, color: tone.text, display: 'flex', flexDirection: 'column', gap: '10px', boxShadow: '0 1px 2px rgba(16, 22, 26, 0.04)'}}
                    >
                        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px'}}>
                            {resolvedTitle ? <div style={{fontWeight: 700}}>{resolvedTitle}</div> : <div />}
                            <span style={{fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', border: `1px solid ${tone.border}`, borderRadius: '999px', padding: '2px 8px', background: '#ffffffaa', color: tone.text}}>
                                {String(item.severity || 'info')}
                            </span>
                        </div>
                        <div style={{fontSize: '13px', lineHeight: 1.7, maxWidth: '92ch'}}>{resolvedBody}</div>
                    </div>
                );
            })}
        </Panel>
    );
}

export function DashboardStatus({container, context}) {
    const metricsData = useMetrics(context);
    const locale = getDashboardLocale(context);
    const checks = container.dashboard?.status?.checks || container.checks || [];

    return (
        <Panel container={container}>
            <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                {checks.map((check) => {
                    const value = resolveKey(metricsData, check.selector);
                    const toneName = getDashboardToneName(value, check.tone);
                    const tone = toneColors[toneName] || toneColors.info;
                    return (
                        <div
                            key={check.id || check.selector}
                            style={{display: 'flex', justifyContent: 'space-between', gap: '12px', border: `1px solid ${tone.border}`, background: tone.background, borderRadius: '8px', padding: '10px 12px'}}
                        >
                            <span style={{fontWeight: 600, color: tone.text}}>{check.label}</span>
                            <span style={{color: tone.text}}>{formatDashboardValue(value, check.format, locale)}</span>
                        </div>
                    );
                })}
            </div>
        </Panel>
    );
}

export function DashboardFeed({container, context}) {
    const {collection, loading, error} = useDataSourceState(context);
    const dashboardFilterSignal = context?.dashboardKey ? getDashboardFilterSignal(context.dashboardKey) : null;
    const dashboardSelectionSignal = context?.dashboardKey ? getDashboardSelectionSignal(context.dashboardKey) : null;
    const dashboardFilters = useSignalSnapshot(dashboardFilterSignal, {});
    const dashboardSelection = useSignalSnapshot(dashboardSelectionSignal, {});
    const items = useMemo(() => {
        const afterFilters = applyDashboardFiltersToCollection(collection || [], container.filterBindings, dashboardFilters);
        return applyDashboardSelectionToCollection(afterFilters, container.selectionBindings, dashboardSelection);
    }, [collection, container.filterBindings, container.selectionBindings, dashboardFilters, dashboardSelection]);
    const fields = container.dashboard?.feed?.fields || container.fields || {};

    return (
        <Panel container={container}>
            {loading ? <div style={subtitleStyle}>Loading…</div> : null}
            {error ? <div style={{...subtitleStyle, color: '#a82a2a'}}>{String(error)}</div> : null}
            {!loading && !items.length ? <div style={subtitleStyle}>No feed entries.</div> : null}
            <div style={{display: 'flex', flexDirection: 'column', gap: '10px', overflow: 'auto'}}>
                {items.map((item, index) => (
                    <div key={index} style={{borderLeft: '3px solid #137cbd', paddingLeft: '12px'}}>
                        {fields.timestamp ? <div style={{fontSize: '11px', color: '#5f6b7c', marginBottom: '4px'}}>{resolveKey(item, fields.timestamp)}</div> : null}
                        {fields.title ? <div style={{fontWeight: 600, color: '#182026', marginBottom: '4px'}}>{resolveKey(item, fields.title)}</div> : null}
                        {fields.body ? <div style={{fontSize: '13px', lineHeight: 1.5, color: '#30404d'}}>{resolveKey(item, fields.body)}</div> : null}
                    </div>
                ))}
            </div>
        </Panel>
    );
}

export function DashboardBadges({container, context}) {
    const metricsData = useMetrics(context);
    const items = container.dashboard?.badges?.items || container.items || [];
    const dashboardFilterSignal = context?.dashboardKey ? getDashboardFilterSignal(context.dashboardKey) : null;
    const dashboardSelectionSignal = context?.dashboardKey ? getDashboardSelectionSignal(context.dashboardKey) : null;
    const dashboardFilters = useSignalSnapshot(dashboardFilterSignal, {});
    const dashboardSelection = useSignalSnapshot(dashboardSelectionSignal, {});
    const interpolationScope = {
        ...(metricsData || {}),
        metrics: metricsData || {},
        filters: dashboardFilters || {},
        selection: dashboardSelection || {},
    };

    return (
        <Panel container={container}>
            <div style={{display: 'flex', flexWrap: 'wrap', gap: '8px'}}>
                {items.map((item, index) => {
                    const tone = toneColors[item.tone || item.severity] || toneColors.info;
                    const label = interpolateDashboardTemplate(item.label, interpolationScope);
                    const value = interpolateDashboardTemplate(item.value, interpolationScope);
                    const text = value ? `${label}: ${value}` : label;
                    return (
                        <span
                            key={item.id || text || index}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '12px',
                                fontWeight: 600,
                                color: tone.text,
                                background: tone.background,
                                border: `1px solid ${tone.border}`,
                                borderRadius: '999px',
                                padding: '4px 10px',
                            }}
                        >
                            {text}
                        </span>
                    );
                })}
            </div>
        </Panel>
    );
}

export function DashboardReport({container, context}) {
    const metricsData = useMetrics(context);
    const sections = container.dashboard?.report?.sections || container.sections || [];
    const dashboardFilterSignal = context?.dashboardKey ? getDashboardFilterSignal(context.dashboardKey) : null;
    const dashboardSelectionSignal = context?.dashboardKey ? getDashboardSelectionSignal(context.dashboardKey) : null;
    const dashboardFilters = useSignalSnapshot(dashboardFilterSignal, {});
    const dashboardSelection = useSignalSnapshot(dashboardSelectionSignal, {});
    const interpolationScope = {
        ...metricsData,
        metrics: metricsData,
        filters: dashboardFilters,
        selection: dashboardSelection,
    };
    const conditionSnapshot = createDashboardConditionSnapshot({
        context: {
            ...context,
            signals: {
                ...context?.signals,
                metrics: {value: metricsData},
            },
        },
        dashboardKey: context?.dashboardKey,
        metrics: metricsData,
        dashboardFilters,
        dashboardSelection,
    });
    const visibleSections = sections.filter((section) => evaluateDashboardCondition(section.visibleWhen, {
        ...conditionSnapshot,
    }));

    return (
        <Panel container={container}>
            <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                {visibleSections.map((section, index) => {
                    const tone = toneColors[section.tone] || toneColors.info;
                    const rawBody = section.body;
                    const bodyItems = Array.isArray(rawBody)
                        ? rawBody
                        : rawBody == null || rawBody === ''
                            ? []
                            : [rawBody];
                    return (
                        <div
                            key={section.id || section.title || index}
                            style={{border: `1px solid ${tone.border}`, background: tone.background, color: tone.text, borderRadius: '8px', padding: '12px'}}
                        >
                            {section.title ? <div style={{fontWeight: 700, marginBottom: '6px'}}>{interpolateDashboardTemplate(section.title, interpolationScope)}</div> : null}
                            {bodyItems.map((paragraph, bodyIndex) => (
                                <p key={bodyIndex} style={{margin: bodyIndex === 0 ? '0 0 8px' : '0 0 8px', lineHeight: 1.5}}>
                                    {interpolateDashboardTemplate(paragraph, interpolationScope)}
                                </p>
                            ))}
                        </div>
                    );
                })}
            </div>
        </Panel>
    );
}

function getDashboardReportRuntimeConfig(container = {}) {
    const direct = container?.reportRuntime;
    if (direct && typeof direct === 'object' && !Array.isArray(direct)) {
        return direct;
    }
    const nested = container?.dashboard?.reportRuntime;
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
        return nested;
    }
    return {};
}

export function DashboardReportRuntime({container, context}) {
    const config = getDashboardReportRuntimeConfig(container);
    const reportSpec = config.reportSpec || EMPTY_REPORT_RUNTIME_SPEC;
    const runtimeHandlers = useMemo(() => resolveDashboardReportRuntimeHandlers({
        context,
        reportSpec,
    }), [context?.handlers?.reportRuntime, context?.handlers?.semanticModel, reportSpec]);
    return (
        <ReportRuntime
            reportSpec={reportSpec}
            reportFill={config.reportFill || {}}
            title={config.title || container?.title || ""}
            subtitle={config.subtitle || container?.subtitle || ""}
            locale={config.locale || getDashboardLocale(context)}
            hostIntent={config.hostIntent || null}
            runtimeHandlers={runtimeHandlers}
        />
    );
}

export function DashboardDetail({container, context, children}) {
    const visibleChildren = React.Children.toArray(children).filter((child) => {
        if (!React.isValidElement(child)) {
            return true;
        }
        const childContainer = child.props?.container;
        const visibleWhen = getDashboardVisibleWhen(childContainer);
        if (!visibleWhen) {
            return true;
        }
        const childContext = child.props?.context || context;
        return evaluateDashboardCondition(visibleWhen, {
            context: childContext,
            dashboardKey: childContext?.dashboardKey || context?.dashboardKey,
        });
    });

    return <Panel container={container}>{visibleChildren}</Panel>;
}

export function DashboardChart({container, context, isActive}) {
    return (
        <Panel container={container}>
            <Chart container={container} context={context} isActive={isActive} embedded={false}/>
        </Panel>
    );
}

export function DashboardComposition({container, context, isActive}) {
    const {collection = [], control, selection} = context?.signals || {};
    const collectionValue = useSignalSnapshot(collection, []);
    const dashboardFilterSignal = context?.dashboardKey ? getDashboardFilterSignal(context.dashboardKey) : null;
    const dashboardSelectionSignal = context?.dashboardKey ? getDashboardSelectionSignal(context.dashboardKey) : null;
    const dashboardFilters = useSignalSnapshot(dashboardFilterSignal, {});
    const dashboardSelection = useSignalSnapshot(dashboardSelectionSignal, {});
    const filteredCollection = useMemo(() => {
        const afterFilters = applyDashboardFiltersToCollection(collectionValue || [], container.filterBindings, dashboardFilters);
        return applyDashboardSelectionToCollection(afterFilters, container.selectionBindings, dashboardSelection);
    }, [collectionValue, container.filterBindings, container.selectionBindings, dashboardFilters, dashboardSelection]);
    const chart = container.chart || {};
    const categoryKey = chart.categoryKey || chart.nameKey || chart.series?.nameKey || container.categoryKey || "name";
    const valueKey = chart.valueKey || chart.series?.valueKey || container.valueKey || "value";
    const chartType = chart.type || container.type || "donut";
    const palette = chart.palette || chart.series?.palette || [
        "#2367d1",
        "#16865a",
        "#b76b00",
        "#7a4cc2",
        "#c43c36",
        "#1787a6",
    ];
    const normalizedContainer = {
        ...container,
        chart: {
            ...chart,
            type: chartType,
            xAxis: chart.xAxis || {dataKey: categoryKey, label: chart.categoryLabel || container.categoryLabel || titleizeDashboardKey(categoryKey)},
            series: {
                ...(chart.series || {}),
                nameKey: categoryKey,
                valueKey,
                palette,
            },
        },
    };
    const filteredContext = useMemo(() => ({
        ...context,
        signals: {
            ...context?.signals,
            collection: {
                value: filteredCollection,
                peek: () => filteredCollection,
            },
            control,
            selection,
        },
    }), [context, filteredCollection, control, selection]);
    const total = filteredCollection.reduce((sum, row) => sum + (Number(resolveKey(row, valueKey)) || 0), 0);
    const legendRows = [...filteredCollection]
        .sort((a, b) => Number(resolveKey(b, valueKey) || 0) - Number(resolveKey(a, valueKey) || 0))
        .slice(0, container.legendLimit || 6);

    return (
        <Panel container={container}>
            <div className="forge-dashboard-composition">
                <div className="forge-dashboard-composition-chart">
                    <Chart container={normalizedContainer} context={filteredContext} isActive={isActive} embedded={true}/>
                </div>
                <div className="forge-dashboard-composition-legend">
                    {legendRows.map((row, index) => {
                        const value = Number(resolveKey(row, valueKey)) || 0;
                        const pct = total > 0 ? `${((value / total) * 100).toFixed(0)}%` : "0%";
                        return (
                            <div className="forge-dashboard-composition-legend-row" key={`${resolveKey(row, categoryKey) || index}`}>
                                <span className="forge-dashboard-composition-swatch" style={{background: palette[index % palette.length]}}/>
                                <strong>{resolveKey(row, categoryKey) ?? "-"}</strong>
                                <span>{formatDashboardValue(value, chart.format || container.format, getDashboardLocale(context))} · {pct}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </Panel>
    );
}

export function DashboardTable({container, context}) {
    return (
        <Panel container={container}>
            <DashboardTableContent
                container={container}
                context={context}
                locale={getDashboardLocale(context)}
                subtitleStyle={subtitleStyle}
            />
        </Panel>
    );
}

export function DashboardEditableTable({container, context, embedded = false}) {
    useSignals();
    const dataSourceRef = String(container?.dataSourceRef || '').trim();
    const dataSource = dataSourceRef ? context?.Context?.(dataSourceRef)?.handlers?.dataSource : null;
    const [revision, setRevision] = useState(0);
    const [filterText, setFilterText] = useState('');
    const [page, setPage] = useState(1);
    const currentRows = () => dataSource?.peekFullCollection?.() || dataSource?.peekCollection?.() || [];
    const rows = currentRows();
    const columns = Array.isArray(container?.columns) ? container.columns : [];
    const runtimeColumns = useMemo(() => buildTableRuntimeColumns(columns, rows), [columns, rows]);
    const tableColumns = useMemo(() => withFrozenIdentifierColumn(runtimeColumns), [runtimeColumns]);
    const pageSize = Math.max(1, Number(container?.pageSize || 20));
    const normalizedFilter = filterText.trim().toLowerCase();
    const filteredEntries = rows.map((row, index) => ({row, index})).filter(({row}) => !normalizedFilter || columns.some((column) => (
        displayLookupValue(row?.[column.key]).toLowerCase().includes(normalizedFilter)
    )));
    const pageCount = Math.max(1, Math.ceil(filteredEntries.length / pageSize));
    const currentPage = Math.min(page, pageCount);
    const visibleEntries = filteredEntries.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const commit = (nextRows) => {
        dataSource?.replaceCollection?.({rows: nextRows, selectAll: true});
        setRevision((value) => value + 1);
    };
    const updateCell = (rowIndex, key, value) => commit(currentRows().map((row, index) => (
        index === rowIndex ? {...row, [key]: value} : row
    )));
    const addRow = () => {
        const latest = currentRows();
        commit([...latest, {...(container?.addRow?.defaults || {})}]);
        setPage(Math.ceil((latest.length + 1) / pageSize));
    };
    const removeRow = (rowIndex) => commit(currentRows().filter((_, index) => index !== rowIndex));
    const frequencyParts = (value) => {
        const match = String(value || '').trim().match(/^(\d+(?:\.\d+)?)\s+per\s+(\d+(?:\.\d+)?)\s+(hour|day|week)s?$/i);
        return match ? {count: match[1], interval: match[2], unit: match[3].toLowerCase()} : {count: '', interval: '1', unit: 'day'};
    };
    const setFrequencyPart = (rowIndex, column, part, nextValue) => {
        const next = {...frequencyParts(currentRows()[rowIndex]?.[column.key]), [part]: nextValue};
        updateCell(rowIndex, column.key, next.count ? `${next.count} per ${next.interval || 1} ${next.unit || 'day'}` : '');
    };
    const editableCellStyle = (row, column) => {
        const visual = resolveTableCellVisualState(row, column);
        if (!visual || !['dataBar', 'progressBar', 'sparkBar'].includes(visual.kind)) return undefined;
        const pct = Math.round(Math.max(0, Math.min(1, Number(visual.percent || 0))) * 100);
        const color = visual.palette?.[0] || 'rgba(56, 87, 214, .16)';
        return {backgroundImage: `linear-gradient(90deg, ${color} 0%, ${color} ${pct}%, #fff ${pct}%, #fff 100%)`};
    };

    const content = (
            <div className="forge-editable-collection" data-revision={revision}>
                <div className="forge-editable-collection__toolbar">
                    {container?.quickFilter !== false ? <input className="forge-editable-collection__filter" type="search" value={filterText} placeholder={embedded ? `Filter selected ${String(container?.selectedFilterLabel || container?.title || 'rows').toLowerCase()}…` : `Filter ${String(container?.title || 'collection').toLowerCase()} rows…`} aria-label={embedded ? `Filter selected ${container?.selectedFilterLabel || container?.title || 'rows'}` : `Filter ${container?.title || 'collection'} rows`} onChange={(event) => { setFilterText(event.target.value); setPage(1); }}/> : null}
                    <span>{filteredEntries.length} of {rows.length} {rows.length === 1 ? 'row' : 'rows'}</span>
                    {container?.allowAdd !== false ? (
                        <button type="button" className="forge-editable-collection__icon-action" aria-label={container?.addRow?.label || 'Add row'} title={container?.addRow?.label || 'Add row'} onClick={addRow}><Icon icon="plus" size={14}/></button>
                    ) : null}
                </div>
                <div className="forge-editable-collection__table-wrap">
                    <table className="forge-editable-collection__table forge-editable-collection__table--frozen-identifier">
                        <thead><tr>{tableColumns.map((column) => <th key={column.key} className={column.frozen ? 'forge-table-frozen-identifier' : undefined} style={column.frozen ? {'--forge-frozen-column-width': `${column.resolvedCompactWidth}px`} : undefined}>{column.label || column.key}</th>)}<th aria-label="Row actions"/></tr></thead>
                        <tbody>
                            {visibleEntries.map(({row, index: rowIndex}) => (
                                <tr key={rowIndex}>
                                    {tableColumns.map((column) => {
                                        const editor = column.editor === false ? null : (column.editor || {type: 'text'});
                                        const value = row?.[column.key] ?? '';
                                        return (
                                            <td key={column.key} className={column.frozen ? 'forge-table-frozen-identifier' : undefined} style={column.frozen ? {'--forge-frozen-column-width': `${column.resolvedCompactWidth}px`} : undefined}>
                                                {!editor ? <span>{formatDashboardValue(value, column.format, getDashboardLocale(context))}</span>
                                                    : editor.type === 'frequency' ? (() => {
                                                        const parts = frequencyParts(value);
                                                        return <div className="forge-frequency-editor">
                                                            <input aria-label={`${column.label || column.key} count row ${rowIndex + 1}`} type="number" min="1" value={parts.count} placeholder="—" onChange={(event) => setFrequencyPart(rowIndex, column, 'count', event.target.value)}/>
                                                            <span>per</span>
                                                            <input aria-label={`${column.label || column.key} interval row ${rowIndex + 1}`} type="number" min="1" value={parts.interval} onChange={(event) => setFrequencyPart(rowIndex, column, 'interval', event.target.value)}/>
                                                            <select aria-label={`${column.label || column.key} unit row ${rowIndex + 1}`} value={parts.unit} onChange={(event) => setFrequencyPart(rowIndex, column, 'unit', event.target.value)}>
                                                                {(editor.units || ['hour', 'day', 'week']).map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                                                            </select>
                                                        </div>;
                                                    })()
                                                    : editor.type === 'select' ? (
                                                        <select aria-label={`${column.label || column.key} row ${rowIndex + 1}`} value={value}
                                                            onChange={(event) => updateCell(rowIndex, column.key, event.target.value)}>
                                                            {(editor.options || []).map((option) => {
                                                                const normalized = option && typeof option === 'object' ? option : {label: option, value: option};
                                                                return <option key={normalized.value} value={normalized.value}>{normalized.label}</option>;
                                                            })}
                                                        </select>
                                                    ) : /rationale|reason|description/i.test(`${column.key} ${column.label || ''}`) ? (
                                                        <textarea aria-label={`${column.label || column.key} row ${rowIndex + 1}`}
                                                            rows={1}
                                                            ref={(node) => {
                                                                if (!node) return;
                                                                node.style.height = 'auto';
                                                                node.style.height = `${node.scrollHeight}px`;
                                                            }}
                                                            style={editableCellStyle(row, column)}
                                                            value={value} placeholder={editor.placeholder || ''}
                                                            onChange={(event) => {
                                                                event.currentTarget.style.height = 'auto';
                                                                event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`;
                                                                updateCell(rowIndex, column.key, event.target.value);
                                                            }}/>
                                                    ) : (
                                                        <input aria-label={`${column.label || column.key} row ${rowIndex + 1}`}
                                                            type={editor.type === 'number' ? 'number' : editor.type === 'time' ? 'time' : 'text'}
                                                            style={editableCellStyle(row, column)}
                                                            value={editor.type === 'tags' && Array.isArray(value) ? value.join(', ') : value} placeholder={editor.placeholder || ''}
                                                            onChange={(event) => updateCell(rowIndex, column.key,
                                                                editor.type === 'number' ? Number(event.target.value)
                                                                    : editor.type === 'tags' ? event.target.value.split(',').map((entry) => entry.trim()).filter(Boolean)
                                                                        : event.target.value)}/>
                                                    )}
                                            </td>
                                        );
                                    })}
                                    <td className="forge-editable-collection__actions">
                                        <button type="button" aria-label={`${container?.removeRowLabel || 'Remove row'} ${rowIndex + 1}`} title={container?.removeRowLabel || 'Remove row'} onClick={() => removeRow(rowIndex)}><Icon icon="trash" size={14}/></button>
                                    </td>
                                </tr>
                            ))}
                            {visibleEntries.length === 0 ? <tr><td colSpan={columns.length + 1} className="forge-editable-collection__empty">{rows.length === 0 ? (container?.emptyText || 'No rows yet. Add one to begin.') : 'No matching rows.'}</td></tr> : null}
                        </tbody>
                    </table>
                </div>
                {pageCount > 1 ? <div className="forge-editable-collection__pager">
                    <button type="button" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
                    <span>Page {currentPage} of {pageCount}</span>
                    <button type="button" disabled={currentPage >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>Next</button>
                </div> : null}
            </div>
    );
    return embedded ? content : <Panel container={container}>{content}</Panel>;
}

function valueAtPath(value, path = '') {
    return String(path || '').split('.').filter(Boolean).reduce((current, key) => (
        current && typeof current === 'object' ? current[key] : undefined
    ), value);
}

function displayLookupValue(value) {
    if (Array.isArray(value)) return value.map(displayLookupValue).filter(Boolean).join(' > ');
    if (value && typeof value === 'object') return displayLookupValue(value.label ?? value.name ?? value.value ?? '');
    return value == null ? '' : String(value);
}

function lookupRowLabel(row, preferredField = 'label') {
    for (const field of [preferredField, 'label', 'displayPath', 'path', 'name', 'value']) {
        const candidate = displayLookupValue(valueAtPath(row, field));
        if (candidate) return candidate;
    }
    return '';
}

function setLookupInput(target = {}, path = '', value) {
    const result = JSON.parse(JSON.stringify(target || {}));
    const parts = String(path || '').split('.').filter(Boolean);
    let current = result;
    parts.forEach((part, index) => {
        if (index === parts.length - 1) current[part] = value;
        else {
            current[part] = current[part] && typeof current[part] === 'object' ? current[part] : {};
            current = current[part];
        }
    });
    return result;
}

function mapLookupRow(row, mapping = {}) {
    return Object.fromEntries(Object.entries(mapping || {}).map(([target, source]) => {
        if (source && typeof source === 'object' && Object.prototype.hasOwnProperty.call(source, 'value')) {
            return [target, source.value];
        }
        if (source && typeof source === 'object' && Array.isArray(source.firstOf)) {
            const value = source.firstOf.map((path) => valueAtPath(row, path)).find((candidate) => displayLookupValue(candidate));
            return [target, displayLookupValue(value)];
        }
        return [target, valueAtPath(row, source)];
    }));
}

/**
 * Generic lookup-backed chip editor. The host owns lookup transport and the
 * workspace owns datasource IDs, inputs, providers, and result mappings.
 */
export function DashboardLookupChips({container, context}) {
    useSignals();
    const dataSourceRef = String(container?.dataSourceRef || '').trim();
    const dataSourceContext = dataSourceRef ? context?.Context?.(dataSourceRef) : null;
    const dataSource = dataSourceContext?.handlers?.dataSource;
    const lookupService = context?.handlers?.lookup;
    const config = container?.lookup || {};
    const providers = Array.isArray(config.providers) ? config.providers : [];
    const [providerId, setProviderId] = useState(String(config.defaultProvider || providers[0]?.id || ''));
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [drillStack, setDrillStack] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [revision, setRevision] = useState(0);
    const currentRows = () => dataSource?.peekFullCollection?.() || dataSource?.peekCollection?.() || [];
    const rows = currentRows();
    const reactiveSelection = dataSourceContext?.signals?.selection?.value?.selection;
    const selectedCount = Array.isArray(reactiveSelection) ? reactiveSelection.length : rows.length;
    const valueField = String(config.valueField || 'value');
    const labelField = String(config.labelField || 'label');
    const showSelectionChips = String(config.selectionPresentation || 'chips').toLowerCase() !== 'table';
    const selections = showSelectionChips ? (Array.isArray(rows) ? rows : []).map((row) => ({
        value: valueAtPath(row, config.selectionValueField || 'id'),
        label: valueAtPath(row, config.selectionLabelField || 'name') || valueAtPath(row, config.selectionValueField || 'id'),
    })) : [];
    const activeProvider = providers.find((provider) => String(provider?.id || '') === providerId) || providers[0] || {};
    const mapResult = (row) => {
        const mapped = mapLookupRow(row, config.resultMapping || {id: valueField, name: labelField});
        if (activeProvider?.id && config.providerField) mapped[config.providerField] = activeProvider.id;
        if (activeProvider?.label && config.providerLabelField) mapped[config.providerLabelField] = activeProvider.label;
        return mapped;
    };
    const omitSelectedResults = (found = []) => {
        const keyField = config.selectionValueField || 'id';
        const existingKeys = new Set(currentRows().map((row) => String(valueAtPath(row, keyField) ?? '')).filter(Boolean));
        return (Array.isArray(found) ? found : []).filter((row) => {
            const key = String(valueAtPath(mapResult(row), keyField) ?? '');
            return !key || !existingKeys.has(key);
        });
    };

    const search = async () => {
        const minimumQueryLength = Number(config.minQueryLength || 0);
        if (minimumQueryLength > 0 && String(query || '').trim().length < minimumQueryLength) {
            setResults([]);
            setError(`Enter at least ${minimumQueryLength} characters to search.`);
            return;
        }
        if (Array.isArray(config.options)) {
            const normalizedQuery = String(query || '').trim().toLowerCase();
            const existingKeys = new Set(rows.map((row) => String(valueAtPath(row, config.selectionValueField || 'id') ?? '')));
            const found = config.options.map((option) => option && typeof option === 'object' ? option : {label: option, value: option})
                .filter((option) => !existingKeys.has(String(option.value ?? '')))
                .filter((option) => !normalizedQuery || String(option.label || option.value || '').toLowerCase().includes(normalizedQuery));
            setError('');
            setResults(found);
            return;
        }
        if (typeof lookupService?.search !== 'function') {
            setError('Lookup service is unavailable.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const found = await lookupService.search({
                dataSourceRef: config.dataSourceRef,
                query,
                queryInput: config.queryInput,
                inputs: {...(config.inputs || {}), ...(activeProvider.inputs || {})},
                inputBindings: config.inputBindings || {},
                timeoutMs: config.timeoutMs,
            });
            setResults(omitSelectedResults(found));
        } catch (searchError) {
            setResults([]);
            setError(String(searchError?.message || searchError || 'Lookup failed.'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!query.trim() || config.searchAsYouType === false) return undefined;
        const timeout = setTimeout(search, Number(config.debounceMs || 250));
        return () => clearTimeout(timeout);
    // The provider is intentionally part of the lookup query identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query, providerId]);

    const addResult = (row) => {
        const latestRows = currentRows();
        const mapped = mapResult(row);
        const key = String(valueAtPath(mapped, config.selectionValueField || 'id') ?? '');
        const next = key && latestRows.some((item) => String(valueAtPath(item, config.selectionValueField || 'id') ?? '') === key)
            ? latestRows
            : [...latestRows, mapped];
        dataSource?.replaceCollection?.({rows: next, selectAll: true});
        setQuery('');
        setResults([]);
        setRevision((value) => value + 1);
    };

    const drillInto = async (row) => {
        const drill = config.drill && typeof config.drill === 'object' ? config.drill : null;
        if (!drill?.dataSourceRef) return;
        const rawNodeValue = valueAtPath(row, drill.valueField || valueField);
        const typedNodeValue = drill.valueType === 'number' ? Number(rawNodeValue) : rawNodeValue;
        const nodeValue = drill.wrapArray ? [typedNodeValue] : typedNodeValue;
        const nodeID = drill.namespace ? {namespace: drill.namespace, id: nodeValue} : nodeValue;
        setLoading(true);
        setError('');
        try {
            const inputs = setLookupInput(
                {...(config.inputs || {}), ...(activeProvider.inputs || {}), ...(drill.inputs || {})},
                drill.idInput || 'Body.treeLookupParam.id',
                nodeID,
            );
            const children = await lookupService.search({
                dataSourceRef: drill.dataSourceRef,
                inputs,
                inputBindings: config.inputBindings || {},
            });
            setDrillStack((stack) => [...stack, {row, results}]);
            setResults(Array.isArray(children) ? children : []);
            setQuery('');
        } catch (drillError) {
            setError(String(drillError?.message || drillError || 'Could not load children.'));
        } finally {
            setLoading(false);
        }
    };

    const drillBack = () => {
        setDrillStack((stack) => {
            const previous = stack[stack.length - 1];
            if (previous) setResults(previous.results || []);
            return stack.slice(0, -1);
        });
    };

    const removeSelection = (index) => {
        dataSource?.replaceCollection?.({rows: currentRows().filter((_, rowIndex) => rowIndex !== index), selectAll: true});
        setRevision((value) => value + 1);
    };

    return (
        <Panel container={container}>
            <div className="forge-dashboard-lookup-chips" data-revision={revision}>
                {providers.length > 1 ? (
                    <label className="forge-dashboard-lookup-chips__provider">
                        <span>{config.providerLabel || 'Provider'}</span>
                        <select value={providerId} onChange={(event) => { setProviderId(event.target.value); setResults([]); }}>
                            {providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.label || provider.id}</option>)}
                        </select>
                    </label>
                ) : null}
                <LookupSelectionInput
                    selections={selections}
                    inputValue={query}
                    placeholder={config.placeholder || 'Search and add'}
                    browseLabel={loading ? 'Searching' : (config.browseLabel || 'Search')}
                    allowManualEntry
                    disabled={loading}
                    onInputChange={setQuery}
                    onInputCommit={search}
                    onBrowse={search}
                    onRemoveSelection={removeSelection}
                />
                {!showSelectionChips ? <div className="forge-dashboard-lookup-chips__count">{selectedCount} selected {selectedCount === 1 ? 'item' : 'items'}</div> : null}
                {error ? <div className="forge-dashboard-lookup-chips__error" role="alert">{error}</div> : null}
                {drillStack.length > 0 ? (
                    <div className="forge-dashboard-lookup-chips__breadcrumb">
                        <button type="button" onClick={drillBack}><Icon icon="chevron-left" size={14}/>Back</button>
                        <span>{drillStack.map((entry) => lookupRowLabel(entry.row, labelField)).join(' / ')}</span>
                    </div>
                ) : null}
                {results.length > 0 ? (
                    <div className="forge-dashboard-lookup-chips__results" role="listbox" aria-label={config.resultsLabel || 'Lookup results'}>
                        {results.slice(0, Number(config.resultLimit || 12)).map((row, index) => {
                            const activeLabelField = drillStack.length > 0 ? (config.drill?.resultLabelField || labelField) : labelField;
                            const activeValueField = drillStack.length > 0 ? (config.drill?.resultValueField || valueField) : valueField;
                            const resultLabel = lookupRowLabel(row, activeLabelField) || displayLookupValue(valueAtPath(row, activeValueField));
                            const canDrill = !!config.drill?.dataSourceRef && drillStack.length < Number(config.drill?.maxDepth || 1);
                            return (
                            <div className="forge-dashboard-lookup-chips__result" key={`${valueAtPath(row, activeValueField) ?? index}`} role="option">
                                {!(config.drill?.rootOnlyAdd && drillStack.length > 0) ? (
                                    <button className="forge-dashboard-lookup-chips__result-add" type="button" onClick={() => addResult(row)}>
                                        <Icon icon="plus" size={14}/>
                                        <span><strong>{resultLabel}</strong>{activeProvider?.label ? <small>{activeProvider.label}</small> : null}</span>
                                    </button>
                                ) : <span className="forge-dashboard-lookup-chips__result-label"><strong>{resultLabel}</strong></span>}
                                {canDrill ? (
                                    <button className="forge-dashboard-lookup-chips__result-drill" type="button" aria-label={`View children of ${resultLabel}`} onClick={() => drillInto(row)}>
                                        <Icon icon="chevron-right" size={14}/>
                                    </button>
                                ) : null}
                            </div>
                        );})}
                    </div>
                ) : null}
                {!loading && !error && query.trim() && results.length === 0 ? <div className="forge-dashboard-lookup-chips__empty">No matching options.</div> : null}
                {Array.isArray(container.columns) && container.columns.length > 0 ? (
                    <div className="forge-dashboard-lookup-chips__selection">
                        {container?.editableRows === true ? (
                            <DashboardEditableTable
                                embedded
                                container={{...container, selectedFilterLabel: container.title, title: '', subtitle: '', allowAdd: false, quickFilter: container.quickFilter !== false}}
                                context={context}
                            />
                        ) : (
                            <DashboardTableContent
                                container={{...container, title: '', subtitle: '', quickFilter: container.quickFilter !== false, selectionLabelField: config.selectionLabelField}}
                                context={context}
                                locale={getDashboardLocale(context)}
                                subtitleStyle={subtitleStyle}
                            />
                        )}
                    </div>
                ) : null}
            </div>
        </Panel>
    );
}

export function DashboardBlock({container, context, isActive, children}) {
    let content = null;
    switch (container.kind) {
        case 'dashboard.summary':
            content = <DashboardSummary container={container} context={context}/>;
            break;
        case 'dashboard.compare':
            content = <DashboardCompare container={container} context={context}/>;
            break;
        case 'dashboard.kpiTable':
            content = <DashboardKPITable container={container} context={context}/>;
            break;
        case 'dashboard.filters':
            content = <DashboardFilters container={container} context={context}/>;
            break;
        case 'dashboard.geoMap':
            content = <DashboardGeoMap container={container} context={context}/>;
            break;
        case 'dashboard.timeline':
            content = <DashboardTimeline container={container} context={context} isActive={isActive}/>;
            break;
        case 'dashboard.chart':
            content = <DashboardChart container={container} context={context} isActive={isActive}/>;
            break;
        case 'dashboard.composition':
            content = <DashboardComposition container={container} context={context} isActive={isActive}/>;
            break;
        case 'dashboard.dimensions':
            content = <DashboardDimensions container={container} context={context}/>;
            break;
        case 'dashboard.messages':
            content = <DashboardMessages container={container} context={context}/>;
            break;
        case 'dashboard.status':
            content = <DashboardStatus container={container} context={context}/>;
            break;
        case 'dashboard.feed':
            content = <DashboardFeed container={container} context={context}/>;
            break;
        case 'dashboard.badges':
            content = <DashboardBadges container={container} context={context}/>;
            break;
        case 'dashboard.report':
            content = <DashboardReport container={container} context={context}/>;
            break;
        case 'dashboard.reportRuntime':
            content = <DashboardReportRuntime container={container} context={context}/>;
            break;
        case 'dashboard.reportBuilder':
            content = <ReportBuilder container={container} context={context}/>;
            break;
        case 'dashboard.reportCatalog':
            content = <ReportCatalog container={container} context={context}/>;
            break;
        case 'dashboard.table':
            content = <DashboardTable container={container} context={context}/>;
            break;
        case 'dashboard.editableTable':
            content = <DashboardEditableTable container={container} context={context}/>;
            break;
        case 'dashboard.lookupChips':
            content = <DashboardLookupChips container={container} context={context}/>;
            break;
        case 'dashboard.detail':
            content = <DashboardDetail container={container} context={context}>{children}</DashboardDetail>;
            break;
        default:
            content = null;
            break;
    }
    return (
        <DashboardErrorBoundary
            container={container}
            wrapperComponent={Panel}
            subtitleStyle={subtitleStyle}
        >
            {content}
        </DashboardErrorBoundary>
    );
}
