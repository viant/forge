import React, {useEffect, useMemo, useState} from 'react';
import {useSignals} from '@preact/signals-react/runtime';

import {Spinner} from '@blueprintjs/core';
import SoftSkeleton, { SoftBlock } from './SoftSkeleton.jsx';

import {
    getMetadataSignal,
    findMetadataSignal,
    getCollectionSignal,
    getControlSignal,
    findDialogSignal,
    getInputSignal,
    findFormSignal,
    primeWindowSignals,
    removeWindow,
} from '../core';

import {Context} from '../core';
import {useSetting} from '../core';
import {clearWindowContext, getWindowContext, setWindowContext} from '../core/context/registry.js';

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

    addRef(node.dataSourceRef);
    addRef(resolveMappedRef(node));

    if (node.chart) {
        addRef(node.chart.dataSourceRef);
        addRef(resolveMappedRef(node.chart));
    }

    if (Array.isArray(node.items)) {
        for (const item of node.items) {
            addRef(item?.dataSourceRef);
            addRef(resolveMappedRef(item));
        }
    }

    if (Array.isArray(node.containers)) {
        for (const child of node.containers) {
            collectRequiredDataSourceRefs(child, scope, refs);
        }
    }
}

function collectFetcherOwnedDataSourceRefs(node, refs) {
    if (!node || typeof node !== "object") return;

    if ((node.fetchData === true || node.selectFirst === true) && String(node.dataSourceRef || "").trim()) {
        refs.add(String(node.dataSourceRef).trim());
    }

    if (Array.isArray(node.containers)) {
        for (const child of node.containers) {
            collectFetcherOwnedDataSourceRefs(child, refs);
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

export function resolveRequiredDataSourceRefs(metadata, defaultDataSourceRef = '', scope = {}) {
    const refs = new Set();
    if (defaultDataSourceRef) refs.add(String(defaultDataSourceRef).trim());
    collectRequiredDataSourceRefs(metadata?.view?.content || null, scope, refs);
    return expandRequiredDataSourceRefs(metadata, refs);
}

export function resolveFetcherOwnedDataSourceRefs(metadata) {
    const refs = new Set();
    collectFetcherOwnedDataSourceRefs(metadata?.view?.content || null, refs);
    return Array.from(refs);
}

export function shouldPrimeDataSourceFetch(dataSource = {}, prevInput = {}, collection = [], paramsChanged = false) {
    const autoFetchEnabled = dataSource?.autoFetch !== false;
    const hasCollection = Array.isArray(collection) && collection.length > 0;
    return !!prevInput.fetch || (autoFetchEnabled && (paramsChanged || !hasCollection));
}

function hasOwnDataSourceParameters(dataSource = {}, windowParameters = {}) {
    const metadataParameters = Array.isArray(dataSource?.parameters) ? dataSource.parameters : [];
    if (metadataParameters.length > 0) {
        return true;
    }
    if (windowParameters && typeof windowParameters === 'object') {
        return Object.keys(windowParameters).length > 0;
    }
    return false;
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
    const isHostedWorkspaceSurface = String(window?.presentation || '').trim().toLowerCase() === 'hosted'
        && String(window?.region || '').trim().toLowerCase() === 'chat.top';
    const baseKey = (windowKey || '').split('?')[0];
    const defaultDataSourceRef = metadata?.view?.dataSourceRef || Object.keys(metadata?.dataSource || {})[0];
    const initialWindowFormSeed = useMemo(() => ({
        ...(parameters && typeof parameters === 'object' ? parameters : {}),
        ...resolveInitialWindowFormValues(metadata),
    }), [parameters, metadata]);
    const windowFormSignal = useMemo(() => findFormSignal(`${windowId}:windowForm`), [windowId]);

    const hookContext = Context(windowId, metadata, defaultDataSourceRef, services);
    const existingContext = getWindowContext(windowId);
    const context = existingContext?.metadata === metadata ? existingContext : hookContext;

    const liveWindowForm = windowFormSignal?.value || {};
    const windowFormSnapshot = useMemo(() => ({
        ...initialWindowFormSeed,
        ...liveWindowForm,
    }), [initialWindowFormSeed, liveWindowForm]);

    useEffect(() => {
        if (!context) {
            return undefined;
        }
        context.init?.();
        setWindowContext(windowId, context);
        return () => {
            clearWindowContext(windowId);
        };
    }, [windowId, context]);

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
        const resolvedRefs = resolveRequiredDataSourceRefs(metadata, defaultDataSourceRef, windowFormSnapshot);
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
    const fetcherOwnedDataSourceRefs = useMemo(
        () => new Set(resolveFetcherOwnedDataSourceRefs(metadata)),
        [metadata],
    );

    useEffect(() => {
        const currentWindowForm = windowFormSignal?.value || {};
        const resolvedRefs = resolveRequiredDataSourceRefs(metadata, defaultDataSourceRef, {
            ...initialWindowFormSeed,
            ...currentWindowForm,
        });
        const dataSourceDefs = metadata?.dataSource || {};
        for (const ref of resolvedRefs) {
            const dsID = `${windowId}DS${ref}`;
            const inputSignal = getInputSignal(dsID);
            const controlSignal = getControlSignal(dsID);
            const collectionSignal = getCollectionSignal(dsID);
            const prevInput = inputSignal?.peek?.() || {};
            const prevParams = prevInput.parameters || {};
            const dsContext = context?.Context?.(ref);
            const explicitWindowParams = (parameters?.[ref]?.parameters) || {};
            const dataSourceDef = dataSourceDefs?.[ref] || {};
            const resolvedMetaParamsRaw = Array.isArray(dataSourceDefs?.[ref]?.parameters)
                ? resolveParameters(dataSourceDefs[ref].parameters, dsContext || context)
                : {};
            const resolvedMetaParams = resolvedMetaParamsRaw && typeof resolvedMetaParamsRaw === 'object' && resolvedMetaParamsRaw.inbound
                ? resolvedMetaParamsRaw.inbound
                : (resolvedMetaParamsRaw || {});
            const nextParams = {
                ...(resolvedMetaParams || {}),
                ...(explicitWindowParams || {}),
            };
            const ownsParameters = hasOwnDataSourceParameters(dataSourceDef, explicitWindowParams);
            const paramsChanged = JSON.stringify(prevParams) !== JSON.stringify(nextParams);
            const collection = collectionSignal?.peek?.() || [];
            const control = controlSignal?.peek?.() || {};
            const shouldFetch = shouldPrimeDataSourceFetch(dataSourceDef, prevInput, collection, paramsChanged);
            const fetchOwnedByContainer = fetcherOwnedDataSourceRefs.has(ref);
            if (!ownsParameters && !shouldFetch) {
                continue;
            }
            if (!ownsParameters && shouldFetch) {
                inputSignal.value = {
                    ...prevInput,
                    fetch: fetchOwnedByContainer ? !!prevInput.fetch : true,
                };
                continue;
            }
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
                    ownsParameters,
                    paramsChanged,
                    shouldFetch,
                    fetchOwnedByContainer,
                    collectionSize: Array.isArray(collection) ? collection.length : 0,
                });
            } catch (_) {}
            inputSignal.value = {
                ...prevInput,
                parameters: nextParams,
                fetch: fetchOwnedByContainer ? !!prevInput.fetch : shouldFetch,
            };
        }
    }, [windowFormSignal, metadata, defaultDataSourceRef, initialWindowFormSeed, context, parameters, windowId, log, fetcherOwnedDataSourceRefs]);

    const renderDataSources = () => {
        if (!context) return null;
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
        if (!context) return null;
        if (!dialogs || dialogs.length === 0) return null;
        const view = metadata.view || {};
        const dataSourceRef = view.dataSourceRef || Object.keys(dataSources)[0];
        return (
            <>
                {dialogs
                    .filter((dialog) => {
                        const dialogId = String(dialog?.id || '').trim();
                        if (!dialogId) return false;
                        return !!findDialogSignal(`${windowId}Dialog${dialogId}`)?.value?.open;
                    })
                    .map((dialog) => {
                        const dialogId = String(dialog?.id || '').trim();
                        const dialogSignal = findDialogSignal(`${windowId}Dialog${dialogId}`)?.value || {};
                        const dialogProps = dialogSignal?.props || {};
                        const selectionMode = String(dialogSignal?.selectionMode || dialog?.selectionMode || dialog?.properties?.selectionMode || '').trim().toLowerCase()
                            || (dialogProps?.multiple === true
                                ? 'multi'
                                : (dialogProps?.multiple === false ? 'single' : ''));
                        return (
                            <ViewDialog
                                key={`${windowId}/D/${dialog.id}`}
                                context={context.dialogContext(
                                    dialog,
                                    dialog.dataSourceRef || dataSourceRef,
                                    selectionMode ? { selectionMode } : {},
                                )}
                                dialog={dialog}
                            />
                        );
                    })}
            </>
        );
    };

    // Selection-aware default footer for floating windows.
    // Supports caller overrides via openWindow options.footer = {
    //   ok:     { handler?: 'ns.fn', label?: 'Select', requireSelection?: true }
    //   cancel: { handler?: 'ns.fn', label?: 'Cancel' }
    // }
    const FloatingFooter = () => {
        if (!context) return null;
        const dsCtx = context.Context(context.identity.dataSourceRef);
        const selectionValue = dsCtx?.signals?.selection?.value;
        const canSelect = !!(selectionValue && (selectionValue.selected || (Array.isArray(selectionValue.selection) && selectionValue.selection.length > 0)));

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

    if (!windowFormSignal || !context) {
        return (
            <div style={{ padding: 16, height: '100%', minHeight: 0 }}>
                <SoftSkeleton lines={1} height={18} style={{ marginBottom: 12 }} />
                <SoftBlock height={180} />
            </div>
        );
    }

    return (
        <div
            data-window-id={windowId}
            style={{
                height: isHostedWorkspaceSurface ? 'auto' : '100%',
                minHeight: isHostedWorkspaceSurface ? 'max-content' : 0,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                flex: isHostedWorkspaceSurface ? '0 0 auto' : 1,
                overflow: isHostedWorkspaceSurface ? 'visible' : 'hidden',
            }}
        >
            {renderDataSources()}
            {renderDialogs()}
            <WindowLayout
                title={`${windowKey.toUpperCase()}${windowData ? ` (${windowData})` : ''}`}
                context={context}
                onClose={() => {
                    removeWindow(windowId);
                }}
                isInTab={window.isInTab}
                fillParent={!isHostedWorkspaceSurface}
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
    const baseKey = windowKey.split('?')[0];

    const [metadataSignalHandle, setMetadataSignalHandle] = useState(() => findMetadataSignal(windowId));
    const [loading, setLoading] = useState(() => !(metadataSignalHandle?.peek?.()));
    const [fetchError, setFetchError] = useState(null);
    const [signalsReady, setSignalsReady] = useState(() => !!(metadataSignalHandle?.peek?.()));

    // Settings & connector
    const {endpoints = {}, connectorConfig = {}, services = {}, targetContext = {}, useAuth = () => ({})} = useSetting();
    const auth = useAuth();
    const resolvedServices = useMemo(() => ({
        ...(services || {}),
        __connectorRuntime: {
            endpoints,
            targetContext,
            auth,
        },
    }), [services, endpoints, targetContext, auth]);
    if (!connectorConfig.window) {
        throw new Error('No connectorConfig.window found');
    }

    const {service} = connectorConfig.window;
    const config  = {service: {...service, uri: `${service.uri}/${baseKey}`, includeTargetContext: true}};
    const connector = useDataConnector(config);

    useEffect(() => {
        const existingSignal = findMetadataSignal(windowId);
        if (existingSignal) {
            setMetadataSignalHandle(existingSignal);
            return;
        }
        const createdSignal = getMetadataSignal(windowId);
        setMetadataSignalHandle(createdSignal);
    }, [windowId]);

    // Fetch metadata once per windowId
    useEffect(() => {
        let cancelled = false;
        if (!metadataSignalHandle) {
            return () => { cancelled = true; };
        }
        const existingMetadata = metadataSignalHandle.peek?.();
        const existingWindowKey = String(existingMetadata?.__windowKey || '').trim();
        if (existingMetadata && existingWindowKey === baseKey) {
            setFetchError(null);
            setLoading(false);
            return () => { cancelled = true; };
        }
        setSignalsReady(false);
        setLoading(true);
        setFetchError(null);

        // Dynamic windows can supply inline metadata (skip remote fetch).
        if (window && window.inlineMetadata) {
            try {
                injectActions(window.inlineMetadata);
                metadataSignalHandle.value = { ...window.inlineMetadata, __windowKey: baseKey };
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
                metadataSignalHandle.value = { ...resp.data, __windowKey: baseKey };
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
    }, [windowId, baseKey, metadataSignalHandle]);

    useEffect(() => {
        const metadata = metadataSignalHandle?.value;
        if (!metadata || typeof metadata !== 'object') return;
        primeWindowSignals(windowId, metadata);
        setSignalsReady(true);
    }, [windowId, metadataSignalHandle?.value, resolvedServices]);

    const metadata = metadataSignalHandle?.peek?.();

    if (loading || !signalsReady) {
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
            services={resolvedServices}
        />
    );
}
