// MessageFeed.jsx – simple lazy loader list without virtualisation
import React, { useState, useEffect, useRef } from "react";
import MessageCard from "./MessageCard.jsx";

export default function MessageFeed({ messages, batchSize = 50, context }) {
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
            {slice.map((m, i) => (
                <MessageCard key={i} msg={m} context={context} />
            ))}
            <div ref={bottomRef} />
        </div>
    );
}
