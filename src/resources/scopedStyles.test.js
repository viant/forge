import test from 'node:test';
import assert from 'node:assert/strict';
import {parse,walk} from 'css-tree';
import {compileResourceCSS,prepareResourceStyle} from './scopedStyles.js';
const scope={providerIdentity:'studio',namespace:'one',uri:'style://one/workspace'};
test('same class and global symbol names stay in separate provider namespaces',async()=>{
 const definition={schemaVersion:1,css:'@keyframes fade{to{opacity:0}}@font-face{font-family:Open Sans;src:url(font.woff2)}.shared{animation:fade 1s linear;font:italic 16px Open Sans,serif}',tokens:{'--edge':'red'}};
 const a=await compileResourceCSS(definition,scope),b=await compileResourceCSS(definition,{...scope,providerIdentity:'another'});
 const names=css=>{const result=[];walk(parse(css),n=>{if(n.type==='Identifier'&&n.name.startsWith('forge_'))result.push(n.name)});return result};
 assert.notDeepEqual(names(a),names(b));assert.match(a,/1s linear/);assert.match(a,/italic 16px/);
 assert.equal(parse(a).children.size,1);assert.equal(parse(a).children.first.name,'scope');assert.match(a,/data-forge-resource-namespace="one"/);
 assert.match(a,/:scope\{--edge:red\}/);assert.match(a,/font-family:"forge_/);assert.match(a,/16px"forge_/);
 assert.match(definition.css,/animation:fade/,'source untouched');
});
test('animation grammar distinguishes timing keywords from names',async()=>{
 const css=await compileResourceCSS({schemaVersion:1,css:'@keyframes linear{to{opacity:0}}.x{animation:linear 1s;animation-name:linear}'},scope);
 assert.match(css,/animation:linear 1s/);assert.match(css,/animation-name:forge_/);
});
test('registered properties and layers have stable private names',async()=>{
 const css=await compileResourceCSS({schemaVersion:1,css:'@property --shade{syntax:"<color>";inherits:false;initial-value:red}@layer base{.x{--shade:blue;color:var(--shade)}}@supports(display:grid){@property --shade{syntax:"<color>";inherits:false;initial-value:red}}'},scope);
 assert.doesNotMatch(css,/--shade/);assert.match(css,/@layer forge_/);assert.doesNotMatch(css,/----forge/);
});
test('global imports and malformed tokens are rejected before installation',async()=>{
 await assert.rejects(compileResourceCSS({schemaVersion:1,css:'@import "foreign.css";'},scope),/unsupported global/);
 await assert.rejects(compileResourceCSS({schemaVersion:1,css:'.x{}',tokens:{color:'red'}},scope),/Invalid resource style token/);
});

test('trusted hosts can select a shared workspace boundary without changing authored CSS',async()=>{
 const definition={schemaVersion:1,css:'.shared{color:red}',tokens:{'--accent':'blue'}};
 const css=await compileResourceCSS(definition,{...scope,scopeSelector:'.host-application, .host-portal'});
 assert.match(css,/@scope \(\.host-application,\.host-portal\)/);
 assert.match(css,/:scope\{--accent:blue\}/);
 assert.equal(definition.css,'.shared{color:red}');
 assert.match(await compileResourceCSS(definition,scope),/data-forge-resource-namespace="one"/);
});

test('embedded fonts share validation and isolate installed families with owned cleanup',async()=>{
 const definition={schemaVersion:1,fonts:[{family:'Sample Sans',format:'woff2',data:btoa('wOF2synthetic'),weight:400,style:'normal'}],tokens:{'--font':'"Sample Sans", sans-serif'},css:'.text{font-family:Sample Sans,sans-serif}'};
 const a=await prepareResourceStyle(definition,scope),b=await prepareResourceStyle(definition,{...scope,namespace:'two'});
 const entries=new Set(),loaded=[];
 class Face{constructor(family,buffer,descriptors){this.family=family;this.buffer=buffer;this.descriptors=descriptors;}load(){loaded.push(this);return Promise.resolve(this);}}
 const releaseA=a.installFonts({FontFace:Face,fontSet:entries}),releaseB=b.installFonts({FontFace:Face,fontSet:entries});
 await Promise.resolve();assert.equal(loaded.length,2);assert.notEqual(loaded[0].family,loaded[1].family);
 assert.ok(a.css.includes(loaded[0].family));assert.ok(a.tokens['--font'].includes(loaded[0].family));
 releaseA();assert.deepEqual([...entries],[loaded[1]]);releaseB();assert.equal(entries.size,0);
 await assert.rejects(prepareResourceStyle({...definition,fonts:[{...definition.fonts[0],data:'https://example.invalid/font.woff2'}]},scope),/Invalid workspace font/);
});

test('token-only style definitions preserve optional CSS semantics',async()=>{
 const css=await compileResourceCSS({schemaVersion:1,tokens:{'--accent':'blue'}},scope);
 assert.match(css,/:scope\{--accent:blue\}/);
 await assert.rejects(compileResourceCSS({schemaVersion:1,css:42},scope),/Invalid style resource/);
});

test('trusted global base preserves document-root selectors while namespace styles remain scoped',async()=>{
 const definition={schemaVersion:1,css:'.host-application{--font:"Sample"}body{font-family:var(--font)}',fonts:[{family:'Sample',format:'woff2',data:btoa('wOF2synthetic'),weight:400,style:'normal'}]};
 const css=await compileResourceCSS(definition,{...scope,global:true,scopeSelector:'.host-application'});
 assert.ok(css.startsWith('.host-application{'));assert.doesNotMatch(css,/@scope/);assert.match(css,/--font:"Sample"/);
 assert.match(await compileResourceCSS(definition,scope),/^@scope/);
});
