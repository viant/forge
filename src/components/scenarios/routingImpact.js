import {evaluateReportCalculatedFieldExpression,parseReportCalculatedFieldExpression} from '../../reporting/calculatedFieldModel.js';
import {number,field,entries,sum,delta,ratio,read,scenarioState,validateBindings,checkedRows} from './scenarioShared.js';
export function normalizeRoutingImpact(input) {
  if(!input || typeof input!=='object')throw new Error('routingImpact configuration is required.');
  const config={...input};
  for(const key of ['idField','sourceField','destinationField','categoryField','routeField','amountField','eligibleField','baselineShareField','directLossField','indirectLossField'])field(config[key],key);
  config.categories=entries(config.categories,'Routing categories');
  config.presets=entries(config.presets,'Routing presets').map(p=>({...p,share:number(p.share,'Preset share',{nullable:false,max:1})}));
  if(typeof config.unit!=='string' || typeof config.outcomeLabel!=='string' || typeof config.outcomeUnit!=='string')throw new Error('Routing units and outcomeLabel are required.');
  if(typeof config.outcomeExpression!=='string' || !config.outcomeExpression || config.outcomeExpression.length>4000)throw new Error('Routing requires a bounded authored outcomeExpression.');
  (config.expressionFields||[]).forEach(key=>field(key,'Expression field'));
  const reserved=['scenarioAmount','scenarioShare','scenarioDirect','scenarioIndirect','scenarioLoss','scenarioDelivered'];
  const mapped=Object.keys(config).filter(key=>key.endsWith('Field')).map(key=>config[key]);
  for(const dependency of parseReportCalculatedFieldExpression(config.outcomeExpression).dependencies) if(!reserved.includes(dependency)&&!mapped.includes(dependency)&&!(config.expressionFields||[]).includes(dependency))throw new Error(`Undeclared outcome expression field: ${dependency}`);
  validateBindings(config.stateBindings);
  return config;
}
export function buildRoutingImpact(input, rows=[], suppliedState, filters={}) {
  const config=normalizeRoutingImpact(input), state=scenarioState(config,filters,suppliedState);
  const outcomeAst=parseReportCalculatedFieldExpression(config.outcomeExpression).ast;
  state.share=number(state.share,'Eligible routed share',{nullable:false,max:1});
  const categories=state.categories ?? config.categories.map(c=>c.id);
  if(!Array.isArray(categories) || categories.some(id=>!config.categories.some(c=>c.id===id)))throw new Error('Unknown routing category.');
  state.categories=[...new Set(categories)];
  const ids=new Set();
  const selected=checkedRows(rows).filter(row=>{
    const id=read(row,config.idField);
    if(typeof id!=='string'||!id||ids.has(id))throw new Error('Routing rows require unique stable IDs.');ids.add(id);
    if(!config.categories.some(c=>c.id===read(row,config.categoryField)))throw new Error('Undeclared routing category.');
    for(const key of ['sourceField','destinationField','routeField'])if(typeof read(row,config[key])!=='string'||!read(row,config[key]))throw new Error(`Missing ${key}.`);
    if(read(row,config.routeField)===(config.directLabel||'Direct') || read(row,config.destinationField)==='__loss')throw new Error('Routing label collides with a reserved node identity.');
    return categories.includes(read(row,config.categoryField));
  });
  const project=(row,share)=>{
    const amount=number(read(row,config.amountField),'Routing amount');
    const eligible=read(row,config.eligibleField);if(typeof eligible!=='boolean')throw new Error('Routing eligibility must be boolean.');
    const directRate=number(read(row,config.directLossField),'Direct loss coefficient',{max:1});
    const indirectRate=number(read(row,config.indirectLossField),'Indirect loss coefficient',{max:1});
    const routedShare=eligible?share:0;
    const direct=amount==null?null:amount*routedShare,indirect=amount==null?null:amount-direct;
    const directLoss=direct===0?0:direct==null||directRate==null?null:direct*directRate;
    const indirectLoss=indirect===0?0:indirect==null||indirectRate==null?null:indirect*indirectRate;
    const loss=sum([directLoss,indirectLoss]),delivered=amount==null||loss==null?null:amount-loss;
    const outcome=number(evaluateReportCalculatedFieldExpression(outcomeAst,{...row,scenarioAmount:amount,scenarioShare:routedShare,scenarioDirect:direct,scenarioIndirect:indirect,scenarioLoss:loss,scenarioDelivered:delivered}),'Projected outcome');
    return {amount,direct,indirect,directLoss,indirectLoss,loss,delivered,outcome};
  };
  const paths=selected.map(row=>{
    const eligible=read(row,config.eligibleField),baselineShare=number(read(row,config.baselineShareField),'Baseline share',{nullable:false,max:1});
    if(!eligible && baselineShare!==0)throw new Error('Ineligible routing row has a nonzero baseline share.');
    return {id:read(row,config.idField),source:read(row,config.sourceField),destination:read(row,config.destinationField),route:read(row,config.routeField),category:read(row,config.categoryField),eligible,row,projected:project(row,state.share),baseline:project(row,baselineShare)};
  });
  const aggregate=paths=>Object.fromEntries(['amount','direct','indirect','loss','delivered','outcome'].map(key=>[key,sum(paths.map(p=>p[key]))]));
  const projected=aggregate(paths.map(p=>p.projected)),baseline=aggregate(paths.map(p=>p.baseline));
  const destinations=[...new Set(paths.map(p=>p.destination))].map(id=>{const values=paths.filter(p=>p.destination===id);const metrics=aggregate(values.map(p=>p.projected));return {id,...metrics,share:ratio(metrics.delivered,projected.delivered),directShare:ratio(metrics.direct,metrics.amount),eligible:values.some(p=>p.eligible)};});
  return {kind:'routing-impact',config,state,paths,destinations,projected,baseline,outcomeDelta:delta(projected.outcome,baseline.outcome)};
}
