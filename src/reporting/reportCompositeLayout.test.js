import assert from 'node:assert/strict';
import {compositeChildWeights,compositeWeightedTemplate} from './reportCompositeLayout.js';
import {buildReportSpecHash} from './reportFillModel.js';
import {buildReportPrintFromReportFill} from './reportPrintModel.js';
import {buildReportFillFromReportSpec} from './reportFillModel.js';
import {buildReportBuilderReportDocument, lowerReportDocumentToReportSpec, normalizeReportBuilderDocumentBlocks, normalizeReportBlockRuntime} from './reportDocumentModel.js';

// Independently authored source exercises the document/save/lower path, unlike
// the direct ReportSpec/ReportFill layout tests below.
const visibility = {source:'metrics', field:'count', equals:42};
const authoredChildren = ['left','right'].map(id => ({id,kind:'markdownBlock',title:id,markdown:id}));
const variants = [
  {chrome:'none'},
  {chrome:'panel',childWeights:{left:1,right:3},minColumnWidth:100},
  {desktopColumns:6,tabletColumns:3,mobileColumns:2,minColumnWidth:180},
  {chrome:'none',spacerHeight:0},
  {chrome:'none',spacerHeight:8},
];
for (const layoutRuntime of variants) {
  for (const sharedRuntime of [{}, {visibleWhen:visibility}]) {
    const authored = {id:'authoredGroup',kind:'compositeBlock',title:'Layout only',layout:'responsiveGrid',
      childBlockIds:Object.hasOwn(layoutRuntime,'spacerHeight') ? [] : ['left','right'],
      runtime:structuredClone({...layoutRuntime,...sharedRuntime})};
    const expected = structuredClone(authored.runtime);
    const normalized = normalizeReportBuilderDocumentBlocks([authored])[0];
    assert.deepEqual(normalized.runtime,expected);
    const document = buildReportBuilderReportDocument({container:{id:'layout',dataSourceRef:'records'},
      state:{reportDocumentBlocks:[authored,...authoredChildren]}});
    assert.deepEqual(document.blocks.find(block=>block.id===authored.id).runtime,expected);
    const lowered = lowerReportDocumentToReportSpec(JSON.parse(JSON.stringify(document)),{includePrimaryBlocks:false});
    const retained = lowered.blocks.find(block=>block.id===authored.id);
    assert.deepEqual(retained.runtime,expected);
    const filled = buildReportFillFromReportSpec(lowered,{}).blocks.find(block=>block.id===authored.id);
    assert.deepEqual(filled.runtime,expected);
    if (layoutRuntime.childWeights) {
      assert.deepEqual(compositeChildWeights(retained,authoredChildren),[.25,.75]);
      authored.runtime.childWeights.left=99;
      assert.equal(normalized.runtime.childWeights.left,1,'normalization must clone producer metadata');
    }
  }
}
// Runtime layout values remain uncoerced. Their owning consumers retain the
// established defaults, clamping and rejection policy.
assert.deepEqual(normalizeReportBlockRuntime({desktopColumns:99,minColumnWidth:'wide',requireCompleteDataset:true}, {kind:'compositeBlock'}),
  {desktopColumns:99,minColumnWidth:'wide',requireCompleteDataset:true});
assert.equal(normalizeReportBlockRuntime({chrome:'none',unrecognized:true},{kind:'compositeBlock'}),null);
const invalidWeights={...variants[1],childWeights:{left:1}};
const invalid=normalizeReportBuilderDocumentBlocks([{id:'invalid',kind:'compositeBlock',layout:'responsiveGrid',
  childBlockIds:['left','right'],runtime:{...invalidWeights,visibleWhen:visibility}}])[0];
assert.throws(()=>compositeChildWeights(invalid,authoredChildren),/every child/);
assert.equal(normalizeReportBlockRuntime({chrome:'none',unrecognized:true},{kind:'markdownBlock'}),null);
assert.deepEqual(normalizeReportBlockRuntime({chrome:'none',unrecognized:true,visibleWhen:visibility},{kind:'compositeBlock'}),
  {chrome:'none',visibleWhen:visibility});
const [legacyRuntime] = normalizeReportBuilderDocumentBlocks([{id:'legacy',kind:'compositeBlock',childBlockIds:['left'],
  runtime:{chrome:'none',unrecognized:true}}]);
assert.deepEqual(legacyRuntime.runtime,{chrome:'none',unrecognized:true},'retain the existing composite-only builder fallback');

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
