export function mergeSelectedTab(previous = {}, panelId, tabId) {
    const normalizedPanelId = String(panelId || '');
    const normalizedTabId = String(tabId || '');
    const currentTabId = String(previous?.tabs?.[normalizedPanelId] || '');

    if (!normalizedPanelId || !normalizedTabId || currentTabId === normalizedTabId) {
        return {changed: false, value: previous || {}};
    }

    return {
        changed: true,
        value: {
            ...(previous || {}),
            tabs: {
                ...((previous || {}).tabs || {}),
                [normalizedPanelId]: tabId,
            },
        },
    };
}

export function nextBusMessage(messages, previous = {}) {
    if (!Array.isArray(messages) || messages.length === 0) {
        return {changed: false, state: previous || {}, message: null};
    }

    const message = messages[messages.length - 1];
    if ((previous || {}).length === messages.length && (previous || {}).message === message) {
        return {changed: false, state: previous, message: null};
    }

    return {
        changed: true,
        state: {length: messages.length, message},
        message,
    };
}
