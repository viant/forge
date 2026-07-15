import { normalizeReportBuilderSemanticDiagnostics } from "./reportBuilderSemantic.js";
import { buildReportBuilderSemanticBindingViewState } from "./reportBuilderSemanticBindingViewState.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

function pluralize(count = 0, singular = "", plural = `${singular}s`) {
    const numeric = Number.isFinite(Number(count)) ? Number(count) : 0;
    return `${numeric} ${numeric === 1 ? singular : plural}`;
}

export function buildReportBuilderSemanticWorkspacePanelState({
    semanticSummary = null,
    binding = null,
    semanticStatus = null,
    semanticDiagnosticsNotice = null,
    semanticGovernanceNotice = null,
    modelLoading = false,
    modelError = "",
    modelRef = "",
} = {}) {
    const bindingViewState = buildReportBuilderSemanticBindingViewState({
        semanticSummary,
        binding,
    });
    const diagnostics = normalizeReportBuilderSemanticDiagnostics(semanticDiagnosticsNotice?.diagnostics);
    const governanceItems = (Array.isArray(semanticGovernanceNotice?.items) ? semanticGovernanceNotice.items : [])
        .map((item) => normalizeString(item))
        .filter(Boolean);
    const normalizedBindingMode = normalizeString(binding?.mode).toLowerCase();
    const hasSemanticState = !!bindingViewState
        || !!normalizeString(semanticStatus?.title)
        || !!normalizeString(semanticStatus?.message)
        || diagnostics.length > 0
        || governanceItems.length > 0;
    if (!hasSemanticState) {
        if (normalizedBindingMode !== "semantic") {
            return {
                tone: "info",
                eyebrow: "Data model",
                title: "No data model configured",
                description: "Use a data model to keep fields and filters consistent.",
                metaChips: [],
                semanticBindingTitle: "",
                semanticBindingChips: [],
                semanticBindingFieldGroups: [],
                diagnosticsTitle: "",
                diagnosticsDescription: "",
                diagnostics: [],
                governanceTitle: "",
                governanceItems: [],
            };
        }
        if (modelLoading) {
            return {
                tone: "info",
                eyebrow: "Data model",
                title: "Loading data model...",
                description: "Data-model details are still loading.",
                metaChips: ["Data model active", "Loading"],
                semanticBindingTitle: "",
                semanticBindingChips: [],
                semanticBindingFieldGroups: [],
                diagnosticsTitle: "",
                diagnosticsDescription: "",
                diagnostics: [],
                governanceTitle: "",
                governanceItems: [],
            };
        }
        if (normalizeString(modelError)) {
            return {
                tone: "danger",
                eyebrow: "Data model",
                title: "Data model failed to load",
                description: normalizeString(modelError),
                metaChips: ["Data model active", "Blocked"],
                semanticBindingTitle: "",
                semanticBindingChips: [],
                semanticBindingFieldGroups: [],
                diagnosticsTitle: "",
                diagnosticsDescription: "",
                diagnostics: [],
                governanceTitle: "",
                governanceItems: [],
            };
        }
        return {
            tone: "warning",
            eyebrow: "Data model",
            title: "Data model unavailable",
            description: "This report is using a data model, but its details are unavailable right now.",
            metaChips: ["Data model active", "Data model source unavailable"],
            semanticBindingTitle: "",
            semanticBindingChips: [],
            semanticBindingFieldGroups: [],
            diagnosticsTitle: "",
            diagnosticsDescription: "",
            diagnostics: [],
            governanceTitle: "",
            governanceItems: [],
        };
    }
    const title = normalizeString(semanticStatus?.title || bindingViewState?.title || "Data model") || "Data model";
    const description = normalizeString(semanticStatus?.message)
        || "Mapped fields, runtime validation, and governance are visible here.";
    const normalizedTone = normalizeString(semanticDiagnosticsNotice?.level || semanticStatus?.level || "info").toLowerCase() || "info";
    const metaChips = [];
    if (normalizeString(semanticStatus?.level).toLowerCase() === "info") {
        metaChips.push("Binding ready");
    } else if (normalizeString(semanticStatus?.level).toLowerCase() === "warning") {
        metaChips.push("Needs attention");
    } else if (normalizeString(semanticStatus?.level).toLowerCase() === "danger") {
        metaChips.push("Blocked");
    }
    if (diagnostics.length > 0) {
        metaChips.push(pluralize(diagnostics.length, "diagnostic"));
    }
    if (governanceItems.length > 0) {
        metaChips.push(pluralize(governanceItems.length, "governance note"));
    }
    return {
        tone: normalizedTone,
        eyebrow: "Data model",
        title,
        description,
        metaChips,
        semanticBindingTitle: normalizeString(bindingViewState?.title),
        semanticBindingChips: Array.isArray(bindingViewState?.chips) ? bindingViewState.chips : [],
        semanticBindingFieldGroups: Array.isArray(bindingViewState?.fieldGroups) ? bindingViewState.fieldGroups : [],
        diagnosticsTitle: normalizeString(semanticDiagnosticsNotice?.title || "Data model diagnostics"),
        diagnosticsDescription: normalizeString(semanticDiagnosticsNotice?.description)
            || (diagnostics.length > 0 ? pluralize(diagnostics.length, "diagnostic") : ""),
        diagnostics: diagnostics.map((entry, index) => ({
            id: `${normalizeString(entry.code || "diagnostic") || "diagnostic"}_${index + 1}`,
            severity: normalizeString(entry.severity || "error").toLowerCase() || "error",
            code: normalizeString(entry.code),
            path: normalizeString(entry.path),
            message: normalizeString(entry.message),
            suggestedFix: normalizeString(entry.suggestedFix),
        })),
        governanceTitle: governanceItems.length > 0 ? "Governance notes" : "",
        governanceItems,
    };
}
