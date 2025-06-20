import React, {useEffect, useRef, useState, useMemo} from 'react';

import {
    getMetadataSignal,
    removeWindow,
} from '../core';
import WindowLayout from './WindowLayout';
import DataSource from './DataSource';
import {Spinner} from "@blueprintjs/core";
import MessageBus from "./MessageBus.jsx";
import {Context} from "../core";
import ViewDialog from './ViewDialog.jsx';
import useDataConnector from "../hooks/dataconnector.js";
import {useSetting} from "../core";
import {injectActions} from "../actions";


// Helper component responsible for :
// 1. Lazily building the DataSource context via windowContext.Context(dsKey)
//    (must be done inside the component body so calling Hooks is legal).
// 2. Applying initial parameters ONLY ONCE to the underlying signals.
// 3. Rendering DataSource & MessageBus children.
const DataSourceContainer = ({windowContext, dsKey, initialParams = {}}) => {
    const dsContext = useMemo(() => windowContext.Context(dsKey), [windowContext, dsKey]);

    // Apply initial parameters once, after dsContext stabilises.
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
        // We intentionally disable exhaustive-deps because we want to run
        // this effect only once for the given dsContext.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dsContext]);

    return (
        <>
            <DataSource context={dsContext}/>
            <MessageBus context={dsContext}/>
        </>
    );
};


const WindowContent = ({window, isInTab = false}) => {
    const {windowKey, windowData, windowId, parameters} = window;
    const [loading, setLoading] = useState(true);
    const windowRef = useRef(null);
    const metadataSignal = getMetadataSignal(windowId);
    const {connectorConfig = {},  services={}} = useSetting();
    if (!connectorConfig.window) {
        throw new Error("No connectorConfig.window found")
    }
    const {service} = connectorConfig.window || {};
    const baseKey = windowKey.split('?')[0];
    const config = {service: {...service, uri: service.uri + '/' + baseKey}}
    const connector = useDataConnector(config)
    let metadata = metadataSignal.peek();
    // Fetch metadata once (or when windowId changes)
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        connector
            .get({})
            .then((response) => {
                if (cancelled) return;
                injectActions(response.data);
                metadataSignal.value = response.data;
            })
            .catch((error) => {
                if (cancelled) return;
                console.error('Error fetching metadata', error);
            })
            .finally(() => {
                if (cancelled) return;
                setLoading(false);
            });
        return () => {
            cancelled = true;
        };



        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [windowId]);

    // Build context (memoised) – may return null until metadata is loaded
    const context = useMemo(() => {
        if (!metadata) return null;
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

    const dataSources = metadata?.dataSource || {};
    const dialogs = metadata?.dialogs || [];
    const view = metadata?.view || {};
    const dataSourceRef = view.dataSourceRef || Object.keys(dataSources)[0];

    // (parameter application moved into DataSourceContainer to avoid rule-of-hooks violations)

    /* ------------------------------------------------------------
     * Rendering helpers (simple functions, not components)
     * ---------------------------------------------------------- */
    const renderDataSources = () => {
        if (!context) return null;
        return (
            <>
                {Object.keys(dataSources).map((key) => (
                    <DataSourceContainer
                        windowContext={context}
                        dsKey={key}
                        initialParams={parameters[key] || {}}
                        key={key}
                    />
                ))}
            </>
        );
    };

    const renderDialogs = () => {
        if (!context || !dialogs || dialogs.length === 0) return null;
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



    
    if (!metadata || !context) {
        return <Spinner/>;
    }

    return (
        <div ref={windowRef}>
            {renderDataSources()}
            {renderDialogs()}
            <WindowLayout
                title={`${windowKey.toUpperCase()}${windowData ? ` (${windowData})` : ''}`}
                context={context}
                onClose={() => {
                    removeWindow(windowId);
                }}
                isInTab={isInTab}
            />
        </div>
    );
};

export default WindowContent;