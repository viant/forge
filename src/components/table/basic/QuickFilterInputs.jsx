import NativeControlTarget from '../../../runtime/NativeControlTarget.jsx';
import React from 'react';
import { InputGroup, ControlGroup, HTMLSelect, Icon } from '@blueprintjs/core';
import {
    resolveQuickFilterSet,
    isQuickFiltersActive,
    mirrorQuickFilterDraft,
    normalizeQuickFilterValues,
} from './QuickFilterHelpers.js';

const QUICK_FILTER_DEBOUNCE_MS = 350;

export default function QuickFilterInputs({ context, align = 'right' }) {
    const { handlers, signals } = context || {};
    const { input } = signals || {};

    const set = resolveQuickFilterSet(context);
    if (!set) return null;

    const filters = set.filters || [];
    const fieldSelectorMode = set.mode === 'fieldSelector' && filters.length > 1;
    const initialField = filters.some((filter) => filter.field === set.defaultField)
        ? set.defaultField
        : filters[0]?.field;
    const [selectedField, setSelectedField] = React.useState(initialField);
    const currentFilter = handlers?.dataSource?.peekFilter?.() || {};
    const currentFilterKey = JSON.stringify(currentFilter);

    // Local state for input values so that we don't mutate dataSource on every keypress.
    const [values, setValues] = React.useState(() => {
        return normalizeQuickFilterValues(filters, currentFilter);
    });
    const valuesRef = React.useRef(values);
    const commitTimerRef = React.useRef(null);
    const pendingFetchValuesRef = React.useRef(null);

    // Keep local state in sync if external filter is changed (e.g. by toggle button)
    React.useEffect(() => {
        const snapshot = normalizeQuickFilterValues(filters, currentFilter);
        valuesRef.current = snapshot;
        setValues(snapshot);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentFilterKey]);

    React.useEffect(() => {
        return () => {
            if (commitTimerRef.current) {
                clearTimeout(commitTimerRef.current);
            }
            pendingFetchValuesRef.current = null;
        };
    }, []);

    const fetchFirstPage = React.useCallback(() => {
        if (typeof handlers?.dataSource?.setPage === 'function') {
            return handlers.dataSource.setPage(1);
        }
        return handlers?.dataSource?.fetchCollection?.();
    }, [handlers]);

    const mirrorValues = React.useCallback(
        (newValues) => {
            const normalized = mirrorQuickFilterDraft(
                filters,
                newValues,
                handlers?.dataSource?.setSilentFilterValues,
            );
            valuesRef.current = normalized;
            return normalized;
        },
        [handlers, filters]
    );

    const commitValues = React.useCallback(
        (newValues) => {
            if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
            commitTimerRef.current = null;
            mirrorValues(newValues);
            pendingFetchValuesRef.current = null;
            return fetchFirstPage();
        },
        [fetchFirstPage, mirrorValues]
    );

    const scheduleCommit = React.useCallback(
        (nextValues) => {
            if (commitTimerRef.current) {
                clearTimeout(commitTimerRef.current);
            }
            pendingFetchValuesRef.current = normalizeQuickFilterValues(filters, nextValues);
            commitTimerRef.current = setTimeout(() => {
                commitTimerRef.current = null;
                if (!pendingFetchValuesRef.current) return;
                pendingFetchValuesRef.current = null;
                return fetchFirstPage();
            }, QUICK_FILTER_DEBOUNCE_MS);
        },
        [fetchFirstPage, filters]
    );

    const flushCommit = React.useCallback(
        (nextValues = valuesRef.current) => {
            if (!commitTimerRef.current && !pendingFetchValuesRef.current) return;
            if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
            commitTimerRef.current = null;
            mirrorValues(nextValues);
            pendingFetchValuesRef.current = null;
            return fetchFirstPage();
        },
        [fetchFirstPage, mirrorValues]
    );

    const handleChange = (field) => (e) => {
        const val = e?.target?.value ?? e;
        const nextValues = {
            ...valuesRef.current,
            [field]: val,
        };
        valuesRef.current = nextValues;
        setValues(nextValues);
        scheduleCommit(mirrorValues(nextValues));
    };

    // Determine whether any quick filter value is currently active
    const active = isQuickFiltersActive(context, filters);

    // Cache previous filter values so we can restore them on re-activation
    const cacheRef = React.useRef({});

    const toggleFilters = React.useCallback(
        (e) => {
            e?.preventDefault?.();
            e?.stopPropagation?.();

            if (active) {
                // Save current values, clear inputs
                cacheRef.current = { ...values };
                const clearedVals = {};
                filters.forEach((f) => (clearedVals[f.field] = ''));
                setValues(clearedVals);
                return commitValues(clearedVals);
            } else {
                const restored = { ...values, ...cacheRef.current };
                setValues(restored);
                return commitValues(restored);
            }
        },
        [active, values, commitValues, filters]
    );

    const handleSelectedFieldChange = React.useCallback((event) => {
        const nextField = event?.target?.value || filters[0]?.field;
        const clearedValues = {};
        filters.forEach((filter) => {
            clearedValues[filter.field] = '';
        });
        valuesRef.current = clearedValues;
        setValues(clearedValues);
        setSelectedField(nextField);
        return commitValues(clearedValues);
    }, [commitValues, filters]);

    const renderFilterInput = (filter, index = 0) => {
        const value = values[filter.field] ?? '';
        const showToggle = index === 0;
        const iconName = active ? 'filter-remove' : filter.icon || 'filter';
        return (
            <NativeControlTarget key={filter.field} context={context} item={{id:`quickFilter:${filter.field}`,type:'text',dataField:filter.field,label:filter.label || filter.field}} value={value} validate={next=>typeof next==='string'?null:'string filter required'} actions={{setValue:({value})=>{handleChange(filter.field)(value);return flushCommit();}}}><InputGroup
                leftElement={
                    showToggle ? (
                        <NativeControlTarget context={context} item={{id:'quickFilter:toggle',type:'button',label:'Toggle quick filters'}} actions={{click:({event})=>toggleFilters(event)}}><span
                            onClick={toggleFilters}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 22,
                                cursor: 'pointer',
                                margin: '7px 3px',
                            }}
                        >
                            <Icon icon={iconName} size={12} />
                        </span></NativeControlTarget>
                    ) : undefined
                }
                placeholder={filter.placeholder || filter.field}
                value={value}
                onChange={handleChange(filter.field)}
                onBlur={() => flushCommit()}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        flushCommit();
                    }
                }}
                style={{ width: filter.width || 140 }}
            /></NativeControlTarget>
        );
    };

    if (fieldSelectorMode) {
        const activeFilter = filters.find((filter) => filter.field === selectedField) || filters[0];
        return (
            <ControlGroup
                fill
                className="bp4-small forge-quick-filter forge-quick-filter--field-selector"
                style={{ marginRight: align === 'left' ? 8 : 0, marginLeft: align !== 'left' ? 8 : 0 }}
            >
                <NativeControlTarget context={context} item={{id:'quickFilter:field',type:'select',label:'Filter field'}} value={activeFilter.field} options={filters.map(filter=>({value:filter.field,label:filter.label || filter.field}))} validate={value=>filters.some(filter=>filter.field===value)?null:'Filter field unavailable'} actions={{setValue:({value})=>handleSelectedFieldChange({target:{value}})}}><HTMLSelect
                    aria-label="Filter field"
                    value={activeFilter.field}
                    onChange={handleSelectedFieldChange}
                    options={filters.map((filter) => ({
                        label: filter.optionLabel || filter.label || filter.field,
                        value: filter.field,
                    }))}
                /></NativeControlTarget>
                {renderFilterInput(activeFilter)}
            </ControlGroup>
        );
    }

    return (
        <ControlGroup fill className="bp4-small" style={{ marginRight: align === 'left' ? 8 : 0, marginLeft: align !== 'left' ? 8 : 0 }}>
            {filters.map((filter, index) => renderFilterInput(filter, index))}
        </ControlGroup>
    );
}
