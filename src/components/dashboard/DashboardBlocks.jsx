import React, {useMemo, useState} from 'react';
import {useSignalEffect} from '@preact/signals-react';
import {useDataSourceState} from "../../hooks/useDataSourceState.js";
import Chart from "../Chart.jsx";
import {resolveKey} from "../../utils/selector.js";
import {applyDashboardFiltersToCollection, buildDashboardDefaultFilters, createDashboardConditionSnapshot, evaluateDashboardCondition, formatDashboardValue, getDashboardToneName, interpolateDashboardTemplate, publishDashboardSelection} from "./dashboardUtils.js";
import {getDashboardFilterSignal, getDashboardSelectionSignal} from "../../core/store/signals.js";

const panelStyle = {
    width: '100%',
    height: '100%',
    minHeight: 0,
    minWidth: 0,
    padding: '16px',
    border: '1px solid #d8e1e8',
    borderRadius: '10px',
    background: '#ffffff',
    boxShadow: '0 1px 2px rgba(16, 22, 26, 0.08)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    boxSizing: 'border-box',
};

const titleStyle = {
    fontSize: '16px',
    fontWeight: 600,
    color: '#182026',
    margin: 0,
};

const subtitleStyle = {
    fontSize: '12px',
    color: '#5f6b7c',
    margin: 0,
};

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

function deltaTone(delta, positiveIsUp = true) {
    if (delta == null || Number.isNaN(Number(delta)) || Number(delta) === 0) {
        return toneColors.info;
    }
    const isPositive = Number(delta) > 0;
    const isGood = positiveIsUp ? isPositive : !isPositive;
    return isGood ? toneColors.success : toneColors.danger;
}

function formatDelta(value, format = 'number') {
    if (value == null) {
        return '-';
    }
    const numeric = Number(value) || 0;
    const absolute = Math.abs(numeric);

    switch (format) {
        case 'percentDelta':
            return `${numeric >= 0 ? '+' : '-'}${absolute.toFixed(1)}%`;
        case 'compactNumberDelta':
            return `${numeric >= 0 ? '+' : '-'}${new Intl.NumberFormat('en-US', {notation: 'compact', maximumFractionDigits: 1}).format(absolute)}`;
        case 'currencyDelta':
            return `${numeric >= 0 ? '+' : '-'}${new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD', maximumFractionDigits: 0}).format(absolute)}`;
        case 'numberDelta':
        case 'number':
        default:
            return `${numeric >= 0 ? '+' : '-'}${new Intl.NumberFormat('en-US', {maximumFractionDigits: 2}).format(absolute)}`;
    }
}

function Panel({container, children, actions = null}) {
    return (
        <div style={panelStyle}>
            {(container.title || actions) ? (
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px'}}>
                    <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                        {container.title ? <h3 style={titleStyle}>{container.title}</h3> : null}
                        {container.subtitle ? <p style={subtitleStyle}>{container.subtitle}</p> : null}
                    </div>
                    {actions}
                </div>
            ) : null}
            <div style={{display: 'flex', flexDirection: 'column', gap: '12px', flex: '1 1 auto', minHeight: 0}}>
                {children}
            </div>
        </div>
    );
}

export function DashboardSummary({container, context}) {
    const metricsData = useMetrics(context);
    const locale = getDashboardLocale(context);
    const metrics = container.metrics || container.dashboard?.summary?.metrics || [];

    return (
        <Panel container={container}>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px'}}>
                {metrics.map((metric) => {
                    const value = resolveKey(metricsData, metric.selector);
                    return (
                        <div
                            key={metric.id || metric.selector}
                            style={{border: '1px solid #d8e1e8', borderRadius: '8px', padding: '12px', background: '#f8fafb'}}
                        >
                            <div style={{fontSize: '12px', color: '#5f6b7c', marginBottom: '6px'}}>{metric.label}</div>
                            <div style={{fontSize: '24px', fontWeight: 700, color: '#182026'}}>{formatDashboardValue(value, metric.format, locale)}</div>
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
    const items = container.items || container.dashboard?.compare?.items || [];

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
                            style={{border: '1px solid #d8e1e8', borderRadius: '8px', padding: '12px', background: '#f8fafb', display: 'flex', flexDirection: 'column', gap: '8px'}}
                        >
                            <div style={{fontSize: '12px', color: '#5f6b7c'}}>{item.label}</div>
                            <div style={{fontSize: '24px', fontWeight: 700, color: '#182026'}}>{formatDashboardValue(currentValue, item.format, locale)}</div>
                            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px'}}>
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
                                    {formatDelta(delta, item.deltaFormat || `${item.format || 'number'}Delta`)}
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
    const rows = container.rows || container.dashboard?.kpiTable?.rows || [];

    return (
        <Panel container={container}>
            <div style={{overflow: 'auto'}}>
                <table style={{width: '100%', borderCollapse: 'collapse'}}>
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
                </table>
            </div>
        </Panel>
    );
}

export function DashboardFilters({container, context}) {
    const items = container.items || container.dashboard?.filters?.items || [];
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

    return (
        <Panel container={container}>
            <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                {items.map((item) => {
                    const field = item.field || item.id;
                    const current = filters?.[field];
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

export function DashboardTimeline({container, context, isActive}) {
    if (!container.chart) {
        return (
            <Panel container={container}>
                <div style={subtitleStyle}>Timeline blocks require `container.chart`.</div>
            </Panel>
        );
    }

    const dashboardFilterSignal = context?.dashboardKey ? getDashboardFilterSignal(context.dashboardKey) : null;
    const dashboardFilters = useSignalSnapshot(dashboardFilterSignal, {});
    const {collection = [], control, selection} = context?.signals || {};
    const collectionValue = useSignalSnapshot(collection, []);
    const filteredCollection = useMemo(
        () => applyDashboardFiltersToCollection(collectionValue || [], container.filterBindings, dashboardFilters),
        [collectionValue, container.filterBindings, dashboardFilters],
    );
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
            <div style={{flex: '1 1 auto', minHeight: '320px'}}>
                <Chart container={container} context={filteredContext} isActive={isActive} embedded={true}/>
            </div>
        </Panel>
    );
}

export function DashboardDimensions({container, context}) {
    const {collection, loading, error, selection} = useDataSourceState(context);
    const locale = getDashboardLocale(context);
    const [viewMode, setViewMode] = useState((container.viewModes || [])[0] || 'chart');
    const [dashboardSelection, setDashboardSelection] = useState(
        context?.dashboardKey ? getDashboardSelectionSignal(context.dashboardKey).peek() : null,
    );
    const limit = container.limit || 10;
    const dimensionKey = container.dimension?.key;
    const metric = container.metric || {};
    const metricKey = metric.key;
    const metricLabel = metric.label || metricKey;

    useSignalEffect(() => {
        if (!context?.dashboardKey) {
            return;
        }
        setDashboardSelection(getDashboardSelectionSignal(context.dashboardKey).value);
    });

    const dashboardFilterSignal = context?.dashboardKey ? getDashboardFilterSignal(context.dashboardKey) : null;
    const dashboardFilters = useSignalSnapshot(dashboardFilterSignal, {});
    const filteredCollection = useMemo(
        () => applyDashboardFiltersToCollection(collection || [], container.filterBindings, dashboardFilters),
        [collection, container.filterBindings, dashboardFilters],
    );

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
            actions={(container.viewModes || []).length > 1 ? (
                <div style={{display: 'flex', gap: '8px'}}>
                    {(container.viewModes || []).map((mode) => (
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
                                key={`${row?.[dimensionKey] || index}`}
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
                        return (
                            <button
                                key={`${row?.[dimensionKey] || index}`}
                                type="button"
                                onClick={() => onSelect(row, index)}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '6px',
                                    border: isSelected ? '1px solid #137cbd' : '1px solid #d8e1e8',
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
                                    <div style={{height: '100%', width, background: '#137cbd'}}/>
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
    const items = container.items || container.dashboard?.messages?.items || [];
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
    const visibleItems = items.filter((item) => evaluateDashboardCondition(item.visibleWhen, {
        ...conditionSnapshot,
    }));

    return (
        <Panel container={container}>
            {visibleItems.length === 0 ? <div style={subtitleStyle}>No active messages.</div> : null}
            {visibleItems.map((item, index) => {
                const tone = toneColors[item.severity] || toneColors.info;
                return (
                    <div
                        key={`${item.title || item.body || index}`}
                        style={{padding: '12px', borderRadius: '8px', border: `1px solid ${tone.border}`, background: tone.background, color: tone.text}}
                    >
                        {item.title ? <div style={{fontWeight: 700, marginBottom: '4px'}}>{interpolateDashboardTemplate(item.title, interpolationScope)}</div> : null}
                        <div style={{fontSize: '13px', lineHeight: 1.5}}>{interpolateDashboardTemplate(item.body, interpolationScope)}</div>
                    </div>
                );
            })}
        </Panel>
    );
}

export function DashboardStatus({container, context}) {
    const metricsData = useMetrics(context);
    const locale = getDashboardLocale(context);
    const checks = container.checks || container.dashboard?.status?.checks || [];

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
    const dashboardFilters = useSignalSnapshot(dashboardFilterSignal, {});
    const items = useMemo(
        () => applyDashboardFiltersToCollection(collection || [], container.filterBindings, dashboardFilters),
        [collection, container.filterBindings, dashboardFilters],
    );
    const fields = container.fields || container.dashboard?.feed?.fields || {};

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

export function DashboardReport({container, context}) {
    const metricsData = useMetrics(context);
    const sections = container.sections || container.dashboard?.report?.sections || [];
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
                    return (
                        <div
                            key={section.id || section.title || index}
                            style={{border: `1px solid ${tone.border}`, background: tone.background, color: tone.text, borderRadius: '8px', padding: '12px'}}
                        >
                            {section.title ? <div style={{fontWeight: 700, marginBottom: '6px'}}>{interpolateDashboardTemplate(section.title, interpolationScope)}</div> : null}
                            {(section.body || []).map((paragraph, bodyIndex) => (
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
        if (!childContainer?.visibleWhen) {
            return true;
        }
        const childContext = child.props?.context || context;
        return evaluateDashboardCondition(childContainer.visibleWhen, {
            context: childContext,
            dashboardKey: childContext?.dashboardKey || context?.dashboardKey,
        });
    });

    return <Panel container={container}>{visibleChildren}</Panel>;
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

export function DashboardBlock({container, context, isActive, children}) {
    switch (container.kind) {
        case 'dashboard.summary':
            return <DashboardSummary container={container} context={context}/>;
        case 'dashboard.compare':
            return <DashboardCompare container={container} context={context}/>;
        case 'dashboard.kpiTable':
            return <DashboardKPITable container={container} context={context}/>;
        case 'dashboard.filters':
            return <DashboardFilters container={container} context={context}/>;
        case 'dashboard.timeline':
            return <DashboardTimeline container={container} context={context} isActive={isActive}/>;
        case 'dashboard.dimensions':
            return <DashboardDimensions container={container} context={context}/>;
        case 'dashboard.messages':
            return <DashboardMessages container={container} context={context}/>;
        case 'dashboard.status':
            return <DashboardStatus container={container} context={context}/>;
        case 'dashboard.feed':
            return <DashboardFeed container={container} context={context}/>;
        case 'dashboard.report':
            return <DashboardReport container={container} context={context}/>;
        case 'dashboard.detail':
            return <DashboardErrorBoundary container={container}><DashboardDetail container={container} context={context}>{children}</DashboardDetail></DashboardErrorBoundary>;
        default:
            return null;
    }
}
