// MessageFeed.jsx – simple lazy loader list without virtualisation
import React, { useState, useEffect, useRef } from "react";
import MessageCard from "./MessageCard.jsx";

// ---------------------------------------------------------------------------
// Default rendering helpers used when the parent Chat component does not
// provide a custom mapping.
// ---------------------------------------------------------------------------

const DefaultBubbleRenderer = ({ message, context, resolveIcon, messageIndex }) => (
    <MessageCard msg={message} context={context} resolveIcon={resolveIcon} messageIndex={messageIndex} />
);

export const defaultClassifier = () => 'bubble';
export const defaultRenderers  = { bubble: DefaultBubbleRenderer };
export const AUTO_SCROLL_BOTTOM_THRESHOLD_PX = 48;

export function isNearBottom(element, threshold = AUTO_SCROLL_BOTTOM_THRESHOLD_PX) {
    const scrollHeight = Number(element?.scrollHeight);
    const scrollTop = Number(element?.scrollTop);
    const clientHeight = Number(element?.clientHeight);
    if (!Number.isFinite(scrollHeight) || !Number.isFinite(scrollTop) || !Number.isFinite(clientHeight)) {
        return true;
    }
    return scrollHeight - (scrollTop + clientHeight) <= threshold;
}

export function shouldAutoScrollFeed({ isFollowingBottom, hasMessages }) {
    return !!hasMessages && !!isFollowingBottom;
}

export default function MessageFeed({
    messages,
    batchSize = 50,
    context,
    classifyMessage = defaultClassifier,
    renderers = defaultRenderers,
    fallback = defaultRenderers.bubble,
    resolveIcon,
}) {
    const [visibleCount, setVisibleCount] = useState(batchSize);

    const containerRef = useRef(null);
    const bottomRef = useRef(null);
    const isFollowingBottomRef = useRef(true);

    const slice = messages.slice(Math.max(0, messages.length - visibleCount));

    useEffect(() => {
        const el = containerRef.current;
        if (!el || typeof window === 'undefined') return undefined;
        const syncFollowState = () => {
            isFollowingBottomRef.current = isNearBottom(el);
        };
        syncFollowState();
        el.addEventListener('scroll', syncFollowState, { passive: true });
        return () => el.removeEventListener('scroll', syncFollowState);
    }, []);

    useEffect(() => {
        if (!shouldAutoScrollFeed({
            isFollowingBottom: isFollowingBottomRef.current,
            hasMessages: messages.length > 0,
        })) {
            return;
        }
        // Scroll parent container to bottom
        const el = containerRef.current;
        if (el) {
            el.scrollTop = el.scrollHeight;
            isFollowingBottomRef.current = true;
        }

        // Additionally bring sentinel into view (handles nested scroll areas)
        bottomRef.current?.scrollIntoView({ behavior: "auto" });
    }, [messages.length]);


    return (
        <div
            ref={containerRef}
            className="chat-feed space-y-2 pr-2"
            data-testid="chat-feed"
        >
            {visibleCount < messages.length && (
                <div className="flex justify-center py-1">
                    <button
                        className="bp4-button bp4-minimal bp4-small"
                        data-testid="chat-feed-load-previous"
                        onClick={() => setVisibleCount((c) => Math.min(c + batchSize, messages.length))}
                    >
                        Load previous
                    </button>
                </div>
            )}
            {slice.map((m, i) => {
                const kind = classifyMessage(m);
                const Renderer = renderers[kind] || fallback;
                return <Renderer key={i} message={m} context={context} resolveIcon={resolveIcon} messageIndex={i} />;
            })}
            <div ref={bottomRef} />
        </div>
    );
}
