// UI snapshots carry only a resource locator. A restored locator is never an
// admission token: WindowContent performs the normal host GET and the server
// checks the current principal before delivering the window or report.
export function snapshotWindowResourceLocator(window = {}) {
  const key = String(window?.windowKey || '').trim();
  const uri = String(window?.resourceRef?.uri || '').trim();
  const owner = String(window?.providerIdentity || '').trim();
  const report = uri.startsWith('report://');
  if (key.length > 1024 || key !== uri || !/^(?:window|report):\/\/[^/?#]+\/[^?#]+$/.test(uri) ||
      owner.length > 256 || (!report || owner) && !/^[A-Za-z0-9._:/-]+$/.test(owner)) return {};
  const revision = String(window?.resourceRef?.revision || '').trim();
  if (revision.length > 256 || /[\u0000-\u001f\u007f]/.test(revision)) return {};
  return {...(owner ? {providerIdentity:owner} : {}),resourceRef:{uri,...(revision ? {revision} : {})}};
}
