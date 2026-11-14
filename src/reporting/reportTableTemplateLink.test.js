import assert from 'node:assert/strict';
import test from 'node:test';
import {getTemplateSelectors, resolveTemplateText} from '../utils/linkTarget.js';
import {normalizeReportTableLink, resolveReportTableLink} from './reportTableLink.js';
import {normalizeReportTableBlockColumn} from './tableVisualSpec.js';
import {buildReportBuilderReportDocument, lowerReportDocumentToReportSpec} from './reportDocumentModel.js';
import {validateReportSchema} from './schema/reportSchemaValidator.js';
import {reportSpecSchema} from './schema/reportSpecSchema.js';
import {reportFillSchema} from './schema/reportFillSchema.js';

// Independently invented records exercise the existing shared template grammar.
const destination = 'https://example.invalid/groups/{{ group.id }}/records/{{record.id}}';
const template = {kind:'external', hrefTemplate:destination};
const column = {key:'name', link:template};
const row = {name:'North record', group:{id:'g-7'}, record:{id:'9007199254740993'}};

test('report column templates use the shared selector grammar', () => {
  assert.deepEqual(getTemplateSelectors(destination + '/{{record.id}}'), ['group.id','record.id']);
  assert.equal(resolveTemplateText(destination, row), 'https://example.invalid/groups/g-7/records/9007199254740993');
  assert.deepEqual(normalizeReportTableLink(template), template);
  assert.deepEqual(normalizeReportTableBlockColumn(column).link, template);
});

test('nested templates preserve identifiers and display text without mutating rows', () => {
  const before = structuredClone(row);
  assert.deepEqual(resolveReportTableLink({row, column, value:row.name}), {
    kind:'external', href:'https://example.invalid/groups/g-7/records/9007199254740993',
    text:'North record', title:'North record', target:'_blank', rel:'noopener noreferrer',
  });
  assert.deepEqual(row, before);
});

test('zero is a present template identifier', () => {
  assert.equal(resolveReportTableLink({row:{id:0}, column:{link:{kind:'external',hrefTemplate:'http://example.invalid/records/{{id}}'}}, value:'Zero record'})?.href,
    'http://example.invalid/records/0');
});

test('urlField keeps precedence and its existing normalized shape', () => {
  const link = {kind:'external', urlField:'destination', hrefTemplate:destination};
  assert.deepEqual(normalizeReportTableLink(link), {kind:'external',urlField:'destination'});
  assert.equal(resolveReportTableLink({row:{destination:'https://example.invalid/old'}, column:{link}, value:'Existing'})?.href,
    'https://example.invalid/old');
});

test('missing, null, blank and inherited row destinations stay inert', () => {
  for (const missing of [{}, {id:null}, {id:''}, {id:'  '}, Object.create({id:'inherited'})]) {
    assert.equal(resolveReportTableLink({row:missing, column:{link:{kind:'external',hrefTemplate:'https://example.invalid/records/{{id}}'}}, value:'Missing'}), null);
  }
});

test('template destinations preserve the existing HTTP(S) restriction', () => {
  for (const hrefTemplate of ['javascript:{{id}}', 'data:text/plain,{{id}}', 'file:///tmp/{{id}}', '//example.invalid/{{id}}']) {
    assert.equal(resolveReportTableLink({row:{id:'17'}, column:{link:{kind:'external',hrefTemplate}}, value:'Unsafe'}), null);
  }
  assert.equal(resolveReportTableLink({row:{scheme:'javascript',id:'17'}, column:{link:{kind:'external',hrefTemplate:'{{scheme}}:{{id}}'}}, value:'Unsafe'}), null);
});

test('spec and fill schemas admit only the report template contract', () => {
  for (const schema of [reportSpecSchema,reportFillSchema]) {
    const linkSchema = {$ref:'#/$defs/tableLink',$defs:schema.$defs};
    assert.equal(validateReportSchema(linkSchema, template).valid, true);
    assert.equal(validateReportSchema(linkSchema, {kind:'external',urlField:'destination'}).valid, true);
    for (const link of [{kind:'external'}, {...template,hrefTemplate:''}, {...template,expr:'anything'}, {...template,hrefTemplateSource:'windowForm'}]) {
      assert.equal(validateReportSchema(linkSchema, link).valid, false);
    }
  }
});

const container = {id:'neutral-report',dataSourceRef:'records'};
const config = {
  title:'Record counts',
  dimensions:[
    {id:'name',key:'name',label:'Record',paramPath:'dimensions.name',default:true},
    {id:'recordId',key:'recordId',paramPath:'dimensions.recordId'},
    {id:'groupId',key:'groupId',paramPath:'dimensions.groupId'},
  ],
  measures:[{id:'count',key:'count',label:'Count',paramPath:'measures.count',default:true}],
};
function lower(hrefTemplate, datasetRef='primary', builderConfig=config) {
  const document = buildReportBuilderReportDocument({container,config:builderConfig,
    state:{selectedDimensions:['name'],selectedMeasures:['count'],viewMode:'table',chartSpec:null},
    additionalBlocks:[{id:'recordDetails',kind:'tableBlock',title:'Records',datasetRef,columns:[
      {key:'name',link:{kind:'external',hrefTemplate}}, {key:'count'},
    ]}],
  });
  return lowerReportDocumentToReportSpec(document);
}
test('template row keys use the declared-field request planner without URL calculations', () => {
  const spec = lower('https://example.invalid/groups/{{groupId}}/records/{{recordId}}');
  const request = spec.datasets.find(dataset => dataset.id === 'primary').request;
  assert.equal(request.dimensions.groupId, true);
  assert.equal(request.dimensions.recordId, true);
  assert.deepEqual(spec.calculatedFields, []);
  assert.deepEqual(spec.blocks.find(block => block.id === 'recordDetails').columns[0].link,
    {kind:'external',hrefTemplate:'https://example.invalid/groups/{{groupId}}/records/{{recordId}}'});
});
test('undeclared template row keys follow existing catalog link admission', () => {
  const spec = lower('https://example.invalid/records/{{unknownId}}');
  assert.equal(spec.blocks.find(block => block.id === 'recordDetails').columns[0].link, undefined);
  assert.equal(spec.datasets[0].request.dimensions.unknownId, undefined);
});
test('another dataset cannot borrow primary template row keys', () => {
  const spec = lower('https://example.invalid/records/{{recordId}}', 'other', {...config,dataSources:[{
    id:'other',dataSourceRef:'other',request:{dimensions:{name:true},measures:{count:true}},
    columnOptions:[{key:'name',kind:'dimension'},{key:'count',kind:'measure'}],
  }]});
  assert.equal(spec.blocks.find(block => block.id === 'recordDetails').columns[0].link, undefined);
  assert.equal(spec.datasets.find(dataset => dataset.id === 'other').request.dimensions.recordId, undefined);
});
