import {deepMerge} from '../../runtime/metadataResolver.js';
// Authored variants reuse the same column identities and native table runtime.
// Unspecified columns and settings retain their original producer definition.
export function resolveTableThemeOverrides(table, columns, themeId) {
    const override = table?.targetOverrides?.[`theme:${themeId}`];
    if (!override || typeof override !== 'object' || Array.isArray(override)) return {table, columns};
    const {columns: changes, targetOverrides: ignored, ...settings} = override;
    const byId = new Map((Array.isArray(changes) ? changes : []).filter(column => column?.id).map(column => [column.id, column]));
    const themedColumns = Array.isArray(columns) ? columns.map(column => byId.has(column.id) ? deepMerge(column, byId.get(column.id)) : column) : columns;
    return {table: {...table, ...settings}, columns: themedColumns};
}
