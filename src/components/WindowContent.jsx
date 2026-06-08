import React, {useEffect, useMemo, useState} from 'react';
import {useSignals} from '@preact/signals-react/runtime';

import {Spinner} from '@blueprintjs/core';
import SoftSkeleton, { SoftBlock } from './SoftSkeleton.jsx';

import {
    activeWindows,
    getMetadataSignal,
    findMetadataSignal,
    getCollectionSignal,
    findCollectionSignal,
    getControlSignal,
    findDialogSignal,
    getInputSignal,
    findFormSignal,
    findMetricsSignal,
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
import { runWindowLifecycleHandlers } from './windowLifecycle.js';

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

export function resolveDefaultDataSourceRef(metadata) {
    return String(
        metadata?.view?.dataSourceRef
        || metadata?.view?.content?.dataSourceRef
        || Object.keys(metadata?.dataSource || {})[0]
        || ''
    ).trim();
}

function normalizeTargetKey(targetContext = {}) {
    const capabilities = Array.isArray(targetContext?.capabilities)
        ? targetContext.capabilities.map((item) => String(item || '').trim()).filter(Boolean).sort()
        : [];
    return JSON.stringify({
        platform: String(targetContext?.platform || '').trim(),
        formFactor: String(targetContext?.formFactor || '').trim(),
        surface: String(targetContext?.surface || '').trim(),
        capabilities,
    });
}

export function resolveWindowMetadataForTarget(metadata, targetContext = {}) {
    return resolveMetadataForTarget(metadata, targetContext) || metadata;
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

    if (node.fetchData === true && String(node.dataSourceRef || "").trim()) {
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
    const titleBindingRef = String(
        metadata?.window?.titleBinding?.dataSourceRef
        || metadata?.window?.titleBinding?.ref
        || metadata?.view?.titleBinding?.dataSourceRef
        || metadata?.view?.titleBinding?.ref
        || ''
    ).trim();
    if (titleBindingRef) {
        refs.add(titleBindingRef);
    }
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

function resolveBoundWindowTitle(metadata, window = {}) {
    const binding = metadata?.window?.titleBinding || metadata?.view?.titleBinding;
    const windowId = String(window?.windowId || '').trim();
    if (!binding || !windowId) {
        return '';
    }
    const dataSourceRef = String(binding?.dataSourceRef || binding?.ref || '').trim();
    const selector = String(binding?.selector || binding?.field || '').trim();
    const source = String(binding?.source || 'metrics').trim().toLowerCase();
    if (!dataSourceRef) {
        return '';
    }
    const dataSourceId = `${windowId}DS${dataSourceRef}`;
    let data = null;
    switch (source) {
        case 'collection':
        case 'data': {
            const collection = findCollectionSignal(dataSourceId)?.value;
            data = Array.isArray(collection) ? (collection[0] || null) : collection;
            break;
        }
        case 'metrics':
        default:
            data = findMetricsSignal(dataSourceId)?.value || null;
            break;
    }
    const resolved = selector ? resolveSelector(data || {}, selector) : data;
    if (resolved != null && String(resolved).trim() !== '') {
        return String(resolved).trim();
    }
    const domSelector = String(binding?.domSelector || binding?.selectorCss || '').trim();
    const controlId = String(binding?.controlId || binding?.domControlId || '').trim();
    if ((!controlId && !domSelector) || typeof document === 'undefined') {
        return '';
    }
    try {
        const base = document.querySelector(`[data-workspace-window-id="${windowId}"]`);
        const control = domSelector
            ? base?.querySelector?.(domSelector)
            : base?.querySelector?.(`[data-forge-control-id="${controlId}"]`);
        return String(control?.textContent || '').trim();
    } catch (_) {
        return '';
    }
}

function resolveNumericWindowRuntimeHint(metadata, key = '') {
    const value = Number(metadata?.[key]);
    return Number.isFinite(value) && value > 0 ? value : undefined;
}

function syncWindowRuntimeHints(windowId, metadata, windowState = null) {
    const normalizedWindowId = String(windowId || '').trim();
    if (!normalizedWindowId || !metadata || typeof metadata !== 'object') {
        return;
    }
    const current = Array.isArray(activeWindows.peek?.()) ? activeWindows.peek() : [];
    const matched = current.find((entry) => String(entry?.windowId || '').trim() === normalizedWindowId);
    if (!matched) {
        return;
    }
    const next = { ...matched };
    let changed = false;

    const metadataPresentation = String(metadata?.presentation || '').trim();
    if (metadataPresentation && String(next.presentation || '').trim() !== metadataPresentation) {
        next.presentation = metadataPresentation;
        changed = true;
    }
    const metadataRegion = String(metadata?.region || '').trim();
    if (metadataRegion && String(next.region || '').trim() !== metadataRegion) {
        next.region = metadataRegion;
        changed = true;
    }
    const metadataWorkspaceSharePct = resolveNumericWindowRuntimeHint(metadata, 'workspaceSharePct');
    if (metadataWorkspaceSharePct !== undefined && next.workspaceSharePct !== metadataWorkspaceSharePct) {
        next.workspaceSharePct = metadataWorkspaceSharePct;
        changed = true;
    }
    const metadataWorkspaceMinHeight = resolveNumericWindowRuntimeHint(metadata, 'workspaceMinHeight');
    if (metadataWorkspaceMinHeight !== undefined && next.workspaceMinHeight !== metadataWorkspaceMinHeight) {
        next.workspaceMinHeight = metadataWorkspaceMinHeight;
        changed = true;
    }
    if (windowState?.workspaceCollapsed !== undefined && next.workspaceCollapsed !== windowState.workspaceCollapsed) {
        next.workspaceCollapsed = windowState.workspaceCollapsed === true;
        changed = true;
    }
    if (!changed) {
        return;
    }
    activeWindows.value = current.map((entry) => (
        String(entry?.windowId || '').trim() === normalizedWindowId ? next : entry
    ));
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
    const shouldFillParent = isHostedWorkspaceSurface || window.isInTab !== false;
    const defaultDataSourceRef = resolveDefaultDataSourceRef(metadata);
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

    const desiredWindowTitle = resolveBoundWindowTitle(metadata, window);

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

    useEffect(() => {
        let title = String(desiredWindowTitle || '').trim();
        if (!title && typeof document !== 'undefined') {
            try {
                const binding = metadata?.window?.titleBinding || metadata?.view?.titleBinding;
                const domSelector = String(binding?.domSelector || binding?.selectorCss || '').trim();
                const controlId = String(binding?.controlId || binding?.domControlId || '').trim();
                if (controlId || domSelector) {
                    const base = document.querySelector(`[data-workspace-window-id="${windowId}"]`);
                    const control = domSelector
                        ? base?.querySelector?.(domSelector)
                        : base?.querySelector?.(`[data-forge-control-id="${controlId}"]`);
                    title = String(control?.textContent || '').trim();
                }
            } catch (_) {}
        }
        if (!title || !windowId) {
            return;
        }
        const current = Array.isArray(activeWindows.peek?.()) ? activeWindows.peek() : [];
        const matched = current.find((entry) => String(entry?.windowId || '').trim() === String(windowId || '').trim());
        if (!matched || String(matched?.windowTitle || '').trim() === title) {
            return;
        }
        activeWindows.value = current.map((entry) => (
            String(entry?.windowId || '').trim() === String(windowId || '').trim()
                ? { ...entry, windowTitle: title }
                : entry
        ));

        if (typeof document !== 'undefined') {
            try {
                const workspaceRoot = document.querySelector(`[data-workspace-window-id="${windowId}"]`);
                const titleNode = workspaceRoot?.querySelector?.('.app-window-split-workspace-title');
                if (titleNode) {
                    titleNode.textContent = title;
                }
                if (workspaceRoot) {
                    workspaceRoot.setAttribute('aria-label', `${title} workspace`);
                }
            } catch (_) {}
        }
    }, [desiredWindowTitle, windowId]);

    useEffect(() => {
        if (typeof document === 'undefined' || !windowId) {
            return;
        }
        const binding = metadata?.window?.titleBinding || metadata?.view?.titleBinding;
        const domSelector = String(binding?.domSelector || binding?.selectorCss || '').trim();
        const controlId = String(binding?.controlId || binding?.domControlId || '').trim();
        if (!controlId && !domSelector) {
            return;
        }
        try {
            const base = document.querySelector(`[data-workspace-window-id="${windowId}"]`);
            const control = domSelector
                ? base?.querySelector?.(domSelector)
                : base?.querySelector?.(`[data-forge-control-id="${controlId}"]`);
            const title = String(control?.textContent || '').trim();
            if (!title) {
                return;
            }
            const current = Array.isArray(activeWindows.peek?.()) ? activeWindows.peek() : [];
            const matched = current.find((entry) => String(entry?.windowId || '').trim() === String(windowId || '').trim());
            if (matched && String(matched?.windowTitle || '').trim() !== title) {
                activeWindows.value = current.map((entry) => (
                    String(entry?.windowId || '').trim() === String(windowId || '').trim()
                        ? { ...entry, windowTitle: title }
                        : entry
                ));
            }
            const workspaceRoot = document.querySelector(`[data-workspace-window-id="${windowId}"]`);
            const titleNode = workspaceRoot?.querySelector?.('.app-window-split-workspace-title');
            if (titleNode && titleNode.textContent !== title) {
                titleNode.textContent = title;
            }
            if (workspaceRoot) {
                workspaceRoot.setAttribute('aria-label', `${title} workspace`);
            }
        } catch (_) {}
    }, [windowId, metadata, desiredWindowTitle]);

    useEffect(() => {
        if (typeof window === 'undefined' || !windowId) {
            return;
        }
        let title = String(desiredWindowTitle || '').trim();
        if (!title) {
            try {
                const binding = metadata?.window?.titleBinding || metadata?.view?.titleBinding;
                const domSelector = String(binding?.domSelector || binding?.selectorCss || '').trim();
                const controlId = String(binding?.controlId || binding?.domControlId || '').trim();
                const base = document.querySelector(`[data-workspace-window-id="${windowId}"]`);
                const control = domSelector
                    ? base?.querySelector?.(domSelector)
                    : base?.querySelector?.(`[data-forge-control-id="${controlId}"]`);
                title = String(control?.textContent || '').trim();
            } catch (_) {}
        }
        if (!title) {
            return;
        }
        try {
            window.dispatchEvent(new CustomEvent('forge:window-title', {
                detail: {
                    windowId,
                    title,
                },
            }));
        } catch (_) {}
    }, [windowId, metadata, desiredWindowTitle]);

    /* ------------------------------------------------------------
     * Execute window-level onInit events (declared in metadata.window.on)
     * ---------------------------------------------------------- */

    useEffect(() => {
        runWindowLifecycleHandlers({
            eventName: 'onInit',
            metadata,
            context,
            defaultDataSourceRef,
            windowFormSignal,
            log,
            windowId,
            windowKey,
        });

        // cleanup → onDestroy
        return () => {
            runWindowLifecycleHandlers({
                eventName: 'onDestroy',
                metadata,
                context,
                defaultDataSourceRef,
                windowFormSignal,
                log,
                windowId,
                windowKey,
            });
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
                height: shouldFillParent ? '100%' : 'auto',
                minHeight: shouldFillParent ? 0 : 'max-content',
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                flex: shouldFillParent ? 1 : '0 0 auto',
                overflow: shouldFillParent ? 'hidden' : 'visible',
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
                fillParent={shouldFillParent}
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
    const prepareConnectorRequest = useMemo(() => (
        typeof services?.prepareDataConnectorRequest === 'function'
            ? (request) => services.prepareDataConnectorRequest({
                ...request,
                windowState: window,
            })
            : undefined
    ), [services, window]);
    const resolvedServices = useMemo(() => ({
        ...(services || {}),
        windowState: window,
        __connectorRuntime: {
            endpoints,
            targetContext,
            auth,
            prepareRequest: prepareConnectorRequest,
        },
    }), [services, endpoints, targetContext, auth, prepareConnectorRequest]);
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
        const targetKey = normalizeTargetKey(targetContext);
        const existingTargetKey = String(existingMetadata?.__targetKey || '').trim();
        if (existingMetadata && existingWindowKey === baseKey && existingTargetKey === targetKey) {
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
                const resolvedMetadata = resolveWindowMetadataForTarget(window.inlineMetadata, targetContext);
                injectActions(resolvedMetadata);
                metadataSignalHandle.value = { ...resolvedMetadata, __windowKey: baseKey, __targetKey: targetKey };
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
                const resolvedMetadata = resolveWindowMetadataForTarget(resp.data, targetContext);
                injectActions(resolvedMetadata);
                metadataSignalHandle.value = { ...resolvedMetadata, __windowKey: baseKey, __targetKey: targetKey };
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
    }, [windowId, baseKey, metadataSignalHandle, targetContext]);

    useEffect(() => {
        const metadata = metadataSignalHandle?.value;
        if (!metadata || typeof metadata !== 'object') return;
        syncWindowRuntimeHints(windowId, metadata, window);
        primeWindowSignals(windowId, metadata);
        setSignalsReady(true);
    }, [windowId, metadataSignalHandle?.value, resolvedServices, window]);

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
