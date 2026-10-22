// Nulls, blanks, booleans, objects, and nonfinite values are not observations.
export function isNumericValue(value) {
 return (typeof value === "number" || typeof value === "string" && value.trim() !== "") && Number.isFinite(Number(value));
}
