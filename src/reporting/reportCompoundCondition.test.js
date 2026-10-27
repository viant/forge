import assert from 'node:assert/strict';
import test from 'node:test';
import {evaluateDashboardConditionSnapshot} from '../components/dashboard/dashboardUtils.js';
import {normalizeReportRuntimeCondition, isReportRuntimeBlockVisible} from './reportBlockRuntimeModel.js';

test('compound report visibility normalizes every independent selector without mutating source', () => {
  const condition={all:[{selector:'dashboard.filters.mode',equals:'detail'},{all:[{selector:'dashboard.selection.item',notEmpty:true},{selector:'filters.enabled',equals:false}]}]};
  const original=structuredClone(condition);
  const normalized=normalizeReportRuntimeCondition(condition);
  assert.equal(normalized.all[0].source,'filters');
  assert.equal(normalized.all[0].selector,'mode');
  assert.equal(normalized.all[1].all[0].source,'selection');
  assert.equal(normalized.all[1].all[0].selector,'item');
  assert.equal(normalized.all[1].all[1].source,'filters');
  assert.deepEqual(condition,original);
  for(const mode of ['summary','detail'])for(const item of ['',0])for(const enabled of [false,true]){
    assert.equal(isReportRuntimeBlockVisible({runtime:{visibleWhen:condition}},{filters:{mode,enabled},selection:{item}}),mode==='detail'&&item===0&&enabled===false);
  }
});

test('compound conditions preserve leaf comparisons and allow mixed snapshot sources', () => {
  const snapshot={metrics:{count:3},dashboardFilters:{mode:'detail'},dashboardSelection:{item:0}};
  const condition={all:[{selector:'count',gte:3},{source:'filters',selector:'mode',in:['detail']},{source:'selection',selector:'item',equals:0}]};
  assert.equal(evaluateDashboardConditionSnapshot(condition,snapshot),true);
  assert.equal(evaluateDashboardConditionSnapshot({...condition,selector:'count',gt:3},snapshot),false);
  assert.equal(evaluateDashboardConditionSnapshot({selector:'count',gte:3},snapshot),true);
  assert.equal(evaluateDashboardConditionSnapshot(null,snapshot),true);
});

test('empty malformed oversized and excessive-depth compounds fail closed', () => {
  for(const all of [[],null,'invalid',[null],[false],[[]],Array.from({length:33},()=>({equals:1}))]){
    assert.equal(evaluateDashboardConditionSnapshot({all},{}),false);
    assert.equal(isReportRuntimeBlockVisible({runtime:{visibleWhen:{all}}}),false);
  }
  let deep={selector:'count',equals:1};
  for(let i=0;i<20;i++)deep={all:[deep]};
  assert.equal(evaluateDashboardConditionSnapshot(deep,{metrics:{count:1}}),false);
  assert.equal(isReportRuntimeBlockVisible({runtime:{visibleWhen:deep}},{metrics:{count:1}}),false);
});

test('compound evaluation has a bounded total node budget', () => {
  const condition={all:Array.from({length:32},()=>({all:Array.from({length:4},()=>({selector:'count',equals:1}))}))};
  assert.equal(evaluateDashboardConditionSnapshot(condition,{metrics:{count:1}}),false);
});
