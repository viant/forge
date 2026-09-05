const safeUrl = (value) => {
    const url = String(value || '').trim();
    return /^https:\/\//i.test(url) ? url : '';
};

export const normalizeMediaPreview = (value = {}) => {
    const candidate = value && typeof value === 'object' ? value : {url: value};
    const kind = String(candidate.kind || '').trim().toLowerCase();
    const url = safeUrl(candidate.url);
    const supported = ['image', 'audio', 'video'].includes(kind) && !!url;
    return {
        kind: supported ? kind : 'unsupported',
        url,
        alt: String(candidate.alt || 'Media preview'),
        message: String(candidate.message || (url ? 'Preview is not available for this media type.' : 'No preview asset is available.')),
    };
};
