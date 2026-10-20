export async function fetchReaderDataSource(api,name,input={}) {
 if(typeof api.readLookup!=='function')throw new Error('Reader lookup datasource is not configured.');
 return api.readLookup(name,input);
}
