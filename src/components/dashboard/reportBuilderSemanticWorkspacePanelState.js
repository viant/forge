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
    providerAvailable = false,
    modelLoading = false,
    modelError = "",
    modelRef = "",
    model = null,
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
                eyebrow: "Semantic model",
                title: "Semantic modeling inactive",
                description: providerAvailable || model || normalizeString(modelRef)
                    ? "This builder is currently running in raw mode. Import or reopen a semantic report to activate model-backed mappings."
                    : "This builder is currently running without semantic binding or a semantic model provider.",
                metaChips: [
                    "Raw mode",
                    ...(providerAvailable || model ? ["Provider available"] : ["Provider unavailable"]),
                ],
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
                eyebrow: "Semantic model",
                title: "Loading semantic model",
                description: "Semantic binding is active and the model metadata is still loading.",
                metaChips: ["Semantic mode", "Loading"],
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
                eyebrow: "Semantic model",
                title: "Semantic model error",
                description: normalizeString(modelError),
                metaChips: ["Semantic mode", "Blocked"],
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
            eyebrow: "Semantic model",
            title: "Semantic model unavailable",
            description: "Semantic binding is active, but no semantic model metadata is currently available for this report.",
            metaChips: ["Semantic mode", "Provider unavailable"],
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
    const title = normalizeString(semanticStatus?.title || bindingViewState?.title || "Semantic model") || "Semantic model";
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
        eyebrow: "Semantic model",
        title,
        description,
        metaChips,
        semanticBindingTitle: normalizeString(bindingViewState?.title),
        semanticBindingChips: Array.isArray(bindingViewState?.chips) ? bindingViewState.chips : [],
        semanticBindingFieldGroups: Array.isArray(bindingViewState?.fieldGroups) ? bindingViewState.fieldGroups : [],
        diagnosticsTitle: normalizeString(semanticDiagnosticsNotice?.title || "Semantic diagnostics"),
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
