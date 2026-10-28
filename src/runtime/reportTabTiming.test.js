// @vitest-environment jsdom
import {afterEach,expect,it} from 'vitest';
import {observeReportTabTimings} from './reportTabTiming.js';
afterEach(()=>{document.body.innerHTML='';});
const flush=()=>new Promise(resolve=>setTimeout(resolve,0));
function fixture(){
 document.body.innerHTML='<div data-forge-report-active-section="first" data-forge-report-section-state="ready"><button role="tab" data-section-id="second" aria-selected="false">Private section caption</button><span>Private row content</span></div>';
 const events=[],frames=[];let clock=10;
 const root=document.body.firstElementChild;
 const stop=observeReportTabTimings({document,window:{requestAnimationFrame:fn=>{frames.push(fn);return frames.length;},cancelAnimationFrame:()=>{}},now:()=>clock++,add:event=>events.push(event)});
 return {root,events,frames,stop,tab:root.querySelector('button')};
}
it('measures actual ready content and two frames, retaining no report labels or rows',async()=>{
 const f=fixture();try{
  f.tab.click();f.root.setAttribute('data-forge-report-active-section','second');f.root.setAttribute('data-forge-report-section-state','loading');await flush();
  expect(f.events.map(e=>e.kind)).toEqual(['report-tab-click']);
  f.root.setAttribute('data-forge-report-section-state','ready');await flush();
  expect(f.events.map(e=>e.kind)).toEqual(['report-tab-click','report-tab-dom']);
  f.frames.shift()();f.frames.shift()();
  expect(f.events.map(e=>e.kind)).toEqual(['report-tab-click','report-tab-dom','report-tab-frame']);
  expect(JSON.stringify(f.events)).not.toMatch(/Private|second|caption|content/);
 }finally{f.stop();}
});
it('does not count errored or superseded content as a successful ready frame',async()=>{
 const f=fixture();try{
  f.tab.click();f.root.setAttribute('data-forge-report-active-section','second');await flush();
  const oldFrame=f.frames.shift();f.tab.setAttribute('data-section-id','third');f.tab.click();
  oldFrame();f.root.setAttribute('data-forge-report-active-section','third');f.root.setAttribute('data-forge-report-section-state','error');await flush();
  expect(f.events.filter(e=>e.kind==='report-tab-frame')).toHaveLength(0);
  expect(f.events.filter(e=>e.kind==='report-tab-error')).toHaveLength(1);
 }finally{f.stop();}
});
