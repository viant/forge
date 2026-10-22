import {parseDocument} from 'yaml';
import {decodeResourceArchive} from './resourceArchive.js';

const archiveNames = Object.freeze({datasource: 'datasources', dialog: 'dialogs', window: 'windows', report: 'reports', lookup: 'lookups', style: 'styles'});
const defaultPreloadKinds = ['datasource', 'dialog'];
const clone = value => structuredClone(value);
const parseURI = value => {
  const match = /^([a-z][a-z0-9-]*):\/\/([^/?#]+)(?:\/(.*))?$/.exec(value);
  if (!match) throw new Error('Invalid resource URI');
  return {kind: match[1], namespace: match[2], path: match[3] || ''};
};

export function resolveResourcePath(reference, {kind, namespace, from} = {}) {
  if (reference.includes('://')) {
    const absolute = parseURI(reference);
    return resolveResourcePath(absolute.path, {...absolute, from: undefined});
  }
  if (!kind || !namespace || typeof reference !== 'string' || !reference || /[?#\\]/.test(reference)) throw new Error('Invalid resource path');
  const base = from ? parseURI(from) : {kind, namespace, path: ''};
  if (base.kind !== kind || base.namespace !== namespace) throw new Error('Resource base differs from root');
  const segments = reference.startsWith('/') ? [] : base.path.split('/').slice(0, -1).filter(Boolean);
  for (const part of reference.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') { if (!segments.length) throw new Error('Resource path escapes root'); segments.pop(); }
    else { if (/%2f|%5c|%2e/i.test(part)) throw new Error('Encoded resource path separator'); segments.push(part); }
  }
  if (!segments.length) throw new Error('Resource path is empty');
  return `${kind}://${namespace}/${segments.join('/')}`;
}

// One instance belongs to one immutable authenticated host scope. The host
// adapter owns MCP transport/compression; this is the shared definition cache,
// not a cache of business data. Replace the instance on account changes.
export class ResourceFS {
  constructor({namespace, scopeKey, loadArchive, preloadKinds = defaultPreloadKinds, prepareDataSource = value => value, warn = () => {}}) {
    if (!namespace || !scopeKey || typeof loadArchive !== 'function') throw new Error('Resource scope and archive adapter required');
    this.namespace = namespace;
    this.scopeKey = scopeKey;
    this.loadArchive = loadArchive;
    if (!Array.isArray(preloadKinds) || preloadKinds.some(kind => !Object.hasOwn(archiveNames, kind))) throw new Error('Unsupported preload kind');
    this.preloadKinds = [...new Set(preloadKinds)];
    this.prepareDataSource = prepareDataSource;
    this.warn = warn;
    this.generation = 0;
    this.pending = new Map();
    this.indexes = new Map();
    this.warnings = new Set();
    this.warningDetails = new Map();
  }
  warning(code, resource, message) {
    const key = `${code}:${resource}`;
    if (!this.warnings.has(key)) { const detail = {code, resource, message}; this.warnings.add(key); this.warningDetails.set(key, detail); this.warn(detail); }
  }
  preload() { return Promise.all(this.preloadKinds.map(kind => this.ensure(kind))); }
  ensure(kind) {
    if (!Object.hasOwn(archiveNames, kind)) return Promise.reject(new Error('Unsupported archive kind'));
    if (this.pending.has(kind)) return this.pending.get(kind);
    const generation = this.generation;
    const pending = Promise.resolve().then(() => this.loadArchive({kind, namespace: this.namespace, scopeKey: this.scopeKey})).then(async snapshot => {
      if (generation !== this.generation) return false;
      if (snapshot?.schemaVersion !== 1 || snapshot.complete !== true || snapshot.kind !== kind || snapshot.namespace !== this.namespace || !snapshot.catalogRevision || !Array.isArray(snapshot.entries)) throw new Error('Incomplete resource archive');
      const index = new Map();
      for (const entry of snapshot.entries) {
        const uri = parseURI(entry.uri);
        if (uri.kind !== kind || uri.namespace !== this.namespace || resolveResourcePath(entry.uri) !== entry.uri || !entry.revision || typeof entry.definitionText !== 'string' || !/^[a-f0-9]{64}$/.test(entry.contentFingerprint || '') || entry.selected != null && typeof entry.selected !== 'boolean') throw new Error('Invalid archive entry');
        const revisions = index.get(entry.uri) || {versions: new Map(), selected: null, explicit: false};
        const revision = String(entry.revision);
        if (revisions.versions.has(revision) || entry.selected === true && revisions.selected !== null) throw new Error('Duplicate archive revision or selection');
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(entry.definitionText));
        const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
        if (hash !== entry.contentFingerprint) throw new Error('Resource fingerprint mismatch');
        const definition = JSON.parse(entry.definitionText);
        if (!definition || typeof definition !== 'object' || Array.isArray(definition)) throw new Error('Invalid resource definition');
        revisions.versions.set(revision, {revision, definitionText: entry.definitionText, definition});
        if (entry.selected === true) revisions.selected = revision;
        if (entry.selected != null) revisions.explicit = true;
        index.set(entry.uri, revisions);
      }
      if (generation !== this.generation) return false;
      this.indexes.set(kind, index);
      return true;
    }).catch(error => {
      if (generation === this.generation) this.warning('resource_archive_unavailable', `${kind}://${this.namespace}`, error.message);
      return false;
    });
    this.pending.set(kind, pending);
    return pending;
  }
  async read(reference, {kind, revision, from} = {}) {
    const uri = resolveResourcePath(reference, {kind, namespace: this.namespace, from});
    const parsed = parseURI(uri);
    if (parsed.namespace !== this.namespace) throw new Error('Resource belongs to another scoped adapter');
    const generation = this.generation;
    if (!await this.ensure(parsed.kind) || generation !== this.generation) return undefined;
    const entry = this.selectedEntry(parsed.kind, uri, revision);
    if (!entry) {
      this.warning('resource_missing', uri, 'Resource is unavailable in the completed snapshot');
      return undefined;
    }
    return clone(entry.definition);
  }
  invalidate() { this.generation++; this.pending.clear(); this.indexes.clear(); this.warnings.clear(); this.warningDetails.clear(); }
  selectedEntry(kind, uri, revision) {
    const choices = this.indexes.get(kind)?.get(uri);
    if (!choices) return undefined;
    const selected = revision != null ? String(revision) : choices.selected ?? (!choices.explicit && choices.versions.size === 1 ? choices.versions.keys().next().value : undefined);
    return choices.versions.get(selected);
  }
  async readFile(reference, options = {}) {
    const value = await this.read(reference, options);
    if (value === undefined) return undefined;
    const uri = resolveResourcePath(reference, {kind: options.kind, namespace: this.namespace, from: options.from});
    return this.selectedEntry(parseURI(uri).kind, uri, options.revision)?.definitionText;
  }
  async loadWindow(source) {
    let window = source;
    if (typeof source === 'string') {
      const document = parseDocument(source, {uniqueKeys: true});
      if (document.errors.length) throw document.errors[0];
      window = document.toJS();
    }
    if (!window || typeof window !== 'object' || Array.isArray(window)) throw new Error('Window definition required');
    const result = clone(window);
    const assigned = result.resources || {};
    const sources = (assigned.dataSources || []).filter(id => {
      const existing = result.dataSource?.[id];
      return !existing?.service?.uri && !existing?.backend?.kind;
    });
    const suppliedDialogs = new Set((result.dialogs || []).map(dialog => dialog.id));
    const dialogs = (assigned.dialogs || []).filter(id => !suppliedDialogs.has(id));
    // Start both pulls together. Rendering waits only for referenced kinds.
    // Missing references below load only their required archive kinds.
    // Complete compiled windows need no additional definition requests.
    const [loadedSources, loadedDialogs] = await Promise.all([
      Promise.all(sources.map(async id => [id, await this.read(id, {kind: 'datasource'})])),
      Promise.all(dialogs.map(async id => [id, await this.read(id, {kind: 'dialog'})])),
    ]);
    result.dataSource = {...result.dataSource};
    for (const [id, value] of loadedSources) {
      if (!value) continue;
      const definition = await this.prepareDataSource(clone(value.dataSource || value), {id, scopeKey: this.scopeKey});
      Object.defineProperty(result.dataSource, id, {value: {...definition, ...result.dataSource[id]}, enumerable: true, configurable: true, writable: true});
    }
    const existing = new Set((result.dialogs || []).map(dialog => dialog.id));
    result.dialogs = [...(result.dialogs || [])];
    for (const [id, value] of loadedDialogs) if (value && !existing.has(id)) { result.dialogs.push({...value, id}); existing.add(id); }
    const relevant = new Set([
      ...sources.map(id => resolveResourcePath(id, {kind: 'datasource', namespace: this.namespace})),
      ...dialogs.map(id => resolveResourcePath(id, {kind: 'dialog', namespace: this.namespace})),
      ...(sources.length ? [`datasource://${this.namespace}`] : []),
      ...(dialogs.length ? [`dialog://${this.namespace}`] : []),
    ]);
    result.resourceWarnings = [...this.warningDetails.values()].filter(warning => relevant.has(warning.resource));
    return result;
  }
}

// The host supplies its existing authenticated MCP resources/read adapter.
// HTTP decompression belongs to that transport; no parallel REST API is used.
export function createMCPResourceFS({readResource, archiveFormat = 'json', ...options}) {
  if (typeof readResource !== 'function') throw new Error('MCP resource reader required');
  if (!['json', 'tar.gz'].includes(archiveFormat)) throw new Error('Unsupported archive format');
  return new ResourceFS({...options, loadArchive: async ({kind, namespace}) => {
    const uri = `resource-archive://${namespace}/${archiveNames[kind]}${archiveFormat === 'tar.gz' ? '.tar.gz' : ''}`;
    const response = await readResource({uri});
    const result = response?.result || response;
    if (!Array.isArray(result?.contents) || result.contents.length !== 1 || result.contents[0].uri !== uri) throw new Error('Invalid archive resource response');
    if (archiveFormat === 'tar.gz') return decodeResourceArchive(result.contents[0]);
    if (typeof result.contents[0].text !== 'string') throw new Error('Invalid archive text response');
    return JSON.parse(result.contents[0].text);
  }});
}
