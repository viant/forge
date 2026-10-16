// Private regression evidence: reads a supplied definition; never embeds it in public fixtures.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stringify } from 'yaml';
import { readDocument, detectIndent } from '../src/window-editor/windowDocument';
import { buildWindowTree, indexTree } from '../src/window-editor/treeInteraction';
import WindowYamlEditor from '../src/window-editor/WindowYamlEditor';
const input = process.argv[2];
assert.ok(input, 'Pass a private JSON definition path.');
const raw = await fs.readFile(input);
const definition = JSON.parse(raw);
const studioFormatter = process.argv[3] ? createRequire(import.meta.url)(process.argv[3]).formatDefinitionYAML : (value) => stringify(value, {indent:2,lineWidth:0,aliasDuplicateObjects:false});
const source = studioFormatter(definition);
assert.equal(detectIndent(source), 2);
const parsed = readDocument(source);
assert.deepEqual(parsed.errors, []);
assert.deepEqual(parsed.value, definition, 'complete datasource content and every authored attribute remain present');
const roots = buildWindowTree(parsed.value);
const count = indexTree(roots).size;
assert.ok(count > 0);
const html = renderToStaticMarkup(React.createElement(WindowYamlEditor, {defaultValue:source,readOnly:true}));
assert.match(html, /aria-label="Window structure"/);
assert.match(html, /aria-label="Document root"[^>]*aria-selected="true"/);
const receipt = {
  definitionSHA256:createHash('sha256').update(raw).digest('hex'),
  sourceSHA256:createHash('sha256').update(source).digest('hex'),
  sourceBytes:Buffer.byteLength(source),sourceLines:source.split('\n').length,
  indentedLines:[...source.matchAll(/^( +)\S/gm)].length,
  targets:definition.targets?.length,variants:Object.keys(definition.variants||{}).length,
  treeNodes:count,renderedBytes:Buffer.byteLength(html),
  checks:['exact Studio formatting','source parse','complete value equality','full tree/index construction','rendered default Tree with root selected'],
  formatter:process.argv[3]||'same Studio formatting options',
};
await fs.mkdir('output/window-editor/large-source',{recursive:true});
await fs.writeFile('output/window-editor/large-source/private-regression.json',JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt,null,2));
