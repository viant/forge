import React, {useEffect, useRef, useMemo} from 'react';
import {Dialog, DialogBody, DialogFooter, Button, Classes, InputGroup} from '@blueprintjs/core';
import LayoutRenderer from './LayoutRenderer';
import DataSource from './DataSource.jsx';
import MessageBus from './MessageBus.jsx';
import {useSignalEffect, useSignals} from '@preact/signals-react/runtime';
import {dialogHandlers} from "../hooks";
import {resolveTemplate} from "../utils";
import { getLogger } from '../utils/logger.js';
import { buildQuickFilterSeed, mergeQuickFilterValue } from './viewDialogQuickFilters.js';

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

const ViewDialog = ({context, dialog}) => {
    useSignals();
    const log = getLogger('dialog');
    const {handlers} = context
    const resolvedDataSourceRef = dialog?.dataSourceRef || context?.identity?.dataSourceRef || '';
    const callerProps = handlers.dialog.callerProps?.() || {};
    const selectionModeOverride = resolveDialogSelectionMode(dialog, callerProps);

    const events = dialogHandlers(context, dialog)
    const quickFilterConfigKey = useMemo(() => JSON.stringify({
        quickFilter: dialog?.properties?.quickFilter || null,
        quickFilters: dialog?.properties?.quickFilters || [],
    }), [dialog?.properties?.quickFilter, dialog?.properties?.quickFilters]);
    const quickFilterSpecs = useMemo(() => normalizeQuickFilterSpecs(dialog), [quickFilterConfigKey]);

    const dialogOpen = handlers.dialog.isOpen();
    const previousOpenRef = useRef(false);
    useEffect(() => {
        const isDialogOpen = dialogOpen;
        const wasOpen = previousOpenRef.current;
        log.debug('open effect', { isDialogOpen, wasOpen, dsRef: resolvedDataSourceRef });
        if (isDialogOpen && !wasOpen) {
            const dialogContext = (() => {
                try {
                    return resolvedDataSourceRef ? context?.Context?.(resolvedDataSourceRef) : null;
                } catch (_) {
                    return null;
                }
            })();
            const dialogDataSourceHandlers = dialogContext?.handlers?.dataSource;
            try {
                const args = handlers.dialog.callerArgs();
                const callerProps = handlers.dialog.callerProps?.() || {};
                const explicitParameters = (callerProps?.parameters && typeof callerProps.parameters === 'object')
                    ? callerProps.parameters
                    : {};
                const current = dialogDataSourceHandlers?.peekInput?.() || {};
                const nextArgsStr = JSON.stringify(args || {});
                const prevArgsStr = JSON.stringify((current.args || {}));
                // Only set when changed to avoid signal cycles
                if (nextArgsStr !== prevArgsStr) {
                    log.debug('setInputArgs', { nextArgs: args, prevArgs: current.args || {} });
                    dialogDataSourceHandlers?.setInputArgs?.(args);
                }

                // Seed DS input parameters from dialog args so dataSource.parameters
                // (path/query deps) resolve correctly on first fetch.
                try {
                    const dsRef = resolvedDataSourceRef;
                    let params = {};
                    if (Object.keys(explicitParameters).length > 0) {
                        params = explicitParameters;
                    } else if (args && typeof args === 'object') {
                        const scoped = (dsRef && args[dsRef]) ? args[dsRef] : args;
                        const inputObj = (scoped && typeof scoped === 'object') ? (scoped.input || scoped) : {};
                        params = (inputObj && typeof inputObj === 'object') ? (inputObj.parameters || inputObj) : {};
                    }
                    const prevParams = dialogDataSourceHandlers?.peekInput?.()?.parameters || {};
                    if (JSON.stringify(prevParams) !== JSON.stringify(params)) {
                        log.debug('setInputParameters', { ds: dsRef, params, prev: prevParams });
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
                setTimeout(() => {
                    try {
                        const dsC = resolvedDataSourceRef ? context?.Context?.(resolvedDataSourceRef) : null;
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
                        log.debug('deferred fetchCollection', { filter, args });
                        dsHandlers?.setInactive?.(false);
                        if (Object.keys(filter || {}).length > 0) {
                            dsHandlers?.setSilentFilterValues?.({ filter });
                        }
                        dsHandlers?.fetchCollection?.();
                    } catch (err) {
                        log.warn('deferred fetchCollection error', { error: String(err?.message || err) });
                    }
                }, 0);
            } catch (e) {
                log.warn('schedule fetch on open error', { error: String(e?.message || e) });
            }
            if (events.onOpen.isDefined()) {
                events.onOpen.execute({ context, dialog });
            }
        }
        previousOpenRef.current = isDialogOpen;
    }, [dialogOpen, handlers, resolvedDataSourceRef, context, dialog, events, quickFilterSpecs, log]);

    const handleClose = () => {
        handlers.dialog.close();
    };

    // Prepare a DS-scoped context for the dialog data source so hooks below
    // can subscribe to its signals regardless of visibility.
    let dsCtx;
    try {
        const dsExists = !!(resolvedDataSourceRef && context?.metadata?.dataSource && context.metadata.dataSource[resolvedDataSourceRef]);
        if (!dsExists) {
            const keys = Object.keys(context?.metadata?.dataSource || {});
            let callers = [];
            try {
                const stack = (new Error()).stack || '';
                callers = String(stack).split('\n').slice(2, 6).map((s) => s.trim());
            } catch (_) {}
            console.error('[ViewDialog] dataSourceRef not found for dialog', dialog?.id || '(no id)', {
                dataSourceRef: resolvedDataSourceRef,
                available: keys,
                callers,
            });
        }
        const reuseDirectContext = resolvedDataSourceRef
            && context?.identity?.dataSourceRef === resolvedDataSourceRef
            && (!selectionModeOverride || String(context?.dataSource?.selectionMode || "").trim().toLowerCase() === selectionModeOverride);
        dsCtx = reuseDirectContext
            ? context
            : (resolvedDataSourceRef ? context.Context(resolvedDataSourceRef, { selectionMode: selectionModeOverride }) : null);
    } catch (e) {
        let callers = [];
        try {
            const stack = (new Error()).stack || '';
            callers = String(stack).split('\n').slice(2, 6).map((s) => s.trim());
        } catch (_) {}
        console.error('[ViewDialog] failed to create DS context for', resolvedDataSourceRef, { error: String(e?.message || e), callers });
        dsCtx = null;
    }

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

    if (!dialogOpen) {
        return null;
    }



    const input = handlers.dataSource.peekInput()

    const title = resolveTemplate(dialog.title, {input})

    const {style={}} = dialog
    const dialogStyle = {...style};
    const dialogClassName = [
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
                <Button minimal onClick={handleClose}>Cancel</Button>
                <Button intent="primary" disabled={!canSelect} onClick={() => context.handlers.dialog.commit?.({ context: dsCtx })}>Select</Button>
            </>
        );
    };

    return (

        <div             onMouseDown={(e) => e.stopPropagation()} >

        <Dialog
            isOpen={dialogOpen}
            onClose={handleClose}
            title={title}
            isCloseButtonShown={true}
            className={dialogClassName || undefined}
            style={dialogStyle}
        >
            <DialogBody className={bodyClassName} style={bodyStyle}>
                {/* Mount DataSource + MessageBus for dialog DS to enable fetching */}
                {dsCtx ? (<>
                    <DataSource context={dsCtx} />
                    <MessageBus context={dsCtx} />
                </>) : (
                    <div style={{ color: '#a82a2a', padding: 8 }}>Dialog misconfigured: missing data source “{String(resolvedDataSourceRef)}”.</div>
                )}
                {/* Inline quick-search input above the content for a friendlier UX */}
                <DialogQuickSearch dsCtx={dsCtx} dialog={dialog} quickFilterSpecs={quickFilterSpecs} />
                <div className={contentClassName} style={contentStyle}>
                    <LayoutRenderer
                        context={dsCtx}
                        container={{dataSourceRef: resolvedDataSourceRef, ...dialog.content}}
                    />
                </div>
            </DialogBody>
            <DialogFooter actions={
                (dialog.actions && dialog.actions.length > 0)
                    ? dialog.actions.map((action) => (
                        <Button
                            key={action.id}
                            intent={action.intent}
                            onClick={(e) => {
                                const handler = events.actions[action.id]
                                if (handler.onClick) {
                                    // Execute action handlers in the dialog's DS context so
                                    // service functions do not need to call hooks (Context.Context)
                                    return handler.onClick.execute({event: e, action: action.id, context: dsCtx})
                                }
                            }}
                        >{action.label}</Button>
                    ))
                    : renderFooterActions()
            }/>
        </Dialog>
        </div>

    );
};

export default ViewDialog;
