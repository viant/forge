// A browser cache freshness budget for NEW actions, never an authorization
// decision or an extension of a server-issued deadline.
export const REPORT_ACTION_FRESHNESS_MS = 60_000;
const identityFields = ['providerIdentity', 'uri', 'kind', 'revision', 'contentFingerprint', 'authorityBinding'];
const clone = value => JSON.parse(JSON.stringify(value));

export class ReportMetadataRefreshError extends Error {
    constructor(message) {super(message);this.name='ReportMetadataRefreshError';}
}
export function sameReportActionIdentity(left, right) {
    return !!left && !!right && identityFields.every(field => (left[field] ?? '') === (right[field] ?? ''));
}
export function reportActionNeedsMetadataRefresh(pin, now = Date.now()) {
    const until = pin?.validUntil;
    // Omitted/zero metadata expiry is notification-bound in the resource contract.
    if (!until || /^0001-01-01T00:00:00(?:\.0+)?Z$/.test(until)) return false;
    const expires = Date.parse(until);
    return Number.isFinite(expires) && expires <= now + REPORT_ACTION_FRESHNESS_MS;
}
export async function freshReportActionPin(pin, getReport, {isCurrent=()=>true, onRefresh=()=>{}, now=Date.now} = {}) {
    if (!isCurrent()) return null;
    if (!reportActionNeedsMetadataRefresh(pin, now())) return pin;
    if (typeof getReport !== 'function') throw new ReportMetadataRefreshError('Report details need refreshing. Refresh or reopen this report before continuing.');
    onRefresh();
    let saved;
    try {
        saved = await getReport({resource:{uri:pin.uri,revision:pin.kind==='working'?'working':pin.revision}, resolvedResource:clone(pin), refreshMetadata:true});
    } catch (_) {
        throw new ReportMetadataRefreshError('Report details could not be refreshed. Refresh or reopen this report and try again.');
    }
    if (!isCurrent()) return null;
    const fresh = saved?.resource;
    if (!sameReportActionIdentity(pin,fresh)) throw new ReportMetadataRefreshError('This report changed while it was open. Refresh or reopen it before continuing.');
    if (reportActionNeedsMetadataRefresh(fresh,now())) throw new ReportMetadataRefreshError('Report details are still expiring. Refresh or reopen this report before continuing.');
    return clone(fresh);
}
