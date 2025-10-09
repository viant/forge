import React from 'react';
import { InputGroup, Button } from '@blueprintjs/core';
import { openLookup } from '../../utils/lookup.js';

export default function TextLookup(props) {
    const { value = '', readOnly, context, item, adapter, ...rest } = props;

    const handleOpen = async () => {
        try {
            await openLookup({ item, context, adapter, value });
        } catch (e) {
            console.error('lookup failed', e);
        }
    };

    // Optional visual customisation via metadata:
    //  - item.lookup.intent (primary|success|warning|danger)
    //  - item.intent (fallback)
    //  - item.properties.style (inline CSS)
    const intent = (item?.lookup?.intent) || item?.intent || rest?.intent;
    const defaultLookupStyle = { backgroundColor: '#f0fff4', borderColor: '#c6f6d5' };
    // Apply a gentle default style for lookups; allow explicit style to override
    const inputStyle = { ...defaultLookupStyle, ...(rest?.style || {}) };

    return (
        <InputGroup
            {...rest}
            intent={intent}
            style={inputStyle}
            value={value ?? ''}
            readOnly={readOnly}
            onChange={(e) => {
                const v = e?.target?.value ?? e;
                try { adapter.set(v); } catch (_) {}
            }}
            rightElement={<Button icon="search" minimal onClick={handleOpen} />}
        />
    );
}
