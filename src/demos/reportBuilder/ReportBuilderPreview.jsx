import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card } from '@blueprintjs/core';
import { signal, useSignalEffect } from '@preact/signals-react';
import { useSignals } from '@preact/signals-react/runtime';

import { DashboardBlock } from '../../components/index.js';
import ReportBuilder from '../../components/dashboard/ReportBuilder.jsx';
import { buildReportBuilderCalculatedFieldConfig } from '../../components/dashboard/reportBuilderCalculatedFieldAuthoring.js';
import {
  loadStoredReportBuilderState,
  persistStoredReportBuilderState,
  resolveLegacyReportBuilderStateStorageScopes,
  resolveEffectiveReportBuilderState,
  reportBuilderStateStorageKey,
  resolveReportBuilderStateStorageScope,
} from '../../components/dashboard/reportBuilderPersistence.js';
import {
  resolveReportBuilderHydratedDocumentSessionFromState,
} from '../../components/dashboard/reportBuilderHydratedReportDocument.js';
import { mergeReportBuilderState } from '../../components/dashboard/reportBuilderUtils.js';
import { validateSemanticBinding } from '../../semantic/modelValidation.js';
import {
  applyPreviewSemanticValidationBehavior,
  persistPreviewSemanticValidationBehaviors,
} from './previewSemanticValidation.js';
import {
  applyPreviewSemanticModelBehavior,
  persistPreviewSemanticModelBehaviors,
} from './previewSemanticModel.js';
import {
  ensureReportBuilderPreviewMetrics,
  incrementReportBuilderPreviewMetric,
  recordReportBuilderPreviewObservation,
} from './previewMetrics.js';
import {
  attachPreviewRuntimeSurfaceApi,
  detachPreviewRuntimeSurfaceApi,
} from './previewRuntimeSurfaceApi.js';
import {
  buildPreviewHydratedRuntimeInteractionSnapshot,
  buildPreviewRuntimeInteractionFingerprint,
  buildPreviewRuntimeInteractionPersistedStateFromBuilderState,
  buildPreviewRuntimeInteractionSnapshot,
} from './previewRuntimeInteractionSession.js';
import { applyPreviewFetchBehavior } from './previewFetchBehaviors.js';
import { applyPreviewDetailTargetBehavior } from './previewDetailTargetBehaviors.js';
import { resolvePreviewRuntimeActions } from './previewRuntimeActionBehaviors.js';
import { buildPreviewAuthoredReport, buildPreviewAuthoredReportModel } from './previewAuthoredReport.js';
import { buildPreviewReportDocumentTemplates } from './previewReportDocumentTemplates.js';
import {
  normalizeReportBuilderDrillHierarchies,
} from '../../reporting/reportBuilderDrillHierarchy.js';
import { createReportBuilderDrillMetadataProvider } from '../../reporting/reportBuilderDrillMetadata.js';
import { runPreviewRuntimeRequest } from './previewRuntimeQuery.js';
import {
  buildReportRuntimePreviewRequestKey,
  useReportRuntimePreviewRows,
} from '../../components/dashboard/useReportRuntimePreviewRows.js';
import {
  useReportRuntimePreviewDatasetPayloads,
} from '../../components/dashboard/useReportRuntimePreviewDatasetPayloads.js';
import { useReportRuntimeInteractionState } from '../../components/dashboard/useReportRuntimeInteractionState.js';
import { useAuthoredRuntimePreviewSurface } from '../../components/dashboard/useAuthoredRuntimePreviewSurface.js';
import {
  buildReportBuilderSemanticModelReloadKey,
} from '../../components/dashboard/useReportBuilderSemanticModelState.js';
import { useReportBuilderSemanticRuntimeState } from '../../components/dashboard/useReportBuilderSemanticRuntimeState.js';
import { RAW_ROWS } from './previewDemoRows.js';
import {
  PREVIEW_LANDSCAPE_PAGE_GEOMETRY,
  buildPreviewSavedReportPayloadRecord,
} from './previewSavedReportPayload.js';
import { mergeReportBuilderReopenedConfig } from '../../components/dashboard/reportBuilderConfigMerge.js';
import { applyPreviewExportBehavior } from './previewExportBehaviors.js';

const DEMO_SEMANTIC_MODEL = {
  modelRef: 'model://steward/performance/ad_delivery@v1',
  version: 1,
  label: 'Ad Delivery',
  description: 'Governed reporting model for the report builder preview.',
  entities: [
    {
      id: 'line_delivery',
      label: 'Line Delivery',
      dimensions: [
        {
          id: 'event_date',
          label: 'Delivery Date',
          description: 'Daily delivery grain',
          dataType: 'date',
          format: 'date',
          governance: {
            status: 'approved',
            ownerRef: 'team://steward/performance',
          },
        },
        {
          id: 'channel',
          label: 'Channel',
          description: 'Approved buying channel',
          dataType: 'string',
          governance: {
            status: 'approved',
            certification: 'reviewed',
            ownerRef: 'team://steward/performance',
          },
        },
        {
          id: 'age_group',
          label: 'Audience Age Group',
          description: 'Curated age range bucket',
          dataType: 'string',
          governance: {
            status: 'draft',
            ownerRef: 'team://steward/performance',
          },
        },
        {
          id: 'country_code',
          label: 'Market',
          description: 'Delivery market',
          dataType: 'string',
          governance: {
            status: 'deprecated',
            ownerRef: 'team://steward/performance',
          },
        },
        {
          id: 'publisher',
          label: 'Publisher',
          description: 'Forecast inventory publisher grouping',
          dataType: 'string',
          governance: {
            status: 'approved',
            certification: 'reviewed',
            ownerRef: 'team://steward/performance',
          },
        },
        {
          id: 'site_type',
          label: 'Site Type',
          description: 'Forecast inventory site-type grouping',
          dataType: 'string',
          governance: {
            status: 'approved',
            ownerRef: 'team://steward/performance',
          },
        },
        {
          id: 'region',
          label: 'Region',
          description: 'Forecast geographic region grouping',
          dataType: 'string',
          governance: {
            status: 'approved',
            ownerRef: 'team://steward/performance',
          },
        },
        {
          id: 'metro_code',
          label: 'Metro Area',
          description: 'Forecast metropolitan area grouping',
          dataType: 'string',
          governance: {
            status: 'approved',
            ownerRef: 'team://steward/performance',
          },
        },
      ],
      measures: [
        {
          id: 'available_impressions',
          label: 'Available Impressions',
          description: 'Certified available inventory',
          format: 'compactNumber',
          dataType: 'number',
          aggregation: 'sum',
          governance: {
            status: 'approved',
            certification: 'certified',
            ownerRef: 'team://steward/performance',
          },
        },
        {
          id: 'household_uniques',
          label: 'Household Uniques',
          description: 'Approved household reach metric',
          format: 'compactNumber',
          dataType: 'number',
          aggregation: 'sum',
          governance: {
            status: 'approved',
            certification: 'reviewed',
            ownerRef: 'team://steward/performance',
          },
        },
      ],
    },
  ],
};

const DEMO_DRILL_HIERARCHIES = normalizeReportBuilderDrillHierarchies([
  {
    id: 'forecast_inventory',
    label: 'Forecast Inventory',
    levels: [
      { field: 'channelV2', label: 'Channel' },
      { field: 'publisher', label: 'Publisher' },
      { field: 'siteType', label: 'Site Type' },
    ],
  },
  {
    id: 'forecast_location',
    label: 'Forecast Location',
    levels: [
      { field: 'country', label: 'Market' },
      { field: 'region', label: 'Region' },
      { field: 'metrocode', label: 'Metro Area' },
    ],
  },
]);

function clonePreviewValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function semanticDiagnostics(errors = []) {
  return (Array.isArray(errors) ? errors : []).map((error) => ({
    code: error?.code || 'invalidSelection',
    severity: 'error',
    path: error?.field || '',
    message: error?.message || 'Semantic selection is invalid.',
  }));
}

function createDemoSemanticModelHandler({ drillMetadata = {} } = {}) {
  const configBackedDrillProvider = createReportBuilderDrillMetadataProvider(drillMetadata);
  const pendingModelRequests = new Map();

  async function resolveDemoSemanticModel(modelRef = '') {
    const metrics = ensurePreviewMetrics();
    if (metrics) {
      incrementReportBuilderPreviewMetric(metrics, 'getModelCount');
    }
    let behaviorResult = null;
    try {
      behaviorResult = await applyPreviewSemanticModelBehavior(metrics, modelRef);
    } finally {
      persistPreviewSemanticModelBehaviors(typeof window !== 'undefined' ? window.sessionStorage : null, metrics?.semanticModelBehaviors || []);
    }
    if (behaviorResult && typeof behaviorResult === 'object') {
      return clonePreviewValue(behaviorResult);
    }
    if (String(modelRef || '').trim() !== DEMO_SEMANTIC_MODEL.modelRef) {
      throw new Error(`Unknown semantic model '${modelRef}'.`);
    }
    return clonePreviewValue(DEMO_SEMANTIC_MODEL);
  }

  return {
    async listModels(namespace = '') {
      return {
        rows: [
          {
            modelRef: DEMO_SEMANTIC_MODEL.modelRef,
            label: DEMO_SEMANTIC_MODEL.label,
            version: DEMO_SEMANTIC_MODEL.version,
            namespace,
            status: 'active',
          },
        ],
        nextCursor: '',
      };
    },
    async getModel(modelRef = '') {
      const normalizedRef = String(modelRef || '').trim();
      if (!pendingModelRequests.has(normalizedRef)) {
        const request = resolveDemoSemanticModel(normalizedRef)
          .finally(() => {
            pendingModelRequests.delete(normalizedRef);
          });
        pendingModelRequests.set(normalizedRef, request);
      }
      return pendingModelRequests.get(normalizedRef)
        .then((payload) => clonePreviewValue(payload));
    },
    async validateSelection(modelRef = '', selection = {}) {
      const metrics = ensurePreviewMetrics();
      if (metrics) {
        incrementReportBuilderPreviewMetric(metrics, 'validateSelectionCount');
      }
      const normalizedRef = String(modelRef || '').trim();
      if (normalizedRef !== DEMO_SEMANTIC_MODEL.modelRef) {
        return {
          valid: false,
          normalizedSelection: null,
          diagnostics: [{
            code: 'unknownModel',
            severity: 'error',
            path: 'selection.modelRef',
            message: `Unknown semantic model '${modelRef}'.`,
          }],
        };
      }
      let behaviorResult = null;
      try {
        behaviorResult = await applyPreviewSemanticValidationBehavior(metrics, normalizedRef, selection);
      } finally {
        persistPreviewSemanticValidationBehaviors(typeof window !== 'undefined' ? window.sessionStorage : null, metrics?.semanticValidationBehaviors || []);
      }
      if (behaviorResult) {
        return behaviorResult;
      }
      const validation = validateSemanticBinding({
        mode: 'semantic',
        modelRef: normalizedRef,
        entity: selection?.entity,
        selectedDimensions: selection?.dimensions,
        selectedMeasures: selection?.measures,
      }, DEMO_SEMANTIC_MODEL);
      if (validation.valid) {
        const dimensions = validation.normalizedBinding?.selectedDimensions || [];
        const measures = validation.normalizedBinding?.selectedMeasures || [];
        if (dimensions.includes('age_group') && measures.includes('household_uniques')) {
          const ageGroupIndex = dimensions.indexOf('age_group');
          const householdUniquesIndex = measures.indexOf('household_uniques');
          return {
            valid: false,
            normalizedSelection: {
              entity: validation.normalizedBinding.entity,
              dimensions,
              measures,
            },
            diagnostics: [
              ...(ageGroupIndex >= 0 ? [{
                code: 'unsupportedBreakdown',
                severity: 'error',
                path: `selection.dimensions[${ageGroupIndex}]`,
                message: 'Audience Age Group is not supported for this semantic selection in the demo provider.',
                suggestedFix: 'Remove Audience Age Group or choose a different breakdown to continue.',
              }] : []),
              ...(householdUniquesIndex >= 0 ? [{
                code: 'unsupportedMeasure',
                severity: 'error',
                path: `selection.measures[${householdUniquesIndex}]`,
                message: 'Household Uniques cannot be combined with Audience Age Group in this demo semantic provider.',
                suggestedFix: 'Remove Household Uniques or switch to Available Impressions to continue.',
              }] : []),
            ],
          };
        }
      }
      return {
        valid: validation.valid,
        normalizedSelection: validation.normalizedBinding
          ? {
            entity: validation.normalizedBinding.entity,
            dimensions: validation.normalizedBinding.selectedDimensions,
            measures: validation.normalizedBinding.selectedMeasures,
          }
          : null,
        diagnostics: semanticDiagnostics(validation.errors),
      };
    },
    async getDrillHierarchy(fieldRef = '') {
      return configBackedDrillProvider.getDrillHierarchy(fieldRef);
    },
    async getDetailTarget(targetRef = '') {
      const metrics = ensurePreviewMetrics();
      const overridden = await applyPreviewDetailTargetBehavior(metrics, {
        targetRef,
      });
      if (overridden !== undefined) {
        return overridden;
      }
      return configBackedDrillProvider.getDetailTarget(targetRef);
    },
    async listAvailableRefinements(_blockKind = '', fieldRef = '') {
      const fallbackActions = await configBackedDrillProvider.listAvailableRefinements(_blockKind, fieldRef);
      const metrics = ensurePreviewMetrics();
      return resolvePreviewRuntimeActions(metrics, _blockKind, fieldRef, fallbackActions);
    },
  };
}

async function validateDemoSemanticRequest(request = {}, semanticModelHandler = null) {
  const semanticSelection = request?.semanticSelection;
  if (!semanticSelection || !semanticModelHandler) {
    return null;
  }
  const unmappedDimensions = semanticSelection?.unmapped?.dimensions || [];
  const unmappedMeasures = semanticSelection?.unmapped?.measures || [];
  if (unmappedDimensions.length > 0 || unmappedMeasures.length > 0) {
    throw new Error([
      unmappedDimensions.length > 0 ? `Unmapped semantic dimensions: ${unmappedDimensions.join(', ')}` : '',
      unmappedMeasures.length > 0 ? `Unmapped semantic measures: ${unmappedMeasures.join(', ')}` : '',
    ].filter(Boolean).join(' • '));
  }
  const result = await semanticModelHandler.validateSelection(semanticSelection.modelRef, {
    entity: semanticSelection.entity,
    dimensions: semanticSelection?.selection?.dimensions || [],
    measures: semanticSelection?.selection?.measures || [],
    parameters: semanticSelection?.parameters || {},
  });
  if (result?.valid) {
    return result;
  }
  const first = Array.isArray(result?.diagnostics) ? result.diagnostics[0] : null;
  throw new Error(first?.message || 'Semantic selection is invalid.');
}

function ensurePreviewMetrics() {
  return ensureReportBuilderPreviewMetrics(
    typeof window !== 'undefined' ? window : null,
    { storage: typeof window !== 'undefined' ? window.sessionStorage : null },
  );
}

function createDemoContext() {
  const collection = signal([]);
  const control = signal({ loading: false, error: null });
  const windowForm = signal({});
  const collectionInfo = signal({ hasMore: false });
  const input = signal({ parameters: {} });
  const exportJobs = new Map();
  const exportArtifacts = new Map();
  let exportSequence = 0;
  const ctx = {
    locale: 'en-US',
    identity: {
      dataSourceRef: 'demoReportSource',
      dataSourceId: 'demoReportSource',
      windowId: 'demoReportBuilderWindow',
    },
    signals: {
      collection,
      control,
      windowForm,
      collectionInfo,
      input,
    },
  };
  const semanticModel = createDemoSemanticModelHandler({
    drillMetadata: container?.dashboard?.reportBuilder?.drillMetadata || {},
  });

  const fetchCollection = async () => {
    const metrics = ensurePreviewMetrics();
    if (metrics) {
      incrementReportBuilderPreviewMetric(metrics, 'fetchCollectionCount');
    }
    const request = input.peek()?.parameters || {};
    control.value = { loading: true, error: null };
    try {
      await validateDemoSemanticRequest(request, semanticModel);
      const { rows, hasMore } = runPreviewRuntimeRequest(RAW_ROWS, request, container?.dashboard?.reportBuilder || {});
      collection.value = rows;
      collectionInfo.value = { hasMore };
      control.value = { loading: false, error: null };
    } catch (error) {
      collection.value = [];
      collectionInfo.value = { hasMore: false };
      control.value = { loading: false, error };
    }
  };

  ctx.handlers = {
    semanticModel,
    reportExport: {
      async submitRequest({ request, source } = {}) {
        const metrics = ensurePreviewMetrics();
        const normalizedSource = String(request?.source?.from || source || '').trim();
        const formatName = String(request?.target?.format || 'export').trim().toLowerCase() || 'export';
        const title = String(request?.source?.title || request?.reportSpec?.title || 'Report').trim() || 'Report';
        const artifactRef = String(request?.source?.artifactRef || '').trim();
        const overridden = await applyPreviewExportBehavior(metrics, {
          phase: 'submit',
          source: normalizedSource,
          format: formatName,
          artifactRef,
          title,
        });
        if (overridden) {
          return overridden;
        }
        exportSequence += 1;
        const jobId = `demo-export-job-${exportSequence}`;
        const artifactId = `demo-export-artifact-${exportSequence}`;
        exportJobs.set(jobId, {
          jobId,
          status: 'queued',
          artifactId,
          artifactRef,
          format: formatName,
          scope: normalizedSource,
          title,
          pollCount: 0,
        });
        const pdfBytes = new TextEncoder().encode(`%PDF-demo ${title}`);
        exportArtifacts.set(artifactId, {
          artifactId,
          jobId,
          artifactRef: String(request?.source?.artifactRef || '').trim(),
          format: formatName,
          contentType: formatName === 'pdf' ? 'application/pdf' : 'application/octet-stream',
          bytes: pdfBytes,
        });
        if (metrics) {
          incrementReportBuilderPreviewMetric(metrics, 'exportRequestCount');
          const exportRecord = {
            source: String(source || '').trim(),
            scope: normalizedSource,
            format: formatName,
            artifactRef,
            title,
            jobId,
            artifactId,
          };
          metrics.lastExportRequest = exportRecord;
          metrics.exportRequestHistory = [
            ...(Array.isArray(metrics.exportRequestHistory) ? metrics.exportRequestHistory : []),
            exportRecord,
          ];
        }
        return {
          ok: true,
          jobId,
          status: 'queued',
          artifactId: '',
          artifactRef,
          format: formatName,
          message: `Accepted ${formatName.toUpperCase()} export for ${title}.`,
        };
      },
      async getStatus({ jobId } = {}) {
        const metrics = ensurePreviewMetrics();
        const normalizedJobId = String(jobId || '').trim();
        const overridden = await applyPreviewExportBehavior(metrics, {
          phase: 'status',
          jobId: normalizedJobId,
        });
        if (overridden) {
          return overridden;
        }
        const job = exportJobs.get(normalizedJobId);
        if (!job) {
          throw new Error(`Unknown export job ${normalizedJobId}.`);
        }
        const nextPollCount = Number(job.pollCount || 0) + 1;
        const nextStatus = nextPollCount > 1 ? 'succeeded' : 'queued';
        const nextJob = {
          ...job,
          pollCount: nextPollCount,
          status: nextStatus,
        };
        exportJobs.set(normalizedJobId, nextJob);
        if (metrics) {
          metrics.lastExportStatus = {
            jobId: normalizedJobId,
            status: nextStatus,
          };
        }
        return {
          jobId: normalizedJobId,
          status: nextStatus,
          artifactId: nextStatus === 'succeeded' ? nextJob.artifactId : '',
          artifactRef: nextJob.artifactRef,
          format: nextJob.format,
        };
      },
      async getArtifact({ artifactId } = {}) {
        const normalizedArtifactId = String(artifactId || '').trim();
        const overridden = await applyPreviewExportBehavior(ensurePreviewMetrics(), {
          phase: 'artifact',
          artifactId: normalizedArtifactId,
        });
        if (overridden) {
          return overridden;
        }
        const artifact = exportArtifacts.get(normalizedArtifactId);
        if (!artifact) {
          throw new Error(`Unknown export artifact ${normalizedArtifactId}.`);
        }
        return {
          artifactId: artifact.artifactId,
          jobId: artifact.jobId,
          artifactRef: artifact.artifactRef,
          format: artifact.format,
          contentType: artifact.contentType,
          bytes: artifact.bytes,
        };
      },
    },
    dataSource: {
      setWindowFormData({ values }) {
        windowForm.value = {
          ...windowForm.peek(),
          ...(values || {}),
        };
      },
      setInputParameters(request) {
        input.value = {
          ...input.peek(),
          parameters: request,
        };
      },
      async fetchRecords({ parameters, requestKind } = {}) {
        const metrics = ensurePreviewMetrics();
        if (metrics) {
          incrementReportBuilderPreviewMetric(metrics, 'fetchRecordsCount');
        }
        const requestFingerprint = JSON.stringify(parameters || {});
        const requestKey = `${requestFingerprint}::${Number(metrics?.fetchRecordsCount || 0)}`;
        const requestType = requestKind || 'chartQuery';
        try {
          await validateDemoSemanticRequest(parameters || {}, semanticModel);
          if (metrics) {
            const requestMeta = {
              type: requestType,
              requestFingerprint,
              requestKey,
            };
            metrics.lastFetchRequest = requestMeta;
            metrics.fetchRequestHistory = [
              ...(Array.isArray(metrics.fetchRequestHistory) ? metrics.fetchRequestHistory : []),
              requestMeta,
            ];
            metrics.fetchEventHistory = [
              ...(Array.isArray(metrics.fetchEventHistory) ? metrics.fetchEventHistory : []),
              {
                ...requestMeta,
                phase: 'start',
              },
            ];
          }
          const overridden = await applyPreviewFetchBehavior(metrics, {
            type: requestType,
            requestFingerprint,
            requestKey,
          });
          if (overridden) {
            if (metrics) {
              metrics.fetchEventHistory = [
                ...(Array.isArray(metrics.fetchEventHistory) ? metrics.fetchEventHistory : []),
                {
                  type: requestType,
                  requestFingerprint,
                  requestKey,
                  phase: 'success',
                  rowCount: Array.isArray(overridden.rows) ? overridden.rows.length : 0,
                  hasMore: overridden.hasMore === true,
                },
              ];
            }
            return overridden;
          }
          const { rows, hasMore } = runPreviewRuntimeRequest(RAW_ROWS, parameters || {}, container?.dashboard?.reportBuilder || {});
          if (metrics) {
            metrics.fetchEventHistory = [
              ...(Array.isArray(metrics.fetchEventHistory) ? metrics.fetchEventHistory : []),
              {
                type: requestType,
                requestFingerprint,
                requestKey,
                phase: 'success',
                rowCount: Array.isArray(rows) ? rows.length : 0,
                hasMore: hasMore === true,
              },
            ];
          }
          return { rows, hasMore };
        } catch (error) {
          if (metrics) {
            metrics.fetchEventHistory = [
              ...(Array.isArray(metrics.fetchEventHistory) ? metrics.fetchEventHistory : []),
              {
                type: requestType,
                requestFingerprint,
                requestKey,
                phase: 'error',
                message: String(error?.message || error || '').trim(),
              },
            ];
          }
          throw error;
        }
      },
      fetchCollection,
    },
  };
  ctx.Context = () => ctx;
  return ctx;
}

const container = {
  id: 'demoReportBuilder',
  stateKey: 'demoReportBuilder',
  title: 'Report Builder Demo',
  kind: 'dashboard.reportBuilder',
  dataSourceRef: 'demoReportSource',
  dashboard: {
    reportBuilder: {
      filterPresentation: 'rail-left',
      binding: {
        mode: 'semantic',
        modelRef: DEMO_SEMANTIC_MODEL.modelRef,
        entity: 'line_delivery',
        selectedDimensions: ['event_date', 'channel'],
        selectedMeasures: ['available_impressions', 'household_uniques'],
      },
      measures: [
        { id: 'avails', key: 'avails', semanticRef: 'available_impressions', label: 'Avails', format: 'compactNumber', default: true, color: '#2f6de1' },
        { id: 'hhUniqs', key: 'hhUniqs', semanticRef: 'household_uniques', label: 'HH Uniques', format: 'compactNumber', default: true, color: '#13a36f' },
      ],
      computedMeasures: [
        {
          id: 'reachRate',
          key: 'reachRate',
          label: 'Reach Rate',
          format: 'percent',
          compute: {
            type: 'ratio',
            numerator: 'hhUniqs',
            denominator: 'avails',
            scale: 100,
            decimals: 2,
          },
        },
      ],
      tableCalculations: [
        {
          id: 'reachShare',
          key: 'reachShare',
          label: 'Reach Share',
          format: 'percent',
          compute: {
            type: 'percentOfTotal',
            sourceField: 'hhUniqs',
            scale: 100,
            decimals: 1,
          },
        },
        {
          id: 'reachRank',
          key: 'reachRank',
          label: 'Reach Rank',
          format: 'number',
          compute: {
            type: 'rank',
            sourceField: 'hhUniqs',
            orderBy: [
              { field: 'hhUniqs', direction: 'desc' },
              { field: 'country', direction: 'asc' },
              { field: 'channelV2', direction: 'asc' },
              { field: 'eventDate', direction: 'asc' },
            ],
          },
        },
      ],
      dimensions: [
        { id: 'eventDate', key: 'eventDate', semanticRef: 'event_date', label: 'Date', chartAxis: true, default: true },
        {
          id: 'channelV2',
          key: 'channelV2',
          semanticRef: 'channel',
          label: 'Channel',
          default: true,
          runtimeFilter: {
            includeParamPath: 'filters.includeChannelV2',
            excludeParamPath: 'filters.excludeChannelV2',
          },
        },
        { id: 'agegroupId', key: 'agegroupId', semanticRef: 'age_group', label: 'Age Group', default: true },
        {
          id: 'country',
          key: 'country',
          semanticRef: 'country_code',
          label: 'Country',
          runtimeFilter: {
            includeParamPath: 'filters.includeCountry',
            excludeParamPath: 'filters.excludeCountry',
          },
        },
        {
          id: 'siteType',
          key: 'siteType',
          semanticRef: 'site_type',
          label: 'Site Type',
          runtimeFilter: {
            includeParamPath: 'filters.includeSiteType',
            excludeParamPath: 'filters.excludeSiteType',
          },
        },
        {
          id: 'publisher',
          key: 'publisher',
          semanticRef: 'publisher',
          label: 'Publisher',
          runtimeFilter: {
            includeParamPath: 'filters.includePublisher',
            excludeParamPath: 'filters.excludePublisher',
          },
        },
        { id: 'advertiser', key: 'advertiser', label: 'Advertiser' },
        { id: 'campaign', key: 'campaign', label: 'Campaign' },
        { id: 'adOrder', key: 'adOrder', label: 'Ad Order' },
        { id: 'audience', key: 'audience', label: 'Audience' },
        { id: 'deal', key: 'deal', label: 'Deal' },
        { id: 'deviceType', key: 'deviceType', label: 'Device Type' },
        {
          id: 'region',
          key: 'region',
          semanticRef: 'region',
          label: 'Region',
          runtimeFilter: {
            includeParamPath: 'filters.includeLocationDim',
            excludeParamPath: 'filters.excludeLocationDim',
            format: 'locationTuple',
            parentField: 'country',
          },
        },
        {
          id: 'metrocode',
          key: 'metrocode',
          semanticRef: 'metro_code',
          label: 'Metro Area',
          runtimeFilter: {
            includeParamPath: 'filters.includeMetrocode',
            excludeParamPath: 'filters.excludeMetrocode',
          },
        },
      ],
      drillMetadata: {
        hierarchies: DEMO_DRILL_HIERARCHIES,
        fieldActions: [
          {
            fieldRef: 'eventDate',
            actions: [
              { id: 'detail_date', label: 'Show date details', kind: 'detail', targetRef: 'target://steward/performance/date-detail' },
            ],
          },
          {
            fieldRef: 'channelV2',
            actions: [
              { id: 'drill_market', label: 'Drill to Market', kind: 'drill', nextFieldRef: 'country' },
              { id: 'detail_channel', label: 'Show channel details', kind: 'detail', targetRef: 'target://steward/performance/channel-detail' },
            ],
          },
          {
            fieldRef: 'country',
            actions: [
              { id: 'detail_market', label: 'Show market details', kind: 'detail', targetRef: 'target://steward/performance/market-detail' },
            ],
          },
        ],
        detailTargets: [
          {
            targetRef: 'target://steward/performance/channel-detail',
            navigationMode: 'hostRoute',
            parameters: {
              channel: '$value',
              campaign: '$row.campaign',
            },
          },
          {
            targetRef: 'target://steward/performance/date-detail',
            navigationMode: 'hostRoute',
            parameters: {
              eventDate: '$value',
            },
          },
          {
            targetRef: 'target://steward/performance/market-detail',
            navigationMode: 'hostRoute',
            parameters: {
              country: '$value',
            },
          },
        ],
      },
      groupBy: {
        options: [
          { value: 'channelV2', dimensionId: 'channelV2', label: 'Channel' },
          { value: 'agegroupId', dimensionId: 'agegroupId', label: 'Audience Age Group' },
          { value: 'country', dimensionId: 'country', label: 'Market' },
          { value: 'region', dimensionId: 'region', label: 'Region' },
          { value: 'publisher', dimensionId: 'publisher', label: 'Publisher' },
        ],
      },
      staticFilters: [
        {
          id: 'dateRange',
          label: 'Date Range',
          type: 'dateRange',
          required: true,
          default: { start: '2026-05-01', end: '2026-05-04' },
          startParamPath: 'filters.from',
          endParamPath: 'filters.to',
        },
        {
          id: 'channelsFilter',
          label: 'Channels',
          multiple: true,
          options: [
            { label: 'Display', value: 'Display' },
            { label: 'CTV', value: 'CTV' },
          ],
        },
        {
          id: 'scopeFilter',
          label: 'Scope',
          multiple: true,
          options: [
            { label: 'National', value: 'national' },
            { label: 'Regional', value: 'regional' },
            { label: 'Local', value: 'local' },
          ],
        },
        {
          id: 'inventoryFilter',
          label: 'Inventory',
          multiple: true,
          options: [
            { label: 'Premium', value: 'premium' },
            { label: 'Open Exchange', value: 'open' },
          ],
        },
        {
          id: 'targetingFilter',
          label: 'Targeting',
          multiple: true,
          options: [
            { label: 'Contextual', value: 'contextual' },
            { label: 'Audience', value: 'audience' },
            { label: 'Geo', value: 'geo' },
          ],
        },
        {
          id: 'publisherFilter',
          label: 'Publisher',
          multiple: true,
          options: [
            { label: 'Acme Media', value: 'Acme Media' },
            { label: 'North Star Media', value: 'North Star Media' },
          ],
        },
        {
          id: 'advertiserFilter',
          label: 'Advertiser',
          multiple: true,
          options: [
            { label: 'Northwind Health', value: 'Northwind Health' },
            { label: 'Maple Retail', value: 'Maple Retail' },
          ],
        },
        {
          id: 'campaignFilter',
          label: 'Campaign',
          multiple: true,
          options: [
            { label: 'Prospect Sprint', value: 'Prospect Sprint' },
            { label: 'Family Reach', value: 'Family Reach' },
          ],
        },
        {
          id: 'deviceFilter',
          label: 'Device',
          multiple: true,
          options: [
            { label: 'Mobile', value: 'Mobile' },
            { label: 'CTV', value: 'CTV' },
          ],
        },
      ],
      reportDocumentTemplates: buildPreviewReportDocumentTemplates(),
      dataSources: [
        {
          id: "forecast_country_snapshot",
          dataSourceRef: "forecastCountrySnapshotSource",
          label: "Forecast Country Snapshot",
          description: "Published country-level snapshot for comparing avails and household uniques by market.",
          kindLabel: "published",
          scope: {
            inheritContext: true,
          },
          request: {
            measures: {
              avails: true,
              hhUniqs: true,
            },
            dimensions: {
              country: true,
            },
            filters: {},
            limit: 25,
            offset: 0,
            orderBy: ["avails desc"],
          },
          capabilities: {
            preview: true,
            export: true,
            backendRefetch: true,
            fieldCatalog: true,
          },
          columnOptions: [
            { key: "country", label: "Country", kind: "dimension" },
            { key: "avails", label: "Avails", kind: "measure", format: "compactNumber", align: "right" },
            { key: "hhUniqs", label: "HH Uniques", kind: "measure", format: "compactNumber", align: "right" },
          ],
          valueFieldOptions: [
            { value: "avails", label: "Avails", format: "compactNumber" },
            { value: "hhUniqs", label: "HH Uniques", format: "compactNumber" },
          ],
          secondaryFieldOptions: [
            { value: "country", label: "Country" },
          ],
        },
      ],
      result: {
        showResultHeader: true,
        chartCreationMode: 'explicit',
        autoApplyDefaultChartOnResult: true,
        defaultMode: 'table',
        viewModes: ['table', 'chart'],
        chartDataMode: 'fullQuery',
        chartRowLimit: 1000,
        quickPresets: {
          autoFetchOnSelect: true,
          selectionPolicy: 'replace',
        },
        defaultTablePresets: [
          {
            title: 'Inventory Ladder',
            group: 'Forecasting Ladders',
            groupDescription: 'Forecast-first tables that start at the governed top level and drill deeper through authored runtime actions.',
            eyebrow: 'Forecast Inventory',
            accentTone: 'delivery',
            highlights: ['3-Level Drill', 'Channel First', 'Publisher -> Site Type'],
            description: 'Channel-first forecasting preset with authored drill actions through Publisher and Site Type.',
            dimensions: ['channelV2'],
            measures: ['avails', 'hhUniqs', 'reachRate'],
            columns: [
              {
                key: 'channelV2',
                label: 'Channel',
                cellVisual: {
                  kind: 'badge',
                  rules: [
                    { value: 'Display', tone: 'info', label: 'Display' },
                    { value: 'CTV', tone: 'success', label: 'CTV' },
                  ],
                },
              },
              {
                key: 'avails',
                label: 'Avails',
                format: 'compactNumber',
                cellVisual: {
                  kind: 'dataBar',
                  valueField: 'avails',
                  range: { mode: 'columnMax' },
                  palette: ['#dbeafe', '#2563eb'],
                },
              },
              {
                key: 'hhUniqs',
                label: 'HH Uniques',
                format: 'compactNumber',
                cellVisual: {
                  kind: 'dataBar',
                  valueField: 'hhUniqs',
                  range: { mode: 'columnMax' },
                  palette: ['#dcfce7', '#16a34a'],
                },
              },
              {
                key: 'reachRate',
                label: 'Reach Rate',
                format: 'percent',
                cellVisual: {
                  kind: 'dataBar',
                  valueField: 'reachRate',
                  range: { min: 0, max: 100 },
                  palette: ['#dbeafe', '#1d4ed8'],
                },
              },
            ],
            primaryMeasure: 'avails',
            orderField: 'avails',
            orderDir: 'desc',
            pageSize: 12,
            clearChart: true,
          },
          {
            title: 'Location Ladder',
            group: 'Forecasting Ladders',
            groupDescription: 'Forecast-first tables that start at the governed top level and drill deeper through authored runtime actions.',
            eyebrow: 'Forecast Location',
            accentTone: 'household',
            highlights: ['3-Level Drill', 'Market First', 'Region -> Metro Area'],
            description: 'Market-first forecasting preset with authored drill actions through Region and Metro Area.',
            dimensions: ['country'],
            measures: ['avails', 'hhUniqs', 'reachRate'],
            columns: [
              { key: 'country', label: 'Market' },
              {
                key: 'avails',
                label: 'Avails',
                format: 'compactNumber',
                cellVisual: {
                  kind: 'dataBar',
                  valueField: 'avails',
                  range: { mode: 'columnMax' },
                  palette: ['#dcfce7', '#16a34a'],
                },
              },
              {
                key: 'hhUniqs',
                label: 'HH Uniques',
                format: 'compactNumber',
                cellVisual: {
                  kind: 'dataBar',
                  valueField: 'hhUniqs',
                  range: { mode: 'columnMax' },
                  palette: ['#bbf7d0', '#15803d'],
                },
              },
              {
                key: 'reachRate',
                label: 'Reach Rate',
                format: 'percent',
                cellVisual: {
                  kind: 'dataBar',
                  valueField: 'reachRate',
                  range: { min: 0, max: 100 },
                  palette: ['#d1fae5', '#0f766e'],
                },
              },
            ],
            primaryMeasure: 'avails',
            orderField: 'avails',
            orderDir: 'desc',
            pageSize: 12,
            clearChart: true,
          },
          {
            title: 'Delivery Grid',
            group: 'Tables',
            groupDescription: 'Table-first grids for export-ready delivery and reach reporting.',
            eyebrow: 'Metrics Panel',
            accentTone: 'delivery',
            highlights: ['Selected Dates', 'Market Context', 'Export Ready'],
            description: 'Table-first delivery preset with market context, descending avails sort, and export-ready columns.',
            dimensions: ['eventDate', 'channelV2', 'country'],
            measures: ['avails', 'hhUniqs'],
            columns: [
              { key: 'eventDate', label: 'Date' },
              {
                key: 'channelV2',
                label: 'Channel',
                cellVisual: {
                  kind: 'badge',
                  rules: [
                    { value: 'Display', tone: 'info', label: 'Display' },
                    { value: 'CTV', tone: 'success', label: 'CTV' },
                  ],
                },
              },
              { key: 'country', label: 'Market' },
              {
                key: 'avails',
                label: 'Avails',
                format: 'compactNumber',
                cellVisual: {
                  kind: 'dataBar',
                  valueField: 'avails',
                  range: { mode: 'columnMax' },
                  palette: ['#dbeafe', '#2563eb'],
                },
              },
              {
                key: 'hhUniqs',
                label: 'HH Uniques',
                format: 'compactNumber',
                cellVisual: {
                  kind: 'dataBar',
                  valueField: 'hhUniqs',
                  range: { mode: 'columnMax' },
                  palette: ['#dcfce7', '#16a34a'],
                },
              },
            ],
            orderField: 'avails',
            orderDir: 'desc',
            pageSize: 25,
            clearChart: true,
          },
          {
            title: 'Reach Grid',
            group: 'Tables',
            groupDescription: 'Table-first grids for export-ready delivery and reach reporting.',
            eyebrow: 'Household Metrics',
            accentTone: 'household',
            highlights: ['Reach Priority', 'Market Rollup', 'Export Ready'],
            description: 'Household-first delivery preset with leaderboard context, reach share, and export-ready metric bars.',
            dimensions: ['country', 'channelV2', 'eventDate'],
            measures: ['reachRank', 'hhUniqs', 'reachShare'],
            columns: [
              { key: 'country', label: 'Market' },
              {
                key: 'channelV2',
                label: 'Channel',
                cellVisual: {
                  kind: 'badge',
                  rules: [
                    { value: 'Display', tone: 'info', label: 'Display' },
                    { value: 'CTV', tone: 'success', label: 'CTV' },
                  ],
                },
              },
              { key: 'eventDate', label: 'Date' },
              { key: 'reachRank', label: 'Reach Rank', align: 'center' },
              {
                key: 'hhUniqs',
                label: 'HH Uniques',
                format: 'compactNumber',
                cellVisual: {
                  kind: 'dataBar',
                  valueField: 'hhUniqs',
                  range: { mode: 'columnMax' },
                  palette: ['#dcfce7', '#16a34a'],
                },
              },
              {
                key: 'reachShare',
                label: 'Reach Share',
                format: 'percent',
                cellVisual: {
                  kind: 'dataBar',
                  valueField: 'reachShare',
                  range: { min: 0, max: 100 },
                  palette: ['#d1fae5', '#0f766e'],
                },
              },
            ],
            primaryMeasure: 'hhUniqs',
            orderField: 'hhUniqs',
            orderDir: 'desc',
            pageSize: 20,
            clearChart: true,
          },
        ],
        chartWizard: {
          supportedTypes: ['line', 'bar', 'area', 'pie', 'donut', 'horizontal_bar', 'funnel_bar'],
        },
        defaultChartSpecs: [
          {
            title: 'Avails by Date',
            type: 'line',
            xField: 'eventDate',
            yFields: ['avails'],
          },
          {
            title: 'Avails + HH Uniques by Date',
            group: 'KPI Blends',
            groupDescription: 'Blended KPI charts for volume and reach comparisons.',
            eyebrow: 'KPI Blend',
            accentTone: 'household',
            highlights: ['Dual Axis', 'Reach + Volume', 'Full Query'],
            type: 'bar',
            xField: 'eventDate',
            yFields: ['avails', 'hhUniqs'],
            seriesOptions: {
              avails: { type: 'bar', axis: 'left', stackId: 'reach' },
              hhUniqs: { type: 'line', axis: 'right' },
            },
          },
          {
            title: 'Reach Rate by Date',
            group: 'KPI Blends',
            groupDescription: 'Blended KPI charts for volume and reach comparisons.',
            eyebrow: 'Efficiency View',
            accentTone: 'household',
            highlights: ['Derived Metric', 'Trend View', 'Full Query'],
            type: 'line',
            xField: 'eventDate',
            yFields: ['reachRate'],
          },
          {
            title: 'Avails by Date and Channel',
            group: 'Chart Stories',
            groupDescription: 'Narrative story charts for split trends and channel movement.',
            eyebrow: 'Visual Story',
            accentTone: 'delivery',
            highlights: ['Split by Channel', 'Trend View', 'Full Query'],
            type: 'area',
            xField: 'eventDate',
            yFields: ['avails'],
            seriesField: 'channelV2',
          },
          {
            title: 'Avails by Channel',
            type: 'pie',
            xField: 'channelV2',
            yFields: ['avails'],
          },
          {
            title: 'Inventory · Top Channels',
            group: 'Inventory',
            groupDescription: 'Forecast-first visual presets that stay aligned with authored runtime drill ladders.',
            eyebrow: 'Forecast Inventory',
            accentTone: 'delivery',
            highlights: ['3-Level Drill', 'Channel First', 'Publisher -> Site Type'],
            type: 'horizontal_bar',
            xField: 'channelV2',
            yFields: ['avails'],
          },
          {
            title: 'HH Uniques by Country',
            type: 'donut',
            xField: 'country',
            yFields: ['hhUniqs'],
          },
          {
            title: 'Locations · Top Markets',
            group: 'Location',
            groupDescription: 'Forecast-first visual presets that stay aligned with authored runtime drill ladders.',
            eyebrow: 'Forecast Location',
            accentTone: 'household',
            highlights: ['3-Level Drill', 'Market First', 'Region -> Metro Area'],
            type: 'horizontal_bar',
            xField: 'country',
            yFields: ['avails'],
          },
          {
            title: 'Avails by Age Group',
            type: 'horizontal_bar',
            xField: 'agegroupId',
            yFields: ['avails', 'hhUniqs'],
          },
          {
            title: 'Avails Funnel by Channel',
            type: 'funnel_bar',
            xField: 'channelV2',
            yFields: ['avails'],
          },
        ],
        pageSize: 50,
        orderFields: [
          { value: 'eventDate', field: 'eventDate', default: true, defaultDirection: 'asc' },
          { value: 'avails', field: 'avails', defaultDirection: 'desc' },
          { value: 'hhUniqs', field: 'hhUniqs', defaultDirection: 'desc' },
        ],
      },
      request: {
        autoFetch: true,
        limit: 50,
      },
      reportDocumentListEntries: [
        {
          reportRef: { reportId: 'forecastingArchive' },
          documentVersion: 7,
          title: 'Forecasting Archive',
          subtitle: 'Historical Snapshot',
          description: 'Archived report entry used for reopen compatibility diagnostics.',
          source: {
            kind: 'dashboard.reportBuilder',
            containerId: 'forecastingArchive',
            stateKey: 'forecastingArchive',
            dataSourceRef: 'forecastArchiveSource',
          },
        },
      ],
    },
  },
};

container.dashboard.reportBuilder.reportDocumentSavedPayloads = [
  buildPreviewSavedReportPayloadRecord({
    container,
    reportBuilderConfig: container?.dashboard?.reportBuilder || {},
    rows: RAW_ROWS,
    semanticModel: DEMO_SEMANTIC_MODEL,
    reportId: 'forecastingQ3',
    title: 'Forecasting Q3',
    templateId: 'forecast_inventory_brief',
    presetTitle: 'Inventory Ladder',
    documentVersion: 4,
    artifactId: 'forecasting_q3_inventory_ladder',
    savedAt: 9100,
    pageGeometry: PREVIEW_LANDSCAPE_PAGE_GEOMETRY,
  }),
  buildPreviewSavedReportPayloadRecord({
    container,
    reportBuilderConfig: container?.dashboard?.reportBuilder || {},
    rows: RAW_ROWS,
    semanticModel: DEMO_SEMANTIC_MODEL,
    reportId: 'forecastingLocationQ3',
    title: 'Forecasting Location Q3',
    templateId: 'forecast_location_brief',
    presetTitle: 'Location Ladder',
    documentVersion: 5,
    artifactId: 'forecasting_q3_location_ladder',
    savedAt: 9200,
    pageGeometry: PREVIEW_LANDSCAPE_PAGE_GEOMETRY,
  }),
  buildPreviewSavedReportPayloadRecord({
    container,
    reportBuilderConfig: container?.dashboard?.reportBuilder || {},
    rows: RAW_ROWS,
    semanticModel: DEMO_SEMANTIC_MODEL,
    reportId: 'forecastingTrendQ3',
    title: 'Forecasting Trend Q3',
    presetKind: 'chart',
    presetTitle: 'Avails by Date and Channel',
    documentVersion: 6,
    artifactId: 'forecasting_q3_channel_trend',
    savedAt: 9300,
  }),
  buildPreviewSavedReportPayloadRecord({
    container,
    reportBuilderConfig: container?.dashboard?.reportBuilder || {},
    rows: RAW_ROWS,
    semanticModel: DEMO_SEMANTIC_MODEL,
    reportId: 'forecastingInventoryTopChannelsQ3',
    title: 'Forecasting Inventory Top Channels Q3',
    templateId: 'forecast_inventory_brief',
    presetKind: 'chart',
    presetTitle: 'Inventory · Top Channels',
    documentVersion: 7,
    artifactId: 'forecasting_q3_inventory_top_channels',
    savedAt: 9400,
    pageGeometry: PREVIEW_LANDSCAPE_PAGE_GEOMETRY,
  }),
  buildPreviewSavedReportPayloadRecord({
    container,
    reportBuilderConfig: container?.dashboard?.reportBuilder || {},
    rows: RAW_ROWS,
    semanticModel: DEMO_SEMANTIC_MODEL,
    reportId: 'forecastingLocationsTopMarketsQ3',
    title: 'Forecasting Locations Top Markets Q3',
    templateId: 'forecast_location_brief',
    presetKind: 'chart',
    presetTitle: 'Locations · Top Markets',
    documentVersion: 8,
    artifactId: 'forecasting_q3_locations_top_markets',
    savedAt: 9500,
    pageGeometry: PREVIEW_LANDSCAPE_PAGE_GEOMETRY,
  }),
];

const DEMO_STATE_STORAGE_SCOPE = resolveReportBuilderStateStorageScope({
  stateKey: container.stateKey,
  windowId: 'demoReportBuilderWindow',
  dataSourceRef: 'demoReportSource',
  containerId: container.id,
});
const DEMO_LEGACY_STORAGE_SCOPES = resolveLegacyReportBuilderStateStorageScopes({
  stateKey: container.stateKey,
  stateStorageScope: DEMO_STATE_STORAGE_SCOPE,
});
const DEMO_CHART_PRESET_STORAGE_KEY = `reportBuilder.chartPresets.${DEMO_STATE_STORAGE_SCOPE}`;
const DEMO_LEGACY_CHART_PRESET_STORAGE_KEYS = DEMO_LEGACY_STORAGE_SCOPES.map((scope) => `reportBuilder.chartPresets.${scope}`);

export default function ReportBuilderPreview() {
  useSignals();
  const context = useMemo(() => createDemoContext(), []);
  const lastHandledFetchInputRef = useRef(null);
  const lastObservedWindowFormJSONRef = useRef(undefined);
  const lastObservedInputJSONRef = useRef(undefined);
  const [previewRuntimeRunSequence, setPreviewRuntimeRunSequence] = useState(0);
  const [, setPreviewConfigRevision] = useState(0);
  const [, setPreviewSeededReportPayloadRevision] = useState(0);

  if (typeof window !== 'undefined') {
    ensurePreviewMetrics();
  }

  useSignalEffect(() => {
    const metrics = ensurePreviewMetrics();
    if (!metrics) {
      return;
    }
    const current = JSON.stringify(context?.signals?.windowForm?.value || {});
    const observed = recordReportBuilderPreviewObservation({
      metrics,
      kind: 'windowForm',
      currentJSON: current,
      previousObservedJSON: lastObservedWindowFormJSONRef.current,
    });
    lastObservedWindowFormJSONRef.current = observed.previousObservedJSON;
  });

  useSignalEffect(() => {
    const metrics = ensurePreviewMetrics();
    if (!metrics) {
      return;
    }
    const current = JSON.stringify(context?.signals?.input?.value || {});
    const observed = recordReportBuilderPreviewObservation({
      metrics,
      kind: 'input',
      currentJSON: current,
      previousObservedJSON: lastObservedInputJSONRef.current,
    });
    lastObservedInputJSONRef.current = observed.previousObservedJSON;
  });

  useSignalEffect(() => {
    const inputState = context?.signals?.input?.value;
    if (!inputState?.fetch) {
      return;
    }
    if (lastHandledFetchInputRef.current === inputState) {
      return;
    }
    lastHandledFetchInputRef.current = inputState;
    context?.handlers?.dataSource?.fetchCollection?.();
    setPreviewRuntimeRunSequence((current) => current + 1);
  });

  const runtimeInteractionResetKey = useMemo(
    () => JSON.stringify(context?.signals?.input?.value?.parameters || null),
    [context?.signals?.input?.value?.parameters],
  );

  const previewBaseConfig = container?.dashboard?.reportBuilder || {};
  const previewWindowState = context?.signals?.windowForm?.value?.[container.stateKey] || null;
  const previewStoredState = useMemo(
    () => loadStoredReportBuilderState(DEMO_STATE_STORAGE_SCOPE, DEMO_LEGACY_STORAGE_SCOPES),
    [context?.signals?.windowForm?.value],
  );
  const previewPersistedState = useMemo(
    () => resolveEffectiveReportBuilderState(previewWindowState, previewStoredState),
    [previewStoredState, previewWindowState],
  );
  const previewHydratedReportDocumentSession = useMemo(
    () => resolveReportBuilderHydratedDocumentSessionFromState(previewPersistedState || {}),
    [previewPersistedState],
  );
  const runtimeInteraction = useReportRuntimeInteractionState({
    initialState: buildPreviewHydratedRuntimeInteractionSnapshot(previewHydratedReportDocumentSession),
    resetKey: runtimeInteractionResetKey,
  });
  const runtimeRefinements = runtimeInteraction.refinements;
  const runtimeDrillTransitions = runtimeInteraction.drillTransitions;
  const previewRuntimeUsesResolvedCollection = runtimeRefinements.length === 0 && runtimeDrillTransitions.length === 0;
  const previewConfig = useMemo(
    () => mergeReportBuilderReopenedConfig(previewBaseConfig, previewHydratedReportDocumentSession?.reopenedConfig || null),
    [previewBaseConfig, previewHydratedReportDocumentSession?.reopenedConfig],
  );
  const previewBuilderState = useMemo(
    () => (previewPersistedState ? mergeReportBuilderState(previewConfig, previewPersistedState) : null),
    [previewConfig, previewPersistedState],
  );
  const previewSemanticBinding = previewBuilderState?.binding || previewConfig?.binding || null;
  const previewSemanticModelReloadKey = useMemo(
    () => buildReportBuilderSemanticModelReloadKey(previewHydratedReportDocumentSession),
    [previewHydratedReportDocumentSession],
  );
  const {
    semanticDisplayConfig: previewSemanticDisplayConfig,
    resolvedSemanticSummary: previewResolvedSemanticSummary,
  } = useReportBuilderSemanticRuntimeState({
    builderContext: context,
    config: previewConfig,
    state: previewBuilderState || {},
    binding: previewSemanticBinding,
    configSemanticModel: previewConfig?.semanticModel || null,
    reloadKey: previewSemanticModelReloadKey,
    fallbackSummary: previewHydratedReportDocumentSession?.reopenedSemanticSummary || null,
    fallbackFingerprint: previewHydratedReportDocumentSession?.reopenedSemanticFingerprint || '',
  });
  const previewDisplayConfig = useMemo(
    () => buildReportBuilderCalculatedFieldConfig(previewSemanticDisplayConfig, previewBuilderState || {}),
    [previewSemanticDisplayConfig, previewBuilderState?.localCalculatedFields, previewBuilderState?.localTableCalculations],
  );
  const previewRuntimeModel = useMemo(() => buildPreviewAuthoredReportModel({
    container,
    config: previewDisplayConfig,
    state: previewBuilderState,
    refinements: runtimeRefinements,
    drillTransitions: runtimeDrillTransitions,
    semanticSummary: previewResolvedSemanticSummary,
  }), [
    container,
    previewBuilderState,
    previewDisplayConfig,
    previewResolvedSemanticSummary,
    runtimeDrillTransitions,
    runtimeRefinements,
  ]);
  const previewRuntimeRequest = useMemo(
    () => (Array.isArray(previewRuntimeModel?.reportSpec?.datasets) && previewRuntimeModel.reportSpec.datasets[0]?.request
      ? previewRuntimeModel.reportSpec.datasets[0].request
      : null),
    [previewRuntimeModel],
  );
  const previewRuntimeSecondaryDatasets = useMemo(
    () => (Array.isArray(previewRuntimeModel?.reportSpec?.datasets)
      ? previewRuntimeModel.reportSpec.datasets.filter((dataset) => String(dataset?.id || '').trim() && String(dataset?.id || '').trim() !== 'primary')
      : []),
    [previewRuntimeModel],
  );
  const previewRuntimeFingerprint = useMemo(
    () => (!previewRuntimeUsesResolvedCollection && previewRuntimeRequest ? JSON.stringify(previewRuntimeRequest) : ''),
    [previewRuntimeRequest, previewRuntimeUsesResolvedCollection],
  );
  const previewRuntimeRequestKey = useMemo(
    () => buildReportRuntimePreviewRequestKey(previewRuntimeFingerprint, previewRuntimeRunSequence),
    [previewRuntimeFingerprint, previewRuntimeRunSequence],
  );
  const previewRuntimeSecondaryDatasetRequestKey = useMemo(
    () => JSON.stringify(previewRuntimeSecondaryDatasets.map((dataset) => ({
      id: dataset?.id,
      dataSourceRef: dataset?.dataSourceRef,
      request: dataset?.request || null,
      resultContract: dataset?.resultContract || null,
      source: dataset?.source || null,
      capabilities: dataset?.capabilities || null,
    }))),
    [previewRuntimeSecondaryDatasets],
  );
  const previewRuntimeInteractionSnapshot = useMemo(
    () => buildPreviewRuntimeInteractionSnapshot({
      refinements: runtimeInteraction.refinements,
      drillTransitions: runtimeInteraction.drillTransitions,
      hostIntent: runtimeInteraction.hostIntent,
      detailDiagnostic: runtimeInteraction.detailDiagnostic,
    }),
    [
      runtimeInteraction.detailDiagnostic,
      runtimeInteraction.drillTransitions,
      runtimeInteraction.hostIntent,
      runtimeInteraction.refinements,
    ],
  );
  const previewHydratedRuntimeInteractionSnapshot = useMemo(
    () => buildPreviewHydratedRuntimeInteractionSnapshot(previewHydratedReportDocumentSession),
    [previewHydratedReportDocumentSession],
  );
  const previewRuntimeInteractionSnapshotFingerprint = useMemo(
    () => buildPreviewRuntimeInteractionFingerprint(previewRuntimeInteractionSnapshot),
    [previewRuntimeInteractionSnapshot],
  );
  const previewHydratedRuntimeInteractionFingerprint = useMemo(
    () => buildPreviewRuntimeInteractionFingerprint(previewHydratedRuntimeInteractionSnapshot),
    [previewHydratedRuntimeInteractionSnapshot],
  );
  const lastPreviewHydratedRuntimeInteractionFingerprintRef = useRef(previewHydratedRuntimeInteractionFingerprint);
  const runtimeSurface = useAuthoredRuntimePreviewSurface({
    interaction: runtimeInteraction,
    semanticModelHandler: context?.handlers?.semanticModel || null,
    reportSpec: previewRuntimeModel?.reportSpec || {},
  });
  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    const metrics = ensurePreviewMetrics();
    if (!metrics) {
      return undefined;
    }
    metrics.getStandaloneRuntimeRequest = () => (
      previewRuntimeRequest ? clonePreviewValue(previewRuntimeRequest) : null
    );
    metrics.getStandaloneRuntimeRequestFingerprint = () => previewRuntimeFingerprint;
    metrics.getStandaloneRuntimeRequestKey = () => previewRuntimeRequestKey;
    attachPreviewRuntimeSurfaceApi(metrics, {
      getBuilderConfig() {
        return container?.dashboard?.reportBuilder || null;
      },
      setBuilderConfig(nextBuilderConfig) {
        if (!container?.dashboard) {
          return;
        }
        container.dashboard.reportBuilder = clonePreviewValue(nextBuilderConfig || {});
        setPreviewConfigRevision((current) => current + 1);
      },
      getWindowFormState() {
        return typeof context?.signals?.windowForm?.peek === 'function'
          ? (context.signals.windowForm.peek() || {})
          : (context?.signals?.windowForm?.value || {});
      },
      setWindowFormState(nextWindowFormState) {
        context?.handlers?.dataSource?.setWindowFormData?.({
          values: nextWindowFormState,
          replace: true,
          bumpPrefillRevision: false,
        });
      },
      getCollectionRows() {
        return context?.signals?.collection?.peek?.()
          || context?.signals?.collection?.value
          || [];
      },
      setCollectionRows(nextRows) {
        if (context?.signals?.collection) {
          context.signals.collection.value = Array.isArray(nextRows) ? clonePreviewValue(nextRows) : [];
        }
      },
      setCollectionInfo(nextInfo) {
        if (context?.signals?.collectionInfo) {
          context.signals.collectionInfo.value = nextInfo;
        }
      },
      setControl(nextControl) {
        if (context?.signals?.control) {
          context.signals.control.value = nextControl;
        }
      },
      getSavedReportPayloads() {
        return container?.dashboard?.reportBuilder?.reportDocumentSavedPayloads || [];
      },
      setSavedReportPayloads(nextPayloads) {
        if (!container?.dashboard?.reportBuilder) {
          return;
        }
        container.dashboard.reportBuilder.reportDocumentSavedPayloads = Array.isArray(nextPayloads)
          ? clonePreviewValue(nextPayloads)
          : [];
        setPreviewSeededReportPayloadRevision((current) => current + 1);
      },
      buildSavedReportPayloadRecord(seed = {}) {
        const normalizedSeed = seed && typeof seed === 'object' && !Array.isArray(seed)
          ? seed
          : {};
        const {
          container: _ignoredContainer,
          reportBuilderConfig: _ignoredReportBuilderConfig,
          rows: _ignoredRows,
          semanticModel: _ignoredSemanticModel,
          ...recordSeed
        } = normalizedSeed;
        return buildPreviewSavedReportPayloadRecord({
          container,
          reportBuilderConfig: container?.dashboard?.reportBuilder || {},
          rows: RAW_ROWS,
          semanticModel: DEMO_SEMANTIC_MODEL,
          ...recordSeed,
        });
      },
      runtimeSurface,
      runtimeInteractionSnapshot: previewRuntimeInteractionSnapshot,
      stateKey: container.stateKey,
      persistBuilderState(nextBuilderState) {
        persistStoredReportBuilderState(
          DEMO_STATE_STORAGE_SCOPE,
          nextBuilderState,
          DEMO_LEGACY_STORAGE_SCOPES,
        );
      },
    });
    return () => {
      delete metrics.getStandaloneRuntimeRequest;
      delete metrics.getStandaloneRuntimeRequestFingerprint;
      delete metrics.getStandaloneRuntimeRequestKey;
      detachPreviewRuntimeSurfaceApi(metrics);
    };
  }, [
    container.stateKey,
    context,
    previewRuntimeFingerprint,
    previewRuntimeInteractionSnapshot,
    previewRuntimeRequest,
    previewRuntimeRequestKey,
    runtimeSurface,
  ]);
  const previewRuntimeRowsState = useReportRuntimePreviewRows({
    enabled: !previewRuntimeUsesResolvedCollection,
    canRun: !!previewBuilderState,
    hasModel: !!previewRuntimeModel,
    request: previewRuntimeRequest,
    fingerprint: previewRuntimeFingerprint,
    requestKey: previewRuntimeRequestKey,
    fetchRecords: context?.handlers?.dataSource?.fetchRecords || null,
    requestKind: 'runtimePreview',
    unavailableErrorMessage: 'Runtime preview fetch is unavailable for this data source.',
  });
  const previewRuntimeDatasetPayloadState = useReportRuntimePreviewDatasetPayloads({
    enabled: !!previewBuilderState && !!previewRuntimeModel,
    builderContext: context,
    datasets: previewRuntimeSecondaryDatasets,
    requestKey: previewRuntimeSecondaryDatasetRequestKey,
  });
  const runtimeHostIntent = runtimeSurface.hostIntent;
  const runtimeDetailDiagnostic = runtimeSurface.detailDiagnostic;
  const reopenedRuntimeDiagnostics = Array.isArray(previewHydratedReportDocumentSession?.reopenedCompileState?.diagnostics)
    ? previewHydratedReportDocumentSession.reopenedCompileState.diagnostics
    : [];
  const previewRuntimeRows = previewRuntimeUsesResolvedCollection
    ? (context?.signals?.collection?.value || [])
    : previewRuntimeRowsState.rows;
  const previewRuntimeHasMore = previewRuntimeUsesResolvedCollection
    ? (context?.signals?.collectionInfo?.value?.hasMore === true)
    : (previewRuntimeRowsState.hasMore === true);
  const previewRuntimeError = previewRuntimeUsesResolvedCollection
    ? (context?.signals?.control?.value?.error || null)
    : (previewRuntimeRowsState.error || null);
  const previewRuntime = useMemo(() => buildPreviewAuthoredReport({
    container,
    config: previewDisplayConfig,
    state: previewBuilderState,
    rows: previewRuntimeRows,
    rowsResolved: true,
    hasMore: previewRuntimeHasMore,
    datasetPayloads: previewRuntimeDatasetPayloadState.payloads,
    error: previewRuntimeError,
    refinements: runtimeRefinements,
    drillTransitions: runtimeDrillTransitions,
    hostIntent: runtimeHostIntent,
    additionalDiagnostics: [
      ...reopenedRuntimeDiagnostics,
      ...(runtimeDetailDiagnostic ? [runtimeDetailDiagnostic] : []),
    ],
    semanticSummary: previewResolvedSemanticSummary,
    model: previewRuntimeModel,
  }), [
    previewBuilderState,
    previewDisplayConfig,
    previewHydratedReportDocumentSession?.reopenedCompileState?.diagnostics,
    previewRuntimeError,
    previewRuntimeHasMore,
    previewRuntimeDatasetPayloadState.payloads,
    previewRuntimeModel,
    previewRuntimeRows,
    previewResolvedSemanticSummary,
    runtimeRefinements,
    runtimeDrillTransitions,
    runtimeHostIntent,
    runtimeDetailDiagnostic,
  ]);

  const previewRuntimeHandlers = runtimeSurface.runtimeHandlers;

  useEffect(() => {
    if (!previewHydratedReportDocumentSession || !previewPersistedState) {
      return;
    }
    const hydratedChanged = lastPreviewHydratedRuntimeInteractionFingerprintRef.current !== previewHydratedRuntimeInteractionFingerprint;
    lastPreviewHydratedRuntimeInteractionFingerprintRef.current = previewHydratedRuntimeInteractionFingerprint;
    if (previewRuntimeInteractionSnapshotFingerprint === previewHydratedRuntimeInteractionFingerprint) {
      return;
    }
    if (hydratedChanged) {
      return;
    }
    if (!previewRuntimeInteractionSnapshot && previewHydratedRuntimeInteractionSnapshot) {
      return;
    }
    const nextPersistedState = buildPreviewRuntimeInteractionPersistedStateFromBuilderState({
      persistedBuilderState: previewPersistedState,
      runtimeInteractionSnapshot: previewRuntimeInteractionSnapshot,
    });
    if (!nextPersistedState) {
      return;
    }
    const latestWindowFormSnapshot = typeof context?.signals?.windowForm?.peek === 'function'
      ? (context.signals.windowForm.peek() || {})
      : (context?.signals?.windowForm?.value || {});
    context?.handlers?.dataSource?.setWindowFormData?.({
      values: {
        ...latestWindowFormSnapshot,
        [container.stateKey]: nextPersistedState,
      },
      replace: true,
      bumpPrefillRevision: false,
    });
    persistStoredReportBuilderState(
      DEMO_STATE_STORAGE_SCOPE,
      nextPersistedState,
      DEMO_LEGACY_STORAGE_SCOPES,
    );
  }, [
    container.stateKey,
    context?.handlers?.dataSource,
    context?.signals?.windowForm,
    previewPersistedState,
    previewHydratedReportDocumentSession,
    previewHydratedRuntimeInteractionSnapshot,
    previewRuntimeInteractionSnapshot,
    previewHydratedRuntimeInteractionFingerprint,
    previewRuntimeInteractionSnapshotFingerprint,
  ]);

  const previewRuntimeContext = useMemo(() => ({
    ...context,
    handlers: {
      ...(context?.handlers || {}),
      reportRuntime: previewRuntimeHandlers,
    },
  }), [context, previewRuntimeHandlers]);

  return (
    <div style={{ padding: '28px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <Card elevation={0} style={{ borderRadius: '18px', border: '1px solid #d8e4ec', background: 'linear-gradient(180deg, #ffffff 0%, #f6fafe 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '18px' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#738694', marginBottom: '8px' }}>
                Forge Demo
              </div>
              <h1 style={{ margin: 0, fontSize: '30px', color: '#182026' }}>Semantic Report Builder Preview</h1>
              <p style={{ margin: '10px 0 0', fontSize: '13px', lineHeight: 1.55, color: '#4c6172', maxWidth: '76ch' }}>
                This local demo now runs the builder through a governed semantic model before executing the raw preview dataset. Use the expanded chart wizard to create multi-line, multi-color bar, split-series, pie, donut, horizontal bar, and funnel-style charts while the preview validates semantic field selections end to end.
              </p>
            </div>
            <Button
              outlined
              icon="trash"
              onClick={() => {
                if (typeof window !== 'undefined' && window.localStorage) {
                  window.localStorage.removeItem(reportBuilderStateStorageKey(DEMO_STATE_STORAGE_SCOPE));
                  DEMO_LEGACY_STORAGE_SCOPES.forEach((scope) => window.localStorage.removeItem(reportBuilderStateStorageKey(scope)));
                  window.localStorage.removeItem(DEMO_CHART_PRESET_STORAGE_KEY);
                  DEMO_LEGACY_CHART_PRESET_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
                  window.location.reload();
                }
              }}
            >
              Reset Preview
            </Button>
          </div>
        </Card>
        <ReportBuilder container={container} context={context} />
        <Card elevation={0} style={{ borderRadius: '18px', border: '1px solid #d8e4ec', background: 'linear-gradient(180deg, #ffffff 0%, #f8fbfe 100%)', padding: '18px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#738694', marginBottom: '8px' }}>
                Authored Runtime
              </div>
              <h2 style={{ margin: 0, fontSize: '22px', color: '#182026' }}>Compiled Report Runtime Preview</h2>
              <p style={{ margin: '10px 0 0', fontSize: '13px', lineHeight: 1.55, color: '#4c6172', maxWidth: '76ch' }}>
                This surface compiles the live semantic builder state through ReportDocument, ReportSpec, and ReportFill, then renders the result with generic Forge runtime blocks. It keeps the semantic binding visible and reuses the current preview rows as the runtime dataset.
              </p>
            </div>
            {previewRuntime ? (
              <DashboardBlock
                container={previewRuntime.runtimeBlock}
                context={previewRuntimeContext}
                isActive
              />
            ) : (
              <div style={{ fontSize: '13px', lineHeight: 1.5, color: '#5f6b7c' }}>
                Waiting for the report builder to initialize its runtime state.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
