// useDataSourceState.js – unified helper to subscribe to core DataSource signals
// and expose a plain snapshot (collection, loading, error, selection).

import { useEffect } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { getLogger } from '../utils/logger.js';

/**
 * Small wrapper that converts Forge runtime signals to ordinary React state so
 * widgets can subscribe with a single hook instead of repeating boiler-plate.
 *
 * @param {object} context – runtime context provided by Container/Forge.
 * @returns {{collection:Array, loading:boolean, error:any, selection:Object}}
 */
export function useDataSourceState(context) {
    useSignals();
    const log = getLogger('ds-state');
    const { signals } = context || {};
    if (!signals) {
        throw new Error('useDataSourceState expects a Forge context with signals');
    }

    const { collection, control, selection } = signals;
    const data = collection?.value || [];
    const { loading = false, error = null } = control?.value || {};
    const sel = selection?.value;

    useEffect(() => {
        try {
            log.debug('[useDataSourceState] source changed', {
                ds: context?.identity?.dataSourceRef,
                rows: Array.isArray(data) ? data.length : undefined,
                loading,
                hasError: !!error,
            });
        } catch (_) {}
    }, [context?.identity?.dataSourceRef, data, loading, error]);

    return { collection: data, loading, error, selection: sel };
}
