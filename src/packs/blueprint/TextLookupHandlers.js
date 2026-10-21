export function createLookupOpenHandler(latest, openLookup, onError = console.error) {
    const handler=async () => {
        const { item, context, adapter, value } = latest.current || {};
        try {
            await openLookup({ item, context, adapter, value });
        } catch (e) {
            onError('lookup failed', e);
        }
    };
    handler.operate=async()=>{const {item,context,adapter,value}=latest.current || {};return await openLookup({item,context,adapter,value,strict:true});};
    return handler;
}
