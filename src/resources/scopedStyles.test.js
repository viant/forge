import test from 'node:test';
import assert from 'node:assert/strict';
import {parse,walk} from 'css-tree';
import {compileResourceCSS} from './scopedStyles.js';
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
