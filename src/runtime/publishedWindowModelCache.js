// An admission GET always precedes lookup. This cache only skips repeated
// target/resource compilation of a verified, auth-free published definition.
const MAX_MODELS = 16;
const RENDERER_VERSION = 'forge-window-v1';
const CACHE_PREFIX = 'forge-published-window-model-v1-';
const models = new Map();
const writes = new Map();
let clearing = false;
const stats = {hits:0,misses:0,entries:0};
if (typeof window !== 'undefined') window.__forgeWindowModelCacheStats = stats;

const plain = value => !!value && typeof value === 'object' && !Array.isArray(value);
const copy = value => JSON.parse(JSON.stringify(value));
const canonical = value => Array.isArray(value) ? value.map(canonical)
    : plain(value) ? Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])) : value;
const scopeKey = ({providerIdentity,uri,revision,target,sessionId}) => JSON.stringify([
    RENDERER_VERSION,sessionId,providerIdentity,uri,String(revision || ''),canonical(target || {})]);
const digest = async value => {
    if (!globalThis.crypto?.subtle || !globalThis.TextEncoder) return '';
    const bytes = await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
    return [...new Uint8Array(bytes)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
};
const backing = async (sessionId) => {
    if (!globalThis.caches || !globalThis.Response || !globalThis.location?.origin) return null;
    try {
        const sessionDigest = await digest(sessionId);
        if (!sessionDigest) return null;
        const name = CACHE_PREFIX+sessionDigest;
        for (const old of await caches.keys()) if (old.startsWith(CACHE_PREFIX) && old !== name) await caches.delete(old);
        return caches.open(name);
    } catch {return null;}
};
const storageURL = scopeDigest => `${globalThis.location.origin}/__forge_published_window_model__/${scopeDigest}`;
const validETag = (etag,hash) => /^"[a-f0-9]{64}\.cohort-v\d+"$/i.test(String(etag || '')) && etag.includes(hash);
async function hydrate(scope,sessionId) {
    const cache = await backing(sessionId);
    if (!cache) return null;
    try {
        const scopeDigest = await digest(scope);
        const url = storageURL(scopeDigest);
        const response = await cache.match(url);
        if (!response) return null;
        const record = await response.json();
        if (record.scopeDigest !== scopeDigest || !/^[a-f0-9]{64}$/i.test(record.hash) ||
            !validETag(record.etag,record.hash) || !cacheablePublishedWindow(record.model)) {
            await cache.delete(url);
            return null;
        }
        const key = JSON.stringify([scope,record.hash,record.etag]);
        const entry = {model:record.model,etag:record.etag};
        models.set(key,entry);
        while (models.size > MAX_MODELS) models.delete(models.keys().next().value);
        stats.entries = models.size;
        return entry;
    } catch {return null;}
}
async function persist(scope,sessionId,hash,entry) {
    if (!entry.etag || clearing) return;
    const cache = await backing(sessionId);
    if (!cache) return;
    try {
        const scopeDigest = await digest(scope);
        await cache.put(storageURL(scopeDigest),new Response(JSON.stringify({scopeDigest,hash,etag:entry.etag,model:entry.model}),
            {headers:{'Content-Type':'application/json'}}));
        const keys = await cache.keys();
        for (const old of keys.slice(0,Math.max(0,keys.length-MAX_MODELS))) await cache.delete(old);
    } catch { /* Storage is optional; the admitted response still renders. */ }
}

export async function publishedWindowConditionalETag(identity) {
    if (!identity?.sessionId || !identity.providerIdentity || !identity.uri) return '';
    const scope = scopeKey(identity);
    for (const [key,entry] of [...models].reverse()) if (JSON.parse(key)[0] === scope) return entry.etag || '';
    return (await hydrate(scope,identity.sessionId))?.etag || '';
}

export function cacheablePublishedWindow(definition) {
    if (!plain(definition) || !plain(definition.view) || !plain(definition.dataSource)) return false;
    // These fields can depend on the current principal, browser instance, or
    // authorization decision, and must never be retained in a shared model.
    if (definition.authorizationSnapshot || definition.selectionBinding || definition.localStateOwner ||
        definition.resource?.authorityBinding || definition.resourceTarget?.selectionToken ||
        definition.resourceTarget?.executionProof || definition.resourceTarget?.dependencyPins) return false;
    return true;
}

export async function admittedPublishedWindowModel({definition,hash,etag,providerIdentity,uri,revision,target,sessionId,compile}) {
    if (definition == null && (!validETag(etag,hash) || !providerIdentity || !uri || !sessionId)) {
        throw new Error('Published window model is unavailable after revalidation');
    }
    if (!/^[a-f0-9]{64}$/i.test(String(hash || '')) || !providerIdentity || !uri || !sessionId ||
        !validETag(etag,hash) || (!cacheablePublishedWindow(definition) && definition != null)) return compile(definition);
    const scope = scopeKey({providerIdentity,uri,revision,target,sessionId});
    const key = JSON.stringify([scope,hash,etag]);
    const hit = models.get(key);
    if (hit) {
        models.delete(key);
        models.set(key,hit);
        stats.hits++;
        return copy(hit.model);
    }
    if (definition == null) throw new Error('Published window model is unavailable after revalidation');
    stats.misses++;
    const compiled = await compile(definition);
    if (!cacheablePublishedWindow(compiled)) return compiled;
    // A new publication replaces an older hash in the same trusted scope.
    for (const existing of models.keys()) {
        if (JSON.parse(existing)[0] === scope) models.delete(existing);
    }
    const entry = {model:copy(compiled),etag};
    models.set(key,entry);
    while (models.size > MAX_MODELS) models.delete(models.keys().next().value);
    stats.entries = models.size;
    // Disk persistence is deliberately off the first-render critical path.
    const pending = (writes.get(scope) || Promise.resolve()).then(()=>persist(scope,sessionId,hash,entry));
    writes.set(scope,pending);
    void pending.finally(()=>{if(writes.get(scope)===pending) writes.delete(scope);});
    return compiled;
}

export async function flushPublishedWindowModelCacheWrites() {await Promise.all([...writes.values()]);}

export async function clearPersistentPublishedWindowModelCache() {
    clearPublishedWindowModelCache();
    clearing = true;
    try {
        await flushPublishedWindowModelCacheWrites();
        if (globalThis.caches) for (const name of await caches.keys()) {
            if (name.startsWith(CACHE_PREFIX)) await caches.delete(name);
        }
    } catch { /* Logout must continue even if browser storage is unavailable. */ }
    finally {clearing = false;}
}

export function publishedWindowModelCacheStats() {return {...stats};}
export function clearPublishedWindowModelCache() {
    models.clear();
    stats.hits=0;stats.misses=0;stats.entries=0;
}
if (typeof window !== 'undefined') {
    window.addEventListener('agently:session-reset',()=>{void clearPersistentPublishedWindowModelCache();});
    window.addEventListener('agently:logout',()=>{void clearPersistentPublishedWindowModelCache();});
}
