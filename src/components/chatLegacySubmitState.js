export function localOptimisticRunningForPath(usesExternalFeedState, optimisticRunning) {
    return usesExternalFeedState ? false : optimisticRunning;
}

export function computeSubmittingWhileProcessing({
    externalStateOwns = false,
    isProcessing = false,
    backendConversationRunning = false,
    localOptimisticRunning = false,
    submitLatch = false,
}) {
    if (externalStateOwns) return !!isProcessing;
    return !!(isProcessing || backendConversationRunning || localOptimisticRunning || submitLatch);
}

export function shouldHoldLegacySubmitLatch({
    usesLegacyFeedState = false,
    isProcessing = false,
    backendConversationRunning = false,
    localOptimisticRunning = false,
}) {
    if (!usesLegacyFeedState) return false;
    return !!(isProcessing || backendConversationRunning || localOptimisticRunning);
}

export function shouldClearLegacyOptimisticRunning({
    usesLegacyFeedState = false,
    turnLifecycleRunning = false,
    legacyActiveExecutions = false,
    legacyLastTurnStatus = '',
}) {
    if (!usesLegacyFeedState) return false;
    return !!(turnLifecycleRunning || legacyActiveExecutions || legacyLastTurnStatus);
}

export function makeLocalQueuedPreview(content, now = Date.now(), random = Math.random()) {
    return {
        id: `local:${now}:${String(random).replace(/^0\./, '').slice(0, 6)}`,
        preview: String(content || '').trim(),
        local: true,
    };
}

export function computeLegacyIsProcessing({
    usesLegacyFeedState = false,
    turnLifecycleRunning = false,
    legacyActiveExecutions = false,
    legacyLastTurnStatus = '',
    lastUserIndex = -1,
    lastAssistantIndex = -1,
    isTerminalTurnStatus = () => false,
}) {
    if (!usesLegacyFeedState) return !!turnLifecycleRunning;
    const lastTurnIsTerminal = !!isTerminalTurnStatus(legacyLastTurnStatus);
    const hasUnansweredUser = lastUserIndex !== -1 && lastUserIndex > lastAssistantIndex;
    if (turnLifecycleRunning) return true;
    if (legacyActiveExecutions) return true;
    if (lastTurnIsTerminal) return false;
    if (hasUnansweredUser) return true;
    return true;
}

export function shouldShowStarterTasks({
    starterTaskCount = 0,
    messageCount = 0,
    conversationID = '',
    isProcessing = false,
}) {
    return starterTaskCount > 0
        && messageCount === 0
        && !conversationID
        && !isProcessing;
}

export function effectiveShowAbortWhileRunning({
    effectiveShowAbort = true,
    turnLifecycleRunning = false,
    abortVisible = false,
}) {
    return !!effectiveShowAbort && !!(turnLifecycleRunning || abortVisible);
}

export function retainLocalQueuedTurns({
    current = [],
    messages = [],
    runningTurnId = '',
    backendQueuedContent = new Set(),
    isConversationStillActive = false,
    shouldKeepLocalQueuedPreview = () => false,
}) {
    return (Array.isArray(current) ? current : []).filter((entry) => {
        const preview = String(entry?.preview || '').trim();
        return shouldKeepLocalQueuedPreview(
            messages,
            preview,
            runningTurnId,
            backendQueuedContent,
            isConversationStillActive,
        );
    });
}
