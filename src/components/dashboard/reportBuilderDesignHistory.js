const keys = ["reportDocumentBlocks", "reportDocumentLayout"];
export function captureDesignDocument(state = {}) {
    return JSON.parse(JSON.stringify(Object.fromEntries(keys.filter((key) => state[key] !== undefined).map((key) => [key, state[key]]))));
}
export function designDocumentsEqual(left, right) {
    return JSON.stringify(captureDesignDocument(left)) === JSON.stringify(captureDesignDocument(right));
}
export function restoreDesignDocument(state, snapshot) {
    const next = { ...state };
    keys.forEach((key) => delete next[key]);
    return { ...next, ...captureDesignDocument(snapshot) };
}
