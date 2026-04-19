// Separate helper component extracted from WindowContent to respect React
// Rules of Hooks (always rendered, applies initial params once).

import React, {useEffect, useRef} from 'react';
import { getLogger } from "../utils/logger.js";

import DataSource from './DataSource.jsx';
import MessageBus from './MessageBus.jsx';

function DataSourceMount({ windowContext, dsKey, initialParams }) {
    const log = getLogger('ds');
    // Guard hook order: ensure the first hook is always useRef
    const firstHookGuard = useRef(true);
    // All hooks for the DS live here, ensuring stable ordering within this component
    const dsContext = (typeof windowContext.useDsContext === 'function')
        ? windowContext.useDsContext(dsKey)
        : windowContext.Context(dsKey);
    const appliedSignatureRef = useRef('');

    useEffect(() => {
        if (!initialParams) return;
        const signature = JSON.stringify(initialParams);
        if (appliedSignatureRef.current === signature) return;
        appliedSignatureRef.current = signature;
        try { log.debug('[ds-mount] initialParams', { ds: dsKey, initial: initialParams }); } catch(_) {}
        Object.entries(initialParams).forEach(([k, v]) => {
            if (k === 'filter' || k === 'parameters') {
                const input = dsContext.signals.input;
                const prev = input.peek();
                input.value = { ...prev, [k]: v, fetch: true };
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
