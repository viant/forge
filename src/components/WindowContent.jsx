import {useWorkspaceRefresh,workspaceRefreshScopeIdentity} from '../runtime/useWorkspaceRefresh.js';
import {windowFillsAllocatedSpace, showWindowSelectionFooter} from './windowPresentationPolicy.js';
import {beginWindowStateAdoption, windowStateAdoptionCleared, completeWindowStateAdoption, rejectWindowStateAdoption} from '../runtime/windowStateAdoption.js';
import {ForgeThemeBoundary} from './ThemeBoundary.jsx';
import React, {useEffect, useMemo, useRef, useState} from 'react';
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
    getViewSignal,
    findFormSignal,
    findMetricsSignal,
    primeWindowSignals,
    clearProtectedWindowState,
    clearProtectedWindowDenial,
    getActiveUIBridgeTransportContext,
    protectedWindowDenials,
    removeWindow,
} from '../core';

import {Context, resolveWindowContentContext} from '../core';
import {useSetting} from '../core';
import {clearWindowContext, getWindowContext, setWindowContext} from '../core/context/registry.js';

import DataSource from './DataSource.jsx';
import MessageBus from './MessageBus.jsx';
import WindowLayout from './WindowLayout.jsx';
import ViewDialog from './ViewDialog.jsx';
import {openWindowPickerDialog} from './windowPickerDialog.js';
import DataSourceContainer from './WindowContentDataSourceContainer.jsx';

import {createDataConnector} from '../hooks/dataconnector.js';
import { mergeWindowFormValues } from '../hooks/dataSource.js';
import {usesLazyOptions} from '../runtime/optionsFetch.js';
import {resolveSectionOpenState, resolveSectionProperties} from './containerChrome.js';
import {applyParameterCodec} from '../hooks/parameters.js';
import {injectActions} from '../actions';
import { resolveMetadataForTarget } from '../runtime/metadataResolver.js';
import {canonicalSelectionBinding} from '../runtime/canonicalDelivery.js';
import {compileDeliveryHintView, normalizeAuthorizationSnapshot, resolveAuthorizationResourceID} from '../runtime/permittedView.js';
import { applyDataSourceParameterCodecs, resolveParameters } from '../hooks/parameters.js';
import { resolveSelector } from '../utils/selector.js';
import { evaluatePlainVisibleWhen } from './visibleWhen.js';
import { getLogger } from '../utils/logger.js';
import { runWindowLifecycleHandlers } from './windowLifecycle.js';
import { buildReportBuilderHostServices } from './dashboard/reportBuilderHostServices.js';
import { windowMetadataEndpoint } from './windowMetadataEndpoint.js';
import {useViewPartition} from './useViewPartition.js';
import {applyTablePagingMetadata} from '../runtime/tablePagingMetadata.js';
import {admittedPublishedWindowModel,publishedWindowConditionalETag} from '../runtime/publishedWindowModelCache.js';
import {recordWindowPerfPhase} from '../runtime/windowPerfPhases.js';
import {normalizeLifetimeStart, resolveDateRangePreset, resolveDateRangePresetSyncPatch} from '../packs/blueprint/dateRangePreset.js';

const EMPTY_WINDOW_METRICS = Object.freeze({});

export function reuseShallowEqualRuntimeObject(previous = null, candidate = null) {
    if (!previous || !candidate || typeof previous !== 'object' || typeof candidate !== 'object') {
        return candidate;
    }
    const previousKeys = Object.keys(previous);
    const candidateKeys = Object.keys(candidate);
    if (previousKeys.length !== candidateKeys.length) return candidate;
    return candidateKeys.every((key) => Object.is(previous[key], candidate[key])) ? previous : candidate;
}

export function scopedWindowHostServices(services = {}, windowState = null) {
    if (typeof services?.createHostWindow !== 'function') return services;
    const hostWindow = services.createHostWindow(windowState);
    return hostWindow && typeof hostWindow === 'object'
        ? {...services, hostWindow: {...(services.hostWindow || {}), ...hostWindow}}
        : services;
}

export function resolveWindowModelCacheScope(services = {}, bridgeSessionId = '') {
    return typeof services?.windowModelCacheScope === 'function'
        ? services.windowModelCacheScope() || ''
        : bridgeSessionId || '';
}

function useStableRuntimeIdentity(dependencies = []) {
    const holder = useRef(null);
    const changed = !holder.current
        || holder.current.dependencies.length !== dependencies.length
        || dependencies.some((value, index) => !Object.is(value, holder.current.dependencies[index]));
    if (changed) {
        holder.current = {dependencies: [...dependencies], identity: {}};
    }
    return holder.current.identity;
}

function collectInitialWindowFormItemValues(node, initial) {
    if (!node || typeof node !== 'object') return;
    if (node.parameterEditor) {
        collectInitialWindowFormItemValues({items:node.parameterEditor.fields}, initial);
        for (const section of node.parameterEditor.sections || []) collectInitialWindowFormItemValues({items:section.fields}, initial);
    }
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

function collectWindowFormDatePresetItems(node, presets) {
    if (!node || typeof node !== 'object') return;
    if (node.parameterEditor) {
        collectWindowFormDatePresetItems({items: node.parameterEditor.fields}, presets);
        for (const section of node.parameterEditor.sections || []) collectWindowFormDatePresetItems({items: section.fields}, presets);
    }
    for (const item of Array.isArray(node.items) ? node.items : []) {
        if (String(item?.scope || '').trim() !== 'windowForm'
            || item?.widget !== 'dateRangePreset' && item?.type !== 'dateRangePreset') continue;
        const properties = item.properties || {};
        presets.push({
            field: String(item.bindingPath || item.dataField || item.id || '').trim(),
            fallbackValue: item.value,
            startField: properties.startField || 'customDateStart',
            endField: properties.endField || 'customDateEnd',
            granularityField: properties.granularityField || 'granularity',
            lifetimeStart: properties.lifetimeStart || '2026-01-01',
            lifetimeStartSelector: properties.lifetimeStartSelector || '',
            timeZone: properties.timeZone || 'UTC',
            timeZoneSelector: properties.timeZoneSelector || '',
        });
    }
    for (const child of Array.isArray(node.containers) ? node.containers : []) collectWindowFormDatePresetItems(child, presets);
}

export function compileWindowFormDatePresets(metadata) {
    const presets = [];
    collectWindowFormDatePresetItems(metadata?.view?.content, presets);
    return presets;
}

// Resolve the same deterministic preset values that the mounted control uses,
// before datasource priming can observe a half-initialized window form.
export function resolveInitialDateRangePresetValues(metadataOrPresets, current = {}, metrics = {}, now = new Date()) {
    const presets = Array.isArray(metadataOrPresets) ? metadataOrPresets : compileWindowFormDatePresets(metadataOrPresets);
    let next = current;
    for (const preset of presets) {
        const value = preset.field ? next[preset.field] ?? preset.fallbackValue : preset.fallbackValue;
        if (!value || String(value).toLowerCase() === 'custom') continue;
        const resolvedLifetimeStart = normalizeLifetimeStart(
            preset.lifetimeStartSelector ? resolveSelector(metrics, preset.lifetimeStartSelector) : preset.lifetimeStart,
            preset.lifetimeStart,
        );
        const resolvedTimeZone = preset.timeZoneSelector
            ? resolveSelector(metrics, preset.timeZoneSelector) || preset.timeZone
            : preset.timeZone;
        const resolved = resolveDateRangePreset(value, now, resolvedLifetimeStart, resolvedTimeZone);
        const patch = resolveDateRangePresetSyncPatch(next, resolved, {
            startField: preset.startField,
            endField: preset.endField,
            granularityField: preset.granularityField,
        });
        if (patch) next = {...next, ...patch};
    }
    return next;
}

export function compileWindowAuthorizationMetadata(metadata, parameters = {}, selectionBinding = null) {
    // The managing MCP owns resource access. Selected capabilities only affect
    // rendered controls; they never admit or deny datasource operations.
    const snapshot = metadata?.authorizationSnapshot;
    const spec = metadata?.authorization;
    const selector = spec?.resource?.id?.selector;
    const selected = selector ? resolveSelector(parameters, selector) : undefined;
    // Recompiling already projected metadata must retain its selected display
    // resource when no new parameter context was supplied.
    const retained = Object.keys(parameters || {}).length === 0 ? snapshot?.resource?.id : null;
    const resourceType = spec?.resource?.type || spec?.resourceType || snapshot?.resource?.type || '';
    const resolved = resolveAuthorizationResourceID(spec?.schemaVersion || snapshot?.schemaVersion, selected ?? retained, snapshot);
    const hints = snapshot ? normalizeAuthorizationSnapshot(snapshot, resourceType, resolved.valid ? resolved.id : null) : {};
    return {...applyTablePagingMetadata(compileDeliveryHintView(metadata, hints)),
        authorizationSnapshot: snapshot ? hints : undefined,
        ...(canonicalSelectionBinding({selectionBinding}) ? {selectionBinding} : {}),
    };
}

export function isProtectedWindowMetadata(metadata) {
    return !!metadata && (!!metadata.authorization || !!metadata.authorizationSnapshot || !!canonicalSelectionBinding(metadata));
}

export function canUseInlineMetadataFallback(inlineMetadata) {
    // Protected metadata must always complete a fresh permission preflight.
    // A carried snapshot may be expired or belong to a different resource.
    return !!inlineMetadata && !isProtectedWindowMetadata(inlineMetadata);
}

export function windowMetadataFetchKey(window = {}, targetContext = null) {
    const canonical = (value) => {
        if (Array.isArray(value)) return value.map(canonical);
        if (!value || typeof value !== 'object') return value;
        if (typeof value.toJSON === 'function') return canonical(value.toJSON());
        return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
    };
    return JSON.stringify(canonical({
        windowId: window.windowId || window.id,
        windowKey: window.windowKey,
        conversationId: window.conversationId,
        parameters: window.parameters,
        resource: window.resource,
        targetContext,
        selectionBinding: canonicalSelectionBinding(window),
    }));
}

export function withWindowPermissionDeadline(work, timeoutMs = 15000) {
    const duration = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 15000;
    let timer;
    const deadline = new Promise((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error('Permission check timed out'), {status: 504})), duration);
    });
    return Promise.race([Promise.resolve().then(work), deadline]).finally(() => clearTimeout(timer));
}

export function isTransientWindowMetadataError(error) {
    if (!error || error.isUnauthorized || [401, 403].includes(Number(error.status))) return false;
    return [500, 502, 503, 504].includes(Number(error.status))
        || (error.status == null && error.name === 'TypeError');
}

export function isStaleWindowMetadataTransport(error, previous, current) {
    // A replaced bridge can invalidate an instance binding without changing
    // resource access. Retry the producer read; never grant access locally.
    return Number(error?.status) === 403 && !!previous?.sessionId && !!current?.sessionId
        && !!previous.clientId && !!previous.url
        && previous.clientId === current.clientId && previous.url === current.url
        && previous.sessionId !== current.sessionId;
}

export function formatWindowMetadataError(error) {
    if (!error) return '';
    if (error.code === 'WINDOW_AUTHORIZATION_EXPIRED' || error.code === 'PREVIEW_AUTHORIZATION_EXPIRED') return 'Permissions expired. Refresh permission checks or reopen this window.';
    if (Number(error.status) === 504) return 'Permission check timed out. Please try again.';
    if (Number(error.status) === 403) {
        return 'Access denied. You do not have permission to open this resource.';
    }
    if (Number(error.status) === 401 || error.isUnauthorized) {
        return 'Authentication required. Please sign in to continue.';
    }
    return `Failed to load window: ${error.message || 'Unknown error'}`;
}

export function resolveWindowMetadataDisplayState({loading, signalsReady, metadata, fetchError}) {
    if (fetchError && !signalsReady) return 'error';
    if (loading || !signalsReady) return 'loading';
    if (!metadata) return 'empty';
    return 'ready';
}

export async function applyWindowPermissionMetadata(completeMetadata, {
    services,
    windowId = '',
    windowKey,
    resource = {},
    windowParams = {},
    conversationId = '',
    targetContext = null,
} = {}) {
    // A successful managing-provider read already selected this exact
    // definition. Its authored authorization and snapshot are display facts,
    // not a request for an independent host OPEN decision. A bare URI is not
    // a resolved delivery identity; unmanaged metadata keeps its legacy path.
    const selected = completeMetadata?.resource;
    const managed = selected && ['working', 'stamped'].includes(selected.kind)
        && typeof selected.uri === 'string' && selected.uri.startsWith('window://')
        && ['providerIdentity', 'contentFingerprint', 'authorityBinding']
            .every(key => typeof selected[key] === 'string' && selected[key].trim());
    if (managed) return completeMetadata;
    if (!completeMetadata?.authorization) return completeMetadata;
    if (typeof services?.applyPermission !== 'function') {
        throw Object.assign(new Error('Permission service is unavailable'), {status: 503});
    }
    return services.applyPermission({
        windowId,
        windowKey,
        completeMetadata,
        resource,
        windowParams,
        conversationId,
        targetContext,
    });
}

// The cohort HTTP handler admits the selected root and binds this UI instance
// before emitting these headers, including on 304. A legacy window GET lacks
// this representation marker and retains its separate permission preflight.
export function isAdmittedPublishedWindowResponse(responseInfo, window, metadata) {
    const hash = String(responseInfo?.artifactHash || '');
    const etag = String(responseInfo?.etag || '');
    const uri = String(window?.resourceRef?.uri || '');
    const providerIdentity = String(window?.providerIdentity || '');
    const cohortETag = /^"([a-f0-9]{64})\.cohort-v\d+"$/i.exec(etag);
    if (!/^[a-f0-9]{64}$/i.test(hash) || cohortETag?.[1]?.toLowerCase() !== hash.toLowerCase() ||
        !/^window:\/\/[^/]+\/.+/.test(uri) || !providerIdentity || !metadata?.view) return false;
    if (metadata.resource?.uri && metadata.resource.uri !== uri) return false;
    if (metadata.resource?.providerIdentity && metadata.resource.providerIdentity !== providerIdentity) return false;
    return true;
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
            initial[name] = applyParameterCodec(parameter?.location, parameter?.codec);
        }
    }
    collectInitialWindowFormItemValues(metadata?.view?.content || null, initial);
    return initial;
}

export function resolveDefaultDataSourceRef(metadata) {
    const dataSourceRefs = Object.keys(metadata?.dataSource || {});
    return String(
        metadata?.view?.dataSourceRef
        || metadata?.view?.content?.dataSourceRef
        || metadata?.window?.titleBinding?.dataSourceRef
        || metadata?.window?.titleBinding?.ref
        // An implicit default is unambiguous only for a single-source window.
        // Multi-source definitions may serialize a command datasource first;
        // selecting that key would execute it when the window opens.
        || (dataSourceRefs.length === 1 ? dataSourceRefs[0] : '')
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

export function compilePermissionAppliedMetadata(metadata, targetContext = {}, parameters = {}, selectionBinding = null) {
    const targetResolved = resolveWindowMetadataForTarget(metadata, targetContext);
    return compileWindowAuthorizationMetadata(targetResolved, parameters, selectionBinding);
}

export function resolveWindowRootContainer(content = null, parameters = {}) {
    if (!content || typeof content !== 'object' || Array.isArray(content)) {
        return content;
    }
    const normalizedParameters = parameters && typeof parameters === 'object' && !Array.isArray(parameters)
        ? parameters
        : {};
    if (Object.keys(normalizedParameters).length === 0) {
        return content;
    }
    const baseParameters = content.parameters && typeof content.parameters === 'object' && !Array.isArray(content.parameters)
        ? content.parameters
        : {};
    const next = {
        ...content,
        parameters: {
            ...baseParameters,
            ...normalizedParameters,
        },
    };
    const reportBuilder = next.reportBuilder && typeof next.reportBuilder === 'object' && !Array.isArray(next.reportBuilder)
        ? next.reportBuilder
        : null;
    const requestedStarterId = String(normalizedParameters.reportStarterId || '').trim();
    if (reportBuilder && requestedStarterId && !String(reportBuilder.prefillReportStarterId || '').trim()) {
        next.reportBuilder = {
            ...reportBuilder,
            prefillReportStarterId: requestedStarterId,
        };
    }
    return next;
}

function collectRequiredDataSourceRefs(node, scope, refs, viewState = {}, fetchUsage = null, fetcherOwned = null) {
    if (!node || typeof node !== 'object') return;

    const isWindowFormPredicate = (condition) => {
        if (!condition || typeof condition !== 'object') return false;
        if (Array.isArray(condition.all)) return condition.all.length > 0 && condition.all.every(isWindowFormPredicate);
        if (Array.isArray(condition.any)) return condition.any.length > 0 && condition.any.every(isWindowFormPredicate);
        if (condition.not) return isWindowFormPredicate(condition.not);
        return String(condition.source || '').toLowerCase() === 'windowform';
    };
    const visibleInWindowForm = (entry) => {
        const context = {signals: {windowForm: {peek: () => scope || {}}}};
        if (entry?.visibleWhen && isWindowFormPredicate(entry.visibleWhen)
            && !evaluatePlainVisibleWhen(entry.visibleWhen, context)) return false;
        if (entry?.hiddenWhen && isWindowFormPredicate(entry.hiddenWhen)
            && evaluatePlainVisibleWhen(entry.hiddenWhen, context)) return false;
        return true;
    };

    if (!visibleInWindowForm(node)) return;
    if (node.fetchData === true && String(node.dataSourceRef || '').trim()) {
        fetcherOwned?.add(String(node.dataSourceRef).trim());
    }

    const addRef = (ref, deferred = false) => {
        const value = String(ref || '').trim();
        if (!value) return;
        refs.add(value);
        if (fetchUsage) {
            const usage = fetchUsage.get(value) || {deferred: false, eager: false};
            usage[deferred ? 'deferred' : 'eager'] = true;
            fetchUsage.set(value, usage);
        }
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

    addRef(node.dataSourceRef, node.fetchData === false);
    addRef(node.definitionDataSourceRef);
    addRef(node.runtime?.definitionDataSourceRef);
    addRef(node.dashboard?.reportBuilder?.definitionDataSourceRef);
    for (const builder of [node.reportBuilder, node.dashboard?.reportBuilder]) {
        for (const predicate of Array.isArray(builder?.predicates) ? builder.predicates : []) {
            addRef(predicate?.optionsDataSourceRef, usesLazyOptions(predicate));
        }
    }
    addRef(resolveMappedRef(node), node.fetchData === false);

    // Commands execute through datasource signals. Their contexts must be
    // mounted, but declaring a writer must never invoke it on window open.
    const addCommand = (command) => {
        if (!command || typeof command !== 'object') return;
        addRef(command.dataSourceRef, true);
        for (const refresh of command.refresh || []) addRef(refresh?.dataSourceRef, true);
        addRef(command.reconcile?.dataSourceRef, true);
    };
    addCommand(node.mutationCommand);
    addCommand(node.editableCollection?.mutation);
    for (const operation of node.editableCollection?.operations || []) addCommand(operation?.mutation);
    for (const transition of node.statusWorkflow?.transitions || []) addCommand(transition?.command);
    addCommand(node.treeEditor?.mutation);
    addCommand(node.scheduleEditor?.mutation);
    addCommand(node.wizard?.submit);
    addCommand(node.draftForm?.submit);
    if(node.predicateCompositionEditor) addRef(node.predicateCompositionEditor.dataSourceRef || node.dataSourceRef,true);
    if(node.gateRequirementsEditor) {
        addRef(node.gateRequirementsEditor.dataSourceRef || node.dataSourceRef,true);
        for(const ref of Object.values(node.gateRequirementsEditor.operations||{}))addRef(ref,true);
    }
    if (node.readerWorkbench) {
        addRef(node.readerWorkbench.dataSourceRef || node.dataSourceRef,true);
        for (const binding of [...Object.values(node.readerWorkbench.operations || {}),...Object.values(node.readerWorkbench.lookups || {})]) addRef(binding.dataSourceRef,true);
    }
    if (node.resourcePolicyEditor) {
        addRef(node.resourcePolicyEditor.dataSourceRef || node.dataSourceRef, true);
        for (const ref of Object.values(node.resourcePolicyEditor.operations || {})) addRef(ref, true);
    }
    if (node.resultPreview) addRef(node.resultPreview.dataSourceRef || node.dataSourceRef, true);
    if (node.workspaceSummary) {
        addRef(node.workspaceSummary.stateDataSourceRef, true);
        for (const section of node.workspaceSummary.sections || []) addRef(section.dataSourceRef, true);
    }
    if (node.parameterEditor) {
        addRef(node.parameterEditor.dataSourceRef, true);
        addCommand(node.parameterEditor.draft?.submit);
        collectRequiredDataSourceRefs({items:node.parameterEditor.fields}, scope, refs, viewState, fetchUsage, fetcherOwned);
        for (const section of node.parameterEditor.sections || []) collectRequiredDataSourceRefs({items:section.fields,visibleWhen:section.visibleWhen}, scope, refs, viewState, fetchUsage, fetcherOwned);
    }

    addCommand(node.uploadCollection?.upload);
    for (const action of node.resourceHeader?.actions || []) addCommand(action?.mutation);
    for (const rule of node.notificationRules?.rules || []) addCommand(rule?.action?.mutation);
    addCommand(node.assignmentPicker?.assign);
    addCommand(node.assignmentPicker?.unassign);

    // Match the rendered lifecycle of persistent collapsed sections. Their
    // header can retain its own datasource, but unmounted content must not
    // initialize reporting/child datasources until the user expands it.
    if (node.section?.persistState === true && node.section?.collapsible === true
        && resolveSectionProperties(node.section).collapseProps?.keepChildrenMounted === false
        && !resolveSectionOpenState({...node.section, stateKey: node.section.stateKey || node.id}, viewState)) return;

    if (node.chart) {
        addRef(node.chart.dataSourceRef, node.fetchData === false || node.chart.fetchData === false);
        addRef(resolveMappedRef(node.chart), node.fetchData === false || node.chart.fetchData === false);
    }

    if (Array.isArray(node.items)) {
        for (const item of node.items) {
            if (!visibleInWindowForm(item)) continue;
            addRef(item?.dataSourceRef, item?.fetchData === false);
            addCommand(item?.mutationCommand);
            addRef(item?.optionsDataSourceRef, usesLazyOptions(item));
            addRef(item?.fallbackOptionsDataSourceRef);
            addRef(resolveMappedRef(item), item?.fetchData === false);
        }
    }

    if (Array.isArray(node.containers)) {
        let children = node.containers;
        const tabs = node.stableTabs || node.tabs;
        // FormPanel renders only the selected panel by default, including
        // legacy renderActiveTabPanelOnly:false. Visited panels retain local
        // state, but their inactive implicit consumers must not prime reads.
        // Only the explicit all policy intentionally mounts every panel.
        const mountPolicy = String(tabs?.mountPolicy || '').trim().toLowerCase();
        if (tabs && mountPolicy !== 'all' && children.length > 0) {
            // Match FormPanel's visible fallback before selecting a default.
            children = children.filter(visibleInWindowForm);
            const panelId = String(node.id || children[0]?.id || 'root').trim();
            const selectedId = String(
                viewState?.tabs?.[panelId]
                || tabs?.selectedTabId
                || tabs?.defaultSelectedTabId
                || children[0]?.id
                || ''
            ).trim();
            const selected = children.find((child) => String(child?.id || '').trim() === selectedId) || children[0];
            children = selected ? [selected] : [];
        }
        for (const child of children) {
            collectRequiredDataSourceRefs(child, scope, refs, viewState, fetchUsage, fetcherOwned);
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
        // `_` is the authored local-datasource placeholder, not a parent to
        // mount. Preserve an explicitly declared source with that name.
        if (parentRef === '_' && !Object.prototype.hasOwnProperty.call(all, parentRef)) continue;
        if (parentRef && !result.has(parentRef)) {
            result.add(parentRef);
            queue.push(parentRef);
        }
    }
    return Array.from(result);
}

export function resolveRequiredDataSourceRefs(metadata, defaultDataSourceRef = '', scope = {}, viewState = {}) {
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
    collectRequiredDataSourceRefs(metadata?.view?.content || null, scope, refs, viewState);
    return expandRequiredDataSourceRefs(metadata, refs);
}

// Mount deferred contexts normally, but let active eager consumers retain
// their existing fetch behavior. No datasource declaration is rewritten.
export function resolveDeferredDataSourceRefs(metadata, defaultRef = '', scope = {}, viewState = {}) {
    const usage = new Map();
    const refs = new Set();
    collectRequiredDataSourceRefs(metadata?.view?.content, scope, refs, viewState, usage);
    // An unbound tab rail can infer its context from a source used only by an
    // unvisited panel. Keep that context mounted, but let its actual consumer
    // own the first read instead of fetching once here and again on activation.
    const dormantTabDefault = defaultRef && (metadata?.view?.content?.tabs || metadata?.view?.content?.stableTabs)
        && !metadata?.view?.dataSourceRef && !metadata?.view?.content?.dataSourceRef
        && !usage.has(defaultRef);
    if (dormantTabDefault) usage.set(defaultRef, {deferred: true, eager: false});
    for (const ref of [dormantTabDefault ? '' : defaultRef, metadata?.window?.titleBinding?.dataSourceRef || metadata?.window?.titleBinding?.ref || metadata?.view?.titleBinding?.dataSourceRef || metadata?.view?.titleBinding?.ref]) {
        if (ref) usage.set(ref, {deferred: false, ...(usage.get(ref) || {}), eager: true});
    }
    const queue = [...usage.keys()];
    for (let index = 0; index < queue.length; index++) {
        const ref = queue[index];
        const parent = String(metadata?.dataSource?.[ref]?.dataSourceRef || '').trim();
        if (!parent || parent === '_' && !Object.hasOwn(metadata?.dataSource || {}, parent)) continue;
        const previous = usage.get(parent) || {deferred: false, eager: false};
        const source = usage.get(ref);
        const next = {deferred: previous.deferred || source.deferred, eager: previous.eager || source.eager};
        if (next.deferred !== previous.deferred || next.eager !== previous.eager) {usage.set(parent, next); queue.push(parent);}
    }
    return new Set([...usage].filter(([,value]) => value.deferred && !value.eager).map(([ref]) => ref));
}

// Compatibility for callers of the original lazy-options ownership helper.
export const resolveLazyOptionsDataSourceRefs = resolveDeferredDataSourceRefs;

export function resolveFetcherOwnedDataSourceRefs(metadata, scope = {}, viewState = {}) {
    const refs = new Set();
    collectRequiredDataSourceRefs(metadata?.view?.content || null, scope, new Set(), viewState, null, refs);
    return Array.from(refs);
}

export function shouldPrimeDataSourceFetch(dataSource = {}, prevInput = {}, collection = [], paramsChanged = false, control = {}, {deferAutomatic = false} = {}) {
    if (prevInput.fetch) return true;
    const autoFetchEnabled = dataSource?.autoFetch !== false && !deferAutomatic;
    if (!autoFetchEnabled) return false;
    // A terminal dataset-scope 403 stays visible until explicit fetch intent.
    // Window/resource denial handling remains in its existing authorization path.
    if (Number(control?.error?.status) === 403
        && control?.error?.code === 'datasource_denied'
        && control?.error?.scope === 'dataset') return false;
    // A changed binding must remain queued while the previous read settles.
    // DataSource owns serialization; clearing fetch here loses the new range
    // when an empty result lets the next user action happen immediately.
    if (paramsChanged) return true;
    // DataSource already consumed this request and is waiting for missing
    // dependencies. Re-priming an empty inactive source on every render makes
    // the consumer and primer continually toggle fetch until React aborts.
    // Changed bindings or an explicit fetch above can wake it again.
    if (control?.inactive === true) return false;
    if (control?.loading === true) return false;
    if (control?.error) return false;
    const hasCollection = Array.isArray(collection) && collection.length > 0;
    const hasCompletedLoad = control?.loaded === true;
    return !hasCollection && !hasCompletedLoad;
}

export function resolveWindowDataSourceFetchFlag({
    fetchOwnedByContainer = false,
    previousFetch = false,
    shouldFetch = false,
    paramsChanged = false,
} = {}) {
    if (!fetchOwnedByContainer || paramsChanged) {
        return shouldFetch;
    }
    return !!previousFetch;
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

export function shouldPreserveMissingResolvedParameters(dataSource = {}, previousParameters = {}, resolvedParameters = {}, explicitParameters = {}) {
    if (dataSource?.preserveParametersOnMissingDependencies !== true) {
        return false;
    }
    const metadataParameters = Array.isArray(dataSource?.parameters) ? dataSource.parameters : [];
    if (metadataParameters.length === 0) {
        return false;
    }
    const previousKeys = previousParameters && typeof previousParameters === 'object'
        ? Object.keys(previousParameters)
        : [];
    if (previousKeys.length === 0) {
        return false;
    }
    const resolvedKeys = resolvedParameters && typeof resolvedParameters === 'object'
        ? Object.keys(resolvedParameters)
        : [];
    const explicitKeys = explicitParameters && typeof explicitParameters === 'object'
        ? Object.keys(explicitParameters)
        : [];
    return resolvedKeys.length === 0 && explicitKeys.length === 0;
}

export function shouldResetWindowDashboardState(previousDashboardKey = '', windowId = '', dashboardId = '') {
    const normalizedWindowId = String(windowId || '').trim();
    const normalizedDashboardId = String(dashboardId || '').trim();
    if (!normalizedWindowId || !normalizedDashboardId) {
        return false;
    }
    return String(previousDashboardKey || '').trim() !== `${normalizedWindowId}:${normalizedDashboardId}`;
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
    const template = String(binding?.template || '').trim();
    if (template) {
        const templated = template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, token) => {
            const value = resolveSelector(data || {}, String(token || '').trim());
            return value == null ? '' : String(value);
        }).replace(/\s{2,}/g, ' ').trim();
        if (templated) {
            return templated;
        }
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

export function syncWindowRuntimeHints(windowId, metadata, windowState = null) {
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

    // Authored placement is a default; it must not relocate an already placed
    // host window or its linked children into a different surface.
    const metadataPresentation = String(metadata?.presentation || '').trim();
    if (metadataPresentation && !String(next.presentation || '').trim()) {
        next.presentation = metadataPresentation;
        changed = true;
    }
    const metadataRegion = String(metadata?.region || '').trim();
    if (metadataRegion && !String(next.region || '').trim()) {
        next.region = metadataRegion;
        changed = true;
    }
    const metadataChipName = String(metadata?.chipName || '').trim();
    if (metadataChipName && String(next.navigation?.chipName || '').trim() !== metadataChipName) {
        next.navigation = {...(next.navigation || {}), chipName: metadataChipName};
        changed = true;
    }
    const metadataChipIcon = String(metadata?.chipIcon || '').trim();
    if (metadataChipIcon && String(next.navigation?.chipIcon || '').trim() !== metadataChipIcon) {
        next.navigation = {...(next.navigation || {}), chipIcon: metadataChipIcon};
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
    if (metadata?.authorizationSnapshot && next.authorizationSnapshot !== metadata.authorizationSnapshot) {
        next.authorizationSnapshot = metadata.authorizationSnapshot;
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
    const shouldFillParent = windowFillsAllocatedSpace(window, isHostedWorkspaceSurface);
    const defaultDataSourceRef = resolveDefaultDataSourceRef(metadata);
    const initialWindowFormSeed = useMemo(() => ({
        ...resolveInitialWindowFormValues(metadata),
        ...(parameters && typeof parameters === 'object' ? parameters : {}),
    }), [parameters, metadata]);
    const windowFormSignal = useMemo(() => findFormSignal(`${windowId}:windowForm`), [windowId]);
    const windowViewSignal = useMemo(() => getViewSignal(windowId), [windowId]);
    const datePresets = useMemo(() => compileWindowFormDatePresets(metadata), [metadata]);

    const hookContext = Context(windowId, metadata, defaultDataSourceRef, services);
    const existingContext = getWindowContext(windowId);
    const context = resolveWindowContentContext({
        existingContext,
        hookContext,
        metadata,
        services,
        windowState: services?.windowState || window,
    });
    const initializedDashboardKeyRef = useRef('');
    const rootContainer = useMemo(
        () => resolveWindowRootContainer(metadata?.view?.content || null, parameters),
        [metadata?.view?.content, parameters],
    );

    const liveWindowForm = windowFormSignal?.value || {};
    const liveMetrics = context?.signals?.metrics?.value || context?.signals?.metrics?.peek?.() || EMPTY_WINDOW_METRICS;
    const windowTabsSignal = useViewPartition(windowViewSignal, 'tabs');
    const liveWindowTabs = windowTabsSignal.value;
    const windowSectionsSignal = useViewPartition(windowViewSignal, 'sections');
    const liveWindowSections = windowSectionsSignal.value;
    const liveWindowView = useMemo(() => ({tabs: liveWindowTabs || {}, sections: liveWindowSections || {}}), [liveWindowTabs, liveWindowSections]);
    const windowFormSnapshot = useMemo(() => resolveInitialDateRangePresetValues(datePresets, {
        ...initialWindowFormSeed,
        ...liveWindowForm,
    }, liveMetrics), [datePresets, initialWindowFormSeed, liveWindowForm, liveMetrics]);
    const preserveWindowFormFields = useMemo(() => new Set([
        ...Object.keys(parameters && typeof parameters === 'object' ? parameters : {}),
        ...Object.keys(liveWindowForm),
        ...Object.keys(windowFormSnapshot).filter(key => !Object.is(windowFormSnapshot[key], initialWindowFormSeed[key])),
    ]), [parameters, liveWindowForm, windowFormSnapshot, initialWindowFormSeed]);

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

    const openedPickerRef = useRef(false);
    useEffect(() => {
        if (!context || !window?.pickerDialogId || openedPickerRef.current) return;
        openedPickerRef.current = true;
        openWindowPickerDialog(window, metadata, context).catch(error => {
            console.error('Window picker failed', error);
            context.handlers?.window?.closeWindow?.();
        });
    }, [context, metadata, window]);


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
    // A repeated window-open command may restore the static metadata title after
    // the bound datasource value has already settled. Observe the active window
    // title as well so the dynamic identity is reapplied in that case.
    }, [desiredWindowTitle, windowId, window?.windowTitle]);

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
    }, [windowId, metadata, desiredWindowTitle, window?.windowTitle]);

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
    }, [windowId, metadata, desiredWindowTitle, window?.windowTitle]);

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
            preserveWindowFormFields,
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
        if (!rootContainer || rootContainer.kind !== 'dashboard') return;
        if (!windowId || !rootContainer.id) return;
        if (!shouldResetWindowDashboardState(initializedDashboardKeyRef.current, windowId, rootContainer.id)) {
            return;
        }
        initializedDashboardKeyRef.current = `${windowId}:${rootContainer.id}`;
        try {
            context.handlers?.window?.resetDashboardState?.({
                context,
                parameters: { dashboardId: rootContainer.id }
            });
        } catch (err) {
            console.error('window dashboard init failed', err);
        }
    }, [context, rootContainer, windowId]);

    const dataSources = metadata.dataSource || {};
    const dialogs     = metadata.dialogs   || [];

    /* ------------------------------------------------------------
     * Rendering helpers
     * ---------------------------------------------------------- */

    const requiredDataSourceRefs = useMemo(() => {
        const resolvedRefs = resolveRequiredDataSourceRefs(metadata, defaultDataSourceRef, windowFormSnapshot, liveWindowView);
        try {
            log.debug('[window.requiredDataSourceRefs]', {
                windowId,
                windowKey,
                windowForm: windowFormSnapshot,
                refs: resolvedRefs,
            });
        } catch (_) {}
        return resolvedRefs;
    }, [metadata, defaultDataSourceRef, windowFormSnapshot, liveWindowView]);
    const deferredDataSourceRefs = useMemo(
        () => resolveDeferredDataSourceRefs(metadata, defaultDataSourceRef, windowFormSnapshot, liveWindowView),
        [metadata, defaultDataSourceRef, windowFormSnapshot, liveWindowView],
    );
    const fetcherOwnedDataSourceRefs = useMemo(
        () => new Set(resolveFetcherOwnedDataSourceRefs(metadata, windowFormSnapshot, liveWindowView)),
        [metadata, windowFormSnapshot, liveWindowView],
    );

    useEffect(() => {
        const currentWindowForm = windowFormSignal?.value || {};
        const resolvedRefs = requiredDataSourceRefs;
        const dataSourceDefs = metadata?.dataSource || {};
        for (const ref of resolvedRefs) {
            // Optional authored definitions can be absent. Their render regions
            // are omitted by MissingDataSourceBoundary; root parameter priming
            // must not resolve that missing context before the boundary mounts.
            if (!dataSourceDefs[ref]) continue;
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
            let nextParams = applyDataSourceParameterCodecs({
                ...(resolvedMetaParams || {}),
                ...(explicitWindowParams || {}),
            }, dataSourceDefs?.[ref]?.parameters);
            if (shouldPreserveMissingResolvedParameters(dataSourceDef, prevParams, resolvedMetaParams, explicitWindowParams)) {
                nextParams = { ...prevParams };
            }
            const ownsParameters = hasOwnDataSourceParameters(dataSourceDef, explicitWindowParams);
            const paramsChanged = JSON.stringify(prevParams) !== JSON.stringify(nextParams);
            const collection = collectionSignal?.peek?.() || [];
            const control = controlSignal?.peek?.() || {};
            const shouldFetch = shouldPrimeDataSourceFetch(dataSourceDef, prevInput, collection, paramsChanged, control, {deferAutomatic: deferredDataSourceRefs.has(ref)});
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
                fetch: resolveWindowDataSourceFetchFlag({
                    fetchOwnedByContainer,
                    previousFetch: prevInput.fetch,
                    shouldFetch,
                    paramsChanged,
                }),
            };
        }
    }, [windowFormSignal, windowFormSnapshot, metadata, defaultDataSourceRef, initialWindowFormSeed, context, parameters, windowId, log, fetcherOwnedDataSourceRefs, requiredDataSourceRefs, deferredDataSourceRefs]);

    const renderDataSources = () => {
        if (!context) return null;
        return (
            <>
                {requiredDataSourceRefs.map((key) => (
                    <DataSourceContainer
                        key={key}
                        windowContext={context}
                        dsKey={key}
                        suppressAutomaticFetch={deferredDataSourceRefs.has(key)}
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
                                focusRequest={Number(dialogSignal?.focusRequest || 0)}
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
        useSignals();
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
                height: 'auto',
                minHeight: shouldFillParent ? 0 : 'max-content',
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                flex: shouldFillParent ? 1 : '0 0 auto',
                overflow: shouldFillParent ? 'hidden' : 'visible',
            }}
        >
            {metadata.resourceWarnings?.length > 0 ? <div role="status" className="bp6-callout bp6-intent-warning">
                Some window resources are unavailable: {metadata.resourceWarnings.map(warning => warning.resource).join(', ')}
            </div> : null}
            {!defaultDataSourceRef && context.signals ? <MessageBus context={context} /> : null}
            {renderDataSources()}
            {renderDialogs()}
            {!window.pickerDialogId && <WindowLayout
                title={`${windowKey.toUpperCase()}${windowData ? ` (${windowData})` : ''}`}
                context={context}
                contentOverride={rootContainer}
                onClose={() => {
                    removeWindow(windowId);
                }}
                isInTab={window.isInTab}
                fillParent={shouldFillParent}
            />}
            {!window.pickerDialogId && showWindowSelectionFooter(window) ? <FloatingFooter /> : null}
        </div>
    );
}


/* ------------------------------------------------------------------
 * WindowContent – outer wrapper responsible for fetching metadata.  It hosts
 * only a stable set of hooks so React never complains about ordering.
 * ------------------------------------------------------------------ */

function WindowContent(props) {
    useSignals();
    const metadata = props.selectedMetadata || (props.window?.windowId ? getMetadataSignal(props.window.windowId).value : null);
    const documentChat = metadata?.view?.content?.containers?.some(container => container.chat?.appearance === 'document');
    return <ForgeThemeBoundary presentation={documentChat ? 'document' : undefined} windowKey={metadata?.windowKey || props.window?.windowKey} resource={metadata?.resource}><WindowContentRuntime {...props} /></ForgeThemeBoundary>;
}

// Local signal subscriptions still update their own window. This boundary only
// skips unrelated parent renders when the window's props retain their identity.
export default React.memo(WindowContent);

function WindowContentRuntime({window, isInTab = false, selectedMetadata = null}) {
    useSignals();
    const {windowKey, windowId} = window;
    const baseKey = windowKey.split('?')[0];
    const runtimeWindowHolder = useRef(null);
    runtimeWindowHolder.current = reuseShallowEqualRuntimeObject(
        runtimeWindowHolder.current,
        {...window, isInTab},
    );
    const runtimeWindow = runtimeWindowHolder.current;

    const [metadataSignalHandle, setMetadataSignalHandle] = useState(() => findMetadataSignal(windowId));
    const [loading, setLoading] = useState(() => !(metadataSignalHandle?.peek?.()));
    const [fetchError, setFetchError] = useState(null);
    const [metadataRetryVersion, setMetadataRetryVersion] = useState(0);
    const retryableError = useRef(null);
    const failedMetadataTransport = useRef(null);
    retryableError.current = loading ? null : fetchError;
    useEffect(() => {
        const retry = (event) => {
            const replacedTransport = event?.detail?.reason === 'transport-ready'
                && isStaleWindowMetadataTransport(retryableError.current, failedMetadataTransport.current, getActiveUIBridgeTransportContext());
            if (!isTransientWindowMetadataError(retryableError.current) && !replacedTransport) return;
            retryableError.current = null;
            failedMetadataTransport.current = null;
            setFetchError(null);
            setMetadataRetryVersion((version) => version + 1);
        };
        globalThis.addEventListener?.('forge:retry-window-metadata', retry);
        return () => globalThis.removeEventListener?.('forge:retry-window-metadata', retry);
    }, []);
    const [signalsReady, setSignalsReady] = useState(() => !!(metadataSignalHandle?.peek?.()));
    const admittedRefreshDefinitions = useMemo(() => new WeakSet(), []);

    // Settings & connector
    const {endpoints = {}, connectorConfig = {}, services = {}, targetContext = {}, useAuth = () => ({})} = useSetting();
    const auth = useAuth();
    const prepareConnectorRequest = useMemo(() => (
        typeof services?.prepareDataConnectorRequest === 'function'
            ? (request) => services.prepareDataConnectorRequest({
                ...request,
                windowState: runtimeWindow,
            })
            : undefined
    ), [services, runtimeWindow]);
    if (!connectorConfig.window) {
        throw new Error('No connectorConfig.window found');
    }

    const {service} = connectorConfig.window;
    const reportBuilderServices = useMemo(() => buildReportBuilderHostServices({
        services,
        endpoints,
        auth,
        endpointName: service?.endpoint,
        conversationId: runtimeWindow?.conversationId,
        prepareRequest: prepareConnectorRequest,
    }), [services, endpoints, auth, service?.endpoint, runtimeWindow?.conversationId, prepareConnectorRequest]);
    const scopedServices = useMemo(() => scopedWindowHostServices(reportBuilderServices, runtimeWindow), [reportBuilderServices, runtimeWindow]);
    const resolvedServices = useMemo(() => ({
        ...scopedServices,
        windowState: runtimeWindow,
        __connectorRuntime: {
            endpoints,
            targetContext,
            auth,
            transport: services.dataConnectorTransport,
            prepareRequest: prepareConnectorRequest,
            recoverWindowBinding: services.recoverWindowBinding,
            windowId,
        },
    }), [scopedServices, runtimeWindow, endpoints, targetContext, auth, prepareConnectorRequest]);
    const config  = {service: {...service, uri: windowMetadataEndpoint(service.uri, baseKey, runtimeWindow), includeTargetContext: true}};
    const connector = createDataConnector(config, {
        endpoints, targetContext, auth,
        transport: services.dataConnectorTransport,
        prepareRequest: prepareConnectorRequest,
    });

    useEffect(() => {
        const existingSignal = findMetadataSignal(windowId);
        if (existingSignal) {
            setMetadataSignalHandle(existingSignal);
            return;
        }
        const createdSignal = getMetadataSignal(windowId);
        setMetadataSignalHandle(createdSignal);
    }, [windowId]);

    const metadataFetchKey = windowMetadataFetchKey({...window, windowId, windowKey: baseKey}, targetContext);

    // Fetch again only when the resource scope or authentication changes.
    useEffect(() => {
        let cancelled = false;
        let expired = false;
        if (!metadataSignalHandle) {
            return () => { cancelled = true; };
        }
        const existingMetadata = metadataSignalHandle.peek?.();
        const adoption = beginWindowStateAdoption(window, existingMetadata);
        const targetKey = normalizeTargetKey(targetContext);
        // Registered windows always fetch fresh metadata and authorization.
        // A compiled protected tree may no longer retain enough markers to be
        // distinguished safely from public metadata.
        setSignalsReady(false);
        setLoading(true);
        setFetchError(null);
        clearProtectedWindowDenial(windowId);
        if (isProtectedWindowMetadata(existingMetadata)) {
            clearProtectedWindowState(windowId);
        }
        windowStateAdoptionCleared(adoption);

        const admittedBinding = canonicalSelectionBinding(window);
        const deliveredMetadata = adoption ? null : selectedMetadata?.view ? selectedMetadata : admittedBinding && window?.inlineMetadata?.view ? window.inlineMetadata : null;
        if (deliveredMetadata) {
            // A completed selected GET may deliver a generic or signed definition.
            // This rendering input is not an authorization grant for data calls.
            const publish = (definition) => {
                if (cancelled) return;
                const admittedMetadata = compilePermissionAppliedMetadata(definition,
                    targetContext, window?.parameters || {}, admittedBinding);
                injectActions(admittedMetadata);
                metadataSignalHandle.value = {...admittedMetadata, __windowKey: baseKey,
                    __targetKey: targetKey, __provisionalInline: false};
            };
            if (services.resourceFS) {
                setLoading(true);
                services.resourceFS.loadWindow(deliveredMetadata).then(publish)
                    .catch(error => { if (!cancelled) setFetchError(error); })
                    .finally(() => { if (!cancelled) setLoading(false); });
            } else {
                try { publish(deliveredMetadata); } catch (error) { setFetchError(error); }
                setLoading(false);
            }
            return () => { cancelled = true; };
        }

        let hasInlineFallback = false;
        let fetchedProtectedMetadata = false;
        if (!adoption && window && canUseInlineMetadataFallback(window.inlineMetadata)) {
            try {
                const resolvedMetadata = resolveWindowMetadataForTarget(window.inlineMetadata, targetContext);
                injectActions(resolvedMetadata);
                metadataSignalHandle.value = {
                    ...resolvedMetadata,
                    __windowKey: baseKey,
                    __targetKey: targetKey,
                    __provisionalInline: true,
                };
                hasInlineFallback = true;
            } catch (e) {
                console.error('Error applying inline metadata', e);
            }
        }

        const modelIdentity = {
            providerIdentity: window?.providerIdentity,
            uri: window?.resourceRef?.uri,
            revision: window?.resourceRef?.revision,
            target: targetContext,
            sessionId: resolveWindowModelCacheScope(services,getActiveUIBridgeTransportContext()?.sessionId),
        };
        const responseInfo = {};
        const attemptTransport = getActiveUIBridgeTransportContext();
        withWindowPermissionDeadline(async () => {
            recordWindowPerfPhase('metadata-request-scheduled',windowId);
            return connector.get({responseInfo,ifNoneMatch:await publishedWindowConditionalETag(modelIdentity)})
            .then(async (resp) => {
                if (cancelled || expired) return;
                recordWindowPerfPhase('metadata-response-parsed',windowId);
                setFetchError(null);
                let completeMetadata;
                const compileModel = async definition => {
                    const selected = resolveWindowMetadataForTarget(definition, targetContext);
                    return services.resourceFS ? services.resourceFS.loadWindow(selected) : selected;
                };
                const modelRequest = {...modelIdentity,hash:responseInfo.artifactHash,etag:responseInfo.etag,compile:compileModel};
                let admittedResponseInfo=responseInfo;
                try {
                    completeMetadata = await admittedPublishedWindowModel({...modelRequest,definition:resp.notModified ? null : resp.data});
                } catch (error) {
                    if (!resp.notModified) throw error;
                    // A concurrent eviction after the conditional GET cannot
                    // turn an empty 304 into a usable definition.
                    const freshInfo = {};
                    const fresh = await connector.get({responseInfo:freshInfo,fresh:true});
                    completeMetadata = await admittedPublishedWindowModel({...modelIdentity,hash:freshInfo.artifactHash,etag:freshInfo.etag,
                        definition:fresh.data,compile:compileModel});
                    admittedResponseInfo=freshInfo;
                }
                if (cancelled || expired) return;
                fetchedProtectedMetadata = isProtectedWindowMetadata(completeMetadata);
                // A signed delivery is emitted only after host OPEN admission. Its
                // snapshot is a rendering hint, not a data-operation preflight.
                const selectionBinding = canonicalSelectionBinding(window);
                const permissionAppliedMetadata = selectionBinding || isAdmittedPublishedWindowResponse(admittedResponseInfo,window,completeMetadata)
                    ? completeMetadata : await applyWindowPermissionMetadata(completeMetadata, {
                    services,
                    windowId,
                    windowKey: baseKey,
                    resource: window?.resource || window?.parameters || {},
                    windowParams: window?.parameters || {},
                    conversationId: window?.conversationId || '',
                    targetContext,
                });
                if (cancelled || expired) return;
                const resolvedMetadata = compilePermissionAppliedMetadata(permissionAppliedMetadata, targetContext, window?.parameters || {}, selectionBinding);
                if (!resolvedMetadata) {
                    throw Object.assign(new Error('Resource not found or access denied'), {status: 403});
                }
                injectActions(resolvedMetadata);
                if (adoption) {
                    const freshScopeMetadata = compilePermissionAppliedMetadata(permissionAppliedMetadata, targetContext,
                        window?.parameters || {}, canonicalSelectionBinding(permissionAppliedMetadata));
                    completeWindowStateAdoption(adoption, freshScopeMetadata);
                }
                const heldMetadata = {
                    ...resolvedMetadata,
                    __windowKey: baseKey,
                    __targetKey: targetKey,
                    __provisionalInline: false,
                };
                metadataSignalHandle.value = heldMetadata;
                recordWindowPerfPhase('metadata-signal-published',windowId);
            });
        })
            .catch((err) => {
                rejectWindowStateAdoption(adoption);
                if (Number(err?.status) === 504) expired = true;
                if (!cancelled) {
                    failedMetadataTransport.current = attemptTransport;
                    if (isStaleWindowMetadataTransport(err, attemptTransport, getActiveUIBridgeTransportContext())) {
                        setFetchError(null);
                        setMetadataRetryVersion(version => version + 1);
                        return;
                    }
                    const protectedRequest = fetchedProtectedMetadata || isProtectedWindowMetadata(existingMetadata) || isProtectedWindowMetadata(window?.inlineMetadata);
                    if (!hasInlineFallback || protectedRequest || Number(err?.status) === 401 || Number(err?.status) === 403) {
                        console.error('Error fetching metadata', err);
                        setFetchError(err);
                    }
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });

        return () => { cancelled = true; rejectWindowStateAdoption(adoption); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [windowId, baseKey, metadataSignalHandle, metadataFetchKey, auth, selectedMetadata, metadataRetryVersion, services.resourceFS]);

    useEffect(() => {
        const metadata = metadataSignalHandle?.value;
        if (!metadata || typeof metadata !== 'object') return;
        syncWindowRuntimeHints(windowId, metadata, window);
        primeWindowSignals(windowId, metadata);
        recordWindowPerfPhase('metadata-prime-complete',windowId);
        setSignalsReady(true);
    }, [windowId, metadataSignalHandle?.value, resolvedServices, window]);

    const metadata = metadataSignalHandle?.peek?.();
    const protectedDenial = protectedWindowDenials.value[windowId];
    const displayState = resolveWindowMetadataDisplayState({loading, signalsReady: protectedDenial ? false : signalsReady, metadata, fetchError: protectedDenial || fetchError});

    // Keep the service runtime referentially stable while the effective
    // window, metadata authorization, and host services are unchanged.
    // WindowContentInner uses these identities to decide whether its Context
    // is still current; rebuilding them on every render repeatedly disposed
    // and re-initialized datasource actions such as Agently chat hydration.
    const runtimePrepareRequest = useMemo(() => (
        typeof services?.prepareDataConnectorRequest === 'function'
            ? (request) => services.prepareDataConnectorRequest({...request, windowState: runtimeWindow}) || request
            : resolvedServices?.__connectorRuntime?.prepareRequest
    ), [services, resolvedServices, runtimeWindow]);
    const contextRuntimeIdentity = useStableRuntimeIdentity([
        resolvedServices,
        runtimeWindow,
        metadata?.authorizationSnapshot,
        runtimePrepareRequest,
    ]);
    const runtimeServices = useMemo(() => ({
        ...resolvedServices,
        __contextRuntimeIdentity: contextRuntimeIdentity,
        windowState: runtimeWindow,
        authorization: metadata?.authorizationSnapshot || resolvedServices.authorization,
        __connectorRuntime: {
            ...(resolvedServices.__connectorRuntime || {}),
            prepareRequest: runtimePrepareRequest,
        },
    }), [resolvedServices, runtimeWindow, metadata?.authorizationSnapshot, runtimePrepareRequest, contextRuntimeIdentity]);

    useWorkspaceRefresh({window:runtimeWindow,metadata,host:services.workspaceRefresh,
        loadMetadata:async()=>{
            // A signal bypasses only the connector's concurrent GET sharing;
            // this remains the normal host-selected definition/admission path.
            const controller=new AbortController();
            const identity={providerIdentity:runtimeWindow?.providerIdentity,uri:runtimeWindow?.resourceRef?.uri,
                revision:runtimeWindow?.resourceRef?.revision,target:targetContext,
                sessionId:resolveWindowModelCacheScope(services,getActiveUIBridgeTransportContext()?.sessionId)};
            const responseInfo={};
            const compile=async raw=>{
                const selected=resolveWindowMetadataForTarget(raw,targetContext);
                return services.resourceFS?services.resourceFS.loadWindow(selected):selected;
            };
            const response=await connector.get({signal:controller.signal,fresh:true,cache:{bypassCache:true},responseInfo,
                ifNoneMatch:await publishedWindowConditionalETag(identity)});
            let admittedInfo=responseInfo,definition;
            try{
                definition=await admittedPublishedWindowModel({...identity,hash:responseInfo.artifactHash,etag:responseInfo.etag,
                    definition:response.notModified?null:response.data,compile});
            }catch(error){
                if(!response.notModified)throw error;
                // A 304 without an intact local model still needs a complete
                // admitted GET; it cannot render or bind from an empty body.
                const freshInfo={};
                const fresh=await connector.get({signal:controller.signal,fresh:true,cache:{bypassCache:true},responseInfo:freshInfo});
                definition=await admittedPublishedWindowModel({...identity,hash:freshInfo.artifactHash,etag:freshInfo.etag,
                    definition:fresh.data,compile});
                admittedInfo=freshInfo;
            }
            if(isAdmittedPublishedWindowResponse(admittedInfo,runtimeWindow,definition))admittedRefreshDefinitions.add(definition);
            return definition;
        },
        prepareMetadata:async definition=>{
            const binding=canonicalSelectionBinding(runtimeWindow);
            const admittedRefresh=admittedRefreshDefinitions.delete(definition);
            const applied=binding||admittedRefresh?definition:await applyWindowPermissionMetadata(definition,{services,windowId,windowKey:baseKey,
                resource:window.resource || window.parameters || {},windowParams:window.parameters || {},conversationId:window.conversationId || '',targetContext});
            if(workspaceRefreshScopeIdentity(applied)!==workspaceRefreshScopeIdentity(definition))throw new Error('Workspace admission changed the held resource scope');
            // Scope equality is verified against unmodified producer output by
            // the refresh hook before this compilation can retain delivery hints.
            const prepared=compilePermissionAppliedMetadata(applied,targetContext,window.parameters || {},binding);
            return {...prepared,__windowKey:baseKey,__targetKey:normalizeTargetKey(targetContext),__provisionalInline:false};
        },publishMetadata:definition=>{injectActions(definition);metadataSignalHandle.value=definition;},
    });

    useEffect(() => {
        if (!window?.workspaceObject || (displayState !== 'ready' && displayState !== 'error')) return;
        const lifecycleState = displayState === 'ready' ? 'ready' : 'failed';
        const entries = activeWindows.peek();
        const entry = entries.find((item) => item.windowId === windowId);
        if (!entry || entry.workspaceObject?.lifecycle?.state === lifecycleState) return;
        activeWindows.value = entries.map((item) => item.windowId === windowId ? {
            ...item,
            workspaceObject: { ...item.workspaceObject, lifecycle: { ...item.workspaceObject.lifecycle, state: lifecycleState } },
        } : item);
    }, [displayState, windowId, window?.workspaceObject]);

    if (displayState === 'error') {
        return (
            <div
                role="alert"
                style={{
                    margin: 16,
                    padding: '14px 16px',
                    border: '1px solid #efc7c2',
                    borderRadius: 8,
                    background: '#fff7f6',
                    color: '#7a271a',
                    lineHeight: 1.4,
                }}
            >
                {formatWindowMetadataError(protectedDenial || fetchError)}
            </div>
        );
    }

    if (displayState === 'loading') {
        // Soft loading placeholder for window content
        return (
            <div style={{ padding: 16, height: '100%', minHeight: 0 }}>
                <SoftSkeleton lines={1} height={18} style={{ marginBottom: 12 }} />
                <SoftBlock height={180} />
            </div>
        );
    }

    if (displayState === 'empty') {
        return (
            <div style={{ padding: 16, height: '100%', minHeight: 0, color: '#888' }}>
                {fetchError
                    ? <span>{formatWindowMetadataError(fetchError)}</span>
                    : <span>No metadata available for window "{windowKey}"</span>}
            </div>
        );
    }

    return (
        <WindowContentInner
            window={runtimeWindow}
            metadata={metadata}
            services={runtimeServices}
        />
    );
}
