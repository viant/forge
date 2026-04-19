import { mergeQueuedTurns, resolveQueuedCount } from './chatCommandCenterHelpers.js';
import {
    computeLegacyIsProcessing,
    localOptimisticRunningForPath,
    shouldShowStarterTasks,
    effectiveShowAbortWhileRunning,
} from './chatLegacySubmitState.js';

export function computeEffectiveQueuedTurns({
    usesExternalFeedState = false,
    queuedTurns = [],
    localQueuedTurns = [],
}) {
    if (usesExternalFeedState) {
        return Array.isArray(queuedTurns) ? queuedTurns : [];
    }
    return mergeQueuedTurns(localQueuedTurns, queuedTurns);
}

export function computeChatDerivedState({
    usesExternalFeedState = false,
    usesLegacyFeedState = false,
    backendConversationRunning = false,
    hasActiveTurnLifecycle = false,
    optimisticRunning = false,
    messages = [],
    legacyActiveExecutions = false,
    legacyLastTurnStatus = '',
    lastUserIndex = -1,
    lastAssistantIndex = -1,
    isTerminalTurnStatus = () => false,
    starterTaskCount = 0,
    conversationID = '',
    effectiveShowAbort = true,
    abortVisible = false,
    queuedTurns = [],
    localQueuedTurns = [],
    queuedCountValue = undefined,
}) {
    const localOptimisticRunning = localOptimisticRunningForPath(usesExternalFeedState, optimisticRunning);
    const turnLifecycleRunning = !!(backendConversationRunning || hasActiveTurnLifecycle || localOptimisticRunning);
    const isProcessing = computeLegacyIsProcessing({
        usesLegacyFeedState,
        turnLifecycleRunning,
        legacyActiveExecutions,
        legacyLastTurnStatus,
        lastUserIndex,
        lastAssistantIndex,
        isTerminalTurnStatus,
    });
    return {
        localOptimisticRunning,
        turnLifecycleRunning,
        isProcessing,
        showStarterTasks: shouldShowStarterTasks({
            starterTaskCount,
            messageCount: Array.isArray(messages) ? messages.length : 0,
            conversationID,
            isProcessing,
        }),
        effectiveShowAbortWhileRunning: effectiveShowAbortWhileRunning({
            effectiveShowAbort,
            turnLifecycleRunning,
            abortVisible,
        }),
        effectiveQueuedTurns: computeEffectiveQueuedTurns({
            usesExternalFeedState,
            queuedTurns,
            localQueuedTurns,
        }),
        queuedCount: resolveQueuedCount({ queuedCount: queuedCountValue, queuedTurns }),
    };
}
