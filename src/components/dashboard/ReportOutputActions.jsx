import React,{useState} from "react";
import {Button,Callout,HTMLSelect,Spinner} from "@blueprintjs/core";

// Shared by stored-resource viewers and workspace/authoring preview adapters.
export default function ReportOutputActions({scopeKey,output,disabled=false,tableBlocks,cancelable=false,workbookExport=false}) {
    const [table,setTable]=useState(null);
    const selected=tableBlocks?.length===1?tableBlocks[0].id:table?.scopeKey===scopeKey&&tableBlocks?.some(item=>item.id===table.id)?table.id:'';
    const blocked=disabled||!!output.busy;
    const tableUnavailable=Array.isArray(tableBlocks)&&!selected;
    return <div aria-label="Report output" style={{display:'flex',flexDirection:'column',gap:8,margin:'8px 0'}}>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
            <Button icon="print" onClick={output.previewPrint} disabled={blocked}>{output.printModel?'Close print preview':'Print preview'}</Button>
            {tableBlocks?.length>1&&<label>Export table <HTMLSelect aria-label="Export table" value={selected} disabled={blocked} onChange={event=>setTable({scopeKey,id:event.target.value})} options={[{value:'',label:'Choose a table'},...tableBlocks.map(item=>({value:item.id,label:item.title||item.id}))]}/></label>}
            {['pdf','csv','xlsx'].map(format=>{const needsTable=format==='csv'||format==='xlsx'&&!workbookExport;return <Button key={format} disabled={blocked||(needsTable&&tableUnavailable)} onClick={()=>output.exportReport(format,needsTable?selected||undefined:undefined)}>Export {format.toUpperCase()}</Button>;})}
            {cancelable&&output.busy&&<Button icon="stop" onClick={output.cancelOutput}>Cancel</Button>}
        </div>
        {output.busy&&<Callout role="status" icon={<Spinner size={18}/>}>{output.busy==='print'?'Preparing print preview.':`Preparing ${output.busy.toUpperCase()} export.`}</Callout>}
        {output.error&&<Callout role="alert" intent="danger">{output.error}</Callout>}
    </div>;
}
