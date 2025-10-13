import React, {useState, useEffect, useRef} from 'react';
import {Dialog, DialogBody, DialogFooter, Button, Classes, InputGroup} from '@blueprintjs/core';
import LayoutRenderer from './LayoutRenderer';
import DataSource from './DataSource.jsx';
import MessageBus from './MessageBus.jsx';
import {useSignalEffect} from "@preact/signals-react";
import {dialogHandlers} from "../hooks";
import {resolveTemplate} from "../utils";
import { getLogger } from '../utils/logger.js';


const ViewDialog = ({context, dialog}) => {
    const [isOpen, setIsOpen] = useState(false);
    const log = getLogger('dialog');
    const {handlers} = context

    const events = dialogHandlers(context, dialog)
    useSignalEffect(() => {
        const isDialogOpen = handlers.dialog.isOpen();
        log.debug('open effect', { isDialogOpen, wasOpen: isOpen, dsRef: dialog?.dataSourceRef });
        if (isDialogOpen && !isOpen) {
            try {
                const args = handlers.dialog.callerArgs();
                const current = handlers.dataSource.peekInput?.() || {};
                const nextArgsStr = JSON.stringify(args || {});
                const prevArgsStr = JSON.stringify((current.args || {}));
                // Only set when changed to avoid signal cycles
                if (nextArgsStr !== prevArgsStr) {
                    log.debug('setInputArgs', { nextArgs: args, prevArgs: current.args || {} });
                    handlers.dataSource.setInputArgs(args);
                }
            } catch (e) {
                console.warn('[ViewDialog] setInputArgs error', e);
            }
            // Trigger initial fetch using DS helper (deferred to avoid reactive cycle)
            try {
                setTimeout(() => {
                    try {
                        const dsC = context?.Context?.(dialog.dataSourceRef);
                        const dsHandlers = dsC?.handlers?.dataSource;
                        const inSig = dsC?.signals?.input;
                        const args = (inSig?.peek?.() || {}).args || {};
                        const filter = {};
                        if (args && typeof args === 'object' && args.name) filter.name = args.name;
                        log.debug('deferred fetchCollection', { filter, args });
                        dsHandlers?.fetchCollection?.({ filter });
                    } catch (err) {
                        console.warn('[ViewDialog] deferred fetchCollection error', err);
                    }
                }, 0);
            } catch (e) {
                console.warn('[ViewDialog] schedule fetch on open error', e);
            }
            if (events.onOpen.isDefined()) {
                events.onOpen.execute({ context, dialog });
            }
        }
        if (isOpen !== isDialogOpen) {
            setIsOpen(isDialogOpen);
        }
    });

    const handleClose = () => {
        handlers.dialog.close();
    };

    // Prepare a DS-scoped context for the dialog data source so hooks below
    // can subscribe to its signals regardless of visibility.
    let dsCtx;
    try {
        const dsExists = !!(context?.metadata?.dataSource && context.metadata.dataSource[dialog.dataSourceRef]);
        if (!dsExists) {
            const keys = Object.keys(context?.metadata?.dataSource || {});
            let callers = [];
            try {
                const stack = (new Error()).stack || '';
                callers = String(stack).split('\n').slice(2, 6).map((s) => s.trim());
            } catch (_) {}
            console.error('[ViewDialog] dataSourceRef not found for dialog', dialog?.id || '(no id)', {
                dataSourceRef: dialog?.dataSourceRef,
                available: keys,
                callers,
            });
        }
        dsCtx = context.Context(dialog.dataSourceRef);
    } catch (e) {
        let callers = [];
        try {
            const stack = (new Error()).stack || '';
            callers = String(stack).split('\n').slice(2, 6).map((s) => s.trim());
        } catch (_) {}
        console.error('[ViewDialog] failed to create DS context for', dialog?.dataSourceRef, { error: String(e?.message || e), callers });
        dsCtx = null;
    }

    // Selection state to drive default footer button enablement (reactive)
    const [canSelect, setCanSelect] = React.useState(false);
    useSignalEffect(() => {
        try {
            const sel = dsCtx?.signals?.selection?.value;
            const has = !!(sel && (sel.selected || (Array.isArray(sel.selection) && sel.selection.length > 0)));
            setCanSelect(has);
        } catch (_) {}
    });

    if (!isOpen) {
        return null;
    }



    const input = handlers.dataSource.peekInput()

    const title = resolveTemplate(dialog.title, {input})

    const {style={}} = dialog
    const dialogStyle = {
        // height: "100%",
        // display: "flex",
        // flexDirection: "column",
        zIndex: 100,
              ...style,
    }

    // Quick search is rendered via a child component to keep hook order stable
    const DialogQuickSearch = ({ dsCtx }) => {
        const searchable = !(dialog?.properties && dialog.properties.searchable === false);
        if (!searchable) return null;
        const [q, setQ] = React.useState('');
        const debounceRef = React.useRef(null);
        React.useEffect(() => {
            try {
                const cur = dsCtx?.signals?.input?.peek?.() || {};
                const name = (cur.filter && cur.filter.name) || '';
                setQ(String(name || ''));
            } catch (_) {}
        }, [dsCtx]);
        const applySearch = (text) => {
            try {
                const h = dsCtx?.handlers?.dataSource;
                h?.setSilentFilterValues?.({ filter: { name: text } });
                if (debounceRef.current) clearTimeout(debounceRef.current);
                debounceRef.current = setTimeout(() => h?.fetchCollection?.(), 220);
            } catch (_) {}
        };
        return (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                <InputGroup
                    leftIcon="search"
                    placeholder="Search…"
                    value={q}
                    onChange={(e) => {
                        const v = e?.target?.value ?? '';
                        setQ(v);
                        applySearch(v);
                    }}
                    style={{ width: 240 }}
                    className="bp4-small"
                />
            </div>
        );
    };


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
            isOpen={isOpen}
            onClose={handleClose}
            title={title}
            isCloseButtonShown={true}
            style={dialogStyle}
        >
            <DialogBody>
                {/* Mount DataSource + MessageBus for dialog DS to enable fetching */}
                {dsCtx ? (<>
                    <DataSource context={dsCtx} />
                    <MessageBus context={dsCtx} />
                </>) : (
                    <div style={{ color: '#a82a2a', padding: 8 }}>Dialog misconfigured: missing data source “{String(dialog.dataSourceRef)}”.</div>
                )}
                {/* Inline quick-search input above the content for a friendlier UX */}
                <DialogQuickSearch dsCtx={dsCtx} />
                <LayoutRenderer
                    context={dsCtx}
                    container={{dataSourceRef: dialog.dataSourceRef, ...dialog.content}}
                />
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
