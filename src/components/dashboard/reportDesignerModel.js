import { resolveReportDocumentBuilderContext } from "../../reporting/reportDocumentModel.js";

const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
const text = (value) => String(value ?? "").trim();
const isObject = (value) => !!value && typeof value === "object" && !Array.isArray(value);
const stateFields = ["selectedDimensions", "selectedMeasures", "primaryMeasure", "viewMode", "chartSpec", "orderField", "orderDir", "pageSize", "scopeParams", "reportOptions", "reportFilterRefreshMode", "drillMetadata", "calculatedFields", "tableCalculations"];
const authoredFields = new Set(["title", "subtitle", "description", "kind", "id", "datasetRef", "markdown", "columns", "chartSpec", "valueField", "valueLabel", "childBlockIds", "sectionIds", "blockIds", "defaultSectionId", "navigationLabel", "content", "runtime", "paramIds", "mode", "placement", "width", "span", "items"]);

export function prepareEmbeddedReport(report, catalog = {}) {
    if (isObject(report) && !Array.isArray(report.blocks) && Array.isArray(report.sections)) {
        return { valid: false, reason: "This legacy sections report is read only in the visual designer. Open it in the host source editor." };
    }
    if (!isObject(report) || !Array.isArray(report.blocks)) return { valid: false, reason: "A native report document with blocks is required." };
    const builder = report.blocks.find((block) => block?.kind === "reportBuilderBlock");
    const catalogDatasets = Array.isArray(catalog?.datasets) ? catalog.datasets : [];
    const authoredDatasets = Array.isArray(report.datasets) ? report.datasets : [];
    const authoredIDs = new Set(authoredDatasets.map((dataset) => text(dataset?.id)).filter(Boolean));
    const mergedDatasets = [...catalogDatasets.filter((dataset) => !authoredIDs.has(text(dataset?.id))), ...authoredDatasets];
    const designDocument = mergedDatasets.length ? { ...report, datasets: mergedDatasets } : report;
    const resolved = resolveReportDocumentBuilderContext(designDocument, { ...(builder?.config || {}), ...(catalog || {}) }, builder?.state || {});
    const config = { ...(catalog || {}), ...(resolved.config || {}) };
    const state = {
        ...(resolved.state || {}),
        ...(Array.isArray(report.scope?.params) ? { scopeParams: {
            ...Object.fromEntries(report.scope.params.filter((param) => text(param?.id)).map((param) => [param.id, clone(param.value)])),
            ...(resolved.state?.scopeParams || {}),
        } } : {}),
        reportDocumentTitle: report.title || "Report",
        reportDocumentSubtitle: report.subtitle || "",
        reportDocumentDescription: report.description || "",
        reportDocumentBlocks: clone(report.blocks.filter((block) => block?.kind !== "reportBuilderBlock")),
        reportDocumentLayout: clone(report.layout || { type: "stack", items: [] }),
    };
    return { valid: true, config, state, builder, report };
}

export function applyEmbeddedReportChange(report, state, config) {
    const source = clone(report);
    const original = new Map(source.blocks.map((block) => [text(block?.id), block]));
    const edited = Array.isArray(state?.reportDocumentBlocks) ? state.reportDocumentBlocks : [];
    source.blocks = edited.map((block) => {
        const previous = original.get(text(block.id));
        const unknown = Object.fromEntries(Object.entries(previous || {}).filter(([key]) => !authoredFields.has(key)));
        return { ...unknown, ...clone(block) };
    });
    const builder = report.blocks.find((block) => block?.kind === "reportBuilderBlock");
    if (builder) {
        const builderPosition = report.blocks.findIndex((block) => block?.kind === "reportBuilderBlock");
        const nextBuilder = clone(builder);
        const nextState = { ...(nextBuilder.state || {}) };
        stateFields.forEach((key) => { if (state?.[key] !== undefined) nextState[key] = clone(state[key]); });
        nextBuilder.state = nextState;
        // Source edits in the Design manager are host-owned declarations.
        if (Array.isArray(nextBuilder.config?.dataSources) && Array.isArray(config?.dataSources)
            && JSON.stringify(nextBuilder.config.dataSources) !== JSON.stringify(config.dataSources)) {
            nextBuilder.config = { ...nextBuilder.config, dataSources: clone(config.dataSources) };
        }
        source.blocks.splice(Math.min(builderPosition, source.blocks.length), 0, nextBuilder);
    }
    source.title = text(state?.reportDocumentTitle) || source.title;
    if (state?.reportDocumentSubtitle !== undefined) source.subtitle = state.reportDocumentSubtitle;
    if (state?.reportDocumentDescription !== undefined) source.description = state.reportDocumentDescription;
    if (state?.reportDocumentLayout) source.layout = { ...(source.layout || {}), ...clone(state.reportDocumentLayout) };
    if (isObject(state?.scopeParams) && Array.isArray(source.scope?.params)) {
        const remaining = new Set(Object.keys(state.scopeParams));
        source.scope.params = source.scope.params.map((param) => {
            if (!remaining.has(param.id)) return param;
            remaining.delete(param.id);
            return { ...param, value: clone(state.scopeParams[param.id]) };
        });
        remaining.forEach((id) => source.scope.params.push({ id, value: clone(state.scopeParams[id]) }));
    }
    return source;
}

export function validateProviderDatasetDeclaration(value) {
    if (!isObject(value) || !text(value.id) || !text(value.dataSourceRef)) return "A dataset ID and data source reference are required.";
    if (!text(value.source?.id) || !text(value.source?.version)) return "An exact source ID and version are required.";
    if (!text(value.source?.serviceRef) || !text(value.source?.toolRef)) return "An explicit service and tool binding are required.";
    if (!isObject(value.resultContract) || !Array.isArray(value.columns)) return "A result contract and columns are required.";
    return "";
}

export function validateProviderSourceSelection(selected, described, declaration) {
    if (text(selected?.id) !== text(described?.id) || text(selected?.version) !== text(described?.version)) {
        return "Source identity or version changed. Discover sources again.";
    }
    const error = validateProviderDatasetDeclaration(declaration);
    if (error) return error;
    if (text(declaration.source.id) !== text(described.id) || text(declaration.source.version) !== text(described.version)) {
        return "Validated dataset identity or version differs from the described source.";
    }
    return "";
}

export function addEmbeddedDataset(report, declaration) {
    const error = validateProviderDatasetDeclaration(declaration);
    if (error) return { valid: false, error, report };
    const datasets = Array.isArray(report.datasets) ? report.datasets : [];
    if (datasets.some((entry) => text(entry.id) === text(declaration.id))) return { valid: false, error: "This dataset ID already exists.", report };
    return { valid: true, report: { ...clone(report), datasets: [...clone(datasets), clone(declaration)] } };
}

export function replaceEmbeddedDataset(report, declaration) {
    const error = validateProviderDatasetDeclaration(declaration);
    if (error) return { valid: false, error, report };
    const datasets = Array.isArray(report.datasets) ? report.datasets : [];
    const index = datasets.findIndex((entry) => text(entry.id) === text(declaration.id));
    if (index < 0) return { valid: false, error: "This dataset is not declared.", report };
    const next = clone(datasets);
    next[index] = { ...next[index], ...clone(declaration) };
    return { valid: true, report: { ...clone(report), datasets: next } };
}
