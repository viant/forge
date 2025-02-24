import React, {useEffect, useRef, useState} from 'react';

import {
    getMetadataSignal,
    removeSignalsForKey,
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
    const config = {service: {...service, uri: service.uri + '/' + windowKey}}
    const connector = useDataConnector(config)
    const metadata = metadataSignal.peek();
    connector.get({}).then(
        (response) => {
            injectActions(response.data);
            metadataSignal.value = response.data
        }
    ).catch((error) => {
            console.error("Error fetching metadata", error)
        }
    ).finally(() => {
        setLoading(false)
    })

    if (!metadata) {
        return <Spinner/>;
    }


    const dialogs = metadata.dialogs || [];
    const dataSources = metadata.dataSource || {};
    const view = metadata.view || {};

    let dataSourceRef = view.dataSourceRef;
    if (!dataSourceRef) {
        dataSourceRef = Object.keys(dataSources)[0];
    }

    const context = Context(windowId, metadata, dataSourceRef, services)
    context.init()

    const DataSources = () => {
        return (!dataSources ? null :
                <>
                    {Object.entries(dataSources).map(([key, value]) => {
                        const dsContext = context.Context(key)
                        const data = parameters[key];
                        if (data) {
                            for (const [k, v] of Object.entries(data)) {
                                const signal = dsContext.signals[k]
                                if (signal) {
                                    signal.value = v
                                }
                            }
                        }
                        return (
                            <DataSource context={dsContext} key={key}/>)
                    })}
                    {Object.entries(dataSources).map(([key, value]) => {
                        return (<MessageBus context={context.Context(key)} key={key}/>)
                    })}
                </>
        )
    }

    const Dialogs = () => {
        if (!dialogs || dialogs.length === 0) {
            return null;
        }
        return (
            <>
                {dialogs.map((dialog) => {
                    return (
                        <ViewDialog key={windowId + "/D/" + dialog.id}
                                    context={context.dialogContext(dialog, dialog.dataSourceRef || dataSourceRef)}
                                    dialog={dialog}
                        />
                    );
                })}
            </>
        );
    };

    return (
        <div ref={windowRef}>
            <DataSources/>
            <Dialogs/>
            <WindowLayout
                title={`${windowKey.toUpperCase()}${windowData ? ` (${windowData})` : ''}`}
                context={context}
                onClose={() => {
                    removeWindow(windowId);
                    removeSignalsForKey(windowId);
                }}
                isInTab={isInTab}
            />
        </div>
    );
};

export default WindowContent;