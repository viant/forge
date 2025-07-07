// src/utils/schemaExplorer.js
// ----------------------------------------------------------------------------
// JSON-Schema ➜ flat hierarchical row model used by SchemaExplorer.
// ----------------------------------------------------------------------------
// The algorithm purposefully focuses on the *very small* subset of draft-07
// supported elsewhere in Forge: we only care about an **object** at the root
// and its nested properties (either objects themselves or primitive leaves).
// All other keywords are ignored.
//
// Row structure returned by `jsonSchemaToRows`:
// {
//   id:         string        // dot-notation path, unique & stable
//   level:      number        // depth (root = 0)
//   name:       string        // property key (no path)
//   type:       string        // e.g. "string", "array<object>"
//   default?:   any
//   enum?:      any[]
//   description?: string
//   children?:  Row[]         // present for nested objects
// }
//
// The utility is deterministic: property iteration order is guaranteed by
// applying the same stable sort used in jsonSchemaToFields.

// Consumers may register global row-mappers that can tweak or replace rows.
const globalMappers = [];

export function registerSchemaRowMapper(fn) {
    if (typeof fn === 'function') {
        globalMappers.push(fn);
    }
}

/**
 * Stable helper – sort keys by explicit x-ui-order then alphabetically.
 */
function sortPropertyKeys(properties) {
    const keys = Object.keys(properties);
    keys.sort((a, b) => {
        const pa = properties[a] ?? {};
        const pb = properties[b] ?? {};

        const orderA = pa['x-ui-order'] ?? 0;
        const orderB = pb['x-ui-order'] ?? 0;

        if (orderA !== orderB) return orderA - orderB;
        return a.localeCompare(b);
    });
    return keys;
}

/**
 * Derive a human-readable type string for primitive, array & nested object
 * schemas.  The result is used purely for documentation, not validation.
 */
function deriveType(schema) {
    if (!schema || typeof schema !== 'object') return 'unknown';

    // Arrays – include item type if available for better readability.
    if (schema.type === 'array') {
        const items = schema.items || {};
        if (items.type) {
            // object → object, otherwise primitive.
            return `array<${items.type}>`;
        }
        return 'array';
    }

    // Fallback – primitive or object directly supplied.
    return schema.type || 'object';
}

// Simplified widget inference – mirrors jsonSchemaToFields but without groups
function deriveWidget(k, prop) {
    // 1. explicit override
    if (prop['x-ui-widget']) return prop['x-ui-widget'];

    // 2. format mapping
    if (prop.format === 'uri' && !(prop.default && /^http/i.test(prop.default))) {
        return 'file';
    }
    if (prop.format === 'password') return 'password';
    if (prop.format === 'date') return 'date';
    if (prop.format === 'date-time' || prop.format === 'datetime') return 'datetime';
    if (prop.format === 'json') return 'object';

    // 3. enum
    if (Array.isArray(prop.enum) && prop.enum.length) return 'select';

    // 4. fallback by type
    if (prop.type === 'array') {
        if (prop.items && prop.items.type === 'object') return 'object';
        return 'array';
    }

    switch (prop.type) {
        case 'boolean':
            return 'checkbox';
        case 'number':
        case 'integer':
            return 'number';
        case 'string': {
            const d = (prop.description || '').toLowerCase();
            if (d.endsWith('file') || k.toLowerCase().endsWith('_file')) return 'file';
            return 'text';
        }
        case 'object':
            return 'object';
        case 'schema':
            return 'schema';
        default:
            return 'text';
    }
}

function adjustRows(rowsArr, prefix, levelDelta) {
    rowsArr.forEach((r) => {
        r.id = `${prefix}.${r.id}`;
        r.level = (r.level || 0) + levelDelta;
        if (Array.isArray(r.children) && r.children.length) {
            adjustRows(r.children, prefix, levelDelta);
        }
    });
}

/**
 * @param {object} schema – JSON-Schema object (expects root.type === 'object')
 * @param {object} [opts]
 * @param {Array<Function>} [opts.mappers] – extra row mappers
 * @returns {Array<object>} rows (see header comment)
 */
export function jsonSchemaToRows(schema, { mappers = [] } = {}) {
    if (!schema || schema.type !== 'object') return [];

    const rows = [];
    const allMappers = [...globalMappers, ...mappers];

    function visitObject(objSchema, pathParts, level) {
        if (!objSchema || objSchema.type !== 'object') return;

        const properties = objSchema.properties || {};
        const keys = sortPropertyKeys(properties);

        keys.forEach((key) => {
            const propSchema = properties[key] || {};

            const rowPath = [...pathParts, key];
            const id = rowPath.join('.');

            let row = {
                id,
                level,
                name: key,
                type: deriveType(propSchema),
            };

            // widget mapping
            row.widget = deriveWidget(key, propSchema);

            if (propSchema.default !== undefined) {
                row.default = propSchema.default;
            }

            if (Array.isArray(propSchema.enum) && propSchema.enum.length > 0) {
                row.enum = propSchema.enum;
            }

            if (propSchema.description) {
                row.description = propSchema.description;
            }

            if (propSchema.format) {
                row.format = propSchema.format;
            }

            // Handle nested structures -----------------------------------
            // -----------------------------------------------------------
            // Collect child rows (nested object or array<object>)
            // -----------------------------------------------------------
            let childRows = [];

            if (propSchema.type === 'object') {
                childRows = jsonSchemaToRows(propSchema, { mappers });
                const basePath = rowPath.join('.');
                adjustRows(childRows, basePath, level + 1);
            } else if (
                propSchema.type === 'array' &&
                propSchema.items &&
                propSchema.items.type === 'object'
            ) {
                const arrayItemRows = jsonSchemaToRows(propSchema.items, { mappers });
                const basePath = [...pathParts, `${key}[]`].join('.');
                adjustRows(arrayItemRows, basePath, level + 1);
                childRows = arrayItemRows;
            }

            if (childRows && childRows.length) {
                row.children = childRows;
            }

            // Allow user mappers to mutate or replace the row -------------
            allMappers.forEach((fn) => {
                const res = fn(row, propSchema, objSchema);
                if (res && typeof res === 'object') row = res;
            });

            rows.push(row);
        });
    }

    visitObject(schema, [], 0);
    return rows;
}

// Backwards-compatibility fallback export (mirrors pattern of schema.js)
export const schemaToRows = jsonSchemaToRows;
