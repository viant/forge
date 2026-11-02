import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildReportFillGeoPayload} from './reportFillGeoPayload.js';
import {buildReportPrintGeoSvg} from './reportPrintGeoSvg.js';
import {reportSpecSchema} from './schema/reportSpecSchema.js';
import {reportFillSchema} from './schema/reportFillSchema.js';
import {validateReportSchema} from './schema/reportSchemaValidator.js';
const fixture = JSON.parse(fs.readFileSync(new URL('../../doc/examples/sensor-category-point-geometry.json', import.meta.url)));
const fill = (rows = fixture.rows, block = fixture.block) => buildReportFillGeoPayload(block, rows);
const geo = fill();
assert.equal(geo.geometry.features.length, 2);
assert.deepEqual(geo.regions.map(r => [r.key, r.rawValue, r.symbol?.rawValue, r.color]), [['background',null,undefined,'#eef3f8'],['North',4,4,'#336699'],['North',4,4,'#cc6633']]);
assert.deepEqual(geo.regions.slice(1).map(r=>r.symbol.radius),[24,24]);
assert.deepEqual(fill([{location:'North',status:'A',count:2},{location:'North',status:'A',count:2},{location:'North',status:'B',count:4}]).regions.slice(1).map(r=>[r.rawValue,r.symbol.rawValue,r.rowCount]),[[4,4,2],[4,4,1]]);
const areas=fill([{location:'North',status:'A',count:4},{location:'North',status:'B',count:16}]);
assert.deepEqual(areas.regions.slice(1).map(r=>r.symbol.radius),[12,24]);
assert.deepEqual(fill([{location:'North',status:'A',count:0},{location:'North',status:'B',count:null}]).regions.slice(1).map(r=>[r.rawValue,r.symbol.radius,r.displayValue]),[[0,0,'0'],[null,0,'No value']]);
assert.equal(new Set(geo.regions.slice(1).map(r=>r.markId)).size,2);
assert.equal(geo.regions[0].markId,undefined);
const svg = buildReportPrintGeoSvg({resolvedGeo:geo});
assert.equal((svg.svg.match(/<circle /g)||[]).length,2);
assert.ok(svg.svg.includes('<circle cx="480" cy="250" r="24" fill="#336699"'));
assert.ok(svg.svg.includes('<circle cx="480" cy="250" r="24" fill="#cc6633"'));
assert.ok(svg.labelDetails.some(label=>label.includes('series A: 4')));
const added=fill([...fixture.rows,{location:'North',status:'C',count:2}]);
assert.deepEqual(added.geometry,geo.geometry);
assert.deepEqual(added.regions.slice(1).map(r=>r.rawValue),[4,4,2]);
assert.deepEqual(fill([...fixture.rows].reverse()).regions.slice(1).map(r=>r.markId).sort(),geo.regions.slice(1).map(r=>r.markId).sort());
const reversed=fill([...fixture.rows].reverse());
assert.deepEqual(reversed.ranking.map(r=>r.markId),geo.ranking.map(r=>r.markId));
assert.equal(reversed.activeRegion.markId,geo.activeRegion.markId);
assert.equal(buildReportPrintGeoSvg({resolvedGeo:reversed}).svg,svg.svg);
const nestedBlock=structuredClone(fixture.block);nestedBlock.geo.seriesField='status.code';
for(const status of [null,false,0,'']) assert.throws(()=>fill([{location:'North',status,count:4}],nestedBlock),/present scalar/);
assert.throws(()=>fill([{location:'North',status:Object.create({code:'A'}),count:4}],nestedBlock),/present scalar/);
assert.equal(fill([{location:'North',status:{code:null},count:4}],nestedBlock).regions[1].seriesValue,null);
const nestedColor=structuredClone(fixture.block);nestedColor.geo.color={field:'flag.code',rules:[{value:null,color:'#112233'},{value:false,color:'#223344'},{value:0,color:'#334455'},{value:'',color:'#445566'}]};
for(const flag of [null,false,0,'']) assert.equal(fill([{location:'North',status:'A',flag,count:4}],nestedColor).regions[1].statusColor,'');
assert.equal(fill([{location:'North',status:'A',flag:{code:null},count:4}],nestedColor).regions[1].statusColor,'#112233');
for(const [row,error] of [[{location:'Unknown',status:'C',count:1},/unknown feature/],[{location:'North',count:1},/present scalar/],[{location:'North',status:{},count:1},/present scalar/],[{location:'background',status:'A',count:1},/static backdrop/]]) assert.throws(()=>fill([row]),error);
const typedBlock=structuredClone(fixture.block), categories=[null,'',0,'0',false];
typedBlock.geo.color.rules=categories.map((value,i)=>({value,label:JSON.stringify(value),color:`#${i+1}12233`}));
const typed=fill(categories.map(status=>({location:'North',status,count:4})),typedBlock);
assert.equal(new Set(typed.regions.slice(1).map(r=>r.markId)).size,5);
for(const region of typed.regions.slice(1)) assert.equal(region.color,typedBlock.geo.color.rules.find(rule=>rule.value===region.seriesValue).color);
assert.deepEqual(typed.regions.slice(1).map(r=>r.seriesValue).map(JSON.stringify).sort(),categories.map(JSON.stringify).sort());
const conflict=structuredClone(fixture.block);conflict.geo.color.field='flag';
assert.throws(()=>fill([{location:'North',status:'A',flag:'A',count:1},{location:'North',status:'A',flag:'B',count:1}],conflict),/conflicting color rules/);
const empty=fill([]);assert.equal(empty.regions.length,1);assert.deepEqual(empty.ranking,[]);
const noBackdrop=structuredClone(fixture.block);noBackdrop.geo.geometry.features.shift();assert.equal(fill([],noBackdrop).activeRegion,null);
for(const schema of [reportSpecSchema,reportFillSchema]) {
 const config={...schema.$defs.geoConfig,$defs:schema.$defs};
 assert.deepEqual(validateReportSchema(config,fixture.block.geo).errors,[]);
 for(const value of ['',null,{},false]) assert.equal(validateReportSchema(config,{...fixture.block.geo,seriesField:value}).valid,false);
}
const schema={...reportFillSchema.$defs.resolvedGeo,$defs:reportFillSchema.$defs};
for(const valid of [geo,typed,empty,fill([],noBackdrop)]) assert.deepEqual(validateReportSchema(schema,valid).errors,[]);
for(const mutate of [g=>delete g.regions[1].markId,g=>delete g.ranking[0].seriesValue,g=>g.activeRegion.seriesValue={},g=>g.regions[0].markId='bad',g=>delete g.seriesField]) {
 const invalid=structuredClone(geo);mutate(invalid);assert.equal(validateReportSchema(schema,invalid).valid,false);
}
assert.throws(()=>fill(Array.from({length:10001},(_,status)=>({location:'North',status,count:1}))),/10000 observed marks/);
assert.equal(fill(Array.from({length:10000},(_,status)=>({location:'North',status,count:1}))).regions.length,10001);
console.log('Typed categorical Point geometry, per-group counts, colors, bounds and canonical SVG passed');

// Synthetic device memberships overlap across categories: two groups of four
// may contain the same devices, so their sum must not imply global distinctness.
const presentation=structuredClone(fixture.block);
presentation.geo.summary=false;
presentation.geo.color.legendScope='observed';
presentation.geo.color.rules.push(...Array.from({length:419},(_,i)=>({value:`unused-${i}`,color:'#aabbcc',label:`Unused category ${i}`})));
const observed=fill(fixture.rows,presentation);
assert.equal(observed.summary,null);
assert.equal(observed.legend.rules.length,2);
assert.deepEqual(observed.regions,geo.regions);
assert.deepEqual(observed.ranking,geo.ranking);
assert.equal(fill(fixture.rows,{...presentation,geo:{...presentation.geo,summary:true,color:{...presentation.geo.color,legendScope:'declared'}}}).legend.rules.length,421);
assert.equal(fill(fixture.rows).summary.totalValue,'8');
const observedPrint=buildReportPrintGeoSvg({resolvedGeo:observed});
assert.equal((observedPrint.svg.match(/<circle /g)||[]).length,2);
assert.equal(observedPrint.labelDetails.filter(label=>label.startsWith('Map legend:')).length,2);
assert.ok(!observedPrint.labelDetails.some(label=>label.includes('Unused category')));
const observedTyped=structuredClone(typedBlock);observedTyped.geo.color.legendScope='observed';
for(const category of categories) {
 const result=fill([{location:'North',status:category,count:4}],observedTyped);
 assert.deepEqual(result.legend.rules,[{color:typedBlock.geo.color.rules.find(rule=>rule.value===category).color,label:JSON.stringify(category)}]);
}
assert.equal(fill([],presentation).legend,null);
assert.equal(fill([{location:'North',status:'unmapped',count:4}],presentation).legend,null);
assert.throws(()=>fill([{location:'Unknown',status:'A',count:4}],presentation),/unknown feature/);
for(const schema of [reportSpecSchema,reportFillSchema]) {
 const config={...schema.$defs.geoConfig,$defs:schema.$defs};
 assert.equal(validateReportSchema(config,presentation.geo).valid,true);
 for(const value of [null,'false',0]) assert.equal(validateReportSchema(config,{...presentation.geo,summary:value}).valid,false);
 for(const value of [null,'all',false]) assert.equal(validateReportSchema(config,{...presentation.geo,color:{...presentation.geo.color,legendScope:value}}).valid,false);
}
const contentSchema={...reportFillSchema.$defs.geoMapBlock.properties.content,$defs:reportFillSchema.$defs};
const content={geo:presentation.geo,rowCount:2,resolvedGeo:observed};
assert.deepEqual(validateReportSchema(contentSchema,content).errors,[]);
for(const mutate of [c=>delete c.geo.summary,c=>delete c.resolvedGeo.summary,c=>c.resolvedGeo.summary=geo.summary]) {
 const invalid=structuredClone(content);mutate(invalid);assert.equal(validateReportSchema(contentSchema,invalid).valid,false);
}

const distinctFixture=JSON.parse(fs.readFileSync(new URL('../../doc/examples/sensor-distinct-device-geometry.json',import.meta.url)));
assert.equal(new Set(Object.values(distinctFixture.deviceMemberships).flat()).size,6);
assert.equal(distinctFixture.rows.reduce((sum,row)=>sum+row.count,0),8);
const distinctGeo=fill(distinctFixture.rows,distinctFixture.block);
assert.equal(distinctGeo.summary,null);
assert.deepEqual(distinctGeo.regions.slice(1).map(r=>r.rawValue),[4,4]);
assert.deepEqual(distinctGeo.legend.rules.map(r=>r.label),['Category A','Category B']);
const tileBlock={id:'sites',kind:'geoMapBlock',geo:{shape:'us-states',key:'location',metric:{key:'count',label:'Distinct devices'},aggregate:'first',color:{field:'status',rules:presentation.geo.color.rules}}};
const tileRows=[{location:'WA',status:'A',count:4},{location:'NY',status:'B',count:4}];
const defaultTiles=fill(tileRows,tileBlock);
assert.equal(defaultTiles.summary.totalValue,'8');
assert.match(buildReportPrintGeoSvg({resolvedGeo:defaultTiles}).svg,/Total Distinct devices: 8/);
tileBlock.geo.summary=false;tileBlock.geo.color.legendScope='observed';
const observedTiles=fill(tileRows,tileBlock);
assert.equal(observedTiles.summary,null);
assert.equal(observedTiles.legend.rules.length,2);
assert.deepEqual(observedTiles.regions,defaultTiles.regions);
assert.doesNotMatch(buildReportPrintGeoSvg({resolvedGeo:observedTiles}).svg,/Total Distinct devices/);
