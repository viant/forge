import React, {useEffect, useMemo, useRef, useState} from 'react';

import {Spinner} from '@blueprintjs/core';
import SoftSkeleton, { SoftBlock } from './SoftSkeleton.jsx';

import {
    getMetadataSignal,
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
import {injectActions} from '../actions';


/* ------------------------------------------------------------------
 * WindowContentInner – rendered ONLY after metadata has been fetched so
 * every render executes the same Hook sequence.  All code that calls
 * React hooks (including Context() which internally uses hooks) lives here.
 * ------------------------------------------------------------------ */

function WindowContentInner({window, metadata, services}) {
    const {windowKey, windowData, windowId, parameters = {}} = window;
    const baseKey = (windowKey || '').split('?')[0];

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
        return ctx;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [windowId, metadata]);

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
                    const fn = context.lookupHandler(handlerId);
                    fn({ execution: { id: handlerId, args, parameters }, context });
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
    }, [context]);

    const dataSources = metadata.dataSource || {};
    const dialogs     = metadata.dialogs   || [];

    /* ------------------------------------------------------------
     * Rendering helpers
     * ---------------------------------------------------------- */

    const renderDataSources = () => {
        return (
            <>
                {Object.keys(dataSources).map((key) => (
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
        <div>
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

    // Settings & connector
    const {connectorConfig = {}, services = {}} = useSetting();
    if (!connectorConfig.window) {
        throw new Error('No connectorConfig.window found');
    }

    const {service} = connectorConfig.window;
    const baseKey = windowKey.split('?')[0];
    const config  = {service: {...service, uri: `${service.uri}/${baseKey}`}};
    const connector = useDataConnector(config);

    // Fetch metadata once per windowId
    useEffect(() => {
        let cancelled = false;
        setLoading(true);

        connector.get({})
            .then((resp) => {
                if (cancelled) return;
                injectActions(resp.data);
                metadataSignal.value = resp.data;
            })
            .catch((err) => {
                if (!cancelled) {
                    console.error('Error fetching metadata', err);
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

    if (loading || !metadata) {
        // Soft loading placeholder for window content
        return (
            <div style={{ padding: 16 }}>
                <SoftSkeleton lines={1} height={18} style={{ marginBottom: 12 }} />
                <SoftBlock height={180} />
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
