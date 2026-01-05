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

function hasActiveSteps(steps = []) {
    const list = Array.isArray(steps) ? steps : [];
    return list.some((s) => {
        const status = String(s?.status || s?.Status || '').toLowerCase();
        return status === 'in_progress' || status === 'running' || status === 'processing' || status === 'pending';
    });
}

function hasActiveExecutions(messages = []) {
    const list = Array.isArray(messages) ? messages : [];
    return list.some((m) => {
        const executions = Array.isArray(m?.executions) ? m.executions : [];
        return executions.some((ex) => hasActiveSteps(ex?.steps || []));
    });
}

function lastIndexByRole(messages = [], role) {
    const list = Array.isArray(messages) ? messages : [];
    const target = String(role || '').toLowerCase();
    for (let i = list.length - 1; i >= 0; i--) {
        const r = String(list[i]?.role || list[i]?.Role || '').toLowerCase();
        if (r === target) return i;
    }
    return -1;
}

function formatTokensCompact(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return '';
    if (n < 1000) return String(Math.round(n));
    const k = n / 1000;
    const roundedTenth = Math.round(k * 10) / 10;
    const text = (roundedTenth % 1 === 0) ? String(Math.trunc(roundedTenth)) : String(roundedTenth);
    return `${text}k`;
}

function formatCostCompact(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return '';
    return `$${n.toFixed(2)}`;
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
    const [metaSnapshot, setMetaSnapshot] = useState({});
    const [conversationSnapshot, setConversationSnapshot] = useState({});
    const [usageSnapshot, setUsageSnapshot] = useState({});


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
                return out;
            }
            if (Array.isArray(when)) {
                const out = when.some((w) => w === val);
                return out;
            }
            const out = (val === when);
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

    // Track conversation-level state (running/queued) for integrated queue UX.
    useSignalEffect(() => {
        try {
            const convCtx = context.Context('conversations');
            const formValue = convCtx?.signals?.form?.value;
            setConversationSnapshot(formValue || {});
        } catch (_) {
            setConversationSnapshot({});
        }
    });

    // Track usage data (tokens/cost) for compact display in the composer.
    useSignalEffect(() => {
        try {
            const usageCtx = context.Context('usage');
            const formValue = usageCtx?.signals?.form?.value;
            setUsageSnapshot(formValue || {});
        } catch (_) {
            setUsageSnapshot({});
        }
    });

    // ---------------------------------------------------------------------
    // 🎛️  Command-center composer state (agent/model/tools/reasoning)
    // ---------------------------------------------------------------------

    const commandCenterCfg = chatCfg?.commandCenter;
    const commandCenterEnabled = !!commandCenterCfg;
    const metaCtx = commandCenterEnabled
        ? context.Context((typeof commandCenterCfg === 'object' && commandCenterCfg.dataSourceRef) ? commandCenterCfg.dataSourceRef : 'meta')
        : null;

    useSignalEffect(() => {
        if (!metaCtx) return;
        const formValue = metaCtx?.signals?.form?.value;
        setMetaSnapshot(formValue || {});
    });

    const metaDS = metaCtx?.handlers?.dataSource;

    const normalizeString = (value) => String(value || '').trim();
    const ensureStringArray = (value) => {
        if (Array.isArray(value)) return value.map(v => String(v)).filter(Boolean);
        if (value === undefined || value === null || value === '') return [];
        return [String(value)];
    };

    const applyAgentSelection = (agentID) => {
        if (!metaDS) return;
        const key = normalizeString(agentID);
        if (!key) return;
        const form = metaDS.peekFormData?.() || metaSnapshot || {};
        const agentInfo = form?.agentInfo || {};
        const info = agentInfo?.[key] || {};

        try { metaDS.setFormField?.({ item: { id: 'agent' }, value: key }); } catch (_) {}

        const selectedTools = ensureStringArray(info?.tools);
        const agentValues = { ...info, tool: selectedTools };
        delete agentValues.tools;

        try {
            const prev = metaDS.peekFormData?.() || {};
            metaDS.setFormData?.({ values: { ...prev, ...agentValues } });
        } catch (_) {}
    };

    const setMetaField = (id, value) => {
        if (!metaDS || !id) return;
        try { metaDS.setFormField?.({ item: { id }, value }); } catch (_) {}
    };

    const handleAgentChange = (agentID) => {
        if (events?.onAgentSelect?.isDefined?.()) {
            events.onAgentSelect.execute({ context: metaCtx || context, selected: agentID, value: agentID });
            return;
        }
        applyAgentSelection(agentID);
    };

    const handleModelChange = (modelID) => {
        if (events?.onModelSelect?.isDefined?.()) {
            events.onModelSelect.execute({ context: metaCtx || context, selected: modelID, value: modelID });
            return;
        }
        setMetaField('model', normalizeString(modelID));
    };

    const handleReasoningChange = (effort) => {
        if (events?.onReasoningSelect?.isDefined?.()) {
            events.onReasoningSelect.execute({ context: metaCtx || context, selected: effort, value: effort });
            return;
        }
        setMetaField('reasoningEffort', normalizeString(effort));
    };

    const handleToolsChange = (toolNames) => {
        if (events?.onToolsChange?.isDefined?.()) {
            events.onToolsChange.execute({ context: metaCtx || context, selected: toolNames, value: toolNames });
            return;
        }
        setMetaField('tool', ensureStringArray(toolNames));
    };

    const defaultAgentTools = (agentID) => {
        const id = normalizeString(agentID);
        const info = metaSnapshot?.agentInfo?.[id] || {};
        return ensureStringArray(info?.tools);
    };

    const defaultAgentModel = (agentID) => {
        const id = normalizeString(agentID);
        const info = metaSnapshot?.agentInfo?.[id] || {};
        return normalizeString(info?.model);
    };

    const commandCenterDefaults = metaSnapshot?.defaults || {};
    const currentAgent = normalizeString(metaSnapshot?.agent);
    const currentModel = normalizeString(metaSnapshot?.model);
    const currentReasoning = normalizeString(metaSnapshot?.reasoningEffort);
    const currentTools = ensureStringArray(metaSnapshot?.tool);

    const conversationID = normalizeString(conversationSnapshot?.id);
    const isConversationRunning = !!conversationSnapshot?.running;
    const queuedTurns = Array.isArray(conversationSnapshot?.queuedTurns) ? conversationSnapshot.queuedTurns : [];
    const queuedCount = (() => {
        const v = conversationSnapshot?.queuedCount;
        if (typeof v === 'number' && !Number.isNaN(v)) return v;
        const n = Number(v);
        if (!Number.isNaN(n) && Number.isFinite(n)) return n;
        return queuedTurns.length;
    })();

    const usageSummary = (() => {
        const costText = formatCostCompact(usageSnapshot?.cost ?? usageSnapshot?.Cost);
        const tokensText = formatTokensCompact(usageSnapshot?.totalTokens ?? usageSnapshot?.TotalTokens ?? usageSnapshot?.total);
        const parts = [];
        if (costText) parts.push(`Cost ${costText}`);
        if (tokensText) parts.push(`Tokens ${tokensText}`);
        return parts.join(' • ');
    })();

    const usageTooltip = (() => {
        const tokensWithCache = normalizeString(usageSnapshot?.tokensWithCacheText);
        const costText = normalizeString(usageSnapshot?.costText);
        const pieces = [];
        if (costText) pieces.push(`Cost: ${costText}`);
        if (tokensWithCache) pieces.push(`Tokens: ${tokensWithCache}`);
        return pieces.join('\n');
    })();

    const toolsLabel = () => {
        if (!currentTools.length) return '';
        if (currentTools.length <= 2) return currentTools.join(', ');
        return `${currentTools.length} tools`;
    };

    // Command-center toolbar already exposes agent/model/tools/reasoning selectors; keep composer chips
    // reserved for bundles + attachments to avoid duplicating controls.
    const activeChips = [];

    const handleChipClear = (chip) => {
        const id = normalizeString(chip?.id);
        if (!id) return;
        const defAgent = normalizeString(commandCenterDefaults?.agent) || currentAgent;
        const defModel = normalizeString(commandCenterDefaults?.model) || currentModel;

        if (events?.onClearOverride?.isDefined?.()) {
            events.onClearOverride.execute({ context: metaCtx || context, chip: id });
            return true;
        }

        if (id === 'agent') {
            handleAgentChange(defAgent);
            return true;
        }
        if (id === 'model') {
            const fallback = defaultAgentModel(currentAgent) || defModel;
            handleModelChange(fallback);
            return true;
        }
        if (id === 'tools') {
            handleToolsChange(defaultAgentTools(currentAgent));
            return true;
        }
        if (id === 'reasoningEffort') {
            handleReasoningChange('');
            return true;
        }
        return false;
    };

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

    // Backend `Post()` enqueues turns; treat "processing" as: the latest user message hasn't
    // received an assistant response, or any execution steps are still active.
    // Ignore stale `conversations.running` when we have no evidence of work in-flight.
    const isProcessing = (() => {
        const activeExec = hasActiveExecutions(messages);
        const lastUser = lastIndexByRole(messages, 'user');
        const lastAssistant = lastIndexByRole(messages, 'assistant');
        const hasUnansweredUser = lastUser !== -1 && lastUser > lastAssistant;
        if (activeExec || hasUnansweredUser) return true;
        if (!isConversationRunning) return false;
        // If we have evidence of a completed last turn, ignore stale running=true.
        if (lastUser !== -1 && lastAssistant !== -1 && lastAssistant > lastUser) return false;
        return true;
    })();

    // Abort should only be visible while the current turn is processing.
    // The backend `conversations.running` signal can be stale, so do not rely on it for visibility.
    const effectiveShowAbort = (showAbortProp !== undefined)
        ? showAbortProp
        : (chatCfg.showAbort !== undefined ? chatCfg.showAbort : true);

    // Abort/Queue should only be visible while the current turn is being processed.
    const effectiveShowAbortWhileRunning = effectiveShowAbort && isProcessing;

    const composerDisabled = (chatCfg?.disableInputOnLoading)
        ? (loading && !isProcessing)
        : false;

    const handleQueueCancel = (turn) => {
        const turnID = normalizeString(turn?.id);
        if (!turnID || !conversationID) return;
        if (typeof chatService?.cancelQueuedTurnByID === 'function') {
            chatService.cancelQueuedTurnByID({ context, conversationID, turnID });
        }
    };

    const handleQueueMove = (turn, direction) => {
        const turnID = normalizeString(turn?.id);
        const dir = normalizeString(direction).toLowerCase();
        if (!turnID || !conversationID || (dir !== 'up' && dir !== 'down')) return;
        if (typeof chatService?.moveQueuedTurn === 'function') {
            chatService.moveQueuedTurn({ context, conversationID, turnID, direction: dir });
        }
    };

    return (
        <div
            className="w-full px-4 pt-4 gap-3"
            data-testid="chat-root"
            style={{
                height: '100%',
                ...heightStyle,
                display: 'grid',
                gridTemplateRows: 'auto minmax(0, 1fr) auto',
                minHeight: 0,
                minWidth: 0,
                overflow: 'hidden',
            }}
        >

            {/* Optional toolbar */}
            {effectiveToolbar && (
                <div className="flex-none mb-1" data-testid="chat-toolbar">
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
                    return <div className="text-red-500 text-sm py-1" data-testid="chat-error">{errText}</div>;
                } catch (e) {
                    return <div className="text-red-500 text-sm py-1" data-testid="chat-error">An error occurred</div>;
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
                    showTools={!!chatCfg.showTools}
                    commandCenter={commandCenterEnabled}
                    submitMode={'send'}
                    submitLabel={'Send'}
                    queueCount={queuedCount}
                    queuedTurns={queuedTurns}
                    usageSummary={usageSummary}
                    usageTooltip={usageTooltip}
                    onQueueCancel={handleQueueCancel}
                    onQueueMove={handleQueueMove}
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
                    onCaptureAudio={(file) => {
                        if (!file) return;
                        startUploads([file]);
                    }}
                    onAbort={handleAbort}
                    showAbort={effectiveShowAbortWhileRunning}
                    disabled={composerDisabled}
                    attachments={pendingAttachments}
                    onRemoveAttachment={(idx) => setPendingAttachments(prev => {
                        const next = prev.filter((_, i) => i !== idx);
                        try { handlers?.dataSource?.setFormField?.({ item: { id: uploadField, bindingPath: uploadField }, value: next }); } catch (_) {}
                        return next;
                    })}
                    toolOptions={metaSnapshot?.toolOptions}
                    selectedTools={currentTools}
                    onToolsChange={handleToolsChange}
                    agentOptions={metaSnapshot?.agentOptions}
                    agentValue={currentAgent}
                    onAgentChange={handleAgentChange}
                    modelOptions={metaSnapshot?.modelOptions}
                    modelValue={currentModel}
                    onModelChange={handleModelChange}
                    reasoningOptions={[
                        { value: 'low', label: 'Low' },
                        { value: 'medium', label: 'Medium' },
                        { value: 'high', label: 'High' },
                    ]}
                    reasoningValue={currentReasoning}
                    onReasoningChange={handleReasoningChange}
                    activeChips={activeChips}
                    onChipClear={(chip) => handleChipClear(chip)}
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
