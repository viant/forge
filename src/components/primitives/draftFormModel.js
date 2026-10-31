// Draft mechanics shared by the view and its focused lifecycle tests.
import {validateResource} from '../../validation/index.js';
export const draftSnapshot = (value) => JSON.stringify(value || {});

export function validateDraft(spec, context, form) {
  if (spec.validation) {
    const ref = typeof spec.validation.schemaRef === 'string' ? spec.validation.schemaRef.trim() : '';
    const schemas = context?.metadata?.schemas || {};
    if (!ref || !Object.hasOwn(schemas, ref) || String(schemas[ref]?.type || '').toLowerCase() !== 'object') return `Draft validation schema is unavailable: ${ref || '(missing schemaRef)'}.`;
    try {
      const errors = validateResource(form, schemas[ref], schemas);
      if (errors.length) return errors.join('; ');
    } catch (error) {
      return error?.message || 'Draft schema validation failed.';
    }
  }
  if (!spec.validate) return '';
  const handler = context?.lookupHandler?.(spec.validate);
  if (typeof handler !== 'function') return 'Form validation is unavailable.';
  try {
    const result = handler({context, form});
    if (result?.then) return 'Form validation must be synchronous.';
    if (result === false) return 'Review the highlighted fields before saving.';
    return typeof result === 'string' ? result : '';
  } catch (error) {
    return error?.message || 'Form validation failed.';
  }
}

export function resetDraft(context, baseline, busy) {
  if (busy) return false;
  context?.handlers?.dataSource?.setFormData?.({values: JSON.parse(baseline || '{}')});
  context?.handlers?.dataSource?.resetFormDirty?.();
  return true;
}

const acceptedDraftBaselines = new WeakMap();
export function retainedDraftBaseline(owner, fallback) {
  return owner && typeof owner === 'object' ? acceptedDraftBaselines.get(owner)?.snapshot ?? fallback : fallback;
}
export function retainDraftBaseline(owner, snapshot, version) {
  if(owner && typeof owner === 'object') acceptedDraftBaselines.set(owner,{snapshot,version});
}
