const position = {type: 'array', minItems: 2, maxItems: 2, items: {type: 'number', minimum: -1e9, maximum: 1e9}};
const ring = {type: 'array', minItems: 4, items: position};
const polygon = {type: 'array', minItems: 1, items: ring};
export const geoGeometrySchema = {
  type: 'object', additionalProperties: false, required: ['type', 'features'],
  properties: {type: {const: 'FeatureCollection'}, features: {type: 'array', minItems: 1, maxItems: 2000, items: {
    type: 'object', additionalProperties: false, required: ['type', 'id', 'geometry'], properties: {
      type: {const: 'Feature'}, id: {type: 'string', minLength: 1, pattern: '^\\S(?:[\\s\\S]*\\S)?$'}, properties: {type: 'object', additionalProperties: true, properties: {label: {type: 'string', minLength: 1, pattern: '\\S'}}},
      geometry: {anyOf: [
        {type: 'object', additionalProperties: false, required: ['type', 'coordinates'], properties: {type: {const: 'Point'}, coordinates: position}},
        {type: 'object', additionalProperties: false, required: ['type', 'coordinates'], properties: {type: {const: 'Polygon'}, coordinates: polygon}},
        {type: 'object', additionalProperties: false, required: ['type', 'coordinates'], properties: {type: {const: 'MultiPolygon'}, coordinates: {type: 'array', minItems: 1, items: polygon}}},
      ]},
    },
  }}},
};
export const resolvedGeoGeometrySchema = {
  type: 'object', additionalProperties: false, required: ['viewBox', 'features'], properties: {
    viewBox: {enum: [[0, 0, 960, 500]]}, features: {type: 'array', minItems: 1, maxItems: 2000, items: {
      anyOf: ['path', 'point'].map(kind => ({type: 'object', additionalProperties: false, required: ['key', 'label', kind], properties: {
        key: {type: 'string', minLength: 1}, label: {type: 'string', minLength: 1},
        [kind]: kind === 'path' ? {type: 'string', minLength: 1} : position,
      }})),
    }},
  },
};

export const geoSymbolSizeSchema = {type: 'object', additionalProperties: false, required: ['key'], properties: {
  key: {type: 'string', minLength: 1, pattern: '\\S'}, label: {type: 'string', minLength: 1, pattern: '\\S'},
  aggregate: {enum: ['sum', 'avg', 'min', 'max', 'first']}, format: {enum: ['number', 'compact']},
  maxRadius: {type: 'number', minimum: 1, maximum: 64},
}};

// Reuse standard conditionals already supported by the canonical validator.
// All-polygon collections forbid symbolSize; collections with points require it.
export const geoPointSizeRequirement = {
  if: {properties: {geometry: {properties: {features: {type: 'array', items: {
    properties: {geometry: {properties: {type: {enum: ['Polygon', 'MultiPolygon']}}}},
  }}}}}},
  then: {properties: {symbolSize: false}},
  else: {required: ['symbolSize']},
};

export function geoConfigWithGeometry(base) {
  const {geometry, projection, ...legacyProperties} = base.properties;
  return {anyOf: [
    {...base, properties: {...legacyProperties, shape: {enum: ['us-states', 'us-state-tiles', 'world']}}},
    {...base, allOf: [geoPointSizeRequirement], required: [...base.required, 'shape', 'geometry', 'projection'], properties: {...base.properties, shape: {const: 'geojson'},
      symbolSize: geoSymbolSizeSchema,
    }},
  ]};
}
