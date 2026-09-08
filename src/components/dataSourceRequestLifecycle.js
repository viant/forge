const pending = new Map();

const key = (dataSourceId, requestId) => `${String(dataSourceId || '')}\u001f${String(requestId || '')}`;

export function beginDataSourceRequest(dataSourceId, requestId) {
  if (!dataSourceId || !requestId) return null;
  const requestKey = key(dataSourceId, requestId);
  const existing = pending.get(requestKey);
  if (existing) return existing.promise;
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  pending.set(requestKey, {promise, resolve, reject});
  return promise;
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
