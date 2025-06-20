// MessageCard.jsx – chat message bubble with avatar
import React from "react";
import { Icon } from "@blueprintjs/core";
import { format as formatDate } from "date-fns";
import ExecutionDetails from "./ExecutionDetails.jsx";

// ---------------------------------------------------------------------------
// 🛠️  Minimal, safe-ish markdown → HTML converter (no external deps)
// ---------------------------------------------------------------------------
function renderMarkdown(md = "") {
    // Escape HTML first to avoid XSS vectors
    const escaped = md
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    // Code blocks ```lang\ncode```
    const withCodeBlocks = escaped.replace(/```([\s\S]*?)```/g, (match, p1) => {
        return `<pre><code>${p1}</code></pre>`;
    });

    // Inline code `code`
    const withInlineCode = withCodeBlocks.replace(/`([^`]+?)`/g, "<code>$1</code>");

    // Bold **text**
    const withBold = withInlineCode.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

    // Italic *text*
    const withItalic = withBold.replace(/\*(.*?)\*/g, "<em>$1</em>");

    // Strikethrough ~~text~~
    const withStrike = withItalic.replace(/~~(.*?)~~/g, "<del>$1</del>");

    // Links [text](url)
    const withLinks = withStrike.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // Line breaks
    return withLinks.replace(/\n/g, "<br/>");
}

// CSS classes are reused from chat.css already loaded by parent.

export default function MessageCard({ msg, context }) {
    const avatarColour =
        msg.role === "user"
            ? "var(--blue4)"
            : msg.role === "assistant"
                ? "var(--light-gray4)"
                : "var(--orange3)";

    const iconName = msg.role === "assistant" ? "chat" : msg.role === "tool" ? "wrench" : "person";
    const iconColour = msg.role === "assistant" ? "var(--black)" :  "var(--black)" ;

    const hasExec = msg.executions?.length > 0;
    const bubbleClass =
        (msg.role === "user"
            ? "chat-bubble chat-user"
            : msg.role === "assistant"
                ? "chat-bubble chat-bot"
                : "chat-bubble chat-tool") + (hasExec ? " has-executions" : "");

    return (
        <div className={`chat-row ${msg.role}`}> {/* alignment flex row */}
            <div style={{ display: "flex", alignItems: "flex-start" }}>
                <div className="avatar" style={{ background: avatarColour }}>
                    <Icon icon={iconName} color={iconColour} size={12} />
                </div>
                <div className={bubbleClass} data-ts={formatDate(new Date(msg.createdAt), "HH:mm")}>
                    <div className="prose max-w-full text-sm" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />

                    {hasExec && (
                        <details className="mt-2">
                            <summary className="cursor-pointer text-xs text-blue-500">
                                Execution details ({msg.executions.length})
                            </summary>
                            <ExecutionDetails executions={msg.executions} context={context} messageId={msg.id} />
                        </details>
                    )}
                </div>
            </div>
        </div>
    );
}
