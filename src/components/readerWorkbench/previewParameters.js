import {parseEditorValue} from '../editorValue.js';

// This is request serialization, not schema/contract validation. Datly owns
// requiredness, ranges, formats, defaults and business validation.
export function previewParameterKind(schema = {}) {
  if (schema.anyOf || schema.oneOf || schema.allOf || schema.$ref) return 'json';
  if (Array.isArray(schema.enum) && schema.enum.every(value => value === null || ['string','number','boolean'].includes(typeof value))) return 'enum';
  if (schema.type === 'string') return 'string';
  if (schema.type === 'boolean') return 'boolean';
  if (schema.type === 'number' || schema.type === 'integer') return 'number';
  return 'json';
}

export function serializePreviewParameters(properties, drafts) {
  const input = {}, errors = {};
  for (const [name, schema] of Object.entries(properties)) {
    const draft = drafts[name];
    if (!draft?.supplied) continue;
    try {
      const kind = previewParameterKind(schema);
      let value = draft.text ?? '';
      if (kind === 'number') {
        value = JSON.parse(value);
        if (typeof value !== 'number' || !Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))) {
          throw new Error('Enter a number that can be represented without losing precision.');
        }
      } else if (kind === 'boolean') value = value === 'true';
      else if (kind === 'enum' || kind === 'json') value = parseEditorValue(value, 'json');
      Object.defineProperty(input, name, {value, enumerable: true});
    } catch (cause) {
      errors[name] = previewParameterKind(schema) === 'number'
        ? 'Enter a valid JSON number that can be represented without losing precision.'
        : cause.message;
    }
  }
  return {input, errors};
}
