export const ruleChildren = (node, spec) => Array.isArray(node?.[spec.childrenField || 'children']) ? node[spec.childrenField || 'children'] : [];
export const sameRuleChoice = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
export function changeRule(root, path, transform, spec = {}) {
  if (!root || typeof root !== 'object') throw new Error('A rule tree is required.');
  if (!path.length) return transform(root);
  const [index, ...rest] = path, children = ruleChildren(root, spec);
  if (!Number.isInteger(index) || index < 0 || index >= children.length) throw new Error('Rule path is no longer available.');
  return {...root, [spec.childrenField || 'children']: children.map((child, i) => i === index ? changeRule(child, rest, transform, spec) : child)};
}
export function removeRule(root, path, spec = {}) {
  if (!path.length) throw new Error('The root rule group cannot be removed.');
  return changeRule(root, path.slice(0, -1), node => ({...node, [spec.childrenField || 'children']: ruleChildren(node, spec).filter((_, i) => i !== path.at(-1))}), spec);
}
export function ruleOperators(node, spec, options) {
  const field = (options.fields || []).find(item => sameRuleChoice(item.value, node?.[spec.parameterField || 'field']));
  return field?.operators ? (options.operators || []).filter(item => field.operators.some(value => sameRuleChoice(value, item.value))) : options.operators || [];
}
export function newEditorRule(spec = {}, options = {}, group = false) {
  const leaf = {...(spec.defaultRule || {})};
  if (!group) return leaf;
  return {...leaf, [spec.operatorField || 'operator']: options.groups?.[0]?.value ?? null, [spec.parameterField || 'field']: null, [spec.valueField || 'value']: null, [spec.childrenField || 'children']: [newEditorRule(spec, options)]};
}
