// Proportional, producer-authored child tracks shared by screen and print.
// Keys are block IDs, so visibility changes never shift weights to another child.
export function compositeChildWeights(block, children) {
  const runtime = block?.content?.runtime || block?.runtime || {};
  if (runtime.childWeights == null) return null;
  if (typeof runtime.childWeights !== 'object' || Array.isArray(runtime.childWeights)) throw Error('Composite childWeights must be an object');
  const declared = block?.content?.childBlockIds || block?.childBlockIds || [];
  if (Object.keys(runtime.childWeights).length !== declared.length || declared.some(id => !Number.isFinite(runtime.childWeights[id]) || runtime.childWeights[id] <= 0)) throw Error('Composite childWeights must provide a positive finite weight for every child');
  const weights = children.map(child => runtime.childWeights[child.id]);
  if (weights.some(weight => !Number.isFinite(weight))) throw Error('Composite child is missing a weight');
  const total = weights.reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(total)) throw Error('Composite childWeights total is invalid');
  return weights.map(weight => weight / total);
}

export function compositeBare(block) {
  return (block?.content?.runtime || block?.runtime || {}).chrome === 'none';
}

export function compositeWeightedTemplate(block, children, width) {
  const weights=compositeChildWeights(block,children);
  if(!weights)return null;
  const runtime=block?.content?.runtime||block?.runtime||{};
  const minimum=Number.isFinite(runtime.minColumnWidth)&&runtime.minColumnWidth>0?Math.max(40,runtime.minColumnWidth):240;
  const available=Math.max(0,width-16*Math.max(0,children.length-1));
  if(width>0&&children.some((child,index)=>(child?.runtime?.spacerHeight??child?.content?.runtime?.spacerHeight)==null&&weights[index]*available<minimum))return 'minmax(0, 1fr)';
  return weights.map(weight=>`minmax(0, ${weight}fr)`).join(' ');
}
