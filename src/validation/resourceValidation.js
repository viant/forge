import {validateFieldRules} from './rules.js';
const same = (left, right) => {try {return JSON.stringify(left) === JSON.stringify(right);} catch (_) {return left === right;}};
function schemaForField(field = {}, schemas = {}) {
 const ref=String(field.$ref || field.ref || '').trim();
 if (!ref) return field;
 const result={...(schemas[ref] || {}),...field};delete result.$ref;delete result.ref;return result;
}

export function validateResource(value, schema = {}, schemas = {}, path = '$') {
  const errors = validateFieldRules(value, schema, {path});
  if (value == null) return schema.nullable ? errors : [...errors, `${path} cannot be null`];
  if (value === '' && schema.nullable) return errors;
  const type = String(schema.type || (schema.properties ? 'object' : '')).toLowerCase();
  if (type === 'object') {
    if (typeof value !== 'object' || Array.isArray(value)) return [`${path} must be an object`];
    for (const field of schema.required || []) if (value[field] === undefined || value[field] === null || value[field] === '') errors.push(`${path}.${field} is required`);
    for (const [field, fieldSchema] of Object.entries(schema.properties || {})) {
      const resolved = schemaForField(fieldSchema, schemas);
      if (!Object.hasOwn(value, field) && resolved.validation) errors.push(...validateFieldRules(undefined, resolved, {path: `${path}.${field}`, present: false}));
    }
    for (const [field, fieldValue] of Object.entries(value)) {
      const fieldSchema = schema.properties?.[field];
      if (!fieldSchema) {
        if (schema.additionalProperties === false) errors.push(`${path}.${field} is not declared`);
        continue;
      }
      errors.push(...validateResource(fieldValue, schemaForField(fieldSchema, schemas) || fieldSchema, schemas, `${path}.${field}`));
    }
    return errors;
  }
  if (type === 'array') {
    if (!Array.isArray(value)) return [`${path} must be an array`];
    if (schema.minItems != null && value.length < Number(schema.minItems)) errors.push(`${path} must contain at least ${schema.minItems} item(s)`);
    if (schema.maxItems != null && value.length > Number(schema.maxItems)) errors.push(`${path} must contain no more than ${schema.maxItems} item(s)`);
    value.forEach((entry, index) => errors.push(...validateResource(entry, schemaForField(schema.items || {}, schemas) || schema.items || {}, schemas, `${path}.${index}`)));
    return errors;
  }
  const booleanLike = typeof value === 'boolean' || value === 0 || value === 1 || ['true', 'false', '0', '1'].includes(String(value).trim().toLowerCase());
  if ((type === 'integer' && !Number.isInteger(Number(value))) || (type === 'number' && !Number.isFinite(Number(value))) || (type === 'boolean' && !booleanLike) || (type === 'string' && typeof value !== 'string')) errors.push(`${path} must be ${type}`);
  if (schema.enum?.length && !schema.enum.some((candidate) => same(candidate, value))) errors.push(`${path} is not an allowed value`);
  if ((type === 'integer' || type === 'number') && schema.minimum != null && Number(value) < Number(schema.minimum)) errors.push(`${path} must be at least ${schema.minimum}`);
  if ((type === 'integer' || type === 'number') && schema.maximum != null && Number(value) > Number(schema.maximum)) errors.push(`${path} must be no more than ${schema.maximum}`);
  if (type === 'string' && typeof value === 'string' && schema.minLength != null && [...value].length < Number(schema.minLength)) errors.push(`${path} is too short`);
  if (type === 'string' && typeof value === 'string' && schema.maxLength != null && [...value].length > Number(schema.maxLength)) errors.push(`${path} is too long`);
  return errors;
}
