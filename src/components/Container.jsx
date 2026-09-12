import {hasContainerClass, containerSurfaceClass} from './containerClasses.js';
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {useSignals} from '@preact/signals-react/runtime';
import {Card, Section} from '@blueprintjs/core';
import ControlRenderer from './ControlRenderer.jsx';
import {useControlEvents} from "../hooks/index.js";
import TablePanel from "./TablePanel.jsx";
import EditableCollection from "./primitives/EditableCollection.jsx";
import AssignmentPicker from "./primitives/AssignmentPicker.jsx";
import DerivedDataSource from "./primitives/DerivedDataSource.jsx";
import MutationCommand from "./primitives/MutationCommand.jsx";
import StatusWorkflow from "./primitives/StatusWorkflow.jsx";
import TreeEditor from "./primitives/TreeEditor.jsx";
import Wizard from "./primitives/Wizard.jsx";
import UploadCollection from "./primitives/UploadCollection.jsx";
import PermissionBoundary from "./primitives/PermissionBoundary.jsx";
import ResponsiveDataGrid from "./primitives/ResponsiveDataGrid.jsx";
import HistoryDiff from "./primitives/HistoryDiff.jsx";
import ScheduleEditor from "./primitives/ScheduleEditor.jsx";
import DraftForm from "./primitives/DraftForm.jsx";
import QueryToolbar from "./primitives/QueryToolbar.jsx";
import ResourceHeader from "./primitives/ResourceHeader.jsx";
import DataStateBoundary from "./primitives/DataStateBoundary.jsx";
import RelationDrill from "./primitives/RelationDrill.jsx";
import NotificationRules from "./primitives/NotificationRules.jsx";
import MetricSummary from "./primitives/MetricSummary.jsx";
import DetailView from "./primitives/DetailView.jsx";
import MasterDetail from "./primitives/MasterDetail.jsx";
import FormPanel from "./FormPanel.jsx";
import Chart from "./Chart.jsx";
import {resolveParameterValue, resolveSelector, resolveTemplate} from "../utils/selector.js";
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
import {createDashboardContext, getDashboardVisibleWhen, seedDashboardDefaultFilters} from "./dashboard/dashboardUtils.js";
import { findDashboardFilterSignal, findDashboardSelectionSignal, getDashboardSelectionSignal } from "../core/store/signals.js";
import {getViewSignal} from '../core/index.js';
import {isDashboardRootContainer, isSemanticDashboardBlock, shouldSkipGenericNonVisualEarlyReturn} from "./containerSemantics.js";
import {isContainerVisible, resolveChildContext, trackContainerVisibility} from "./visibleWhen.js";
import {mergeSectionOpenState, resolveSectionOpenState, resolveSectionProperties} from './containerChrome.js';
import AccessibleSection from './AccessibleSection.jsx';
import {resolveDynamicDataSourceRef} from '../runtime/dataSourceRef.js';
import {isPureBoundLabelSection} from './containerEmptyState.js';
import {containerAnchorProps} from './containerAnchor.js';
import {containerSizingStyle, resolveContainerSizing} from './containerSizing.js';

const wrapContainerChrome = (container, content, suppressTitle = false, sectionPropertiesOverride = null, sizingMode = 'fill') => {
    if (!container?.section && !container?.card) {
        return content;
    }
    const outerStyle = containerSizingStyle(container, sizingMode);
    const bodyStyle = containerSizingStyle(container, sizingMode, {chrome: true});

    const framedContent = (
        <div {...containerAnchorProps(container)} data-forge-part="container-body" className="forge-container-body" style={bodyStyle}>
            {content}
        </div>
    );

    let wrapped = framedContent;
    if (container?.card) {
        const {compact: compactCard, className: cardClassName, ...cardProperties} = container.card;
        const cardClasses = [compactCard ? 'is-compact' : '', cardClassName].filter(Boolean).join(' ');
        const cardStyle = {
            ...(container.section ? bodyStyle : outerStyle),
            ...(container.card?.style || {}),
        };
        wrapped = <Card {...cardProperties} data-forge-part="container-card" className={container.section ? ['forge-container-card', cardClasses].filter(Boolean).join(' ') : containerSurfaceClass(container, 'card', cardClasses)} style={cardStyle}>{wrapped}</Card>;
    }
    if (container?.section) {
        const sectionProperties = sectionPropertiesOverride || resolveSectionProperties(container.section);
        const SectionComponent = sectionProperties.collapsible === true ? AccessibleSection : Section;
        const sectionStyle = {
            ...outerStyle,
            ...(sectionProperties.style || {}),
        };
        wrapped = (
            <SectionComponent {...(suppressTitle ? {} : {title: container.title || ''})} {...sectionProperties} data-forge-part="container-section" className={containerSurfaceClass(container, 'section', sectionProperties.className)} style={sectionStyle}>
                {wrapped}
            </SectionComponent>
        );
    }
    return wrapped;
};

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

const isMissingBoundValue = (value) => value == null || (typeof value === 'string' && value.trim() === '');

const resolveContainerItemValue = (item, context) => {
    if (!item || !context) return undefined;
    if (item.value !== undefined) return item.value;
    const scope = String(item.scope || 'form').trim().toLowerCase();
    let holder = {};
    switch (scope) {
        case 'metrics':
            holder = context?.signals?.metrics?.value || {};
            break;
        case 'windowform':
            holder = context?.signals?.windowForm?.value || {};
            break;
        case 'input':
            holder = context?.signals?.input?.value || {};
            break;
        case 'form':
        default:
            holder = context?.handlers?.dataSource?.getFormData?.() || context?.signals?.form?.value || {};
            break;
    }
    return item?.dataField ? resolveSelector(holder, item.dataField) : undefined;
};

const Container = ({context, container, isActive, suppressTitle = false, dataSourceFetchMode = 'always', sizingMode: allocatedMode = 'fill'}) => {
    useSignals();
    const sizingMode = resolveContainerSizing(container, allocatedMode);
    const rootSizingStyle = containerSizingStyle(container, sizingMode, {chrome: !!(container.card || container.section)});
    const isDashboardBlock = isSemanticDashboardBlock(container);
    const isDashboardRoot = isDashboardRootContainer(container, context);
    const effectiveContext = isDashboardRoot ? createDashboardContext(context, container) : context;
    const {items = [], containers = [], layout, table, chart} = container;
    const columns = layout?.columns || 1;
    const orientation = layout?.orientation || 'vertical';

    const {identity} = effectiveContext
    const fallbackDataSourceRef = container.dataSourceRef || identity.dataSourceRef;
    const dataSourceRef = resolveDynamicDataSourceRef(container, effectiveContext, fallbackDataSourceRef);
    const dashboardKey = effectiveContext?.dashboardKey;
    const windowId = effectiveContext?.identity?.windowId;
    const sectionViewSignal = windowId && container?.section?.persistState === true ? getViewSignal(windowId) : null;
    const sectionViewValue = sectionViewSignal?.value || {};
    const persistentSectionProperties = useMemo(() => {
        if (!sectionViewSignal || container?.section?.collapsible !== true) return null;
        const authored = resolveSectionProperties(container.section);
        const stateKey = String(container.section.stateKey || container.id || '').trim();
        const isOpen = resolveSectionOpenState({...container.section, stateKey}, sectionViewValue);
        const authoredToggle = authored?.collapseProps?.onToggle;
        return {
            ...authored,
            collapseProps: {
                ...(authored.collapseProps || {}),
                isOpen,
                onToggle: () => {
                    if (typeof authoredToggle === 'function') authoredToggle();
                    const previous = sectionViewSignal.peek?.() || {};
                    sectionViewSignal.value = mergeSectionOpenState(previous, stateKey, !isOpen);
                },
            },
        };
    }, [sectionViewSignal, sectionViewValue, container?.section, container?.id]);
    if (dashboardKey) {
        findDashboardFilterSignal(dashboardKey)?.value;
        findDashboardSelectionSignal(dashboardKey)?.value;
    }
    useEffect(() => {
        if (!dashboardKey || !isDashboardRoot) {
            return;
        }
        seedDashboardDefaultFilters(dashboardKey, container);
        getDashboardSelectionSignal(dashboardKey, {dimension: null, entityKey: null, pointKey: null});
    }, [dashboardKey, isDashboardRoot, container]);
    const trackedVisibleWhen = getDashboardVisibleWhen(container);
    if (trackedVisibleWhen && !dashboardKey) {
        trackContainerVisibility(container, effectiveContext);
    }

    const stateTuple = useState(() => (
        container.state
            ? resolveParameterValue(container.state, effectiveContext, container, undefined, true)
            : undefined
    ));
    const state = container.state ? stateTuple : undefined;


    let formPanel = null
    if (container.tabs || container.stableTabs) {
        const stableMountPolicy = container.stableTabs?.keepVisitedTabPanelsMounted === true ? 'visited' : container.stableTabs?.renderActiveTabPanelOnly === false ? 'all' : 'active';
        const tabContainer = container.stableTabs ? {...container, tabs: {...container.stableTabs, mountPolicy: stableMountPolicy}} : container;
        formPanel = (<>
            <FormPanel context={resolveChildContext(effectiveContext, dataSourceRef)} container={tabContainer} isActive={isActive} dataSourceFetchMode={dataSourceFetchMode}></FormPanel>
        </>);
    }

    let tablePanel = null
    if (table) {
        const tableContext = resolveChildContext(effectiveContext, dataSourceRef);
        tablePanel = container.editableCollection
            ? <EditableCollection sizingMode={sizingMode} context={tableContext} container={container} isActive={isActive}/>
            : container.responsiveDataGrid
            ? <ResponsiveDataGrid sizingMode={sizingMode} context={tableContext} container={container} isActive={isActive}/>
            : <TablePanel sizingMode={sizingMode} context={tableContext} container={container} isActive={isActive}/>;
    }

    const assignmentPanel = container.assignmentPicker
        ? <AssignmentPicker container={container} context={effectiveContext}/>
        : null;
    const derivedDataSourcePanel = container.derivedDataSource
        ? <DerivedDataSource container={container} context={effectiveContext}/>
        : null;
    const mutationCommandPanel = container.mutationCommand
        ? <MutationCommand command={container.mutationCommand} context={effectiveContext}/>
        : null;
    const statusWorkflowPanel = container.statusWorkflow
        ? <StatusWorkflow container={container} context={effectiveContext}/>
        : null;
    const treeEditorPanel = container.treeEditor
        ? <TreeEditor container={container} context={effectiveContext}/>
        : null;
    const uploadCollectionPanel = container.uploadCollection
        ? <UploadCollection container={container} context={effectiveContext}/>
        : null;
    const historyDiffPanel = container.historyDiff
        ? <HistoryDiff container={container} context={effectiveContext}/>
        : null;
    const scheduleEditorPanel = container.scheduleEditor
        ? <ScheduleEditor container={container} context={effectiveContext}/>
        : null;
    const wizardPanel = container.wizard
        ? <Wizard container={container} context={effectiveContext} renderStep={(step) => {
            const stepContainer = (containers || []).find((entry) => entry.id === step.containerId);
            return stepContainer ? <Container context={resolveChildContext(effectiveContext, stepContainer.dataSourceRef || dataSourceRef)} container={stepContainer} isActive={isActive} dataSourceFetchMode={dataSourceFetchMode}/> : null;
        }}/>
        : null;
    const draftFormPanel = container.draftForm ? <DraftForm container={container} context={effectiveContext}/> : null;
    const queryToolbarPanel = container.queryToolbar ? <QueryToolbar container={container} context={effectiveContext}/> : null;
    const resourceHeaderPanel = container.resourceHeader ? <ResourceHeader container={container} context={effectiveContext}/> : null;
    const relationDrillPanel = container.relationDrill ? <RelationDrill container={container} context={effectiveContext}/> : null;
    const notificationRulesPanel = container.notificationRules ? <NotificationRules container={container} context={effectiveContext}/> : null;
    const metricSummaryPanel = container.metricSummary ? <MetricSummary container={container} context={effectiveContext}/> : null;
    const detailViewPanel = container.detailView ? <DetailView container={container} context={effectiveContext}/> : null;
    const masterDetailPanel = container.masterDetail ? <MasterDetail container={container} context={effectiveContext} renderRegion={(entry) => entry ? <Container context={resolveChildContext(effectiveContext, entry.dataSourceRef || dataSourceRef)} container={entry} isActive={isActive} dataSourceFetchMode={dataSourceFetchMode}/> : null}/> : null;

    let chartPanel = null
    if (chart) {
        chartPanel = (<>
            <Chart context={resolveChildContext(effectiveContext, dataSourceRef)} container={container} isActive={isActive}></Chart>
        </>);
    }

    // Chat panel support
    let chatPanel = null;
    if (container.chat) {
        const dsRef = container.chat.dataSourceRef || dataSourceRef;
        chatPanel = (
            <Chat
                context={resolveChildContext(effectiveContext, dsRef)}
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
                context={resolveChildContext(effectiveContext, dsRef)}
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
                context={resolveChildContext(effectiveContext, dsRef)}
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
                context={resolveChildContext(effectiveContext, dsRef)}
                config={container.treeBrowser}
                isActive={isActive}
            />
        );
    }


    let editorPanel = null;
    if (container.editor) {
        editorPanel = (
            <Editor
                    context={resolveChildContext(effectiveContext, dataSourceRef)}
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

        const subCtx = resolveChildContext(effectiveContext, dsRef);

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
    if (hasContainerClass(container, 'forge-fields-between')) delete gridStyle.display;

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
        tablePanel || assignmentPanel || derivedDataSourcePanel || mutationCommandPanel || statusWorkflowPanel || treeEditorPanel || wizardPanel || uploadCollectionPanel || historyDiffPanel || scheduleEditorPanel || draftFormPanel || queryToolbarPanel || resourceHeaderPanel || relationDrillPanel || notificationRulesPanel || metricSummaryPanel || detailViewPanel || masterDetailPanel || chartPanel || chatPanel || terminalPanel || fileBrowserPanel || treeBrowserPanel || editorPanel || schemaFormPanel || formPanel || (containers && containers.length > 0);
    if (!hasVisual && !shouldSkipGenericNonVisualEarlyReturn(container)) {
        return (
            <>
                {containerWantsFetcher && (
                    <DataSourceFetcher
                        key={`auto-fetcher-${container.id}`}
                        context={resolveChildContext(effectiveContext, container.dataSourceRef || dataSourceRef)}
                        selectFirst={container.selectFirst === true}
                        fetchData={container.fetchData === true}
                        fetchOnce={dataSourceFetchMode === 'once'}
                    />
                )}
            </>
        );
    }

    const controlContext = effectiveContext?.signals
        ? effectiveContext
        : resolveChildContext(effectiveContext, dataSourceRef);
    const handlers = useControlEvents(controlContext, visualItems || [], state)

    const visibleWhen = getDashboardVisibleWhen(container);
    if (visibleWhen) {
        const visible = isContainerVisible(container, effectiveContext);
        if (!visible) return null;
    }

    // Optional container-level toolbar
    const renderContainerToolbar = () => {
        const tb = container.toolbar;
        if (!tb) return null;
        let tbContext = effectiveContext;
        if (tb.dataSourceRef) {
            tbContext = resolveChildContext(effectiveContext, tb.dataSourceRef);
        }
        if (Array.isArray(tb.items)) {
            const wrapperStyle = tb.style || {};
            const wrapperClass = tb.className || '';
            return (
                <div className={`mb-2 ${wrapperClass}`} style={wrapperStyle}>
                    <TableToolbar
                        context={tbContext}
                        toolbarItems={tb.items}
                        density={tb.density}
                        layout={tb.layout}
                        className={tb.className}
                        style={tb.style}
                    />
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
            const stretchItems = layout?.itemStretch !== false;
            return (
                <GridLayoutRenderer
                    context={effectiveContext}
                    container={{...container, layout: {labels: {mode: 'none'}, ...container.layout}}}
                    entries={containers.map((entry) => ({...entry, hideLabel: true}))}
                    baseDataSourceRef={dataSourceRef}
                    style={style}
                    renderEntry={({entry, context: subCtx, css}) => (
                        <div
                            key={`${entry.id}-container`}
                            style={{
                                ...css.ctrl,
                                display: 'flex',
                                minHeight: 0,
                                minWidth: 0,
                                // Auto grid tracks derive their height from content.
                                height: 'auto',
                                alignSelf: stretchItems ? 'stretch' : 'start',
                            }}
                        >
                            <Container
                                sizingMode={entry.sizingMode || 'content'}
                                context={subCtx}
                                container={entry}
                                isActive={isActive}
                                dataSourceFetchMode={dataSourceFetchMode}
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
                        <div
                            key={'dSc' + subContainer.id}
                            style={{
                                width: '100%',
                                height: '100%',
                                minHeight: 0,
                                minWidth: 0,
                                display: 'flex',
                                flexDirection: 'column',
                            }}
                        >
                            <Container
                                key={'Sc' + subContainer.id}
                                context={resolveChildContext(effectiveContext, subContainer.dataSourceRef || dataSourceRef)}
                                container={subContainer}
                                isActive={isActive}
                                dataSourceFetchMode={dataSourceFetchMode}
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
                    flex: sizingMode === 'fill' ? '1 1 0' : '0 0 auto',
                    minHeight: 0,
                    minWidth: 0,
                }}
            >
                {containers.map((subContainer, index) => {
                    const isLast = index === containers.length - 1;
                    const childStyle = {
                        display: 'flex',
                        flexDirection: 'column',
                        flex: resolveContainerSizing(subContainer, sizingMode === 'fill' && (isHorizontal || isLast) ? 'fill' : 'content') === 'fill' ? '1 1 0' : '0 0 auto',
                        minHeight: 0,
                        minWidth: 0,
                        overflow: 'visible',
                    };
                    return (
                        <div key={'dSc' + subContainer.id} style={childStyle}>
                            <Container
                                sizingMode={sizingMode === 'fill' && (isHorizontal || isLast) ? 'fill' : 'content'}
                                key={'Sc' + subContainer.id}
                                context={resolveChildContext(effectiveContext, subContainer.dataSourceRef || dataSourceRef)}
                                container={subContainer}
                                isActive={isActive}
                                dataSourceFetchMode={dataSourceFetchMode}
                            />
                        </div>
                    )
                })}
            </div>
        );
    };

    const shouldAllocateChartRemainder =
        !!chartPanel &&
        !tablePanel &&
        !chatPanel &&
        !terminalPanel &&
        !fileBrowserPanel &&
        !treeBrowserPanel &&
        !editorPanel &&
        !schemaFormPanel &&
        !formPanel &&
        (!containers || containers.length === 0);

    const renderDashboardBlockContainer = (subContainer) => {
        const subCtx = resolveChildContext(effectiveContext, subContainer.dataSourceRef || dataSourceRef);
        return (
            <Container
                key={`dashboard-block-${subContainer.id || subContainer.kind}`}
                context={subCtx}
                container={subContainer}
                isActive={isActive}
                dataSourceFetchMode={dataSourceFetchMode}
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
                        context={resolveChildContext(effectiveContext, container.dataSourceRef || dataSourceRef)}
                        selectFirst={container.selectFirst === true}
                        fetchData={container.fetchData === true}
                        fetchOnce={dataSourceFetchMode === 'once'}
                    />
                )}
            </>
        );
    }

    if (isDashboardBlock) {
        const blockContext = resolveChildContext(effectiveContext, container.dataSourceRef || dataSourceRef);
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
                        fetchOnce={dataSourceFetchMode === 'once'}
                    />
                )}
            </>
        );
    }

    const boundLabelItems = Array.isArray(visualItems)
        ? visualItems.filter((item) => item?.type === 'label' && item?.dataField)
        : [];
    const shouldRenderSectionNoDataState =
        !tablePanel &&
        !chartPanel &&
        !chatPanel &&
        !terminalPanel &&
        !fileBrowserPanel &&
        !treeBrowserPanel &&
        !editorPanel &&
        !schemaFormPanel &&
        !formPanel &&
        (!containers || containers.length === 0) &&
        isPureBoundLabelSection(visualItems) &&
        boundLabelItems.length > 0 &&
        boundLabelItems.every((item) => {
            const itemDataSourceRef = resolveDynamicDataSourceRef(item, effectiveContext, dataSourceRef);
            const subCtx = resolveChildContext(effectiveContext, itemDataSourceRef);
            return isMissingBoundValue(resolveContainerItemValue(item, subCtx));
        });
    const shouldRenderVisualItems = !shouldRenderSectionNoDataState;

    return wrapContainerChrome(container, (
        <PermissionBoundary sizingMode={sizingMode} container={container} context={effectiveContext}>
            <DataStateBoundary sizingMode={sizingMode} container={container} context={effectiveContext}>
            <div {...(!container?.card && !container?.section ? containerAnchorProps(container) : {})} className={!container.card && !container.section ? containerSurfaceClass(container, 'body') : 'forge-container-body'} data-forge-part="container-content" data-forge-sizing={sizingMode} data-forge-scroll={container.scrollMode === 'self' ? 'self' : 'parent'} style={rootSizingStyle}>
                {resourceHeaderPanel}
                {notificationRulesPanel}
                {queryToolbarPanel}
                {metricSummaryPanel}
                {relationDrillPanel}
                {detailViewPanel}
                {masterDetailPanel}
                {container.toolbar ? renderContainerToolbar() : null}
                {shouldRenderVisualItems && (visualItems?.length || 0) > 0 ? (
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
                        <div data-forge-part="fields" style={gridStyle}>
                            {visualItems.map((item) => {
                                const subCtx = resolveChildContext(effectiveContext, item.dataSourceRef || dataSourceRef)
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
                {shouldAllocateChartRemainder ? (
                    <div style={{
                        flex: container?.style?.minHeight ? '0 0 auto' : '1 1 0',
                        minHeight: container?.style?.minHeight || 0,
                        minWidth: 0,
                        display: 'flex',
                        flexDirection: 'column',
                    }}>
                        {chartPanel}
                    </div>
                ) : chartPanel}
                {chatPanel}
                {terminalPanel}
                {derivedDataSourcePanel}
                {assignmentPanel}
                {mutationCommandPanel}
                {statusWorkflowPanel}
                {treeEditorPanel}
                {wizardPanel}
                {uploadCollectionPanel}
                {historyDiffPanel}
                {scheduleEditorPanel}
                {tablePanel}
                {fileBrowserPanel}
                {treeBrowserPanel}
                {editorPanel}
                {schemaFormPanel}
                {formPanel ? formPanel : (wizardPanel || masterDetailPanel) ? null :
                    renderNestedContainers()
                }
                {draftFormPanel}
                {shouldRenderSectionNoDataState ? (
                    <div
                        style={{
                            marginTop: 12,
                            padding: '10px 12px',
                            borderRadius: 10,
                            background: '#f8fafc',
                            border: '1px dashed #d8e1ea',
                            color: '#7d8da1',
                            fontSize: 12,
                            fontStyle: 'italic',
                        }}
                    >
                        {container?.title
                            ? `No data available for ${container.title} yet.`
                            : 'No data available for this section yet.'}
                    </div>
                ) : null}

            </div>
            </DataStateBoundary>
            {/* Container-level fetcher */}
            {containerWantsFetcher && (
                <DataSourceFetcher
                    key={`auto-fetcher-${container.id}-${dataSourceRef}`}
                    context={resolveChildContext(effectiveContext, dataSourceRef)}
                    selectFirst={container.selectFirst === true}
                    fetchData={container.fetchData === true}
                    fetchOnce={dataSourceFetchMode === 'once'}
                />
            )}
        </PermissionBoundary>
    ), suppressTitle, persistentSectionProperties, sizingMode);
};

export default Container;
