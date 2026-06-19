import React from 'react';
import { InputGroup, ControlGroup, Icon } from '@blueprintjs/core';
import {
    resolveQuickFilterSet,
    isQuickFiltersActive,
    normalizeQuickFilterValues,
    quickFilterValuesEqual,
} from './QuickFilterHelpers.js';

const QUICK_FILTER_DEBOUNCE_MS = 350;

export default function QuickFilterInputs({ context, align = 'right' }) {
    const { handlers, signals } = context || {};
    const { input } = signals || {};

    const set = resolveQuickFilterSet(context);
    if (!set) return null;

    const filters = set.filters || [];
    const currentFilter = handlers?.dataSource?.peekFilter?.() || {};
    const currentFilterKey = JSON.stringify(currentFilter);

    // Local state for input values so that we don't mutate dataSource on every keypress.
    const [values, setValues] = React.useState(() => {
        return normalizeQuickFilterValues(filters, currentFilter);
    });
    const valuesRef = React.useRef(values);
    const commitTimerRef = React.useRef(null);
    const lastCommittedRef = React.useRef(normalizeQuickFilterValues(filters, currentFilter));

    // Keep local state in sync if external filter is changed (e.g. by toggle button)
    React.useEffect(() => {
        const snapshot = normalizeQuickFilterValues(filters, currentFilter);
        valuesRef.current = snapshot;
        lastCommittedRef.current = snapshot;
        setValues(snapshot);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentFilterKey]);

    React.useEffect(() => {
        return () => {
            if (commitTimerRef.current) {
                clearTimeout(commitTimerRef.current);
            }
        };
    }, []);

    const fetchFirstPage = React.useCallback(() => {
        if (typeof handlers?.dataSource?.setPage === 'function') {
            handlers.dataSource.setPage(1);
            return;
        }
        handlers?.dataSource?.fetchCollection?.();
    }, [handlers]);

    const commitValues = React.useCallback(
        (newValues) => {
            const normalized = normalizeQuickFilterValues(filters, newValues);
            valuesRef.current = normalized;
            if (quickFilterValuesEqual(filters, normalized, lastCommittedRef.current)) {
                return;
            }
            lastCommittedRef.current = normalized;
            handlers?.dataSource?.setSilentFilterValues?.({ filter: normalized });
            fetchFirstPage();
        },
        [fetchFirstPage, handlers, filters]
    );

    const scheduleCommit = React.useCallback(
        (nextValues) => {
            if (commitTimerRef.current) {
                clearTimeout(commitTimerRef.current);
            }
            commitTimerRef.current = setTimeout(() => {
                commitTimerRef.current = null;
                commitValues(nextValues);
            }, QUICK_FILTER_DEBOUNCE_MS);
        },
        [commitValues]
    );

    const flushCommit = React.useCallback(
        (nextValues = valuesRef.current) => {
            if (commitTimerRef.current) {
                clearTimeout(commitTimerRef.current);
                commitTimerRef.current = null;
            }
            commitValues(nextValues);
        },
        [commitValues]
    );

    const handleChange = (field) => (e) => {
        const val = e?.target?.value ?? e;
        const nextValues = {
            ...valuesRef.current,
            [field]: val,
        };
        valuesRef.current = nextValues;
        setValues(nextValues);
        scheduleCommit(nextValues);
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
                commitValues(clearedVals);
            } else {
                const restored = { ...values, ...cacheRef.current };
                setValues(restored);
                commitValues(restored);
            }
        },
        [active, values, commitValues, filters]
    );

    return (
        <ControlGroup fill className="bp4-small" style={{ marginRight: align === 'left' ? 8 : 0, marginLeft: align !== 'left' ? 8 : 0 }}>
            {filters.map((f, idx) => {
                const value = values[f.field] ?? '';
                const showToggle = idx === 0; // only first field gets toggle icon
                const iconName = active ? 'filter-remove' : f.icon || 'filter';

                return (
                    <InputGroup
                        key={f.field}
                        leftElement={
                            showToggle ? (
                                <span
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
                                </span>
                            ) : undefined
                        }
                        placeholder={f.placeholder || f.field}
                        value={value}
                        onChange={handleChange(f.field)}
                        onBlur={() => flushCommit()}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                flushCommit();
                            }
                        }}
                        style={{ width: f.width || 140 }}
                    />
                );
            })}
        </ControlGroup>
    );
}
