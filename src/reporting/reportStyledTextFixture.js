import windowFixture from '../components/dashboard/testdata/synthetic-native-report-window.json';

// Independently authored text-only fixture, shared by native screen and exports.
export function reportStyledTextFixture(){
 const reportSpec=JSON.parse(JSON.stringify(windowFixture.view.content.containers.find(container=>container.kind==='dashboard.reportRuntime').dashboard.reportRuntime.reportSpec));
 reportSpec.title='Source text formatting';reportSpec.viewer={appearance:'document'};
 reportSpec.datasets[0].request.filters={mode:2};
 reportSpec.blocks=[{id:'narrative',kind:'markdownBlock',title:'Approved readings',datasetRef:'primary',markdown:'**Period:**  *Version one*\n *Leading-space subtitle* \n\n***Selected view:*** ${input.mode}\n**Dates: **${format(row.start,text)} – ${format(row.end,text)}\n\n**First line**\n\n**Second line**\n***Bold and italic together***\n\n\\> Literal quotation marker\n1\\. Literal numbered prefix\n\\[Literal link\\]\\(https://example\\.invalid\\)\nEscaped HTML: \\<span\\>café\\</span\\>\n`Code keeps \\* literal`',templateRequestInputs:{mode:{path:'mode',labels:[{value:1,label:'Initial view'},{value:2,label:'Current view café'}]}}}];
 reportSpec.layoutIntent.blockOrder=['narrative'];
 return {reportSpec,payloads:{primary:{rows:[{start:'2026-01-01',end:'2026-01-31'}],hasMore:false}}};
}
