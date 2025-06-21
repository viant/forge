// src/utils/schema.js
// Utility helpers for working with the tiny subset of JSON-Schema supported by Forge.

/*
 * jsonSchemaToFields(schema: object): FormField[]
 * -----------------------------------------------------------------------------
 * Transforms a minimal JSON-Schema (draft-07) **object** definition into an
 * array of `FormField` objects that `SchemaBasedForm` and the wider UI layer
 * can render.  The algorithm intentionally mirrors the Go implementation
 * (`backend/types/form.go`) so that both the frontend and backend produce
 * identical results from the same source schema.
 *
 * Supported property keywords:
 *   – type, description, enum, default
 *   – x-ui-order, x-ui-widget, x-ui-group (Forge vendor extensions)
 *
 * The function is deterministic: it applies a stable sort using
 *   1. explicit `x-ui-order` (ascending)
 *   2. fallback alphabetical key order
 */

// Consumers can register global mappers that can tweak or fully replace the
// field definition derived by the default algorithm.  A mapper receives
// `(field, propertySchema, rootSchema) => field | void`; returning a new object
// replaces the field, mutating it in-place works as well.
const globalMappers = [];

export function registerSchemaFieldMapper(fn) {
    if (typeof fn === 'function') {
        globalMappers.push(fn);
    }
}

export function jsonSchemaToFields(schema, { mappers = [] } = {}) {
    if (!schema || schema.type !== 'object') return [];

    const properties = schema.properties || {};

    // Stable iteration over property keys.
    const keys = Object.keys(properties);
    keys.sort((a, b) => {
        const pa = properties[a];
        const pb = properties[b];

        const orderA = pa['x-ui-order'] ?? 0;
        const orderB = pb['x-ui-order'] ?? 0;

        if (orderA !== orderB) return orderA - orderB;

        return a.localeCompare(b);
    });

    const allMappers = [...globalMappers, ...mappers];

    return keys.map((k) => {
        const p = properties[k] ?? {};

        // -------- label -------------------------------------------
        let label = p.description;
        if (!label || label.trim() === '') {
            label = k
                .replace(/[_\-]+/g, ' ')
                .replace(/([a-z])([A-Z])/g, '$1 $2')
                .replace(/^./, (c) => c.toUpperCase());
        }

        // -------- widget (default mapping) ------------------------
        let widget = p['x-ui-widget'];
        if (!widget || widget === '') {
            if (Array.isArray(p.enum) && p.enum.length > 0) {
                widget = 'select';
            } else {
                switch (p.type) {
                    case 'boolean':
                        widget = 'checkbox';
                        break;
                    case 'number':
                    case 'integer':
                        widget = 'number';
                        break;
                    case 'string': {
                        const d = (p.description || '').toLowerCase();
                        if (d.endsWith('file') || k.toLowerCase().endsWith('_file')) {
                            widget = 'file';
                        } else {
                            widget = 'text';
                        }
                        break;
                    }
                    default:
                        widget = 'text';
                }
            }
        }

        let field = {
            name: k,
            label,
            type: p.type,
            enum: p.enum,
            required: Array.isArray(schema.required) && schema.required.includes(k),
            default: p.default,
            widget,
            group: p['x-ui-group'] || '',
            order: p['x-ui-order'] || 0,
        };

        // allow mappers to adjust
        allMappers.forEach((fn) => {
            const res = fn(field, p, schema);
            if (res && typeof res === 'object') field = res;
        });

        return field;
    });
}

// ----------------------------------------------------------------------------
// Backwards-compatibility re-export used by legacy imports.
// ----------------------------------------------------------------------------

export const schemaToFields = jsonSchemaToFields;
