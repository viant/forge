export function normalizeDataSourceError(error) {
    if (!error) {
        return null;
    }
    if (error.__forgeDataSourceError === true) {
        return error;
    }
    const status = Number.isFinite(Number(error?.status)) ? Number(error.status) : undefined;
    const statusText = String(error?.statusText || '').trim() || undefined;
    const message = resolveErrorMessage(error, status, statusText);
    const displayMessage = resolveDisplayMessage(status, message);
    return {
        __forgeDataSourceError: true,
        status,
        statusText,
        isUnauthorized: Boolean(error?.isUnauthorized) || status === 401 || status === 403,
        message,
        displayMessage,
        raw: error,
        toString() {
            return displayMessage;
        },
    };
}

export function formatDataSourceError(error) {
    const normalized = normalizeDataSourceError(error);
    if (!normalized) {
        return '';
    }
    return normalized.displayMessage;
}

function resolveErrorMessage(error, status, statusText) {
    const explicit = String(error?.message || '').trim();
    if (explicit) {
        return explicit;
    }
    if (typeof error === 'string' && error.trim()) {
        return error.trim();
    }
    if (status && statusText) {
        return `Request failed: ${status} ${statusText}`;
    }
    if (status) {
        return `Request failed: ${status}`;
    }
    const text = String(error || '').trim();
    return text || 'Request failed';
}

function resolveDisplayMessage(status, message) {
    if (status === 401) {
        return 'Authentication required. Please sign in to continue.';
    }
    if (status === 403) {
        return 'Access denied. You do not have permission to load this data.';
    }
    return message;
}
