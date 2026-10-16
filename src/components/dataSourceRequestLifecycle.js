const pending = new Map();

const key = (dataSourceId, requestId) => `${String(dataSourceId || '')}\u001f${String(requestId || '')}`;

export function beginDataSourceRequest(dataSourceId, requestId, windowId = '') {
  if (!dataSourceId || !requestId) return null;
  const requestKey = key(dataSourceId, requestId);
  const existing = pending.get(requestKey);
  if (existing) return existing.promise;
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  // A caller may be detached by an authorization context change before it
  // awaits the promise. Keep rejection observable without an unhandled event.
  promise.catch(() => {});
  pending.set(requestKey, {promise, resolve, reject, windowId: String(windowId || '').trim()});
  return promise;
}

export function invalidateWindowDataSourceRequests(windowId) {
  const id = String(windowId || '').trim();
  if (!id) return 0;
  let invalidated = 0;
  for (const [requestKey, entry] of pending) {
    if (entry.windowId !== id) continue;
    pending.delete(requestKey);
    const error = new Error('Datasource authorization context changed before completion.');
    error.code = 'request_superseded';
    entry.reject(error);
    invalidated++;
  }
  return invalidated;
}

export function settleDataSourceRequest(dataSourceId, requestId, error = null, value = undefined) {
  if (!dataSourceId || !requestId) return false;
  const requestKey = key(dataSourceId, requestId);
  const entry = pending.get(requestKey);
  if (!entry) return false;
  pending.delete(requestKey);
  if (error) entry.reject(error);
  else entry.resolve(value);
  return true;
}

export function invalidateDataSourceRequests(dataSourceId) {
 const id=String(dataSourceId||'');if(!id)return 0;let count=0;
 for(const [requestKey,entry] of pending){if(!requestKey.startsWith(id+'\u001f'))continue;pending.delete(requestKey);const error=Object.assign(new Error('Datasource access denied before completion.'),{code:'datasource_denied',scope:'dataset',status:403});entry.reject(error);count++;}
 return count;
}
