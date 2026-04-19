import { useEffect } from 'react';

import {
    retainLocalQueuedTurns,
    shouldClearLegacyOptimisticRunning,
    shouldHoldLegacySubmitLatch,
} from './chatLegacySubmitState.js';

export default function useChatLegacyLifecycle({
    usesLegacyFeedState,
    localQueuedTurns,
    queuedTurns,
    messages,
    runningTurnId,
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
}) {
    useEffect(() => {
        if (!usesLegacyFeedState) return;
        if (!localQueuedTurns.length) return;
        const backendQueuedContent = new Set(
            (Array.isArray(queuedTurns) ? queuedTurns : [])
                .map((entry) => String(entry?.preview || '').trim())
                .filter(Boolean),
        );
        setLocalQueuedTurns((current) => retainLocalQueuedTurns({
            current,
            messages,
            runningTurnId,
            backendQueuedContent,
            isConversationStillActive: backendConversationRunning || localOptimisticRunning,
            shouldKeepLocalQueuedPreview,
        }));
    }, [
        usesLegacyFeedState,
        localQueuedTurns.length,
        queuedTurns,
        messages,
        runningTurnId,
        backendConversationRunning,
        localOptimisticRunning,
        setLocalQueuedTurns,
        shouldKeepLocalQueuedPreview,
    ]);

    useEffect(() => {
        if (shouldClearLegacyOptimisticRunning({
            usesLegacyFeedState,
            turnLifecycleRunning,
            legacyActiveExecutions,
            legacyLastTurnStatus,
        })) {
            setOptimisticRunning(false);
        }
    }, [
        usesLegacyFeedState,
        turnLifecycleRunning,
        legacyActiveExecutions,
        legacyLastTurnStatus,
        setOptimisticRunning,
    ]);

    useEffect(() => {
        if (!shouldHoldLegacySubmitLatch({
            usesLegacyFeedState,
            isProcessing,
            backendConversationRunning,
            localOptimisticRunning,
        })) {
            resetSubmitLatch();
            return;
        }
        submitLatchRef.current = true;
    }, [
        usesLegacyFeedState,
        isProcessing,
        backendConversationRunning,
        localOptimisticRunning,
        resetSubmitLatch,
        submitLatchRef,
    ]);

    useEffect(() => () => {
        clearSubmitLatchTimer();
    }, [clearSubmitLatchTimer]);
}
