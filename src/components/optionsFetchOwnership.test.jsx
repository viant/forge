import {describe,expect,it} from 'vitest';
import {resolveDeferredDataSourceRefs,resolveLazyOptionsDataSourceRefs,resolveRequiredDataSourceRefs,shouldPrimeDataSourceFetch} from './WindowContent.jsx';
const lazy={id:'pick',type:'select',optionsDataSourceRef:'choices',optionsFetchMode:'onFocus'};
function fixture(items=[lazy]){return {dataSource:{record:{},choices:{dataSourceRef:'baseChoices'},baseChoices:{}},view:{content:{id:'root',dataSourceRef:'record',items}}};}
describe('lazy options startup ownership',()=>{
 it('mounts option handlers while suppressing only automatic reads, preserving immutable source metadata',()=>{
  const metadata=fixture();const before=JSON.stringify(metadata);Object.freeze(metadata.dataSource.choices);
  expect(resolveRequiredDataSourceRefs(metadata)).toEqual(['record','choices','baseChoices']);
  const deferred=resolveLazyOptionsDataSourceRefs(metadata);expect([...deferred]).toEqual(['choices','baseChoices']);
  expect(shouldPrimeDataSourceFetch(metadata.dataSource.choices,{},[],true,{},{deferAutomatic:deferred.has('choices')})).toBe(false);
  expect(shouldPrimeDataSourceFetch(metadata.dataSource.record,{},[],true,{},{deferAutomatic:deferred.has('record')})).toBe(true);
  expect(shouldPrimeDataSourceFetch(metadata.dataSource.choices,{fetch:true},[],false,{},{deferAutomatic:true})).toBe(true);
  expect(JSON.stringify(metadata)).toBe(before);
 });
 it('any shared eager consumer wins independent of traversal order, including title/default/business refs',()=>{
  const eager={id:'other',type:'select',optionsDataSourceRef:'choices'};
  for(const items of [[lazy,eager],[eager,lazy],[lazy,{dataSourceRef:'choices'}]])expect([...resolveLazyOptionsDataSourceRefs(fixture(items))]).toEqual([]);
  expect([...resolveLazyOptionsDataSourceRefs(fixture(),'choices')]).toEqual([]);
  const title=fixture();title.window={titleBinding:{dataSourceRef:'choices'}};expect([...resolveLazyOptionsDataSourceRefs(title)]).toEqual([]);
  const sharedParent=fixture();sharedParent.view.content.containers=[{dataSourceRef:'baseChoices'}];expect([...resolveLazyOptionsDataSourceRefs(sharedParent)]).toEqual(['choices']);
 });
 it('only the active window tab owns startup reads; switching to an eager tab retains its normal fetch',()=>{
  const metadata=fixture();metadata.view.content={id:'tabs',tabs:{renderActiveTabPanelOnly:true,defaultSelectedTabId:'lazy'},containers:[{id:'lazy',items:[lazy]},{id:'eager',items:[{type:'select',optionsDataSourceRef:'choices'}]}]};
  expect([...resolveLazyOptionsDataSourceRefs(metadata)]).toEqual(['choices','baseChoices']);
  expect([...resolveLazyOptionsDataSourceRefs(metadata,'',{}, {tabs:{tabs:'eager'}})]).toEqual([]);
  expect(resolveRequiredDataSourceRefs(metadata,'',{}, {tabs:{tabs:'eager'}})).toEqual(['choices','baseChoices']);
  metadata.view.content.tabs.renderActiveTabPanelOnly=false;expect([...resolveLazyOptionsDataSourceRefs(metadata)]).toEqual([]);
 });
 it('unrequested opt-in does not change ordinary select or fallback source behavior',()=>{
  expect([...resolveLazyOptionsDataSourceRefs(fixture([{type:'select',optionsDataSourceRef:'choices'}]))]).toEqual([]);
  expect([...resolveLazyOptionsDataSourceRefs(fixture([{...lazy,fallbackOptionsDataSourceRef:'choices'}]))]).toEqual([]);
 });
});

describe('explicit deferred consumers',()=>{
 it('defers manual bindings and inherited parents while active eager/default/title consumers win',()=>{
  const metadata=fixture([]);metadata.view.content.containers=[{dataSourceRef:'choices',fetchData:false}];
  expect([...resolveDeferredDataSourceRefs(metadata)]).toEqual(['choices','baseChoices']);
  metadata.view.content.containers.push({dataSourceRef:'choices',fetchData:true});expect([...resolveDeferredDataSourceRefs(metadata)]).toEqual([]);
  metadata.view.content.containers.reverse();expect([...resolveDeferredDataSourceRefs(metadata)]).toEqual([]);
  metadata.view.content.containers=[{dataSourceRef:'choices',fetchData:false}];expect([...resolveDeferredDataSourceRefs(metadata,'choices')]).toEqual([]);
  metadata.window={titleBinding:{dataSourceRef:'choices'}};expect([...resolveDeferredDataSourceRefs(metadata)]).toEqual([]);
 });
 it('explicit false on items and dynamically mapped nodes retains references without automatic fetch ownership',()=>{
  const metadata=fixture([{id:'manual',dataSourceRef:'choices',fetchData:false}]);expect([...resolveDeferredDataSourceRefs(metadata)]).toEqual(['choices','baseChoices']);
  metadata.view.content.items=[];metadata.view.content.containers=[{fetchData:false,dataSourceRefSelector:'mode',dataSourceRefs:{pick:'choices'}}];expect([...resolveDeferredDataSourceRefs(metadata,'',{mode:'pick'})]).toEqual(['choices','baseChoices']);
 });
});
