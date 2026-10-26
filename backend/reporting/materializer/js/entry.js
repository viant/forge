import {applyReportChartSelections} from "../../../../src/reporting/reportPresentationModel.js";
// Envelope adapter restored from the previously embedded implementation.
// All report lowering and rendering algorithms are imported from canonical Forge.
import "./intl-global.js";
import "@formatjs/intl-getcanonicallocales/polyfill-force.js";
import "@formatjs/intl-locale/polyfill-force.js";
import "@formatjs/intl-pluralrules/polyfill-force.js";
import "@formatjs/intl-pluralrules/locale-data/en.js";
import "@formatjs/intl-numberformat/polyfill-force.js";
import "@formatjs/intl-numberformat/locale-data/en.js";
import "@formatjs/intl-datetimeformat/polyfill-force.js";
import "@formatjs/intl-datetimeformat/locale-data/en.js";
import "@formatjs/intl-datetimeformat/add-all-tz.js";
import {buildReportBuilderReportDocument} from "../../../../src/reporting/reportDocumentModel.js";
import {lowerValidatedReportDocument} from "../../../../src/reporting/reportChartValidation.js";
import {buildReportFillFromReportSpec} from "../../../../src/reporting/reportFillModel.js";
import {buildReportPrintFromReportFill} from "../../../../src/reporting/reportPrintModel.js";
import {normalizeReportBuilderPredicates} from "../../../../src/components/dashboard/reportBuilderPredicates.js";
import {prepareWindowBuilderExport} from "../../../../src/reporting/windowBuilderExportState.js";
import {mapReportRequestEnvelope, reportRequestWindowIdentity} from "../../../../src/reporting/reportRequestEnvelope.js";
  function isObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }
  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }
  function mergeObject(base, patch) {
    const result = isObject(base) ? clone(base) : {};
    if (!isObject(patch)) return result;
    Object.keys(patch).forEach((key) => {
      if (isObject(result[key]) && isObject(patch[key])) {
        result[key] = mergeObject(result[key], patch[key]);
      } else {
        result[key] = clone(patch[key]);
      }
    });
    return result;
  }
  function bindInvocationScope(config, state, request) {
    if (!request) return state;
    const safe = (name) => typeof name === "string" && /^[A-Za-z][A-Za-z0-9_]*$/.test(name)
      && !["constructor", "prototype", "__proto__"].includes(name);
    const read = (path) => {
      const parts = typeof path === "string" ? path.split(".") : [];
      if (!parts.length || !["filters", "options"].includes(parts[0]) || !parts.every(safe)) return undefined;
      return parts.reduce((value, key) => isObject(value) && Object.prototype.hasOwnProperty.call(value, key) ? value[key] : undefined, request);
    };
    const params = {...(isObject(state.scopeParams) ? state.scopeParams : {})};
    for (const predicate of normalizeReportBuilderPredicates(config)) {
      if (!safe(predicate?.id)) continue;
      if (predicate.kind === "dateRange") {
        const start = read(predicate.startParamPath), end = read(predicate.endParamPath);
        if (start !== undefined || end !== undefined) params[predicate.id] = {
          ...(isObject(params[predicate.id]) ? params[predicate.id] : {}),
          ...(start !== undefined ? {start: clone(start)} : {}),
          ...(end !== undefined ? {end: clone(end)} : {}),
        };
      } else {
        const value = read(predicate.paramPath);
        if (value !== undefined) params[predicate.id] = clone(value);
      }
    }
    return {...state, scopeParams: params};
  }
  function normalizeDataSources(dataSources) {
    if (dataSources == null) return [];
    if (!isObject(dataSources)) throw new Error("Report envelope dataSources must be an object map.");
    return Object.keys(dataSources).sort().map((id) => {
      const descriptor = dataSources[id];
      if (!isObject(descriptor)) throw new Error(`Report datasource '${id}' must be a trusted descriptor object.`);
      return Object.assign({}, clone(descriptor), {
        id,
        dataSourceRef: String(descriptor.dataSourceRef || descriptor.value || id)
      });
    });
  }
  function authoredReportDocument(envelope, requestBaseParameters = null) {
    var _a5;
    if (!isObject(envelope) || envelope.schemaVersion !== 1 || envelope.format !== "forge.authoredReport") {
      throw new Error("Expected a schema version 1 forge.authoredReport envelope.");
    }
    const sourceDocument = envelope.reportDocument;
    const builderDefinition = envelope.builderDefinition;
    const builder = isObject(builderDefinition) ? builderDefinition.reportBuilder : null;
    if (!isObject(sourceDocument) || !isObject(builder)) {
      throw new Error("Authored reports require a report document and complete reportBuilder definition.");
    }
    const config = clone(builder);
    if (requestBaseParameters) config.request = {...config.request, baseParameters: clone(requestBaseParameters)};
    delete config.document;
    delete config.reportDocument;
    delete config.state;
    const sources = normalizeDataSources(envelope.dataSources);
    if (sources.length > 0 && (!Array.isArray(config.dataSources) || config.dataSources.length === 0)) config.dataSources = sources;
    const sourceBlock = (Array.isArray(sourceDocument.blocks) ? sourceDocument.blocks : []).find((block) => (block == null ? void 0 : block.kind) === "reportBuilderBlock") || null;
    const source = isObject(sourceBlock == null ? void 0 : sourceBlock.source) ? sourceBlock.source : {};
    const containerId = String(source.containerId || source.stateKey || sourceDocument.id || envelope.builderRef || "authoredReport");
    const container = {
      id: containerId,
      stateKey: String(source.stateKey || containerId),
      title: String(sourceDocument.title || (sourceBlock == null ? void 0 : sourceBlock.title) || config.title || "Report"),
      dataSourceRef: String(source.dataSourceRef || ((_a5 = sourceDocument.scope) == null ? void 0 : _a5.dataSourceRef) || config.dataSourceRef || builderDefinition.dataSourceRef || "")
    };
    const authoredBlocks = (Array.isArray(sourceDocument.blocks) ? sourceDocument.blocks : []).filter((block) => (block == null ? void 0 : block.kind) !== "reportBuilderBlock").map((block) => clone(block));
    const generated = buildReportBuilderReportDocument({
      container,
      config,
      state: bindInvocationScope(config, isObject(envelope.state) ? clone(envelope.state) : {}, requestBaseParameters),
      additionalBlocks: authoredBlocks,
      refinements: Array.isArray(sourceDocument.refinements) ? sourceDocument.refinements : [],
      semanticSummary: isObject(sourceDocument.semanticSummary) ? sourceDocument.semanticSummary : null
    });
    const generatedBlock = generated.blocks.find((block) => (block == null ? void 0 : block.kind) === "reportBuilderBlock");
    const finalDocument = mergeObject(generated, sourceDocument);
    const sourceBlocks = Array.isArray(sourceDocument.blocks) ? sourceDocument.blocks : [];
    let inserted = false;
    finalDocument.blocks = sourceBlocks.map((block) => {
      if ((block == null ? void 0 : block.kind) !== "reportBuilderBlock") return clone(block);
      inserted = true;
      return clone(generatedBlock);
    });
    if (!inserted) finalDocument.blocks.push(clone(generatedBlock));
    return finalDocument;
  }
  export function lower(envelopeJSON) {
    if (typeof envelopeJSON !== "string") throw new Error("Authored report input must be JSON text.");
    const envelope = JSON.parse(envelopeJSON);
    const document = authoredReportDocument(envelope);
    return JSON.stringify(lowerValidatedReportDocument(document));
  }
  export function lowerWithRequestBase(inputJSON) {
    const input = JSON.parse(inputJSON);
    const document = authoredReportDocument(input.envelope, input.requestBaseParameters);
    return JSON.stringify(lowerValidatedReportDocument(document));
  }
  export function materialize(inputJSON, stage) {
    stage?.("parse");
    const input = JSON.parse(inputJSON);
    if (!isObject(input.reportSpec) || input.reportSpec.kind !== "reportSpec" || !isObject(input.datasets)) throw new Error("Trusted reportSpec and executed datasets required.");
    stage?.("fill");
    const reportFill = buildReportFillFromReportSpec(input.reportSpec, input.datasets, {tablePresentations: input.tablePresentations});
    stage?.("print");
    const reportPrint = buildReportPrintFromReportFill({ reportSpec: input.reportSpec, reportFill });
    if (!reportPrint) throw new Error("Trusted report print materialization failed.");
    stage?.("serialize");
    const output = JSON.stringify({ reportFill, reportPrint });
    stage?.("done");
    return output;
  }

  // Interactive preview needs the fill model. Complete print/export keeps
  // using materialize on a fresh authorized execution.
  export function materializeFill(inputJSON, stage) {
    stage?.("parse");
    const input = JSON.parse(inputJSON);
    if (!isObject(input.reportSpec) || input.reportSpec.kind !== "reportSpec" || !isObject(input.datasets)) throw new Error("Trusted reportSpec and executed datasets required.");
    stage?.("fill");
    const reportFill = buildReportFillFromReportSpec(input.reportSpec, input.datasets, {tablePresentations: input.tablePresentations});
    stage?.("serialize");
    const output = JSON.stringify({ reportFill });
    stage?.("done");
    return output;
  }

export function present(inputJSON) {
 const input=JSON.parse(inputJSON);
 return JSON.stringify(applyReportChartSelections(input.reportSpec,input.chartMetricSelections));
}
export function prepareWindowBuilder(inputJSON) {
 return JSON.stringify(prepareWindowBuilderExport(JSON.parse(inputJSON)));
}
export function reportWindowIdentity(inputJSON) {
 const input = JSON.parse(inputJSON);
 return JSON.stringify(reportRequestWindowIdentity(input.config, input.windowParameters));
}
export function mapReportRequest(inputJSON) {
 const input = JSON.parse(inputJSON);
 return JSON.stringify(mapReportRequestEnvelope(input.config, input.query, input.datasetId));
}
globalThis.ForgeAuthoredLowerer = {lower, materialize, materializeFill, present, prepareWindowBuilder, reportWindowIdentity, mapReportRequest};
