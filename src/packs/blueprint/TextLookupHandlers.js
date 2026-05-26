export function createLookupOpenHandler(latest, openLookup, onError = console.error) {
    return async () => {
        const { item, context, adapter, value } = latest.current || {};
        try {
            await openLookup({ item, context, adapter, value });
        } catch (e) {
            onError('lookup failed', e);
        }
    };
}
