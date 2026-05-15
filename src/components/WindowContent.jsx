import React, {useEffect, useMemo, useState} from 'react';
import {useSignals} from '@preact/signals-react/runtime';
import {useSignalEffect} from '@preact/signals-react';

import {Spinner} from '@blueprintjs/core';
import SoftSkeleton, { SoftBlock } from './SoftSkeleton.jsx';

import {
    getMetadataSignal,
    getCollectionSignal,
    getControlSignal,
    getInputSignal,
    getFormSignal,
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
import { mergeWindowFormValues } from '../hooks/dataSource.js';
import {injectActions} from '../actions';
import { resolveMetadataForTarget } from '../runtime/metadataResolver.js';
import { resolveParameters } from '../hooks/parameters.js';
import { resolveSelector } from '../utils/selector.js';
import { getLogger } from '../utils/logger.js';

function collectInitialWindowFormItemValues(node, initial) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node.items)) {
        for (const item of node.items) {
            if (!item || typeof item !== 'object') continue;
            if (String(item.scope || '').trim() === 'windowForm') {
                const fieldKey = String(item.bindingPath || item.dataField || item.id || '').trim();
                if (fieldKey && item.value !== undefined) {
                    initial[fieldKey] = item.value;
                }
            }
        }
    }
    if (Array.isArray(node.containers)) {
        for (const child of node.containers) {
            collectInitialWindowFormItemValues(child, initial);
        }
    }
}

export function resolveInitialWindowFormValues(metadata) {
    const windowCfg = metadata?.window || {};
    const onEntries = [
        ...(Array.isArray(windowCfg.on) ? windowCfg.on : []),
        ...(Array.isArray(metadata?.on) ? metadata.on : []),
    ];
    const initial = {};
    for (const entry of onEntries) {
        if (entry?.event !== 'onInit' || entry?.handler !== 'dataSource.setWindowFormData') continue;
        const parameters = Array.isArray(entry?.parameters) ? entry.parameters : [];
        for (const parameter of parameters) {
            if (parameter?.in !== 'const') continue;
            const name = String(parameter?.name || '').trim();
            if (!name) continue;
            initial[name] = parameter?.location;
        }
    }
    collectInitialWindowFormItemValues(metadata?.view?.content || null, initial);
    return initial;
}

function collectRequiredDataSourceRefs(node, scope, refs) {
    if (!node || typeof node !== 'object') return;

    const addRef = (ref) => {
        const value = String(ref || '').trim();
        if (value) refs.add(value);
    };

    const resolveMappedRef = (entry) => {
        const selector = String(entry?.dataSourceRefSelector || entry?.dataSourceSelector || '').trim();
        const mapping = entry?.dataSourceRefs;
        if (!selector || !mapping || typeof mapping !== 'object' || Array.isArray(mapping)) {
            return '';
        }
        const key = resolveSelector(scope || {}, selector);
        return key != null ? String(mapping[key] || '').trim() : '';
    };

    const addMappedRefs = (entry) => {
        const mapping = entry?.dataSourceRefs;
        if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) {
            return;
        }
        for (const value of Object.values(mapping)) {
            addRef(value);
        }
    };

    addRef(node.dataSourceRef);
    addMappedRefs(node);
    addRef(resolveMappedRef(node));

    if (node.chart) {
        addRef(node.chart.dataSourceRef);
        addMappedRefs(node.chart);
        addRef(resolveMappedRef(node.chart));
    }

    if (Array.isArray(node.items)) {
        for (const item of node.items) {
            addRef(item?.dataSourceRef);
            addMappedRefs(item);
            addRef(resolveMappedRef(item));
        }
    }

    if (Array.isArray(node.containers)) {
        for (const child of node.containers) {
            collectRequiredDataSourceRefs(child, scope, refs);
        }
    }
}

function expandRequiredDataSourceRefs(metadata, refs) {
    const all = metadata?.dataSource || {};
    const result = new Set(refs);
    const queue = [...result];
    while (queue.length > 0) {
        const ref = queue.shift();
        const parentRef = String(all?.[ref]?.dataSourceRef || '').trim();
        if (parentRef && !result.has(parentRef)) {
            result.add(parentRef);
            queue.push(parentRef);
        }
    }
    return Array.from(result);
}


/* ------------------------------------------------------------------
 * WindowContentInner – rendered ONLY after metadata has been fetched so
 * every render executes the same Hook sequence.  All code that calls
 * React hooks (including Context() which internally uses hooks) lives here.
 * ------------------------------------------------------------------ */

function WindowContentInner({window, metadata, services}) {
    useSignals();
    const log = getLogger('window');
    const {windowKey, windowData, windowId, parameters = {}} = window;
    const baseKey = (windowKey || '').split('?')[0];
    const defaultDataSourceRef = metadata?.view?.dataSourceRef || Object.keys(metadata?.dataSource || {})[0];
    const initialWindowFormSeed = useMemo(() => ({
        ...(parameters && typeof parameters === 'object' ? parameters : {}),
        ...resolveInitialWindowFormValues(metadata),
    }), [parameters, metadata]);
    const windowFormSignal = useMemo(() => getFormSignal(`${windowId}:windowForm`), [windowId]);

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
        if (Object.keys(initialWindowFormSeed).length > 0 && windowFormSignal) {
            try {
                log.debug('[window.windowFormSeed]', {
                    windowId,
                    windowKey,
                    seed: initialWindowFormSeed,
                    before: windowFormSignal.peek?.() || {},
                });
            } catch (_) {}
            windowFormSignal.value = initialWindowFormSeed;
            try {
                log.debug('[window.windowFormSeedApplied]', {
                    windowId,
                    windowKey,
                    after: windowFormSignal.peek?.() || {},
                });
            } catch (_) {}
        }
        return ctx;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [windowId, metadata, initialWindowFormSeed, windowFormSignal]);

    const liveWindowForm = windowFormSignal?.value || {};
    const windowFormSnapshot = useMemo(() => ({
        ...initialWindowFormSeed,
        ...liveWindowForm,
    }), [initialWindowFormSeed, liveWindowForm]);
    useEffect(() => {
        const currentSignature = JSON.stringify(liveWindowForm);
        const mergedSignature = JSON.stringify(windowFormSnapshot);
        if (currentSignature === mergedSignature || !windowFormSignal) {
            return;
        }
        try {
            log.debug('[window.windowFormReconcile]', {
                windowId,
                windowKey,
                seed: initialWindowFormSeed,
                current: liveWindowForm,
                reconciled: windowFormSnapshot,
            });
        } catch (_) {}
        windowFormSignal.value = windowFormSnapshot;
    }, [initialWindowFormSeed, liveWindowForm, windowFormSignal, windowFormSnapshot, windowId, windowKey]);

    /* ------------------------------------------------------------
     * Execute window-level onInit events (declared in metadata.window.on)
     * ---------------------------------------------------------- */

    useEffect(() => {
        const windowCfg   = metadata.window || {};
        const windowOnArr = [
            ...(Array.isArray(windowCfg.on) ? windowCfg.on : []),
            ...(Array.isArray(metadata.on) ? metadata.on : []), // fallback top-level
        ];

        const runHandlers = (eventName) => {
            const evts = windowOnArr.filter((e) => e.event === eventName);
            evts.forEach((ev) => {
                try {
                    const { handler: handlerId, args = [], parameters = [] } = ev;
                    if (handlerId === 'dataSource.setWindowFormData') {
                        const resolvedParameters = resolveParameters(parameters, {
                            identity: { dataSourceRef: defaultDataSourceRef },
                            signals: { windowForm: windowFormSignal },
                            dataSources: metadata?.dataSource || {},
                            Context() { return this; },
                            handlers: {
                                dataSource: {
                                    peekFormData: () => ({}),
                                    peekSelection: () => ({ selected: null }),
                                    peekFilter: () => ({}),
                                },
                            },
                        });
                        try {
                            log.debug('[window.onInit]', {
                                windowId,
                                windowKey,
                                handlerId,
                                parameters,
                                resolvedParameters,
                                before: windowFormSignal?.peek?.() || {},
                            });
                        } catch (_) {}
                        windowFormSignal.value = mergeWindowFormValues(windowFormSignal.peek?.() || {}, resolvedParameters || {});
                        try {
                            log.debug('[window.onInitApplied]', {
                                windowId,
                                windowKey,
                                handlerId,
                                after: windowFormSignal?.peek?.() || {},
                            });
                        } catch (_) {}
                        return;
                    }

                    const handlerContext = context.Context(defaultDataSourceRef);
                    const fn = handlerContext.lookupHandler(handlerId);
                    const resolvedParameters = resolveParameters(parameters, handlerContext);
                    try {
                        log.debug('[window.onInit]', {
                            windowId,
                            windowKey,
                            handlerId,
                            parameters,
                            resolvedParameters,
                            before: handlerContext?.signals?.windowForm?.peek?.() || {},
                        });
                    } catch (_) {}
                    fn({
                        execution: { id: handlerId, args, parameters },
                        args,
                        parameters: resolvedParameters,
                        context: handlerContext,
                    });
                    try {
                        log.debug('[window.onInitApplied]', {
                            windowId,
                            windowKey,
                            handlerId,
                            after: handlerContext?.signals?.windowForm?.peek?.() || {},
                        });
                    } catch (_) {}
                } catch (err) {
                    console.error(`window.${eventName} handler failed`, ev.handler, err);
                }
            });
        };

        // onInit equivalent
        runHandlers('onInit');

        // cleanup → onDestroy
        return () => {
            runHandlers('onDestroy');
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [windowId]);

    useEffect(() => {
        const rootContainer = metadata?.view?.content || null;
        if (!rootContainer || rootContainer.kind !== 'dashboard') return;
        if (!windowId || !rootContainer.id) return;
        try {
            context.handlers?.window?.resetDashboardState?.({
                context,
                parameters: { dashboardId: rootContainer.id }
            });
        } catch (err) {
            console.error('window dashboard init failed', err);
        }
    }, [context, metadata, windowId]);

    const dataSources = metadata.dataSource || {};
    const dialogs     = metadata.dialogs   || [];

    /* ------------------------------------------------------------
     * Rendering helpers
     * ---------------------------------------------------------- */

    const requiredDataSourceRefs = useMemo(() => {
        const refs = new Set();
        if (defaultDataSourceRef) refs.add(defaultDataSourceRef);
        collectRequiredDataSourceRefs(metadata?.view?.content || null, windowFormSnapshot, refs);
        const resolvedRefs = expandRequiredDataSourceRefs(metadata, refs);
        try {
            log.debug('[window.requiredDataSourceRefs]', {
                windowId,
                windowKey,
                windowForm: windowFormSnapshot,
                refs: resolvedRefs,
            });
        } catch (_) {}
        return resolvedRefs;
    }, [metadata, defaultDataSourceRef, windowFormSnapshot]);

    useSignalEffect(() => {
        const currentWindowForm = windowFormSignal?.value || {};
        const refs = new Set();
        if (defaultDataSourceRef) refs.add(defaultDataSourceRef);
        collectRequiredDataSourceRefs(metadata?.view?.content || null, {
            ...initialWindowFormSeed,
            ...currentWindowForm,
        }, refs);
        const resolvedRefs = expandRequiredDataSourceRefs(metadata, refs);
        const dataSourceDefs = metadata?.dataSource || {};
        for (const ref of resolvedRefs) {
            const dsID = `${windowId}DS${ref}`;
            const inputSignal = getInputSignal(dsID);
            const controlSignal = getControlSignal(dsID);
            const collectionSignal = getCollectionSignal(dsID);
            const prevInput = inputSignal?.peek?.() || {};
            const prevParams = prevInput.parameters || {};
            const dsContext = context?.Context?.(ref);
            const resolvedMetaParamsRaw = Array.isArray(dataSourceDefs?.[ref]?.parameters)
                ? resolveParameters(dataSourceDefs[ref].parameters, dsContext || context)
                : {};
            const resolvedMetaParams = resolvedMetaParamsRaw && typeof resolvedMetaParamsRaw === 'object' && resolvedMetaParamsRaw.inbound
                ? resolvedMetaParamsRaw.inbound
                : (resolvedMetaParamsRaw || {});
            const nextParams = {
                ...(resolvedMetaParams || {}),
                ...((parameters?.[ref]?.parameters) || {}),
            };
            const paramsChanged = JSON.stringify(prevParams) !== JSON.stringify(nextParams);
            const collection = collectionSignal?.peek?.() || [];
            const control = controlSignal?.peek?.() || {};
            const shouldFetch = paramsChanged || (Array.isArray(collection) && collection.length === 0);
            if (!paramsChanged && !shouldFetch) {
                continue;
            }
            try {
                log.debug('[window.datasourceParams]', {
                    windowId,
                    ref,
                    windowForm: currentWindowForm,
                    prevParams,
                    nextParams,
                    resolvedMetaParams,
                    paramsChanged,
                    shouldFetch,
                    collectionSize: Array.isArray(collection) ? collection.length : 0,
                });
            } catch (_) {}
            inputSignal.value = {
                ...prevInput,
                parameters: nextParams,
                fetch: shouldFetch || !!prevInput.fetch,
            };
        }
    });

    const renderDataSources = () => {
        return (
            <>
                {requiredDataSourceRefs.map((key) => (
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

    // Selection-aware default footer for floating windows.
    // Supports caller overrides via openWindow options.footer = {
    //   ok:     { handler?: 'ns.fn', label?: 'Select', requireSelection?: true }
    //   cancel: { handler?: 'ns.fn', label?: 'Cancel' }
    // }
    const FloatingFooter = () => {
        const dsCtx = context.Context(context.identity.dataSourceRef);
        const [canSelect, setCanSelect] = useState(false);
        useEffect(() => {
            const update = () => {
                try {
                    const sel = dsCtx?.signals?.selection?.value;
                    const has = !!(sel && (sel.selected || (Array.isArray(sel.selection) && sel.selection.length > 0)));
                    setCanSelect(has);
                } catch (_) {}
            };
            update();
            return () => {};
        }, [dsCtx]);

        const footerCfg = window.footer || {};
        const okCfg = footerCfg.ok || {};
        const cancelCfg = footerCfg.cancel || {};

        const onCancel = () => {
            try {
                if (cancelCfg.handler) {
                    const fn = context.lookupHandler(cancelCfg.handler);
                    return fn({ context: dsCtx, window, event: 'cancel' });
                }
            } catch (_) {}
            removeWindow(windowId);
        };

        const onOk = () => {
            try {
                if (okCfg.handler) {
                    const fn = context.lookupHandler(okCfg.handler);
                    return fn({ context: dsCtx, window, event: 'ok' });
                }
            } catch (_) {}
            context.handlers.window.commit?.({ context: dsCtx });
        };

        const requireSel = okCfg.requireSelection !== false; // default true
        const okLabel = okCfg.label || 'OK';
        const cancelLabel = cancelCfg.label || 'Cancel';

        return (
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 12px', borderTop: '1px solid #eee', position: 'sticky', bottom: 0, background: '#fff' }}>
                <button className="bp4-button bp4-minimal" onClick={onCancel}>{cancelLabel}</button>
                <button
                    className={`bp4-button bp4-intent-primary ${(!canSelect && requireSel) ? 'bp4-disabled' : ''}`}
                    disabled={!canSelect && requireSel}
                    onClick={onOk}
                    style={{ marginLeft: 8 }}
                >
                    {okLabel}
                </button>
            </div>
        );
    };

    return (
        <div data-window-id={windowId} style={{ height: '100%', minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
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
            {window.isInTab === false && !(window.footer && window.footer.hide === true) ? <FloatingFooter /> : null}
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
    const [fetchError, setFetchError] = useState(null);

    // Settings & connector
    const {connectorConfig = {}, services = {}, targetContext = {}} = useSetting();
    if (!connectorConfig.window) {
        throw new Error('No connectorConfig.window found');
    }

    const {service} = connectorConfig.window;
    const baseKey = windowKey.split('?')[0];
    const config  = {service: {...service, uri: `${service.uri}/${baseKey}`, includeTargetContext: true}};
    const connector = useDataConnector(config);

    // Fetch metadata once per windowId
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setFetchError(null);

        // Dynamic windows can supply inline metadata (skip remote fetch).
        if (window && window.inlineMetadata) {
            try {
                injectActions(window.inlineMetadata);
                metadataSignal.value = window.inlineMetadata;
            } catch (e) {
                console.error('Error applying inline metadata', e);
            } finally {
                if (!cancelled) setLoading(false);
            }
            return () => { cancelled = true; };
        }

        connector.get({})
            .then((resp) => {
                if (cancelled) return;
                setFetchError(null);
                injectActions(resp.data);
                metadataSignal.value = resp.data;
            })
            .catch((err) => {
                if (!cancelled) {
                    console.error('Error fetching metadata', err);
                    setFetchError(err);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });

        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [windowId]);

    const metadata = metadataSignal.peek();

    if (loading) {
        // Soft loading placeholder for window content
        return (
            <div style={{ padding: 16, height: '100%', minHeight: 0 }}>
                <SoftSkeleton lines={1} height={18} style={{ marginBottom: 12 }} />
                <SoftBlock height={180} />
            </div>
        );
    }

    if (!metadata) {
        const isAuthError = fetchError && (fetchError.status === 401 || fetchError.status === 403 || fetchError.isUnauthorized);
        return (
            <div style={{ padding: 16, height: '100%', minHeight: 0, color: '#888' }}>
                {fetchError
                    ? isAuthError
                        ? <span>Authentication required. Please sign in to continue.</span>
                        : <span>Failed to load window: {fetchError.message}</span>
                    : <span>No metadata available for window "{windowKey}"</span>}
            </div>
        );
    }

    return (
        <WindowContentInner
            window={{...window, isInTab}}
            metadata={metadata}
            services={services}
        />
    );
}
