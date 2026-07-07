function baseErrorText(error = null) {
    if (error == null) {
        return "";
    }
    if (typeof error === "string") {
        return error.trim();
    }
    if (typeof error?.message === "string" && error.message.trim()) {
        return error.message.trim();
    }
    try {
        return JSON.stringify(error);
    } catch (_) {
        return "Unexpected error";
    }
}

function stripTransportPayloadNoise(text = "") {
    return String(text || "")
        .replace(/,\s*data:\s*\[[\s\S]*$/i, "")
        .replace(/\s+/g, " ")
        .trim();
}

function normalizeTransportPrefix(text = "") {
    return String(text || "")
        .replace(/^[A-Z]+\s+error:\s*\d+\s+[A-Za-z ]+:\s*/i, "")
        .replace(/^code:\s*-?\d+,\s*message:\s*/i, "")
        .replace(/^failed to send request:\s*/i, "")
        .trim();
}

function normalizeRequestUrl(requestUrl = "") {
    const raw = String(requestUrl || "").trim();
    if (!raw) {
        return "";
    }
    try {
        const parsed = new URL(raw);
        const hostname = parsed.hostname === "::1" ? "localhost" : parsed.hostname;
        return `${parsed.protocol}//${hostname}${parsed.port ? `:${parsed.port}` : ""}${parsed.pathname || ""}`;
    } catch (_) {
        return raw;
    }
}

export function normalizeServiceErrorText(error = null, {
    serviceLabel = "service",
} = {}) {
    const normalizedServiceLabel = String(serviceLabel || "").trim() || "service";
    const baseText = baseErrorText(error);
    if (!baseText) {
        return "";
    }
    const strippedText = normalizeTransportPrefix(stripTransportPayloadNoise(baseText));
    const connectionRefusedMatch = strippedText.match(/(?:Post|GET|PUT|PATCH|DELETE)\s+"([^"]+)":\s*dial tcp .*?connect:\s*connection refused/i);
    if (connectionRefusedMatch) {
        const requestUrl = normalizeRequestUrl(connectionRefusedMatch[1] || "");
        return requestUrl
            ? `Could not reach the ${normalizedServiceLabel} at ${requestUrl}. Make sure the local service is running, then run again.`
            : `Could not reach the ${normalizedServiceLabel}. Make sure the local service is running, then run again.`;
    }
    const timeoutMatch = strippedText.match(/(?:Post|GET|PUT|PATCH|DELETE)\s+"([^"]+)".*?(?:context deadline exceeded|timeout)/i);
    if (timeoutMatch) {
        const requestUrl = normalizeRequestUrl(timeoutMatch[1] || "");
        return requestUrl
            ? `The ${normalizedServiceLabel} at ${requestUrl} did not respond in time. Try again after the service is available.`
            : `The ${normalizedServiceLabel} did not respond in time. Try again after the service is available.`;
    }
    return strippedText || "Unexpected error";
}
