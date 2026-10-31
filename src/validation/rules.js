// Bounded counterparts of github.com/viant/govalidator v0.3.3. The producer
// normalizes tags; no backend request or executable rule is needed per edit.
const domain = /(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]/;
const supported = new Set(['required', 'le', 'ge', 'lt', 'gt', 'choice', 'domain']);

export function validateFieldRules(value, schema = {}, {path = '$', present = value !== undefined} = {}) {
 const spec = schema.validation;
 if (!spec) return [];
 const errors = [];
 if (spec.checks !== undefined && !Array.isArray(spec.checks)) return [`${path}: validation.checks must be an array`];
 const checks = spec.checks || [];
 for (const check of checks) {
  if (!check || typeof check !== 'object') {errors.push(`${path}: invalid validation check`);continue;}
  if (check.parameters !== undefined && (!Array.isArray(check.parameters) || check.parameters.some(arg => typeof arg !== 'string'))) {errors.push(`${path}: invalid validator parameters`);continue;}
  if (!supported.has(check.name)) errors.push(`${path}: unsupported validator ${check.name}; use an explicit validation hook`);
  else if (['le','ge','lt','gt'].includes(check.name) && (check.parameters?.length !== 1 || !/^-?\d+$/.test(check.parameters[0]) || !Number.isSafeInteger(Number(check.parameters[0])))) errors.push(`${path}: invalid ${check.name} bound`);
  else if (check.name === 'choice' && !check.parameters?.length) errors.push(`${path}: empty ${check.name} choices`);
 }
 if (errors.length || (spec.presenceOnly && !present)) return errors;
 const type = String(schema.type || '').toLowerCase();
 // Missing Go scalar fields decode to their zero value. Pointers retain nil.
 const current = value === undefined && !spec.pointer ? ({string:'',integer:0,number:0,boolean:false}[type] ?? value) : value;
 // Native omitempty skips nil/empty string, not scalar false/0.
 if (spec.omitEmpty && (current == null || current === '')) return errors;
 for (const check of checks) {
  const args = check.parameters || [];
  let valid = true;
  if (check.name === 'required') valid = spec.pointer ? current != null : current != null && current !== '' && current !== false && current !== 0 && (!Array.isArray(current) || current.length > 0);
  else if (check.name === 'domain') valid = typeof current === 'string' && domain.test(current);
  else if (check.name === 'choice') {
   valid = type === 'string' ? typeof current === 'string' && args.includes(current)
    : type === 'integer' && Number.isSafeInteger(current) && args.some(arg => /^-?\d+$/.test(arg) && Number(arg) === current);
  } else {
   const actual = type === 'string' && typeof current === 'string' ? [...current].length
    : (type === 'integer' || type === 'number') && typeof current === 'number' && Number.isFinite(current) ? current
    : type === 'array' && Array.isArray(current) ? current.length : NaN;
   const bound = Number(args[0]);
   valid = check.name === 'le' ? actual <= bound : check.name === 'ge' ? actual >= bound : check.name === 'lt' ? actual < bound : actual > bound;
  }
  if (!valid) errors.push(check.message || `${path} failed ${check.name}`);
 }
 return errors;
}
