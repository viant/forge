import React from 'react';
import { InputGroup, Button } from '@blueprintjs/core';
import { openLookup } from '../../utils/lookup.js';

export default function TextLookup(props) {
    const { value = '', readOnly, context, item, adapter, ...rest } = props;

    const handleOpen = async () => {
        try {
            await openLookup({ item, context, adapter });
        } catch (e) {
            console.error('lookup failed', e);
        }
    };

    return (
        <InputGroup
            {...rest}
            value={value ?? ''}
            readOnly
            rightElement={<Button icon="search" minimal onClick={handleOpen} />}
        />
    );
}
