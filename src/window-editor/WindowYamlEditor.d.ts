import * as React from 'react';
export interface WindowYamlEditorState {
  /** Current source parses as a YAML window mapping; does not imply save eligibility. */
  readonly validSource: boolean;
  /** All unapplied drafts, including an actively edited field. */
  readonly pendingEdits: number;
  readonly readOnly: boolean;
  /** Requires valid source, no drafts, write access, and valid canonical bundle fingerprints. */
  readonly canCommit: boolean;
  readonly canonicalStatus: 'notRequired' | 'loading' | 'ready' | 'error';
  readonly errors: readonly string[];
}
export interface WindowYamlEditorProps {
  /** Authoritative named files, retained separately from the compiled runtime definition. */
  sourceManifest?: WindowSourceManifest;
  /** Host invokes the original server-side WorkspaceResourceSource compiler. */
  compileSourceManifest?: (source: WindowSourceManifest) => Promise<{definition: string | Record<string, unknown>}>;
  /** Host retains this manifest alongside the complete onChange runtime definition. */
  onSourceManifestChange?: (source: WindowSourceManifest) => void;
  /** Default bundle YAML shows readable assembled source; runtime mode is technical inspection. */
  yamlDocumentMode?: 'authoring' | 'runtime';
  /** Synchronous real Go descriptor compiler; receives full document and precise edited descriptors. */
  authoringCompiler?: (source: string) => {result?: string; error?: string; keys?: Record<string,string>; runtime?: Record<string,Record<string,unknown>>};
  /** Controlled YAML source; invalid drafts are retained. */
  value?: string;
  /** Initial source for an uncontrolled editor. */
  defaultValue?: string;
  /** Receives each source change, including invalid YAML. Canonical repair only changes derived metadata. */
  onChange?: (source: string, change?: {kind: 'canonical-repair'}) => void;
  /** Disables mutations, undo/redo and source editing; retains navigation and viewing. */
  readOnly?: boolean;
  /** Initial state and meaningful state transitions; callback identity changes do not repeat notifications. */
  onStateChange?: (state: WindowYamlEditorState) => void;
  /** Override or extend Forge's generated JSON schema. */
  schema?: Record<string, unknown>;
  defaultMode?: 'tree' | 'yaml';
  title?: string;
  subtitle?: string;
  showHeader?: boolean;
  /** Static directory containing canonical.wasm and wasm_exec.js. */
  canonicalAssetsURL?: URL;
  /** Synchronous canonical backend adapter; receives precise authored YAML. */
  canonicalizer?: (source: string) => { keys: Record<string, string>; dependencies: Record<string, Record<string, string>> };
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
}
export interface WindowSourceManifest {
  version: 1;
  binding: {windowKey: string; uri: string; targets?: readonly Record<string,unknown>[]};
  /** Workspace-relative names; raw comments, imports and actionRefs remain verbatim. */
  files: Record<string,string>;
}
export declare function WindowYamlEditor(props: WindowYamlEditorProps): React.ReactElement;
export default WindowYamlEditor;
