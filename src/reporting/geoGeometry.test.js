import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildGeoGeometry} from './geoGeometry.js';
import {buildReportFillGeoPayload} from './reportFillGeoPayload.js';
import {buildReportPrintGeoSvg} from './reportPrintGeoSvg.js';
import {buildReportDocumentGeoMapBlock} from './reportDocumentModel.js';
import {validateReportSchema} from './schema/reportSchemaValidator.js';
import {reportSpecSchema} from './schema/reportSpecSchema.js';
import {reportFillSchema} from './schema/reportFillSchema.js';
import {DEFAULT_GEO_PALETTE, pickPaletteColor} from '../components/dashboard/geoMapUtils.js';
const fixture = JSON.parse(fs.readFileSync(new URL('../../doc/examples/campus-zone-geometry.json', import.meta.url)));
const resolved = buildReportFillGeoPayload(fixture.block, fixture.rows);
for (const schema of [reportSpecSchema, reportFillSchema]) {
  const configSchema = {...schema.$defs.geoConfig, $defs:schema.$defs};
  assert.deepEqual(validateReportSchema(configSchema, fixture.block.geo).errors, []);
  const missing = structuredClone(fixture.block.geo); delete missing.geometry;
  assert.equal(validateReportSchema(configSchema, missing).valid, false);
  const unsupported = structuredClone(fixture.block.geo); unsupported.geometry.features[0].geometry.type = 'Point';
  assert.equal(validateReportSchema(configSchema, unsupported).valid, false);
  for (const [field,value] of [['id',' North'],['id','North '],['label',123],['label','   ']]) {
    const invalid=structuredClone(fixture.block.geo);
    if(field==='id') invalid.geometry.features[0].id=value;
    else invalid.geometry.features[0].properties.label=value;
    assert.equal(validateReportSchema(configSchema,invalid).valid,false);
  }
}
assert.equal(validateReportSchema({type:'string',pattern:'cat'},'a cat b').valid,true);
assert.equal(validateReportSchema({type:'string',pattern:'^cat$'},'a cat b').valid,false);
assert.equal(validateReportSchema({type:'string',pattern:'['},'cat').errors[0].code,'invalidPattern');
assert.deepEqual(validateReportSchema({...reportFillSchema.$defs.resolvedGeo, $defs:reportFillSchema.$defs},resolved).errors,[]);
assert.deepEqual(resolved.regions.map(r => [r.key,r.rawValue,r.rowCount]), [['North',70,1],['East',0,1],['South',null,1],['West',null,0]]);
assert.notEqual(resolved.regions[1].color,resolved.regions[2].color);
assert.equal(resolved.regions[2].displayValue,'No value');assert.equal(resolved.regions[3].displayValue,'No row');
assert.deepEqual(buildReportDocumentGeoMapBlock(fixture.block).geo,fixture.block.geo);
const printed = buildReportPrintGeoSvg({resolvedGeo:resolved});
for(const feature of resolved.geometry.features) assert.ok(printed.svg.includes(`d="${feature.path}"`));
assert.equal(resolved.geometry.features[0].path.split(' Z').length,3); // hole
assert.equal(resolved.geometry.features[1].path.split(' Z').length,3); // disconnected islands
assert.ok(printed.svg.includes('fill-rule="evenodd"'));assert.ok(printed.labelDetails.includes('West: No row'));
assert.ok(!printed.svg.includes('data-region-key'));assert.ok(!printed.svg.includes('aria-label'));
const signedFixture = JSON.parse(fs.readFileSync(new URL('../../doc/examples/campus-zone-signed-values.json', import.meta.url)));
const signed = buildReportFillGeoPayload(fixture.block,signedFixture.rows);
assert.equal(signed.legend.min,'-50.0%');assert.notEqual(signed.regions[0].color,signed.regions[1].color);
assert.throws(()=>buildReportFillGeoPayload(fixture.block,[{zoneId:'Unknown',utilization:1}]),/unknown feature key/);
assert.throws(()=>buildReportFillGeoPayload(fixture.block,[{zoneId:'north',utilization:1}]),/unknown feature key/);
assert.throws(()=>buildReportFillGeoPayload(fixture.block,[{zoneId:'North',utilization:Infinity}]),/finite number/);
for (const [mutate, message] of [
  [g=>g.geometry.features.push(g.geometry.features[0]), /duplicate/],
  [g=>g.geometry.features[0].geometry.type='LineString', /Polygon/],
  [g=>g.geometry.features[0].geometry.coordinates[0][0][0]=NaN, /finite/],
  [g=>g.geometry.features[0].geometry.coordinates[0].pop(), /closed/],
  [g=>g.projection='mercator', /planar/],
  [g=>g.geometry='https://example.invalid/geometry.json', /inline/],
]) {const geo=structuredClone(fixture.block.geo);mutate(geo);assert.throws(()=>buildGeoGeometry(geo),message);}
assert.equal(buildReportFillGeoPayload(fixture.block,[]).regions.length,4);

// A one-unit polygon remains valid near either declared coordinate limit.
// Hole winding is normalized and paths are invariant under translation.
const square = [[0,0],[1,0],[1,1],[0,1],[0,0]];
const hole = [[.25,.25],[.75,.25],[.75,.75],[.25,.75],[.25,.25]];
const localGeo = {projection:'planar',geometry:{type:'FeatureCollection',features:[{
  type:'Feature',id:'square',geometry:{type:'Polygon',coordinates:[square,hole]},
}]}};
const localPath = buildGeoGeometry(localGeo).features[0].path;
assert.equal(localPath, 'M246,484 L714,484 L714,16 L246,16 L246,484 Z M363,367 L363,133 L597,133 L597,367 L363,367 Z');
for (const offset of [999999999, -1000000000]) {
  const translated = structuredClone(localGeo);
  translated.geometry.features[0].geometry.coordinates = [square,hole].map(ring=>ring.map(([x,y])=>[x+offset,y+offset]));
  assert.equal(buildGeoGeometry(translated).features[0].path, localPath);
  translated.geometry.features[0].geometry.coordinates.forEach(ring=>ring.reverse());
  assert.equal(buildGeoGeometry(translated).features[0].path, localPath);
}
const largeRows = Array.from({length:200000}, (_,i)=>({zoneId:'North',utilization:[null,-2,0,4][i%4]}));
for (const [aggregate, expected] of [['min',-2],['max',4],['sum',100000],['avg',100000/150000],['first',-2]]) {
  const result = buildReportFillGeoPayload({...fixture.block,geo:{...fixture.block.geo,aggregate}},largeRows);
  assert.equal(result.regions[0].rawValue,expected,aggregate);
  assert.equal(result.regions[0].rowCount,largeRows.length);
}
// Finite extreme endpoints must retain actual palette colors in every shape.
assert.equal(pickPaletteColor(-1e308,-1e308,1e308),DEFAULT_GEO_PALETTE[0]);
assert.equal(pickPaletteColor(0,-1e308,1e308),DEFAULT_GEO_PALETTE[2]);
assert.equal(pickPaletteColor(1e308,-1e308,1e308),DEFAULT_GEO_PALETTE[4]);
for (const [shape,keys] of [['geojson',['North','East']],['world',['US','CA']],['us-states',['CA','NY']],['us-state-tiles',['CA','NY']]]) {
  const block={...fixture.block,geo:{...fixture.block.geo,shape}};
  const result=buildReportFillGeoPayload(block,[{zoneId:keys[0],utilization:-1e308},{zoneId:keys[1],utilization:1e308}]);
  for (const value of [-1e308,1e308]) assert.equal(result.regions.find(r=>r.rawValue===value).color,DEFAULT_GEO_PALETTE[value<0 ? 0 : 4]);
  assert.deepEqual(validateReportSchema({...reportFillSchema.$defs.resolvedGeo,$defs:reportFillSchema.$defs},result).errors,[]);
  const svg=buildReportPrintGeoSvg({resolvedGeo:result}).svg;
  assert.ok(svg.includes(`fill="${DEFAULT_GEO_PALETTE[0]}"`));assert.ok(svg.includes(`fill="${DEFAULT_GEO_PALETTE[4]}"`));
  assert.ok(!svg.includes('undefined'));assert.ok(!svg.includes('NaN'));
}
console.log('GeoJSON geometry model/fill/print tests passed');

const points = JSON.parse(fs.readFileSync(new URL('../../doc/examples/sensor-point-geometry.json', import.meta.url)));
const pointGeo = buildReportFillGeoPayload(points.block, points.rows);
assert.deepEqual(buildReportDocumentGeoMapBlock(points.block).geo, points.block.geo);
for (const schema of [reportSpecSchema, reportFillSchema]) {
  const configSchema = {...schema.$defs.geoConfig, $defs:schema.$defs};
  assert.deepEqual(validateReportSchema(configSchema, points.block.geo).errors, []);
  for (const mutate of [g=>delete g.symbolSize,g=>g.geometry.features=g.geometry.features.filter(f=>f.geometry.type!=='Point'),g=>g.symbolSize.extra=1,g=>g.symbolSize.maxRadius=65,g=>g.geometry.features[1].geometry.extra=1,g=>g.geometry.features[1].geometry.coordinates=[1,2,3],g=>g.shape='world']) {
    const invalid = structuredClone(points.block.geo); mutate(invalid);
    assert.equal(validateReportSchema(configSchema, invalid).valid, false);
  }
}
assert.deepEqual(validateReportSchema({...reportFillSchema.$defs.resolvedGeo,$defs:reportFillSchema.$defs},pointGeo).errors, []);
assert.deepEqual(pointGeo.regions.slice(1).map(r=>[r.symbol.rawValue,r.symbol.radius,r.symbol.displayValue]), [[25,16,'25'],[100,32,'100'],[0,0,'0'],[null,0,'No value'],[null,0,'No row'],[9,9.6,'9']]);
assert.equal(pointGeo.regions[1].rawValue,-3);
assert.equal(pointGeo.regions[3].rawValue,0);
assert.equal(pointGeo.regions[6].rawValue,null);
const extremeSize = buildReportFillGeoPayload(points.block,[{sensorId:'A',observations:1e-308},{sensorId:'B',observations:1e308}]);
assert.ok(extremeSize.regions[1].symbol.radius>0, 'finite positive sizes must not underflow to a zero-size cross');
assert.equal(extremeSize.regions[2].symbol.radius,32);
for (const aggregate of ['sum','avg','min','max','first']) {
  const block=structuredClone(points.block);block.geo.symbolSize.aggregate=aggregate;
  const rows=[{sensorId:'A',reading:1,observations:-0}];
  const zero=buildReportFillGeoPayload(block,rows).regions[1].symbol;
  assert.equal(zero.displayValue,'0', `${aggregate} must present negative zero consistently`);
  assert.equal(zero.radius,0);
  assert.ok(Object.is(rows[0].observations,-0),'source measurement remains unchanged');
  if (aggregate==='first') assert.ok(Object.is(zero.rawValue,-0),'formatting must not change the aggregated raw value');
}
assert.deepEqual(pointGeo.geometry.features[1].point,[296,158]);
assert.deepEqual(pointGeo.geometry.features[2].point,[480,158]);
const pointPrint=buildReportPrintGeoSvg({resolvedGeo:pointGeo});
assert.ok(pointPrint.svg.includes('<circle cx="296" cy="158" r="16"'));
assert.ok(pointPrint.svg.includes('<circle cx="480" cy="158" r="32"'));
assert.ok(pointPrint.svg.includes('M661,158 L667,158 M664,155 L664,161'));
assert.ok(pointPrint.labelDetails.includes('Sensor C: 0; Observations: 0'));
assert.ok(pointPrint.labelDetails.includes('Sensor D: 4; Observations: No value'));
assert.ok(pointPrint.labelDetails.includes('Sensor E: No row; Observations: No row'));
for (const value of [-1,Infinity,NaN,'10']) assert.throws(()=>buildReportFillGeoPayload(points.block,[{sensorId:'A',reading:1,observations:value}]), /nonnegative finite/);
const withoutSize=structuredClone(points.block);delete withoutSize.geo.symbolSize;
assert.throws(()=>buildReportFillGeoPayload(withoutSize,[]),/symbolSize/);
assert.throws(()=>buildReportDocumentGeoMapBlock(withoutSize),/symbolSize/);
const polygonWithSize=structuredClone(fixture.block);polygonWithSize.geo.symbolSize={key:'count'};
assert.throws(()=>buildReportDocumentGeoMapBlock(polygonWithSize),/symbolSize/);
assert.ok(buildReportFillGeoPayload(points.block,[]).regions.slice(1).every(r=>r.symbol.radius===0 && r.symbol.displayValue==='No row'));
for (const [aggregate,value] of [['sum',12],['avg',6],['min',4],['max',8],['first',4]]) {
  const block=structuredClone(points.block);block.geo.symbolSize.aggregate=aggregate;
  const result=buildReportFillGeoPayload(block,[{sensorId:'A',observations:null},{sensorId:'A',observations:4},{sensorId:'A',observations:8}]);
  assert.equal(result.regions[1].symbol.rawValue,value);
}
for (const coordinates of [[[7,9]],[[7,9],[7,9]],[[0,1],[2,1]],[[1,0],[1,2]]]) {
  const geo={projection:'planar',symbolSize:{key:'count'},geometry:{type:'FeatureCollection',features:coordinates.map((point,i)=>({type:'Feature',id:String(i),geometry:{type:'Point',coordinates:point}}))}};
  const result=buildGeoGeometry(geo);
  assert.ok(result.features.every(f=>f.point.every(Number.isFinite)));
  if(coordinates.every(p=>p[0]===7)) assert.deepEqual(result.features[0].point,[480,250]);
}
console.log('GeoJSON Point area, states, schema, bounds and print tests passed');
