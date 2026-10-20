// Relative window names belong to the namespace of their published owner.
// Local filesystem windows and explicit cross-namespace destinations retain
// their existing routing. This is name resolution, not resource authorization.
export function resolveScopedWindowKey(key, ownerURI = '') {
    if (typeof key !== 'string' || /^[a-z][a-z0-9+.-]*:/i.test(key)) return key;
    const owner = /^window:\/\/([^/]+)\/(.+)$/.exec(ownerURI);
    if (!owner) return key;
    const safe = value => value && !/[\u0000-\u0020\u007f?#\\%]/.test(value)
        && value.split('/').every(part => part && part !== '.' && part !== '..');
    if (!safe(owner[1]) || !safe(owner[2]) || !safe(key)) throw new Error('Invalid relative window resource');
    return `window://${owner[1]}/${key}`;
}
