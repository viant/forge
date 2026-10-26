const text = value => String(value || "").trim();
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

export function hostedReportResource(container) {
    const parameters = hostedReportParameters(container);
    return parameters.reportResource || parameters.resolvedResource || null;
}
export function hostedReportParameters(container) {
    const config = container?.dashboard?.reportBuilder || container?.reportBuilder || {};
    const parameters = container?.parameters || {};
    // Authored pin and capabilities stay together; caller input supplies only scope.
    return config.reportResource
        ? {...config, ...(parameters.prefill ? {prefill: parameters.prefill} : {}), ...(parameters.runOverride ? {runOverride: parameters.runOverride} : {})}
        : parameters;
}
export function buildReportBuilderResourceSaveRequest(request, {current = null, defaults = null, idempotencyKey = globalThis.crypto?.randomUUID?.()} = {}) {
    if (!idempotencyKey) throw new Error("Report mutation identity is unavailable.");
    const pin = current?.resource;
    if (pin) {
        if (pin.kind !== "working" || !Number.isSafeInteger(current.rowEtag) || current.rowEtag <= 0 || !Number.isSafeInteger(current.draftRevision) || current.draftRevision <= 0) throw new Error("Refresh the mutable report draft before saving.");
        let definition;
        const envelope = current.resourceDefinition;
        if (envelope?.format === "forge.authoredReport") {
            definition = {...clone(envelope), reportDocument: clone(request.reportDocument)};
        }
        return {...request, artifactRef: pin.uri, reportId: pin.uri, resource: {uri: pin.uri, revision: "working"}, resolvedResource: clone(pin), idempotencyKey, expectedRowEtag: current.rowEtag, expectedDraftRevision: current.draftRevision, expectedContentFingerprint: pin.contentFingerprint, ...(definition ? {definition} : {})};
    }
    const namespace = text(defaults?.namespace), workspaceId = text(defaults?.workspaceId);
    if (!/^[A-Za-z0-9._-]{1,64}$/.test(namespace) || [".",".."].includes(namespace) || !workspaceId) throw new Error("A report namespace and workspace must be configured before saving a new report.");
    const stem = text(request.reportDocument?.id || request.title).replace(/[^A-Za-z0-9._-]/g,"-").slice(0,40) || "report";
    const suffix = idempotencyKey.replace(/[^A-Za-z0-9]/g,"").slice(0,12);
    const uri = `report://${namespace}/${stem}-${suffix}`;
    return {...request, artifactRef: uri, reportId: uri, resource: {uri}, workspaceId, idempotencyKey};
}

export function buildReportResourceRunRequest(pin, parameters = {}) {
    if (!pin?.uri?.startsWith("report://") || !["working","stamped"].includes(pin.kind) || !pin.contentFingerprint || !pin.authorityBinding) throw new Error("Selected report resource is invalid.");
    const selected = parameters.runOverride || parameters.prefill || {};
    const choices=parameters.chartMetricSelections;
    return {resource:{uri:pin.uri,revision:pin.kind === "working" ? "working" : pin.revision},resolvedResource:clone(pin),parameters:clone(selected),...(choices && Object.keys(choices).length ? {chartMetricSelections:clone(choices)} : {})};
}
export function validateReportResourceRunResult(result, expected, chartMetricSelections = {}, {fillOnly = false} = {}) {
    if (!result?.resource || ["providerIdentity","uri","kind","revision","contentFingerprint","authorityBinding","validUntil"].some(field => (expected?.[field] ?? "") !== (result.resource[field] ?? "")) || !result.reportSpec || !result.reportFill || (fillOnly !== true && !result.reportPrint)) throw new Error("The report service did not return the selected report run.");
    for (const [id,choice] of Object.entries(chartMetricSelections || {})) {
        const applied = result.reportSpec.blocks?.find(block=>block.id===id)?.chartSpec?.metricSelection;
        if (!applied || applied.primaryField!==choice.primaryField || applied.secondaryField!==choice.secondaryField) throw new Error("The report service did not retain the selected chart metrics.");
    }
    return result;
}

export function resourceEditorDocument(saved) {
    const definition = saved.resourceDefinition;
    if (definition?.format !== "forge.authoredReport" || !Array.isArray(definition.reportDocument?.blocks)) throw new Error("This report requires its complete authored definition for visual editing.");
    return {...clone(definition.reportDocument), blocks:[{id:"__resourceBuilder",kind:"reportBuilderBlock",source:{dataSourceRef:definition.builderDefinition?.dataSourceRef},config:clone(definition.builderDefinition?.reportBuilder || {}),state:clone(definition.state || {})},...clone(definition.reportDocument.blocks)]};
}
export function resourceEditorDefinition(saved, report) {
    const definition = clone(saved.resourceDefinition);
    if (definition?.format !== "forge.authoredReport") throw new Error("A complete authored definition is required.");
    const builder = report.blocks?.find(block=>block.id === "__resourceBuilder" && block.kind === "reportBuilderBlock");
    if (!builder) throw new Error("The trusted report builder binding is missing.");
    definition.reportDocument={...clone(report),blocks:clone(report.blocks.filter(block=>block.id !== "__resourceBuilder"))};
    definition.state=clone(builder.state || definition.state);
    return definition;
}
