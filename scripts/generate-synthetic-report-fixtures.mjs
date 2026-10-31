// Independently authored synthetic report fixtures; no imported application data.
import {createHash} from 'node:crypto';
import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';
const root=process.cwd(),dir=path.join(root,'backend/reporting/materializer'),when=Date.parse('2026-01-01T00:00:00Z');
const checking=process.argv.includes('--check');
function emit(file,text){
 if(checking){if(!fs.existsSync(file)||fs.readFileSync(file,'utf8')!==text)throw Error('Stale synthetic fixture: '+path.relative(root,file));}
 else fs.writeFileSync(file,text);
}
class FixtureDate extends Date{constructor(...a){super(...(a.length?a:[when]));}static now(){return when;}}
const context=vm.createContext({Date:FixtureDate,console,Intl,TextEncoder,TextDecoder});vm.runInContext(fs.readFileSync(path.join(dir,'lowerer.bundle.js'),'utf8'),context);const api=context.ForgeAuthoredLowerer;
const cases=['table','line','bar','kpi','currency','filtered','empty','multi_series','large_values','null_values'];
const out=path.join(dir,'testdata/synthetic'),data=path.join(dir,'testdata/synthetic_materialization');fs.mkdirSync(out,{recursive:true});fs.mkdirSync(data,{recursive:true});
let firstSpec;
const golden={};
const sortJSON=x=>Array.isArray(x)?x.map(sortJSON):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,sortJSON(x[k])])):x;
const canonical=x=>JSON.stringify(sortJSON(x)).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
const digest=x=>createHash('sha256').update(x).digest('hex');
if(!checking)for(const directory of [out,data])for(const name of fs.readdirSync(directory).filter(n=>n.endsWith('.json')))fs.unlinkSync(path.join(directory,name));
for(let n=0;n<cases.length;n++){
 const name=cases[n],source={dataSourceRef:'sampleRows',kind:'published',source:{kind:'datly',uri:'sampleRows'},request:{measures:{amount:true,count:true}},dimensions:[{id:'category',key:'category',label:'Category',kind:'dimension'}],measures:[{id:'amount',key:'amount',label:'Amount',kind:'measure',format:n===4?'currency':'number'},{id:'count',key:'count',label:'Count',kind:'measure'}]};
 const builder={title:'Synthetic '+name,dataSourceRef:'sampleRows',dimensions:[{id:'category',key:'category',label:'Category',paramPath:'dimensions.category',default:true,chartAxis:true}],measures:[{id:'amount',key:'amount',label:'Amount',paramPath:'measures.amount',default:true},{id:'count',key:'count',label:'Count',paramPath:'measures.count',default:true}],result:{defaultMode:[1,2,7].includes(n)?'chart':'table',chartCreationMode:'explicit',pageSize:5}};
 const envelope={schemaVersion:1,format:'forge.authoredReport',builderRef:'sampleBuilder',reportDocument:{version:1,kind:'reportDocument',id:'sample-'+name,title:'Synthetic '+name,blocks:[{id:'intro',kind:'markdownBlock',markdown:'## Example\nDeterministic synthetic fixture.'}]},builderDefinition:{kind:'forge.reporting.builder',id:'sampleBuilder',reportBuilder:builder},state:{viewMode:builder.result.defaultMode,selectedMeasures:['amount','count'],selectedDimensions:['category'],...(builder.result.defaultMode==='chart'?{chartSpec:{title:'Example chart',type:n===1?'line':n===3?'kpi':'bar',xField:'category',yFields:n===7?['amount','count']:['amount']}}:{}),...(n===5?{scopeParams:{category:'Example A'}}:{})},dataSources:{sampleRows:source},dependencies:[{kind:'builder',id:'sampleBuilder',contentFingerprint:'a'.repeat(64)},{kind:'datasource',id:'sampleRows',contentFingerprint:'b'.repeat(64)}]};
 if(n===3)envelope.reportDocument.blocks.push({id:'metric',kind:'kpiBlock',title:'Example metric',datasetRef:'primary',valueField:'amount'});
 envelope.dependencies.push({kind:'report',id:'report://example/'+name,contentFingerprint:digest(JSON.stringify(envelope.reportDocument))});
 for(const dependency of envelope.dependencies){dependency.contentFingerprint=digest(JSON.stringify(dependency.kind==='builder'?envelope.builderDefinition:dependency.kind==='report'?envelope.reportDocument:envelope.dataSources[dependency.id]));}
 const spec=JSON.parse(api.lower(JSON.stringify(envelope)));if(!firstSpec)firstSpec=spec;
 const rows=n===3?[{category:'Example A',amount:20,count:2},{category:'Example B',amount:20,count:2}]:n===6?[]:[{category:'Example A',amount:n===8?1000000:n===9?null:10+n,count:2},{category:'Example B',amount:20+n,count:3}];
 const datasets=Object.fromEntries(spec.datasets.map(d=>[d.id,{rows}]));
 emit(path.join(out,name+'.json'),JSON.stringify(envelope)+'\n');emit(path.join(data,name+'.json'),JSON.stringify(datasets,null,2)+'\n');
 const result=JSON.parse(api.materialize(JSON.stringify({reportSpec:spec,datasets})));if(!result.reportFill)throw Error('Missing synthetic fill');
 const {visibleBlockIds, ...legacyPrint} = result.reportPrint;
 golden[name+'.json']={reportSpec:digest(canonical(spec)),reportFill:digest(canonical(result.reportFill)),reportPrint:digest(JSON.stringify(legacyPrint))};
}
emit(path.join(data,'expected.json'),JSON.stringify(golden,null,2)+'\n');
const spec=structuredClone(firstSpec);spec.datasets=Array.from({length:9},(_,i)=>({...structuredClone(firstSpec.datasets[0]),id:'sample'+i,request:{...firstSpec.datasets[0].request,filters:{sample:true}},scope:{mode:'inherit'},capabilities:{backendRefetch:true}}));spec.blocks=spec.datasets.map((d,i)=>({id:'summary'+i,kind:'markdownBlock',title:'Example summary',datasetRef:d.id,markdown:'Synthetic sample '+i}));spec.layoutIntent.blockOrder=spec.blocks.map(b=>b.id);
const datasets=Object.fromEntries(spec.datasets.map((d,i)=>[d.id,{rows:[{category:'Example '+i,amount:i+1,count:1}]}]));const result=JSON.parse(api.materialize(JSON.stringify({reportSpec:spec,datasets})));emit(path.join(root,'backend/reporting/fill/testdata/synthetic-metadata-executed.json'),JSON.stringify(result.reportFill,null,2)+'\n');
console.log('Created ten synthetic authored reports/dataset inputs and synthetic metadata fill.');
