function normalizePathSegment(segment = "") {
  return String(segment || "").trim();
}

function joinPath(path = "$", segment = "") {
  const normalized = normalizePathSegment(segment);
  if (!normalized) {
    return path;
  }
  if (normalized.startsWith("[")) {
    return `${path}${normalized}`;
  }
  return path === "$" ? `$.${normalized}` : `${path}.${normalized}`;
}

function isObjectLike(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function matchesType(type, value) {
  switch (type) {
    case "object":
      return isObjectLike(value);
    case "array":
      return Array.isArray(value);
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "boolean":
      return typeof value === "boolean";
    case "null":
      return value === null;
    default:
      return true;
  }
}

function resolveRef(rootSchema = {}, ref = "") {
  const normalized = String(ref || "").trim();
  if (!normalized.startsWith("#/")) {
    throw new Error(`Unsupported schema ref: ${normalized}`);
  }
  return normalized
    .slice(2)
    .split("/")
    .map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"))
    .reduce((current, part) => current?.[part], rootSchema);
}

function validateNode(schema = {}, value, path = "$", rootSchema = schema) {
  let normalizedSchema = schema;
  while (normalizedSchema?.$ref) {
    normalizedSchema = resolveRef(rootSchema, normalizedSchema.$ref);
  }
  if (!normalizedSchema || typeof normalizedSchema !== "object") {
    return [];
  }

  if (Array.isArray(normalizedSchema.anyOf) && normalizedSchema.anyOf.length > 0) {
    const candidateErrors = normalizedSchema.anyOf.map((candidate) => validateNode(candidate, value, path, rootSchema));
    const successful = candidateErrors.find((errors) => errors.length === 0);
    if (successful) {
      return [];
    }
    const mostSpecific = candidateErrors
      .filter((errors) => errors.length > 0)
      .sort((left, right) => {
        const leftDepth = Math.max(...left.map((error) => String(error?.path || "").length));
        const rightDepth = Math.max(...right.map((error) => String(error?.path || "").length));
        if (leftDepth !== rightDepth) {
          return rightDepth - leftDepth;
        }
        return left.length - right.length;
      })[0];
    return mostSpecific || [{
      path,
      code: "anyOf",
      message: "Value does not match any allowed schema branch.",
    }];
  }

  if (Object.prototype.hasOwnProperty.call(normalizedSchema, "const") && value !== normalizedSchema.const) {
    return [{
      path,
      code: "const",
      message: `Expected constant value ${JSON.stringify(normalizedSchema.const)}.`,
    }];
  }

  if (Array.isArray(normalizedSchema.enum) && !normalizedSchema.enum.some((entry) => JSON.stringify(entry) === JSON.stringify(value))) {
    return [{
      path,
      code: "enum",
      message: `Value ${JSON.stringify(value)} is not in the allowed enum.`,
    }];
  }

  const declaredTypes = Array.isArray(normalizedSchema.type)
    ? normalizedSchema.type
    : (normalizedSchema.type ? [normalizedSchema.type] : []);
  if (declaredTypes.length > 0 && !declaredTypes.some((type) => matchesType(type, value))) {
    return [{
      path,
      code: "type",
      message: `Expected ${declaredTypes.join(" or ")}.`,
    }];
  }

  const errors = [];
  const effectiveType = declaredTypes[0];

  if (effectiveType === "object" || (!declaredTypes.length && normalizedSchema.properties)) {
    const properties = isObjectLike(normalizedSchema.properties) ? normalizedSchema.properties : {};
    const required = Array.isArray(normalizedSchema.required) ? normalizedSchema.required : [];
    required.forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(value || {}, key)) {
        errors.push({
          path: joinPath(path, key),
          code: "required",
          message: "Missing required property.",
        });
      }
    });
    if (isObjectLike(value)) {
      Object.keys(value).forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(properties, key)) {
          return;
        }
        if (normalizedSchema.additionalProperties === false) {
          errors.push({
            path: joinPath(path, key),
            code: "additionalProperties",
            message: "Unexpected property.",
          });
          return;
        }
        if (isObjectLike(normalizedSchema.additionalProperties)) {
          errors.push(...validateNode(
            normalizedSchema.additionalProperties,
            value[key],
            joinPath(path, key),
            rootSchema,
          ));
        }
      });
    }
    Object.entries(properties).forEach(([key, propertySchema]) => {
      if (!Object.prototype.hasOwnProperty.call(value || {}, key)) {
        return;
      }
      errors.push(...validateNode(propertySchema, value[key], joinPath(path, key), rootSchema));
    });
  }

  if (effectiveType === "array" && Array.isArray(value)) {
    if (Number.isFinite(Number(normalizedSchema.minItems)) && value.length < Number(normalizedSchema.minItems)) {
      errors.push({
        path,
        code: "minItems",
        message: `Expected at least ${Number(normalizedSchema.minItems)} item(s).`,
      });
    }
    if (normalizedSchema.items) {
      value.forEach((item, index) => {
        errors.push(...validateNode(normalizedSchema.items, item, joinPath(path, `[${index}]`), rootSchema));
      });
    }
  }

  if ((effectiveType === "number" || effectiveType === "integer") && Number.isFinite(Number(normalizedSchema.minimum))) {
    if (Number(value) < Number(normalizedSchema.minimum)) {
      errors.push({
        path,
        code: "minimum",
        message: `Expected number >= ${Number(normalizedSchema.minimum)}.`,
      });
    }
  }

  return errors;
}

export function validateReportSchema(schema = {}, value) {
  const errors = validateNode(schema, value, "$", schema);
  return {
    valid: errors.length === 0,
    errors,
  };
}
