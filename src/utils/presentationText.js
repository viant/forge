const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
const UNICODE_REPLACEMENT_RUN = /\uFFFD+/g;

export function normalizePresentationText(value = "", { replacement = "?" } = {}) {
    let text = String(value ?? "")
        .replace(CONTROL_CHARACTERS, "")
        .replace(UNICODE_REPLACEMENT_RUN, replacement);
    try {
        text = text.normalize("NFC");
    } catch (_) {
        // Some embedded runtimes do not expose String#normalize. The sanitized
        // source text is still safe to present.
    }
    return text.replace(/\s+/g, " ").trim();
}

export function normalizePresentationClampConfig(value = null) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const lines = Number(value.lines);
    if (lines !== 1 && lines !== 2) return null;
    return {
        lines,
        maxCharacters: Math.max(4, Math.min(120, Number(value.maxCharacters) || 28)),
    };
}

function presentationGraphemes(value = "") {
    const text = normalizePresentationText(value);
    if (!text) return [];
    if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
        return Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text), (entry) => entry.segment);
    }
    return Array.from(text);
}

export function clampPresentationText(value = "", { lines = 1, maxCharacters = 28 } = {}) {
    const fullText = normalizePresentationText(value);
    const resolvedLines = lines === 2 ? 2 : 1;
    const resolvedMaxCharacters = Math.max(4, Math.min(120, Number(maxCharacters) || 28));
    const graphemes = presentationGraphemes(fullText);
    const totalLimit = resolvedLines * resolvedMaxCharacters;
    const truncated = graphemes.length > totalLimit;
    const visible = truncated ? [...graphemes.slice(0, Math.max(1, totalLimit - 1)), "…"] : graphemes;
    const result = [];
    for (let index = 0; index < visible.length; index += resolvedMaxCharacters) {
        result.push(visible.slice(index, index + resolvedMaxCharacters).join(""));
    }
    return {
        fullText,
        lines: result.slice(0, resolvedLines),
        truncated,
    };
}
