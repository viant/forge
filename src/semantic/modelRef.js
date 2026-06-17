import { normalizeSemanticString } from "./modelSchema.js";

const MODEL_REF_PATTERN = /^model:\/\/(?<path>[A-Za-z0-9._/-]+?)(?:@(?<version>[A-Za-z0-9._-]+))?$/;

export function parseSemanticModelRef(value = "") {
    const input = normalizeSemanticString(value);
    if (!input) {
        return null;
    }
    const match = MODEL_REF_PATTERN.exec(input);
    if (!match?.groups?.path) {
        return null;
    }
    const segments = match.groups.path
        .split("/")
        .map((entry) => normalizeSemanticString(entry))
        .filter(Boolean);
    if (segments.length < 2) {
        return null;
    }
    const model = segments[segments.length - 1];
    const namespace = segments.slice(0, -1).join("/");
    const version = normalizeSemanticString(match.groups.version || "");
    return {
        scheme: "model",
        namespace,
        model,
        version: version || "",
        ref: formatSemanticModelRef({ namespace, model, version }),
    };
}

export function formatSemanticModelRef(parts = {}) {
    const namespace = normalizeSemanticString(parts.namespace);
    const model = normalizeSemanticString(parts.model);
    const version = normalizeSemanticString(parts.version);
    if (!namespace || !model) {
        return "";
    }
    return `model://${namespace}/${model}${version ? `@${version}` : ""}`;
}

export function normalizeSemanticModelRef(value = "") {
    return parseSemanticModelRef(value)?.ref || "";
}

export function isSemanticModelRef(value = "") {
    return !!parseSemanticModelRef(value);
}
