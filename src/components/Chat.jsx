import React, { useState, useCallback } from "react";
import { useDataSourceState } from "../hooks/useDataSourceState.js";


// Re-exported building blocks living under src/components/chat
import MessageFeed from "./chat/MessageFeed.jsx";
import Composer     from "./chat/Composer.jsx";
import MessageCard  from "./chat/MessageCard.jsx";
import FormRenderer from "./FormRenderer.jsx";

import { useSetting } from "../core";
import { useSignalEffect } from '@preact/signals-react';
import { resolveSelector } from '../utils/selector.js';

import { chatHandlers } from "../hooks";
import { useEffect, useRef } from "react";


// Shared chat styles (avatars, bubbles, etc.)
import "./chat.css";

// Reuse the existing table toolbar for chat when descriptor provided
import TableToolbar from "./table/basic/Toolbar.jsx";
import AttachmentDialog from './chat/AttachmentDialog.jsx';
import useUpload, { UploadStatus } from '../hooks/useUpload.js';


// ---------------------------------------------------------------------------
// 💬 Chat – high-level wrapper that connects Forge runtime signals with the
//           presentational chat sub-components (MessageFeed & Composer).
// ---------------------------------------------------------------------------

export const defaultClassifier = (msg) =>
    msg?.elicitation?.requestedSchema ? 'form' : 'bubble';

// Our default bubble renderer simply delegates to the existing MessageCard.
function BubbleRenderer({ message, context }) {
    return <MessageCard msg={message} context={context} />;
}

export const defaultRenderers = {
    bubble: BubbleRenderer,
    form:   FormRenderer,
};


function defaultNormalizeMessages(rawMessages= []) {
    return rawMessages.map((m) => ({...m}));
}

export default function Chat({
    context,
    container = {},

    /* optional React node (or function returning node) rendered as toolbar */
    toolbar = null,

    /* height of Chat component – CSS string (e.g. "60vh" or "50%") or fraction 0–1 */
    height,

    /* Force visibility of the terminate button (overrides metadata/loading) */
    showAbort: showAbortProp,

    classifyMessage: classifyMessageProp,
    renderers: renderersProp,
    fallback: fallbackProp,
    avatarIcons: avatarIconsProp,

    /*
     * Controls visibility of the prompt composer (user input area).
     * When undefined, falls back to container.chat.showInput or defaults to true.
     */
    showInput: showInputProp,
}) {
    // ---------------------------------------------------------------------
    // 📡  Resolve Forge runtime context
    // ---------------------------------------------------------------------
    if (!context) {
        throw new Error("Chat component requires a context provided by Forge's runtime");
    }

    const { handlers } = context;

    // chat config from container metadata
    const chatCfg = container?.chat || {};

    // Determine effective toolbar / height (prop overrides metadata)
    const effectiveToolbar = toolbar !== null ? toolbar : chatCfg.toolbar;
    const effectiveHeight  = height !== undefined ? height : chatCfg.height;

    // Determine whether the composer (user input) should be rendered.
    const effectiveShowInput = showInputProp !== undefined ? showInputProp :
        (chatCfg.showInput !== undefined ? chatCfg.showInput : true);

    // Resolve classifier / renderer strategy – props > service > defaults
    const chatService = context?.handlers?.chat || {};


    const classifyMessage = classifyMessageProp || chatService.classifyMessage || defaultClassifier;
    const renderers = renderersProp || chatService.renderers || defaultRenderers;
    const fallback = fallbackProp || chatService.fallback || renderers?.bubble || defaultRenderers.bubble;

    // -----------------------------------------------------------------
    // 🎭  Avatar icon mapping resolution hierarchy
    //      1. Prop  (highest priority)
    //      2. Container metadata (YAML)  -> chatCfg.avatarIcons / avatarIconsFn
    //      3. Context service  (global defaults)
    // -----------------------------------------------------------------

    let metaAvatarIcons = undefined;
    if (chatCfg.avatarIcons !== undefined) {
        metaAvatarIcons = chatCfg.avatarIcons;
    } else if (chatCfg.avatarIconsFn !== undefined) {
        if (typeof chatCfg.avatarIconsFn === 'function') {
            metaAvatarIcons = chatCfg.avatarIconsFn;
        } else if (typeof chatCfg.avatarIconsFn === 'string') {
            try {
                /* eslint-disable no-new-func */
                metaAvatarIcons = new Function('msg', `return (${chatCfg.avatarIconsFn})(msg);`);
                /* eslint-enable no-new-func */
            } catch (e) {
                console.error('Failed to compile avatarIconsFn:', e);
            }
        }
    }

    const avatarIcons =
        avatarIconsProp !== undefined ? avatarIconsProp :
        metaAvatarIcons  !== undefined ? metaAvatarIcons  :
        chatService.avatarIcons;

    const resolveAvatarIcon = useCallback((msg) => {
        if (msg.iconName) return msg.iconName;
        if (typeof avatarIcons === 'function') return avatarIcons(msg);
        if (avatarIcons && typeof avatarIcons === 'object') {
            return avatarIcons[msg.role];
        }
        return undefined; // Let MessageCard fallback
    }, [avatarIcons]);

    // use unified hook for reactive data
    const { collection: rawMessages, loading, error } = useDataSourceState(context);

    // ---------------------------------------------------------------------
    // 🛑  Local component state reflecting incoming signals
    // ---------------------------------------------------------------------
    const [messages, setMessages] = useState([]);
    const [attachOpen, setAttachOpen] = useState(false);
    const [pendingAttachments, setPendingAttachments] = useState([]);
    const batchIdsRef = useRef(new Set());
    const [abortVisible, setAbortVisible] = useState(false);


    const normalizeMessages = chatService.normalizeMessages || defaultNormalizeMessages
    
    useEffect(() => {
        const norm = normalizeMessages(rawMessages);
        setMessages(norm);
    }, [rawMessages]);


    // ---------------------------------------------------------------------
    // 📤  Submit / Upload handlers delegated to Composer
    // ---------------------------------------------------------------------

    // Resolve any container-level event handlers declared in metadata
    const events = chatHandlers(context, container);

    // Resolve upload config from container metadata if provided
    const uploadCfg = chatCfg.upload || {};
    const uploadField = chatCfg.uploadField || 'upload';
    const uploader = useUpload(uploadCfg);
    const announcedDone = useRef(new Set());

    // ---------------------------------------------------------------------
    // 🔎  Compute abort visibility via abortVisible { selector, when }
    //      Precedence (highest → lowest): prop > abortVisible > showAbort > loading
    // ---------------------------------------------------------------------
    const computeAbortVisible = useCallback(() => {
        const spec = chatCfg?.abortVisible;
        if (!spec || !spec.selector) return false;
        try {
            const dsCtx = spec.dataSourceRef ? context.Context(spec.dataSourceRef) : context;
            const formObj = dsCtx?.signals?.form?.value;
            const val = resolveSelector(formObj, spec.selector);
            const when = spec.when;
            if (when === undefined || when === null) {
                const out = !!val;
                try { console.debug('[forge][chat] abortVisible selector', {dataSourceRef: spec.dataSourceRef, selector: spec.selector, val, out}); } catch(_) {}
                return out;
            }
            if (Array.isArray(when)) {
                const out = when.some((w) => w === val);
                try { console.debug('[forge][chat] abortVisible selector(any)', {when, val, out}); } catch(_) {}
                return out;
            }
            const out = (val === when);
            try { console.debug('[forge][chat] abortVisible selector(eq)', {when, val, out}); } catch(_) {}
            return out;
        } catch (_) {
            return false;
        }
    }, [context, chatCfg?.abortVisible?.dataSourceRef, chatCfg?.abortVisible?.selector, JSON.stringify(chatCfg?.abortVisible?.when || null)]);

    // Subscribe to form changes so visibility updates with polling/async state
    useSignalEffect(() => {
        const spec = chatCfg?.abortVisible;
        const dsCtx = spec?.dataSourceRef ? context.Context(spec.dataSourceRef) : context;
        // Touch the correct form signal to subscribe
        const _ = dsCtx?.signals?.form?.value;
        setAbortVisible(computeAbortVisible());
    });

    // ---------------------------------------------------------------------
    // 🛑  Abort handler – invoked when the user clicks the "Abort" button in
    //      the Composer (if rendered). Delegates to configured event handler
    //      chain when provided.
    // ---------------------------------------------------------------------

    const handleAbort = () => {
        try { console.debug('[forge][chat] abort click'); } catch(_) {}
        if (events.onAbort?.isDefined?.()) {
            try { console.debug('[forge][chat] onAbort handler:', events.onAbort.handlerName?.()); } catch(_) {}
            events.onAbort.execute({ context });
        } else {
            try { console.warn('[forge][chat] onAbort not defined in container.on'); } catch(_) {}
        }
    };

    const handleSubmit = ({ content, toolNames = [] }) => {
        const userMessage = {
            role: "user",
            content,
            toolNames,
            createdAt: new Date().toISOString(),
            attachments: pendingAttachments && pendingAttachments.length ? pendingAttachments : undefined,
        };

        // Immediately push the message to the DataSource (if available)
        handlers?.dataSource?.setFormData?.(userMessage);

        // Execute custom event callback defined in configuration (if any)
        if (events.onSubmit?.isDefined?.()) {
            events.onSubmit.execute({ message: userMessage, context });
        }

        // Clear pending attachments after sending and reset form field
        if (pendingAttachments.length) {
            setPendingAttachments([]);
            try { handlers?.dataSource?.setFormField?.({ item: { id: uploadField, bindingPath: uploadField }, value: [] }); } catch (_) {}
        }
    };

    const startUploads = (files) => {
        if (!files || files.length === 0) return;
        const ids = uploader.start(files, {});
        if (Array.isArray(ids)) {
            ids.forEach(id => batchIdsRef.current.add(id));
        }
    };

    // When uploads complete, collect attachments for the next user prompt (no auto message)
    useEffect(() => {
        const newlyDone = uploader.items.filter(u => u.status === UploadStatus.DONE && !announcedDone.current.has(u.id));
        if (newlyDone.length === 0) return;

        newlyDone.forEach(u => announcedDone.current.add(u.id));

        const newAttachments = newlyDone.map(u => {
            const resp = u.response;
            // Try to extract uri/url from server response; fallback to object URL
            let url = resp?.uri || resp?.url || (resp?.item ? resp.item.uri : null);
            if (!url) {
                try { url = URL.createObjectURL(u.file); } catch (_) {}
            }
            return {
                name: u.name,
                url,
                size: u.size,
                mediaType: u.type,
            };
        });
        if (newAttachments.length > 0) {
            setPendingAttachments(prev => {
                const next = [...prev, ...newAttachments];
                try {
                    handlers?.dataSource?.setFormField?.({ item: { id: uploadField, bindingPath: uploadField }, value: next });
                } catch (_) {}
                return next;
            });
        }
    }, [uploader.items]);

    // Auto-close attachment dialog when current batch completes
    useEffect(() => {
        if (!attachOpen) return;
        const ids = batchIdsRef.current;
        if (ids.size === 0) return;
        const statusById = new Map(uploader.items.map(u => [u.id, u.status]));
        let allDone = true;
        ids.forEach(id => {
            const st = statusById.get(id);
            if (st !== UploadStatus.DONE && st !== UploadStatus.ERROR && st !== UploadStatus.ABORTED) {
                allDone = false;
            }
        });
        if (allDone) {
            setAttachOpen(false);
            batchIdsRef.current = new Set();
        }
    }, [attachOpen, uploader.items]);

    // ---------------------------------------------------------------------
    // 🖼️  Render
    // ---------------------------------------------------------------------

    const heightStyle = effectiveHeight !== undefined ?
        { height: typeof effectiveHeight === 'number' ? `${effectiveHeight * 100}%` : String(effectiveHeight) } : {};

    // Helper to render toolbar depending on kind
    const renderToolbar = () => {
        if (!effectiveToolbar) return null;

        if (React.isValidElement(effectiveToolbar)) {
            return effectiveToolbar;
        }

        if (typeof effectiveToolbar === 'function') {
            return effectiveToolbar();
        }

        // Descriptor object from YAML (expects { items:[...] })
        if (typeof effectiveToolbar === 'object' && Array.isArray(effectiveToolbar.items)) {
            let toolbarContext = context
            if(effectiveToolbar.dataSourceRef) {
                toolbarContext = context.Context(effectiveToolbar.dataSourceRef)
            }
            return (
                <TableToolbar context={toolbarContext} toolbarItems={effectiveToolbar.items} />
            );
        }

        // Fallback: render nothing
        return null;
    };

    // Resolve final showAbort with precedence
    const effectiveShowAbort = (showAbortProp !== undefined)
        ? showAbortProp
        : (chatCfg.abortVisible ? abortVisible : (chatCfg.showAbort !== undefined ? chatCfg.showAbort : !!loading));

    return (
        <div
            className="w-full px-4 pt-4 gap-3"
            style={{
                ...heightStyle,
                display: 'grid',
                gridTemplateRows: 'auto 1fr auto',
            }}
        >

            {/* Optional toolbar */}
            {effectiveToolbar && (
                <div className="flex-none mb-1">
                    {renderToolbar()}
                </div>
            )}
            {/* Error banner */}
            {(() => {
                if (!error) return null;
                try {
                    const errText = String(error?.message || error);
                    // Extra debug to troubleshoot Error objects reaching render
                    // eslint-disable-next-line no-console
                    return <div className="text-red-500 text-sm py-1">{errText}</div>;
                } catch (e) {
                    return <div className="text-red-500 text-sm py-1">An error occurred</div>;
                }
            })()}

            {/* Message list */}
            <MessageFeed
                messages={messages}
                batchSize={chatCfg.batchSize || 50}
                context={context}
                classifyMessage={classifyMessage}
                renderers={renderers}
                fallback={fallback}
                resolveIcon={resolveAvatarIcon}
            />

            {/* Prompt composer */}
            {effectiveShowInput && (
                <Composer
                    showUpload={chatCfg.showUpload}
                    showSettings={!!chatCfg.showSettings}
                    showMic={!!chatCfg.showMic}
                    uploadTooltip={chatCfg?.tooltips?.upload}
                    settingsTooltip={chatCfg?.tooltips?.settings}
                    micTooltip={chatCfg?.tooltips?.mic}
                    sendTooltip={chatCfg?.tooltips?.send}
                    abortTooltip={chatCfg?.tooltips?.abort}
                    onSubmit={handleSubmit}
                    onOpenAttach={() => {
                        // Clear previous upload state so dialog starts fresh
                        try { uploader.reset(); } catch (_) {}
                        announcedDone.current = new Set();
                        batchIdsRef.current = new Set();
                        setAttachOpen(true);
                    }}
                    onOpenSettings={() => {
                        if (events.onSettings?.isDefined?.()) {
                            events.onSettings.execute({ context });
                        }
                    }}
                    onToggleMic={(active) => {
                        if (events.onMicToggle?.isDefined?.()) {
                            events.onMicToggle.execute({ context, active });
                        }
                    }}
                    onAbort={handleAbort}
                    showAbort={effectiveShowAbort}
                    disabled={loading}
                    attachments={pendingAttachments}
                    onRemoveAttachment={(idx) => setPendingAttachments(prev => {
                        const next = prev.filter((_, i) => i !== idx);
                        try { handlers?.dataSource?.setFormField?.({ item: { id: uploadField, bindingPath: uploadField }, value: next }); } catch (_) {}
                        return next;
                    })}
                />
            )}

            {/* Attachment dialog */}
            <AttachmentDialog
                isOpen={attachOpen}
                onClose={() => setAttachOpen(false)}
                onSelect={(files) => { startUploads(files); }}
                uploads={uploader.items}
            />

            {/* No external progress panel; attachments are shown in-input */}
        </div>
    );
}
