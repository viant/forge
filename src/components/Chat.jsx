import React, { useState } from "react";
import { useDataSourceState } from "../hooks/useDataSourceState.js";

import { Spinner } from "@blueprintjs/core";

// Re-exported building blocks living under src/components/chat
import MessageFeed from "./chat/MessageFeed.jsx";
import Composer     from "./chat/Composer.jsx";

import { chatHandlers } from "../hooks/event.js";

// Shared chat styles (avatars, bubbles, etc.)
import "./chat.css";


// ---------------------------------------------------------------------------
// 💬 Chat – high-level wrapper that connects Forge runtime signals with the
//           presentational chat sub-components (MessageFeed & Composer).
// ---------------------------------------------------------------------------

export default function Chat({ context, container = {} }) {
    // ---------------------------------------------------------------------
    // 📡  Resolve Forge runtime context
    // ---------------------------------------------------------------------
    if (!context) {
        throw new Error("Chat component requires a context provided by Forge's runtime");
    }

    const { handlers } = context;

    // chat configuration fragment coming from container metadata (optional)
    const chatCfg = container?.chat || {};

    // use unified hook for reactive data
    const { collection: rawMessages, loading, error } = useDataSourceState(context);

    // ---------------------------------------------------------------------
    // 🛑  Local component state reflecting incoming signals
    // ---------------------------------------------------------------------
    const [messages, setMessages] = useState([]);
    // Keep local state in sync with collection coming from hook
    React.useEffect(() => {
        const norm = (rawMessages || []).map((m) => ({
            role:        m.role      ?? m.Role ?? (m.toolName || m.ToolName ? "tool" : undefined),
            content:     m.content   ?? m.Content,
            createdAt:   m.createdAt ?? m.CreatedAt,
            toolName:    m.toolName  ?? m.ToolName,
            attachments: m.attachments ?? m.Attachments,
            executions:  m.executions ?? m.execution ?? m.Executions ?? m.Execution,
        }));
        setMessages(norm);
    }, [rawMessages]);

    // ---------------------------------------------------------------------
    // 📤  Submit / Upload handlers delegated to Composer
    // ---------------------------------------------------------------------

    // Resolve any container-level event handlers declared in metadata
    const events = chatHandlers(context, container);

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
    return (
        <div className="flex h-full w-full flex-col p-4 gap-3">
            {/* Loading / Error banners */}
            {loading && (
                <div className="flex items-center justify-center py-2">
                    <Spinner size={20} />
                </div>
            )}
            {error && <div className="text-red-500 text-sm py-1">{error}</div>}

            {/* Message list */}
            <MessageFeed messages={messages} batchSize={chatCfg.batchSize || 50} context={context} />

            {/* Prompt composer */}
            <Composer
                tools={chatCfg.tools || []}
                showTools={chatCfg.showTools && (chatCfg.tools || []).length > 0}
                showUpload={chatCfg.showUpload}
                onSubmit={handleSubmit}
                onUpload={handleUpload}
                disabled={loading}
            />
        </div>
    );
}
