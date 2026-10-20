import React from 'react';
import {createRoot} from 'react-dom/client';
import WindowContent from '../../src/components/WindowContent.jsx';
import {SettingProvider} from '../../src/core/context/Setting.jsx';
import '../../src/packs/blueprint/index.jsx';
import '@blueprintjs/core/lib/css/blueprint.css';
import YAML from 'yaml';
import source from './main.yaml?raw';
const {window:definition,dataSources}=YAML.parse(source);
const metadata={...definition,namespace:'demo',dataSource:dataSources};
const draft={name:'Limit',type:'int',kind:'query',source:'limit',codec:{name:'',arguments:''},error:{code:422,message:'Invalid limit'}};
metadata.on=[{event:'onInit',handler:'example.initialize'}];
metadata.actionAliases=['example'];
metadata.actions={code:`({initialize:()=>context.Context('input_draft').handlers.dataSource.setFormData({values:${JSON.stringify(draft)}})})`};
// Local fixture transport for this standalone component demonstration.
function Preview(){
 const [saved,setSaved]=React.useState(null);
 const services=React.useMemo(()=>({dataConnectorTransport:async({dataSourceRef,options})=>{
  if(dataSourceRef==='input_kinds')return {data:{items:[{value:'query',label:'Query'},{value:'header',label:'Header'},{value:'body',label:'Body'}]}};
  if(dataSourceRef==='codecs')return {data:{items:[{name:'',description:'No codec'},{name:'example.codec.Normalize',description:'Normalize text'}]}};
  if(dataSourceRef==='input_save'){setSaved(options?.inputParameters||{});return {data:{saved:true}};}
  return {data:[]};
 }}),[]);
 return <main style={{maxWidth:920,margin:'32px auto',padding:'0 24px'}}><h1 style={{fontSize:24}}>Parameter editor</h1><p>Reusable Forge component · local demonstration</p><SettingProvider endpoints={{}} connectorConfig={{window:{service:{uri:'/example'}}}} services={services}><WindowContent window={{windowId:'parameter-example',windowKey:'parameter-editor-example'}} selectedMetadata={metadata}/></SettingProvider>{saved&&<section aria-label="Saved fixture value"><h2 style={{fontSize:16}}>Saved fixture value</h2><pre>{JSON.stringify(saved,null,2)}</pre></section>}</main>;
}
createRoot(document.getElementById('root')).render(<Preview/>);
