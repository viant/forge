// Independently authored neutral fixture; no host data or service dependencies.
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import ReportFilterBar from '../../components/dashboard/ReportFilterBar.jsx';
import '../../packs/blueprint/index.jsx';
import '@blueprintjs/core/lib/css/blueprint.css';
import './reportFilterPreview.css';

const query = new URLSearchParams(location.search);
const placement = query.get('placement') || 'top';
const label = query.has('long') ? 'Observation period for the selected monitoring locations' : 'Daily trend dates';
const initial = {from:'2026-10-01',to:'2026-10-31',measure:'count',minimum:0,search:''};
function App() {
    const [values,setValues]=useState(initial),[preset,setPreset]=useState('month'),[status,setStatus]=useState('Ready');
    const controls=[{id:'period',kind:'dateRange',label,start:'from',end:'to',required:true,presetValue:preset,
        ...(query.has('plain')?{}:{datePresets:{default:'month',options:[{value:'month',label:'Last completed month'},{value:'custom',label:'Custom'}]}}),
        ...(query.has('error')?{presetError:'The calendar could not be loaded.',presetRequestedValue:'month'}:{})},
        {id:'measure',label:'Measure',kind:'select',choices:[{value:'count',label:'Observation count'},{value:'duration',label:'Duration'}]},
        {id:'minimum',label:'Minimum samples',kind:'number'}, {id:'search',label:'Search',kind:'text'}];
    return <main><h1>Monitoring report</h1><div className="forge-report-filter-layout">
        <ReportFilterBar controls={controls} values={values} placement={placement}
            onChange={(key,value)=>{setValues(previous=>({...previous,[key]:value}));setPreset('custom');}}
            onDatePreset={(_,value)=>{setPreset(value);setValues(previous=>({...previous,from:initial.from,to:initial.to}));}}
            onDateRange={(_,range)=>{setValues(previous=>({...previous,from:range.start,to:range.end}));setPreset('custom');}}
            onApply={()=>setStatus(`Applied ${values.from} to ${values.to}`)} onReset={()=>{setValues(initial);setPreset('month');setStatus('Reset');}}/>
        <section><h2>Observations</h2><p role="status">{status}</p><p>Synthetic monitoring data appears here.</p></section>
    </div></main>;
}
createRoot(document.getElementById('root')).render(<App/>);
