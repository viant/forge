// Shared restricted arithmetic for cross-dataset KPI comparisons. Rendering and
// print both consume the same materialized value; neither recomputes formulas.
export function normalizeKpiSecondaryCalculation(value = "") {
 const mode = String(value || "value").trim();
 if (!["value", "difference", "relativeChange"].includes(mode)) throw new Error(`Unknown KPI secondary calculation '${mode}'.`);
 return mode;
}
export function calculateKpiSecondaryValue(current, previous, mode = "value") {
 const calculation = normalizeKpiSecondaryCalculation(mode);
 if (calculation === "value") return previous ?? null;
 const numeric = value => (typeof value === "number" || (typeof value === "string" && value.trim() !== "")) && Number.isFinite(Number(value));
 if (!numeric(current) || !numeric(previous)) return null;
 const difference = Number(current) - Number(previous);
 const result = calculation === "relativeChange" ? (Number(previous) === 0 ? null : difference / Number(previous)) : difference;
 return result === null || !Number.isFinite(result) ? null : result;
}
