import React,{useState} from "react";
import {Button,Callout,HTMLSelect,Spinner} from "@blueprintjs/core";
import {buildRuntimeSections} from './reportSections.js';

// Keep authored table identities intact. Section labels disambiguate tables
// with the same caption without hiding exportable tables from other tabs.
export function reportExportTableOptions(tableBlocks = [], reportSpec) {
    const sections = buildRuntimeSections(reportSpec?.blocks || []);
    const owners = new Map();
    if (sections.length > 1) {
        for (const section of sections) {
            const label = section.navigationLabel || section.title;
            for (const block of section.items) {
                const names = owners.get(block.id) || [];
                if (!names.includes(label)) names.push(label);
                owners.set(block.id, names);
            }
        }
    }
    return tableBlocks.map(item => {
        const title = item.title || item.id;
        const section = owners.get(item.id)?.join(', ');
        return {value:item.id, label:section ? `${section} — ${title}` : title};
    });
}

// Shared by stored-resource viewers and workspace/authoring preview adapters.
export default function ReportOutputActions({scopeKey,output,disabled=false,tableBlocks,reportSpec,cancelable=false,workbookExport=false}) {
    const [table,setTable]=useState(null);
    const selected=tableBlocks?.length===1?tableBlocks[0].id:table?.scopeKey===scopeKey&&tableBlocks?.some(item=>item.id===table.id)?table.id:'';
    const blocked=disabled||!!output.busy;
    const tableUnavailable=Array.isArray(tableBlocks)&&!selected;
    return <div aria-label="Report output" style={{display:'flex',flexDirection:'column',gap:8,margin:'8px 0'}}>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
            <Button icon="print" onClick={output.previewPrint} disabled={blocked}>{output.printModel?'Close print preview':'Print preview'}</Button>
            {tableBlocks?.length>1&&<label>Export table <HTMLSelect aria-label="Export table" value={selected} disabled={blocked} onChange={event=>setTable({scopeKey,id:event.target.value})} options={[{value:'',label:'Choose a table'},...reportExportTableOptions(tableBlocks,reportSpec)]}/></label>}
            {['pdf','csv','xlsx'].map(format=>{const needsTable=format==='csv'||format==='xlsx'&&!workbookExport;return <Button key={format} disabled={blocked||(needsTable&&tableUnavailable)} onClick={()=>output.exportReport(format,needsTable?selected||undefined:undefined)}>Export {format.toUpperCase()}</Button>;})}
            {cancelable&&output.busy&&<Button icon="stop" onClick={output.cancelOutput}>Cancel</Button>}
        </div>
        {output.busy&&<Callout role="status" icon={<Spinner size={18}/>}>{output.busy==='print'?'Preparing print preview.':`Preparing ${output.busy.toUpperCase()} export.`}</Callout>}
        {output.error&&<Callout role="alert" intent="danger">{output.error}</Callout>}
    </div>;
}
