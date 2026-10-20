const safeUrl = (value, trustedBlob = false) => {
    const url = String(value || '').trim();
    return /^https?:\/\//i.test(url) || (trustedBlob && /^blob:/i.test(url)) ? url : '';
};

export const normalizeMediaPreview = (value = {}, {trustedBlob = false} = {}) => {
    const candidate = value && typeof value === 'object' ? value : {url: value};
    const kind = String(candidate.kind || '').trim().toLowerCase();
    const url = safeUrl(candidate.url, trustedBlob);
    if (kind === 'imagecard') return {kind:'imagecard',url,alt:String(candidate.alt||'Preview image'),title:String(candidate.title||''),description:String(candidate.description||''),caption:String(candidate.caption||''),href:safeUrl(candidate.href),identity:String(candidate.identity||'')};
    const supported = ['image', 'audio', 'video'].includes(kind) && !!url;
    return {
        kind: supported ? kind : 'unsupported',
        url,
        alt: String(candidate.alt || 'Media preview'),
        message: String(candidate.message || (url ? 'Preview is not available for this media type.' : 'No preview asset is available.')),
    };
};
