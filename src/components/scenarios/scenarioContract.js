import {escape,display,graphic} from './scenarioShared.js';
import {normalizeRoutingImpact,buildRoutingImpact} from './routingImpact.js';
import {normalizeStageAllocation,buildStageAllocation,stageMetricFields} from './stageAllocation.js';
import {routingImpactSvg,stageAllocationSvg} from './scenarioSvg.js';
export const isScenarioType=type=>['routing-impact','stage-allocation'].includes(type);
export const scenarioKey=type=>type==='routing-impact'?'routingImpact':'stageAllocation';
export const normalizeScenario=(type,config)=>type==='routing-impact'?normalizeRoutingImpact(config):normalizeStageAllocation(config);
export function scenarioFields(type,config) {
  return type==='routing-impact'?[config.idField,config.sourceField,config.destinationField,config.categoryField,config.routeField,config.amountField,config.eligibleField,config.baselineShareField,config.directLossField,config.indirectLossField,...(config.expressionFields||[])]:[config.periodField,config.stageField,config.categoryField,...config.metrics.flatMap(stageMetricFields)];
}
export function buildScenario(type,config,rows,state,filters) {
  return type==='routing-impact'?buildRoutingImpact(config,rows,state,filters):buildStageAllocation(config,rows,state,filters);
}
export function freezeScenario(chart,rows,filters) {
  const type=chart.type,model=buildScenario(type,chart[scenarioKey(type)],rows,undefined,filters);
  return {kind:type,type,seriesKeys:scenarioFields(type,model.config),rows:JSON.parse(JSON.stringify(rows)),scenarioState:JSON.parse(JSON.stringify(model.state))};
}
export function scenarioPrintSvg(chart,resolved,width) {
  const model=buildScenario(chart.type,chart[scenarioKey(chart.type)],resolved.rows,resolved.scenarioState);
  return renderScenarioPrintModel(model,width);
}
function renderScenarioPrintModel(model,width,compact=false) {
  const rendered=model.kind==='routing-impact'?routingImpactSvg(model,width,{compact}):stageAllocationSvg(model,width);
  // Canonical PDF consumes flat, explicit SVG marks rather than browser CSS.
  return flattenScenarioGraphic(rendered);
}
function flattenScenarioGraphic(rendered) {
  const svg=rendered.svg.replace(/<style>[\s\S]*?<\/style>/g,'').replace(/<title>[\s\S]*?<\/title>/g,'').replace(/<\/?g\b[^>]*>/g,'').replace(/var\(--[^,]+,\s*(#[0-9a-fA-F]{6})\)/g,'$1').replace(/currentColor/g,'#25313c').replace(/<text /g,'<text font-family="sans-serif" font-size="12" fill="#25313c" ');
  return {...rendered,svg};
}
const namedEntries={type:'array',minItems:1,maxItems:100,items:{type:'object',required:['id','label'],properties:{id:{type:'string',minLength:1},label:{type:'string',minLength:1}}}};
const bindings={type:'object',additionalProperties:{type:'object',additionalProperties:false,required:['paramId','path'],properties:{paramId:{type:'string',minLength:1},path:{type:'string',minLength:1}}}};
export const routingImpactSchema={type:'object',additionalProperties:false,required:['idField','sourceField','destinationField','categoryField','routeField','amountField','eligibleField','baselineShareField','directLossField','indirectLossField','categories','presets','unit','outcomeLabel','outcomeUnit','outcomeExpression','state'],properties:{...Object.fromEntries(['idField','sourceField','destinationField','categoryField','routeField','amountField','eligibleField','baselineShareField','directLossField','indirectLossField','unit','outcomeLabel','outcomeUnit','directLabel','lossLabel'].map(k=>[k,{type:'string'}])),categories:namedEntries,presets:namedEntries,outcomeExpression:{type:'string',minLength:1,maxLength:4000},expressionFields:{type:'array',items:{type:'string'}},state:{type:'object'},stateBindings:bindings}};
const metricBase={id:{type:'string',minLength:1},label:{type:'string',minLength:1},unit:{type:'string'}};
const stageMetricsSchema={type:'array',minItems:1,maxItems:100,items:{oneOf:[
  {type:'object',additionalProperties:false,required:['id','label','field','unit'],properties:{...metricBase,type:{const:'additive'},field:{type:'string',minLength:1},additionField:{type:'string',minLength:1}}},
  {type:'object',additionalProperties:false,required:['id','label','type','numeratorField','denominatorField','unit'],properties:{...metricBase,type:{const:'ratio'},numeratorField:{type:'string',minLength:1},denominatorField:{type:'string',minLength:1},additionNumeratorField:{type:'string',minLength:1},additionDenominatorField:{type:'string',minLength:1}}},
]}};
export const stageAllocationSchema={type:'object',additionalProperties:false,required:['periodField','stageField','categoryField','periods','stages','categories','metrics','baselinePeriod','state'],properties:{...Object.fromEntries(['periodField','stageField','categoryField','baselinePeriod'].map(k=>[k,{type:'string'}])),periods:namedEntries,stages:namedEntries,categories:namedEntries,metrics:stageMetricsSchema,state:{type:'object'},stateBindings:bindings}};
// Adapt controls to the existing report scope mutation contract. Array controls
// toggle one declared option, preserving the scope handler's validation/fetching.
export function scenarioScopeChange(config,params,handlers,key,value) {
  const binding=config.stateBindings?.[key],param=params.get(binding?.paramId);
  if(!param||!handlers?.canEditScopeParam?.(param))return false;
  if(param.kind==='select') {
    if(param.multiple) {
      const before=Array.isArray(param.value)?param.value:[],after=Array.isArray(value)?value:[];
      const changed=[...new Set([...before,...after])].filter(v=>before.includes(v)!==after.includes(v));
      if(changed.length!==1)throw new Error('A scenario category update must toggle one scope option.');
      return handlers.toggleScopeParamOption(param,changed[0]);
    }
    return handlers.toggleScopeParamOption(param,value);
  }
  return handlers.setScopeParamValue(param,value);
}


export function scenarioScopeHandler(config,authoredParams=[],currentParams=new Map(),handlers) {
  const params=new Map(authoredParams.map(param=>[param.id,{...param,...currentParams.get(param.id)}]));
  // Optional state defaults do not imply that their controls have bindings.
  const keys=config.presets?['share','categories']:['period','metric','activeCategories'];
  const canChange=key=>{
    if(!keys.includes(key))return false;
    const param=params.get(config.stateBindings?.[key]?.paramId);
    return !!param && !!handlers?.canEditScopeParam?.(param) && typeof handlers[param.kind==='select'?'toggleScopeParamOption':'setScopeParamValue']==='function';
  };
  if(!keys.some(canChange))return null;
  const change=(key,value)=>canChange(key)?scenarioScopeChange(config,params,handlers,key,value):false;
  change.canChange=canChange;
  return change;
}

// Paginate complete semantic units. Native PDF does not clip to an SVG viewBox,
// so a continuation must not contain off-page marks from another page.
export function scenarioPrintPages(chart,resolved,{width=680,maxHeight=620,firstMaxHeight=maxHeight}={}) {
  if(!Number.isFinite(maxHeight)||maxHeight<=0||!Number.isFinite(firstMaxHeight)||firstMaxHeight<=0)throw new Error('Scenario print page requires positive finite heights.');
  const model=buildScenario(chart.type,chart[scenarioKey(chart.type)],resolved.rows,resolved.scenarioState),pages=[];
  const units=model.kind==='routing-impact'?model.destinations:model.stages;
  const fragment=values=>model.kind==='routing-impact'?{...model,destinations:values,paths:model.paths.filter(p=>values.some(d=>d.id===p.destination))}:{...model,stages:values};
  let offset=0;
  while(offset<Math.max(1,units.length)) {
    const budget=pages.length?maxHeight:firstMaxHeight;
    let accepted=null,count=0;
    for(let end=offset+1;end<=Math.max(1,units.length);end++) {
      const candidate=renderScenarioPrintModel(fragment(units.slice(offset,end)),width,true);
      if(candidate.height>budget)break;
      accepted=candidate;count=end-offset;
    }
    if(!accepted&&pages.length===0&&budget<maxHeight) {
      const candidate=renderScenarioPrintModel(fragment(units.slice(offset,offset+1)),width,true);
      if(candidate.height<=maxHeight){accepted={...candidate,startNewPage:true};count=1;}
    }
    if(!accepted)return [{svg:'',height:0,diagnostics:[{code:'scenarioPrintLayoutDoesNotFit',severity:'warning',message:'Scenario print page cannot fit one complete destination flow or stage. Aggregate source paths or increase the page dimensions.'}]}];
    if(units.length>count) {
      const label=`${model.kind==='routing-impact'?'Destination flows':'Stages'} ${offset+1}–${offset+count} of ${units.length}; headline totals cover the complete scenario.`;
      accepted.svg=accepted.svg.replace('</svg>',`<text x="10" y="${accepted.height-12}" font-size="12" fill="#25313c">${escape(label)}</text></svg>`);
    }
    pages.push(accepted);offset+=count;
  }
  // Preserve every visible metric in readable evidence pages, including narrow
  // zero-width blocks whose labels cannot be placed inside the proportional mark.
  const percent=value=>value==null?'No data':`${display(value*100)}%`;
  const lines=model.kind==='routing-impact'?model.destinations.map(d=>`${d.id}: delivered ${display(d.delivered)} ${model.config.unit}; share ${percent(d.share)}; direct ${d.eligible?percent(d.directShare):'ineligible'}; ${model.config.outcomeLabel} ${display(d.outcome)} ${model.config.outcomeUnit}`):model.stages.flatMap(stage=>stage.cells.map(c=>`${stage.label} / ${c.label}${c.inactive?' (inactive)':''}: ${display(c.value)} ${model.metric.unit}; ${model.metric.type==='ratio'?'relative ratio size':'share'} ${percent(c.share)}; baseline ${display(c.baseline)}; change ${display(c.delta)}`));
  const wrapped=lines.flatMap(line=>{
    const result=[];let current='';
    for(const word of line.split(/\s+/)) {
      if(current&&current.length+word.length+1>85){result.push(current);current='';}
      const chunks=Array.from(word).reduce((parts,char,index)=>{const key=Math.floor(index/85);parts[key]=(parts[key]||'')+char;return parts;},[]);
      while(chunks.length>1)result.push(chunks.shift());
      current=current?`${current} ${chunks[0]||''}`:(chunks[0]||'');
    }
    if(current)result.push(current);return result;
  });
  const capacity=Math.floor((maxHeight-65)/20);
  if(wrapped.length&&capacity<1)return [{svg:'',height:0,diagnostics:[{code:'scenarioPrintLayoutDoesNotFit',severity:'warning',message:'Scenario print page cannot fit evidence text.'}]}];
  for(let start=0;start<wrapped.length;start+=capacity) {
    const current=wrapped.slice(start,start+capacity),body=`<text x="10" y="22">Frozen scenario evidence</text>`+current.map((line,index)=>`<text x="10" y="${50+index*20}">${escape(line)}</text>`).join('');
    pages.push(flattenScenarioGraphic(graphic(body,Math.max(680,width),65+current.length*20,'Frozen scenario evidence')));
  }
  return pages;
}
