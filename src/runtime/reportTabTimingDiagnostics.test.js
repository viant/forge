// @vitest-environment jsdom
import {expect,it} from 'vitest';
import {installForgePerfDiagnostics} from './perfDiagnostics.js';

it('exposes numeric tab durations in the existing opt-in panel without captions or rows',async()=>{
 document.body.innerHTML='<div data-forge-report-active-section="one" data-forge-report-section-state="ready"><button role="tab" data-section-id="two" aria-selected="false">Private caption</button><span>Private row</span></div>';
 const frames=[];let clock=0;
 const host={location:{href:'http://example.invalid/?diagnostics=timing'},fetch:async()=>({status:200}),
  requestAnimationFrame:fn=>{frames.push(fn);return frames.length;},cancelAnimationFrame:()=>{}};
 const trace=installForgePerfDiagnostics({env:{window:host,document,performance:{now:()=>clock++,getEntriesByType:()=>[]}}});
 document.dispatchEvent(new Event('DOMContentLoaded'));
 document.querySelector('#forge-timing-arm').click();
 const root=document.querySelector('[data-forge-report-active-section]');root.querySelector('button').click();
 root.setAttribute('data-forge-report-active-section','two');
 await new Promise(resolve=>setTimeout(resolve,0));
 while(frames.length)frames.shift()();
 const result=trace.snapshot();
 expect(result.reportTabSwitches).toEqual([{operation:1,outcome:'ready',clickToContentDOMMs:1,clickToContentFrameMs:2}]);
 expect(result.reportTabFrameMeasure).toContain('proxy, not GPU paint');
 expect(result.armed).toBe(true);
 expect(JSON.stringify(result)).not.toMatch(/Private|caption/);
});
