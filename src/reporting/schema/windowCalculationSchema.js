// Public window-calculation grammar shared by spec and fill artifacts.
const field = {type: "string", pattern: "\\S"};
const fieldList = {type: "array", items: field};
const orderBy = {
  type: "array", minItems: 1,
  items: {
    type: "object", additionalProperties: false, required: ["field", "direction"],
    properties: {field, direction: {enum: ["asc", "desc"]}},
  },
};
const bound = {type: "integer", minimum: 0, maximum: 10000};

export const windowCalculationDefinitions = {
  lagCompute: {
    type: "object",
    additionalProperties: false,
    required: ["type", "sourceField", "orderBy"],
    properties: {
      type: {const: "lag"},
      sourceField: field,
      partitionBy: fieldList,
      orderBy,
      offset: {type: "integer", minimum: 1, maximum: 10000},
    },
  },
  windowMaxCompute: {
    type: "object",
    additionalProperties: false,
    required: ["type", "sourceField", "frame"],
    properties: {
      type: {const: "windowMax"},
      sourceField: field,
      partitionBy: fieldList,
      orderBy,
      frame: {anyOf: [
        {
          type: "object", additionalProperties: false, required: ["type"],
          properties: {type: {const: "full"}},
        },
        {
          type: "object", additionalProperties: false, required: ["type", "preceding", "following"],
          properties: {type: {const: "rows"}, preceding: bound, following: bound},
        },
      ]},
    },
    if: {required: ["frame"], properties: {frame: {required: ["type"], properties: {type: {const: "rows"}}}}},
    then: {required: ["orderBy"]},
  },
};
