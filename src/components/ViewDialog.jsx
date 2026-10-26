import NativeControlTarget from '../runtime/NativeControlTarget.jsx';
import React, {useEffect, useRef, useMemo, useState} from 'react';
import {Dialog, DialogBody, DialogFooter, Button, Classes, InputGroup} from '@blueprintjs/core';
import LayoutRenderer from './LayoutRenderer';
import DataSource from './DataSource.jsx';
import DataSourceContainer from './WindowContentDataSourceContainer.jsx';
import {dialogDataSourceRefs} from './dialogDataSourceRefs.js';
import MessageBus from './MessageBus.jsx';
import {useSignalEffect, useSignals} from '@preact/signals-react/runtime';
import {dialogHandlers} from "../hooks/index.js";
import {resolveTemplate} from "../utils/index.js";
import { getLogger } from '../utils/logger.js';
import { buildQuickFilterSeed, mergeQuickFilterValue, withoutQuickFilterParameters } from './viewDialogQuickFilters.js';
import {evaluatePlainVisibleWhen, trackVisibleWhen} from './visibleWhen.js';
import {dialogCloseDisabledWhen, isDialogCloseDisabled} from './dialogClose.js';
import {consumeDialogFocusRevision, dialogFreshFormSeed, shouldFetchDialogOnOpen, shouldRefreshDialogDataSourceForMount} from './viewDialogFreshState.js';
import MutationCommand from './primitives/MutationCommand.jsx';
import DisabledActionShell from './DisabledActionShell.jsx';

export function resolveViewDialogDataSourceContext(context, reference, selectionMode = '') {
    if (!reference || !context?.metadata?.dataSource?.[reference]) return null;
    const reuse = context?.identity?.dataSourceRef === reference
        && (!selectionMode || String(context?.dataSource?.selectionMode || '').trim().toLowerCase() === selectionMode);
    // A supplied definition may still fail authorization or initialization. Let
    // that real failure propagate instead of relabelling it as missing metadata.
    return reuse ? context : context.Context(reference, {selectionMode});
}

export function ViewDialogFooterAction({action, context, disabled = false, onClose, onInvoke, onOperateInvoke, dialogId, invokeBeforeClose = false}) {
    const [invoking, setInvoking] = useState(false);
    const invocationPending = useRef(false);
    const activate = (event,strict=false) => {
        if (disabled || invocationPending.current) return false;
        const invoke=strict?(onOperateInvoke || onInvoke):onInvoke;
        if (action?.close !== true) return invoke?.(event);
        if (!invokeBeforeClose) return onClose?.();
        invocationPending.current = true;
        const complete = (result) => {
            if (result !== false && result !== null) onClose?.();
            return result;
        };
        const release = () => { invocationPending.current = false; setInvoking(false); };
        try {
            const result = invoke?.(event);
            if (result && typeof result.then === 'function') {
                setInvoking(true);
                return Promise.resolve(result).then(complete, () => false).finally(release);
            }
            const outcome = complete(result);
            release();
            return outcome;
        } catch (_) {
            release();
            return false;
        }
    };
    if (action?.mutationCommand) {
        return <MutationCommand
            command={{...action.mutationCommand, commandId: action.mutationCommand.commandId || action.id, label: action.label || action.id, icon: action.icon || action.mutationCommand.icon, hideLabel: action.hideLabel === true, intent: action.intent || action.mutationCommand.intent, tooltip: action.tooltip || action.mutationCommand.tooltip}}
            context={context}
            disabled={disabled}
        />;
    }
    const button = <NativeControlTarget context={context} controlId={dialogId?`${dialogId}:${action.id}`:action.id} item={{...action,type:'button'}} disabled={disabled||invoking} actions={{click:({event})=>activate(event,true)}}><Button
        intent={action?.intent}
        disabled={disabled || invoking}
        loading={invoking}
        title={action?.tooltip || action?.label || action?.id}
        onClick={activate}
    >{action?.label}</Button></NativeControlTarget>;
    return disabled && action?.tooltip ? (
        <DisabledActionShell reason={action.tooltip} label={action?.label || action?.id || 'Action'}>
            {button}
        </DisabledActionShell>
    ) : button;
}

function normalizeQuickFilterSpecs(dialog) {
    const specs = Array.isArray(dialog?.properties?.quickFilters) && dialog.properties.quickFilters.length > 0
        ? dialog.properties.quickFilters
        : (dialog?.properties?.quickFilter ? [dialog.properties.quickFilter] : []);
    if (specs.length === 0) {
        return [{
            field: 'name',
            placeholder: 'Search…',
            width: 240,
            icon: 'search',
            trigger: 'debounce',
            debounceMs: 220,
        }];
    }
    return specs.map((spec) => ({
        field: String(spec?.field || 'name').trim() || 'name',
        placeholder: String(spec?.placeholder || 'Search…').trim() || 'Search…',
        width: spec?.width,
        icon: spec?.icon,
        className: spec?.className,
        style: spec?.style,
        trigger: spec?.trigger || 'debounce',
        debounceMs: spec?.debounceMs,
    }));
}

const DialogQuickSearch = ({ dsCtx, dialog, quickFilterSpecs }) => {
    useSignals();
    const searchable = !(dialog?.properties && dialog.properties.searchable === false);
    if (!searchable || quickFilterSpecs.length === 0) return null;
    const quickSearch = dialog?.properties?.quickSearch || {};
    const timersRef = React.useRef({});
    const alignMap = {
        left: 'flex-start',
        start: 'flex-start',
        center: 'center',
        right: 'flex-end',
        end: 'flex-end',
    };
    const wrapperStyle = {
        display: 'flex',
        justifyContent: 'flex-end',
        marginBottom: 8,
        ...(quickSearch.align ? { justifyContent: alignMap[quickSearch.align] || quickSearch.align } : {}),
        ...(quickSearch.gap ? { gap: quickSearch.gap } : {}),
        ...(quickSearch.style || {}),
    };
    const wrapperClassName = [
        quickSearch.className,
    ].filter(Boolean).join(' ');
    const inputStyle = quickSearch.inputStyle || {};

    const [values, setValues] = React.useState(() => {
        const initial = {};
        quickFilterSpecs.forEach((spec) => {
            initial[spec.field] = '';
        });
        return initial;
    });

    React.useEffect(() => {
        return () => {
            Object.values(timersRef.current || {}).forEach((timer) => clearTimeout(timer));
        };
    }, []);

    const dialogInputValue = dsCtx?.signals?.input?.value || {};
    useEffect(() => {
        try {
            const next = {};
            quickFilterSpecs.forEach((spec) => {
                next[spec.field] = dialogInputValue?.filter?.[spec.field] == null ? '' : String(dialogInputValue.filter[spec.field]);
            });
            setValues((prev) => {
                const prevKeys = Object.keys(prev || {});
                const nextKeys = Object.keys(next);
                if (prevKeys.length === nextKeys.length && nextKeys.every((key) => prev[key] === next[key])) {
                    return prev;
                }
                return next;
            });
        } catch (_) {}
    }, [dialogInputValue, quickFilterSpecs]);

    const applySearch = (field, text, debounceMs = 0) => {
        try {
            const h = dsCtx?.handlers?.dataSource;
            const currentFilter = h?.peekFilter?.() || {};
            const nextFilter = mergeQuickFilterValue(currentFilter, field, text);
            const fetch = () => {
                h?.setFilter?.({ filter: nextFilter });
            };
            if (debounceMs > 0) {
                if (timersRef.current[field]) clearTimeout(timersRef.current[field]);
                timersRef.current[field] = setTimeout(fetch, debounceMs);
            } else {
                if (timersRef.current[field]) clearTimeout(timersRef.current[field]);
                fetch();
            }
        } catch (_) {}
    };

    const updateQuickFilterValue = (spec, rawValue) => {
        const v = rawValue ?? '';
        setValues((prev) => ({ ...prev, [spec.field]: v }));
        const trigger = spec.trigger || quickSearch.trigger || "commit";
        if (trigger === "change" || trigger === "debounce") {
            const debounceMs = trigger === "debounce" ? (spec.debounceMs ?? quickSearch.debounceMs ?? 220) : 0;
            applySearch(spec.field, v, debounceMs);
        }
    };

    return (
        <div className={wrapperClassName} style={wrapperStyle}>
            {quickFilterSpecs.map((spec) => (
                <InputGroup
                    key={spec.field}
                    leftIcon={spec.icon || quickSearch.icon || "search"}
                    placeholder={spec.placeholder}
                    value={values[spec.field] || ''}
                    onChange={(e) => updateQuickFilterValue(spec, e?.target?.value)}
                    onInput={(e) => updateQuickFilterValue(spec, e?.target?.value)}
                    onBlur={(e) => {
                        const v = e?.target?.value ?? '';
                        const trigger = spec.trigger || quickSearch.trigger || "commit";
                        if (trigger !== "change" && trigger !== "debounce") {
                            applySearch(spec.field, v);
                        }
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            const v = e?.target?.value ?? '';
                            applySearch(spec.field, v);
                        }
                    }}
                    style={{
                        ...inputStyle,
                        ...(quickSearch.inputWidth ? { width: quickSearch.inputWidth } : {}),
                        ...(spec.width ? { width: spec.width } : {}),
                        ...(spec.style || {}),
                    }}
                    className={[
                        "bp4-small",
                        quickSearch.inputClassName,
                        spec.className,
                    ].filter(Boolean).join(" ")}
                />
            ))}
        </div>
    );
};

export function resolveDialogSelectionMode(dialog = {}, callerProps = {}) {
    if (callerProps?.multiple === true) return "multi";
    if (callerProps?.multiple === false) return "single";
    const explicitMode = String(
        dialog?.selectionMode
        || dialog?.properties?.selectionMode
        || ""
    ).trim().toLowerCase();
    if (explicitMode === "multi" || explicitMode === "single") {
        return explicitMode;
    }
    const explicitMultiple = dialog?.multiple ?? dialog?.properties?.multiple;
    if (explicitMultiple === true) return "multi";
    if (explicitMultiple === false) return "single";
    return "";
}

const ViewDialog = ({context, dialog, focusRequest = 0}) => {
    useSignals();
    const log = getLogger('dialog');
    const {handlers} = context
    const resolvedDataSourceRef = dialog?.dataSourceRef || context?.identity?.dataSourceRef || '';
    const fetchOnOpen = shouldFetchDialogOnOpen(dialog);
    const callerProps = handlers.dialog.callerProps?.() || {};
    const selectionModeOverride = resolveDialogSelectionMode(dialog, callerProps);

    const events = dialogHandlers(context, dialog)
    const quickFilterConfigKey = useMemo(() => JSON.stringify({
        quickFilter: dialog?.properties?.quickFilter || null,
        quickFilters: dialog?.properties?.quickFilters || [],
    }), [dialog?.properties?.quickFilter, dialog?.properties?.quickFilters]);
    const quickFilterSpecs = useMemo(() => normalizeQuickFilterSpecs(dialog), [quickFilterConfigKey]);

    const dialogOpen = handlers.dialog.isOpen();
    const focusClassName = `forge-dialog-focus-${String(context?.identity?.windowId || 'window').replace(/[^a-zA-Z0-9_-]/g, '-')}-${String(dialog?.id || 'dialog').replace(/[^a-zA-Z0-9_-]/g, '-')}`;
    const previousOpenRef = useRef(false);
    // WindowContent removes closed dialogs, so a close can unmount this view
    // before the open-state effect observes the transition.
    const closeEventRef = useRef(null);
    closeEventRef.current = () => {
        if (previousOpenRef.current && !handlers.dialog.isOpen()) {
            previousOpenRef.current = false;
            if (events.onClose.isDefined()) events.onClose.execute({context, dialog});
        }
    };
    useEffect(() => () => closeEventRef.current?.(), []);
    useEffect(() => {
        if (!dialogOpen || Number(focusRequest || 0) <= 0 || typeof document === 'undefined') return;
        const timer = setTimeout(() => {
            const root = document.querySelector(`.${focusClassName}`);
            const target = root?.querySelector('input, textarea, select, button, [tabindex]:not([tabindex="-1"])') || root;
            try { target?.focus?.(); } catch (_) {}
        }, 0);
        return () => clearTimeout(timer);
    }, [dialogOpen, focusClassName, focusRequest]);
    useEffect(() => {
        if (resolvedDataSourceRef && !context?.metadata?.dataSource?.[resolvedDataSourceRef]) {
            previousOpenRef.current = false;
            return;
        }
        const isDialogOpen = dialogOpen;
        const wasOpen = previousOpenRef.current;
        log.debug('open effect', { isDialogOpen, wasOpen, dsRef: resolvedDataSourceRef });
        if (isDialogOpen && !wasOpen) {
            const dialogContext = (() => {
                try {
                    return resolvedDataSourceRef
                        ? context?.Context?.(resolvedDataSourceRef, selectionModeOverride ? { selectionMode: selectionModeOverride } : {})
                        : null;
                } catch (_) {
                    return null;
                }
            })();
            const dialogDataSourceHandlers = dialogContext?.handlers?.dataSource;
            const focusOwner = context?.signals?.windowControl || context?.windowState || context;
            const lastHandledFocusRequest = consumeDialogFocusRevision(focusOwner, dialog?.id, focusRequest);
            const refreshOnOpen = shouldRefreshDialogDataSourceForMount(
                dialogContext?.dataSource,
                focusRequest,
                lastHandledFocusRequest,
            );
            try {
                const args = handlers.dialog.callerArgs();
                const callerProps = handlers.dialog.callerProps?.() || {};
                const explicitParameters = (callerProps?.parameters && typeof callerProps.parameters === 'object')
                    ? callerProps.parameters
                    : {};
                const dsRef = resolvedDataSourceRef;
                let params = {};
                if (Object.keys(explicitParameters).length > 0) {
                    params = explicitParameters;
                } else if (args && typeof args === 'object') {
                    const scoped = (dsRef && args[dsRef]) ? args[dsRef] : args;
                    const inputObj = (scoped && typeof scoped === 'object') ? (scoped.input || scoped) : {};
                    params = (inputObj && typeof inputObj === 'object') ? (inputObj.parameters || inputObj) : {};
                }
                params = withoutQuickFilterParameters(params, quickFilterSpecs);
                const current = dialogDataSourceHandlers?.peekInput?.() || {};
                const filterSeedSource = Object.keys(explicitParameters).length > 0
                    ? explicitParameters
                    : args;
                const nextFilter = buildQuickFilterSeed(filterSeedSource, quickFilterSpecs);
                const nextArgsStr = JSON.stringify(args || {});
                const prevArgsStr = JSON.stringify((current.args || {}));
                const nextParamsStr = JSON.stringify(params || {});
                const prevParamsStr = JSON.stringify((current.parameters || {}));
                const nextFilterStr = JSON.stringify(nextFilter || {});
                const prevFilterStr = JSON.stringify((current.filter || {}));
                const inputChanged = nextArgsStr !== prevArgsStr || nextParamsStr !== prevParamsStr || nextFilterStr !== prevFilterStr;
                // Responsive metadata can remount an already-open dialog and make
                // caller input look newly bound. A datasource that explicitly
                // preserves dialog state must not lose its live form merely
                // because that remount changed the input identity; its owning
                // open action remains responsible for any intentional reset.
                if (refreshOnOpen && fetchOnOpen) {
                    try {
                        const formSeed = dialogFreshFormSeed(
                            dialogContext?.dataSource,
                            dialogContext?.signals?.collection?.peek?.() || [],
                        );
                        dialogDataSourceHandlers?.resetSelection?.();
                        dialogDataSourceHandlers?.setCollection?.([]);
                        dialogDataSourceHandlers?.setFormData?.({values: formSeed});
                        // A fresh dialog instance starts at the first page. Do
                        // not use setPage here: it schedules a read before the
                        // caller's new parameters and filter have been bound.
                        if (dialogContext?.signals?.input) {
                            const input = dialogContext.signals.input;
                            input.value = {...input.peek(), page: 1, fetch: false, refresh: false};
                        }
                        if (dialogContext?.signals?.collectionInfo) {
                            dialogContext.signals.collectionInfo.value = {};
                        }
                    } catch (e) {
                        log.warn('reset dialog dataSource state error', { error: String(e?.message || e) });
                    }
                }
                // Only set when changed to avoid signal cycles
                if (nextArgsStr !== prevArgsStr) {
                    log.debug('setInputArgs', { nextArgs: args, prevArgs: current.args || {} });
                    dialogDataSourceHandlers?.setInputArgs?.(args);
                }

                // Seed DS input parameters from dialog args so dataSource.parameters
                // (path/query deps) resolve correctly on first fetch.
                try {
                    if (prevParamsStr !== nextParamsStr) {
                        log.debug('setInputParameters', { ds: dsRef, params, prev: current.parameters || {} });
                        dialogDataSourceHandlers?.setInputParameters?.(params);
                    }
                } catch (e) {
                    log.warn('setInputParameters error', { error: String(e?.message || e) });
                }
            } catch (e) {
                log.warn('setInputArgs error', { error: String(e?.message || e) });
            }
            // Trigger initial fetch using DS helper (deferred to avoid reactive cycle)
            try {
                if (!fetchOnOpen) {
                    previousOpenRef.current = isDialogOpen;
                    if (events.onOpen.isDefined()) {
                        events.onOpen.execute({ context, dialog });
                    }
                    return;
                }
                setTimeout(() => {
                    try {
                        const dsC = resolvedDataSourceRef
                            ? context?.Context?.(resolvedDataSourceRef, selectionModeOverride ? { selectionMode: selectionModeOverride } : {})
                            : null;
                        const dsHandlers = dsC?.handlers?.dataSource;
                        const inSig = dsC?.signals?.input;
                        const args = (inSig?.peek?.() || {}).args || {};
                        const callerProps = handlers.dialog.callerProps?.() || {};
                        const explicitParameters = (callerProps?.parameters && typeof callerProps.parameters === 'object')
                            ? callerProps.parameters
                            : {};
                        const filterSeedSource = Object.keys(explicitParameters).length > 0
                            ? explicitParameters
                            : args;
                        const filter = buildQuickFilterSeed(filterSeedSource, quickFilterSpecs);
                        console.debug(
                            '[lookup-dialog][seed]',
                            JSON.stringify({
                                dialogId: dialog?.id,
                                dataSourceRef: resolvedDataSourceRef,
                                args,
                                explicitParameters,
                                filter,
                            })
                        );
                        log.debug('deferred fetch', { filter, args });
                        dsHandlers?.setInactive?.(false);
                        if (refreshOnOpen) {
                            dsHandlers?.fetchCollection?.({filter, replaceFilter: true, cache: {bypassCache: true}});
                        } else {
                            dsHandlers?.setFilter?.({ filter });
                        }
                    } catch (err) {
                        log.warn('deferred fetch error', { error: String(err?.message || err) });
                    }
                }, 0);
            } catch (e) {
                log.warn('schedule fetch on open error', { error: String(e?.message || e) });
            }
            if (events.onOpen.isDefined()) {
                events.onOpen.execute({ context, dialog });
            }
        } else if (wasOpen && !isDialogOpen && events.onClose.isDefined()) {
            events.onClose.execute({ context, dialog });
        }
        previousOpenRef.current = isDialogOpen;
    }, [dialogOpen, handlers, resolvedDataSourceRef, selectionModeOverride, context, dialog, events, quickFilterSpecs, fetchOnOpen, focusRequest, log]);

    React.useEffect(()=>{
        context.services?.hostWindow?.setDialogOpen?.(dialog.id,Boolean(dialogOpen));
        return ()=>context.services?.hostWindow?.setDialogOpen?.(dialog.id,false);
    },[context,dialog.id,dialogOpen]);

    const handleClose = () => {
        if (isDialogCloseDisabled(dialog, dsCtx)) return false;
        const close = () => { handlers.dialog.close(); return true; };
        if (!events.onClose.isDefined()) return close();
        const result = events.onClose.execute({context: dsCtx, dialog});
        if (result && typeof result.then === 'function') return result.then(value => value === false || value === null ? false : close());
        return result === false || result === null ? false : close();
    };

    // An unresolved local definition omits this dialog without an end-user
    // warning or action buttons accidentally bound to its parent datasource.
    const dsCtx = resolveViewDialogDataSourceContext(context, resolvedDataSourceRef, selectionModeOverride);
    const missingDataSourceDefinition = !!resolvedDataSourceRef && !context?.metadata?.dataSource?.[resolvedDataSourceRef];
    if (missingDataSourceDefinition) log.debug('Omitted dialog with unresolved datasource reference', {dialogId: dialog?.id, dataSourceRef: resolvedDataSourceRef});

    if (dsCtx?.dataSource && selectionModeOverride) {
        dsCtx.dataSource.selectionMode = selectionModeOverride;
    }

    useSignalEffect(() => {
        if (!dialogOpen || !dsCtx?.signals?.selection || !selectionModeOverride) {
            return;
        }
        const current = dsCtx.signals.selection.value || {};
        if (selectionModeOverride === 'multi') {
            if (!Array.isArray(current.selection)) {
                dsCtx.signals.selection.value = { selection: [] };
            }
            return;
        }
        if (Array.isArray(current.selection)) {
            dsCtx.signals.selection.value = { selected: null, rowIndex: -1 };
        }
    });

    useSignalEffect(() => {
        if (!dialogOpen || !dsCtx?.handlers?.dataSource || !dsCtx?.signals?.collection || !dsCtx?.signals?.selection) {
            return;
        }
        const selectionMode = selectionModeOverride || String(dsCtx?.dataSource?.selectionMode || "").trim().toLowerCase() || "single";
        if (selectionMode === "multi") {
            return;
        }
        const collection = Array.isArray(dsCtx.signals.collection.value) ? dsCtx.signals.collection.value : [];
        const currentSelection = dsCtx.signals.selection.value || {};
        if (collection.length !== 1) {
            return;
        }
        if (currentSelection?.selected && (currentSelection?.rowIndex ?? -1) >= 0) {
            return;
        }
        dsCtx.handlers.dataSource.setSelected?.({ selected: collection[0], rowIndex: 0 });
    });

    // Selection state to drive default footer button enablement (reactive)
    const selectionValue = dsCtx?.signals?.selection?.value;
    const canSelect = !!(selectionValue && (selectionValue.selected || (Array.isArray(selectionValue.selection) && selectionValue.selection.length > 0)));
    const closeDisabledWhen = dialogCloseDisabledWhen(dialog);
    trackVisibleWhen(closeDisabledWhen, dsCtx);
    const closeDisabled = isDialogCloseDisabled(dialog, dsCtx);

    if (!dialogOpen || missingDataSourceDefinition) {
        return null;
    }



    const input = handlers.dataSource.peekInput()

    const title = resolveTemplate(dialog.title, {input})

    const {style={}} = dialog
    const dialogStyle = {...style};
    const dialogClassName = [
        "forge-view-dialog",
        focusClassName,
        selectionModeOverride ? "forge-lookup-dialog" : "",
        dialog.className,
        dialog?.properties?.className,
    ].filter(Boolean).join(" ");
    const bodyClassName = dialog?.properties?.bodyClassName;
    const bodyStyle = dialog?.properties?.bodyStyle;
    const contentClassName = dialog?.properties?.contentClassName;
    const contentStyle = dialog?.properties?.contentStyle;
    // Build footer actions: prefer metadata actions; otherwise provide defaults
    const renderFooterActions = () => {
        if (dialog.actions && Array.isArray(dialog.actions) && dialog.actions.length > 0) return undefined; // keep metadata-driven buttons
        return (
            <>
                <NativeControlTarget context={dsCtx} controlId={`${dialog.id}:cancel`} item={{type:'button'}} disabled={closeDisabled} actions={{click:handleClose}}><Button minimal onClick={handleClose}>Cancel</Button></NativeControlTarget>
                <NativeControlTarget context={dsCtx} controlId={`${dialog.id}:select`} item={{type:'button'}} disabled={!canSelect} actions={{click:()=>context.handlers.dialog.commit?.({context:dsCtx})}}><Button intent="primary" disabled={!canSelect} onClick={() => context.handlers.dialog.commit?.({ context: dsCtx })}>Select</Button></NativeControlTarget>
            </>
        );
    };

    const visibleDialogActions = Array.isArray(dialog.actions)
        ? dialog.actions.filter((action) => {
            trackVisibleWhen(action?.visibleWhen, dsCtx);
            return !action?.visibleWhen || evaluatePlainVisibleWhen(action.visibleWhen, dsCtx);
        })
        : [];

    const dialogActionDisabled = (action) => {
        trackVisibleWhen(action?.disabledWhen, dsCtx);
        return action?.disabled === true
            || (!!action?.disabledWhen && evaluatePlainVisibleWhen(action.disabledWhen, dsCtx));
    };

    return (

        <div             onMouseDown={(e) => e.stopPropagation()} >

        <Dialog
            isOpen={dialogOpen}
            onClose={handleClose}
            title={title}
            isCloseButtonShown={!closeDisabled}
            canEscapeKeyClose={!closeDisabled}
            canOutsideClickClose={!closeDisabled}
            className={dialogClassName || undefined}
            portalClassName={dialog?.properties?.portalClassName || undefined}
            style={dialogStyle}
        >
            <DialogBody className={bodyClassName} style={bodyStyle}>
                {/* Mount DataSource + MessageBus for dialog DS to enable fetching */}
                {dsCtx ? (<>
                    <DataSource context={dsCtx} />
                    <MessageBus context={dsCtx} />
                    {dialogDataSourceRefs(dialog, context?.metadata?.dataSource, resolvedDataSourceRef).map(ref => (
                        <DataSourceContainer key={ref} windowContext={dsCtx} dsKey={ref} suppressAutomaticFetch />
                    ))}
                </>) : null}
                {/* Inline quick-search input above the content for a friendlier UX */}
                <DialogQuickSearch dsCtx={dsCtx} dialog={dialog} quickFilterSpecs={quickFilterSpecs} />
                <div className={contentClassName} style={contentStyle}>
                    <LayoutRenderer
                        context={dsCtx}
                        container={{
                            dataSourceRef: resolvedDataSourceRef,
                            ...dialog.content,
                            // The open effect owns this read after binding caller
                            // arguments. Keep distinct child sources independent.
                            ...(fetchOnOpen && (!dialog.content?.dataSourceRef || dialog.content.dataSourceRef === resolvedDataSourceRef)
                                ? {fetchData: false} : {}),
                        }}
                        sizingMode="content"
                    />
                </div>
            </DialogBody>
            <DialogFooter actions={
                (dialog.actions && dialog.actions.length > 0)
                    ? visibleDialogActions.map((action) => (
                        <ViewDialogFooterAction
                            key={action.id}
                            action={action}
                            dialogId={dialog.id}
                            onOperateInvoke={(event)=>events.actions?.[action.id]?.onClick?.executeStrict?.({event,action:action.id,context:dsCtx})}
                            context={dsCtx}
                            disabled={dialogActionDisabled(action)}
                            onClose={handleClose}
                            invokeBeforeClose={events.actions?.[action.id]?.onClick?.isDefined?.() === true}
                            onInvoke={(e) => {
                                const handler = events.actions[action.id]
                                if (handler?.onClick) {
                                    // Execute action handlers in the dialog's DS context so
                                    // service functions do not need to call hooks (Context.Context)
                                    return handler.onClick.execute({event: e, action: action.id, context: dsCtx})
                                }
                            }}
                        />
                    ))
                    : renderFooterActions()
            }/>
        </Dialog>
        </div>

    );
};

export default ViewDialog;
