import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeWorkspaceFonts,installWorkspaceFonts} from './workspaceFonts.js';
const font={family:'Inter',format:'woff2',data:btoa('wOF2synthetic'),weight:400,style:'normal',license:'Synthetic test data'};
test('workspace fonts load from owned buffers and cleanup preserves other mounts',async()=>{
 const unrelated={};const entries=new Set([unrelated]);const loaded=[];
 class Face{constructor(family,buffer,descriptors){this.family=family;this.buffer=buffer;this.descriptors=descriptors;}load(){loaded.push(this);return Promise.resolve(this);}}
 const cleanup=installWorkspaceFonts([font],{FontFace:Face,fontSet:entries});
 await Promise.resolve();assert.equal(loaded.length,1);assert.ok(loaded[0].buffer instanceof ArrayBuffer);assert.equal(loaded[0].descriptors.display,'swap');assert.equal(entries.size,2);
 cleanup();assert.deepEqual([...entries],[unrelated]);
});
test('malformed and external font data never reach FontFace or document.fonts',()=>{
 for(const change of [{data:'https://example/font.woff2'},{data:'data:font/woff2;base64,'+font.data},{data:btoa('not font')},{format:'opentype'},{weight:450},{style:'oblique'},{family:'Inter;url(x)'},{license:'x'.repeat(16385)},{data:font.data+'\n'}]){
  let constructed=0;assert.throws(()=>installWorkspaceFonts([font,{...font,...change}],{FontFace:class{constructor(){constructed++;}},fontSet:new Set()}));assert.equal(constructed,0);
 }
 assert.throws(()=>decodeWorkspaceFonts(Array(33).fill(font)));
 const large={...font,data:btoa('wOF2'+'a'.repeat(512*1024-4))};assert.throws(()=>decodeWorkspaceFonts(Array(5).fill(large)));
});
test('failed load removes its own font',async()=>{
 const entries=new Set();let failures=0;
 class Face{load(){return Promise.reject(new Error('font rejected'));}}
 installWorkspaceFonts([font],{FontFace:Face,fontSet:entries,onError:()=>failures++});
 await new Promise(resolve=>setTimeout(resolve,0));assert.equal(entries.size,0);assert.equal(failures,1);
});

test('variable font ranges and unicode subsets retain the native face descriptors',async()=>{
 const faces=[];class Face{constructor(family,buffer,descriptors){this.descriptors=descriptors;faces.push(this);}load(){return Promise.resolve(this);}}
 const {weight,...variable}=font;variable.weightRange='100 700';variable.unicodeRange='U+0000-00FF,U+0131';
 const cleanup=installWorkspaceFonts(Array(17).fill(variable),{FontFace:Face,fontSet:new Set()});
 assert.equal(faces.length,17);assert.equal(faces[0].descriptors.weight,'100 700');assert.equal(faces[0].descriptors.unicodeRange,variable.unicodeRange);cleanup();
 for(const change of [{weight:400},{weightRange:'700 100'},{weightRange:'0 1000'},{unicodeRange:'url(x)'}])assert.throws(()=>decodeWorkspaceFonts([{...variable,...change}]));
});
