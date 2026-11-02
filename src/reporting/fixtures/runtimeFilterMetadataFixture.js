import {buildReportBuilderReportDocument} from "../reportDocumentModel.js";

// Independently authored neutral fixtures. Logical datasets share a producer
// and a field name; their filter bindings must remain independent.
export function runtimeFilterMetadataFixture() {
 const runtimeFilter={includeParamPath:'filters.values.regions'};
 const source={id:'regional',dataSourceRef:'rows',columnOptions:[{key:'region',label:'Region',kind:'dimension',runtimeFilter},{key:'category',label:'Category',kind:'dimension'},{key:'count',label:'Count',kind:'measure'}],request:{dimensions:{region:true,category:true},measures:{count:true}},scope:{mode:'inherit'}};
 const config={dataSourceRef:'rows',dimensions:[{id:'region',key:'region',label:'Global region',paramPath:'dimensions.region',runtimeFilter:{includeParamPath:'filters.values.globalRegions'}}],measures:[{id:'count',key:'count',label:'Count',paramPath:'measures.count',default:true}],dataSources:[source],result:{defaultMode:'table',pageSize:10}};
 const document=buildReportBuilderReportDocument({container:{id:'regionalBuilder',dataSourceRef:'rows'},config,state:{selectedDimensions:['region'],selectedMeasures:['count'],viewMode:'table'}});
 document.blocks=[document.blocks.find(block=>block.kind==='reportBuilderBlock'),{id:'regionalChart',kind:'chartBlock',datasetRef:'regional',chartSpec:{type:'bar',xField:'region',yFields:['count']}}];
 return {runtimeFilter,source,config,document};
}

