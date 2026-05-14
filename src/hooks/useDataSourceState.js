// useDataSourceState.js – unified helper to subscribe to core DataSource signals
// and expose plain React state values (collection, loading, error, selection).

import { useEffect, useState } from 'react';
import { useSignalEffect } from '@preact/signals-react';
import { getLogger } from '../utils/logger.js';

/**
 * Small wrapper that converts Forge runtime signals to ordinary React state so
 * widgets can subscribe with a single hook instead of repeating boiler-plate.
 *
 * @param {object} context – runtime context provided by Container/Forge.
 * @returns {{collection:Array, loading:boolean, error:any, selection:Object}}
 */
export function useDataSourceState(context) {
    const log = getLogger('ds-state');
    const { signals } = context || {};
    if (!signals) {
        throw new Error('useDataSourceState expects a Forge context with signals');
    }

    const { collection, control, selection } = signals;

    const [data, setData]           = useState(collection.peek() || []);
    const [flags, setFlags]         = useState(() => {
        const { loading = false, error = null } = control.peek() || {};
        return { loading, error };
    });
    const [sel, setSel]             = useState(selection?.peek?.());

    useEffect(() => {
        const nextData = collection.peek() || [];
        const { loading = false, error = null } = control.peek() || {};
        const nextSelection = selection?.peek?.();
        try {
            log.debug('[useDataSourceState] source changed', {
                ds: context?.identity?.dataSourceRef,
                rows: Array.isArray(nextData) ? nextData.length : undefined,
                loading,
                hasError: !!error,
            });
        } catch (_) {}
        setData(nextData);
        setFlags({ loading, error });
        setSel(nextSelection);
    }, [collection, control, selection, context?.identity?.dataSourceRef]);

    // keep data in sync
    useSignalEffect(() => {
        setData(collection.value || []);
    });

    // keep loading / error in sync
    useSignalEffect(() => {
        const { loading = false, error = null } = control.value || {};
        setFlags({ loading, error });
    });

    // keep selection in sync (optional)
    useSignalEffect(() => {
        setSel(selection?.value);
    });

    return { collection: data, ...flags, selection: sel };
}
