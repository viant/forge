import React from 'react';
import {signal} from '@preact/signals-react';
import Container from '../../components/Container.jsx';
import Typography from '../../components/Typography.jsx';

const context = {identity:{windowId:'document-example',dataSourceRef:''},signals:{control:signal({}),form:signal({}),formStatus:signal({}),selection:signal({}),collection:signal([])},handlers:{dataSource:{}}};
context.Context=()=>context;
export const documentExample={id:'document-example',appearance:'document',sizingMode:'content',layout:{kind:'grid',appearance:'document-flow',columns:1,itemStretch:false},containers:[
    {id:'example-header',appearance:'document-header',layout:{kind:'grid',columns:1,labels:{mode:'none'}},items:[{id:'example-title',type:'label',value:'Example working document',properties:{as:'h1',typographyRole:'title'}}],toolbar:{items:[{id:'example-export',label:'Export example',hideLabel:false,variant:'secondary',icon:'lucide:file-down'}]}},
    {id:'example-form',section:{appearance:'quiet',contentInset:'flush'},title:'Document fields',schemaBasedForm:{id:'document-example-form',showSubmit:false,data:{name:'A retained example',period:{start:'2026-01-01',end:'2026-01-31'}},layout:{kind:'grid',appearance:'field-tracks',columns:2,labels:{mode:'top',align:'start'},collapseAt:'phone'},schema:{type:'object',properties:{name:{type:'string',title:'Example name'},amount:{type:'number',title:'Example amount'},period:{type:'object',title:'Example period','x-ui-widget':'dateRange','x-ui-span':2,'x-ui-hide-label':true,'x-ui-properties':{appearance:'document'}}}}}},
    {id:'example-summary',kind:'dashboard.summary',appearance:'document-summary',items:[{id:'example-count',label:'Records',value:12,format:'number'},{id:'example-state',label:'State',value:'Draft'}]},
    {id:'document-sections',tabs:{appearance:'section',ariaLabel:'Document sections'},containers:['Overview','Records','Schedule','Sources','Validation','Settings','History'].map(title=>({id:`document-${title.toLowerCase()}`,title,items:[{id:'section-description',type:'label',value:`${title} section content.`,properties:{typographyRole:'body'}}]}))},
]};
export default function DocumentSpecimen(){return <section aria-label="Document presentation specimen"><Typography as="h2" typeRole="section">Document presentation</Typography><Container container={documentExample} context={context}/></section>;}
