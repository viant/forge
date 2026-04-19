export function defaultNormalizeMessages(rawMessages = []) {
    return rawMessages.map((m) => ({...m}));
}

export function hasSyntheticChatRows(rawMessages = []) {
    const list = Array.isArray(rawMessages) ? rawMessages : [];
    return list.some((message) => {
        const kind = String(message?._type || '').trim().toLowerCase();
        return kind === 'iteration'
            || kind === 'queue'
            || kind === 'starter'
            || kind === 'paginator'
            || !!message?._iterationData;
    });
}

export function normalizeLegacyMessages(rawMessages = [], normalizeMessages = defaultNormalizeMessages) {
    if (hasSyntheticChatRows(rawMessages)) {
        return {
            synthetic: true,
            rows: Array.isArray(rawMessages) ? rawMessages : [],
        };
    }
    return {
        synthetic: false,
        rows: normalizeMessages(rawMessages),
    };
}

function hasActiveSteps(steps = []) {
    const list = Array.isArray(steps) ? steps : [];
    return list.some((s) => {
        const status = String(s?.status || s?.Status || '').toLowerCase();
        return status === 'in_progress' || status === 'running' || status === 'processing' || status === 'pending';
    });
}

function effectiveChatRow(message = {}) {
    const iterationData = message?._iterationData;
    if (iterationData && typeof iterationData === 'object') {
        return {
            ...iterationData,
            role: message?.role || iterationData?.role || '',
            turnStatus: iterationData?.status || message?.turnStatus || message?.status || '',
            status: iterationData?.status || message?.status || message?.turnStatus || '',
        };
    }
    return message || {};
}

export function hasActiveExecutions(messages = []) {
    const list = Array.isArray(messages) ? messages : [];
    return list.some((m) => {
        const row = effectiveChatRow(m);
        const executions = Array.isArray(row?.executions) ? row.executions : [];
        if (executions.some((ex) => hasActiveSteps(ex?.steps || []))) return true;
        const executionGroups = Array.isArray(row?.executionGroups) ? row.executionGroups : [];
        if (executionGroups.some((group) => {
            const status = String(group?.status || group?.Status || '').toLowerCase();
            if (status === 'in_progress' || status === 'running' || status === 'processing' || status === 'pending' || status === 'thinking' || status === 'streaming') {
                return true;
            }
            const modelSteps = Array.isArray(group?.modelSteps) ? group.modelSteps : (group?.modelCall ? [group.modelCall] : []);
            const toolSteps = Array.isArray(group?.toolSteps) ? group.toolSteps : [];
            return hasActiveSteps(modelSteps) || hasActiveSteps(toolSteps);
        })) return true;
        const iterationStatus = String(row?.turnStatus || row?.status || '').toLowerCase();
        return iterationStatus === 'in_progress'
            || iterationStatus === 'running'
            || iterationStatus === 'processing'
            || iterationStatus === 'pending'
            || iterationStatus === 'thinking'
            || iterationStatus === 'streaming';
    });
}

export function isTerminalTurnStatus(value) {
    const s = String(value || '').toLowerCase().trim();
    return s === 'completed' || s === 'done' || s === 'succeeded' || s === 'success' || s === 'failed' || s === 'error' || s === 'canceled' || s === 'cancelled';
}

export function resolveLastTurnStatus(messages = []) {
    const list = Array.isArray(messages) ? messages : [];
    let lastTurnId = '';
    for (let i = list.length - 1; i >= 0; i--) {
        const m = effectiveChatRow(list[i]);
        const role = String(m?.role || m?.Role || '').toLowerCase();
        const tid = String(m?.turnId || m?.TurnId || m?.parentId || m?.ParentId || '').trim();
        if (role === 'user' && tid) {
            lastTurnId = tid;
            break;
        }
    }
    if (!lastTurnId) {
        for (let i = list.length - 1; i >= 0; i--) {
            const row = effectiveChatRow(list[i]);
            const tid = String(row?.turnId || row?.TurnId || row?.parentId || row?.ParentId || '').trim();
            if (tid) {
                lastTurnId = tid;
                break;
            }
        }
    }
    if (!lastTurnId) return '';

    for (let i = list.length - 1; i >= 0; i--) {
        const m = effectiveChatRow(list[i]);
        const tid = String(m?.turnId || m?.TurnId || m?.parentId || m?.ParentId || '').trim();
        if (tid !== lastTurnId) continue;
        const turnStatus = String(m?.turnStatus || m?.TurnStatus || '').trim();
        if (turnStatus) return turnStatus;
        const status = String(m?.status || m?.Status || '').trim();
        if (status && isTerminalTurnStatus(status)) return status;
    }
    return '';
}

export function lastIndexByRole(messages = [], role) {
    const list = Array.isArray(messages) ? messages : [];
    const target = String(role || '').toLowerCase();
    for (let i = list.length - 1; i >= 0; i--) {
        const r = String(list[i]?.role || list[i]?.Role || '').toLowerCase();
        if (r === target) return i;
    }
    return -1;
}

export function formatTokensCompact(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return '';
    if (n < 1000) return String(Math.round(n));
    const k = n / 1000;
    const roundedTenth = Math.round(k * 10) / 10;
    const text = (roundedTenth % 1 === 0) ? String(Math.trunc(roundedTenth)) : String(roundedTenth);
    return `${text}k`;
}

export function formatCostCompact(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return '';
    return `$${n.toFixed(2)}`;
}

export function shouldKeepLocalQueuedPreview(messages = [], preview = '', runningTurnId = '', backendQueuedContent = new Set(), isConversationStillActive = false) {
    const target = String(preview || '').trim();
    if (!target) return false;
    if (backendQueuedContent.has(target)) return false;

    const list = Array.isArray(messages) ? messages : [];
    const activeTurnId = String(runningTurnId || '').trim();
    if (activeTurnId && list.some((message) => {
        const row = effectiveChatRow(message);
        const role = String(row?.role || row?.Role || '').toLowerCase();
        if (role !== 'user') return false;
        const turnId = String(row?.turnId || row?.TurnId || row?.parentId || row?.ParentId || '').trim();
        if (turnId !== activeTurnId) return false;
        return String(row?.content || row?.Content || '').trim() === target;
    })) {
        return false;
    }

    if (isConversationStillActive) return true;

    let userIndex = -1;
    for (let i = list.length - 1; i >= 0; i--) {
        const role = String(list[i]?.role || list[i]?.Role || '').toLowerCase();
        const content = String(list[i]?.content || list[i]?.Content || '').trim();
        if (role === 'user' && content === target) {
            userIndex = i;
            break;
        }
    }
    if (userIndex === -1) return false;
    for (let i = userIndex + 1; i < list.length; i++) {
        const role = String(list[i]?.role || list[i]?.Role || '').toLowerCase();
        if (role === 'assistant') return false;
    }
    const status = String(list[userIndex]?.turnStatus || list[userIndex]?.TurnStatus || '').toLowerCase();
    return !isTerminalTurnStatus(status);
}
