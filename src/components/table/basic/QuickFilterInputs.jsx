import React from 'react';
import { InputGroup, ControlGroup } from '@blueprintjs/core';
import { resolveQuickFilterSet } from './QuickFilterHelpers.js';

// Debounce hook
function useDebounce(delay = 300) {
    const ref = React.useRef();
    React.useEffect(() => () => clearTimeout(ref.current), [delay]);
    return (fn) => {
        clearTimeout(ref.current);
        ref.current = setTimeout(fn, delay);
    };
}

export default function QuickFilterInputs({ context, align = 'right' }) {
    const { handlers, signals } = context || {};
    const { input } = signals || {};

    const set = resolveQuickFilterSet(context);
    if (!set) return null;

    const filters = set.filters || [];
    const debounceDefault = set.debounceMs || 300;

    const currentFilter = handlers?.dataSource?.peekFilter?.() || {};

    const runDebounce = useDebounce(debounceDefault);

    const fetch = () => handlers?.dataSource?.fetchCollection?.();

    const handleChange = (field) => (e) => {
        const val = e?.target?.value ?? e;
        handlers?.dataSource?.setSilentFilterValue?.({ item: { id: field, dataField: field }, value: val });
        runDebounce(fetch);
    };

    return (
        <ControlGroup fill className="bp4-small" style={{ marginRight: align === 'left' ? 8 : 0, marginLeft: align !== 'left' ? 8 : 0 }}>
            {filters.map((f) => {
                const value = currentFilter[f.field] ?? '';
                return (
                    <InputGroup
                        key={f.field}
                        leftIcon={f.icon || 'filter'}
                        placeholder={f.placeholder || f.field}
                        value={value}
                        onChange={handleChange(f.field)}
                        style={{ width: f.width || 140 }}
                    />
                );
            })}
        </ControlGroup>
    );
}
