import { ensureStringArray, normalizeString } from './chatCommandCenterHelpers.js';

function conversationDataSource(context = null) {
    try {
        return context?.Context?.('conversations')?.handlers?.dataSource || null;
    } catch (_) {
        return null;
    }
}

function safeSetFormField(dataSource, id, value) {
    if (!dataSource || !id) return;
    try {
        dataSource.setFormField?.({ item: { id }, value });
    } catch (_) {}
}

function safeSetFormData(dataSource, values) {
    if (!dataSource || !values || typeof values !== 'object') return;
    try {
        dataSource.setFormData?.({ values });
    } catch (_) {}
}

export function applyAgentSelection({ agentID, metaDS, metaSnapshot = {}, context = null }) {
    if (!metaDS) return;
    const key = normalizeString(agentID);
    const form = metaDS.peekFormData?.() || metaSnapshot || {};
    const agentInfo = form?.agentInfo || metaSnapshot?.agentInfo || {};
    const optionInfo = (Array.isArray(form?.agentOptions) ? form.agentOptions : Array.isArray(metaSnapshot?.agentOptions) ? metaSnapshot.agentOptions : [])
        .find((entry) => normalizeString(entry?.value ?? entry?.id) === key) || {};
    const info = { ...optionInfo, ...(agentInfo?.[key] || {}) };
    const preferredModel = normalizeString(info?.modelRef || info?.model || '');
    const convDS = conversationDataSource(context);

    if (!key) {
        const next = {
            ...(metaDS.peekFormData?.() || {}),
            agent: '',
            model: normalizeString(form?.defaults?.model || ''),
            tool: undefined,
        };
        safeSetFormData(metaDS, next);
        safeSetFormField(convDS, 'agent', '');
        safeSetFormField(convDS, 'model', next.model || '');
        return;
    }

    safeSetFormField(metaDS, 'agent', key);
    if (preferredModel) {
        safeSetFormField(metaDS, 'model', preferredModel);
    }

    safeSetFormField(convDS, 'agent', key);
    const name = normalizeString(info?.name || info?.Name);
    if (name) safeSetFormField(convDS, 'agentName', name);
    if (preferredModel) safeSetFormField(convDS, 'model', preferredModel);

    const agentValues = { ...info };
    if (preferredModel) agentValues.model = preferredModel;
    delete agentValues.tools;
    delete agentValues.tool;

    const prev = metaDS.peekFormData?.() || {};
    safeSetFormData(metaDS, { ...prev, ...agentValues, tool: undefined });
}

export function applyModelSelection({ modelID, metaDS, context = null }) {
    const id = normalizeString(modelID);
    safeSetFormField(metaDS, 'model', id);
    safeSetFormField(conversationDataSource(context), 'model', id);
}

export function applyReasoningSelection({ effort, metaDS }) {
    safeSetFormField(metaDS, 'reasoningEffort', normalizeString(effort));
}

export function applyToolsSelection({ toolNames, metaDS }) {
    safeSetFormField(metaDS, 'tool', ensureStringArray(toolNames));
}

export function applyAutoSelectToolsSelection({ enabled, metaDS, context = null }) {
    const next = !!enabled;
    try {
        if (context?.resources) {
            context.resources.autoSelectToolsTouched = true;
        }
    } catch (_) {}
    safeSetFormField(metaDS, 'autoSelectTools', next);
    safeSetFormField(conversationDataSource(context), 'autoSelectTools', next);
}
