// MessageCard.jsx – chat message bubble with avatar
import React from "react";
// Use lightweight AvatarIcon (wrapping phosphor-react) instead of Blueprint icons
import AvatarIcon from "../AvatarIcon.jsx";
import { format as formatDate } from "date-fns";

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

export default function MessageCard({ msg, context, resolveIcon }) {
    const avatarColour =
        msg.role === "user"
            ? "var(--blue4)"
            : msg.role === "assistant"
                ? "var(--light-gray4)"
                : "var(--orange3)";

    // Determine which icon to show for this message.
    // 1. Explicit override on the message object
    // 2. Fallback based on role
    const iconName =
        msg.iconName ||
        (typeof resolveIcon === 'function' ? resolveIcon(msg) : undefined) ||
        (msg.role === 'assistant' ? 'Smiley' : msg.role === 'tool' ? 'UserGear' : 'User');

    // Generic bubble – no execution specific UX in Forge default build.
    const bubbleClass =
        (msg.role === "user"
            ? "chat-bubble chat-user"
            : msg.role === "assistant"
                ? "chat-bubble chat-bot"
                : "chat-bubble chat-tool");

    return (
        <div className={`chat-row ${msg.role}`}> {/* alignment flex row */}
            <div style={{ display: "flex", alignItems: "flex-start" }}>
                <div className="avatar" style={{ background: avatarColour, display: 'flex', alignItems:'center', justifyContent:'center' }}>
                    <AvatarIcon name={iconName} size={14} color={"var(--black)"} weight="fill" />
                </div>
                <div className={bubbleClass} data-ts={formatDate(new Date(msg.createdAt), "HH:mm")}>
                    <div className="prose max-w-full text-sm" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />

                    {/* Execution details are rendered by application-specific bubble renderers. */}
                </div>
            </div>
        </div>
    );
}
