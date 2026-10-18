const safeUrl = (value, trustedBlob = false) => {
    const url = String(value || '').trim();
    return /^https?:\/\//i.test(url) || (trustedBlob && /^blob:/i.test(url)) ? url : '';
};

// Authored raster assets travel with the window rather than depending on the
// original author's web session. Never accept arbitrary data URLs or SVG here.
export const MAX_EMBEDDED_IMAGE_BYTES = 8 * 1024 * 1024;
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
    const embedded = kind === 'image' && candidate.image !== undefined;
    // An invalid explicit asset must not fall back to another source URL.
    const url = embedded ? embeddedImage(candidate.image) : safeUrl(candidate.url, trustedBlob);
    const supported = ['image', 'audio', 'video'].includes(kind) && !!url;
    return {
        kind: supported ? kind : 'unsupported',
        url,
        alt: String(candidate.alt || 'Media preview'),
        message: String(candidate.message || (url ? 'Preview is not available for this media type.' : 'No preview asset is available.')),
        ...(embedded ? {embedded: true} : {}),
    };
};
