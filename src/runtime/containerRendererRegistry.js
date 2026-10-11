// Container renderers are installed by the host. Authored kinds do not load
// modules, resolve network targets, or manufacture host capabilities.
const renderers = new Map();
export function registerContainerRenderer(kind, renderer) {
    if (typeof kind !== 'string' || !kind.trim() || typeof renderer !== 'function') {
        throw new Error('Container renderer registration requires a kind and component');
    }
    const key = kind.trim();
    if (renderers.has(key) && renderers.get(key) !== renderer) {
        throw new Error(`Container renderer already installed: ${key}`);
    }
    renderers.set(key, renderer);
}
export function getContainerRenderer(kind) {
    return renderers.get(String(kind || '').trim()) || null;
}
