// Shared by the native anchor callback and its registered UI operation. URLs
// come from the already-resolved authored link, never operation parameters.
export function navigateNativeLink(link,host=globalThis.window) {
  if(!host || typeof link?.href!=='string')throw new Error('native link navigation is unavailable');
  const resolved=new URL(link.href,host.location?.href || 'http://localhost/');
  if(!['http:','https:','mailto:','tel:'].includes(resolved.protocol))throw new Error('link protocol is unavailable to UI operation');
  if(link.target==='_self')host.location.assign(resolved.href);
  else host.open(resolved.href,link.target || '_blank','noopener,noreferrer');
  return {status:'navigation_requested'};
}
