// Opt-in browser timing for Forge hosts. Hosts provide only route/visible-panel
// classification; the collector never retains inputs, URL queries or row data.
export function installForgePerfDiagnostics({env=globalThis,panelId='forge-timing-diagnostics',
  armId='forge-timing-arm',serverId='forge-timing-server',outputId='forge-timing-output',
  globalKey='__forgePerfDiagnostics',panelTitle='Forge timing diagnostics',
  classifyFetch=()=>'',resourcePath=()=>true,serverTimingPath=()=>false,
  clickLabel=event=>event.target?.closest?.('button')?.textContent?.trim(),
  findVisiblePanel=(doc)=>doc.querySelector('[role="tabpanel"]:not([hidden]):not([aria-hidden="true"])'),
}={}) {
  const {window, document, performance} = env;
  if (!window || !document || !performance || new URL(window.location.href).searchParams.get('diagnostics') !== 'timing') return null;
  if (window[globalKey]) return window[globalKey];

  const events = [];
  performance.setResourceTimingBufferSize?.(2000);
  let armed = false;
  let open = null;
  let panel;
  let output;
  let serverTiming = false;
  const now = () => +performance.now().toFixed(1);
  const safePath = input => {
    try { return new URL(typeof input === 'string' ? input : input.url, window.location.href).pathname; }
    catch { return '[unknown]'; }
  };
  const safeRoutingFlags = input => {
    try {
      const query=new URL(typeof input === 'string' ? input : input.url,window.location.href).searchParams;
      return {cohortRequest:query.get('cohort')==='1',windowIdPresent:query.has('windowId')};
    } catch {return {cohortRequest:false,windowIdPresent:false};}
  };
  const add = event => {
    events.push(event);
    if (events.length > 250) events.shift();
    render();
  };
  const relevantResources = () => performance.getEntriesByType('resource')
    .filter(entry => !open || entry.startTime >= open.start)
    .filter(entry => resourcePath(safePath(entry.name)))
    .map(entry => ({path:safePath(entry.name),start:+entry.startTime.toFixed(1),duration:+entry.duration.toFixed(1),
      dnsMs:+(entry.domainLookupEnd-entry.domainLookupStart).toFixed(1),
      connectMs:+(entry.connectEnd-entry.connectStart).toFixed(1),
      tlsMs:entry.secureConnectionStart > 0 ? +(entry.connectEnd-entry.secureConnectionStart).toFixed(1) : 0,
      ttfb:+(entry.responseStart-entry.requestStart).toFixed(1),transferSize:entry.transferSize,
      serverTiming:[...(entry.serverTiming || [])].map(({name,duration,description})=>{
        const count=/^count=(\d+)$/.exec(String(description || ''));
        return {name,duration:+duration.toFixed(1),...(count ? {count:Number(count[1])} : {})};
      })}));
  const snapshot = () => {
    const since = open?.start ?? 0;
    const scoped = events.filter(event => event.start >= since);
    const metadata = scoped.find(event => event.kind === 'fetch' && event.category === 'metadata');
    const data = scoped.filter(event => event.kind === 'fetch' && event.category === 'data');
    const rows = scoped.find(event => event.kind === 'rows-dom');
    const frame = scoped.find(event => event.kind === 'rows-frame');
    return {label:open?.label || '',armed,serverTiming,modelCache:{...(window.__forgeWindowModelCacheStats || {})},
      frameMeasure:'two requestAnimationFrame callbacks after the first visible row DOM commit; proxy, not GPU paint',
      openToMetadataEndMs:metadata && open ? +(metadata.end-open.start).toFixed(1) : null,
      openToDataEndMs:data.length && open ? +(Math.max(...data.map(entry=>entry.end))-open.start).toFixed(1) : null,
      openToRowsDOMMs:rows && open ? +(rows.start-open.start).toFixed(1) : null,
      openToRowsFrameMs:frame && open ? +(frame.start-open.start).toFixed(1) : null,
      events:scoped,resources:relevantResources()};
  };
  const render = () => { if (output) output.textContent = JSON.stringify(snapshot(),null,2); };

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    let request = input;
    const path = safePath(input);
    if (serverTiming && typeof input === 'string' && serverTimingPath(path)) {
      const url = new URL(input,window.location.href);
      url.searchParams.set('perf','1');
      request = input.startsWith('http') ? url.href : `${url.pathname}${url.search}`;
    }
    const start = now();
    const category=classifyFetch(path,input,init);
    const routing=safeRoutingFlags(input);
    const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    try {
      const response = await originalFetch(request,init);
      add({kind:'fetch',path,method,category,...routing,start,end:now(),status:response.status});
      return response;
    } catch (error) {
      add({kind:'fetch',path,method,category,...routing,start,end:now(),error:String(error?.name || 'Error')});
      throw error;
    }
  };

  const watchRows = label => {
    let metadataSeen = false;
    const observer = new MutationObserver(() => {
      const panel = findVisiblePanel(document,label);
      if (!panel || panel.checkVisibility?.({checkVisibilityCSS:true}) === false) return;
      const style = window.getComputedStyle?.(panel);
      if (style?.display === 'none' || style?.visibility === 'hidden') return;
      if (!metadataSeen && panel.querySelector('.basic-table-wrapper')) {
        metadataSeen = true;
        add({kind:'table-dom',start:now()});
      }
      const rows = panel.querySelectorAll('.basic-table-wrapper tbody tr.row');
      if (!rows.length) return;
      add({kind:'rows-dom',start:now(),rowCount:rows.length});
      observer.disconnect();
      requestAnimationFrame(() => requestAnimationFrame(() => add({kind:'rows-frame',start:now()})));
    });
    observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
    setTimeout(()=>observer.disconnect(),30000);
  };
  document.addEventListener('click', event => {
    if (!armed || panel?.contains(event.target)) return;
    const label = clickLabel(event);
    if (!label) return;
    armed = false;
    events.length = 0;
    open = {label,start:now()};
    add({kind:'open-click',start:open.start});
    watchRows(label);
  },true);

  const mount = () => {
    panel = document.createElement('details');
    panel.id = panelId;
    panel.open = true;
    panel.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:2147483647;width:min(520px,90vw);max-height:46vh;overflow:auto;background:#fff;color:#111;border:2px solid #333;padding:8px;font:12px monospace;box-shadow:0 3px 12px #0005';
    const summary = document.createElement('summary');
    summary.textContent = panelTitle;
    panel.append(summary);
    const arm = document.createElement('button');
    arm.id = armId;
    arm.textContent = 'Arm next window click';
    arm.onclick = () => {performance.clearResourceTimings?.();armed = true;render();};
    panel.append(arm);
    const toggle = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = serverId;
    input.onchange = () => {serverTiming = input.checked;render();};
    toggle.append(input,document.createTextNode(' Request Server-Timing'));
    panel.append(toggle);
    output = document.createElement('pre');
    output.id = outputId;
    output.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere';
    panel.append(output);
    document.body.append(panel);
    render();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',mount,{once:true});
  else mount();
  const diagnostics = {snapshot};
  window[globalKey] = diagnostics;
  return diagnostics;
}
