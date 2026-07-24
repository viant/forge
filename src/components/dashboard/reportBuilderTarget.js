function normalizeString(value = "") {
    return String(value || "").trim();
}

function isPlainObject(value = null) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function cloneValue(value = null) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function applyReportBuilderTarget(document = null, builderTarget = null) {
    if (!isPlainObject(document) || !isPlainObject(builderTarget)) {
        return cloneValue(document);
    }
    const target = {
        kind: "dashboard.reportBuilder",
        containerId: normalizeString(builderTarget.containerId),
        stateKey: normalizeString(builderTarget.stateKey),
        dataSourceRef: normalizeString(builderTarget.dataSourceRef),
    };
    return {
        ...cloneValue(document),
        blocks: (Array.isArray(document.blocks) ? document.blocks : []).map((block) => (
            normalizeString(block?.kind) === "reportBuilderBlock"
                ? { ...cloneValue(block), source: target }
                : cloneValue(block)
        )),
    };
}
