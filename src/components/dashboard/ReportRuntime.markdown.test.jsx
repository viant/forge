import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ReportRuntime from './ReportRuntime.jsx';
function render(markdown,kind='markdownBlock') {
 const block={id:'body',kind,title:'Actual current TARGET',markdown,body:markdown};
 return renderToStaticMarkup(React.createElement(ReportRuntime,{reportSpec:{title:'Evidence',datasets:[],blocks:[block]},reportFill:{diagnostics:[],datasets:[],blocks:[block]}}));
}
const expression='location:["US/AZ"] AND ad.pmp.deal.id:["137824","136934"]';
const md='```text\n'+expression+'\n```\n\nThe **OR list** stays exact.';
for(const kind of ['markdownBlock','infoPanelBlock','calloutBlock']) {
 const html=render(md,kind);
 assert.match(html,/<pre[^>]*><code[^>]*>/);
 assert.ok(html.includes(expression.replaceAll('"','&quot;')));
 assert.ok(!html.includes('```text'));
 assert.ok(html.includes('<strong>OR list</strong>'));
}
const code='  <script>alert("x")</script>\n\n**literal** `literal`\n~~~ inside';
const html=render('~~~text\r\n'+code.replaceAll('\n','\r\n')+'\r\n~~~~\r\nAfter *prose*.');
assert.ok(html.includes('&lt;script&gt;'));
assert.ok(!html.includes('<script>'));
assert.ok(html.includes('**literal** `literal`'));
assert.ok(html.includes('<em>prose</em>'));
assert.ok(html.includes('white-space:pre-wrap'));
assert.match(render('````text\n```literal\n````'), /<code[^>]*>```literal/);
assert.match(render('```text\nunfinished'), /<code[^>]*>unfinished/);
assert.ok(!render('Text with `inline` and **strong**.').includes('<pre'));
console.log('PASS report Markdown fenced code, exact selectors, escaping, CRLF, partial and ordinary prose');
