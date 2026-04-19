import {
    defaultAgentModel,
    defaultAgentTools,
    normalizeString,
} from './chatCommandCenterHelpers.js';
import {
    formatCostCompact,
    formatTokensCompact,
} from './chatLegacyHelpers.js';

export function buildUsageSummary(usageSnapshot = {}) {
    const costText = formatCostCompact(usageSnapshot?.cost ?? usageSnapshot?.Cost);
    const tokensText = formatTokensCompact(usageSnapshot?.totalTokens ?? usageSnapshot?.TotalTokens ?? usageSnapshot?.total);
    const parts = [];
    if (costText) parts.push(`Cost ${costText}`);
    if (tokensText) parts.push(`Tokens ${tokensText}`);
    return parts.join(' • ');
}

export function buildUsageTooltip(usageSnapshot = {}) {
    const tokensWithCache = normalizeString(usageSnapshot?.tokensWithCacheText);
    const costText = normalizeString(usageSnapshot?.costText);
    const pieces = [];
    if (costText) pieces.push(`Cost: ${costText}`);
    if (tokensWithCache) pieces.push(`Tokens: ${tokensWithCache}`);
    return pieces.join('\n');
}

export function buildToolsLabel(currentTools = []) {
    if (!Array.isArray(currentTools) || currentTools.length === 0) return '';
    if (currentTools.length <= 2) return currentTools.join(', ');
    return `${currentTools.length} tools`;
}

export function clearCommandCenterChip({
    chip,
    commandCenterDefaults = {},
    currentAgent = '',
    currentModel = '',
    metaSnapshot = {},
    events = null,
    metaCtx = null,
    context = null,
    handleAgentChange = () => {},
    handleModelChange = () => {},
    handleToolsChange = () => {},
    handleReasoningChange = () => {},
}) {
    const id = normalizeString(chip?.id);
    if (!id) return false;
    const defAgent = normalizeString(commandCenterDefaults?.agent) || currentAgent;
    const defModel = normalizeString(commandCenterDefaults?.model) || currentModel;

    if (events?.onClearOverride?.isDefined?.()) {
        events.onClearOverride.execute({ context: metaCtx || context, chip: id });
        return true;
    }

    if (id === 'agent') {
        handleAgentChange(defAgent);
        return true;
    }
    if (id === 'model') {
        const fallback = defaultAgentModel(metaSnapshot, currentAgent) || defModel;
        handleModelChange(fallback);
        return true;
    }
    if (id === 'tools') {
        handleToolsChange(defaultAgentTools(metaSnapshot, currentAgent));
        return true;
    }
    if (id === 'reasoningEffort') {
        handleReasoningChange('');
        return true;
    }
    return false;
}
