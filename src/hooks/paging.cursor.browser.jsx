import React from 'react';
import {createRoot} from 'react-dom/client';
import {signal} from '@preact/signals-react';
import PaginationBar from '../components/table/basic/PaginationBar.jsx';
import {createCursorPagingSession} from './paging.js';
import {createTransportConnector} from './connectorTransport.js';
import {withFetchedPageInfo} from '../components/dataSourceFetchState.js';
import {extractData} from '../components/dataSourceExtract.js';
const paging={enabled:true,mode:'cursor',size:1,parameters:{page:'resumeToken',size:'batchSize'},dataInfoSelectors:{hasMore:'remaining',nextCursor:'nextToken'}};
const session=createCursorPagingSession();
let association={window:'window://generic/one',target:'phone',alias:'localRows',query:'first',filter:'a',sort:'name'};
const calls=[],info=signal({}),page=signal(1),collection=signal([]),control=signal({loading:false});
const connector=createTransportConnector({id:'localRows',paging},{transport:async ({options})=>{
 const args=options.inputParameters;for(const key of Object.keys(args))if(!['term','resumeToken','batchSize'].includes(key))throw Error('undeclared argument '+key);
 calls.push({...args});const final=args.resumeToken!=null;return {reply:{widgets:[{id:final?'beta':'alpha'}]},nav:{remaining:!final,...(!final?{nextToken:'opaque+/=😎'}:{})}};
}});
async function fetchPage(next) {
 control.value={loading:true};
 try {const request=session.begin(next,association);const payload=await connector.get({page:request.page,cursor:request.cursor,inputParameters:{term:association.query}});
 const extracted=extractData({data:'reply.widgets',dataInfo:'nav'},paging,payload);const nextInfo=session.finish(request,extracted.info);
 if(nextInfo){info.value=nextInfo;page.value=request.page;collection.value=extracted.records;document.querySelector('#rows').textContent=JSON.stringify(extracted.records);}
 document.querySelector('#calls').textContent=JSON.stringify(calls);
 }finally{control.value={loading:false};}
}
const context={signals:{control,collection},handlers:{dataSource:{getCollectionInfo:()=>info.value,getPage:()=>page.value,isInactive:()=>false,setPage:fetchPage}}};
function renderFullPage(mode) {
 const config={enabled:true,mode,size:2,dataInfoSelectors:{hasMore:'remaining'}};
 const extracted=extractData({data:'rows',dataInfo:'nav'},config,{rows:[{id:'one'},{id:'two'}],nav:{remaining:false}});
 info.value=withFetchedPageInfo(extracted.info,3,true,{returnedCount:2,pageSize:2,mode,hasMoreSelector:'remaining'});
 page.value=3;collection.value=extracted.records;
 document.querySelector('#rows').textContent=mode?'offset-final':'legacy-full';
}
async function verifyRoundedNumericCursor() {
 const before=collection.peek();let refused=0;
 for(const suffix of ['', '?object=1']) {
  const isolated=createCursorPagingSession();const request=isolated.begin(1,{proof:suffix});
  const payload=await fetch('/cursor-rounded-numeric'+suffix).then(response=>response.json());
  const extracted=extractData({data:'reply.widgets',dataInfo:'nav'},paging,payload);
  try { isolated.finish(request,extracted.info); } catch(error) { if(/lossless transport/.test(error.message)) refused++; else throw error; }
  try { isolated.begin(2,{proof:suffix}); throw Error('rounded continuation admitted'); } catch(error) { if(!/no admitted/.test(error.message)) throw error; }
 }
 if(refused!==2 || collection.peek()!==before) throw Error('rounded numeric rows released');
 document.querySelector('#precision').textContent='rounded scalar/object refused; no rows or continuation';
}
function App(){return <><PaginationBar context={context}/><pre id="rows"/><pre id="calls"/><pre id="precision"/><button onClick={()=>verifyRoundedNumericCursor().catch(error=>{document.querySelector('#precision').textContent=error.message})}>Verify rounded numeric cursors</button><button onClick={()=>renderFullPage('offset')}>Render explicit final offset</button><button onClick={()=>renderFullPage('')}>Render legacy full page</button>{['query','filter','sort','window','target'].map(key=><button key={key} onClick={()=>{association={...association,[key]:association[key]+'-changed'};fetchPage(2);}}>Change {key}</button>)}</>}
createRoot(document.getElementById('root')).render(<App/>);
setTimeout(()=>fetchPage(1),0);
