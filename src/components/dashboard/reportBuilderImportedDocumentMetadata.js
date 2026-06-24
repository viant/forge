import {
  buildReportBuilderSemanticSummary,
  resolveReportBuilderSemanticSelections,
} from "./reportBuilderSemantic.js";
import { buildReportBuilderDocumentCompileDiagnostics } from "./reportBuilderDocumentBlocks.js";
import { buildReportDocumentScopeParams } from "../../reporting/reportDocumentModel.js";
import { lowerReportDocumentToReportSpec } from "../../reporting/reportDocumentModel.js";
import { buildReportDocumentCompileState } from "../../reporting/reportDocumentStore.js";
import {
  hasReportBuilderBindingContent as hasBindingContent,
  hasReportBuilderSemanticSummaryContent as hasSemanticSummaryContent,
  isReportBuilderPlainObject as isPlainObject,
} from "./reportBuilderMetadataContent.js";

function normalizeString(value = "") {
  return String(value || "").trim();
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function buildPreferredScope(reportSpecScope = null, embeddedScope = null) {
  const reportSpecParams = Array.isArray(reportSpecScope?.params) && reportSpecScope.params.length > 0
    ? cloneValue(reportSpecScope.params)
    : null;
  const embeddedParams = Array.isArray(embeddedScope?.params) && embeddedScope.params.length > 0
    ? cloneValue(embeddedScope.params)
    : null;
  const dataSourceRef = normalizeString(reportSpecScope?.dataSourceRef || embeddedScope?.dataSourceRef);
  if (!reportSpecParams && !embeddedParams && !dataSourceRef) {
    return null;
  }
  return {
    ...(reportSpecParams || embeddedParams ? { params: reportSpecParams || embeddedParams } : {}),
    ...(dataSourceRef ? { dataSourceRef } : {}),
  };
}

function resolveEmbeddedReportBuilderBlock(document = null) {
  const blocks = Array.isArray(document?.blocks) ? document.blocks : [];
  return blocks.find((block) => normalizeString(block?.kind) === "reportBuilderBlock") || null;
}

export function resolveEmbeddedReportBuilderBinding(document = null) {
  const reportBuilderBlock = resolveEmbeddedReportBuilderBlock(document);
  const stateBinding = isPlainObject(reportBuilderBlock?.state?.binding)
    ? cloneValue(reportBuilderBlock.state.binding)
    : null;
  if (stateBinding) {
    return stateBinding;
  }
  const configBinding = isPlainObject(reportBuilderBlock?.config?.binding)
    ? cloneValue(reportBuilderBlock.config.binding)
    : null;
  return configBinding || null;
}

export function resolveEmbeddedReportBuilderSemanticSummary(document = null) {
  const reportBuilderBlock = resolveEmbeddedReportBuilderBlock(document);
  const config = isPlainObject(reportBuilderBlock?.config)
    ? cloneValue(reportBuilderBlock.config)
    : null;
  const state = isPlainObject(reportBuilderBlock?.state)
    ? cloneValue(reportBuilderBlock.state)
    : {};
  const binding = resolveEmbeddedReportBuilderBinding(document);
  if (!config || !binding) {
    return null;
  }
  const bindingSelections = resolveReportBuilderSemanticSelections(config, binding);
  const syntheticState = {
    ...state,
    ...(Array.isArray(state?.selectedDimensions) && state.selectedDimensions.length > 0
      ? {}
      : { selectedDimensions: bindingSelections?.selectedDimensions || [] }),
    ...(Array.isArray(state?.selectedMeasures) && state.selectedMeasures.length > 0
      ? {}
      : { selectedMeasures: bindingSelections?.selectedMeasures || [] }),
    ...(isPlainObject(state?.binding) ? {} : { binding }),
  };
  return buildReportBuilderSemanticSummary({
    config,
    state: syntheticState,
    binding,
  });
}

export function resolveEmbeddedReportBuilderScope(document = null) {
  const reportBuilderBlock = resolveEmbeddedReportBuilderBlock(document);
  const config = isPlainObject(reportBuilderBlock?.config)
    ? cloneValue(reportBuilderBlock.config)
    : null;
  const state = isPlainObject(reportBuilderBlock?.state)
    ? cloneValue(reportBuilderBlock.state)
    : {};
  if (!config) {
    return null;
  }
  const params = buildReportDocumentScopeParams(config, state);
  const dataSourceRef = normalizeString(reportBuilderBlock?.source?.dataSourceRef);
  if (params.length === 0 && !dataSourceRef) {
    return null;
  }
  return {
    ...(params.length > 0 ? { params } : {}),
    ...(dataSourceRef ? { dataSourceRef } : {}),
  };
}

export function resolveEmbeddedReportSpec(document = null) {
  if (!isPlainObject(document)) {
    return null;
  }
  try {
    return lowerReportDocumentToReportSpec(document);
  } catch (_) {
    return null;
  }
}

export function resolveEmbeddedReportDocumentCompileState(document = null, reportSpec = null) {
  if (!isPlainObject(document)) {
    return null;
  }
  const effectiveReportSpec = isPlainObject(reportSpec) ? reportSpec : resolveEmbeddedReportSpec(document);
  if (!effectiveReportSpec) {
    return null;
  }
  return buildReportDocumentCompileState(effectiveReportSpec, {
    diagnostics: buildReportBuilderDocumentCompileDiagnostics({
      document,
    }),
  });
}

export function backfillImportedDocumentMetadata(document = null, reportSpec = null) {
  if (!isPlainObject(document)) {
    return document;
  }
  const nextDocument = cloneValue(document);
  const reportSpecSemanticSummary = isPlainObject(reportSpec?.semanticSummary)
    ? cloneValue(reportSpec.semanticSummary)
    : null;
  const reportSpecScope = isPlainObject(reportSpec?.scope)
    ? cloneValue(reportSpec.scope)
    : null;
  const reportSpecBinding = isPlainObject(reportSpec?.binding)
    ? cloneValue(reportSpec.binding)
    : null;
  const embeddedSemanticSummary = resolveEmbeddedReportBuilderSemanticSummary(nextDocument);
  const embeddedScope = resolveEmbeddedReportBuilderScope(nextDocument);
  const embeddedBinding = resolveEmbeddedReportBuilderBinding(nextDocument);
  if (!isPlainObject(nextDocument?.semanticSummary) && (reportSpecSemanticSummary || embeddedSemanticSummary)) {
    nextDocument.semanticSummary = hasSemanticSummaryContent(reportSpecSemanticSummary)
      ? reportSpecSemanticSummary
      : (embeddedSemanticSummary || reportSpecSemanticSummary);
  }
  const preferredScope = buildPreferredScope(reportSpecScope, embeddedScope);
  if (!isPlainObject(nextDocument?.scope) && preferredScope) {
    nextDocument.scope = preferredScope;
  }
  if (!isPlainObject(nextDocument?.binding) && (reportSpecBinding || embeddedBinding)) {
    nextDocument.binding = hasBindingContent(reportSpecBinding)
      ? reportSpecBinding
      : (embeddedBinding || reportSpecBinding);
  }
  return nextDocument;
}
