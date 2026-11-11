import { reportSpecSchema } from './reportSpecSchema.js';

// Authored inputs normalized by backend/reporting/fenced/compiler.go,
// normalizeSpecBlocks, and reportDocumentModel.lowerReportDocumentToReportSpec.
// These annotations describe derived fields; they do not change ReportSpec validation.
export const reportDocumentDerivedFields = Object.freeze({
  chartBlock: ['title', 'chartModel'],
  geoMapBlock: ['title'],
  tableBlock: ['title'],
  kpiBlock: ['title', 'valueLabel'],
  badgesBlock: ['title'],
  collectionBlock: ['title'],
  sectionBlock: ['title', 'navigationLabel'],
  compositeBlock: ['title'],
  stepperBlock: ['title'],
  infoPanelBlock: ['title'],
  calloutBlock: ['title'],
  kanbanBlock: ['title'],
  timelineBlock: ['title'],
  filterBarBlock: ['title'],
  markdownBlock: ['title'],
});

const definitions = structuredClone(reportSpecSchema.$defs);
for (const [name, fields] of Object.entries(reportDocumentDerivedFields)) {
  const definition = definitions[name];
  for (const field of fields) {
    if (!definition?.properties?.[field]) throw new Error(`Unknown derived field ${name}.${field}`);
    definition.properties[field]['x-forge-derived'] = true;
  }
  definition.required = definition.required.filter(field => !fields.includes(field));
}
const segment = { type: 'string', minLength: 1, pattern: '^[A-Za-z0-9._-]+$' };
const envelope = {
  version: { const: 1 }, scope: segment, id: segment,
  sequence: { type: 'integer', minimum: 1 },
  mode: { enum: ['start', 'append', 'patch', 'replace', 'commit'] },
  grammar: { const: 'report-document-v1' },
  title: reportSpecSchema.properties.title,
  subtitle: reportSpecSchema.properties.subtitle,
  description: { type: 'string' },
  viewer: reportSpecSchema.properties.viewer,
  theme: reportSpecSchema.properties.theme,
  blocks: { type: 'array', items: { $ref: '#/$defs/block' } },
  target: { type: 'object', additionalProperties: false, properties: {
    kind: { enum: ['report', 'block'] }, ref: segment,
    slot: { enum: ['childBlockIds', 'sectionIds'] }, position: { const: 'append' },
  } },
  removeBlockIds: { type: 'array', items: segment },
  layout: { type: 'object', additionalProperties: false, properties: {
    type: { const: 'grid' }, columns: { type: 'integer', minimum: 1, maximum: 12 },
    items: { type: 'array', items: { type: 'object', additionalProperties: false,
      required: ['blockId'], properties: { blockId: segment,
        span: { type: 'integer', minimum: 1, maximum: 12 },
        size: { enum: ['full', 'half', 'third', 'quarter', 'two-thirds', 'twothirds', '1/4', '1/3', '2/3'] },
      } } },
  } },
  metadata: { type: 'object' }, fallback: { type: 'object' },
  datasets: { type: 'array' }, dataSources: { type: 'object' },
};

// A patch is a recursive JSON merge in the owning assemblers. Preserve all
// property types/enums and unknown-field constraints, but require only identity.
function patchSchema(value) {
  if (Array.isArray(value)) return value.map(patchSchema);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'required')
    .map(([key, item]) => [key, key === 'if' ? item : key === '$ref' && typeof item === 'string' && item.startsWith('#/$defs/')
      ? item.replace('#/$defs/', '#/$defs/patch_') : patchSchema(item)]));
}
for (const [name, definition] of Object.entries(definitions)) definitions[`patch_${name}`] = patchSchema(definition);
const patchBlock = { allOf: [{ $ref: '#/$defs/patch_block' }, { required: ['id'] }] };
export const reportTransactionSchema = {
  $id: 'report://schema/report-transaction/v1', $schema: reportSpecSchema.$schema,
  type: 'object', additionalProperties: false,
  required: ['version', 'scope', 'id', 'sequence', 'mode'],
  properties: { ...envelope, blocks: { type: 'array', items: { type: 'object' } } },
  allOf: [
    { if: { properties: { mode: { enum: ['start', 'replace'] } } }, then: { required: ['grammar'] } },
    { if: { properties: { mode: { const: 'patch' } } },
      then: { properties: { blocks: { type: 'array', items: patchBlock } } },
      else: { properties: { blocks: envelope.blocks } } },
  ],
  $defs: definitions,
};
export const reportDataSchema = {
  $id: 'report://schema/report-data/v2', $schema: reportSpecSchema.$schema,
  type: 'object', additionalProperties: false,
  required: ['version', 'scope', 'id', 'reportRef', 'sequence', 'format', 'mode', 'data'],
  properties: { version: { const: 2 }, scope: segment, id: segment, reportRef: segment,
    sequence: { type: 'integer', minimum: 1 }, format: { enum: ['json', 'csv'] },
    mode: { enum: ['replace', 'append', 'patch'] }, data: {},
  },
  allOf: [{ if: { properties: { format: { const: 'csv' } } }, then: { properties: { data: { type: 'string' } } } }],
};
