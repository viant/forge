export function resolveNumericInputMinorStepSize(stepSize, minorStepSize) {
    if (minorStepSize != null) return minorStepSize;
    return Number.isFinite(stepSize) ? Math.min(0.1, stepSize) : undefined;
}
