export const SCHEMA_FORM_FIELD_TRACKS_APPEARANCE = 'field-tracks';

const MAX_SCHEMA_FORM_COLUMNS = 12;
const LABEL_MODES = new Set(['left', 'top', 'none']);

function normalizeString(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function resolveSchemaFormAppearance(layout = {}) {
    return normalizeString(layout?.appearance) === SCHEMA_FORM_FIELD_TRACKS_APPEARANCE
        ? SCHEMA_FORM_FIELD_TRACKS_APPEARANCE
        : '';
}

export function resolveSchemaFormFieldTracksLayout(layout = {}) {
    if (resolveSchemaFormAppearance(layout) !== SCHEMA_FORM_FIELD_TRACKS_APPEARANCE) return null;
    if (normalizeString(layout?.kind) !== 'grid') return null;

    const authoredColumns = Number(layout?.columns);
    const columns = Number.isFinite(authoredColumns)
        ? Math.min(Math.max(Math.trunc(authoredColumns), 1), MAX_SCHEMA_FORM_COLUMNS)
        : 1;
    const authoredLabelMode = normalizeString(layout?.labels?.mode);
    const labelMode = LABEL_MODES.has(authoredLabelMode) ? authoredLabelMode : 'top';
    const collapseAt = normalizeString(layout?.collapseAt) === 'phone' ? 'phone' : undefined;

    return {
        ...layout,
        kind: 'grid',
        appearance: SCHEMA_FORM_FIELD_TRACKS_APPEARANCE,
        columns,
        dense: false,
        ...(collapseAt ? {collapseAt} : {collapseAt: undefined}),
        labels: {
            ...(layout?.labels || {}),
            mode: labelMode,
        },
    };
}

export function schemaFormAttributes(layout = {}) {
    const appearance = resolveSchemaFormAppearance(layout);
    return {
        'data-forge-part': 'form',
        ...(appearance ? {'data-forge-form-appearance': appearance} : {}),
    };
}
