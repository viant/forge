import { buildReportBuilderSemanticBindingViewState } from "./reportBuilderSemanticBindingViewState.js";
import { normalizeReportBuilderSemanticSummary } from "./reportBuilderSemantic.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

function normalizeBinding(binding = null) {
    return binding && typeof binding === "object" && !Array.isArray(binding)
        ? JSON.parse(JSON.stringify(binding))
        : null;
}

function shouldUseGlobalSemanticSelection(entryKind = "") {
    const normalizedKind = normalizeString(entryKind);
    return new Set([
        "primaryBuilder",
        "tableView",
        "refinementBarBlock",
    ]).has(normalizedKind);
}

function shouldSuppressSemanticSelectionForBlock(block = null) {
    if (!block || typeof block !== "object" || Array.isArray(block)) {
        return false;
    }
    const normalizedKind = normalizeString(block?.kind);
    const normalizedDatasetRef = normalizeString(block?.datasetRef || "primary") || "primary";
    if (normalizedDatasetRef === "primary") {
        return false;
    }
    return new Set([
        "chartBlock",
        "tableBlock",
        "kpiBlock",
        "badgesBlock",
        "geoMapBlock",
    ]).has(normalizedKind);
}

function matchSemanticField(field = {}, fieldRef = "") {
    const normalizedFieldRef = normalizeString(fieldRef);
    if (!normalizedFieldRef) {
        return false;
    }
    return normalizedFieldRef === normalizeString(field?.id)
        || normalizedFieldRef === normalizeString(field?.rawId)
        || normalizedFieldRef === normalizeString(field?.key);
}

function filterSemanticFields(fields = [], fieldRefs = []) {
    const normalizedRefs = Array.from(new Set(
        (Array.isArray(fieldRefs) ? fieldRefs : [])
            .map((entry) => normalizeString(entry))
            .filter(Boolean),
    ));
    if (normalizedRefs.length === 0) {
        return [];
    }
    return (Array.isArray(fields) ? fields : [])
        .filter((field) => normalizedRefs.some((fieldRef) => matchSemanticField(field, fieldRef)))
        .map((field) => JSON.parse(JSON.stringify(field)));
}

function filterBindingSelections(values = [], fieldRefs = []) {
    const normalizedRefs = Array.from(new Set(
        (Array.isArray(fieldRefs) ? fieldRefs : [])
            .map((entry) => normalizeString(entry))
            .filter(Boolean),
    ));
    if (normalizedRefs.length === 0) {
        return [];
    }
    return (Array.isArray(values) ? values : [])
        .filter((value) => {
            const normalizedValue = normalizeString(typeof value === "string" ? value : (value?.id || value?.rawId || value?.key));
            return normalizedRefs.includes(normalizedValue);
        })
        .map((value) => JSON.parse(JSON.stringify(value)));
}

function normalizeChartFieldOptions(options = []) {
    return (Array.isArray(options) ? options : [])
        .map((option) => ({
            key: normalizeString(option?.key),
            aliases: Array.from(new Set(
                (Array.isArray(option?.aliases) ? option.aliases : [])
                    .map((entry) => normalizeString(entry))
                    .filter(Boolean),
            )),
        }))
        .filter((option) => option.key);
}

function normalizeTableFieldOptions(options = []) {
    return (Array.isArray(options) ? options : [])
        .map((option) => ({
            key: normalizeString(option?.key || option?.value || option?.id),
            rawId: normalizeString(option?.rawId),
            kind: normalizeString(option?.kind).toLowerCase(),
        }))
        .filter((option) => option.key);
}

function resolveChartFieldRef(fieldRef = "", chartFieldOptions = []) {
    const normalizedFieldRef = normalizeString(fieldRef);
    if (!normalizedFieldRef) {
        return "";
    }
    const matched = normalizeChartFieldOptions(chartFieldOptions).find((option) => (
        option.key === normalizedFieldRef || option.aliases.includes(normalizedFieldRef)
    )) || null;
    return matched?.aliases[0] || matched?.key || normalizedFieldRef;
}

function resolveSelectedFieldRefs(entryKind = "", block = null, {
    chartFieldOptions = [],
    tableFieldOptions = [],
} = {}) {
    const normalizedKind = normalizeString(entryKind);
    if (!block || typeof block !== "object" || Array.isArray(block)) {
        return {
            dimensions: [],
            measures: [],
            preserveMeasures: false,
            preserveParameters: false,
            parameters: [],
        };
    }
    if (normalizedKind === "chartBlock" || normalizedKind === "chartView") {
        const chartSpec = block?.chartSpec && typeof block.chartSpec === "object" && !Array.isArray(block.chartSpec)
            ? block.chartSpec
            : {};
        return {
            dimensions: [
                chartSpec?.xField,
                chartSpec?.seriesField,
            ].map((entry) => resolveChartFieldRef(entry, chartFieldOptions)).filter(Boolean),
            measures: [
                ...(Array.isArray(chartSpec?.yFields) ? chartSpec.yFields : []),
                chartSpec?.yField,
            ]
                .map((entry) => resolveChartFieldRef(entry, chartFieldOptions))
                .filter(Boolean),
            preserveMeasures: false,
            preserveParameters: true,
            parameters: [],
        };
    }
    if (normalizedKind === "tableBlock") {
        const fieldRefs = (Array.isArray(block?.columns) ? block.columns : [])
            .map((column) => normalizeString(column?.key))
            .filter(Boolean);
        return {
            dimensions: fieldRefs,
            measures: fieldRefs,
            preserveMeasures: false,
            preserveParameters: true,
            parameters: [],
        };
    }
    if (normalizedKind === "kpiBlock") {
        return {
            dimensions: [block?.secondaryField].map((entry) => normalizeString(entry)).filter(Boolean),
            measures: [block?.valueField].map((entry) => normalizeString(entry)).filter(Boolean),
            preserveMeasures: false,
            preserveParameters: true,
            parameters: [],
        };
    }
    if (normalizedKind === "badgesBlock") {
        const fieldOptions = normalizeTableFieldOptions(tableFieldOptions);
        const fieldRefs = (Array.isArray(block?.items) ? block.items : [])
            .map((item) => normalizeString(item?.valueField))
            .filter(Boolean);
        const dimensions = [];
        const measures = [];
        fieldRefs.forEach((fieldRef) => {
            const matched = fieldOptions.find((option) => (
                option.key === fieldRef || option.rawId === fieldRef
            )) || null;
            if (!matched) {
                dimensions.push(fieldRef);
                measures.push(fieldRef);
                return;
            }
            if (matched.kind === "measure") {
                measures.push(fieldRef);
                return;
            }
            dimensions.push(fieldRef);
        });
        return {
            dimensions,
            measures,
            preserveMeasures: false,
            preserveParameters: true,
            parameters: [],
        };
    }
    if (normalizedKind === "geoMapBlock") {
        const geo = block?.geo && typeof block.geo === "object" && !Array.isArray(block.geo)
            ? block.geo
            : {};
        const metric = geo?.metric && typeof geo.metric === "object" && !Array.isArray(geo.metric)
            ? geo.metric
            : {};
        return {
            dimensions: [geo?.key, geo?.labelKey].map((entry) => normalizeString(entry)).filter(Boolean),
            measures: [metric?.key].map((entry) => normalizeString(entry)).filter(Boolean),
            preserveMeasures: false,
            preserveParameters: true,
            parameters: [],
        };
    }
    if (normalizedKind === "filterBarBlock") {
        return {
            dimensions: [],
            measures: [],
            preserveMeasures: false,
            preserveParameters: false,
            parameters: (Array.isArray(block?.paramIds) ? block.paramIds : [])
                .map((entry) => normalizeString(entry))
                .filter(Boolean),
        };
    }
    if (normalizedKind === "drillHierarchy" || normalizedKind === "drillPlaceholder") {
        return {
            dimensions: (Array.isArray(block?.levels) ? block.levels : [])
                .map((level) => normalizeString(level?.field || level?.id))
                .filter(Boolean),
            measures: [],
            preserveMeasures: true,
            preserveParameters: true,
            parameters: [],
        };
    }
    return {
        dimensions: [],
        measures: [],
        preserveMeasures: false,
        preserveParameters: false,
        parameters: [],
    };
}

export function buildReportBuilderSelectedSemanticBindingViewState({
    entryKind = "",
    block = null,
    semanticSummary = null,
    binding = null,
    chartFieldOptions = [],
    tableFieldOptions = [],
} = {}) {
    const normalizedKind = normalizeString(entryKind);
    const normalizedSummary = normalizeReportBuilderSemanticSummary(semanticSummary);
    const normalizedBinding = normalizeBinding(binding);
    if (!normalizedSummary && (!normalizedBinding || normalizeString(normalizedBinding?.mode).toLowerCase() !== "semantic")) {
        return null;
    }
    if (shouldSuppressSemanticSelectionForBlock(block)) {
        return null;
    }
    if (shouldUseGlobalSemanticSelection(normalizedKind)) {
        const bindingViewState = buildReportBuilderSemanticBindingViewState({
            semanticSummary: normalizedSummary,
            binding: normalizedBinding,
        });
        return bindingViewState
            ? {
                ...bindingViewState,
                semanticBindingTitle: "Semantic context",
            }
            : null;
    }
    const selectedRefs = resolveSelectedFieldRefs(normalizedKind, block, {
        chartFieldOptions,
        tableFieldOptions,
    });
    if (
        !selectedRefs.preserveParameters
        && selectedRefs.dimensions.length === 0
        && selectedRefs.measures.length === 0
        && selectedRefs.parameters.length === 0
    ) {
        return null;
    }
    const scopedSemanticSummary = normalizedSummary
        ? {
            ...normalizedSummary,
            selectedDimensions: filterSemanticFields(normalizedSummary.selectedDimensions, selectedRefs.dimensions),
            selectedMeasures: selectedRefs.preserveMeasures
                ? normalizedSummary.selectedMeasures.map((field) => JSON.parse(JSON.stringify(field)))
                : filterSemanticFields(normalizedSummary.selectedMeasures, selectedRefs.measures),
            ...(Array.isArray(normalizedSummary.selectedParameters)
                ? {
                    selectedParameters: selectedRefs.preserveParameters
                        ? normalizedSummary.selectedParameters.map((field) => JSON.parse(JSON.stringify(field)))
                        : filterSemanticFields(normalizedSummary.selectedParameters, selectedRefs.parameters),
                }
                : {}),
        }
        : null;
    const scopedBinding = normalizedBinding
        ? {
            ...normalizedBinding,
            selectedDimensions: filterBindingSelections(normalizedBinding.selectedDimensions, selectedRefs.dimensions),
            selectedMeasures: selectedRefs.preserveMeasures
                ? JSON.parse(JSON.stringify(Array.isArray(normalizedBinding.selectedMeasures) ? normalizedBinding.selectedMeasures : []))
                : filterBindingSelections(normalizedBinding.selectedMeasures, selectedRefs.measures),
        }
        : null;
    const bindingViewState = buildReportBuilderSemanticBindingViewState({
        semanticSummary: scopedSemanticSummary,
        binding: scopedBinding,
    });
    if (!normalizedSummary && bindingViewState && bindingViewState.fieldGroups.length === 0) {
        const globalBindingViewState = buildReportBuilderSemanticBindingViewState({
            binding: normalizedBinding,
        });
        return globalBindingViewState
            ? {
                ...globalBindingViewState,
                semanticBindingTitle: "Semantic context",
            }
            : null;
    }
    return bindingViewState
        ? {
            ...bindingViewState,
            semanticBindingTitle: "Semantic context",
        }
        : null;
}
