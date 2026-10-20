import {hasContainerClass} from './containerClasses.js';
// Metadata can override the sizing allocated by a parent layout.
export function resolveContainerSizing(container, allocatedMode = 'fill') {
    const authored = container?.sizingMode;
    return authored === 'fill' || authored === 'content' ? authored : allocatedMode;
}

export function containerSizingStyle(container, allocatedMode = 'fill', {chrome = false} = {}) {
    const mode = resolveContainerSizing(container, allocatedMode);
    const style = container?.style || {};
    const ownsHeight = !chrome && style.height != null && !['auto', '100%'].includes(String(style.height));
    return {
        width: !chrome ? style.width ?? '100%' : '100%',
        minWidth: !chrome ? style.minWidth ?? 0 : 0,
        minHeight: !chrome ? style.minHeight ?? 0 : 0,
        ...(!chrome && style.maxWidth != null ? {maxWidth: style.maxWidth} : {}),
        display: !chrome && hasContainerClass(container, 'forge-container-hidden') ? undefined : 'flex', flexDirection: 'column',
        flex: !chrome && style.flex != null ? style.flex : ownsHeight ? '0 0 auto' : mode === 'fill' ? '1 1 0' : '0 0 auto',
        // Only the outer boundary applies explicit dimensions. Chrome bodies
        // share the remaining space instead of repeating the parent's height.
        height: chrome ? 'auto' : style.height ?? 'auto',
        ...(!chrome && style.minHeight != null ? {minHeight: style.minHeight} : {}),
        ...(!chrome && style.maxHeight != null ? {maxHeight: style.maxHeight} : {}),
        overflow: !chrome && container?.scrollMode === 'self' ? 'auto' : 'visible',
    };
}
