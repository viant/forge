// Separate helper component extracted from WindowContent to respect React
// Rules of Hooks (always rendered, applies initial params once).

import React, {useEffect, useRef} from 'react';

import DataSource from './DataSource.jsx';
import MessageBus from './MessageBus.jsx';

export default function WindowContentDataSourceContainer({windowContext, dsKey, initialParams = {}}) {
    // Ensure the first hook in this component is always useRef so ordering is stable
    const appliedRef = useRef(false);
    // Call Context next; it may use hooks internally, but ordering remains consistent
    const dsContext = windowContext.Context(dsKey);

    // Apply initial parameters exactly once per dsContext instance.
    useEffect(() => {
        if (appliedRef.current) return;
        appliedRef.current = true;
        if (!initialParams) return;
        try { console.log('[forge][ds] apply initialParams', dsKey, Date.now(), initialParams); } catch(_) {}

        Object.entries(initialParams).forEach(([k, v]) => {
            if (k === 'filter' || k === 'parameters') {
                const input = dsContext.signals.input;
                input.value = {...input.peek(), [k]: v};
                return;
            }
            const signal = dsContext.signals[k];
            if (signal) {
                signal.value = v;
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dsContext, initialParams, dsKey]);

    return (
        <>
            {(() => { try { console.log('[forge][ds] mount', dsKey, Date.now()); } catch(_) {} return null; })()}
            <DataSource context={dsContext}/>
            <MessageBus context={dsContext}/>
        </>
    );
}
