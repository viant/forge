const pending = new Map();

const key = (dataSourceId, requestId) => `${String(dataSourceId || '')}\u001f${String(requestId || '')}`;

export function beginDataSourceRequest(dataSourceId, requestId, windowId = '', result = 'payload', reviewedWrite) {
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
  pending.set(requestKey, {promise, resolve, reject, result, reviewedWrite, windowId: String(windowId || '').trim()});
  return promise;
}

// A queued reviewed write may outlive its presentation or its invocation entry.
// The connector consults this at dispatch, including after asynchronous HTTP preparation.
export function admitReviewedWriter(dataSourceId, requestId) {
  const admit = pending.get(key(dataSourceId, requestId))?.reviewedWrite?.admit;
  if (!admit) throw Object.assign(new Error('The reviewed submission is no longer active.'), {code:'reviewed_scope_changed'});
  admit();
}

export function reviewedWriterInput(dataSourceId, requestId) {
  return pending.get(key(dataSourceId, requestId))?.reviewedWrite?.input;
}

// Only the invocation that owns this promise can retain its acknowledgement
// after a renderer unmounts. Reads and record-dependent transforms still
// observe their existing supersession behavior.
export function retainMutationAcknowledgement(dataSourceId, requestId, completion) {
  const entry = pending.get(key(dataSourceId, requestId));
  if (!entry || entry.promise !== completion || entry.result !== 'payload') return false;
  entry.retainAcknowledgement = true;
  return true;
}

export function settleUnmountedDataSourceResponse(dataSourceId, requestId, payload, validAcknowledgement) {
  const retained = pending.get(key(dataSourceId, requestId))?.retainAcknowledgement;
  const error = retained && validAcknowledgement ? null : Object.assign(new Error('Datasource unmounted before request completion.'), {code: 'request_superseded'});
  return settleDataSourceRequest(dataSourceId, requestId, error, payload);
}

export function requestedResultMode(dataSourceId, requestId) {
  return requestId && pending.get(key(dataSourceId, requestId))?.result;
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

export function settleDataSourceRequest(dataSourceId, requestId, error = null, value = undefined, records = undefined, identityRows = undefined) {
  if (!dataSourceId || !requestId) return false;
  const requestKey = key(dataSourceId, requestId);
  const entry = pending.get(requestKey);
  if (!entry) return false;
  pending.delete(requestKey);
  if (error) entry.reject(error);
  else if (entry.result === 'identityRecords') {
    if (Array.isArray(identityRows)) entry.resolve(identityRows);
    else entry.reject(Object.assign(new Error('The writer did not provide invocation identity records.'), {code: 'request_superseded'}));
  } else if (entry.result === 'records' || entry.result === 'orderedRecords') {
    if (!Array.isArray(records)) entry.reject(Object.assign(new Error('Datasource records were superseded before completion.'), {code: 'request_superseded'}));
    else {
      try { entry.resolve(typeof structuredClone === 'function' ? structuredClone(records) : JSON.parse(JSON.stringify(records))); }
      catch (error) { entry.reject(error); }
    }
  } else entry.resolve(value);
  return true;
}

export function invalidateDataSourceRequests(dataSourceId) {
 const id=String(dataSourceId||'');if(!id)return 0;let count=0;
 for(const [requestKey,entry] of pending){if(!requestKey.startsWith(id+'\u001f'))continue;pending.delete(requestKey);const error=Object.assign(new Error('Datasource access denied before completion.'),{code:'datasource_denied',scope:'dataset',status:403});entry.reject(error);count++;}
 return count;
}
