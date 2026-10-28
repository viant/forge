import assert from 'node:assert/strict';
import {compositeChildWeights,compositeWeightedTemplate} from './reportCompositeLayout.js';
import {buildReportSpecHash} from './reportFillModel.js';
import {buildReportPrintFromReportFill} from './reportPrintModel.js';

const children=['left','right'].map(id=>({id,kind:'kpiBlock',title:id,content:{value:42,valueLabel:id}}));
const group={id:'group',kind:'compositeBlock',title:'Invisible layout title',layout:'responsiveGrid',childBlockIds:['left','right'],runtime:{chrome:'none',childWeights:{left:1,right:3}}};
assert.deepEqual(compositeChildWeights(group,children),[.25,.75]);
assert.deepEqual(compositeChildWeights(group,[children[1]]),[1]);
assert.equal(compositeWeightedTemplate(group,children,780),'minmax(0, 1fr)');
assert.equal(compositeWeightedTemplate(group,children,1440),'minmax(0, 0.25fr) minmax(0, 0.75fr)');
assert.throws(()=>compositeChildWeights({...group,runtime:{childWeights:{left:1}}},children),/every child/);
const source={kind:'report',containerId:'synthetic',stateKey:'synthetic',dataSourceRef:'invented'};
const compact={...group,runtime:{...group.runtime,minColumnWidth:100}};
const reportSpec={version:1,kind:'reportSpec',title:'Weighted inventory',source,blocks:[compact,...children],layoutIntent:{blockOrder:['group','left','right']}};
const reportFill={version:1,kind:'reportFill',specVersion:1,specHash:buildReportSpecHash(reportSpec),source,blocks:reportSpec.blocks,datasets:[]};
const print=buildReportPrintFromReportFill({reportSpec,reportFill});
const elements=print.pages.flatMap(p=>p.elements);
assert.ok(!elements.some(e=>e.text==='Invisible layout title'));
const left=elements.find(e=>e.text==='left'),right=elements.find(e=>e.text==='right');
assert.ok(left&&right);
assert.equal(left.box.y,right.box.y);
assert.ok(right.box.x>left.box.x);
assert.ok(right.box.width>left.box.width*2);
const stackedSpec={...reportSpec,blocks:[group,...children]};
const stackedFill={...reportFill,blocks:stackedSpec.blocks,specHash:buildReportSpecHash(stackedSpec)};
const stacked=buildReportPrintFromReportFill({reportSpec:stackedSpec,reportFill:stackedFill}).pages.flatMap(page=>page.elements);
const stackedLeft=stacked.find(e=>e.text==='left'),stackedRight=stacked.find(e=>e.text==='right');
assert.equal(stackedLeft.box.x,stackedRight.box.x);
assert.ok(stackedRight.box.y>stackedLeft.box.y);
for(const page of print.pages) for(const element of page.elements) {
 if(element.box) assert.ok(element.box.x>=0&&element.box.x+element.box.width<=612,JSON.stringify(element));
}
console.log('weighted composites preserve source tracks, identity and print bounds');
