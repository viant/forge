// Regenerate retained hashes from the official embedded bundle in Node, never
// from the Go implementation being checked against these fixtures.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const directory=path.join(root,'backend/reporting/materializer');
const timestamp=Date.parse('2026-10-07T12:00:00Z');
class FixtureDate extends Date {
 constructor(...args){super(...(args.length?args:[timestamp]));}
 static now(){return timestamp;}
}
const context=vm.createContext({Date:FixtureDate,console,Intl,TextEncoder,TextDecoder});
vm.runInContext(fs.readFileSync(path.join(directory,'lowerer.bundle.js'),'utf8'),context);
const api=context.ForgeAuthoredLowerer;
const target=path.join(directory,'testdata/steward_materialization/expected.json');
const previous=JSON.parse(fs.readFileSync(target,'utf8')),artifacts={};
for(const name of fs.readdirSync(path.join(directory,'testdata/steward')).filter(name=>name.endsWith('.json')).sort()){
 const envelope=fs.readFileSync(path.join(directory,'testdata/steward',name),'utf8');
 const datasets=JSON.parse(fs.readFileSync(path.join(directory,'testdata/steward_materialization',name),'utf8'));
 const spec=JSON.parse(api.lower(envelope));
 const output=JSON.parse(api.materialize(JSON.stringify({reportSpec:spec,datasets})));
 artifacts[name]={reportSpec:spec,...output};
}
const next=JSON.parse(execFileSync('go',['run',path.join(root,'scripts/materialization-fixture-hashes.go')],{input:JSON.stringify(artifacts),encoding:'utf8'}));
if(Object.keys(next).length!==10)throw Error('Expected all ten retained Steward fixtures');
const changed=Object.keys(next).filter(name=>JSON.stringify(previous[name])!==JSON.stringify(next[name]));
console.log(JSON.stringify({source:'official Forge bundle executed in Node',changed}));
if(process.argv.includes('--write'))fs.writeFileSync(target,JSON.stringify(next,null,2)+'\n');
else if(changed.length)process.exitCode=1;
