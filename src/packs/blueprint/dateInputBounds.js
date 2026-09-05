export function defaultDateInputMinDate(now = new Date()) {
    const result = new Date(now);
    result.setFullYear(result.getFullYear() - 50, 0, 1);
    result.setHours(0, 0, 0, 0);
    return result;
}

export function defaultDateInputMaxDate(now = new Date()) {
    const result = new Date(now);
    result.setFullYear(result.getFullYear() + 20, 11, 31);
    result.setHours(23, 59, 59, 999);
    return result;
}
