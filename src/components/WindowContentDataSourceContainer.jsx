// Separate helper component extracted from WindowContent to respect React
// Rules of Hooks (always rendered, applies initial params once).

import React, {useEffect, useRef} from 'react';

import DataSource from './DataSource.jsx';
import MessageBus from './MessageBus.jsx';

function DataSourceMount({ windowContext, dsKey, initialParams }) {
    // Guard hook order: ensure the first hook is always useRef
    const firstHookGuard = useRef(true);
    // All hooks for the DS live here, ensuring stable ordering within this component
    const dsContext = (typeof windowContext.useDsContext === 'function')
        ? windowContext.useDsContext(dsKey)
        : windowContext.Context(dsKey);
    const appliedRef = useRef(false);

    useEffect(() => {
        if (appliedRef.current) return;
        appliedRef.current = true;
        if (!initialParams) return;
        Object.entries(initialParams).forEach(([k, v]) => {
            if (k === 'filter' || k === 'parameters') {
                const input = dsContext.signals.input;
                input.value = { ...input.peek(), [k]: v };
                return;
            }
            const signal = dsContext.signals[k];
            if (signal) {
                signal.value = v;
            }
        });
    }, [dsContext, initialParams, dsKey]);

    return (
        <>
            <DataSource context={dsContext} />
            <MessageBus context={dsContext} />
        </>
    );
}

export default function WindowContentDataSourceContainer({windowContext, dsKey, initialParams = {}}) {
    // No hooks here – delegate to child that has a stable hook order
    return <DataSourceMount windowContext={windowContext} dsKey={dsKey} initialParams={initialParams} />;
}
