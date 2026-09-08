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

// Bus commands are transient. A panel mounting after a command was already
// handled must start at the current tail instead of replaying stale commands
// after metadata/target remounts (for example, a responsive viewport change).
export function initialBusMessageState(messages = []) {
    if (!Array.isArray(messages) || messages.length === 0) {
        return {};
    }
    return {length: messages.length, message: messages[messages.length - 1]};
}

export function resolveDataSourceFetchMode(configuredMode, inheritedMode = 'always') {
    const normalized = String(configuredMode || '').trim().toLowerCase();
    if (normalized === 'once' || normalized === 'always') {
        return normalized;
    }
    const inherited = String(inheritedMode || '').trim().toLowerCase();
    return inherited === 'once' ? 'once' : 'always';
}
