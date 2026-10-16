// This marker selects the server-issued delivery protocol. It is provenance,
// never a client-side grant: every data operation must be verified by its host.
export function canonicalSelectionBinding(window = {}) {
    const binding = window?.selectionBinding || window?.inlineMetadata?.selectionBinding;
    const actor = binding?.actor;
    return binding && typeof binding === 'object'
        && actor && typeof actor === 'object'
        && typeof actor.issuer === 'string' && actor.issuer.length > 0
        && typeof actor.subject === 'string' && actor.subject.length > 0
        && typeof binding.instanceId === 'string' && binding.instanceId.length > 0
        && typeof binding.parametersDigest === 'string' && binding.parametersDigest.length > 0
        && typeof binding.token === 'string' && binding.token.length > 0
        ? binding : null;
}

// Canonical data validation retains local form/selection constraints. Business
// authorization leaves are display hints and the managing MCP owns the decision.
export function withoutAuthorizationValidationHints(condition) {
    if (!condition || typeof condition !== 'object') return condition;
    const field = String(condition.field || condition.selector || condition.key || '');
    const businessPath = /^(?:resource\.capabilities|globalCapabilities|principal\.(?:roles|features)|account\.(?:capabilities|roles|features))(?:\.|$)/;
    if (String(condition.source || '').toLowerCase() === 'authorization' && businessPath.test(field)) return null;
    for (const operator of ['all', 'any']) {
        if (!Array.isArray(condition[operator])) continue;
        const children = condition[operator].map(withoutAuthorizationValidationHints).filter(child => child != null);
        return children.length ? {...condition, [operator]: children} : null;
    }
    if (condition.not) {
        const child = withoutAuthorizationValidationHints(condition.not);
        return child ? {...condition, not: child} : null;
    }
    return condition;
}
