import { validateReportSchema } from "./reportSchemaValidator.js";
import { reportExportRequestSchema } from "./reportExportRequestSchema.js";
import { reportFillSchema } from "./reportFillSchema.js";
import { reportPrintSchema } from "./reportPrintSchema.js";
import { reportSpecSchema } from "./reportSpecSchema.js";
import { normalizeReportCalculatedField } from "../calculatedFieldModel.js";
import { buildReportFillHash, buildReportSpecHash } from "../reportFillModel.js";

export { reportSpecSchema, reportFillSchema, reportPrintSchema, reportExportRequestSchema };

function normalizeString(value = "") {
  return String(value || "").trim();
}

function normalizePositiveInteger(value = 0) {
  const normalized = Math.trunc(Number(value));
  return Number.isInteger(normalized) && normalized > 0 ? normalized : null;
}

function isPlainObject(value = null) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeArtifactSource(source = null) {
  if (!isPlainObject(source)) {
    return null;
  }
  const kind = normalizeString(source.kind);
  const containerId = normalizeString(source.containerId);
  const stateKey = normalizeString(source.stateKey);
  const dataSourceRef = normalizeString(source.dataSourceRef);
  if (!kind || !containerId || !stateKey || !dataSourceRef) {
    return null;
  }
  return {
    kind,
    containerId,
    stateKey,
    dataSourceRef,
  };
}

function stableSerialize(value) {
  return JSON.stringify(value == null ? null : value);
}

function validateReportSpecCalculatedFieldComputeShape(definition = {}, path = "$") {
  const compute = definition?.compute;
  if (!compute || typeof compute !== "object" || Array.isArray(compute)) {
    return [];
  }
  const computeType = normalizeString(compute?.type);
  if (!computeType) {
    return [{
      path: `${path}.compute.type`,
      code: "required",
      message: "Missing required property.",
    }];
  }
  if (computeType === "rank") {
    const orderBy = Array.isArray(compute?.orderBy) ? compute.orderBy : [];
    const sourceField = normalizeString(compute?.sourceField);
    const tieMode = normalizeString(compute?.tieMode).toLowerCase();
    if (orderBy.length === 0) {
      return [{
        path: `${path}.compute.orderBy`,
        code: "required",
        message: "Rank table calculations require at least one orderBy entry.",
      }];
    }
    if (normalizeString(orderBy[0]?.field) !== sourceField) {
      return [{
        path: `${path}.compute.orderBy[0].field`,
        code: "invalid",
        message: "Rank table calculations must order first by their sourceField.",
      }];
    }
    if (tieMode && tieMode !== "dense") {
      return [{
        path: `${path}.compute.tieMode`,
        code: "invalid",
        message: `Unsupported rank tieMode '${compute.tieMode}'.`,
      }];
    }
  }
  if (computeType === "percentOfTotal") {
    if (!normalizeString(compute?.sourceField)) {
      return [{
        path: `${path}.compute.sourceField`,
        code: "required",
        message: "Percent-of-total table calculations require a sourceField.",
      }];
    }
  }
  if (computeType === "runningTotal" || computeType === "deltaFromPrevious" || computeType === "movingAverage") {
    const orderBy = Array.isArray(compute?.orderBy) ? compute.orderBy : [];
    if (orderBy.length === 0) {
      return [{
        path: `${path}.compute.orderBy`,
        code: "required",
        message: `${computeType} table calculations require at least one orderBy entry.`,
      }];
    }
  }
  if (computeType === "movingAverage") {
    const windowSize = Number(compute?.windowSize);
    if (!Number.isInteger(windowSize) || windowSize <= 0) {
      return [{
        path: `${path}.compute.windowSize`,
        code: "invalid",
        message: "Moving average windowSize must be a positive integer.",
      }];
    }
  }
  return [];
}

function filterRedundantCalculatedFieldSchemaErrors(errors = [], calculatedFieldErrors = []) {
  const semanticFieldPrefixes = new Set(
    (Array.isArray(calculatedFieldErrors) ? calculatedFieldErrors : [])
      .map((error) => String(error?.path || "").trim())
      .filter((path) => path.startsWith("$.calculatedFields[")),
  );
  if (semanticFieldPrefixes.size === 0) {
    return Array.isArray(errors) ? errors : [];
  }
  return (Array.isArray(errors) ? errors : []).filter((error) => {
    const path = String(error?.path || "").trim();
    if (!path.startsWith("$.calculatedFields[")) {
      return true;
    }
    for (const semanticPath of semanticFieldPrefixes) {
      const fieldPrefix = semanticPath.replace(/(\.expr|\.compute(?:\..+)?)$/, "");
      if (fieldPrefix && path.startsWith(fieldPrefix)) {
        return false;
      }
    }
    return true;
  });
}

function validateReportSpecCalculatedFields(value = null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }
  const datasets = Array.isArray(value?.datasets) ? value.datasets : [];
  const validDatasetRefs = new Set(
    datasets
      .map((dataset) => normalizeString(dataset?.id))
      .filter(Boolean),
  );
  return (Array.isArray(value?.calculatedFields) ? value.calculatedFields : []).flatMap((definition, index) => {
    const path = `$.calculatedFields[${index}]`;
    const computeShapeErrors = validateReportSpecCalculatedFieldComputeShape(definition, path);
    if (computeShapeErrors.length > 0) {
      return computeShapeErrors;
    }
    let normalized = null;
    try {
      normalized = normalizeReportCalculatedField(definition);
    } catch (error) {
      const definitionPath = normalizeString(definition?.expr)
        ? `${path}.expr`
        : `${path}.compute`;
      return [{
        path: definitionPath,
        code: normalizeString(definition?.expr) ? "invalidSyntax" : "invalid",
        message: String(error?.message || "Calculated field could not be normalized.").trim(),
      }];
    }
    if (!normalized) {
      const definitionPath = definition?.compute && typeof definition.compute === "object" && !Array.isArray(definition.compute)
        ? `${path}.compute`
        : path;
      return [{
        path: definitionPath,
        code: "invalid",
        message: "Calculated field could not be normalized.",
      }];
    }
    const expectedKind = normalizeString(definition?.kind);
    const actualKind = normalizeString(normalized?.kind);
    const errors = [];
    if (expectedKind && actualKind && expectedKind !== actualKind) {
      errors.push({
        path: `${path}.kind`,
        code: "invalid",
        message: `Calculated field kind '${expectedKind}' does not match normalized kind '${actualKind}'.`,
      });
    }
    const datasetRef = normalizeString(normalized?.datasetRef || definition?.datasetRef);
    if (datasetRef && !validDatasetRefs.has(datasetRef)) {
      errors.push({
        path: `${path}.datasetRef`,
        code: "unknownDatasetRef",
        message: `Unknown datasetRef '${datasetRef}'.`,
      });
    }
    return errors;
  });
}

export function validateReportSpec(value = null) {
  const topLevel = validateReportSchema(reportSpecSchema, value);
  const calculatedFieldErrors = validateReportSpecCalculatedFields(value);
  const errors = [
    ...filterRedundantCalculatedFieldSchemaErrors(topLevel.errors, calculatedFieldErrors),
    ...calculatedFieldErrors,
  ];
  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateReportFill(value = null) {
  return validateReportSchema(reportFillSchema, value);
}

export function validateReportPrint(value = null) {
  return validateReportSchema(reportPrintSchema, value);
}

function prefixNestedValidationErrors(errors = [], prefix = "$") {
  return (Array.isArray(errors) ? errors : []).map((error) => {
    const path = String(error?.path || "$").trim() || "$";
    const normalizedPrefix = String(prefix || "$").trim() || "$";
    return {
      ...error,
      path: path === "$"
        ? normalizedPrefix
        : `${normalizedPrefix}${path.startsWith("$.") ? path.slice(1) : path}`,
    };
  });
}

function validateReportExportArtifactConformance(value = null) {
  if (!isPlainObject(value)) {
    return [];
  }
  const reportSpec = isPlainObject(value?.reportSpec) ? value.reportSpec : null;
  const reportFill = isPlainObject(value?.reportFill) ? value.reportFill : null;
  const reportPrint = isPlainObject(value?.reportPrint) ? value.reportPrint : null;
  if (
    !reportSpec
    || !reportFill
    || normalizeString(reportSpec?.kind) !== "reportSpec"
    || normalizeString(reportFill?.kind) !== "reportFill"
  ) {
    return [];
  }

  const errors = [];
  const specVersion = normalizePositiveInteger(reportSpec?.version);
  const fillVersion = normalizePositiveInteger(reportFill?.version);
  const fillSpecVersion = normalizePositiveInteger(reportFill?.specVersion);
  const specHash = specVersion != null ? buildReportSpecHash(reportSpec) : "";
  const fillSpecHash = normalizeString(reportFill?.specHash);
  const fillHash = fillVersion != null ? buildReportFillHash(reportFill) : "";
  const specSource = normalizeArtifactSource(reportSpec?.source);
  const fillSource = normalizeArtifactSource(reportFill?.source);

  if (specVersion != null && fillSpecVersion != null && fillSpecVersion !== specVersion) {
    errors.push({
      path: "$.reportFill.specVersion",
      code: "invalidContract",
      message: "ReportFill specVersion must match reportSpec.version.",
    });
  }
  if (specHash && fillSpecHash && fillSpecHash !== specHash) {
    errors.push({
      path: "$.reportFill.specHash",
      code: "invalidContract",
      message: "ReportFill specHash must match reportSpec.",
    });
  }
  if (specSource && fillSource && stableSerialize(specSource) !== stableSerialize(fillSource)) {
    errors.push({
      path: "$.reportFill.source",
      code: "invalidContract",
      message: "ReportFill source must match reportSpec.source.",
    });
  }

  if (!reportPrint || normalizeString(reportPrint?.kind) !== "reportPrint") {
    return errors;
  }

  const printSpecVersion = normalizePositiveInteger(reportPrint?.specVersion);
  const printSpecHash = normalizeString(reportPrint?.specHash);
  const printFillVersion = normalizePositiveInteger(reportPrint?.fillVersion);
  const printFillHash = normalizeString(reportPrint?.fillHash);
  const printSource = normalizeArtifactSource(reportPrint?.source);

  if (specVersion != null && printSpecVersion != null && printSpecVersion !== specVersion) {
    errors.push({
      path: "$.reportPrint.specVersion",
      code: "invalidContract",
      message: "ReportPrint specVersion must match reportSpec.version.",
    });
  }
  if (specHash && printSpecHash && printSpecHash !== specHash) {
    errors.push({
      path: "$.reportPrint.specHash",
      code: "invalidContract",
      message: "ReportPrint specHash must match reportSpec.",
    });
  }
  if (fillVersion != null && printFillVersion != null && printFillVersion !== fillVersion) {
    errors.push({
      path: "$.reportPrint.fillVersion",
      code: "invalidContract",
      message: "ReportPrint fillVersion must match reportFill.version.",
    });
  }
  if (fillHash && printFillHash && printFillHash !== fillHash) {
    errors.push({
      path: "$.reportPrint.fillHash",
      code: "invalidContract",
      message: "ReportPrint fillHash must match reportFill.",
    });
  }
  if (specSource && printSource && stableSerialize(specSource) !== stableSerialize(printSource)) {
    errors.push({
      path: "$.reportPrint.source",
      code: "invalidContract",
      message: "ReportPrint source must match reportSpec.source.",
    });
  }

  return errors;
}

function validateReportExportSourceContract(source = null) {
  if (!isPlainObject(source)) {
    return [];
  }
  const from = normalizeString(source?.from);
  const artifactKind = normalizeString(source?.artifactKind);
  const payloadId = normalizeString(source?.payloadId);
  const sourceArtifactId = normalizeString(source?.sourceArtifactId);
  const reportId = normalizeString(source?.reportId);
  const documentVersion = normalizePositiveInteger(source?.documentVersion);
  const errors = [];

  const requireField = (path, condition, message) => {
    if (!condition) {
      errors.push({
        path,
        code: "required",
        message,
      });
    }
  };

  const requireArtifactKind = (expectedKind) => {
    if (artifactKind && artifactKind !== expectedKind) {
      errors.push({
        path: "$.source.artifactKind",
        code: "invalidContract",
        message: `Export source '${from}' must use artifactKind '${expectedKind}'.`,
      });
    }
  };

  switch (from) {
    case "savedPayload":
      requireArtifactKind("reportBuilder.savedReportPayload");
      requireField("$.source.payloadId", !!payloadId, "Saved payload export sources require a payloadId.");
      requireField("$.source.reportId", !!reportId, "Saved payload export sources require a reportId.");
      requireField("$.source.documentVersion", documentVersion != null, "Saved payload export sources require a documentVersion.");
      break;
    case "savedView":
      requireArtifactKind("reportBuilder.savedView");
      requireField("$.source.sourceArtifactId", !!sourceArtifactId, "Saved view export sources require a sourceArtifactId.");
      requireField("$.source.reportId", !!reportId, "Saved view export sources require a reportId.");
      requireField("$.source.documentVersion", documentVersion != null, "Saved view export sources require a documentVersion.");
      break;
    case "publishedSnapshot":
      requireArtifactKind("reportBuilder.publishedSnapshot");
      requireField("$.source.sourceArtifactId", !!sourceArtifactId, "Published snapshot export sources require a sourceArtifactId.");
      requireField("$.source.reportId", !!reportId, "Published snapshot export sources require a reportId.");
      requireField("$.source.documentVersion", documentVersion != null, "Published snapshot export sources require a documentVersion.");
      break;
    default:
      break;
  }

  return errors;
}

export function validateReportExportRequest(value = null) {
  const topLevel = validateReportSchema(reportExportRequestSchema, value);
  const errors = [...topLevel.errors];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  if (value.reportSpec !== undefined) {
    errors.push(...prefixNestedValidationErrors(validateReportSpec(value.reportSpec).errors, "$.reportSpec"));
  }
  if (value.reportFill !== undefined) {
    errors.push(...prefixNestedValidationErrors(validateReportFill(value.reportFill).errors, "$.reportFill"));
  }
  const format = String(value?.target?.format || "").trim().toLowerCase();
  const requiresPrint = format === "pdf" || format === "html";
  const sourceFrom = String(value?.source?.from || "").trim();
  if (sourceFrom === "savedPayload" && !String(value?.source?.payloadId || "").trim()) {
    errors.push({
      path: "$.source.payloadId",
      code: "required",
      message: "Missing required property.",
    });
  }
  if (requiresPrint && !value?.reportPrint) {
    errors.push({
      path: "$.reportPrint",
      code: "required",
      message: "Missing required property.",
    });
  } else if (value?.reportPrint !== undefined) {
    errors.push(...prefixNestedValidationErrors(validateReportPrint(value.reportPrint).errors, "$.reportPrint"));
  }
  errors.push(...validateReportExportSourceContract(value?.source));
  errors.push(...validateReportExportArtifactConformance(value));
  return {
    valid: errors.length === 0,
    errors,
  };
}
