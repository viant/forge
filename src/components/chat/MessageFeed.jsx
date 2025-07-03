// MessageFeed.jsx – simple lazy loader list without virtualisation
import React, { useState, useEffect, useRef } from "react";
import MessageCard from "./MessageCard.jsx";
import {range} from "lodash";

// ---------------------------------------------------------------------------
// Default rendering helpers used when the parent Chat component does not
// provide a custom mapping.
// ---------------------------------------------------------------------------

const DefaultBubbleRenderer = ({ message, context, resolveIcon }) => (
    <MessageCard msg={message} context={context} resolveIcon={resolveIcon} />
);

export const defaultClassifier = () => 'bubble';
export const defaultRenderers  = { bubble: DefaultBubbleRenderer };

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

    const slice = messages.slice(Math.max(0, messages.length - visibleCount));

    // Auto-scroll to bottom whenever new messages arrive
    useEffect(() => {
        // Scroll parent container to bottom
        const el = containerRef.current;
        if (el) {
            el.scrollTop = el.scrollHeight;
        }

        // Additionally bring sentinel into view (handles nested scroll areas)
        bottomRef.current?.scrollIntoView({ behavior: "auto" });
    }, [messages.length]);


    return (
        <div ref={containerRef} className="chat-feed space-y-2 pr-2">
            {visibleCount < messages.length && (
                <div className="flex justify-center py-1">
                    <button
                        className="bp4-button bp4-minimal bp4-small"
                        onClick={() => setVisibleCount((c) => Math.min(c + batchSize, messages.length))}
                    >
                        Load previous
                    </button>
                </div>
            )}
            {slice.map((m, i) => {
                const kind = classifyMessage(m);
                const Renderer = renderers[kind] || fallback;
                return <Renderer key={i} message={m} context={context} resolveIcon={resolveIcon} />;
            })}
            <div ref={bottomRef} />
        </div>
    );
}
