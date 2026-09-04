export function formatPercentFraction2Input(value) {
    return value === '' || value === null || value === undefined
        ? ''
        : (Number(value) * 100).toFixed(2);
}

export function parsePercentFraction2Input(valueAsNumber, valueAsString) {
    return String(valueAsString || '').trim() === '' ? null : valueAsNumber / 100;
}
