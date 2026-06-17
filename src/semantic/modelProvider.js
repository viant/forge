const REQUIRED_SEMANTIC_MODEL_PROVIDER_METHODS = [
    "listModels",
    "getModel",
    "validateSelection",
];

export function validateSemanticModelProvider(provider = null) {
    const missing = REQUIRED_SEMANTIC_MODEL_PROVIDER_METHODS.filter((method) => typeof provider?.[method] !== "function");
    return {
        valid: missing.length === 0,
        missing,
    };
}

export function hasSemanticModelProvider(provider = null) {
    return validateSemanticModelProvider(provider).valid;
}

export function createSemanticModelProvider(provider = {}) {
    const validation = validateSemanticModelProvider(provider);
    if (!validation.valid) {
        throw new Error(`Semantic model provider missing methods: ${validation.missing.join(", ")}`);
    }
    return {
        async listModels(namespace = "", options = {}) {
            return provider.listModels(namespace, options);
        },
        async getModel(modelRef = "", options = {}) {
            return provider.getModel(modelRef, options);
        },
        async validateSelection(modelRef = "", selection = {}, options = {}) {
            return provider.validateSelection(modelRef, selection, options);
        },
    };
}
