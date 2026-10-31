import {evaluateReportCalculatedFieldExpression,parseReportCalculatedFieldExpression} from '../../reporting/calculatedFieldModel.js';
import {number,field,entries,sum,delta,ratio,read,scenarioState,validateBindings,checkedRows} from './scenarioShared.js';
const ratioAst=parseReportCalculatedFieldExpression('numerator / denominator').ast;
const quotient=inputs=>number(evaluateReportCalculatedFieldExpression(ratioAst,inputs),'Ratio metric');
export const stageMetricFields=metric=>metric.type==='ratio'?[metric.numeratorField,metric.denominatorField,metric.additionNumeratorField,metric.additionDenominatorField].filter(Boolean):[metric.field,metric.additionField].filter(Boolean);
export function normalizeStageAllocation(input) {
  if(!input||typeof input!=='object')throw new Error('stageAllocation configuration is required.');
  const config={...input};
  for(const key of ['periodField','stageField','categoryField'])field(config[key],key);
  for(const key of ['periods','stages','categories','metrics'])config[key]=entries(config[key],key);
  config.metrics.forEach(metric=>{
    if(metric.type!=null&&!['additive','ratio'].includes(metric.type))throw new Error('Unknown stage metric type.');
    if(metric.type==='ratio') {
      field(metric.numeratorField,'Ratio numerator field');field(metric.denominatorField,'Ratio denominator field');
      if(metric.field!=null||metric.additionField!=null)throw new Error('Ratio metrics require separate numerator and denominator inputs.');
      for(const key of ['additionNumeratorField','additionDenominatorField'])if(metric[key]!=null)field(metric[key],key);
    } else {
      field(metric.field,'Metric field');if(metric.additionField)field(metric.additionField,'Metric addition field');
      if(['numeratorField','denominatorField','additionNumeratorField','additionDenominatorField'].some(key=>metric[key]!=null))throw new Error('Ratio inputs require metric type ratio.');
    }
    if(typeof metric.unit!=='string')throw new Error('Metric unit is required.');
  });
  if(!config.periods.some(p=>p.id===config.baselinePeriod))throw new Error('Unknown baseline period.');
  validateBindings(config.stateBindings);return config;
}
export function buildStageAllocation(input,rows=[],suppliedState,filters={}) {
  const config=normalizeStageAllocation(input),state=scenarioState(config,filters,suppliedState);
  if(!config.periods.some(p=>p.id===state.period)||!config.metrics.some(m=>m.id===state.metric))throw new Error('Unknown stage period or metric.');
  state.activeCategories=state.activeCategories??[];
  if(!Array.isArray(state.activeCategories)||state.activeCategories.some(id=>!config.categories.some(c=>c.id===id&&c.inactive===true)))throw new Error('Only declared inactive categories may be added.');
  state.activeCategories=[...new Set(state.activeCategories)];
  const indexed=new Map();
  checkedRows(rows).forEach(row=>{
    const coordinates=['period','stage','category'].map(key=>read(row,config[`${key}Field`]));
    for(let i=0;i<3;i++)if(!config[['periods','stages','categories'][i]].some(v=>v.id===coordinates[i]))throw new Error('Undeclared stage coordinate.');
    const key=JSON.stringify(coordinates);if(indexed.has(key))throw new Error('Duplicate stage coordinate.');indexed.set(key,row);
    config.metrics.forEach(metric=>{
      stageMetricFields(metric).forEach(key=>number(read(row,key),'Stage metric input'));
      const measuredFields=metric.type==='ratio'?[metric.numeratorField,metric.denominatorField]:[metric.field];
      if(config.categories.find(c=>c.id===coordinates[2]).inactive&&measuredFields.some(key=>read(row,key)!=null&&read(row,key)!==0))throw new Error('Inactive category must have zero measured inputs.');
    });
  });
  const metric=config.metrics.find(m=>m.id===state.metric);
  const cellsFor=(stage,selectedMetric)=>config.categories.map(category=>{
    const row=indexed.get(JSON.stringify([state.period,stage.id,category.id]));
    const baselineRow=indexed.get(JSON.stringify([config.baselinePeriod,stage.id,category.id]));
    const active=state.activeCategories.includes(category.id);
    const get=(row,key)=>row&&key?number(read(row,key),'Stage metric input'):null;
    let measured,baseline,value,addition,inputs;
    if(selectedMetric.type==='ratio') {
      const measuredInputs={numerator:get(row,selectedMetric.numeratorField),denominator:get(row,selectedMetric.denominatorField)};
      const baselineInputs={numerator:get(baselineRow,selectedMetric.numeratorField),denominator:get(baselineRow,selectedMetric.denominatorField)};
      const additions={numerator:get(row,selectedMetric.additionNumeratorField),denominator:get(row,selectedMetric.additionDenominatorField)};
      const projectedInputs=active?{numerator:sum([measuredInputs.numerator,additions.numerator]),denominator:sum([measuredInputs.denominator,additions.denominator])}:measuredInputs;
      measured=quotient(measuredInputs);baseline=quotient(baselineInputs);value=quotient(projectedInputs);addition=delta(value,measured);
      inputs={measured:measuredInputs,baseline:baselineInputs,projected:projectedInputs,additions};
    } else {
      measured=get(row,selectedMetric.field);baseline=get(baselineRow,selectedMetric.field);addition=get(row,selectedMetric.additionField);
      value=active?sum([measured,addition]):measured;
    }
    return {id:category.id,label:category.label,inactive:category.inactive===true&&!active,active,measured,baseline,value,addition,delta:delta(value,baseline),missing:!row,...(inputs?{inputs}:{})};
  });
  const aggregate=(cells,selectedMetric,kind)=>selectedMetric.type==='ratio'?quotient({numerator:sum(cells.map(c=>c.inputs[kind].numerator)),denominator:sum(cells.map(c=>c.inputs[kind].denominator))}):sum(cells.map(c=>c[kind==='projected'?'value':kind]));
  const stages=config.stages.map(stage=>{
    const cells=cellsFor(stage,metric),total=aggregate(cells,metric,'projected'),baseline=aggregate(cells,metric,'baseline');
    // Ratio size compares individual finite ratios; it is not a contribution to
    // the weighted stage ratio. Undefined ratios have no proportional width.
    const sizeTotal=metric.type==='ratio'?sum(cells.filter(c=>c.value!=null).map(c=>c.value)):total;
    return {...stage,total,baseline,delta:delta(total,baseline),sizeTotal,cells:cells.map(c=>({...c,share:ratio(c.value,sizeTotal)}))};
  });
  const totals=config.metrics.map(m=>{const cells=config.stages.flatMap(s=>cellsFor(s,m)),value=aggregate(cells,m,'projected'),measured=aggregate(cells,m,'measured'),baseline=aggregate(cells,m,'baseline');return {...m,value,measured,baseline,delta:delta(value,baseline),increment:delta(value,measured)};});
  return {kind:'stage-allocation',config,state,metric,stages,totals,projected:state.activeCategories.length>0};
}
