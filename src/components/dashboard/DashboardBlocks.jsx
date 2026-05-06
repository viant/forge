import React, {useMemo, useState} from 'react';
import {useSignalEffect} from '@preact/signals-react';
import {useDataSourceState} from "../../hooks/useDataSourceState.js";
import Chart from "../Chart.jsx";
import {resolveKey} from "../../utils/selector.js";
import {applyDashboardFiltersToCollection, applyDashboardSelectionToCollection, buildDashboardDefaultFilters, createDashboardConditionSnapshot, evaluateDashboardCondition, formatDashboardDelta, formatDashboardValue, getDashboardToneName, getDashboardVisibleWhen, interpolateDashboardTemplate, publishDashboardSelection} from "./dashboardUtils.js";
import {getDashboardFilterSignal, getDashboardSelectionSignal} from "../../core/store/signals.js";
import {matchingRules, mergeClassNames, mergeStyles, normalizeRuleList} from "../table/formattingRules.js";
import {aggregateGeoRows, buildGeoConfig, DEFAULT_GEO_PALETTE, findGeoColorRule, normalizeGeoKey, resolveGeoColor, US_STATE_TILES} from "./geoMapUtils.js";
import "./Dashboard.css";

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

const toneColors = {
    info: {background: '#ebf1f5', border: '#ced9e0', text: '#30404d'},
    warning: {background: '#fff5d6', border: '#f5c542', text: '#8a5d00'},
    danger: {background: '#fdecea', border: '#db3737', text: '#a82a2a'},
    success: {background: '#eef8f0', border: '#0f9960', text: '#0a6640'},
};

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

function titleizeDashboardKey(value = '') {
    return String(value || '')
        .replace(/[_-]+/g, ' ')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (match) => match.toUpperCase());
}

function deltaTone(delta, positiveIsUp = true) {
    if (delta == null || Number.isNaN(Number(delta)) || Number(delta) === 0) {
        return toneColors.info;
    }
    const isPositive = Number(delta) > 0;
    const isGood = positiveIsUp ? isPositive : !isPositive;
    return isGood ? toneColors.success : toneColors.danger;
}

function isDashboardStatusValue(value = '') {
    const normalized = String(value || '').trim().toLowerCase();
    return [
        'behind',
        'ahead',
        'on_track',
        'on track',
        'underpacing',
        'overpacing',
        'healthy',
        'warning',
        'watch',
        'critical',
        'active',
        'inactive',
    ].includes(normalized);
}

function dashboardStatusTone(value = '') {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'ahead' || normalized === 'on_track' || normalized === 'on track' || normalized === 'healthy' || normalized === 'active') {
        return toneColors.success;
    }
    if (normalized === 'behind' || normalized === 'underpacing' || normalized === 'critical' || normalized === 'inactive') {
        return toneColors.danger;
    }
    return toneColors.warning;
}

function renderDashboardTableCell(cell, column, locale) {
    if (typeof cell === 'number') {
        return formatDashboardValue(cell, column?.format, locale);
    }
    const text = String(cell ?? '-');
    if (isDashboardStatusValue(text)) {
        const tone = dashboardStatusTone(text);
        return (
            <span style={{fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', color: tone.text, background: tone.background, border: `1px solid ${tone.border}`, borderRadius: '999px', padding: '2px 8px'}}>
                {text.replace(/_/g, ' ')}
            </span>
        );
    }
    return text;
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
    const metrics = container.dashboard?.summary?.metrics || container.metrics || [];
    const metricCards = Array.isArray(metrics)
        ? metrics.map((metric) => ({
            key: metric.id || metric.selector,
            label: metric.label,
            value: resolveKey(metricsData, metric.selector),
            format: metric.format,
        }))
        : metrics && typeof metrics === 'object'
            ? Object.entries(metrics).map(([key, value]) => ({
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
                            <div className="forge-dashboard-metric-label">{metric.label}</div>
                            {isStatus ? (
                                <div>
                                    <span style={{display: 'inline-flex', alignItems: 'center', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: tone.text, background: tone.background, border: `1px solid ${tone.border}`, borderRadius: '999px', padding: '5px 10px'}}>
                                        {String(metric.value || '').replace(/_/g, ' ')}
                                    </span>
                                </div>
                            ) : (
                                <div className="forge-dashboard-metric-value">{formatDashboardValue(metric.value, metric.format, locale)}</div>
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
                                                {renderDashboardTableCell(cell, normalizedColumns[cellIndex], locale)}
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
                                <th style={{textAlign: 'right', borderBottom: '1px solid #d8e1e8', padding: '8px'}}>Context</th>
                            </tr>
                            </thead>
                            <tbody>
                            {rows.map((row, index) => {
                                const tone = toneColors[row.contextTone] || toneColors.info;
                                const value = resolveKey(metricsData, row.value);
                                return (
                                    <tr key={row.id || row.label || index}>
                                        <td style={{padding: '8px', borderBottom: '1px solid #ebf1f5', fontWeight: 600}}>{row.label}</td>
                                        <td style={{padding: '8px', textAlign: 'right', borderBottom: '1px solid #ebf1f5'}}>{formatDashboardValue(value, row.format, locale)}</td>
                                        <td style={{padding: '8px', textAlign: 'right', borderBottom: '1px solid #ebf1f5'}}>
                                            {row.context ? (
                                                <span style={{fontSize: '12px', color: tone.text, background: tone.background, border: `1px solid ${tone.border}`, borderRadius: '999px', padding: '2px 8px'}}>
                                                    {row.context}
                                                </span>
                                            ) : '-'}
                                        </td>
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

    if (!chartContainer.chart) {
        return (
            <Panel container={container}>
                <div style={subtitleStyle}>Timeline blocks require `container.chart`.</div>
            </Panel>
        );
    }

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
    const dimensionKey = dimension.key;
    const metric = dimensionsConfig.metric || container.metric || {};
    const metricKey = metric.key;
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

class DashboardErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = {error: null};
    }

    static getDerivedStateFromError(error) {
        return {error};
    }

    componentDidCatch(error, info) {
        console.error('dashboard block render failed', this.props?.container?.id, error, info);
    }

    render() {
        if (this.state.error) {
            return (
                <Panel container={this.props.container}>
                    <div style={{...subtitleStyle, color: '#a82a2a'}}>
                        Failed to render dashboard block{this.props.container?.title ? `: ${this.props.container.title}` : '.'}
                    </div>
                </Panel>
            );
        }
        return this.props.children;
    }
}

export function DashboardTable({container, context}) {
    const locale = getDashboardLocale(context);
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
        return {key, label: col?.label || titleizeDashboardKey(key), format: col?.format, align: col?.align};
    }).filter((col) => !!col.key), [rawColumns]);

    const filteredCollection = useMemo(() => {
        const afterFilters = applyDashboardFiltersToCollection(collection || [], container.filterBindings, dashboardFilters);
        return applyDashboardSelectionToCollection(afterFilters, container.selectionBindings, dashboardSelection);
    }, [collection, container.filterBindings, container.selectionBindings, dashboardFilters, dashboardSelection]);

    const quickFilteredCollection = useMemo(() => {
        const query = quickFilter.trim().toLowerCase();
        if (!query) return filteredCollection;
        return filteredCollection.filter((row) => normalizedColumns.some((col) => {
            const value = resolveKey(row, col.key);
            return String(value ?? '').toLowerCase().includes(query);
        }));
    }, [filteredCollection, normalizedColumns, quickFilter]);

    const [sortKey, setSortKey] = useState(null);
    const [sortDir, setSortDir] = useState('asc');

    const sortedRows = useMemo(() => {
        const rows = quickFilteredCollection.slice(0, limit);
        if (!sortKey) return rows;
        return [...rows].sort((a, b) => {
            const av = a?.[sortKey];
            const bv = b?.[sortKey];
            const an = Number(av);
            const bn = Number(bv);
            const numeric = Number.isFinite(an) && Number.isFinite(bn);
            const cmp = numeric ? an - bn : String(av ?? '').localeCompare(String(bv ?? ''));
            return sortDir === 'desc' ? -cmp : cmp;
        });
    }, [quickFilteredCollection, limit, sortKey, sortDir]);

    const handleSort = (key) => {
        if (sortKey === key) {
            setSortDir((prev) => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const handleRowAction = (action, row, rowIndex) => {
        publishDashboardSelection({
            context,
            dimension: action.dimension || action.field || normalizedColumns[0]?.key,
            entityKey: action.field ? resolveKey(row, action.field) : resolveKey(row, normalizedColumns[0]?.key),
            selected: row,
            sourceBlockId: container.id,
        });
        if (action.handler && typeof context?.lookupHandler === 'function') {
            const fn = context.lookupHandler(action.handler);
            if (typeof fn === 'function') {
                fn({execution: action, context, item: row, rowIndex});
            }
        }
    };

    return (
        <Panel container={container}>
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
                            {normalizedColumns.map((col) => {
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
                                    {normalizedColumns.map((col, ci) => {
                                        const cellRules = matchingRules(row, formattingRules, "cell", col.key);
                                        const cellStyle = {...rowStyle, ...mergeStyles(cellRules), textAlign: col.align || 'left'};
                                        const cellClassName = [rowClassName, mergeClassNames(cellRules)].filter(Boolean).join(" ");
                                        return (
                                            <td key={`${index}-${ci}`} className={cellClassName} style={cellStyle}>
                                                {renderDashboardTableCell(resolveKey(row, col.key), col, locale)}
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
        case 'dashboard.table':
            content = <DashboardTable container={container} context={context}/>;
            break;
        case 'dashboard.detail':
            content = <DashboardDetail container={container} context={context}>{children}</DashboardDetail>;
            break;
        default:
            content = null;
            break;
    }
    return <DashboardErrorBoundary container={container}>{content}</DashboardErrorBoundary>;
}
