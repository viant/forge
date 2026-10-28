import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ReportRuntime from '../components/dashboard/ReportRuntime.jsx';
import {buildReportFillFromReportSpec} from './reportFillModel.js';
import {buildReportPrintFromReportFill,buildReportPrintTextElement,buildReportPrintMarkdownLines} from './reportPrintModel.js';
import {buildReportDocumentMarkdownBlock} from './reportDocumentModel.js';
import {validateReportSpec,validateReportFill,validateReportPrint} from './schema/reportSchemas.js';
import {boundReportScopeSpec} from '../components/dashboard/reportRuntimeScopeControls.js';
import {resolveBoundReportRuntime} from '../components/dashboard/reportRuntimeBindings.js';
const wire=JSON.parse(fs.readFileSync(new URL('../components/dashboard/testdata/synthetic-native-report-window.json',import.meta.url),'utf8'));
const spec=structuredClone(wire.view.content.containers.find(c=>c.kind==='dashboard.reportRuntime').dashboard.reportRuntime.reportSpec);
spec.datasets[0].request.filters={mode:1};
const inputs={choice:{path:'mode',labels:[{value:1,label:'First *choice*'},{value:2,label:'Second choice'},{value:'2',label:'String choice'}]}};
spec.blocks=[{id:'text',kind:'markdownBlock',title:'Range',datasetRef:'primary',markdown:'**Selected:** ${input.choice}\n${format(row.start,text)} – ${format(row.end,text)}',templateRequestInputs:inputs}];
spec.layoutIntent.blockOrder=['text'];
assert.equal(validateReportSpec(spec).valid,true,JSON.stringify(validateReportSpec(spec)));
assert.deepEqual(buildReportDocumentMarkdownBlock(spec.blocks[0]).templateRequestInputs,inputs);
const fill=buildReportFillFromReportSpec(spec,{primary:{rows:[{start:'2026-01-01',end:'2026-01-31'}]}});
assert.equal(validateReportFill(fill).valid,true,JSON.stringify(validateReportFill(fill)));
assert.equal(fill.blocks[0].content.markdown,'**Selected:** First \\*choice\\*\n2026\\-01\\-01 – 2026\\-01\\-31');
const html=renderToStaticMarkup(React.createElement(ReportRuntime,{reportSpec:spec,reportFill:fill,presentationMode:'report'}));
assert.ok(html.includes('First *choice*'));assert.ok(html.includes('2026-01-01'));
const print=buildReportPrintFromReportFill({reportSpec:spec,reportFill:fill});assert.ok(JSON.stringify(print).includes('First *choice*'));assert.ok(JSON.stringify(print).includes('2026-01-31'));
const missing=buildReportFillFromReportSpec(spec,{primary:{rows:[{start:null}]}});assert.ok(missing.blocks[0].content.markdown.includes('— – —'));
const absent=structuredClone(spec);delete absent.datasets[0].request.filters.mode;assert.throws(()=>buildReportFillFromReportSpec(absent,{}),/missing/);
const unknown=structuredClone(spec);unknown.datasets[0].request.filters.mode=9;assert.throws(()=>buildReportFillFromReportSpec(unknown,{}),/no declared label/);
const stringMode=structuredClone(spec);stringMode.datasets[0].request.filters.mode='2';assert.ok(buildReportFillFromReportSpec(stringMode,{}).blocks[0].content.markdown.includes('String choice'));
const unsafe=structuredClone(spec);unsafe.blocks[0].templateRequestInputs.choice.path='__proto__.x';assert.throws(()=>buildReportFillFromReportSpec(unsafe,{}),/safe filter path/);
const undeclared=structuredClone(spec);undeclared.blocks[0].markdown='${input.absent}';assert.throws(()=>buildReportFillFromReportSpec(undeclared,{}),/not declared/);
const controlSpec=structuredClone(spec);controlSpec.scope={dataSourceRef:'reader',params:[{id:'mode',kind:'select',label:'Mode',required:true,value:1,options:inputs.choice.labels,filterBindings:[{datasetRef:'primary',path:'mode'}]}]};
let request={filters:{mode:2},offset:0,limit:25};const state={loaded:true};
const source={signals:{control:{value:state},collection:{value:[{start:'OLD ROW',end:'OLD END'}]}},handlers:{dataSource:{peekInput:()=>({parameters:{query:request}}),setInputParameters(){},setPage(){},fetchCollection(){},setLoading(){},setError(){}}}};
const config={reportSpec:controlSpec,datasetBindings:{primary:{dataSourceRef:'reader',queryPath:'query'}}};const context={Context:()=>source};
const current=boundReportScopeSpec(config,context);assert.equal(current.datasets[0].request.filters.mode,2);current.datasets[0].request.filters.mode=99;assert.equal(request.filters.mode,2);assert.equal(controlSpec.datasets[0].request.filters.mode,1);
state.loading=true;const pending=resolveBoundReportRuntime(config,context);assert.ok(pending.pendingReportFill.blocks[0].content.markdown.includes('Second choice'));assert.ok(!JSON.stringify(pending.pendingReportFill).includes('OLD ROW'));
state.loading=false;state.error='denied';assert.ok(!JSON.stringify(resolveBoundReportRuntime(config,context).pendingReportFill).includes('OLD END'));

for(const label of [String.raw`literal \*stars* and \backslash`, '\uE0000\uE001 Unicode 日本語 café', '${input.absent} remains literal', '[click](https://example.invalid) <img src=x onerror=alert(1)>']){
 const literalSpec=structuredClone(spec);literalSpec.blocks[0].templateRequestInputs.choice.labels[0].label=label;
 const literalFill=buildReportFillFromReportSpec(literalSpec,{primary:{rows:[]}});
 const literalHtml=renderToStaticMarkup(React.createElement(ReportRuntime,{reportSpec:literalSpec,reportFill:literalFill,presentationMode:'report'}));
 assert.ok(!literalHtml.includes('<img'));assert.ok(!literalHtml.includes('<a '));assert.ok(!literalHtml.includes('<em>'));assert.ok(!literalHtml.includes('<script'));
 const literalPrint=JSON.stringify(buildReportPrintFromReportFill({reportSpec:literalSpec,reportFill:literalFill}));
 assert.ok(literalPrint.includes(JSON.stringify(label).slice(1,-1)),label);
 assert.ok(literalHtml.includes(label.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')),label);
}



for(const fence of ['`','``']){
 const codeSpec=structuredClone(spec);codeSpec.blocks[0].markdown=fence+String.raw`keep\*literal`+fence;
 const codeFill=buildReportFillFromReportSpec(codeSpec,{});const codeHtml=renderToStaticMarkup(React.createElement(ReportRuntime,{reportSpec:codeSpec,reportFill:codeFill,presentationMode:'report'}));
 assert.ok(codeHtml.includes(String.raw`keep\*literal`));
 const codePrint=buildReportPrintFromReportFill({reportSpec:codeSpec,reportFill:codeFill});
 assert.ok(codePrint.pages.flatMap(page=>page.elements).some(element=>String(element.text).includes(String.raw`keep\*literal`)));
}

// This is the emitted contract for both formatted worksheet labels and zones.
const styledSpec=structuredClone(spec);styledSpec.blocks[0].markdown='**A**\n\n**B**\n***Both***\n\n***Again***\n\\> literal\n1\\. literal';
const styledFill=buildReportFillFromReportSpec(styledSpec,{});
assert.equal(styledFill.blocks[0].content.markdown,styledSpec.blocks[0].markdown);
const styledHtml=renderToStaticMarkup(React.createElement(ReportRuntime,{reportSpec:styledSpec,reportFill:styledFill,presentationMode:'report'}));
assert.equal((styledHtml.match(/data-report-markdown-blank-line/g)||[]).length,2);
assert.ok(styledHtml.includes('<strong>A</strong>'));assert.ok(styledHtml.includes('<strong>B</strong>'));
assert.ok(styledHtml.includes('<strong><em>Both</em></strong>'));assert.ok(styledHtml.includes('<strong><em>Again</em></strong>'));
assert.ok(styledHtml.includes('&gt; literal'));assert.ok(styledHtml.includes('1. literal'));assert.ok(!styledHtml.includes('****'));
const styledPrint=buildReportPrintFromReportFill({reportSpec:styledSpec,reportFill:styledFill});
const styledText=styledPrint.pages.flatMap(page=>page.elements).map(element=>element.text||'').join('\n');
for(const expected of ['A','B','Both','Again','> literal','1. literal'])assert.ok(styledText.includes(expected));
assert.ok(!styledText.includes('*'));
const textElements=styledPrint.pages.flatMap(page=>page.elements).filter(element=>['A','B','Both','Again'].includes(element.text));
const findText=text=>textElements.find(element=>element.text===text);
assert.ok(findText('B').box.y-findText('A').box.y > findText('Both').box.y-findText('B').box.y, 'blank source line retains print spacing');


const boundarySpec=structuredClone(spec);boundarySpec.blocks[0].markdown='**Period:**  *Version one*\n\n***Both***\n\n***Again***';
const boundaryFill=buildReportFillFromReportSpec(boundarySpec,{});
const boundaryHtml=renderToStaticMarkup(React.createElement(ReportRuntime,{reportSpec:boundarySpec,reportFill:boundaryFill,presentationMode:'report'}));
assert.ok(boundaryHtml.includes('<strong>Period:</strong>  <em>Version one</em>'));
assert.ok(boundaryHtml.includes('<strong><em>Both</em></strong>'));
assert.equal((boundaryHtml.match(/data-report-markdown-blank-line/g)||[]).length,2);
const boundaryText=buildReportPrintFromReportFill({reportSpec:boundarySpec,reportFill:boundaryFill}).pages.flatMap(page=>page.elements).map(element=>element.text||'').join('\n');
assert.ok(boundaryText.includes('Period: Version one'));assert.ok(!boundaryText.includes('*'));

assert.equal(findText('A').fontWeight,'bold');assert.equal(findText('Both').fontWeight,'bold italic');
const mixedLine=buildReportPrintFromReportFill({reportSpec:boundarySpec,reportFill:boundaryFill}).pages.flatMap(page=>page.elements).find(element=>element.text==='Period: Version one');
assert.deepEqual(mixedLine.textRuns,[{text:'Period:',fontWeight:'bold'},{text:' ',fontWeight:'normal'},{text:'Version one',fontWeight:'italic'}]);
assert.equal(validateReportPrint(styledPrint).valid,true,JSON.stringify(validateReportPrint(styledPrint)));
const mixedPrint=buildReportPrintFromReportFill({reportSpec:boundarySpec,reportFill:boundaryFill});assert.equal(validateReportPrint(mixedPrint).valid,true);
const badPrint=structuredClone(mixedPrint);badPrint.pages[0].elements.find(element=>element.textRuns).textRuns[0].text='wrong';assert.equal(validateReportPrint(badPrint).valid,false);
const baseText={id:'check',kind:'text',box:{x:0,y:0,width:100,height:20},text:'ok'};
for(const textRuns of [null,[],[null],[{text:'ok',fontWeight:null}],[{text:'other'}]])assert.throws(()=>buildReportPrintTextElement({...baseText,textRuns}));
assert.deepEqual(buildReportPrintMarkdownLines('[Doc](https://example.invalid)',500).map(line=>line.text),['Doc']);
assert.deepEqual(buildReportPrintMarkdownLines(String.raw`\[Doc\]\(https://example.invalid\)`,500).map(line=>line.text),['[Doc](https://example.invalid)']);
const wrapped=buildReportPrintMarkdownLines('**Ωé日本語 words** *and café*',50);
assert.ok(wrapped.length>1);assert.equal(wrapped.map(line=>line.text).join('').replaceAll(' ',''),'Ωé日本語wordsandcafé');
for(const line of wrapped)if(line.textRuns)assert.equal(line.textRuns.map(run=>run.text).join(''),line.text);
console.log('Formatted request text, exact typed labels, safe markdown, immutable live request, empty/denied and print passed.');

const literalFenceSpec=structuredClone(spec);
literalFenceSpec.blocks[0].markdown='\\~\\~\\~\nLiteral source text\n\\~\\~\\~';
const literalFenceFill=buildReportFillFromReportSpec(literalFenceSpec,{});
const literalFenceHTML=renderToStaticMarkup(React.createElement(ReportRuntime,{reportSpec:literalFenceSpec,reportFill:literalFenceFill,presentationMode:'report'}));
assert.ok(literalFenceHTML.includes('~~~'));assert.ok(!literalFenceHTML.includes('<pre'));
const literalFencePrint=buildReportPrintFromReportFill({reportSpec:literalFenceSpec,reportFill:literalFenceFill});
assert.equal(literalFencePrint.pages.flatMap(page=>page.elements).filter(element=>element.text==='~~~').length,2);

assert.throws(()=>buildReportPrintTextElement({...baseText,text:'A\r\nB',textRuns:[{text:'A\r'},{text:'\nB'}]}));

for(const [marker,weight,htmlTag] of [['*','italic','em'],['**','bold','strong'],['***','bold italic',null]]){
 const whitespaceSpec=structuredClone(spec);whitespaceSpec.blocks[0].markdown=` ${marker}subtitle${marker} \n\n\t${marker}next${marker}\t`;
 const whitespaceFill=buildReportFillFromReportSpec(whitespaceSpec,{});
 const whitespaceHtml=renderToStaticMarkup(React.createElement(ReportRuntime,{reportSpec:whitespaceSpec,reportFill:whitespaceFill,presentationMode:'report'}));
 assert.ok(whitespaceHtml.includes(htmlTag?`<${htmlTag}>subtitle</${htmlTag}>`:'<strong><em>subtitle</em></strong>'));
 assert.ok(!whitespaceHtml.includes('•'));assert.ok(!whitespaceHtml.includes('subtitle*'));
 const elements=buildReportPrintFromReportFill({reportSpec:whitespaceSpec,reportFill:whitespaceFill}).pages.flatMap(page=>page.elements);
 for(const text of ['subtitle','next'])assert.equal(elements.find(element=>element.text===text)?.fontWeight,weight);
}
