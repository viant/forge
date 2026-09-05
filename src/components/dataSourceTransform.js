export function applyFetchTransform(events, records) {
    const current = Array.isArray(records) ? records : [];
    if (!events?.onFetch?.isDefined?.()) return current;
    const transformed = events.onFetch.execute({collection: current});
    return Array.isArray(transformed) ? transformed : current;
}
