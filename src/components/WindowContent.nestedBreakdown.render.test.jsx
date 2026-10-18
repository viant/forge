// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import WindowContent from './WindowContent.jsx';
import {SettingProvider} from '../core/context/Setting.jsx';
import {removeSignalsForKey} from '../core/store/signals.js';
import '../packs/blueprint/index.jsx';

let root,host;
const windowId='nested-breakdown-fetch-test';
afterEach(async()=>{if(root)await act(async()=>root.unmount());host?.remove();removeSignalsForKey(windowId);root=null;host=null;});

it('fetches a nested Breakdown datasource after the Delivery datasource fails',async()=>{
  globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  globalThis.ResizeObserver ||= class {observe(){} disconnect(){}};
  HTMLElement.prototype.scrollIntoView ||= function(){};
  host=document.createElement('div');document.body.append(host);root=createRoot(host);
  const requests=[];
  const transport=vi.fn(async request=>{
    requests.push(request.dataSourceRef);
    if(request.dataSourceRef==='delivery')throw Object.assign(new Error('Expected missing delivery producer'),{status:403,code:'datasource_denied'});
    if(request.dataSourceRef==='exchange')return {data:[{id:8,name:'Publisher eight'}]};
    if(request.dataSourceRef==='record')return {data:[{id:1,name:'Line one'}]};
    throw new Error(`Unexpected datasource ${request.dataSourceRef}`);
  });
  const metadata={dataSource:{
    record:{id:'record',service:{uri:'mcp://fixture/record'},selectionMode:'single'},
    delivery:{id:'delivery',service:{uri:'mcp://fixture/delivery'},selectionMode:'none'},
    exchange:{id:'exchange',service:{uri:'mcp://fixture/exchange'},selectionMode:'none'},
  },view:{content:{id:'lineRoot',containers:[{
    id:'lineWorkspaceBody',stableTabs:{defaultSelectedTabId:'properties',renderActiveTabPanelOnly:true,keepVisitedTabPanelsMounted:true,dataSourceFetchMode:'once'},
    containers:[
      {id:'properties',title:'Properties',dataSourceRef:'record',fetchData:true,items:[{id:'lineName',type:'label',value:'Line one'}]},
      {id:'performance',title:'Performance',sizingMode:'content',stableTabs:{fill:true,appearance:'section',defaultSelectedTabId:'deliveryTab',renderActiveTabPanelOnly:true,keepVisitedTabPanelsMounted:true},containers:[
        {id:'deliveryTab',title:'Delivery',dataSourceRef:'delivery',fetchData:true,items:[{id:'deliveryTitle',type:'label',value:'Delivery'}]},
        {id:'breakdownTab',title:'Breakdown',containers:[{id:'exchangeGrid',dataSourceRef:'exchange',fetchData:true,
          visibleWhen:{source:'windowForm',field:'dimension',equals:'exchange'},
          dataStateBoundary:{dataSourceRefs:['exchange'],renderEmptyContent:true,emptyMessage:'No breakdown data'},
          responsiveDataGrid:{identityColumns:['name'],breakpoints:{desktop:{columns:['name'],density:'compact',rowLayout:'table'}}},
          table:{columns:[{id:'name',name:'Name'}]}}]},
      ]},
    ],
  }]}}};
  const settle=async(action)=>act(async()=>{action?.();for(let i=0;i<25;i++)await Promise.resolve();});
  await settle(()=>root.render(<SettingProvider endpoints={{}} connectorConfig={{window:{service:{uri:'/window'}}}} services={{dataConnectorTransport:transport}}><WindowContent window={{windowId,windowKey:'mcp://fixture/line',parameters:{dimension:'exchange'}}} selectedMetadata={metadata}/></SettingProvider>));
  expect(requests).toContain('record');
  expect(requests).not.toContain('exchange');
  await settle(()=>[...host.querySelectorAll('[role=tab]')].find(x=>x.textContent.trim()==='Performance').click());
  expect(requests).toContain('delivery');
  await settle(()=>[...host.querySelectorAll('[role=tab]')].find(x=>x.textContent.trim()==='Breakdown').click());
  expect(requests).toContain('exchange');
  const breakdown = [...host.querySelectorAll('[id^="forge-tabs-performance-panel-"]')].find(panel => !panel.hidden);
  expect(breakdown).toBeTruthy();
  expect(breakdown.closest('.forge-form-panel-section-tabs').classList.contains('is-fill')).toBe(false);
});
