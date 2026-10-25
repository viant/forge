const safeUrl = (value, trustedBlob = false) => {
    const url = String(value || '').trim();
    return /^https?:\/\//i.test(url) || (trustedBlob && /^blob:/i.test(url)) ? url : '';
};

// Authored raster assets travel with the window rather than depending on the
// original author's web session. Never accept arbitrary data URLs or SVG here.
export const MAX_EMBEDDED_IMAGE_BYTES = 8 * 1024 * 1024;
// Frame choices may expose browser source viewing, but never arbitrary schemes
// or markup. Preserve the authored URL rather than rewriting query parameters.
const frameUrl = value => {
    const text = String(value || '').trim();
    const target = text.startsWith('view-source:') ? text.slice(12) : text;
    if (!/^https?:\/\//i.test(target)) return '';
    try {
        const parsed = new URL(target);
        return parsed.hostname && !parsed.username && !parsed.password ? text : '';
    } catch { return ''; }
};
const frameDimension = value => Number.isFinite(Number(value)) && Number(value) > 0
    ? Math.min(10000, Math.round(Number(value))) : 400;
function embeddedImage(image) {
    if (!image || typeof image !== 'object') return '';
    const {mimeType, payload} = image;
    if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(mimeType)
        || typeof payload !== 'string' || !payload.length
        || payload.length > 4 * Math.ceil(MAX_EMBEDDED_IMAGE_BYTES / 3)
        || payload.length % 4 !== 0
        || !/^[A-Za-z0-9+/]+={0,2}$/.test(payload)) return '';
    const size = payload.length / 4 * 3 - (payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0);
    if (size > MAX_EMBEDDED_IMAGE_BYTES) return '';
    const header = atob(payload.slice(0, 16));
    const matches = mimeType === 'image/png' ? header.startsWith('\x89PNG\r\n\x1a\n')
        : mimeType === 'image/jpeg' ? header.startsWith('\xff\xd8\xff')
        : mimeType === 'image/gif' ? /^(GIF87a|GIF89a)/.test(header)
        : header.startsWith('RIFF') && header.slice(8, 12) === 'WEBP';
    return matches ? `data:${mimeType};base64,${payload}` : '';
}

export const normalizeMediaPreview = (value = {}, {trustedBlob = false} = {}) => {
    const candidate = value && typeof value === 'object' ? value : {url: value};
    const kind = String(candidate.kind || '').trim().toLowerCase();
    if (kind === 'frame') {
        const sources = (Array.isArray(candidate.sources) ? candidate.sources : [])
            .map(source => ({label:String(source?.label || ''),url:frameUrl(source?.url)}))
            .filter(source => source.label && source.url);
        const url = frameUrl(candidate.url) || sources[0]?.url || '';
        return {kind:url ? 'frame' : 'unsupported',url,sources,
            title:String(candidate.title || 'Content preview'),
            width:frameDimension(candidate.width),height:frameDimension(candidate.height),
            identity:String(candidate.identity || ''),message:'No preview source is available.'};
    }
    const embedded = kind === 'image' && candidate.image !== undefined;
    // An invalid explicit asset must not fall back to another source URL.
    const url = embedded ? embeddedImage(candidate.image) : safeUrl(candidate.url, trustedBlob);
    if (kind === 'imagecard') return {kind:'imagecard',url,alt:String(candidate.alt||'Preview image'),title:String(candidate.title||''),description:String(candidate.description||''),caption:String(candidate.caption||''),href:safeUrl(candidate.href),identity:String(candidate.identity||'')};
    const supported = ['image', 'audio', 'video'].includes(kind) && !!url;
    return {
        kind: supported ? kind : 'unsupported',
        url,
        alt: String(candidate.alt || 'Media preview'),
        message: String(candidate.message || (url ? 'Preview is not available for this media type.' : 'No preview asset is available.')),
        ...(embedded ? {embedded: true} : {}),
    };
};
