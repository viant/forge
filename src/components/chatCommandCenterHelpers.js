export const normalizeString = (value) => String(value || '').trim();

export const normalizeBool = (value) => {
    if (value === true || value === false) return value;
    if (value === undefined || value === null) return false;
    if (typeof value === 'number') return value === 1;
    const text = String(value).trim().toLowerCase();
    if (text === 'true' || text === '1' || text === 'yes' || text === 'on') return true;
    if (text === 'false' || text === '0' || text === 'no' || text === 'off') return false;
    return false;
};

export const ensureStringArray = (value) => {
    if (Array.isArray(value)) return value.map((entry) => String(entry)).filter(Boolean);
    if (value === undefined || value === null || value === '') return [];
    return [String(value)];
};

export function findAgentOption(metaSnapshot = {}, agentID = '') {
    const id = normalizeString(agentID);
    if (!id) return {};
    return (Array.isArray(metaSnapshot?.agentOptions) ? metaSnapshot.agentOptions : [])
        .find((entry) => {
            const value = normalizeString(entry?.value ?? entry?.id);
            const label = normalizeString(entry?.label ?? entry?.name ?? entry?.title);
            return value === id || label === id;
        }) || {};
}

export function findAgentInfo(metaSnapshot = {}, agentID = '') {
    const id = normalizeString(agentID);
    if (!id) return {};
    const mapped = metaSnapshot?.agentInfo?.[id];
    if (mapped) return mapped;
    return (Array.isArray(metaSnapshot?.agentInfos) ? metaSnapshot.agentInfos : [])
        .find((entry) => {
            const value = normalizeString(entry?.id ?? entry?.value);
            const label = normalizeString(entry?.label ?? entry?.name ?? entry?.title);
            return value === id || label === id;
        }) || {};
}

export function defaultAgentTools(metaSnapshot = {}, agentID = '') {
    const optionInfo = findAgentOption(metaSnapshot, agentID);
    const info = { ...optionInfo, ...findAgentInfo(metaSnapshot, agentID) };
    return ensureStringArray(info?.tools);
}

export function defaultAgentModel(metaSnapshot = {}, agentID = '') {
    const optionInfo = findAgentOption(metaSnapshot, agentID);
    const info = { ...optionInfo, ...findAgentInfo(metaSnapshot, agentID) };
    return normalizeString(info?.modelRef || info?.model);
}

export function resolveCurrentModel(metaSnapshot = {}) {
    const commandCenterDefaults = metaSnapshot?.defaults || {};
    const currentAgent = normalizeString(metaSnapshot?.agent);
    const selectedAgentPreferredModel = defaultAgentModel(metaSnapshot, currentAgent);
    const rawCurrentModel = normalizeString(metaSnapshot?.model);
    const defaultModel = normalizeString(commandCenterDefaults?.model);
    if (!currentAgent || !selectedAgentPreferredModel) return rawCurrentModel;
    if (!rawCurrentModel || rawCurrentModel === defaultModel) return selectedAgentPreferredModel;
    return rawCurrentModel;
}

export function resolveQueuedCount(conversationSnapshot = {}) {
    const value = conversationSnapshot?.queuedCount;
    if (typeof value === 'number' && !Number.isNaN(value)) return value;
    const numeric = Number(value);
    if (!Number.isNaN(numeric) && Number.isFinite(numeric)) return numeric;
    return Array.isArray(conversationSnapshot?.queuedTurns) ? conversationSnapshot.queuedTurns.length : 0;
}

export function mergeQueuedTurns(localQueuedTurns = [], queuedTurns = []) {
    const seen = new Set();
    const merged = [];
    for (const entry of [...localQueuedTurns, ...queuedTurns]) {
        if (!entry || typeof entry !== 'object') continue;
        const key = normalizeString(entry?.id) || normalizeString(entry?.preview);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        merged.push(entry);
    }
    return merged;
}
