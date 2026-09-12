export const hasContainerClass = (container, name) => String(container?.className || '').split(/\s+/).includes(name);
export const containerSurfaceClass = (container, part, extra = '') => ['forge-container', `forge-container-${part}`, container?.className, extra].filter(Boolean).join(' ');
