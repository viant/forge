import assert from 'node:assert/strict';
import {test} from 'node:test';
import {buildReportSpecHash} from './reportFillModel.js';
import {buildReportPrintFromReportFill} from './reportPrintModel.js';
import {validateReportPrint} from './schema/reportSchemas.js';

// Independently invented library metadata; no application capture or dependency.
const note = id => ({id, kind: 'infoPanelBlock', title: `${id} shelf`, content: {body: 'A short inventory observation for the shared reading room with additional context about the next review.'}});
function fixture({children = ['north', 'south', 'west'].map(note), layout = 'responsiveGrid', runtime, description, height = 500, title = 'Shelf observations'} = {}) {
  const blocks = [
    {id: 'intro', kind: 'markdownBlock', title: 'Reading room', content: {markdown: 'Inventory review.'}},
    {id: 'space', kind: 'compositeBlock', runtime: {spacerHeight: height, chrome: 'none'}, content: {layout: 'stack', childBlockIds: []}},
    {id: 'group', kind: 'compositeBlock', title, content: {layout, childBlockIds: children.filter(b => !b.nested).map(b => b.id), ...(runtime ? {runtime} : {}), ...(description ? {description} : {})}},
    ...children,
  ];
  const source = {kind: 'reportBuilder', containerId: 'library', stateKey: 'library', dataSourceRef: 'primary'};
  const reportSpec = {version: 1, kind: 'reportSpec', title: 'Library inventory', source, blocks, layoutIntent: {blockOrder: blocks.map(b => b.id)}};
  const reportFill = {version: 1, kind: 'reportFill', specVersion: 1, specHash: buildReportSpecHash(reportSpec), source, blocks, datasets: []};
  return {reportSpec, reportFill};
}
function checked(input) {
  const original = JSON.stringify(input);
  const result = buildReportPrintFromReportFill(input);
  assert.deepEqual(validateReportPrint(result), {valid: true, errors: []});
  assert.equal(JSON.stringify(input), original, 'canonical inputs remain unchanged');
  assert.deepEqual(buildReportPrintFromReportFill(input), result, 'stable pagination and IDs');
  const ids = result.pages.flatMap(p => p.elements.map(e => e.id));
  assert.equal(new Set(ids).size, ids.length, 'probes emit no duplicate IDs');
  assert.equal(new Set(result.bookmarks.map(b => b.id)).size, result.bookmarks.length);
  for (const page of result.pages) {
    assert.ok(page.elements.length, 'no empty intermediate pages');
    for (const element of page.elements) {
      assert.ok(element.box.x >= 36 && element.box.x + element.box.width <= 576.01, element.id);
      assert.ok(element.box.y >= 84 && element.box.y + element.box.height <= 724.01, element.id);
    }
  }
  return result;
}
const pageOf = (print, prefix) => print.pages.find(p => p.elements.some(e => e.id.startsWith(prefix)));
for (const layout of ['stack', 'responsiveGrid']) {
  test(`${layout} keeps its heading and description with the first child`, () => {
    const input = fixture({layout, description: 'Shelf review context.'});
    const print = checked(input);
    const page = pageOf(print, 'group__title');
    assert.equal(page.number, 2);
    assert.equal(page, pageOf(print, 'north__title'));
    assert.equal(page, pageOf(print, 'group__description'));
    const text = print.pages.flatMap(p => p.elements).map(e => e.text || '').join('').replace(/\s/g, '');
    for (const child of input.reportFill.blocks.filter(b => b.kind === 'infoPanelBlock')) assert.ok(text.includes(child.content.body.replace(/\s/g, '')));
    assert.equal(print.bookmarks.find(b => b.id === 'bookmark.group').pageNumber, 2);
  });
}
test('a group that fits stays beside preceding content and unweighted pairs retain three print tracks', () => {
  const print = checked(fixture({height: 0, children: [note('north'), note('south')]}));
  assert.equal(print.pages.length, 1);
  const north = print.pages[0].elements.find(e => e.id === 'north__title_0');
  const south = print.pages[0].elements.find(e => e.id === 'south__title_0');
  assert.equal(north.box.y, south.box.y);
  assert.ok(north.box.width < 180, 'documented fixed thirds leave the third track empty');
  assert.ok(south.box.x + south.box.width < 450);
});
test('weighted tracks and nested composites keep their headings with content', () => {
  const nested = {id: 'inner', kind: 'compositeBlock', title: 'Inner shelves', content: {layout: 'stack', childBlockIds: ['north']}};
  const print = checked(fixture({children: [nested, {...note('north'), nested: true}, note('south')], runtime: {childWeights: {inner: 1, south: 1}, minColumnWidth: 100}}));
  assert.equal(pageOf(print, 'group__title'), pageOf(print, 'north__title'));
  assert.equal(pageOf(print, 'inner__title'), pageOf(print, 'north__title'));
});
test('oversized first children and long group context paginate with complete content', () => {
  for (const description of [undefined, 'Shelf context. '.repeat(150)]) {
    const child = {...note('north'), content: {body: Array.from({length: 70}, (_, i) => `Observation ${i + 1} records the reading room inventory.`).join('\n\n')}};
    const print = checked(fixture({children: [child], layout: 'stack', description}));
    assert.ok(print.pages.length > 2 && print.pages.length < 20, 'bounded forward pagination');
    const text = print.pages.flatMap(p => p.elements).map(e => e.text || '').join(' ');
    for (let i = 1; i <= 70; i++) assert.ok(text.includes(`Observation ${i} records`));
  }
});
test('first table and chart children stay with the group heading', () => {
  const table = {id: 'inventory', kind: 'tableBlock', title: 'Shelf counts', content: {columns: [{key: 'shelf', label: 'Shelf'}, {key: 'count', label: 'Count', kind: 'measure'}], resolvedRows: [{rowIndex: 0, cells: [{key: 'shelf', value: 'North'}, {key: 'count', value: 42}]}]}};
  const chart = {id: 'inventory', kind: 'chartBlock', title: 'Shelf counts', content: {chartModel: {type: 'horizontal_bar', series: {values: [{value: 'count', label: 'Count', type: 'horizontal_bar'}]}}, resolvedChart: {kind: 'directSeries', type: 'horizontal_bar', xAxisKey: 'shelf', seriesKeys: ['count'], rows: [{shelf: 'North', count: 42}, {shelf: 'South', count: 28}]}}};
  for (const child of [table, chart]) {
    const print = checked(fixture({children: [child], layout: 'stack', height: 550}));
    assert.equal(pageOf(print, 'group__title'), pageOf(print, 'inventory__title'));
    const text = print.pages.flatMap(p => p.elements).map(e => e.text || e.svg || '').join(' ');
    assert.ok(text.includes('North'));
    assert.ok(text.includes('42'));
  }
});

test('child IDs that include the group prefix remain content, and empty or bare groups make progress', () => {
  const print = checked(fixture({children: [note('group__north')], layout: 'stack', height: 550}));
  assert.equal(pageOf(print, 'group__title'), pageOf(print, 'group__north__title'));
  for (const options of [{children: []}, {runtime: {chrome: 'none'}}]) {
    const output = checked(fixture(options));
    assert.ok(output.pages.length <= 3);
  }
});

test('all-fitting nested groups consume native output once at every depth', () => {
  for (const depth of [0, 1, 2, 4, 6, 8, 12]) {
    let bodyReads = 0;
    const leaf = {...note('leaf'), content: {get body() { bodyReads += 1; return 'Inventory review.'; }}};
    const groups = Array.from({length: depth}, (_, index) => ({id: `level${index}`, kind: 'compositeBlock', title: `Shelf group ${index}`, content: {layout: 'stack', childBlockIds: [index + 1 === depth ? 'leaf' : `level${index + 1}`]}}));
    const input = fixture({height: 0, children: [leaf]});
    input.reportSpec.blocks.splice(2, 1, ...groups);
    input.reportSpec.layoutIntent.blockOrder = input.reportSpec.blocks.map(block => block.id);
    input.reportFill.specHash = buildReportSpecHash(input.reportSpec);
    bodyReads = 0;
    const print = buildReportPrintFromReportFill(input);
    assert.equal(print.pages.length, 1);
    // Two schema-boundary reads and one native info-panel render, regardless
    // of nesting. This detects repeated subtree rendering without a clock.
    assert.equal(bodyReads, 3, `depth ${depth} renders its leaf once`);
    assert.equal(print.pages[0].elements.filter(e => e.id === 'leaf__info_0').length, 1);
  }
});

test('consuming a composite preserves native grid siblings and pages beyond the first', () => {
  const input = fixture({height: 0, children: [note('north')]});
  const peer = {...note('peer'), content: {body: 'Companion shelf evidence.'}};
  input.reportSpec.blocks.push(peer);
  input.reportSpec.layoutIntent.blockOrder.push(peer.id);
  input.reportSpec.layoutIntent.items = [{blockId: 'group', span: 6}, {blockId: 'peer', span: 6}];
  input.reportSpec.blocks[0].content.markdown = Array.from({length: 60}, (_, index) => `Catalog entry ${index + 1}.`).join('\n\n');
  input.reportFill.specHash = buildReportSpecHash(input.reportSpec);
  const print = checked(input);
  const groupPage = pageOf(print, 'group__title');
  assert.ok(groupPage.number > 1);
  assert.equal(groupPage, pageOf(print, 'north__title'));
  assert.equal(groupPage, pageOf(print, 'peer__title'), 'scoped siblings retain the shared native page object');
  assert.equal(groupPage.elements.filter(e => e.text === 'Companion shelf evidence.').length, 1);
  for (const bookmark of print.bookmarks) {
    const page = print.pages.find(p => p.number === bookmark.pageNumber);
    assert.ok(page.elements.some(e => e.id === bookmark.elementId), bookmark.id);
  }
});

test('discarding an orphan probe preserves exactly one native diagnostic and bookmark', () => {
  const child = {id: 'unavailable', kind: 'chartBlock', title: 'Shelf counts', content: {chartModel: {type: 'horizontal_bar'}, resolvedChart: {kind: 'unavailable'}}};
  const print = checked(fixture({children: [child], layout: 'stack', height: 550}));
  assert.equal(pageOf(print, 'group__title'), pageOf(print, 'unavailable__title'));
  assert.equal(print.diagnostics.length, 1);
  const diagnostic = print.diagnostics[0];
  assert.equal(diagnostic.pageNumber, 2);
  assert.ok(print.pages[1].elements.some(e => e.id === diagnostic.elementId));
  assert.equal(print.bookmarks.filter(b => b.id === 'bookmark.group').length, 1);
  assert.equal(print.bookmarks.filter(b => b.id === 'bookmark.unavailable').length, 1);
});

test('nested groups render a large native table once, independent of depth', () => {
  let referenceReads;
  for (const depth of [0, 1, 4, 8]) {
    let drawingReads = 0;
    const rows = Array.from({length: 200}, (_, index) => ({rowIndex: index, cells: [{key: 'count', value: index + 1, visualState: {get kind() {drawingReads += 1; return 'dataBar';}, value: index + 1, percent: (index + 1) / 200, palette: []}}]}));
    const leaf = {id: 'leaf', kind: 'tableBlock', title: 'Shelf counts', content: {columns: [{key: 'count', label: 'Count', kind: 'measure'}], resolvedRows: rows}};
    const groups = Array.from({length: depth}, (_, index) => ({id: `level${index}`, kind: 'compositeBlock', title: `Shelf group ${index}`, content: {layout: 'stack', childBlockIds: [index + 1 === depth ? 'leaf' : `level${index + 1}`]}}));
    const input = fixture({height: 0, children: [leaf]});
    input.reportSpec.blocks.splice(2, 1, ...groups);
    input.reportSpec.layoutIntent.blockOrder = input.reportSpec.blocks.map(block => block.id);
    input.reportFill.specHash = buildReportSpecHash(input.reportSpec);
    drawingReads = 0;
    const print = buildReportPrintFromReportFill(input);
    if (referenceReads == null) referenceReads = drawingReads;
    assert.equal(drawingReads, referenceReads, `depth ${depth} does no extra native table drawing work`);
    const elements = print.pages.flatMap(page => page.elements);
    assert.equal(elements.filter(e => /__count__bar$/.test(e.id)).length, 200);
    for (let index = 1; index <= 200; index++) assert.equal(elements.filter(e => e.kind === 'tableCellText' && e.text === String(index)).length, 1);
  }
});

test('oversized nested prefixes keep a feasible terminal suffix with bounded native work', () => {
  for (const depth of [24, 26, 28, 32, 40, 80]) {
    let bodyReads = 0;
    const leaf = {...note('leaf'), content: {get body() {bodyReads += 1; return 'Inventory review.';}}};
    const groups = Array.from({length: depth}, (_, index) => ({id: `level${index}`, kind: 'compositeBlock', title: `Shelf group ${index}`, content: {layout: 'stack', childBlockIds: [index + 1 === depth ? 'leaf' : `level${index + 1}`]}}));
    const input = fixture({height: 0, children: [leaf]});
    input.reportSpec.blocks.splice(2, 1, ...groups);
    input.reportSpec.layoutIntent.blockOrder = input.reportSpec.blocks.map(block => block.id);
    input.reportFill.specHash = buildReportSpecHash(input.reportSpec);
    const original = JSON.stringify(input);
    bodyReads = 0;
    const print = buildReportPrintFromReportFill(input);
    assert.ok(bodyReads <= 5, `depth ${depth} uses at most three native leaf renders`);
    assert.equal(JSON.stringify(input), original);
    assert.equal(pageOf(print, `level${depth - 1}__title`), pageOf(print, 'leaf__title'), 'feasible terminal group and leaf stay together');
    assert.ok(print.pages.length <= 4, 'impossible whole-prefix moves do not add pages');
    const elements = print.pages.flatMap(page => page.elements);
    assert.equal(new Set(elements.map(e => e.id)).size, elements.length);
    assert.equal(print.bookmarks.length, depth + 2);
    for (const group of groups) assert.equal(elements.filter(e => e.id === `${group.id}__title_0`).length, 1);
    assert.equal(elements.filter(e => e.id === 'leaf__info_0').length, 1);
    for (const page of print.pages) {
      assert.ok(page.elements.length);
      for (const element of page.elements) assert.ok(element.box.y + element.box.height <= 724.01, element.id);
    }
  }
});

test('independent nested grid columns retain their own feasible first-content suffixes', () => {
  const depth = 28;
  const branches = ['left', 'right'].flatMap(side => [
    ...Array.from({length: depth}, (_, index) => ({id: `${side}${index}`, kind: 'compositeBlock', title: `${side} group ${index}`, nested: index > 0, content: {layout: 'stack', childBlockIds: [index + 1 === depth ? `${side}Leaf` : `${side}${index + 1}`]}})),
    {...note(`${side}Leaf`), nested: true},
  ]);
  const input = fixture({height: 500, children: branches, runtime: {childWeights: {left0: 1, right0: 1}, minColumnWidth: 100}});
  const print = checked(input);
  assert.equal(pageOf(print, 'group__title'), pageOf(print, 'left0__title'));
  for (const side of ['left', 'right']) assert.equal(pageOf(print, `${side}${depth - 1}__title`), pageOf(print, `${side}Leaf__title`));
  assert.equal(print.pages.flatMap(p => p.elements).filter(e => e.id.endsWith('Leaf__info_0')).length, 2);
});

test('empty and spacer-only descendants finish prefix ownership before later groups', () => {
  for (const children of [
    [{id: 'empty', kind: 'compositeBlock', title: 'Empty shelf group', content: {layout: 'stack', childBlockIds: []}}],
    [{id: 'blank', kind: 'compositeBlock', runtime: {chrome: 'none', spacerHeight: 0}, content: {layout: 'stack', childBlockIds: []}}, note('north')],
    [{id: 'blank', kind: 'compositeBlock', runtime: {chrome: 'none', spacerHeight: 0}, content: {layout: 'stack', childBlockIds: []}}],
  ]) {
    const input = fixture({height: 550, children, layout: 'stack'});
    const after = {...note('after'), content: {body: 'Later independent shelf evidence.'}};
    input.reportSpec.blocks.push(after);
    input.reportSpec.layoutIntent.blockOrder.push(after.id);
    input.reportFill.specHash = buildReportSpecHash(input.reportSpec);
    const print = checked(input);
    const elements = print.pages.flatMap(page => page.elements);
    assert.equal(elements.filter(e => e.id === 'after__title_0').length, 1);
    assert.equal(elements.filter(e => e.text === 'Later independent shelf evidence.').length, 1);
    assert.ok(print.pages.length <= 2);
    if (children.some(child => child.id === 'north')) assert.equal(pageOf(print, 'group__title'), pageOf(print, 'north__title'));
    if (children.some(child => child.id === 'empty')) assert.equal(pageOf(print, 'group__title'), pageOf(print, 'empty__empty'));
  }
});
