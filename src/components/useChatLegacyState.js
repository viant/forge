import { useCallback, useEffect, useRef, useState } from 'react';

export default function useChatLegacyState({
    rawMessages,
    usesLegacyFeedState,
    normalizeMessages,
    normalizeLegacyMessages,
    debugEnabled = false,
}) {
    const [messages, setMessages] = useState([]);
    const [localQueuedTurns, setLocalQueuedTurns] = useState([]);
    const [optimisticRunning, setOptimisticRunning] = useState(false);
    const submitLatchRef = useRef(false);
    const submitLatchTimerRef = useRef(null);

    const clearSubmitLatchTimer = useCallback(() => {
        if (submitLatchTimerRef.current) {
            clearTimeout(submitLatchTimerRef.current);
            submitLatchTimerRef.current = null;
        }
    }, []);

    const resetSubmitLatch = useCallback(() => {
        clearSubmitLatchTimer();
        submitLatchRef.current = false;
    }, [clearSubmitLatchTimer]);

    useEffect(() => {
        if (!usesLegacyFeedState) {
            setMessages([]);
            setLocalQueuedTurns([]);
            setOptimisticRunning(false);
            resetSubmitLatch();
            return;
        }
        const { synthetic, rows: norm } = normalizeLegacyMessages(rawMessages, normalizeMessages);
        if (debugEnabled) {
            try {
                console.log('[forge-chat]', {
                    rawCount: Array.isArray(rawMessages) ? rawMessages.length : 0,
                    rawTypes: (Array.isArray(rawMessages) ? rawMessages : []).map((message) => ({
                        id: message?.id,
                        type: message?._type || message?.role,
                        mode: message?.mode || '',
                        head: String(message?.content || '').slice(0, 60),
                    })),
                    synthetic,
                    normCount: Array.isArray(norm) ? norm.length : 0,
                    normTypes: (Array.isArray(norm) ? norm : []).map((message) => ({
                        id: message?.id,
                        type: message?._type || message?.role,
                        mode: message?.mode || '',
                        head: String(message?.content || '').slice(0, 60),
                    })),
                });
            } catch (_) {}
        }
        setMessages(norm);
    }, [debugEnabled, normalizeLegacyMessages, normalizeMessages, rawMessages, resetSubmitLatch, usesLegacyFeedState]);

    return {
        messages,
        localQueuedTurns,
        setLocalQueuedTurns,
        optimisticRunning,
        setOptimisticRunning,
        submitLatchRef,
        submitLatchTimerRef,
        clearSubmitLatchTimer,
        resetSubmitLatch,
    };
}
