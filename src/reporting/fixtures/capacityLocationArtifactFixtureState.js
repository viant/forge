import { buildCapacityLocationsTopMarketsLandscapeSavedReportRecord } from "./capacityPreviewSavedReportRecordBuilder.js";
import { buildSavedReportExportRequest } from "../reportExportRequestModel.js";
import {
  buildReportBuilderCreateReportDocumentPayload,
} from "../../components/dashboard/reportBuilderCreateReportDocumentPayload.js";
import {
  buildReportBuilderGetReportDocumentRequest,
} from "../../components/dashboard/reportBuilderGetReportDocumentRequest.js";
import {
  buildReportBuilderGetReportDocumentResponse,
  buildReportBuilderListReportDocumentsResponse,
} from "../../components/dashboard/reportBuilderReportDocumentReadResponse.js";
import {
  buildReportBuilderUpdateReportDocumentPayload,
} from "../../components/dashboard/reportBuilderUpdateReportDocumentPayload.js";

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function stripDocumentMetadata(payload = null) {
  const next = cloneValue(payload);
  if (next?.reportDocument && typeof next.reportDocument === "object" && !Array.isArray(next.reportDocument)) {
    delete next.reportDocument.semanticSummary;
    delete next.reportDocument.scope;
  }
  if (next?.document && typeof next.document === "object" && !Array.isArray(next.document)) {
    delete next.document.semanticSummary;
    delete next.document.scope;
  }
  return next;
}

function buildSavedReportRecord(savedReportPayload = null, exportRequest = null, {
  documentVersion = 0,
  savedAt = 0,
} = {}) {
  return {
    version: 1,
    kind: "reportBuilder.savedReportRecord",
    documentVersion,
    savedAt,
    savedReportPayload: cloneValue(savedReportPayload),
    ...(exportRequest ? { exportRequest: cloneValue(exportRequest) } : {}),
  };
}

export function buildCapacityLocationArtifactFixtureState() {
  const record = buildCapacityLocationsTopMarketsLandscapeSavedReportRecord();
  const savedReportPayload = cloneValue(record.savedReportPayload);
  const reportFill = cloneValue(record.reportFill);
  const pdfExportRequest = cloneValue(record.exportRequest);
  const pdfReportPrint = cloneValue(record?.exportRequest?.reportPrint || null);
  const compactExportRequest = buildSavedReportExportRequest({
    savedReportPayload,
    reportFill,
    documentVersion: record.documentVersion,
    format: "csv",
  });
  const savedReportRecord = buildSavedReportRecord(savedReportPayload, compactExportRequest, {
    documentVersion: record.documentVersion,
    savedAt: record.savedAt,
  });
  const getReportDocumentResponse = buildReportBuilderGetReportDocumentResponse(savedReportPayload, {
    documentVersion: record.documentVersion,
    savedAt: record.savedAt,
  });
  const listReportDocumentsResponse = buildReportBuilderListReportDocumentsResponse(savedReportPayload, {
    documentVersion: record.documentVersion,
    savedAt: record.savedAt,
  });
  const createReportDocumentPayload = buildReportBuilderCreateReportDocumentPayload(savedReportPayload, {
    createdAt: record.savedAt + 1,
  });
  const updateReportDocumentPayload = buildReportBuilderUpdateReportDocumentPayload(savedReportPayload, {
    expectedVersion: record.documentVersion,
    updatedAt: record.savedAt + 2,
  });
  const getReportDocumentRequest = buildReportBuilderGetReportDocumentRequest(listReportDocumentsResponse, {
    entryReportId: savedReportPayload?.reportDocument?.id || "",
  });

  const legacySavedReportPayload = stripDocumentMetadata(savedReportPayload);
  const legacyGetReportDocumentResponse = stripDocumentMetadata(getReportDocumentResponse);
  const legacySavedReportRecord = buildSavedReportRecord(legacySavedReportPayload, compactExportRequest, {
    documentVersion: record.documentVersion,
    savedAt: record.savedAt,
  });
  const legacyCreateReportDocumentPayload = stripDocumentMetadata(createReportDocumentPayload);
  const legacyUpdateReportDocumentPayload = stripDocumentMetadata(updateReportDocumentPayload);

  return {
    savedReportPayload,
    savedReportRecord,
    getReportDocumentResponse,
    listReportDocumentsResponse,
    createReportDocumentPayload,
    updateReportDocumentPayload,
    reportExportRequest: compactExportRequest,
    pdfReportExportRequest: pdfExportRequest,
    pdfReportPrint,
    getReportDocumentRequest,
    legacySavedReportPayload,
    legacyGetReportDocumentResponse,
    legacySavedReportRecord,
    legacyCreateReportDocumentPayload,
    legacyUpdateReportDocumentPayload,
  };
}
