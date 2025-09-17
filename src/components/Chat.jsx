import React, { useState, useCallback } from "react";
import { useDataSourceState } from "../hooks/useDataSourceState.js";


// Re-exported building blocks living under src/components/chat
import MessageFeed from "./chat/MessageFeed.jsx";
import Composer     from "./chat/Composer.jsx";
import MessageCard  from "./chat/MessageCard.jsx";
import FormRenderer from "./FormRenderer.jsx";

import { useSetting } from "../core";

import { chatHandlers } from "../hooks";
import { useEffect } from "react";


// Shared chat styles (avatars, bubbles, etc.)
import "./chat.css";

// Reuse the existing table toolbar for chat when descriptor provided
import TableToolbar from "./table/basic/Toolbar.jsx";


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

    // ---------------------------------------------------------------------
    // 🛑  Abort handler – invoked when the user clicks the "Abort" button in
    //      the Composer (if rendered). Delegates to configured event handler
    //      chain when provided.
    // ---------------------------------------------------------------------

    const handleAbort = () => {
        if (events.onAbort?.isDefined?.()) {
            events.onAbort.execute({ context });
        }
    };

    const handleSubmit = ({ content, toolNames = [] }) => {
        const userMessage = {
            role: "user",
            content,
            toolNames,
            createdAt: new Date().toISOString(),
        };

        // Immediately push the message to the DataSource (if available)
        handlers?.dataSource?.setFormData?.(userMessage);

        // Execute custom event callback defined in configuration (if any)
        if (events.onSubmit?.isDefined?.()) {
            events.onSubmit.execute({ message: userMessage, context });
        }
    };

    const handleUpload = (e) => {
        const file = e?.target?.files?.[0];
        if (!file) return;

        const attachment = {
            name: file.name,
            url: URL.createObjectURL(file),
            size: file.size,
            mediaType: file.type,
        };

        const fileMessage = {
            role: "user",
            content: `Uploaded file: **${file.name}**`,
            attachments: [attachment],
            createdAt: new Date().toISOString(),
        };

        handlers?.dataSource?.setFormData?.(fileMessage);

        // Delegate to custom upload handler when provided
        if (events.onUpload?.isDefined?.()) {
            events.onUpload.execute({ message: fileMessage, file, context });
        }

        // Reset the <input type="file"> element so the same file can be re-uploaded if needed
        if (e?.target) {
            e.target.value = "";
        }
    };

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
                    console.log('[forge][chat] render error banner', { typeof: typeof error, message: error?.message, value: error });
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
                    onSubmit={handleSubmit}
                    onUpload={handleUpload}
                    onAbort={handleAbort}
                    showAbort={chatCfg.showAbort}
                    disabled={loading}
                />
            )}
        </div>
    );
}
