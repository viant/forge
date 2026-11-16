// Look up a declared alias without interpreting caller input as a URI, path or
// title. The publisher is inherited from the admitted source at the final open.
export function managementWindowDestination(section, routes, source) {
  if (typeof section !== 'string' || !routes || typeof routes !== 'object' || Array.isArray(routes) || !Object.hasOwn(routes, section)) return null;
  const target = routes[section];
  if (!target || typeof target.resourceUri !== 'string' || typeof target.title !== 'string' ||
      !target.title.trim() || typeof source?.uri !== 'string' || !source.uri.startsWith('window://')) return null;
  if (target.providerIdentity !== undefined && target.providerIdentity !== source.providerIdentity) return null;
  const slash = source.uri.indexOf('/', 'window://'.length);
  if (slash < 0) return null;
  const prefix = source.uri.slice(0, slash + 1);
  if (!target.resourceUri.startsWith(prefix)) return null;
  const path = target.resourceUri.slice(prefix.length);
  if (path.length > 512 || !path.split('/').every(segment =>
    /^[A-Za-z0-9._-]{1,64}$/.test(segment) && segment !== '.' && segment !== '..')) return null;
  return {resourceUri: target.resourceUri, title: target.title};
}
