import React from 'react';
import { InputGroup, Button } from '@blueprintjs/core';
import { applyLookupSelection, openLookup, resolveLookupValue } from '../../utils/lookup.js';
import { createLookupOpenHandler } from './TextLookupHandlers.js';

export default function TextLookup(props) {
    const { value = '', readOnly, context, item, adapter, ...rest } = props;

    const latest = React.useRef(null);
    latest.current = { item, context, adapter, value };

    const handleOpen = React.useMemo(() => createLookupOpenHandler(latest, openLookup), []);

    const requestTrigger = item?.lookup?.requestTrigger === 'change' ? 'change' : 'blur';
    const requestVersion = React.useRef(0);
    React.useEffect(() => () => { ++requestVersion.current; }, []);
    const resolve = async (raw) => {
        const version = ++requestVersion.current;
        if (readOnly) return;
        if (!item?.lookup?.dataSource || !item?.lookup?.resolveInput) return;
        if (raw == null || String(raw).trim() === '') return;
        try {
            const resolved = await resolveLookupValue({ item, value: raw });
            if (!resolved || version !== requestVersion.current) return;
            applyLookupSelection({
                item,
                context,
                adapter,
                outputs: item?.lookup?.outputs || [],
                record: resolved,
            });
        } catch (e) {
            console.error('lookup resolve failed', e);
        }
    };

    const intent = item?.lookup?.intent || item?.intent || rest?.intent;
    const rightElement = React.useMemo(() => (
        <Button icon="search" minimal onClick={handleOpen} aria-label="Open lookup" disabled={readOnly || rest.disabled} data-forge-part="button" />
    ), [handleOpen]);

    return (
        <InputGroup
            {...rest}
            intent={intent}
            className={[rest.className, 'forge-text-lookup'].filter(Boolean).join(' ')}
            value={value ?? ''}
            readOnly={readOnly}
            onChange={(e) => {
                const v = e?.target?.value ?? e;
                ++requestVersion.current;
                try { adapter.set(v); } catch (_) {}
                if (requestTrigger === 'change') void resolve(v);
            }}
            onBlur={event => {
                rest?.onBlur?.(event);
                if (requestTrigger === 'blur') void resolve(event.target.value);
            }}
            rightElement={rightElement}
        />
    );
}
