import { normalizeString } from './chatCommandCenterHelpers.js';

export function cancelQueuedTurn({ chatService, context, conversationID, turn }) {
    const turnID = normalizeString(turn?.id);
    if (!turnID || !conversationID) return;
    if (typeof chatService?.cancelQueuedTurnByID === 'function') {
        chatService.cancelQueuedTurnByID({ context, conversationID, turnID });
    }
}

export function moveQueuedTurn({ chatService, context, conversationID, turn, direction }) {
    const turnID = normalizeString(turn?.id);
    const dir = normalizeString(direction).toLowerCase();
    if (!turnID || !conversationID || (dir !== 'up' && dir !== 'down')) return;
    if (typeof chatService?.moveQueuedTurn === 'function') {
        chatService.moveQueuedTurn({ context, conversationID, turnID, direction: dir });
    }
}

export function editQueuedTurn({ chatService, context, conversationID, turn, promptFn = null }) {
    const turnID = normalizeString(turn?.id);
    if (!turnID || !conversationID) return;
    const initial = normalizeString(turn?.content) || normalizeString(turn?.preview);
    const ask = typeof promptFn === 'function' ? promptFn : (typeof window !== 'undefined' ? window.prompt : null);
    if (typeof ask !== 'function') return;
    const next = ask('Edit queued request', initial);
    if (next == null) return;
    const content = normalizeString(next);
    if (!content || content === initial) return;
    if (typeof chatService?.editQueuedTurn === 'function') {
        chatService.editQueuedTurn({ context, conversationID, turnID, content });
    }
}

export function steerQueuedTurn({ chatService, context, conversationID, turn, runningTurnId }) {
    const turnID = normalizeString(turn?.id);
    if (!turnID || !conversationID) return;
    if (typeof chatService?.forceSteerQueuedTurn === 'function') {
        chatService.forceSteerQueuedTurn({ context, conversationID, turnID });
        return;
    }
    const content = normalizeString(turn?.content) || normalizeString(turn?.preview);
    const activeTurnId = normalizeString(runningTurnId);
    if (!content || !activeTurnId) return;
    if (typeof chatService?.steerTurn === 'function') {
        chatService.steerTurn({ context, conversationID, turnID: activeTurnId, content });
    }
}
