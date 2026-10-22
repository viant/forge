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

// Reuse only the locator from a server-delivered active source definition.
// This does not admit the destination: its provider still performs a fresh Get.
// Never carry the source selector/revision/pin onto a different resource.
export function scopedWindowProviderIdentity(destination, sourceResource) {
    if (!sourceResource || !['working', 'stamped'].includes(sourceResource.kind)
        || !['providerIdentity', 'contentFingerprint', 'authorityBinding'].every(key =>
            typeof sourceResource[key] === 'string' && sourceResource[key].trim())) return undefined;
    const parse = value => typeof value === 'string'
        && /^window:\/\/([^/?#\s%\\]+)\/([^?#\s%\\]+)$/.exec(value);
    const source = parse(sourceResource.uri);
    const target = parse(destination);
    if (!source || !target || source[1] !== target[1]) return undefined;
    if ([source[2], target[2]].some(name => name.split('/').some(part => !part || part === '.' || part === '..'))) return undefined;
    return sourceResource.providerIdentity;
}
