import React, {useMemo, useState} from 'react';
import ControlRenderer from './ControlRenderer.jsx';
import {useControlEvents} from "../hooks";
import TablePanel from "./TablePanel.jsx";
import FormPanel from "./FormPanel.jsx";
import Chart from "./Chart.jsx";
import {resolveParameterValue} from "../utils/selector.js";
import Splitter from './Splitter';

import {expandRepeatItems} from "../utils/repeat.js";
import FileBrowser from "./FileBrowser.jsx";
import DataSourceFetcher from "./DataSourceFetcher.jsx";
import Editor from "./Editor.jsx";
import Chat from "./Chat.jsx";
import './Container.css';

const Container = ({context, container, isActive}) => {
    const {items = [], containers = [], layout, table, chart} = container;
    const columns = layout?.columns || 1;
    const orientation = layout?.orientation || 'vertical';

    const {identity} = context
    const dataSourceRef = container.dataSourceRef || identity.dataSourceRef

    let state;
    if (container.state) {
        const initialValue = resolveParameterValue(container.state, context, container, state, true);
        state = useState(initialValue);
    }


    let formPanel = null
    if (container.tabs) {
        formPanel = (<>
            <FormPanel context={context.Context(dataSourceRef)} container={container} isActive={isActive}></FormPanel>
        </>);
    }

    let tablePanel = null
    if (table) {
        tablePanel = (<>
            <TablePanel context={context.Context(dataSourceRef)} container={container} isActive={isActive}></TablePanel>
        </>);
    }

    let chartPanel = null
    if (chart) {
        chartPanel = (<>
            <Chart context={context.Context(dataSourceRef)} container={container} isActive={isActive}></Chart>
        </>);
    }

    // Chat panel support
    let chatPanel = null;
    if (container.chat) {
        const dsRef = container.chat.dataSourceRef || dataSourceRef;
        chatPanel = (
            <Chat
                context={context.Context(dsRef)}
                container={container}
                isActive={isActive}
            />
        );
    }


    // Add the FileBrowser panel
    let fileBrowserPanel = null;
    if (container.fileBrowser) {
        const dsRef = container.fileBrowser.dataSourceRef || dataSourceRef
        fileBrowserPanel = (
            <FileBrowser
                context={context.Context(dsRef)}
                config={container.fileBrowser}
                isActive={isActive}
            />
        );
    }


    let editorPanel = null;
    if (container.editor) {
        editorPanel = (
            <Editor
                context={context.Context(dataSourceRef)}
                container={container}
                isActive={isActive}
            />
        );
    }


    const {style = {}} = container

    const gridStyle = {
        ...style,
        width: '100%',
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        marginBottom: '4px',
        gap: '1rem',
    };

    let renderedItems = items;
    if (container.repeat) {
        const repeatConfig = container.repeat;
        const collection = resolveParameterValue(repeatConfig.iterator, context, container, state);
        const iterator = repeatConfig.iterator.name || 'item';
        renderedItems = useMemo(() => {
            if (collection?.length > 0) {
                const expanded = expandRepeatItems(collection, repeatConfig, iterator, state);
                for (const item of items || []) {
                    expanded.push(item)
                }
                return expanded
            }
            return items;
        }, [collection]);
    }


    // All items are now visual – legacy "fetcher" items have been removed.
    const visualItems = renderedItems;

    // ------------------------------------------------------------------
    // Container-level auto-fetch / selectFirst support
    // ------------------------------------------------------------------
    const containerWantsFetcher = container.fetchData === true || container.selectFirst === true;

    // ------------------------------------------------------------------
    // Early exit: container used only for auto-fetch (no visual output)
    // ------------------------------------------------------------------
    const hasVisual =
        (visualItems?.length || 0) > 0 ||
        tablePanel || chartPanel || chatPanel || fileBrowserPanel || editorPanel || formPanel || (containers && containers.length > 0);

    if (!hasVisual) {
        return (
            <>
                {containerWantsFetcher && (
                    <DataSourceFetcher
                        key={`auto-fetcher-${container.id}`}
                        context={context.Context(container.dataSourceRef || dataSourceRef)}
                        selectFirst={container.selectFirst === true}
                        fetchData={container.fetchData === true}
                    />
                )}
            </>
        );
    }

    const handlers = (visualItems?.length || 0) > 0 ? useControlEvents(context, visualItems, state) : {}

    return (<>
            <div>
                <div style={gridStyle}>
                    {visualItems.map((item) => {
                        const subCtx = context.Context(item.dataSourceRef || dataSourceRef)
                        return (
                            <ControlRenderer
                                key={item.id}
                                item={item}
                                context={subCtx}
                                events={handlers[item.id]?.events || {}}
                                stateEvents={handlers[item.id]?.stateEvents || {}}
                                container={container}
                                state={state}
                            />
                        )
                    })}
                </div>
                {chartPanel}
                {chatPanel}
                {tablePanel}
                {fileBrowserPanel}
                {editorPanel}
                {formPanel ? formPanel :

                    <Splitter key={'s' + identity.id}  orientation={orientation} divider={layout?.divider}>
                        {containers.map((subContainer) => {
                            const subId = 'Sc' + subContainer.id
                            return (
                                <div key={'d' + subId}>
                                    <Container
                                        key={subId}
                                        context={context.Context(subContainer.dataSourceRef || dataSourceRef)}
                                        container={subContainer}
                                        isActive={isActive}
                                    />
                                </div>
                            )
                        })}
                    </Splitter>
                }

            </div>
            {/* Container-level fetcher */}
            {containerWantsFetcher && (
                <DataSourceFetcher
                    key={`auto-fetcher-${container.id}`}
                    context={context.Context(container.dataSourceRef || dataSourceRef)}
                    selectFirst={container.selectFirst === true}
                    fetchData={container.fetchData === true}
                />
            )}
        </>
    );
};

export default Container;
