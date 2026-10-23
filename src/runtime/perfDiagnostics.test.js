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
  const phaseStart=performance.now();
  for(const [phase,offset] of [['metadata-request-scheduled',1],['metadata-response-parsed',5],
    ['metadata-signal-published',8],['metadata-prime-complete',9],['datasource-mounted',10],
    ['datasource-fetch-start',12]]) host.__forgeWindowPerfPhaseRecorder(phase,'private-window-id',phaseStart+offset);
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
  expect(result.clickToMetadataNetworkStartMs).not.toBeNull();
  expect(result.openToDataEndMs).not.toBeNull();
  expect(result.metadataEndToDataNetworkStartMs).not.toBeNull();
  expect(result.events.find(entry=>entry.kind==='rows-dom').rowCount).toBe(1);
  expect(result.phaseScopes).toMatchObject([{scope:1,metadataResponseToPublishedMs:3,metadataResponseToPrimeMs:4,metadataPublishedToPrimeMs:1}]);
  expect(result.dataEndToRowsDOMMs).not.toBeNull();
  expect(document.querySelector('#forge-timing-output').textContent).not.toMatch(/private|secret/);
  expect(result.frameMeasure).toMatch(/proxy, not GPU paint/);
});

it('shows the diagnostic published opener only after a host callback is registered',async()=>{
  const fetch=vi.fn();
  const host={location:{href:'http://fixture/?diagnostics=timing'},fetch,getComputedStyle:window.getComputedStyle};
  const clock={now:()=>performance.now(),getEntriesByType:()=>[],clearResourceTimings:vi.fn(),setResourceTimingBufferSize:vi.fn()};
  const trace=installForgePerfDiagnostics({env:{window:host,document,performance:clock},panelId:'test-timing',globalKey:'__testTiming'});
  document.dispatchEvent(new Event('DOMContentLoaded'));
  const controls=document.querySelector('#test-timing-published-opener');
  expect(controls.hidden).toBe(true);
  const open=vi.fn();
  trace.setOpenPublishedWindow(open);
  expect(controls.hidden).toBe(false);
  document.querySelector('#test-timing-provider').value='unknown-provider';
  document.querySelector('#test-timing-uri').value='window://dspui/orderList';
  document.querySelector('#test-timing-open').click();
  await new Promise(resolve=>setTimeout(resolve,0));
  expect(open).toHaveBeenCalledWith({providerIdentity:'unknown-provider',uri:'window://dspui/orderList',title:'Order List'});
  expect(clock.clearResourceTimings).toHaveBeenCalledOnce();
  expect(fetch).not.toHaveBeenCalled(); // Only the host's normal workspace route can issue the GET.
  trace.setOpenPublishedWindow(null);
  expect(controls.hidden).toBe(true);
});

it('distinguishes same-path resource requests without showing query values',()=>{
  const start=performance.now();
  const entry=(query,initiatorType,responseStatus,encodedBodySize)=>({
    name:`http://fixture/metadata?${query}`,startTime:start+1,duration:4,
    initiatorType,responseStatus,encodedBodySize,transferSize:3415,
    domainLookupStart:0,domainLookupEnd:0,connectStart:0,connectEnd:0,
    secureConnectionStart:0,requestStart:1,responseStart:3,serverTiming:[],
  });
  const entries=[entry('revision=3&token=first','fetch',200,3000),
    entry('revision=4&token=second','xmlhttprequest',200,3001)];
  const clock={now:()=>start,getEntriesByType:()=>entries,clearResourceTimings:vi.fn(),setResourceTimingBufferSize:vi.fn()};
  const host={location:{href:'http://fixture/?diagnostics=timing'},fetch:vi.fn(),getComputedStyle:window.getComputedStyle};
  const trace=installForgePerfDiagnostics({env:{window:host,document,performance:clock},resourcePath:path=>path==='/metadata'});
  const resources=trace.snapshot().resources;
  expect(resources).toMatchObject([
    {path:'/metadata',queryKeys:['revision','token'],urlVariant:1,initiatorType:'fetch',responseStatus:200,encodedBodySize:3000},
    {path:'/metadata',queryKeys:['revision','token'],urlVariant:2,initiatorType:'xmlhttprequest',responseStatus:200,encodedBodySize:3001},
  ]);
  expect(JSON.stringify(resources)).not.toMatch(/first|second|revision=|token=/);
});

it('records phases immediately but batches panel writes into one frame',()=>{
  const frames=[];
  const host={location:{href:'http://fixture/?diagnostics=timing'},fetch:vi.fn(),
    requestAnimationFrame:callback=>{frames.push(callback);return frames.length;},
    getComputedStyle:window.getComputedStyle};
  const trace=installForgePerfDiagnostics({env:{window:host,document,performance}});
  document.dispatchEvent(new Event('DOMContentLoaded'));
  const output=document.querySelector('#forge-timing-output');
  const before=output.textContent;
  const at=performance.now();
  host.__forgeWindowPerfPhaseRecorder('metadata-request-scheduled','window-a',at);
  host.__forgeWindowPerfPhaseRecorder('metadata-response-parsed','window-a',at+2);
  host.__forgeWindowPerfPhaseRecorder('metadata-signal-published','window-a',at+3);
  expect(trace.snapshot().phaseScopes[0].metadataResponseToPublishedMs).toBe(1);
  expect(frames).toHaveLength(1);
  expect(output.textContent).toBe(before);
  frames.shift()();
  expect(output.textContent).toContain('metadata-signal-published');
});

it('replaces a same-title row watcher and rejects late frames from the previous open',async()=>{
  const rowFrames=new Map();let nextFrame=0;
  vi.stubGlobal('requestAnimationFrame',callback=>{const id=++nextFrame;rowFrames.set(id,callback);return id;});
  vi.stubGlobal('cancelAnimationFrame',id=>rowFrames.delete(id));
  const host={location:{href:'http://fixture/?diagnostics=timing'},fetch:vi.fn(),
    requestAnimationFrame:vi.fn(),getComputedStyle:window.getComputedStyle};
  const trace=installForgePerfDiagnostics({env:{window:host,document,performance}});
  document.dispatchEvent(new Event('DOMContentLoaded'));
  const button=document.createElement('button');button.textContent='Connectors';document.body.append(button);
  const panel=document.createElement('div');panel.setAttribute('role','tabpanel');document.body.append(panel);
  document.querySelector('#forge-timing-arm').click();button.click();
  panel.innerHTML='<div class="basic-table-wrapper"><table><tbody><tr class="row"><td>old</td></tr></tbody></table></div>';
  await new Promise(resolve=>setTimeout(resolve,0));
  const oldFrame=[...rowFrames.values()][0];
  expect(trace.snapshot().events.filter(event=>event.kind==='rows-dom')).toHaveLength(1);
  panel.textContent='';
  document.querySelector('#forge-timing-arm').click();button.click();
  panel.innerHTML='<div class="basic-table-wrapper"><table><tbody><tr class="row"><td>new</td></tr></tbody></table></div>';
  await new Promise(resolve=>setTimeout(resolve,0));
  oldFrame(); // A callback already queued by the browser must still be inert.
  while(rowFrames.size){const [id,callback]=rowFrames.entries().next().value;rowFrames.delete(id);callback();}
  const events=trace.snapshot().events;
  expect(events.filter(event=>event.kind==='rows-dom')).toHaveLength(1);
  expect(events.filter(event=>event.kind==='rows-frame')).toHaveLength(1);
});

it('does not let a failed same-title open observe rows from the next open',async()=>{
  const host={location:{href:'http://fixture/?diagnostics=timing'},fetch:vi.fn(),getComputedStyle:window.getComputedStyle};
  const trace=installForgePerfDiagnostics({env:{window:host,document,performance}});
  document.dispatchEvent(new Event('DOMContentLoaded'));
  const button=document.createElement('button');button.textContent='Connectors';document.body.append(button);
  const panel=document.createElement('div');panel.setAttribute('role','tabpanel');document.body.append(panel);
  document.querySelector('#forge-timing-arm').click();button.click(); // Denied: no rows arrive.
  document.querySelector('#forge-timing-arm').click();button.click();
  panel.innerHTML='<div class="basic-table-wrapper"><table><tbody><tr class="row"><td>admitted</td></tr></tbody></table></div>';
  await new Promise(resolve=>setTimeout(resolve,0));
  expect(trace.snapshot().events.filter(event=>event.kind==='rows-dom')).toHaveLength(1);
});

it('marks a new visible report commit and two frames without treating an old report as fresh',async()=>{
  const frames=[];
  vi.stubGlobal('requestAnimationFrame',callback=>{frames.push(callback);return frames.length;});
  const host={location:{href:'http://fixture/?diagnostics=timing'},fetch:vi.fn(),
    requestAnimationFrame:callback=>{frames.push(callback);return frames.length;},getComputedStyle:window.getComputedStyle};
  const panel=document.createElement('div');panel.setAttribute('role','tabpanel');
  const report=document.createElement('div');report.dataset.previewReportCommit='1';panel.append(report);document.body.append(panel);
  const trace=installForgePerfDiagnostics({env:{window:host,document,performance},
    findVisibleResult:container=>({kind:'report',element:container.querySelector('[data-preview-report-commit]'),
      token:Number(container.querySelector('[data-preview-report-commit]')?.dataset.previewReportCommit||0)})});
  document.dispatchEvent(new Event('DOMContentLoaded'));
  document.querySelector('#forge-timing-arm').click();
  const button=document.createElement('button');button.textContent='Apply filters';document.body.append(button);button.click();
  expect(trace.snapshot().events.some(event=>event.kind==='content-dom')).toBe(false);
  report.dataset.previewReportCommit='2';
  await new Promise(resolve=>setTimeout(resolve,0));
  expect(trace.snapshot().events.filter(event=>event.kind==='content-dom')).toMatchObject([{contentKind:'report'}]);
  expect(trace.snapshot().openToContentDOMMs).not.toBeNull();
  while(frames.length)frames.shift()();
  expect(trace.snapshot().events.filter(event=>event.kind==='content-frame')).toMatchObject([{contentKind:'report'}]);
  expect(trace.snapshot().openToContentFrameMs).not.toBeNull();
});

it('does not count old report table rows while the report commit token is unchanged',async()=>{
  vi.stubGlobal('requestAnimationFrame',callback=>setTimeout(callback,0));
  const host={location:{href:'http://fixture/?diagnostics=timing'},fetch:vi.fn(),getComputedStyle:window.getComputedStyle};
  const panel=document.createElement('div');panel.setAttribute('role','tabpanel');
  const report=document.createElement('div');report.dataset.previewReportCommit='1';
  report.innerHTML='<div class="basic-table-wrapper"><table><tbody><tr class="row"><td>old row</td></tr></tbody></table></div>';
  panel.append(report);document.body.append(panel);
  const trace=installForgePerfDiagnostics({env:{window:host,document,performance},
    findVisibleResult:container=>({kind:'report',element:report,token:Number(report.dataset.previewReportCommit)})});
  document.dispatchEvent(new Event('DOMContentLoaded'));
  document.querySelector('#forge-timing-arm').click();
  const button=document.createElement('button');button.textContent='Apply filters';document.body.append(button);button.click();
  report.querySelector('tbody').append(document.createElement('tr'));
  await new Promise(resolve=>setTimeout(resolve,0));
  expect(trace.snapshot().events.some(event=>['rows-dom','content-dom'].includes(event.kind))).toBe(false);
  report.dataset.previewReportCommit='2';
  await new Promise(resolve=>setTimeout(resolve,0));
  expect(trace.snapshot().events.filter(event=>event.kind==='content-dom')).toHaveLength(1);
});
