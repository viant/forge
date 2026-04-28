import React, {useMemo, useState} from 'react';
import ControlRenderer from './ControlRenderer.jsx';
import {useControlEvents} from "../hooks";
import TablePanel from "./TablePanel.jsx";
import FormPanel from "./FormPanel.jsx";
import Chart from "./Chart.jsx";
import {resolveParameterValue, resolveTemplate} from "../utils/selector.js";
import Splitter from './Splitter';

import {expandRepeatItems} from "../utils/repeat.js";
import FileBrowser from "./FileBrowser.jsx";
import TreeBrowser from "./TreeBrowser.jsx";
import DataSourceFetcher from "./DataSourceFetcher.jsx";
import Editor from "./Editor.jsx";
import Chat from "./Chat.jsx";
import Terminal from "./Terminal.jsx";
import SchemaBasedForm from "../widgets/SchemaBasedForm.jsx";
import './Container.css';
import TableToolbar from "./table/basic/Toolbar.jsx";
import GridLayoutRenderer from './GridLayoutRenderer.jsx';
import {DashboardBlock} from "./dashboard/DashboardBlocks.jsx";
import DashboardSurface from "./dashboard/DashboardSurface.jsx";
import {createDashboardContext, evaluateDashboardCondition, getDashboardVisibleWhen} from "./dashboard/dashboardUtils.js";

const buildGridStyle = (style, columns, layout) => {
    const display = (style && Object.prototype.hasOwnProperty.call(style, 'display')) ? style.display : 'grid';

    return {
        ...style,
        width: '100%',
        display,
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        marginBottom: '4px',
        gap: layout?.gap ?? '1rem',
        rowGap: layout?.rowGap,
        columnGap: layout?.columnGap,
    };
};

const Container = ({context, container, isActive}) => {
    const isDashboardRoot = (container.kind === 'dashboard' || !!container.dashboard) && !context?.dashboardKey;
    const effectiveContext = isDashboardRoot ? createDashboardContext(context, container) : context;
    const {items = [], containers = [], layout, table, chart} = container;
    const columns = layout?.columns || 1;
    const orientation = layout?.orientation || 'vertical';

    const {identity} = effectiveContext
    const dataSourceRef = container.dataSourceRef || identity.dataSourceRef

    const visibleWhen = getDashboardVisibleWhen(container);
    if (visibleWhen && effectiveContext?.dashboardKey) {
        const visible = evaluateDashboardCondition(visibleWhen, {
            context: effectiveContext,
            dashboardKey: effectiveContext.dashboardKey,
        });
        if (!visible) {
            return null;
        }
    }

    const stateTuple = useState(() => (
        container.state
            ? resolveParameterValue(container.state, effectiveContext, container, undefined, true)
            : undefined
    ));
    const state = container.state ? stateTuple : undefined;


    let formPanel = null
    if (container.tabs) {
        formPanel = (<>
            <FormPanel context={effectiveContext.Context(dataSourceRef)} container={container} isActive={isActive}></FormPanel>
        </>);
    }

    let tablePanel = null
    if (table) {
        tablePanel = (<>
            <TablePanel context={effectiveContext.Context(dataSourceRef)} container={container} isActive={isActive}></TablePanel>
        </>);
    }

    let chartPanel = null
    if (chart) {
        chartPanel = (<>
            <Chart context={effectiveContext.Context(dataSourceRef)} container={container} isActive={isActive}></Chart>
        </>);
    }

    // Chat panel support
    let chatPanel = null;
    if (container.chat) {
        const dsRef = container.chat.dataSourceRef || dataSourceRef;
        chatPanel = (
            <Chat
                context={effectiveContext.Context(dsRef)}
                container={container}
                isActive={isActive}
            />
        );
    }

    // Terminal panel support
    let terminalPanel = null;
    if (container.terminal) {
        const term = container.terminal;
        const dsRef = term.dataSourceRef || dataSourceRef;
        const autoScroll = term.autoScroll !== false; // default true
        terminalPanel = (
            <Terminal
                context={effectiveContext.Context(dsRef)}
                height={term.height || '320px'}
                prompt={term.prompt || '$'}
                autoScroll={autoScroll}
                showDividers={!!term.showDividers}
                truncateLongOutput={term.truncateLongOutput}
                truncateLength={term.truncateLength}
                className={term.className || ''}
                style={term.style || {}}
            />
        );
    }


    // Add the FileBrowser panel
    let fileBrowserPanel = null;
    if (container.fileBrowser) {
        const dsRef = container.fileBrowser.dataSourceRef || dataSourceRef
        fileBrowserPanel = (
            <FileBrowser
                context={effectiveContext.Context(dsRef)}
                config={container.fileBrowser}
                isActive={isActive}
            />
        );
    }

    let treeBrowserPanel = null;
    if (container.treeBrowser) {
        const dsRef = container.treeBrowser.dataSourceRef || dataSourceRef;
        treeBrowserPanel = (
            <TreeBrowser
                context={effectiveContext.Context(dsRef)}
                config={container.treeBrowser}
                isActive={isActive}
            />
        );
    }


    let editorPanel = null;
    if (container.editor) {
        editorPanel = (
            <Editor
                context={effectiveContext.Context(dataSourceRef)}
                container={container}
                isActive={isActive}
            />
        );
    }


    // ---------------- SchemaBasedForm support ------------------
    let schemaFormPanel = null;
    if (container.schemaBasedForm) {
        const formCfg = container.schemaBasedForm;

        // Determine which data source the form should bind to – hierarchy:
        // 1. formCfg.datasourceRef  2. container-level dataSourceRef 3. ctx identity
        const dsRef = formCfg?.datasourceRef || formCfg?.dataSourceRef || dataSourceRef;

        const subCtx = effectiveContext.Context(dsRef);

        // Resolve dynamic template strings in id / schema when provided
        const dynId = typeof formCfg.id === 'string' ? resolveTemplate(formCfg.id, subCtx) : formCfg.id;

        let dynSchema = formCfg.schema;
        if (typeof formCfg.schema === 'string') {
            try {
                const raw = resolveTemplate(formCfg.schema, subCtx);
                // If the resolved result is a JSON string – parse it, otherwise assume object ref
                dynSchema = JSON.parse(raw);
            } catch (_) {
                // ignore parse errors – fallback to original string
            }
        }

        // Build submit handler: save form data, then trigger any additional
        // Execute definitions attached to schemaBasedForm (event: "submit").
        const customHandlers = (formCfg.on || [])
            .filter((ex) => (ex.event || '').toLowerCase() === 'submit' && ex.handler)
            .map((ex) => {
                const fn = subCtx?.lookupHandler?.(ex.handler);
                return { exec: ex, fn };
            })
            .filter(({ fn }) => typeof fn === 'function');


        const submitHandler = (payload, setFormState) => {
            try {
                const dsHandlers = subCtx?.handlers?.dataSource;
                if (customHandlers.length === 0) {
                    throw new Error('No submit handlers found');
                }
                
                customHandlers.forEach(({ exec, fn }) => {
                    try {
                        fn({ execution: exec, context: subCtx, data: payload, setFormState });
                    } catch (e) {
                        console.error('submit handler error', exec.handler, e);
                    }
                });
            } catch (e) {
                console.error('SchemaBasedForm submit failed', e);
            }
        };

        schemaFormPanel = (
            <SchemaBasedForm
                {...formCfg}
                id={dynId}
                schema={dynSchema}
                context={subCtx}
                onSubmit={submitHandler}
            />
        );
    }


    const { style = {} } = container;
    const gridStyle = buildGridStyle(style, columns, layout);

    let renderedItems = items;
    if (container.repeat) {
        const repeatConfig = container.repeat;
        const collection = resolveParameterValue(repeatConfig.iterator, effectiveContext, container, state);
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
        !!container.toolbar ||
        tablePanel || chartPanel || chatPanel || terminalPanel || fileBrowserPanel || treeBrowserPanel || editorPanel || schemaFormPanel || formPanel || (containers && containers.length > 0);
    if (!hasVisual) {
        return (
            <>
                {containerWantsFetcher && (
                    <DataSourceFetcher
                        key={`auto-fetcher-${container.id}`}
                        context={effectiveContext.Context(container.dataSourceRef || dataSourceRef)}
                        selectFirst={container.selectFirst === true}
                        fetchData={container.fetchData === true}
                    />
                )}
            </>
        );
    }

    const handlers = (visualItems?.length || 0) > 0 ? useControlEvents(effectiveContext, visualItems, state) : {}

    // Optional container-level toolbar
    const renderContainerToolbar = () => {
        const tb = container.toolbar;
        if (!tb) return null;
        let tbContext = effectiveContext;
        if (tb.dataSourceRef) {
            tbContext = effectiveContext.Context(tb.dataSourceRef);
        }
        if (Array.isArray(tb.items)) {
            const wrapperStyle = tb.style || {};
            const wrapperClass = tb.className || '';
            return (
                <div className={`mb-2 ${wrapperClass}`} style={wrapperStyle}>
                    <TableToolbar context={tbContext} toolbarItems={tb.items} />
                </div>
            );
        }
        return null;
    };

    const renderNestedContainers = () => {
        if (!containers || containers.length === 0) {
            return null;
        }

        if (layout?.kind === 'grid') {
            return (
                <GridLayoutRenderer
                    context={effectiveContext}
                    container={{...container, layout: {labels: {mode: 'none'}, ...container.layout}}}
                    entries={containers.map((entry) => ({...entry, hideLabel: true}))}
                    baseDataSourceRef={dataSourceRef}
                    style={style}
                    renderEntry={({entry, context: subCtx, css}) => (
                        <div key={`${entry.id}-container`} style={{...css.ctrl, display: 'flex', minHeight: 0, minWidth: 0}}>
                            <Container
                                context={subCtx}
                                container={entry}
                                isActive={isActive}
                            />
                        </div>
                    )}
                />
            );
        }

        const useSplitter = layout?.kind === 'split' || layout?.divider?.visible === true;
        if (useSplitter) {
            return (
                <Splitter key={'s' + identity.id} orientation={orientation} divider={layout?.divider}>
                    {containers.map((subContainer) => (
                        <div key={'dSc' + subContainer.id}>
                            <Container
                                key={'Sc' + subContainer.id}
                                context={effectiveContext.Context(subContainer.dataSourceRef || dataSourceRef)}
                                container={subContainer}
                                isActive={isActive}
                            />
                        </div>
                    ))}
                </Splitter>
            );
        }

        const isHorizontal = orientation === 'horizontal';
        return (
            <div
                style={{
                    display: 'flex',
                    flexDirection: isHorizontal ? 'row' : 'column',
                    width: '100%',
                    height: '100%',
                    minHeight: 0,
                    minWidth: 0,
                }}
            >
                {containers.map((subContainer, index) => {
                    const isLast = index === containers.length - 1;
                    const childStyle = {
                        flex: isLast ? '1 1 auto' : '0 0 auto',
                        minHeight: 0,
                        minWidth: 0,
                        overflow: 'hidden',
                    };
                    return (
                        <div key={'dSc' + subContainer.id} style={childStyle}>
                            <Container
                                key={'Sc' + subContainer.id}
                                context={effectiveContext.Context(subContainer.dataSourceRef || dataSourceRef)}
                                container={subContainer}
                                isActive={isActive}
                            />
                        </div>
                    )
                })}
            </div>
        );
    };

    const renderDashboardBlockContainer = (subContainer) => {
        const subCtx = effectiveContext.Context(subContainer.dataSourceRef || dataSourceRef);
        return (
            <Container
                key={`dashboard-block-${subContainer.id || subContainer.kind}`}
                context={subCtx}
                container={subContainer}
                isActive={isActive}
            />
        );
    };

    if (isDashboardRoot) {
        return (
            <>
                <DashboardSurface
                    container={container}
                    context={effectiveContext}
                    toolbar={container.toolbar ? renderContainerToolbar() : null}
                    renderBlock={renderDashboardBlockContainer}
                >
                    {renderNestedContainers()}
                </DashboardSurface>
                {containerWantsFetcher && (
                    <DataSourceFetcher
                        key={`auto-fetcher-${container.id}`}
                        context={effectiveContext.Context(container.dataSourceRef || dataSourceRef)}
                        selectFirst={container.selectFirst === true}
                        fetchData={container.fetchData === true}
                    />
                )}
            </>
        );
    }

    if (container.kind?.startsWith('dashboard.')) {
        const blockContext = effectiveContext.Context(container.dataSourceRef || dataSourceRef);
        return (
            <>
                <DashboardBlock
                    container={container}
                    context={blockContext}
                    isActive={isActive}
                >
                    {renderNestedContainers()}
                </DashboardBlock>
                {containerWantsFetcher && (
                    <DataSourceFetcher
                        key={`auto-fetcher-${container.id}`}
                        context={blockContext}
                        selectFirst={container.selectFirst === true}
                        fetchData={container.fetchData === true}
                    />
                )}
            </>
        );
    }

    return (<>
            <div style={{ width: '100%', height: '100%', minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                {container.toolbar ? renderContainerToolbar() : null}
                {(visualItems?.length || 0) > 0 ? (
                    container?.layout?.kind === 'grid' ? (
                        <GridLayoutRenderer
                            context={effectiveContext}
                            container={{ ...container, layout: { labels: { mode: (container?.layout?.labels?.mode || 'left') }, ...container.layout } }}
                            items={visualItems}
                            handlers={handlers}
                            state={state}
                            baseDataSourceRef={dataSourceRef}
                            style={style}
                        />
                    ) : (
                        <div style={gridStyle}>
                            {visualItems.map((item) => {
                                const subCtx = effectiveContext.Context(item.dataSourceRef || dataSourceRef)
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
                    )
                ) : null}
                {chartPanel}
                {chatPanel}
                {terminalPanel}
                {tablePanel}
                {fileBrowserPanel}
                {treeBrowserPanel}
                {editorPanel}
                {schemaFormPanel}
                {formPanel ? formPanel :
                    renderNestedContainers()
                }

            </div>
            {/* Container-level fetcher */}
            {containerWantsFetcher && (
                <DataSourceFetcher
                    key={`auto-fetcher-${container.id}`}
                    context={effectiveContext.Context(container.dataSourceRef || dataSourceRef)}
                    selectFirst={container.selectFirst === true}
                    fetchData={container.fetchData === true}
                />
            )}
        </>
    );
};

export default Container;
