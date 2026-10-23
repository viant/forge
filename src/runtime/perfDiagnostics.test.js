// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {installForgePerfDiagnostics} from './perfDiagnostics.js';

afterEach(()=>{document.body.innerHTML='';vi.unstubAllGlobals();});

it('collects host-classified network and visible row timings without bodies or query values',async()=>{
  const fetch=vi.fn().mockResolvedValue({status:200});
  const host={location:{href:'http://fixture/?diagnostics=timing'},fetch,getComputedStyle:window.getComputedStyle};
  const trace=installForgePerfDiagnostics({env:{window:host,document,performance},
    classifyFetch:path=>path==='/metadata'?'metadata':path==='/rows'?'data':'',
    resourcePath:path=>path==='/metadata'||path==='/rows',
    findVisiblePanel:doc=>doc.querySelector('[role="tabpanel"]:not([hidden])'),
  });
  document.dispatchEvent(new Event('DOMContentLoaded'));
  document.querySelector('#forge-timing-arm').click();
  const button=document.createElement('button');button.textContent='Records';document.body.append(button);button.click();
  await host.fetch('/metadata?token=private',{body:'private-body'});
  await host.fetch('/rows?filter=private',{body:'private-body'});
  const hidden=document.createElement('div');hidden.setAttribute('role','tabpanel');hidden.hidden=true;
  hidden.innerHTML='<div class="basic-table-wrapper"><table><tbody><tr class="row"><td>hidden-secret</td></tr></tbody></table></div>';
  document.body.append(hidden);
  const active=document.createElement('div');active.setAttribute('role','tabpanel');active.innerHTML='<div class="basic-table-wrapper"><table><tbody><tr class="row"><td>row-secret</td></tr></tbody></table></div>';
  document.body.append(active);
  await new Promise(resolve=>setTimeout(resolve,0));
  const result=trace.snapshot();
  expect(result.openToMetadataEndMs).not.toBeNull();
  expect(result.openToDataEndMs).not.toBeNull();
  expect(result.events.find(entry=>entry.kind==='rows-dom').rowCount).toBe(1);
  expect(document.querySelector('#forge-timing-output').textContent).not.toMatch(/private|secret/);
  expect(result.frameMeasure).toMatch(/proxy, not GPU paint/);
});
