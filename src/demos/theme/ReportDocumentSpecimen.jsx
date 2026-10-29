import React, {useMemo, useState} from 'react';
import {compileInlineReport, applyInlineReportFilterValues, applyInlineReportTableSelections} from '../../reporting/inlineReportCompiler.js';
import ReportRuntime from '../../components/dashboard/ReportRuntime.jsx';
import Typography from '../../components/Typography.jsx';
import Button from '../../components/Button.jsx';
import SelectControl from '../../components/SelectControl.jsx';
import {updateReportChartTableSwitch} from '../../reporting/reportViewerSettings.js';

export const reportDocumentExample = {
    title:'Example analytical report', subtitle:'Shared report presentation with local sample data.',
    viewer:{appearance:'document',allowChartTableSwitch:false},
    filters:[{id:'period',label:'Date range',type:'dateRange',value:{start:'2026-01-01',end:'2026-01-07'}}],
    blocks:[
        {id:'tabs',kind:'tabGroupBlock',sectionIds:['overview','records'],defaultSectionId:'overview'},
        {id:'overview',kind:'sectionBlock',title:'Overview'},
        {id:'filters',kind:'filterBarBlock',paramIds:['period'],mode:'unified',placement:'inline'},
        {id:'readout',kind:'markdownBlock',markdown:'Review the distribution and supporting records for the selected period.\n\nCompare the matching evidence window.\n\n\nKeep the reported limitations with the findings.'},
        {id:'total',kind:'kpiBlock',title:'Records',datasetRef:'examples',valueField:'count',valueLabel:'Records',valueFormat:'number',secondaryField:'change',secondaryLabel:'Compared with prior period',secondaryFormat:'percentFraction',secondaryTrend:true,presentationMode:'both',bodyTemplate:'The comparison uses the same complete-day window.',sparkline:{datasetRef:'examples',categoryField:'group',valueField:'count'}},
        {id:'comparison',kind:'kpiBlock',title:'Prior period',datasetRef:'examples',valueField:'count',valueFormat:'number'},
        {id:'metrics',kind:'compositeBlock',childBlockIds:['total','comparison']},
        ...[['summary-count','Summary records','count','number'],['summary-groups','Summary groups','groups','number'],['summary-active','Active examples','active','number'],['summary-change','Change examples','change','percentFraction'],['summary-amount','Large amount','amount','currency2'],['summary-pending','Pending examples','pending','number'],['summary-forecast','Forecast records','forecast','number'],['summary-estimate','Estimated amount','estimate','currency2']].map(([id,title,valueField,valueFormat])=>({id,kind:'kpiBlock',title,datasetRef:'examples',valueField,valueFormat})),
        {id:'summary-metrics',kind:'compositeBlock',childBlockIds:['summary-count','summary-groups','summary-active','summary-change','summary-amount','summary-pending','summary-forecast','summary-estimate']},
        {id:'assessment',kind:'infoPanelBlock',title:'Assessment',tone:'neutral',body:'Review the observed evidence before deciding what to change.'},
        {id:'signals',kind:'badgesBlock',title:'Review state',datasetRef:'examples',items:[{id:'status',label:'Status',value:'Review only',tone:'warning'}]},
        {id:'signals-empty',kind:'badgesBlock',title:'Unavailable status',items:[]},
        {id:'guardrail',kind:'calloutBlock',title:'Evidence limit',tone:'warning',icon:'lucide:circle-alert',body:'No action is authorized by this example.'},
        {id:'next-steps',kind:'markdownBlock',title:'Next steps',markdown:'1. **Check the scope.** Keep the complete explanation with this first step.\n\n2. Compare the evidence before deciding what to change.\n\n3. Record the remaining uncertainty.'},
        {id:'trend',kind:'chartBlock',title:'Records by group',datasetRef:'examples',chartSpec:{appearance:'document',type:'horizontal_bar',xField:'group',yFields:['count']}},
        {id:'records',kind:'sectionBlock',title:'Records'},
        {id:'detail',kind:'tableBlock',title:'Supporting records',datasetRef:'examples',columns:[{key:'group',label:'Group',flex:true,minWidth:160},{key:'count',label:'Records',format:'number',align:'right',width:96}]},
        {id:'workflow',kind:'collectionBlock',title:'Review stages',datasetRef:'examples',itemTitleField:'group',layout:'list',columns:1,rowLimit:2,bodyTemplate:'Inspect the evidence and its limits.'},
        {id:'review',kind:'tableBlock',title:'Candidate records',datasetRef:'examples',recordTitleField:'group',columns:[{key:'group',label:'Group'},{key:'count',label:'Records',format:'number'},{key:'selected',label:'Selected'}]},
        {id:'choices',kind:'tableBlock',title:'Review choices',datasetRef:'examples',selection:{mode:'checkbox',field:'selected'},columns:[{key:'group',label:'Group',minWidth:240,flex:true},{key:'count',label:'Records',format:'number',width:96,align:'right'}]},
        {id:'map',kind:'geoMapBlock',title:'Example state distribution',datasetRef:'states',geo:{shape:'us-states',key:'code',labelKey:'name',metric:{key:'count',label:'Records',format:'number'},aggregate:'sum'}},
        {id:'timeline',kind:'timelineBlock',title:'Evidence timeline',events:[{id:'first',date:'2026-01-01',title:'First observation',body:'The recorded evidence remains available.'},{id:'second',date:'2026-01-07',title:'Latest observation',body:'Review dates and scope before comparing.'}]},
        {id:'steps',kind:'stepperBlock',title:'Example review sequence',steps:[{id:'inspect',title:'Inspect evidence',body:'Read the recorded observations.'},{id:'compare',title:'Compare scope',body:'Check that the same window is used.'}]},
        {id:'board',kind:'kanbanBlock',title:'Example review stages',columns:[{id:'queued',title:'Queued',cards:[{id:'one',title:'Read the source',body:'Keep the evidence visible.',badge:'Review'}]},{id:'active',title:'Active',cards:[{id:'two',title:'Check the scope',body:'Record the limits.',badge:'Inspect'}]},{id:'ready',title:'Ready',cards:[{id:'three',title:'Record the conclusion',body:'Use the approved process.',badge:'Handoff'}]}]},
    ],
};
export default function ReportDocumentSpecimen() {
    const compiled = useMemo(()=>compileInlineReport({reportId:'analytical_example',grammar:'report-document-v1',source:reportDocumentExample,dataSources:{examples:{rows:[{group:'First example',count:12345,change:-.12,groups:24,active:7,amount:123456789.12,pending:0,forecast:null,selected:false},{group:'Second example',count:86,change:.05,selected:false}]},states:{rows:[{code:'CA',name:'California',count:80},{code:'NY',name:'New York',count:20}]}}}),[]);
    const [viewer,setViewer] = useState(reportDocumentExample.viewer);
    const [filters,setFilters] = useState({});
    const [selections,setSelections] = useState({});
    const report = applyInlineReportFilterValues(applyInlineReportTableSelections(compiled,selections),filters);
    return <section aria-label="Analytical document specimen">
        <Typography as="h2" typeRole="section">Analytical document</Typography>
        <Typography as="label" typeRole="label">Chart data switching
            <SelectControl data-forge-type="body" value={viewer?.allowChartTableSwitch === undefined ? '' : String(viewer.allowChartTableSwitch)}
                onChange={event=>setViewer(current=>updateReportChartTableSwitch(current,event.target.value))}>
                <option value="">Default</option><option value="true">Allow</option><option value="false">Hide</option>
            </SelectControl>
        </Typography>
        <div className="forge-container" data-forge-appearance="document">
            <ReportRuntime {...report} reportSpec={{...report.reportSpec,viewer}} title={reportDocumentExample.title} subtitle={reportDocumentExample.subtitle} presentationMode="report"
                reportActions={<Button variant="secondary" icon="lucide:file-down">Export example report</Button>}
                runtimeHandlers={{onTableReviewChange:({blockId,selection})=>setSelections(current=>({...current,[blockId]:selection})),setScopeParamDate:(param,edge,value)=>setFilters(current=>({...current,[param.id]:{...(current[param.id]||param.value),[edge]:value}}))}}/>
        </div>
    </section>;
}
