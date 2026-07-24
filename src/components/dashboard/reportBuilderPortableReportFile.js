import { applyReportBuilderTarget } from "./reportBuilderTarget.js";

const REPORT_FILE_KIND = "forge.reporting.reportFile";
const REPORT_FILE_SCHEMA_VERSION = 1;

function normalizeString(value = "") {
    return String(value || "").trim();
}

function isPlainObject(value = null) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function cloneValue(value = null) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

const OMITTED_KEYS = new Set([
    "authorization",
    "authtoken",
    "cookie",
    "cookies",
    "credentials",
    "diagnostics",
    "error",
    "errors",
    "password",
    "reportdocumentsavedpayloads",
    "reportdocumenttemplates",
    "reportfill",
    "reportprint",
    "rows",
    "runtimeartifact",
    "runtimeerrors",
    "runtimerows",
    "secret",
    "secrets",
    "token",
]);

function shouldOmitKey(key = "") {
    const normalized = normalizeString(key);
    if (!normalized) {
        return false;
    }
    if (OMITTED_KEYS.has(normalized.toLowerCase())) {
        return true;
    }
    return /(?:authorization|cookie|credential|password|secret|token)/i.test(normalized);
}

function isEphemeralUrl(value = "") {
    return /^(?:scratchpad|file|javascript|data):/i.test(normalizeString(value));
}

export function sanitizeReportBuilderPortableValue(value = null) {
    if (Array.isArray(value)) {
        return value.map((entry) => sanitizeReportBuilderPortableValue(entry));
    }
    if (!isPlainObject(value)) {
        return typeof value === "string" && isEphemeralUrl(value) ? "" : value;
    }
    return Object.entries(value).reduce((result, [key, entry]) => {
        if (shouldOmitKey(key)) {
            return result;
        }
        const sanitized = sanitizeReportBuilderPortableValue(entry);
        if (sanitized !== undefined && sanitized !== "") {
            result[key] = sanitized;
        }
        return result;
    }, {});
}

function collectBlockIds(blocks = [], ids = []) {
    (Array.isArray(blocks) ? blocks : []).forEach((block) => {
        if (!isPlainObject(block)) {
            return;
        }
        const id = normalizeString(block.id);
        if (id) {
            ids.push(id);
        }
        Object.entries(block).forEach(([key, value]) => {
            if (key === "blocks" && Array.isArray(value)) {
                collectBlockIds(value, ids);
                return;
            }
            if (Array.isArray(value)) {
                value.forEach((entry) => {
                    if (isPlainObject(entry) && Array.isArray(entry.blocks)) {
                        collectBlockIds(entry.blocks, ids);
                    }
                });
            }
        });
    });
    return ids;
}

function collectLayoutBlockRefs(value = null, refs = []) {
    if (Array.isArray(value)) {
        value.forEach((entry) => collectLayoutBlockRefs(entry, refs));
        return refs;
    }
    if (!isPlainObject(value)) {
        return refs;
    }
    const blockId = normalizeString(value.blockId);
    if (blockId) {
        refs.push(blockId);
    }
    if (Array.isArray(value.blockIds)) {
        value.blockIds.forEach((entry) => {
            const referencedBlockId = normalizeString(entry);
            if (referencedBlockId) {
                refs.push(referencedBlockId);
            }
        });
    }
    Object.values(value).forEach((entry) => collectLayoutBlockRefs(entry, refs));
    return refs;
}

function collectDatasetRefs(value = null, refs = []) {
    if (Array.isArray(value)) {
        value.forEach((entry) => collectDatasetRefs(entry, refs));
        return refs;
    }
    if (!isPlainObject(value)) {
        return refs;
    }
    const datasetRef = normalizeString(value.datasetRef);
    if (datasetRef) {
        refs.push(datasetRef);
    }
    Object.values(value).forEach((entry) => collectDatasetRefs(entry, refs));
    return refs;
}

function findUnsafeSourceValue(value = null, path = "") {
    if (Array.isArray(value)) {
        for (let index = 0; index < value.length; index += 1) {
            const found = findUnsafeSourceValue(value[index], `${path}[${index}]`);
            if (found) {
                return found;
            }
        }
        return "";
    }
    if (!isPlainObject(value)) {
        return typeof value === "string" && isEphemeralUrl(value) ? path || "value" : "";
    }
    for (const [key, entry] of Object.entries(value)) {
        if (shouldOmitKey(key)) {
            return path ? `${path}.${key}` : key;
        }
        const found = findUnsafeSourceValue(entry, path ? `${path}.${key}` : key);
        if (found) {
            return found;
        }
    }
    return "";
}

export function validateReportBuilderPortableReportFile(file = null) {
    if (!isPlainObject(file)) {
        return { valid: false, code: "invalidShape", message: "The report file must contain a JSON object." };
    }
    if (normalizeString(file.kind) !== REPORT_FILE_KIND) {
        return { valid: false, code: "invalidKind", message: `Expected report file kind ${REPORT_FILE_KIND}.` };
    }
    if (Number(file.schemaVersion || 0) !== REPORT_FILE_SCHEMA_VERSION) {
        return { valid: false, code: "unsupportedSchemaVersion", message: `Unsupported report file schema version ${file.schemaVersion || 0}.` };
    }
    if (!isPlainObject(file.reportDocument) || normalizeString(file.reportDocument.kind) !== "reportDocument") {
        return { valid: false, code: "invalidReportDocument", message: "The report file does not contain a valid ReportDocument." };
    }
    if (!isPlainObject(file.reportSpec) || normalizeString(file.reportSpec.kind) !== "reportSpec") {
        return { valid: false, code: "invalidReportSpec", message: "The report file does not contain a valid ReportSpec." };
    }
    const unsafePath = findUnsafeSourceValue(file);
    if (unsafePath) {
        return { valid: false, code: "unsafePortableValue", message: `The report file contains runtime or sensitive data at ${unsafePath}.` };
    }
    const blockIds = collectBlockIds(file.reportDocument.blocks);
    const duplicateBlockId = blockIds.find((id, index) => blockIds.indexOf(id) !== index);
    if (duplicateBlockId) {
        return { valid: false, code: "duplicateBlockId", message: `The report file contains duplicate block id ${duplicateBlockId}.` };
    }
    const knownBlockIds = new Set(blockIds);
    const authoredBlockRefs = [
        ...collectLayoutBlockRefs(file.reportDocument.layout),
        ...collectLayoutBlockRefs(file.reportDocument.tabs),
    ];
    const unresolvedLayoutRef = authoredBlockRefs
        .find((blockId) => !knownBlockIds.has(blockId));
    if (unresolvedLayoutRef) {
        return { valid: false, code: "unresolvedLayoutBlock", message: `The report layout references unavailable block ${unresolvedLayoutRef}.` };
    }
    const datasetIds = (Array.isArray(file.reportSpec.datasets) ? file.reportSpec.datasets : [])
        .map((dataset) => normalizeString(dataset?.id))
        .filter(Boolean);
    const duplicateDatasetId = datasetIds.find((id, index) => datasetIds.indexOf(id) !== index);
    if (duplicateDatasetId) {
        return { valid: false, code: "duplicateDatasetId", message: `The report file contains duplicate dataset id ${duplicateDatasetId}.` };
    }
    const knownDatasetIds = new Set(datasetIds);
    const unresolvedDatasetRef = collectDatasetRefs(file.reportDocument.blocks)
        .find((datasetRef) => !knownDatasetIds.has(datasetRef));
    if (unresolvedDatasetRef) {
        return { valid: false, code: "unresolvedDatasetRef", message: `The report file references unavailable dataset ${unresolvedDatasetRef}.` };
    }
    return { valid: true, code: "", message: "" };
}

export function buildReportBuilderPortableReportFile(savedReportPayload = null) {
    if (!isPlainObject(savedReportPayload?.reportDocument) || !isPlainObject(savedReportPayload?.reportSpec)) {
        return null;
    }
    const sourceRef = isPlainObject(savedReportPayload?.sourceSession?.sourceRef)
        ? sanitizeReportBuilderPortableValue(savedReportPayload.sourceSession.sourceRef)
        : null;
    const builderTarget = isPlainObject(savedReportPayload?.sourceSession?.builderTarget)
        ? sanitizeReportBuilderPortableValue(savedReportPayload.sourceSession.builderTarget)
        : null;
    const file = sanitizeReportBuilderPortableValue({
        schemaVersion: REPORT_FILE_SCHEMA_VERSION,
        kind: REPORT_FILE_KIND,
        title: normalizeString(savedReportPayload.title || savedReportPayload.reportDocument.title || "Report") || "Report",
        builderRef: sourceRef,
        reportDocument: applyReportBuilderTarget(savedReportPayload.reportDocument, builderTarget),
        reportSpec: cloneValue(savedReportPayload.reportSpec),
        ...(savedReportPayload.semanticBindingViewState
            ? { semanticBindingViewState: cloneValue(savedReportPayload.semanticBindingViewState) }
            : {}),
        ...(savedReportPayload.sourceSession
            ? { sourceSession: cloneValue(savedReportPayload.sourceSession) }
            : {}),
    });
    return validateReportBuilderPortableReportFile(file).valid ? file : null;
}

export function parseReportBuilderPortableReportFile(file = null) {
    const validation = validateReportBuilderPortableReportFile(file);
    if (!validation.valid) {
        return { ...validation, payload: null };
    }
    const title = normalizeString(file.title || file.reportDocument?.title || file.reportDocument?.id || "Report") || "Report";
    return {
        valid: true,
        code: "",
        message: "",
        payload: {
            version: 1,
            kind: "reportBuilder.savedReportPayload",
            title,
            reportDocument: cloneValue(file.reportDocument),
            reportSpec: cloneValue(file.reportSpec),
            ...(file.semanticBindingViewState ? { semanticBindingViewState: cloneValue(file.semanticBindingViewState) } : {}),
            sourceSession: {
                ...(isPlainObject(file.sourceSession) ? cloneValue(file.sourceSession) : {}),
                importedLocal: true,
                unsavedDraft: true,
            },
        },
    };
}

export const REPORT_BUILDER_PORTABLE_REPORT_FILE_KIND = REPORT_FILE_KIND;
export const REPORT_BUILDER_PORTABLE_REPORT_FILE_SCHEMA_VERSION = REPORT_FILE_SCHEMA_VERSION;
