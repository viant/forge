// @vitest-environment jsdom
import {expect,it,vi} from 'vitest';
import React from 'react';
import {createRoot} from 'react-dom/client';
import WindowContent from './WindowContent.jsx';
import {SettingProvider} from '../core/context/Setting.jsx';
import {removeSignalsForKey} from '../core/store/signals.js';
import '../packs/blueprint/index.jsx';

it('fetches an eager reader once with the final preset dates and never auto-runs a command',async()=>{
  vi.useFakeTimers({toFake:['Date']});
  vi.setSystemTime(new Date('2026-10-25T12:00:00Z'));
  const previousAct=globalThis.IS_REACT_ACT_ENVIRONMENT;
  const previousResizeObserver=globalThis.ResizeObserver;
  globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  globalThis.ResizeObserver=class{observe(){} disconnect(){}};
  const host=document.createElement('div');document.body.append(host);
  const root=createRoot(host),windowId='initial-preset-reader',customWindowId='initial-preset-reader-custom';
  const requests=[];
  const transport=async request=>{
    requests.push(request);
    return {data:[{spend:29260}]};
  };
  const metadata={
    window:{on:[{event:'onInit',handler:'dataSource.setWindowFormData',parameters:[
      {name:'periodView',in:'const',location:'month'},
      {name:'granularity',in:'const',location:'day'},
      {name:'customDateStart',in:'const',location:''},
      {name:'customDateEnd',in:'const',location:''},
    ]}]},
    dataSource:{
      overview:{id:'overview',cardinality:'collection',service:{uri:'mcp://fixture/AdvertiserPerformance'},parameters:[
        {name:'AdvertiserId',in:'windowForm',location:'AdvertiserId',required:true},
        {name:'Period',in:'windowForm',location:'periodView'},
        {name:'Granularity',in:'windowForm',location:'granularity'},
        {name:'From',in:'windowForm',location:'customDateStart'},
        {name:'To',in:'windowForm',location:'customDateEnd'},
      ]},
      command:{id:'command',autoFetch:false,cardinality:'object',service:{uri:'mcp://fixture/save'}},
    },
    view:{content:{id:'root',items:[{
      id:'periodView',scope:'windowForm',type:'dateRangePreset',widget:'dateRangePreset',value:'month',
      options:[{value:'month',label:'Month'},{value:'custom',label:'Custom'}],
      properties:{startField:'customDateStart',endField:'customDateEnd',granularityField:'granularity'},
    }],containers:[
      {id:'overview',dataSourceRef:'overview',fetchData:true,table:{columns:[{id:'spend',name:'Spend'}]}},
      {id:'command',dataSourceRef:'command',fetchData:false},
    ]}},
  };
  try{
    await React.act(async()=>{
      root.render(<SettingProvider connectorConfig={{window:{service:{uri:'/window'}}}} services={{dataConnectorTransport:transport}}>
        <WindowContent key={windowId} window={{windowId,windowKey:'advertiser',parameters:{AdvertiserId:[350]}}} selectedMetadata={metadata}/>
      </SettingProvider>);
      for(let i=0;i<60;i++)await Promise.resolve();
    });
    expect(requests.filter(request=>request.dataSourceRef==='command')).toHaveLength(0);
    const reads=requests.filter(request=>request.dataSourceRef==='overview');
    expect(reads).toHaveLength(1);
    expect(reads[0].options?.inputParameters).toMatchObject({
      AdvertiserId:[350],Period:'month',Granularity:'day',From:'2026-09-25',To:'2026-10-25',
    });
    await React.act(async()=>{
      root.render(<SettingProvider connectorConfig={{window:{service:{uri:'/window'}}}} services={{dataConnectorTransport:transport}}>
        <WindowContent key={customWindowId} window={{windowId:customWindowId,windowKey:'advertiser',parameters:{AdvertiserId:[351],periodView:'custom',customDateStart:'2026-05-01',customDateEnd:'2026-05-10'}}} selectedMetadata={metadata}/>
      </SettingProvider>);
      for(let i=0;i<60;i++)await Promise.resolve();
    });
    const customReads=requests.filter(request=>request.dataSourceRef==='overview');
    expect(customReads).toHaveLength(2);
    expect(customReads[1].options?.inputParameters).toMatchObject({
      AdvertiserId:[351],Period:'custom',From:'2026-05-01',To:'2026-05-10',
    });
  }finally{
    await React.act(async()=>root.unmount());
    host.remove();removeSignalsForKey(windowId);removeSignalsForKey(customWindowId);
    globalThis.IS_REACT_ACT_ENVIRONMENT=previousAct;
    globalThis.ResizeObserver=previousResizeObserver;
    vi.useRealTimers();
  }
});
