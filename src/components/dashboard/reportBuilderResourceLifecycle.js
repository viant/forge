const text = value => String(value || "").trim();
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

export function hostedReportParameters(container) {
    const config = container?.dashboard?.reportBuilder || container?.reportBuilder || {};
    const parameters = container?.parameters || {};
    // Authored pin and capabilities stay together; caller input supplies only scope.
    return config.reportResource
        ? {...config, ...(parameters.prefill ? {prefill: parameters.prefill} : {}), ...(parameters.runOverride ? {runOverride: parameters.runOverride} : {})}
        : parameters;
}
export function hostedReportResource(container) {
    const parameters = hostedReportParameters(container);
    return parameters.reportResource || parameters.resolvedResource || null;
}
export function buildReportResourceRunRequest(pin, parameters = {}) {
    if (!pin?.uri?.startsWith("report://") || !["working","stamped"].includes(pin.kind) || !pin.contentFingerprint || !pin.authorityBinding) throw new Error("Selected report resource is invalid.");
    const selected = parameters.runOverride || parameters.prefill || {};
    return {resource:{uri:pin.uri,revision:pin.kind === "working" ? "working" : pin.revision},resolvedResource:clone(pin),parameters:clone(selected)};
}
export function validateReportResourceRunResult(result, expected) {
    if (!result?.resource || ["providerIdentity","uri","kind","revision","contentFingerprint","authorityBinding","validUntil"].some(field => (expected?.[field] ?? "") !== (result.resource[field] ?? "")) || !result.reportSpec || !result.reportFill || !result.reportPrint) throw new Error("The report service did not return the selected report run.");
    return result;
}
