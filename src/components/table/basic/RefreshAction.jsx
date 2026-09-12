import React, {useRef, useState} from 'react';
import {Button} from '@blueprintjs/core';
import {useSignals} from '@preact/signals-react/runtime';
import {v4 as uuid} from 'uuid';

export default function RefreshAction({context, item, disabled = false}) {
    useSignals();
    const pending = useRef(false);
    const [requested, setRequested] = useState(false);
    const busy = requested || context?.signals?.control?.value?.loading === true;
    const refresh = async () => {
        if (disabled || pending.current || context?.signals?.control?.peek?.()?.loading) return;
        pending.current = true;
        setRequested(true);
        try {
            await context.handlers.dataSource.fetchCollection({
                cache: {bypassCache: true},
                invocationId: uuid(),
            });
        } catch (error) {
            if (!context?.signals?.control?.peek?.()?.error) context.handlers.dataSource.setError?.(error);
        } finally {
            pending.current = false;
            setRequested(false);
        }
    };
    return <Button type="button" icon="refresh" minimal
        className={['forge-toolbar-action is-icon-only',item.className].filter(Boolean).join(' ')}
        aria-label={item.ariaLabel || 'Refresh data'} title={item.tooltip || 'Refresh data'}
        loading={busy} disabled={disabled || busy} onClick={refresh}/>;
}
