import type { ReactElement } from "react";

export interface NativeReportDocument {
  version?: number;
  kind?: "reportDocument";
  id: string;
  title?: string;
  blocks: Array<Record<string, unknown> & { id: string; kind: string }>;
  datasets?: Array<Record<string, unknown>>;
  layout?: Record<string, unknown>;
  scope?: Record<string, unknown>;
  [key: string]: unknown;
}
export interface SourceDescriptor {
  id: string;
  version: string;
  display?: { label?: string; description?: string };
  status?: "available" | "denied" | "unavailable";
  fields?: Array<Record<string, unknown>>;
  queryInputs?: Array<Record<string, unknown>>;
  resultContract?: Record<string, unknown>;
  executeAllowed?: boolean;
  [key: string]: unknown;
}
export interface SourceProvider {
  id: string;
  discover(input: { signal: AbortSignal }): Promise<SourceDescriptor[] | { status: "result" | "partial" | "denied" | "unavailable" | "error"; sources?: SourceDescriptor[]; message?: string }>;
  describe(input: { id: string; version: string; signal: AbortSignal }): Promise<SourceDescriptor>;
  validate(input: { source: SourceDescriptor; report: NativeReportDocument; signal: AbortSignal }): Promise<
    | { valid: true; dataset: Record<string, unknown> }
    | { valid: false; status?: "denied" | "unavailable" | "error"; message: string }
  >;
}
export interface ReportHostResult {
  status: "loading" | "partial" | "result" | "error" | "conflict" | "denied" | "unavailable";
  message?: string;
  report?: NativeReportDocument;
  reportDocument?: NativeReportDocument;
  reportSpec?: Record<string, unknown>;
  reportFill?: Record<string, unknown>;
}
export interface ReportDesignerProps {
  report: NativeReportDocument;
  catalog?: Record<string, unknown>;
  datasets?: Record<string, unknown>;
  capabilities?: { blockKinds?: string[]; blockConfiguration?: boolean; documentHierarchy?: boolean; layout?: boolean; filters?: boolean; chart?: boolean; table?: boolean; kpi?: boolean; text?: boolean; drillTargets?: boolean; detailTargets?: boolean; sourceManager?: boolean; [key: string]: unknown };
  sourceProviders?: SourceProvider[];
  readOnly?: boolean;
  expectedRevision?: string | number | null;
  onChange?: (report: NativeReportDocument, change: { kind: string; [key: string]: unknown }) => void;
  onPreview?: (input: { report: NativeReportDocument; expectedRevision: string | number | null; signal: AbortSignal }) => Promise<ReportHostResult>;
  onRun?: (input: { report: NativeReportDocument; expectedRevision: string | number | null; signal: AbortSignal }) => Promise<ReportHostResult>;
  onSave?: (input: { report: NativeReportDocument; expectedRevision: string | number | null; signal: AbortSignal }) => Promise<ReportHostResult>;
}
export default function ReportDesigner(props: ReportDesignerProps): ReactElement;
