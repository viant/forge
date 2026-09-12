// Keep labels when no recognizable icon exists or metadata explicitly asks for one.
export function actionIconOnly(item = {}) {
    return item.hideLabel === true || (item.hideLabel !== false && !!item.icon);
}
export function actionAccessibleName(item = {}) {
    return item.ariaLabel || item.label || item.tooltip || item.id || 'Action';
}
