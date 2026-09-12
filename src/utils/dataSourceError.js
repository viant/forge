export function normalizeDataSourceError(error) {
    if (!error) {
        return null;
    }
    if (error.__forgeDataSourceError === true) {
        const display = String(error.displayMessage || error.message || 'Unable to load data. Please retry.').trim() || 'Unable to load data. Please retry.';
        return {...error, displayMessage: resolveDisplayMessage(Number(error.status) || undefined, display)};
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
    return !text || text === '[object Object]' ? 'Unable to load data. Please retry.' : text;
}

function resolveDisplayMessage(status, message) {
    if (status === 401) {
        return 'Authentication required. Please sign in to continue.';
    }
    if (status === 403) {
        return 'Access denied. You do not have permission to load this data.';
    }
    if (status === 408 || status === 504 || /(?:timed?\s*out|timeout)/i.test(message)) {
        return 'The request timed out. Retry in a moment.';
    }
    const validationMessage = extractValidationMessage(message);
    if (validationMessage) {
        return validationMessage;
    }
    if (status === 422 || /\b422\b[\s\S]*\{/.test(message)) {
        return 'Some request parameters are invalid. Check the filters and retry.';
    }
    if ((status && status >= 500) || /(?:internal server error|parameter\s+"?(?:auth|sysconfig)"?|seed\s+"?[a-z0-9_]+"?\s*:)/i.test(message)) {
        return 'This data is temporarily unavailable. Retry in a moment.';
    }
    return message;
}

function extractValidationMessage(message) {
    const match = String(message || '').match(/(\{[\s\S]*\})\s*$/);
    if (!match) {
        return '';
    }
    try {
        const payload = JSON.parse(match[1]);
        const violations = Array.isArray(payload?.violations) ? payload.violations : [];
        const messages = [...new Set(violations
            .map((violation) => String(violation?.Message || violation?.message || '').trim())
            .filter(Boolean))];
        return messages.join(' ');
    } catch (_) {
        return '';
    }
}
