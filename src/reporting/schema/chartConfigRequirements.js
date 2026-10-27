// The chart type and its required authored configuration travel together at
// both spec and resolved model boundaries. Other chart types remain unchanged.
const typedRequirements = [
  ['category-range','categoryRange'],
  ['heatmap','heatmap'],
].map(([type,field])=>({
  if:{type:'object',required:['type'],properties:{type:{const:type}}},
  then:{type:'object',required:[field]},
}));

export const chartConfigRequirements=[...typedRequirements,{if:{type:"object",required:["center"]},then:{type:"object",properties:{type:{const:"donut"}}}}];
