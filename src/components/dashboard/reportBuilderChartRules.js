export const CHART_TYPE_LABELS = {
    line: "Line",
    bar: "Bar",
    area: "Area",
    pie: "Pie",
    donut: "Donut",
    horizontal_bar: "Horizontal bar",
    funnel_bar: "Funnel",
};

export const CARTESIAN_CHART_TYPES = ["line", "bar", "area"];
export const CATEGORY_CHART_TYPES = ["pie", "donut", "horizontal_bar", "funnel_bar"];
export const ALL_SUPPORTED_CHART_TYPES = [...CARTESIAN_CHART_TYPES, ...CATEGORY_CHART_TYPES];
export const SINGLE_MEASURE_CATEGORY_TYPES = new Set(["pie", "donut", "funnel_bar"]);
export const PER_SERIES_TYPE_CHOICES = ["line", "bar", "area"];

export function chartTypeLabel(type = "") {
    const normalized = String(type || "").trim().toLowerCase();
    return CHART_TYPE_LABELS[normalized] || normalized || "";
}

export function chartFamilyForType(type = "") {
    const normalized = String(type || "").trim().toLowerCase();
    if (CARTESIAN_CHART_TYPES.includes(normalized)) return "cartesian";
    if (CATEGORY_CHART_TYPES.includes(normalized)) return "category";
    return null;
}

export function chartFamilyHelperText(type = "") {
    switch (String(type || "").trim().toLowerCase()) {
        case "pie":
        case "donut":
            return "Pie and donut charts use one category dimension and a single measure to slice.";
        case "horizontal_bar":
            return "Horizontal bars compare a category against one or more measures.";
        case "funnel_bar":
            return "Funnel charts use one category dimension and a single measure ordered by value.";
        case "line":
        case "bar":
        case "area":
        default:
            return "Pick a category for the X-axis, then one or more measures. Add a series dimension to split a single measure by group.";
    }
}

export function chartFamilyAllowsSeriesOptions(type = "") {
    const normalized = String(type || "").trim().toLowerCase();
    if (chartFamilyForType(normalized) === "cartesian") return true;
    return normalized === "horizontal_bar";
}

export function isValidPerSeriesType(chartType = "", perSeriesType = "") {
    const family = chartFamilyForType(chartType);
    const normalized = String(perSeriesType || "").trim().toLowerCase();
    if (!normalized) return true;
    if (family === "cartesian") {
        return CARTESIAN_CHART_TYPES.includes(normalized);
    }
    return false;
}

export function supportsStackIdForSeries(chartType = "", perSeriesType = "") {
    const family = chartFamilyForType(chartType);
    const baseType = String(chartType || "").trim().toLowerCase();
    const effectiveType = String(perSeriesType || baseType).trim().toLowerCase();
    if (family === "cartesian") {
        return effectiveType === "bar" || effectiveType === "area";
    }
    return baseType === "horizontal_bar";
}

export function supportsStackForSeries(chartType = "", perSeriesType = "") {
    const base = String(chartType || "").trim().toLowerCase();
    if (base === "horizontal_bar") return true;
    if (!CARTESIAN_CHART_TYPES.includes(base)) return false;
    const effective = String(perSeriesType || base).trim().toLowerCase();
    return effective === "bar" || effective === "area";
}
