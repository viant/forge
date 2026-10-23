// Opt-in browser timing for Forge hosts. Hosts provide only route/visible-panel
// classification; the collector never retains inputs, URL queries or row data.
export function installForgePerfDiagnostics({env=globalThis,panelId='forge-timing-diagnostics',
  armId='forge-timing-arm',serverId='forge-timing-server',outputId='forge-timing-output',
  globalKey='__forgePerfDiagnostics',panelTitle='Forge timing diagnostics',
  classifyFetch=()=>'',resourcePath=()=>true,serverTimingPath=()=>false,
  openPublishedWindow=null,
  clickLabel=event=>event.target?.closest?.('button')?.textContent?.trim(),
  findVisiblePanel=(doc)=>doc.querySelector('[role="tabpanel"]:not([hidden]):not([aria-hidden="true"])'),
}={}) {
  const {window, document, performance} = env;
  if (!window || !document || !performance || new URL(window.location.href).searchParams.get('diagnostics') !== 'timing') return null;
  if (window[globalKey]) return window[globalKey];

  const events = [];
  const scopes=new Map();
  let nextScope=0;
  const fixedPhases=new Set(['metadata-request-scheduled','metadata-response-parsed','metadata-signal-published',
    'metadata-prime-complete','datasource-mounted','datasource-fetch-start']);
  performance.setResourceTimingBufferSize?.(2000);
  let armed = false;
  let open = null;
  let panel;
  let output;
  let serverTiming = false;
  let opener = typeof openPublishedWindow === 'function' ? openPublishedWindow : null;
  let openerControls;
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
    scheduleRender();
  };
  window.__forgeWindowPerfPhaseRecorder=(phase,windowId,at)=>{
    if (!fixedPhases.has(phase) || !windowId || !Number.isFinite(at)) return;
    let scope=scopes.get(windowId);
    if(!scope){
      if(scopes.size>=64)scopes.delete(scopes.keys().next().value);
      scope=++nextScope;scopes.set(windowId,scope);
    }
    add({kind:'window-phase',scope,phase,start:+at.toFixed(1)});
  };
  const relevantResources = () => {
    const variants=new Map();
    return performance.getEntriesByType('resource')
    .filter(entry => !open || entry.startTime >= open.start)
    .filter(entry => resourcePath(safePath(entry.name)))
    .map(entry => {
      let queryKeys=[];
      try { queryKeys=[...new Set(new URL(entry.name,window.location.href).searchParams.keys())].sort(); } catch (_) {}
      if (!variants.has(entry.name)) variants.set(entry.name,variants.size+1);
      return {path:safePath(entry.name),queryKeys,urlVariant:variants.get(entry.name),
      initiatorType:String(entry.initiatorType || ''),responseStatus:Number(entry.responseStatus || 0),
      encodedBodySize:Number(entry.encodedBodySize || 0),start:+entry.startTime.toFixed(1),duration:+entry.duration.toFixed(1),
      dnsMs:+(entry.domainLookupEnd-entry.domainLookupStart).toFixed(1),
      connectMs:+(entry.connectEnd-entry.connectStart).toFixed(1),
      tlsMs:entry.secureConnectionStart > 0 ? +(entry.connectEnd-entry.secureConnectionStart).toFixed(1) : 0,
      ttfb:+(entry.responseStart-entry.requestStart).toFixed(1),transferSize:entry.transferSize,
      serverTiming:[...(entry.serverTiming || [])].map(({name,duration,description})=>{
        const count=/^count=(\d+)$/.exec(String(description || ''));
        return {name,duration:+duration.toFixed(1),...(count ? {count:Number(count[1])} : {})};
      })};
    });
  };
  const snapshot = () => {
    const since = open?.start ?? 0;
    const scoped = events.filter(event => event.start >= since);
    const metadata = scoped.find(event => event.kind === 'fetch' && event.category === 'metadata');
    const data = scoped.filter(event => event.kind === 'fetch' && event.category === 'data');
    const rows = scoped.find(event => event.kind === 'rows-dom');
    const frame = scoped.find(event => event.kind === 'rows-frame');
    const phases=[...new Set(scoped.filter(event=>event.kind==='window-phase').map(event=>event.scope))]
      .map(scope=>{
        const own=scoped.filter(event=>event.kind==='window-phase' && event.scope===scope);
        const at=phase=>own.find(event=>event.phase===phase)?.start;
        const response=at('metadata-response-parsed'),published=at('metadata-signal-published'),primed=at('metadata-prime-complete');
        const scheduled=at('metadata-request-scheduled');
        const mounted=at('datasource-mounted'),fetchStarted=at('datasource-fetch-start');
        return {scope,clickToMetadataScheduleMs:open && scheduled!==undefined?+(scheduled-open.start).toFixed(1):null,
          metadataResponseToPublishedMs:response!==undefined&&published!==undefined?+(published-response).toFixed(1):null,
          metadataResponseToPrimeMs:response!==undefined&&primed!==undefined?+(primed-response).toFixed(1):null,
          metadataPublishedToPrimeMs:published!==undefined&&primed!==undefined?+(primed-published).toFixed(1):null,
          clickToFirstDatasourceMountMs:open&&mounted!==undefined?+(mounted-open.start).toFixed(1):null,
          clickToFirstDatasourceFetchStartMs:open&&fetchStarted!==undefined?+(fetchStarted-open.start).toFixed(1):null};
      });
    const latestDataEnd=data.length?Math.max(...data.map(entry=>entry.end)):null;
    return {label:open?.label || '',armed,serverTiming,modelCache:{...(window.__forgeWindowModelCacheStats || {})},
      frameMeasure:'two requestAnimationFrame callbacks after the first visible row DOM commit; proxy, not GPU paint',
      clickToMetadataNetworkStartMs:metadata&&open?+(metadata.start-open.start).toFixed(1):null,
      openToMetadataEndMs:metadata && open ? +(metadata.end-open.start).toFixed(1) : null,
      openToDataEndMs:data.length && open ? +(Math.max(...data.map(entry=>entry.end))-open.start).toFixed(1) : null,
      metadataEndToDataNetworkStartMs:metadata&&data.length===1&&data[0].start>=metadata.end?+(data[0].start-metadata.end).toFixed(1):null,
      openToRowsDOMMs:rows && open ? +(rows.start-open.start).toFixed(1) : null,
      openToRowsFrameMs:frame && open ? +(frame.start-open.start).toFixed(1) : null,
      dataEndToRowsDOMMs:rows && data.length===1 && latestDataEnd!==null && rows.start>=latestDataEnd?+(rows.start-latestDataEnd).toFixed(1):null,
      phaseScopes:phases,events:scoped,resources:relevantResources()};
  };
  const render = () => { if (output) output.textContent = JSON.stringify(snapshot(),null,2); };
  let renderScheduled=false;
  const scheduleRender=()=>{
    if(renderScheduled)return;
    renderScheduled=true;
    const schedule=typeof window.requestAnimationFrame==='function'
      ? callback=>window.requestAnimationFrame(callback)
      : callback=>setTimeout(callback,0);
    schedule(()=>{renderScheduled=false;render();});
  };

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
  const beginOpen = label => {
    performance.clearResourceTimings?.();
    scopes.clear();nextScope=0;
    armed = false;
    events.length = 0;
    open = {label,start:now()};
    add({kind:'open-click',start:open.start});
    watchRows(label);
  };
  document.addEventListener('click', event => {
    if (!armed || panel?.contains(event.target)) return;
    const label = clickLabel(event);
    if (!label) return;
    beginOpen(label);
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
    openerControls=document.createElement('div');
    openerControls.id=`${panelId}-published-opener`;
    openerControls.hidden=!opener;
    const provider=document.createElement('input');
    provider.id=`${panelId}-provider`;
    provider.placeholder='Provider identity';
    provider.setAttribute('aria-label','Published provider identity');
    const uri=document.createElement('input');
    uri.id=`${panelId}-uri`;
    uri.placeholder='window://namespace/name';
    uri.setAttribute('aria-label','Published window URI');
    const openButton=document.createElement('button');
    openButton.id=`${panelId}-open`;
    openButton.textContent='Open published window';
    const status=document.createElement('span');
    status.id=`${panelId}-opener-status`;
    status.setAttribute('role','status');
    openButton.onclick=async()=>{
      const providerIdentity=provider.value.trim(),resourceURI=uri.value.trim();
      if (!opener || !/^[A-Za-z0-9._:/-]{1,256}$/.test(providerIdentity) ||
          resourceURI.length>1024 || !/^window:\/\/[^/?#]+\/[^?#]+$/.test(resourceURI)) {
        status.textContent='Enter a canonical window URI and provider identity.';
        return;
      }
      const name=resourceURI.slice(resourceURI.lastIndexOf('/')+1);
      const plainLabel=name.replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/[-_]+/g,' ').trim();
      const label=plainLabel ? plainLabel[0].toUpperCase()+plainLabel.slice(1) : 'Published window';
      status.textContent='Opening through the normal workspace route…';
      beginOpen(label);
      try {
        await opener({providerIdentity,uri:resourceURI,title:label});
        status.textContent='Workspace open requested; server admission is pending.';
      } catch {
        status.textContent='The workspace could not open this window.';
      }
    };
    openerControls.append(provider,uri,openButton,status);
    panel.append(openerControls);
    output = document.createElement('pre');
    output.id = outputId;
    output.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere';
    panel.append(output);
    document.body.append(panel);
    render();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',mount,{once:true});
  else mount();
  const diagnostics = {snapshot,setOpenPublishedWindow(callback) {
    opener=typeof callback==='function'?callback:null;
    if(openerControls)openerControls.hidden=!opener;
  }};
  window[globalKey] = diagnostics;
  return diagnostics;
}
