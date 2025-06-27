// Separate helper component extracted from WindowContent to respect React
// Rules of Hooks (always rendered, applies initial params once).

import React, {useEffect} from 'react';

import DataSource from './DataSource.jsx';
import MessageBus from './MessageBus.jsx';

export default function WindowContentDataSourceContainer({windowContext, dsKey, initialParams = {}}) {
    // Call Context exactly once to avoid violating Rules of Hooks when cached paths skip hooks.
    const dsContextRef = React.useRef(null);
    if (!dsContextRef.current) {
        dsContextRef.current = windowContext.Context(dsKey);
    }
    const dsContext = dsContextRef.current;

    // Apply initial parameters exactly once when dsContext stabilises.
    useEffect(() => {
        if (!initialParams) return;

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
    }, [dsContext]);

    return (
        <>
            <DataSource context={dsContext}/>
            <MessageBus context={dsContext}/>
        </>
    );
}
