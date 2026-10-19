import {parseDocument} from 'yaml';

const kinds = ['datasource', 'dialog'];
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
  constructor({namespace, scopeKey, loadArchive, prepareDataSource = value => value, warn = () => {}}) {
    if (!namespace || !scopeKey || typeof loadArchive !== 'function') throw new Error('Resource scope and archive adapter required');
    this.namespace = namespace;
    this.scopeKey = scopeKey;
    this.loadArchive = loadArchive;
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
  preload() { return Promise.all(kinds.map(kind => this.ensure(kind))); }
  ensure(kind) {
    if (!kinds.includes(kind)) return Promise.reject(new Error('Unsupported archive kind'));
    if (this.pending.has(kind)) return this.pending.get(kind);
    const generation = this.generation;
    const pending = Promise.resolve().then(() => this.loadArchive({kind, namespace: this.namespace, scopeKey: this.scopeKey})).then(async snapshot => {
      if (generation !== this.generation) return false;
      if (snapshot?.schemaVersion !== 1 || snapshot.complete !== true || snapshot.kind !== kind || snapshot.namespace !== this.namespace || !snapshot.catalogRevision || !Array.isArray(snapshot.entries)) throw new Error('Incomplete resource archive');
      const index = new Map();
      for (const entry of snapshot.entries) {
        const uri = parseURI(entry.uri);
        if (uri.kind !== kind || uri.namespace !== this.namespace || resolveResourcePath(entry.uri) !== entry.uri || !entry.revision || index.has(entry.uri) || typeof entry.definitionText !== 'string' || !/^[a-f0-9]{64}$/.test(entry.contentFingerprint || '')) throw new Error('Invalid or duplicate archive entry');
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(entry.definitionText));
        const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
        if (hash !== entry.contentFingerprint) throw new Error('Resource fingerprint mismatch');
        const definition = JSON.parse(entry.definitionText);
        if (!definition || typeof definition !== 'object' || Array.isArray(definition)) throw new Error('Invalid resource definition');
        index.set(entry.uri, {revision: String(entry.revision), definitionText: entry.definitionText, definition});
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
    const entry = this.indexes.get(parsed.kind)?.get(uri);
    if (!entry || revision != null && String(revision) !== entry.revision) {
      this.warning('resource_missing', uri, 'Resource is unavailable in the completed snapshot');
      return undefined;
    }
    return clone(entry.definition);
  }
  invalidate() { this.generation++; this.pending.clear(); this.indexes.clear(); this.warnings.clear(); this.warningDetails.clear(); }
  async readFile(reference, options = {}) {
    const value = await this.read(reference, options);
    if (value === undefined) return undefined;
    const uri = resolveResourcePath(reference, {kind: options.kind, namespace: this.namespace, from: options.from});
    return this.indexes.get(parseURI(uri).kind)?.get(uri)?.definitionText;
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
    const sources = assigned.dataSources || [];
    const dialogs = assigned.dialogs || [];
    // Start both pulls together. Rendering waits only for referenced kinds.
    this.preload();
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
export function createMCPResourceFS({readResource, ...options}) {
  if (typeof readResource !== 'function') throw new Error('MCP resource reader required');
  return new ResourceFS({...options, loadArchive: async ({kind, namespace}) => {
    const uri = `resource-archive://${namespace}/${kind === 'datasource' ? 'datasources' : 'dialogs'}`;
    const response = await readResource({uri});
    const result = response?.result || response;
    if (!Array.isArray(result?.contents) || result.contents.length !== 1 || result.contents[0].uri !== uri || typeof result.contents[0].text !== 'string') throw new Error('Invalid archive resource response');
    return JSON.parse(result.contents[0].text);
  }});
}
