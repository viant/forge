import assert from 'node:assert/strict';
import {test} from 'node:test';
import {buildReportPrintFromReportFill, buildReportPrintMarkdownLines, DEFAULT_REPORT_PRINT_PAGE_GEOMETRY} from './reportPrintModel.js';
import {buildReportSpecHash} from './reportFillModel.js';

const paragraph = 'This final paragraph contains a slightly longer neutral explanation. '.repeat(3);
function print(markdown, pageGeometry, kind = "markdownBlock", precedingHeight = 0, links = []) {
  const blocks = [{id:'help', kind, title:'Help', content:kind==='infoPanelBlock'?{bodyFormat:'markdown',body:markdown}:{markdown}}];
  if(links.length) blocks[0].content.runtime={links};
  if(precedingHeight) blocks.unshift({id:'preceding',kind:'compositeBlock',runtime:{spacerHeight:precedingHeight},content:{layout:'stack',childBlockIds:[]}});
  const source = {kind:'reportBuilder', containerId:'specimen', stateKey:'specimen', dataSourceRef:'primary'};
  const reportSpec = {version:1, kind:'reportSpec', title:'Guide', source, scope:{params:[]}, blocks, layoutIntent:{blockOrder:blocks.map(block=>block.id)}};
  const reportFill = {version:1, kind:'reportFill', specVersion:1, specHash:buildReportSpecHash(reportSpec), source, blocks, datasets:[]};
  return buildReportPrintFromReportFill({reportSpec, reportFill, ...(pageGeometry ? {pageGeometry} : {})});
}
const body = result => result.pages.map(page => page.elements.filter(element => /^help__(?:line|info)/.test(element.id)));
for (const count of [24, 25]) {
  test(`paragraph avoids a single line at either side of a page break after ${count} short paragraphs`, () => {
    const markdown = Array.from({length:count}, (_, i) => `Paragraph ${i+1} explains the neutral specimen.`).join('\n\n')+'\n\n'+paragraph;
    const result = print(markdown);
    const expected = buildReportPrintMarkdownLines(markdown, 540).filter(line => line.text).map(line => line.text);
    assert.deepEqual(body(result).flat().map(element => element.text), expected, 'Every wrapped line remains in source order exactly once');
    const final = new Set(buildReportPrintMarkdownLines(paragraph, 540).map(line => line.text));
    const fragments = body(result).map(lines => lines.filter(line => final.has(line.text)).length).filter(Boolean);
    assert.deepEqual(fragments, [3], 'A three-line paragraph must fit together rather than split 2+1 or 1+2');
    assert.equal(result.pages.length, 2);
  });
}

test('oversized rich paragraphs split with at least two lines per fragment and preserve all text', () => {
  const markdown = '**Strong opening** '+Array.from({length:1500},(_,i)=>`word${i}`).join(' ');
  const result = print(markdown);
  const pages = body(result);
  assert.ok(pages.length > 2);
  assert.ok(pages.every(lines => lines.length >= 2));
  assert.deepEqual(pages.flat().map(element=>element.text), buildReportPrintMarkdownLines(markdown,540).map(line=>line.text));
  assert.equal(pages.flat()[0].textRuns[0].fontWeight,'bold');
  assert.equal(new Set(pages.flat().map(element=>element.id)).size,pages.flat().length);
  for(const page of result.pages) {
    assert.ok(page.elements.some(element=>element.id.startsWith('help__title')),'Every continuation retains its section heading');
    for(const element of page.elements) assert.ok(element.box.y+element.box.height<=724.01);
  }
});

test('blank lines, headings, lists and authored line breaks keep their content and order', () => {
  const markdown = ('## A heading\nFirst **rich** line\nSecond soft line\n\n- First item\n- Second item\n\n').repeat(18)+'Final text.';
  const result = print(markdown);
  assert.deepEqual(body(result).flat().map(element=>element.text),buildReportPrintMarkdownLines(markdown,540).filter(line=>line.text).map(line=>line.text));
  assert.ok(body(result).every(lines=>lines.length>0),'No empty body pages');
});

for(const kind of ['markdownBlock','infoPanelBlock']) test(`${kind}: a page that can fit only one body line yields the constraint and makes bounded progress`, () => {
  const result=print(paragraph,{...DEFAULT_REPORT_PRINT_PAGE_GEOMETRY,height:192},kind);
  const lines=body(result);
  assert.equal(lines.length,3);
  assert.ok(lines.every(page=>page.length===1),'No empty continuation pages');
  assert.deepEqual(lines.flat().map(line=>line.text),buildReportPrintMarkdownLines(paragraph,540).map(line=>line.text));
});

test('markdown info panels use paragraph pagination with complete body text', () => {
  const markdown='**Strong opening** '+Array.from({length:1500},(_,i)=>`word${i}`).join(' ');
  const result=print(markdown,undefined,'infoPanelBlock');
  const pages=body(result);
  assert.ok(pages.length>2);
  assert.ok(pages.every(lines=>lines.length>=2));
  assert.deepEqual(pages.flat().map(line=>line.text),buildReportPrintMarkdownLines(markdown,540).map(line=>line.text));
  for(const page of result.pages) assert.ok(page.elements.some(element=>element.id.startsWith('help__title')),'Info continuations retain the title');
});

test('a short markdown info panel near the page bottom moves its complete paragraph', () => {
  const result=print(paragraph,undefined,'infoPanelBlock',576);
  const fragments=body(result).map(lines=>lines.length).filter(Boolean);
  assert.deepEqual(fragments,[3]);
  assert.equal(result.pages.length,2);
  assert.equal(body(result)[0].length,0);
});

test('an empty info panel retains its title without inventing body text', () => {
  const result=print('',undefined,'infoPanelBlock');
  assert.equal(result.pages.length,1);
  assert.deepEqual(body(result).flat(),[]);
  assert.ok(result.pages[0].elements.some(element=>element.text==='Help'));
  assert.ok(result.pages[0].elements.every(element=>!element.text?.includes('No info panel content')));
});

test('blank paragraphs and wrapped external links retain contiguous emitted text IDs', () => {
  const links=[{label:'Long reference '+'words '.repeat(60),url:'https://example.com/a'},{label:'Second reference',url:'https://example.com/b'}];
  const result=print('First paragraph.\n\nSecond paragraph.',undefined,'markdownBlock',0,links);
  const elements=body(result).flat();
  assert.deepEqual(elements.map(element=>element.id),elements.map((_,index)=>`help__line_${index}`));
  assert.equal(new Set(elements.map(element=>element.id)).size,elements.length);
  assert.deepEqual(elements.slice(0,2).map(element=>element.text),['First paragraph.','Second paragraph.']);
  assert.equal(elements.slice(2).map(element=>element.text).join(' '),links.map(link=>`${link.label}: ${link.url}`.replace(/\s+/g,' ')).join(' '));
});
