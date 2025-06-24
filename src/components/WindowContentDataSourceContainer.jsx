// Separate helper component extracted from WindowContent to respect React
// Rules of Hooks (always rendered, applies initial params once).

import React, {useEffect} from 'react';

import DataSource from './DataSource.jsx';
import MessageBus from './MessageBus.jsx';

export default function WindowContentDataSourceContainer({windowContext, dsKey, initialParams = {}}) {
    const dsContext = windowContext.Context(dsKey);

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
