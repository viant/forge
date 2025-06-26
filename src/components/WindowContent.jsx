import React, {useEffect, useMemo, useRef, useState} from 'react';

import {Spinner} from '@blueprintjs/core';

import {
    getMetadataSignal,
    removeWindow,
} from '../core';

import {Context} from '../core';
import {useSetting} from '../core';

import DataSource from './DataSource.jsx';
import MessageBus from './MessageBus.jsx';
import WindowLayout from './WindowLayout.jsx';
import ViewDialog from './ViewDialog.jsx';
import DataSourceContainer from './WindowContentDataSourceContainer.jsx';

import useDataConnector from '../hooks/dataconnector.js';
import {injectActions} from '../actions';


/* ------------------------------------------------------------------
 * WindowContentInner – rendered ONLY after metadata has been fetched so
 * every render executes the same Hook sequence.  All code that calls
 * React hooks (including Context() which internally uses hooks) lives here.
 * ------------------------------------------------------------------ */

function WindowContentInner({window, metadata, services}) {
    const {windowKey, windowData, windowId, parameters = {}} = window;

    // Build Forge context (calls React hooks inside)
    const context = useMemo(() => {
        const dataSources = metadata.dataSource || {};
        const view = metadata.view || {};
        let dsRef = view.dataSourceRef;
        if (!dsRef) {
            dsRef = Object.keys(dataSources)[0];
        }
        const ctx = Context(windowId, metadata, dsRef, services);
        ctx.init();
        return ctx;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [windowId, metadata]);

    /* ------------------------------------------------------------
     * Execute window-level onInit events (declared in metadata.window.on)
     * ---------------------------------------------------------- */

    useEffect(() => {
        const windowCfg   = metadata.window || {};
        const windowOnArr = [
            ...(Array.isArray(windowCfg.on) ? windowCfg.on : []),
            ...(Array.isArray(metadata.on) ? metadata.on : []), // fallback top-level
        ];

        const initEvents = windowOnArr.filter((e) => e.event === 'onInit');
        if (initEvents.length === 0) return;

        initEvents.forEach((ev) => {
            try {
                const { handler: handlerId, args = [], parameters = [] } = ev;

                console.log('window.onInit',context, ev.handler, args, parameters);
                const fn = context.lookupHandler(handlerId);

                fn({ execution: { id: handlerId, args, parameters }, context });
            } catch (err) {
                console.error('window.onInit handler failed', ev.handler, err);
            }
        });
        // we want this effect to run only once when context stabilises
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [context]);

    const dataSources = metadata.dataSource || {};
    const dialogs     = metadata.dialogs   || [];

    /* ------------------------------------------------------------
     * Rendering helpers
     * ---------------------------------------------------------- */

    const renderDataSources = () => {
        return (
            <>
                {Object.keys(dataSources).map((key) => (
                    <DataSourceContainer
                        key={key}
                        windowContext={context}
                        dsKey={key}
                        initialParams={parameters[key] || {}}
                    />
                ))}
            </>
        );
    };

    const renderDialogs = () => {
        if (!dialogs || dialogs.length === 0) return null;
        const view = metadata.view || {};
        const dataSourceRef = view.dataSourceRef || Object.keys(dataSources)[0];
        return (
            <>
                {dialogs.map((dialog) => (
                    <ViewDialog
                        key={`${windowId}/D/${dialog.id}`}
                        context={context.dialogContext(dialog, dialog.dataSourceRef || dataSourceRef)}
                        dialog={dialog}
                    />
                ))}
            </>
        );
    };

    return (
        <div>
            {renderDataSources()}
            {renderDialogs()}
            <WindowLayout
                title={`${windowKey.toUpperCase()}${windowData ? ` (${windowData})` : ''}`}
                context={context}
                onClose={() => {
                    removeWindow(windowId);
                }}
                isInTab={window.isInTab}
            />
        </div>
    );
}


/* ------------------------------------------------------------------
 * WindowContent – outer wrapper responsible for fetching metadata.  It hosts
 * only a stable set of hooks so React never complains about ordering.
 * ------------------------------------------------------------------ */

export default function WindowContent({window, isInTab = false}) {
    const {windowKey, windowId} = window;

    const metadataSignal = getMetadataSignal(windowId);
    const [loading, setLoading] = useState(true);

    // Settings & connector
    const {connectorConfig = {}, services = {}} = useSetting();
    if (!connectorConfig.window) {
        throw new Error('No connectorConfig.window found');
    }

    const {service} = connectorConfig.window;
    const baseKey = windowKey.split('?')[0];
    const config  = {service: {...service, uri: `${service.uri}/${baseKey}`}};
    const connector = useDataConnector(config);

    // Fetch metadata once per windowId
    useEffect(() => {
        let cancelled = false;
        setLoading(true);

        connector.get({})
            .then((resp) => {
                if (cancelled) return;
                injectActions(resp.data);
                metadataSignal.value = resp.data;
            })
            .catch((err) => {
                if (!cancelled) {
                    console.error('Error fetching metadata', err);
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [windowId]);

    const metadata = metadataSignal.peek();

    if (loading || !metadata) {
        return <Spinner/>;
    }

    return (
        <WindowContentInner
            window={{...window, isInTab}}
            metadata={metadata}
            services={services}
        />
    );
}
