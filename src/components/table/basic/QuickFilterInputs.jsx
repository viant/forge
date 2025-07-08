import React from 'react';
import { InputGroup, ControlGroup, Icon } from '@blueprintjs/core';
import { resolveQuickFilterSet, isQuickFiltersActive } from './QuickFilterHelpers.js';

export default function QuickFilterInputs({ context, align = 'right' }) {
    const { handlers, signals } = context || {};
    const { input } = signals || {};

    const set = resolveQuickFilterSet(context);
    if (!set) return null;

    const filters = set.filters || [];
    const currentFilter = handlers?.dataSource?.peekFilter?.() || {};

    // Local state for input values so that we don't mutate dataSource on every keypress.
    const [values, setValues] = React.useState(() => {
        const initial = {};
        filters.forEach((f) => {
            initial[f.field] = currentFilter[f.field] ?? '';
        });
        return initial;
    });

    // Keep local state in sync if external filter is changed (e.g. by toggle button)
    React.useEffect(() => {
        const snapshot = {};
        filters.forEach((f) => {
            snapshot[f.field] = currentFilter[f.field] ?? '';
        });
        setValues(snapshot);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(currentFilter)]);

    const fetch = () => handlers?.dataSource?.fetchCollection?.();

    const commitValues = React.useCallback(
        (newValues) => {
            handlers?.dataSource?.setSilentFilterValues?.({ filter: newValues });
            fetch();
        },
        [handlers]
    );

    const handleChange = (field) => (e) => {
        const val = e?.target?.value ?? e;
        setValues((prev) => ({ ...prev, [field]: val }));
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
                        onBlur={() => commitValues(values)}
                        style={{ width: f.width || 140 }}
                    />
                );
            })}
        </ControlGroup>
    );
}
