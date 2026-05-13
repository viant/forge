import React, { useState, useCallback } from "react";
import { useDataSourceState } from "../hooks/useDataSourceState.js";


// Re-exported building blocks living under src/components/chat
import MessageFeed from "./chat/MessageFeed.jsx";
import Composer     from "./chat/Composer.jsx";
import MessageCard  from "./chat/MessageCard.jsx";
import FormRenderer from "./FormRenderer.jsx";

import { useSetting } from "../core";
import { useSignalEffect } from '@preact/signals-react';

import { chatHandlers } from "../hooks";
import { useEffect, useRef } from "react";
import {
    BugBeetle,
    Flask,
    GameController,
    PencilSimple,
    RocketLaunch,
    ShieldWarning,
    TreeStructure
} from '@phosphor-icons/react';


// Shared chat styles (avatars, bubbles, etc.)
import "./chat.css";

import AttachmentDialog from './chat/AttachmentDialog.jsx';
import useUpload, { UploadStatus } from '../hooks/useUpload.js';
import {
    defaultNormalizeMessages,
    normalizeLegacyMessages,
    hasActiveExecutions,
    isTerminalTurnStatus,
    resolveLastTurnStatus,
    lastIndexByRole,
    shouldKeepLocalQueuedPreview,
} from './chatLegacyHelpers.js';
import {
    normalizeString,
    normalizeBool,
    ensureStringArray,
    defaultAgentTools,
    defaultAgentModel,
    resolveCurrentModel,
} from './chatCommandCenterHelpers.js';
import {
    applyAgentSelection,
    applyModelSelection,
    applyReasoningSelection,
    applyToolsSelection,
    applyAutoSelectToolsSelection,
} from './chatCommandCenterActions.js';
import {
    cancelQueuedTurn,
    moveQueuedTurn,
    editQueuedTurn,
    steerQueuedTurn,
} from './chatQueueActions.js';
import {
    computeSubmittingWhileProcessing,
    shouldHoldLegacySubmitLatch,
    shouldClearLegacyOptimisticRunning,
    makeLocalQueuedPreview,
} from './chatLegacySubmitState.js';
import useChatLegacyState from './useChatLegacyState.js';
import useChatLegacyLifecycle from './useChatLegacyLifecycle.js';
import { computeChatDerivedState } from './chatDerivedState.js';
import { computeAbortVisibility, renderChatToolbar } from './chatViewHelpers.js';
import {
    buildUsageSummary,
    buildUsageTooltip,
    buildToolsLabel,
    clearCommandCenterChip,
} from './chatCommandCenterViewState.js';


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

const STARTER_TASK_ICON_MAP = {
    'bug': BugBeetle,
    'flask': Flask,
    'gamepad': GameController,
    'pencil': PencilSimple,
    'rocket': RocketLaunch,
    'shield-warning': ShieldWarning,
    'tree-structure': TreeStructure,
};

function StarterTaskIcon({ icon }) {
    const Icon = STARTER_TASK_ICON_MAP[String(icon || '').trim().toLowerCase()] || PencilSimple;
    return <Icon size={20} weight="duotone" />;
}

function StarterTaskGrid({ tasks = [], onSelect }) {
    const list = Array.isArray(tasks) ? tasks.filter(Boolean) : [];
    if (list.length === 0) return null;
    return (
        <section className="chat-starter-tasks" data-testid="chat-starter-tasks">
            <div className="chat-starter-tasks-head">
                <h2 className="chat-starter-tasks-title">Start with a task</h2>
            </div>
            <div className="chat-starter-tasks-subtitle">Get started</div>
            <div className="chat-starter-tasks-grid">
                {list.map((task, index) => (
                    <button
                        key={String(task?.id || `starter-task-${index}`)}
                        type="button"
                        className="chat-starter-task-card"
                        data-testid={`chat-starter-task-${index}`}
                        onClick={() => onSelect?.(task)}
                    >
                        <span className="chat-starter-task-icon">
                            <StarterTaskIcon icon={task?.icon} />
                        </span>
                        <span className="chat-starter-task-title">{task?.title}</span>
                        {String(task?.description || '').trim() ? (
                            <span className="chat-starter-task-description">{task.description}</span>
                        ) : null}
                    </button>
                ))}
            </div>
        </section>
    );
}

function ExternalFeedBoundary({ renderFeed, conversationId, context }) {
    if (typeof renderFeed !== 'function') return null;
    return renderFeed({ conversationId, context });
}

function isChatDebugEnabled() {
    if (typeof window === 'undefined') return false;
    try {
        const raw = String(window.localStorage?.getItem('forge.chat.debugStream') || '').trim().toLowerCase();
        return ['1', 'true', 'on', 'yes'].includes(raw);
    } catch (_) {
        return false;
    }
}

function logFeedDebugEnabled() {
    return isChatDebugEnabled();
}

function hasActiveTurnLifecycle(context = null) {
    const chatState = context?.resources?.chat;
    return !!String(chatState?.runningTurnId || chatState?.activeStreamTurnId || '').trim();
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
    const renderFeed = context?.lookupHandler?.('chat.renderFeed');
    const usesExternalFeedState = typeof renderFeed === 'function';
    const usesLegacyFeedState = !usesExternalFeedState;
    useEffect(() => {
        if (!logFeedDebugEnabled()) return;
        try {
            console.log('[forge-chat:feed]', {
                hasLookupHandler: typeof context?.lookupHandler === 'function',
                renderFeedType: typeof renderFeed,
                chatServiceKeys: Object.keys(chatService || {}).sort(),
            });
        } catch (_) {}
    }, [context, renderFeed, chatService]);


    const classifyMessage = classifyMessageProp || chatService.classifyMessage || defaultClassifier;
    const renderers = renderersProp || chatService.renderers || defaultRenderers;
    const fallback = fallbackProp || chatService.fallback || renderers?.bubble || defaultRenderers.bubble;

    const abortVisibleSpec = chatCfg?.abortVisible;
    const abortDataSourceRef = abortVisibleSpec?.dataSourceRef || context?.identity?.dataSourceRef;
    const abortCtx = (typeof context?.useDsContext === 'function')
        ? context.useDsContext(abortDataSourceRef)
        : context.Context(abortDataSourceRef);
    const conversationsCtx = (typeof context?.useDsContext === 'function')
        ? context.useDsContext('conversations')
        : context.Context('conversations');
    const usageCtx = (typeof context?.useDsContext === 'function')
        ? context.useDsContext('usage')
        : context.Context('usage');

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
    const [attachOpen, setAttachOpen] = useState(false);
    const [pendingAttachments, setPendingAttachments] = useState([]);
    const batchIdsRef = useRef(new Set());
    const [abortVisible, setAbortVisible] = useState(false);
    const [metaSnapshot, setMetaSnapshot] = useState({});
    const [conversationSnapshot, setConversationSnapshot] = useState({});
    const [usageSnapshot, setUsageSnapshot] = useState({});
    const [composerDraft, setComposerDraft] = useState('');
    const normalizeMessages = chatService.normalizeMessages || defaultNormalizeMessages;
    const {
        messages,
        localQueuedTurns,
        setLocalQueuedTurns,
        optimisticRunning,
        setOptimisticRunning,
        submitLatchRef,
        submitLatchTimerRef,
        clearSubmitLatchTimer,
        resetSubmitLatch,
    } = useChatLegacyState({
        rawMessages,
        usesLegacyFeedState,
        normalizeMessages,
        normalizeLegacyMessages,
        debugEnabled: isChatDebugEnabled(),
    });


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
    const computeAbortVisible = useCallback(() => (
        computeAbortVisibility({ chatCfg, context })
    ), [chatCfg, context]);

    // Subscribe to form changes so visibility updates with polling/async state
    useSignalEffect(() => {
        // Touch the correct form signal to subscribe
        const _ = abortCtx?.signals?.form?.value;
        setAbortVisible(computeAbortVisible());
    }, [abortCtx, computeAbortVisible]);

    // Track conversation-level state (running/queued) for integrated queue UX.
    useSignalEffect(() => {
        try {
            const formValue = conversationsCtx?.signals?.form?.value;
            setConversationSnapshot(formValue || {});
        } catch (_) {
            setConversationSnapshot({});
        }
    }, [conversationsCtx]);

    useEffect(() => {
        const handleConversationActive = (event) => {
            const conversationId = String(event?.detail?.id || '').trim();
            if (!conversationId) {
                setComposerDraft('');
            }
        };
        if (typeof window !== 'undefined') {
            window.addEventListener('forge:conversation-active', handleConversationActive);
        }
        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener('forge:conversation-active', handleConversationActive);
            }
        };
    }, []);

    // Track usage data (tokens/cost) for compact display in the composer.
    useSignalEffect(() => {
        try {
            const formValue = usageCtx?.signals?.form?.value;
            setUsageSnapshot(formValue || {});
        } catch (_) {
            setUsageSnapshot({});
        }
    }, [usageCtx]);

    // ---------------------------------------------------------------------
    // 🎛️  Command-center composer state (agent/model/tools/reasoning)
    //      Prefer an external resolver when the caller wants to own these
    //      semantics in its own chat store/runtime path.
    // ---------------------------------------------------------------------

    const resolveComposerProps = context?.lookupHandler?.('chat.resolveComposerProps');
    const externalComposerProps = (typeof resolveComposerProps === 'function')
        ? (resolveComposerProps({ context, container, conversationsCtx }) || {})
        : null;
    const usesExternalComposerProps = !!externalComposerProps;
    const commandCenterCfg = chatCfg?.commandCenter;
    const commandCenterEnabled = !!(externalComposerProps?.commandCenter ?? commandCenterCfg);
    const commandCenterDataSourceRef = (typeof commandCenterCfg === 'object' && commandCenterCfg.dataSourceRef)
        ? commandCenterCfg.dataSourceRef
        : 'meta';
    const commandMetaCtx = (typeof context?.useDsContext === 'function')
        ? context.useDsContext(commandCenterDataSourceRef)
        : context.Context(commandCenterDataSourceRef);
    const metaCtx = commandCenterEnabled ? commandMetaCtx : null;

    useSignalEffect(() => {
        if (!metaCtx) return;
        const formValue = metaCtx?.signals?.form?.value;
        setMetaSnapshot(formValue || {});
    });

    const metaDS = metaCtx?.handlers?.dataSource;

    const internalHandleAgentChange = (agentID) => {
        if (events?.onAgentSelect?.isDefined?.()) {
            events.onAgentSelect.execute({ context: metaCtx || context, selected: agentID, value: agentID });
        }
        applyAgentSelection({ agentID, metaDS, metaSnapshot, context });
    };

    const internalHandleModelChange = (modelID) => {
        if (events?.onModelSelect?.isDefined?.()) {
            events.onModelSelect.execute({ context: metaCtx || context, selected: modelID, value: modelID });
            return;
        }
        applyModelSelection({ modelID, metaDS, context });
    };

    const internalHandleReasoningChange = (effort) => {
        if (events?.onReasoningSelect?.isDefined?.()) {
            events.onReasoningSelect.execute({ context: metaCtx || context, selected: effort, value: effort });
            return;
        }
        applyReasoningSelection({ effort, metaDS });
    };

    const internalHandleToolsChange = (toolNames) => {
        if (events?.onToolsChange?.isDefined?.()) {
            events.onToolsChange.execute({ context: metaCtx || context, selected: toolNames, value: toolNames });
            return;
        }
        applyToolsSelection({ toolNames, metaDS });
    };

    const internalHandleAutoSelectToolsChange = (enabled) => {
        applyAutoSelectToolsSelection({ enabled, metaDS, context });
    };

    const commandCenterDefaults = usesExternalComposerProps
        ? (externalComposerProps?.defaults || {})
        : (metaSnapshot?.defaults || {});
    const currentAgent = usesExternalComposerProps
        ? normalizeString(externalComposerProps?.agentValue)
        : normalizeString(metaSnapshot?.agent);
    const rawCurrentModel = usesExternalComposerProps
        ? normalizeString(externalComposerProps?.modelValue)
        : normalizeString(metaSnapshot?.model);
    const defaultModel = usesExternalComposerProps
        ? normalizeString(externalComposerProps?.defaultModel)
        : normalizeString(commandCenterDefaults?.model);
    const currentModel = usesExternalComposerProps
        ? normalizeString(externalComposerProps?.modelValue)
        : resolveCurrentModel(metaSnapshot);
    const currentReasoning = usesExternalComposerProps
        ? normalizeString(externalComposerProps?.reasoningValue)
        : normalizeString(metaSnapshot?.reasoningEffort);
    const currentTools = usesExternalComposerProps
        ? ensureStringArray(externalComposerProps?.selectedTools)
        : ensureStringArray(metaSnapshot?.tool);
    const currentAutoSelectTools = usesExternalComposerProps
        ? normalizeBool(externalComposerProps?.autoSelectTools)
        : ((metaSnapshot?.autoSelectTools !== undefined)
            ? normalizeBool(metaSnapshot?.autoSelectTools)
            : normalizeBool(commandCenterDefaults?.autoSelectTools));
    const starterTasks = usesExternalComposerProps
        ? (Array.isArray(externalComposerProps?.starterTasks) ? externalComposerProps.starterTasks : [])
        : (Array.isArray(metaSnapshot?.starterTasks) ? metaSnapshot.starterTasks : []);
    const composerAgentOptions = usesExternalComposerProps
        ? (externalComposerProps?.agentOptions || [])
        : metaSnapshot?.agentOptions;
    const composerModelOptions = usesExternalComposerProps
        ? (externalComposerProps?.modelOptions || [])
        : metaSnapshot?.modelOptions;
    const composerModelInfo = usesExternalComposerProps
        ? (externalComposerProps?.modelInfo || {})
        : metaSnapshot?.modelInfo;
    const composerReasoningOptions = usesExternalComposerProps
        ? (externalComposerProps?.reasoningOptions || [])
        : [
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
        ];
    const handleAgentChange = usesExternalComposerProps
        ? (externalComposerProps?.onAgentChange || (() => {}))
        : internalHandleAgentChange;
    const handleModelChange = usesExternalComposerProps
        ? (externalComposerProps?.onModelChange || (() => {}))
        : internalHandleModelChange;
    const handleReasoningChange = usesExternalComposerProps
        ? (externalComposerProps?.onReasoningChange || (() => {}))
        : internalHandleReasoningChange;
    const handleToolsChange = usesExternalComposerProps
        ? (externalComposerProps?.onToolsChange || (() => {}))
        : internalHandleToolsChange;
    const handleAutoSelectToolsChange = usesExternalComposerProps
        ? (externalComposerProps?.onAutoSelectToolsChange || (() => {}))
        : internalHandleAutoSelectToolsChange;

    const conversationID = normalizeString(conversationSnapshot?.id);
    const backendConversationRunning = !!conversationSnapshot?.running;
    const queuedTurns = Array.isArray(conversationSnapshot?.queuedTurns) ? conversationSnapshot.queuedTurns : [];
    const queuedCountValue = conversationSnapshot?.queuedCount;

    const usageSummary = buildUsageSummary(usageSnapshot);
    const usageTooltip = buildUsageTooltip(usageSnapshot);
    const legacyActiveExecutions = usesExternalFeedState ? false : hasActiveExecutions(messages);
    const legacyLastTurnStatus = usesExternalFeedState ? '' : resolveLastTurnStatus(messages);
    const {
        localOptimisticRunning,
        turnLifecycleRunning,
        isProcessing,
        showStarterTasks,
        effectiveShowAbortWhileRunning,
        effectiveQueuedTurns,
        queuedCount,
    } = computeChatDerivedState({
        usesExternalFeedState,
        usesLegacyFeedState,
        backendConversationRunning,
        hasActiveTurnLifecycle: hasActiveTurnLifecycle(context),
        optimisticRunning,
        messages,
        legacyActiveExecutions,
        legacyLastTurnStatus,
        lastUserIndex: lastIndexByRole(messages, 'user'),
        lastAssistantIndex: lastIndexByRole(messages, 'assistant'),
        isTerminalTurnStatus,
        starterTaskCount: starterTasks.length,
        conversationID,
        effectiveShowAbort: (showAbortProp !== undefined)
            ? showAbortProp
            : (chatCfg.showAbort !== undefined ? chatCfg.showAbort : true),
        abortVisible,
        queuedTurns,
        localQueuedTurns,
        queuedCountValue,
    });

    const toolsLabel = () => buildToolsLabel(currentTools);

    // Command-center toolbar already exposes agent/model/tools/reasoning selectors; keep composer chips
    // reserved for bundles + attachments to avoid duplicating controls.
    const activeChips = usesExternalComposerProps
        ? (Array.isArray(externalComposerProps?.activeChips) ? externalComposerProps.activeChips : [])
        : [];

    const handleChipClear = usesExternalComposerProps
        ? (externalComposerProps?.onChipClear || (() => false))
        : ((chip) => clearCommandCenterChip({
            chip,
            commandCenterDefaults,
            currentAgent,
            currentModel,
            metaSnapshot,
            events,
            metaCtx,
            context,
            handleAgentChange,
            handleModelChange,
            handleToolsChange,
            handleReasoningChange,
        }));

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
        const submitModel = (() => {
            if (usesExternalComposerProps) {
                return normalizeString(externalComposerProps?.submitModel)
                    || currentModel
                    || rawCurrentModel
                    || defaultModel;
            }
            const preferred = defaultAgentModel(metaSnapshot, currentAgent);
            if (preferred && (!currentModel || currentModel === defaultModel || currentModel === rawCurrentModel)) {
                return preferred;
            }
            return currentModel || preferred || rawCurrentModel || defaultModel;
        })();
        const userMessage = {
            role: "user",
            content,
            toolNames,
            createdAt: new Date().toISOString(),
            attachments: pendingAttachments && pendingAttachments.length ? pendingAttachments : undefined,
        };

        const serviceOwnsSubmit = !!events.onSubmit?.isDefined?.();
        // When the caller drives its own chat state (chatStore via onSubmit),
        // the four internal bookkeeping pieces below are redundant: the
        // caller's reducer handles identity + dedup + running + queued. Skip
        // them in that case and let the canonical chatStore stay authoritative.
        const externalStateOwns = usesExternalFeedState && serviceOwnsSubmit;

        const submittingWhileProcessing = computeSubmittingWhileProcessing({
            externalStateOwns,
            isProcessing,
            backendConversationRunning,
            localOptimisticRunning,
            submitLatch: submitLatchRef.current,
        });
        if (externalStateOwns) {
            // External store path: no optimisticRunning, no submitLatch, no
            // local queue, no dataSource write. Submit fires through the
            // caller's onSubmit handler below.
        } else if (!submittingWhileProcessing) {
            setOptimisticRunning(true);
            submitLatchRef.current = true;
            clearSubmitLatchTimer();
            submitLatchTimerRef.current = setTimeout(() => {
                if (!isProcessing && !backendConversationRunning) {
                    submitLatchRef.current = false;
                }
                submitLatchTimerRef.current = null;
            }, 2000);
            if (!serviceOwnsSubmit) {
                handlers?.dataSource?.setFormData?.(userMessage);
            }
        } else {
            setLocalQueuedTurns((current) => [
                ...current,
                makeLocalQueuedPreview(content, Date.now(), Math.random()),
            ]);
        }

        // Execute custom event callback defined in configuration (if any)
        if (events.onSubmit?.isDefined?.()) {
            events.onSubmit.execute({
                message: userMessage,
                context,
                agent: currentAgent,
                model: submitModel,
                reasoningEffort: currentReasoning,
                tools: currentTools,
            });
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

    const debugLastTurnStatus = legacyLastTurnStatus;
    const debugHasActiveExecutions = legacyActiveExecutions;

    useChatLegacyLifecycle({
        usesLegacyFeedState,
        localQueuedTurns,
        queuedTurns,
        messages,
        runningTurnId: context?.resources?.chat?.runningTurnId,
        backendConversationRunning,
        localOptimisticRunning,
        turnLifecycleRunning,
        legacyActiveExecutions,
        legacyLastTurnStatus,
        isProcessing,
        setLocalQueuedTurns,
        setOptimisticRunning,
        resetSubmitLatch,
        submitLatchRef,
        clearSubmitLatchTimer,
        shouldKeepLocalQueuedPreview,
    });

    useEffect(() => {
        if (!isChatDebugEnabled()) return;
        try {
            console.log('[forge-chat:processing]', {
                conversationID,
                messageCount: Array.isArray(messages) ? messages.length : 0,
                turnLifecycleRunning,
                abortVisible,
                backendConversationRunning,
                optimisticRunning: localOptimisticRunning,
                isProcessing,
                effectiveShowAbortWhileRunning,
                lastTurnStatus: debugLastTurnStatus,
                hasActiveExecutions: debugHasActiveExecutions,
                messageKinds: (Array.isArray(messages) ? messages : []).map((message) => ({
                    id: String(message?.id || '').trim(),
                    type: String(message?._type || message?.role || '').trim(),
                    topLevelStatus: String(message?.status || message?.turnStatus || '').trim(),
                    iterationStatus: String(message?._iterationData?.status || '').trim(),
                    executionGroupCount: Array.isArray(message?.executionGroups) ? message.executionGroups.length : 0,
                    iterationExecutionGroupCount: Array.isArray(message?._iterationData?.executionGroups) ? message._iterationData.executionGroups.length : 0,
                })),
            });
        } catch (_) {}
    }, [conversationID, messages, turnLifecycleRunning, abortVisible, backendConversationRunning, localOptimisticRunning, isProcessing, effectiveShowAbortWhileRunning, debugLastTurnStatus, debugHasActiveExecutions]);

    const composerDisabled = (chatCfg?.disableInputOnLoading)
        ? (loading && !isProcessing)
        : false;

    const handleQueueCancel = (turn) => {
        cancelQueuedTurn({ chatService, context, conversationID, turn });
    };

    const handleQueueMove = (turn, direction) => {
        moveQueuedTurn({ chatService, context, conversationID, turn, direction });
    };

    const handleQueueEdit = (turn) => {
        editQueuedTurn({ chatService, context, conversationID, turn });
    };

    const handleQueueSteer = (turn) => {
        steerQueuedTurn({
            chatService,
            context,
            conversationID,
            turn,
            runningTurnId: context?.resources?.chat?.runningTurnId,
        });
    };

    return (
        <div
            className="w-full px-4 pt-4 gap-3"
            data-testid="chat-root"
            style={{
                height: '100%',
                ...heightStyle,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                minWidth: 0,
                overflow: 'hidden',
            }}
        >

            {/* Optional toolbar */}
            {effectiveToolbar && (
                <div className="flex-none mb-1" data-testid="chat-toolbar">
                    {renderChatToolbar({ effectiveToolbar, context })}
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

            <div
                className="chat-feed-stage"
                data-testid="chat-feed-stage"
                style={{
                    flexGrow: 1,
                    flexShrink: 1,
                    flexBasis: '0px',
                    minHeight: 0,
                    minWidth: 0,
                    overflow: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                {showStarterTasks ? (
                    <div className="chat-starter-stage" data-testid="chat-starter-stage">
                        <StarterTaskGrid
                            tasks={starterTasks}
                            onSelect={(task) => {
                                const prompt = String(task?.prompt || '').trim();
                                if (!prompt) return;
                                setComposerDraft(prompt);
                            }}
                        />
                    </div>
                ) : usesExternalFeedState ? (
                    <ExternalFeedBoundary
                        renderFeed={renderFeed}
                        conversationId={conversationID}
                        context={context}
                    />
                ) : (
                    <MessageFeed
                        messages={messages}
                        batchSize={chatCfg.batchSize || 50}
                        context={context}
                        classifyMessage={classifyMessage}
                        renderers={renderers}
                        fallback={fallback}
                        resolveIcon={resolveAvatarIcon}
                    />
                )}
            </div>

            {/* Prompt composer */}
            {effectiveShowInput && (
                <Composer
                    draftValue={composerDraft}
                    onDraftChange={setComposerDraft}
                    showUpload={chatCfg.showUpload}
                    showSettings={!!chatCfg.showSettings}
                    showMic={!!chatCfg.showMic}
                    showTools={!!chatCfg.showTools}
                    commandCenter={commandCenterEnabled}
                    submitMode={'send'}
                    submitLabel={'Send'}
                    queueCount={effectiveQueuedTurns.length || queuedCount}
                    queuedTurns={effectiveQueuedTurns}
                    usageSummary={usageSummary}
                    usageTooltip={usageTooltip}
                    queueRunning={turnLifecycleRunning}
                    onQueueCancel={handleQueueCancel}
                    onQueueMove={handleQueueMove}
                    onQueueEdit={handleQueueEdit}
                    onQueueSteer={handleQueueSteer}
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
                    getMessageHistory={context?.handlers?.chat?.getComposerHistory}
                    onRemoveAttachment={(idx) => setPendingAttachments(prev => {
                        const next = prev.filter((_, i) => i !== idx);
                        try { handlers?.dataSource?.setFormField?.({ item: { id: uploadField, bindingPath: uploadField }, value: next }); } catch (_) {}
                        return next;
                    })}
                    toolOptions={metaSnapshot?.toolOptions}
                    selectedTools={currentTools}
                    onToolsChange={handleToolsChange}
                    autoSelectTools={currentAutoSelectTools}
                    onAutoSelectToolsChange={handleAutoSelectToolsChange}
                    agentOptions={composerAgentOptions}
                    agentValue={currentAgent}
                    onAgentChange={handleAgentChange}
                    modelOptions={composerModelOptions}
                    modelInfo={composerModelInfo}
                    modelValue={currentModel || (usesExternalComposerProps ? '' : defaultAgentModel(metaSnapshot, currentAgent)) || rawCurrentModel || defaultModel}
                    onModelChange={handleModelChange}
                    reasoningOptions={composerReasoningOptions}
                    reasoningValue={currentReasoning}
                    onReasoningChange={handleReasoningChange}
                    inputComponent={externalComposerProps?.inputComponent}
                    inputProps={externalComposerProps?.inputProps}
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
