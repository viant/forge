import { validateReportSchema } from "./reportSchemaValidator.js";
import { reportExportRequestSchema } from "./reportExportRequestSchema.js";
import { reportFillSchema } from "./reportFillSchema.js";
import { reportPrintSchema } from "./reportPrintSchema.js";
import { reportSpecSchema } from "./reportSpecSchema.js";

export { reportSpecSchema, reportFillSchema, reportPrintSchema, reportExportRequestSchema };

export function validateReportSpec(value = null) {
  return validateReportSchema(reportSpecSchema, value);
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
  return {
    valid: errors.length === 0,
    errors,
  };
}
