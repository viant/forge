// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import ReportCatalog from './ReportCatalog.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let root;
afterEach(()=>{if(root)act(()=>root.unmount());root=null;document.body.replaceChildren();});

it('loads a scoped match after an empty page and opens its exact publisher',async()=>{
 const uri='report://sample/nested/summary';
 const pin={uri,kind:'working',providerIdentity:'producer',contentFingerprint:'hash',authorityBinding:'reader',validUntil:'2099-01-01T00:00:00Z'};
 const listReports=vi.fn().mockResolvedValueOnce({reports:[],nextCursor:'opaque'}).mockResolvedValueOnce({reports:[{resourceUri:uri,resource:pin,title:'Reading summary',namespace:'sample',name:'nested/summary',capabilities:{open:true}}]});
 const getReport=vi.fn(),openTarget=vi.fn();
 const context={windowState:{resourceRef:{uri:'window://sample/catalog'},parameters:{cohortKey:false}},handlers:{reportStore:{listReports,getReport},window:{openTarget}}};
 const element=document.createElement('div');document.body.append(element);root=createRoot(element);
 const click=text=>{const button=[...element.querySelectorAll('button')].find(b=>b.textContent.trim()===text);expect(button).toBeTruthy();button.click();};
 await act(async()=>root.render(<ReportCatalog context={context} container={{reportCatalog:{scope:{label:'Current collection',key:'collection',parameters:['cohortKey']}}}}/>));
 expect(listReports.mock.calls[0][0]).toMatchObject({namespace:'sample',scope:{key:'collection',value:false}});
 expect(element.textContent).toContain('No matches on this page');
 await act(async()=>click('Load more reports'));
 expect(listReports.mock.calls[1][0]).toMatchObject({namespace:'sample',scope:{key:'collection',value:false},cursor:'opaque'});
 expect(element.textContent).toContain('Reading summary');
 await act(async()=>click('Open'));
 expect(openTarget.mock.calls[0][0].target).toMatchObject({windowKey:uri,providerIdentity:'producer',resourceRef:{uri,revision:'working'},parameters:{executeOnOpen:false}});
 expect(getReport).not.toHaveBeenCalled();
});
