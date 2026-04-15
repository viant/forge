// MessageCard.jsx – chat message bubble with avatar
import React from "react";
// Use lightweight AvatarIcon (wrapping phosphor-react) instead of Blueprint icons
import AvatarIcon from "../AvatarIcon.jsx";
import { format as formatDate } from "date-fns";
import { autoType, csvParse } from "d3-dsv";
import { DashboardBlock } from "../dashboard/DashboardBlocks.jsx";
import { DASHBOARD_BLOCK_KINDS } from "../../core/ui/dashboardCapabilities.js";

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

function extractDashboardPayload(content = "") {
    const raw = String(content || "").trim();
    if (!raw) return null;
    const singleFence = raw.match(/^```([a-zA-Z0-9_-]+)?\s*([\s\S]*?)```$/);
    if (!singleFence) return null;

    const language = String(singleFence[1] || "").trim().toLowerCase();
    const body = String(singleFence[2] || "").trim();
    if (!body) return null;
    if (!(language === "dashboard" || language === "dashborad")) {
        return null;
    }

    return tryParseDashboardJSON(body);
}

function tryParseDashboardJSON(text) {
    try {
        const parsed = JSON.parse(text);
        return isDashboardPayload(parsed) ? parsed : null;
    } catch (_) {
        return null;
    }
}

function isDashboardPayload(value) {
    if (!value || typeof value !== "object") return false;
    const blocks = Array.isArray(value.blocks) ? value.blocks : [];
    if (blocks.length === 0) return false;
    return blocks.some((block) => {
        const kind = String(block?.kind || "").trim();
        return DASHBOARD_BLOCK_KINDS.includes(kind);
    });
}

function createStaticSignal(value) {
    return {
        value,
        peek: () => value,
    };
}

function normalizeDashboardDataSources(dataSources = []) {
    return (Array.isArray(dataSources) ? dataSources : []).map((entry) => {
        if (!entry || typeof entry !== "object") return entry;
        if (Array.isArray(entry.collection)) return entry;
        const csv = String(entry.csv || "").trim();
        if (!csv) return entry;
        try {
            const collection = csvParse(csv, autoType);
            return { ...entry, collection };
        } catch (_) {
            return entry;
        }
    });
}

function buildDashboardBlockContext(baseContext, payload, block, messageID) {
    const dataSources = normalizeDashboardDataSources(payload?.dataSources);
    const source = dataSources.find((entry) => entry && entry.id === block?.dataSourceRef) || null;
    const collection = Array.isArray(source?.collection) ? source.collection : [];
    const dashboardKey = `message-dashboard:${messageID || "unknown"}`;

    return {
        ...(baseContext || {}),
        dashboardKey,
        identity: {
            ...(baseContext?.identity || {}),
            dashboardKey,
            windowId: baseContext?.identity?.windowId || dashboardKey,
        },
        locale: baseContext?.locale || "en-US",
        signals: {
            ...(baseContext?.signals || {}),
            metrics: createStaticSignal(payload?.metrics || {}),
            collection: createStaticSignal(collection),
            control: createStaticSignal({}),
            selection: createStaticSignal({}),
        },
        handlers: {
            ...(baseContext?.handlers || {}),
            dataSource: {
                ...(baseContext?.handlers?.dataSource || {}),
                setSelected: () => {},
                getSelection: () => ({ selected: null }),
            },
        },
    };
}

function DashboardMessage({ payload, context, messageID }) {
    const blocks = (Array.isArray(payload?.blocks) ? payload.blocks : []).filter((block) =>
        DASHBOARD_BLOCK_KINDS.includes(String(block?.kind || "").trim())
    );
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%" }}>
            {payload?.title ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "2px 2px 4px" }}>
                    <div style={{ fontSize: "19px", fontWeight: 800, letterSpacing: "0.01em", color: "#182026" }}>{payload.title}</div>
                    {payload?.subtitle ? (
                        <div style={{ fontSize: "12px", color: "#5f6b7c", lineHeight: 1.45, maxWidth: "110ch" }}>{payload.subtitle}</div>
                    ) : null}
                    <div style={{ height: "1px", width: "100%", background: "linear-gradient(90deg, rgba(19,124,189,0.18) 0%, rgba(15,153,96,0.08) 50%, rgba(219,225,232,0.14) 100%)" }} />
                </div>
            ) : null}
            {blocks.map((block, index) => (
                <DashboardBlock
                    key={String(block?.id || `${block?.kind || "dashboard"}-${index}`)}
                    container={block}
                    context={buildDashboardBlockContext(context, payload, block, messageID)}
                    isActive={true}
                />
            ))}
        </div>
    );
}

// CSS classes are reused from chat.css already loaded by parent.

function stableMessageID(msg) {
    const candidate = msg?.id || msg?.Id || msg?.messageId || msg?.MessageId;
    if (candidate === undefined || candidate === null) return '';
    return String(candidate);
}

function messageTestID(msg, fallbackIndex, suffix) {
    const id = stableMessageID(msg);
    const base = id ? `chat-message-${id}` : `chat-message-idx-${fallbackIndex}`;
    return suffix ? `${base}-${suffix}` : base;
}

export default function MessageCard({ msg, context, resolveIcon, messageIndex = 0 }) {
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
    const dashboardPayload = msg.role === "assistant" ? extractDashboardPayload(msg.content) : null;

    // Generic bubble – no execution specific UX in Forge default build.
    const bubbleClass =
        (msg.role === "user"
            ? "chat-bubble chat-user"
            : msg.role === "assistant"
                ? "chat-bubble chat-bot"
                : "chat-bubble chat-tool");

    return (
        <div
            className={`chat-row ${msg.role}`}
            data-testid={messageTestID(msg, messageIndex, 'row')}
        >
            <div style={{ display: "flex", alignItems: "flex-start" }}>
                <div
                    className="avatar"
                    style={{ background: avatarColour, display: 'flex', alignItems:'center', justifyContent:'center' }}
                    data-testid={messageTestID(msg, messageIndex, 'avatar')}
                >
                    <AvatarIcon name={iconName} size={14} color={"var(--black)"} weight="fill" />
                </div>
                <div
                    className={bubbleClass}
                    data-ts={formatDate(new Date(msg.createdAt), "HH:mm")}
                    data-testid={messageTestID(msg, messageIndex, 'bubble')}
                    style={dashboardPayload ? { maxWidth: "min(1200px, 100%)", width: "100%" } : undefined}
                >
                    {dashboardPayload ? (
                        <DashboardMessage payload={dashboardPayload} context={context} messageID={stableMessageID(msg)} />
                    ) : (
                        <div className="prose max-w-full text-sm" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                    )}

                    {/* Execution details are rendered by application-specific bubble renderers. */}
                </div>
            </div>
        </div>
    );
}
