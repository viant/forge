import {createAuthoringDocument,applyAuthoringDocument} from './authoringDocument';
import NamedWindowSourceEditor from './NamedWindowSourceEditor';
import {applyNamedTreeChange} from './namedSourceTree';
import { loadBundleCanonicalizer, canonicalBundleMetadata } from "./bundleCanonical";
import React, {
  useEffect,
  useMemo,
  useState,
  useRef,
  useLayoutEffect,
  useReducer,
  useId,
} from "react";
import CodeMirror from "@uiw/react-codemirror";
import { yaml } from "@codemirror/lang-yaml";
import { EditorView } from "@codemirror/view";
import {
  Desktop,
  DeviceMobile,
  DeviceTablet,
  AppWindow,
  Folder,
  ListBullets,
  TextT,
  Hash,
  ToggleLeft,
  Tabs,
  SquaresFour,
  Cube,
  SlidersHorizontal,
  Database,
  Lightning,
  BracketsCurly,
  Gear,
  Code,
  Palette,
  CaretRight,
  CaretDown,
  Plus,
  Trash,
  ArrowCounterClockwise,
  ArrowClockwise,
  CheckCircle,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  canonicalSchema,
  pathKey,
  readDocument,
  mutateDocument,
  rekeyBundle,
  removeDocumentNode,
  schemaAtPath,
  resolveSchema,
  defaultValue,
  describeNode,
  valueSummary,
  nodeType,
  sharedSourceAtPath,
  sharedSourceIndex,
} from "./windowDocument";
import "./WindowYamlEditor.css";
import {
  buildWindowTree,
  materializeTree,
  treeBranchForId,
  childCount,
  indexTree,
  visibleTreeRows,
  ancestorsOf,
  revealTreePath,
  treeKeyAction,
  treeRowLabel,
  validateAttributeDraft,
  attributeDraftReducer,
} from "./treeInteraction";
const icons = {
  desktop: Desktop,
  phone: DeviceMobile,
  tablet: DeviceTablet,
  window: AppWindow,
};
const useDomLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;
function SemanticIcon({ name, value, size = 17 }) {
  const key = String(name).toLowerCase();
  const Icon =
    icons[key] ||
    (/^window$/.test(key)
      ? AppWindow
      : /^tabs$/.test(key)
      ? Tabs
      : /^view$|container/.test(key)
      ? SquaresFour
      : /parameter/.test(key)
      ? SlidersHorizontal
      : /model/.test(key)
      ? Cube
      : /datasource|database|schema/.test(key)
      ? Database
      : /action|execute|^on$/.test(key)
      ? Lightning
      : /style|css/.test(key)
      ? Palette
      : /code|js|script/.test(key)
      ? Code
      : /binding/.test(key)
      ? BracketsCurly
      : /target|layout|setting/.test(key)
      ? Gear
      : Array.isArray(value)
      ? ListBullets
      : value && typeof value === "object"
      ? Folder
      : typeof value === "boolean"
      ? ToggleLeft
      : typeof value === "number"
      ? Hash
      : TextT);
  return <Icon size={size} aria-hidden="true" />;
}
function Attribute({
  name,
  value,
  schema,
  onCommit,
  onNavigate,
  onRemove,
  disabled,
  navigationDisabled = disabled,
  draftState,
  onDraft,
}) {
  const controlId = useId();
  const draft = draftState?.value ?? String(value ?? "");
  const error = draftState?.error || "";
  const setDraft = (next) => onDraft(next === String(value ?? "") ? null : { value: next, error: "", pending: false });
  const type = nodeType(value, schema);
  const complex = value !== null && typeof value === "object";
  function commit() {
    if (draft === String(value ?? "")) { onDraft(null); return; }
    const result = validateAttributeDraft(draft, type);
    if (result.error) {
      onDraft({ value: draft, error: result.error, pending: true });
      return;
    }
    onCommit(result.value);
  }

  return (
    <div className="fwe-attribute">
      <div className="fwe-attribute-name">
        <label htmlFor={controlId}>{name}</label>
        <span>{type}</span>
      </div>
      <div className="fwe-attribute-value">
        {complex ? (
          <button
            disabled={navigationDisabled}
            onClick={onNavigate}
            className="fwe-nested"
            aria-label={`Edit ${name}: ${valueSummary(value)}`}
          >
            {valueSummary(value)}
            <CaretRight />
          </button>
        ) : type === "boolean" ? (
          <select
            id={controlId}
            aria-label={name}
            disabled={disabled}
            value={String(value)}
            onChange={(e) => onCommit(e.target.value === "true")}
          >
            <option>true</option>
            <option>false</option>
          </select>
        ) : schema.enum ? (
          <select
            id={controlId}
            disabled={disabled}
            value={value}
            onChange={(e) =>
              onCommit(
                schema.enum.find((entry) => String(entry) === e.target.value)
              )
            }
          >
            {schema.enum.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        ) : String(value ?? "").includes("\n") ? (
          <textarea
            id={controlId}
            aria-label={name}
            disabled={disabled}
            rows={5}
            value={draft}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${controlId}-error` : undefined}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
          />
        ) : (
          <input
            id={controlId}
            aria-label={name}
            disabled={disabled}
            value={draft}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${controlId}-error` : undefined}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
            inputMode={/number|integer/.test(type) ? "decimal" : undefined}
          />
        )}
        <button
          disabled={disabled}
          title={`Remove ${name}`}
          aria-label={`Remove ${name}`}
          className="fwe-icon-button"
          onClick={onRemove}
        >
          <Trash size={15} />
        </button>
      </div>
      {error && (
        <small
          id={`${controlId}-error`}
          role="alert"
          className="fwe-field-error"
        >
          {error}
        </small>
      )}
      {schema.description && <small>{schema.description}</small>}
    </div>
  );
}
/** Portable public editor. value/onChange contain YAML source, including invalid drafts.
 * schema may replace/extend the generated canonical model. No runtime services required. */
function AssembledWindowYamlEditor({
  value,
  defaultValue: initialSource = "",
  onChange,
  onStateChange,
  readOnly = false,
  schema = canonicalSchema,
  defaultMode = "tree",
  title = "Window editor",
  subtitle = "Forge window YAML · public editor",
  showHeader = true,
  headingLevel = 2,
  canonicalAssetsURL,
  canonicalizer,
  authoringCompiler,
  yamlDocumentMode = "authoring",
  namedSourceSurface,
  namedSourceState,
  editorMode,
  onEditorModeChange,
}) {
  const [source, setSource] = useState(value ?? initialSource);
  const parsed = useMemo(() => readDocument(source), [source]);
  const [valid, setValid] = useState(parsed);
  const [localMode, setLocalMode] = useState(defaultMode);
  const mode = editorMode ?? localMode;
  const setMode = next => { setLocalMode(next); onEditorModeChange?.(next); };
  const [selection, setSelection] = useState([]);
  const [selectedId, setSelectedId] = useState("document-root");
  const [focusedId, setFocusedId] = useState("document-root");
  const [drafts, dispatchDraft] = useReducer(attributeDraftReducer, {});
  const rowRefs = useRef(new Map());
  const pendingFocus = useRef(null);
  const pendingSelectionBinding = useRef(null);
  const treeId = useId();
  const [expanded, setExpanded] = useState(
    new Set(["group:web", "group:ios", "group:android", "variant:web:0"])
  );
  const [history, setHistory] = useState([]),
    [future, setFuture] = useState([]);
  const [addKey, setAddKey] = useState(""),
    [customKey, setCustomKey] = useState(""),
    [customType, setCustomType] = useState("string");
  const [notice, setNotice] = useState("");
  const [sourceDraft,setSourceDraft] = useState(null);
  const [technical,setTechnical] = useState(false);
  useEffect(() => {
    if (value !== undefined && value !== source) { setSource(value); setMutationError(""); }
  }, [value]);
  useEffect(() => {
    if (parsed.errors.length) return;
    setValid(parsed);
    const pending = pendingSelectionBinding.current;
    pendingSelectionBinding.current = null;
    const nextVariant = pending && parsed.value.targets?.[pending.binding]?.variant;
    if (nextVariant && nextVariant !== pending.previous) rebindSelection(pending.previous, nextVariant);
    setSelection((current) => {
      let next = current;
      while (
        next.length &&
        next.reduce((node, part) => node?.[part], parsed.value) === undefined
      )
        next = next.slice(0, -1);
      return next.length === current.length ? current : next;
    });
  }, [parsed]);
  useEffect(() => {
    setAddKey("");
    setCustomKey("");
    setNotice("");
  }, [pathKey(selection)]);
  const active = parsed.errors.length ? valid : parsed;
  const data = active.value || {};
  const node = selection.reduce((v, p) => v?.[p], data);
  const selectedSchema = schemaAtPath(selection, data, schema);
  const generatedInspector = !technical && selection[0]==='variants' && selection[2]==='window' && selection.length===3 ? new Set(['dataSource','resourceDependencies','resource','resourceTarget','selectionBinding']) : !technical && selection.at(-1)==='actions' && namedSourceSurface ? new Set(['code']) : !technical && selection.at(-1)==='component' ? new Set(['contentFingerprint','schemaFingerprint','authorityBinding','providerIdentity','revision']) : new Set();
  const entries = node && typeof node === "object" ? Object.entries(node).filter(([key])=>!generatedInspector.has(key)) : [];
  const available = Object.entries(selectedSchema.properties || {}).filter(
    ([key]) => !Object.hasOwn(node || {}, key) && !generatedInspector.has(key)
  );
  const bundle = Boolean(data.format?.startsWith("window."));
  const [canonicalReady, setCanonicalReady] = useState(Boolean(canonicalizer || globalThis.forgeWindowCanonicalize));
  const [canonicalError, setCanonicalError] = useState("");
  const [mutationError, setMutationError] = useState("");
  useEffect(() => {
    if (bundle && !canonicalizer && (!canonicalReady || !globalThis.forgeWindowCompile)) loadBundleCanonicalizer(canonicalAssetsURL, true).then(() => setCanonicalReady(true), (error) => setCanonicalError(error.message));
  }, [bundle, canonicalAssetsURL, canonicalizer, canonicalReady]);
  const blocked = parsed.errors.length > 0 || (bundle && !canonicalReady && !canonicalizer);
  const disabled = readOnly || blocked;
  const hasStateListener = typeof onStateChange === "function";
  const bundleValidationError = useMemo(() => {
    if (!bundle || parsed.errors.length || (!canonicalReady && !canonicalizer)) return "";
    try {
      const metadata = canonicalBundleMetadata(source, canonicalizer, parsed.document);
      for (const [key, fingerprint] of Object.entries(metadata.keys)) {
        if (key !== fingerprint) return "Bundle variant fingerprints need canonicalization.";
        const actual = parsed.value.variants[key].window.resourceDependencies || {};
        const expected = metadata.dependencies[key];
        if (Object.keys(actual).length !== Object.keys(expected).length || Object.entries(expected).some(([id, hash]) => actual[id] !== hash)) return "Bundle datasource fingerprints need canonicalization.";
      }
      return "";
    } catch (error) { return String(error?.message || error || "Canonical bundle validation failed."); }
  }, [bundle, parsed, source, canonicalReady, canonicalizer]);
  const needsFingerprintUpdate = bundleValidationError === "Bundle variant fingerprints need canonicalization." || bundleValidationError === "Bundle datasource fingerprints need canonicalization.";
  const authoring = bundle && yamlDocumentMode === 'authoring';
  const projected = useMemo(() => {if(!authoring || parsed.errors.length)return null;try{return createAuthoringDocument(source,{variant:selection[0]==='variants'?selection[1]:undefined});}catch{return null;}},[authoring,source,pathKey(selection.slice(0,2))]);
  const sourceDraftErrors = useMemo(()=>sourceDraft?readDocument(sourceDraft.text).errors:[],[sourceDraft]);
  const validSource = parsed.errors.length === 0 && sourceDraftErrors.length === 0;
  const pendingEdits = Object.keys(drafts).length + (sourceDraft ? 1 : 0) + (namedSourceState?.pendingEdits||0);
  const canonicalStateError = bundle ? (canonicalizer ? "" : canonicalError) || mutationError || bundleValidationError : "";
  const canonicalStatus = !bundle ? "notRequired" : canonicalStateError ? "error" : canonicalReady || canonicalizer ? "ready" : "loading";
  const stateErrorsKey = JSON.stringify([...parsed.errors, ...sourceDraftErrors, ...(canonicalStateError ? [canonicalStateError] : [])]);
  const hostState = useMemo(() => Object.freeze({
    validSource, pendingEdits, readOnly, canonicalStatus,
    canCommit: !readOnly && validSource && pendingEdits === 0 && namedSourceState?.canCommit!==false && (canonicalStatus === "ready" || canonicalStatus === "notRequired"),
    errors: Object.freeze(JSON.parse(stateErrorsKey)),
  }), [validSource, pendingEdits, readOnly, canonicalStatus, stateErrorsKey,namedSourceState?.canCommit]);
  const stateCallback = useRef(onStateChange);
  useDomLayoutEffect(() => { stateCallback.current = onStateChange; }, [onStateChange]);
  useEffect(() => { stateCallback.current?.(hostState); }, [hostState, hasStateListener]);
  const sharedIndex = useMemo(() => sharedSourceIndex(active.document), [active.document]);
  const shared = sharedSourceAtPath(active.document, selection, sharedIndex);
  const sharedBindings = selection[0] === "variants" ? data.targets?.filter((binding) => binding.variant === selection[1]).length : 0;
  const level = Math.max(1, Math.min(6, headingLevel));
  const Heading = `h${level}`;
  const PanelHeading = `h${Math.min(6, level + 1)}`;
  const AttributeHeading = `h${Math.min(6, level + 2)}`;
  const Header = showHeader ? "header" : "div";
  const pendingDrafts = Object.values(drafts).filter((draft) => draft.pending || mode !== "tree" || pathKey(draft.ownerPath) !== pathKey(selection));
  function rebindSelection(previous, variant) {
    setSelection((path) => path[0] === "variants" && path[1] === previous ? ["variants", variant, ...path.slice(2)] : path);
    setSelectedId((id) => id.replaceAll(previous, variant));
    setFocusedId((id) => id.replaceAll(previous, variant));
    setExpanded((ids) => new Set([...ids].map((id) => id.replaceAll(previous, variant))));
    dispatchDraft({ type: "rekey", previous, variant });
  }
  function update(next, save = true, keys, change) {
    if (readOnly) return;
    setMutationError("");
    if (bundle && selection[0] === "variants") {
      const variant = keys?.[selection[1]];
      if (variant && variant !== selection[1]) rebindSelection(selection[1], variant);
      else if (!keys) pendingSelectionBinding.current = { binding: data.targets.findIndex((target) => target.variant === selection[1]), previous: selection[1] };
    }
    if (save) {
      setHistory((h) => [...h.slice(-49), source]);
      setFuture([]);
    }
    setSource(next);
    onChange?.(next, change);
  }
  function applySourceDraft() {
    if(readOnly || !sourceDraft)return;
    try {
      if(sourceDraft.base!==source)throw new Error('The definition changed while this source draft was open. Discard the draft and start from the current definition.');
      const result=applyAuthoringDocument(sourceDraft.sidecar,sourceDraft.text,{canonicalizer,compiler:authoringCompiler||globalThis.forgeWindowCompile});
      setSourceDraft(null);update(result.source,true,result.keys);
    }catch(error){setMutationError(error.message);}
  }
  function change(path, next) {
    if (!disabled) {
      try {
        let keys;
        let source;
        if(bundle && path[0]==='variants' && path[2]==='dataSources'){const sidecar=createAuthoringDocument(source = active.document.toString({lineWidth:0,verifyAliasOrder:false}),{variant:path[1]});const visible=readDocument(sidecar.source);const edited=mutateDocument(visible.document,['dataSources',...path.slice(3)],next);const result=applyAuthoringDocument(sidecar,edited,{canonicalizer,compiler:authoringCompiler||globalThis.forgeWindowCompile});source=result.source;keys=result.keys;}
        else source = mutateDocument(active.document, path, next, { canonicalizer, onRekey: (next) => { keys = next; } });
        update(source, true, keys); return true;
      }
      catch (error) { setNotice(error.message); if (bundle) setMutationError(error.message); return false; }
    }
  }
  function updateFingerprints() {
    if (disabled || pendingEdits || !needsFingerprintUpdate) return;
    try {
      const document = parsed.document.clone();
      const keys = rekeyBundle(document, canonicalizer);
      update(document.toString({ verifyAliasOrder: false, indent: parsed.document.options.indent, lineWidth: 0 }), true, keys, {kind:'canonical-repair'});
    } catch (error) {
      setMutationError(String(error?.message || error));
    }
  }
  const roots = useMemo(() => buildWindowTree(data,{authoring:bundle&&!technical,namedSources:!!namedSourceSurface}), [data,bundle,technical]);
  useEffect(()=>{if(!bundle || selection.length)return;const binding=data.targets?.find(row=>row.target?.platform==='web'&&row.target?.formFactor==='desktop')||data.targets?.find(row=>row.target?.platform==='web')||data.targets?.[0];if(!binding)return;const path=['variants',binding.variant,'window'];setSelection(path);const found=revealTreePath(path,roots,'variant:web:0');if(found){setSelectedId(found.id);setFocusedId(found.id);setExpanded(ids=>new Set([...ids,...found.ancestors]));}},[bundle,data,roots]);
  const treeIndex = useMemo(() => { materializeTree(roots, expanded); return indexTree(roots); }, [roots, expanded]);
  const visibleRows = useMemo(
    () => visibleTreeRows(roots, expanded, treeIndex).filter(row=>technical || !bundle || row.branch!=='document'),
    [roots, expanded, technical, bundle]
  );
  const visibleRoots = roots.filter(row=>technical || !bundle || row.branch!=='document');
  const visibleIds = new Set(visibleRows.map((row) => row.id));
  const tabStopId = visibleIds.has(focusedId)
    ? focusedId
    : ancestorsOf(focusedId, treeIndex)
        .reverse()
        .find((id) => visibleIds.has(id)) || visibleRows[0]?.id;
  useDomLayoutEffect(() => {
    const id = pendingFocus.current;
    if (mode !== "tree" || !id) return;
    const element = rowRefs.current.get(id);
    if (element) {
      element.scrollIntoView?.({ block: "nearest" });
      element.focus({ preventScroll: true });
      pendingFocus.current = null;
    }
  }, [selectedId, focusedId, expanded, mode]);
  function focusRow(id) {
    setFocusedId(id);
    pendingFocus.current = id;
    rowRefs.current.get(id)?.focus({ preventScroll: true });
  }
  function toggle(id) {
    if (expanded.has(id) && ancestorsOf(focusedId, treeIndex).includes(id))
      focusRow(id);
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else next.add(id);
      return next;
    });
  }
  function select(path, id) {
    setSelection(path);
    setSelectedId(id);
    focusRow(id);
  }
  function navigate(path) {
    const reveal = revealTreePath(
      path,
      roots,
      treeBranchForId(selectedId, roots)
    );
    if (!reveal) return;
    setExpanded((current) => new Set([...current, ...reveal.ancestors]));
    select(path, reveal.id);
  }
  useEffect(() => {
    const selected = treeIndex.get(selectedId);
    if (!selected || pathKey(selected.path) !== pathKey(selection))
      navigate(selection);
  }, [treeIndex, selectedId, pathKey(selection)]);
  function activateRow(row) {
    if (row.path === null) {
      focusRow(row.id);
      toggle(row.id);
    } else select(row.path, row.id);
  }
  function onTreeKey(event, row) {
    const action = treeKeyAction(event.key, row.id, visibleRows);
    if (!action) return;
    event.preventDefault();
    event.stopPropagation();
    if (action.focus) focusRow(action.focus);
    if (action.expand)
      setExpanded((current) => new Set([...current, action.expand]));
    if (action.collapse) toggle(action.collapse);
    if (action.activate) activateRow(row);
  }
  function draftProps(path, ownerPath) {
    return {
      draftState: drafts[pathKey(path)],
      onDraft: (draft) => {
        if (!readOnly) {
          dispatchDraft({ type: draft === null ? "discard" : "edit", path, ownerPath, draft });
          if (draft === null && mutationError) { setMutationError(""); setNotice(""); }
        }
      },
    };
  }
  function commitAttribute(path, next) {
    if (readOnly) return;
    dispatchDraft({ type: "discard", path });
    if (!change(path, next)) dispatchDraft({ type: "edit", path, ownerPath: selection, draft: { value: String(next), error: "Cannot encode this value in the canonical bundle model.", pending: true } });
  }
  function remove(path) {
    if (disabled) return false;
    try {
      let keys;
      let source;
      if(bundle && path[0]==='variants' && path[2]==='dataSources') {
        const sidecar=createAuthoringDocument(active.document.toString({lineWidth:0,verifyAliasOrder:false}),{variant:path[1]});
        const visible=readDocument(sidecar.source);
        visible.document.deleteIn(['dataSources',...path.slice(3)]);
        const result=applyAuthoringDocument(sidecar,visible.document.toString({lineWidth:0}),{canonicalizer,compiler:authoringCompiler||globalThis.forgeWindowCompile});
        source=result.source;keys=result.keys;
      } else source = removeDocumentNode(active.document, path, { canonicalizer, onRekey: (next) => { keys = next; } });
      update(source, true, keys); return true;
    }
    catch (error) { setNotice(error.message); if (bundle) setMutationError(error.message); return false; }
  }
  function add() {
    if (disabled) return;
    if (Array.isArray(node)) {
      if (!change(
        [...selection, node.length],
        defaultValue(selectedSchema.items || {}, schema)
      )) return;
      setNotice("Item appended. Select it to add its attributes.");
      return;
    }
    const key = ["__custom", "__entry"].includes(addKey)
      ? customKey.trim()
      : addKey;
    if (!key) return;
    if (Object.hasOwn(node || {}, key)) {
      setNotice("That attribute already exists.");
      return;
    }
    const field =
      selectedSchema.properties?.[key] ||
      (addKey === "__custom"
        ? { type: customType }
        : selectedSchema.additionalProperties);
    if (!change([...selection, key], defaultValue(field || {}, schema))) return;
    setNotice(`${key} added.`);
    setAddKey("");
    setCustomKey("");
  }
  function renderNode(node) {
    const row = treeIndex.get(node.id),
      open = expanded.has(node.id),
      selected = node.id === selectedId;
    const groupId = `${treeId}-children-${encodeURIComponent(node.id)}`;
    return (
      <li key={node.id} role="none">
        <div
          ref={(element) => {
            if (element) rowRefs.current.set(node.id, element);
            else rowRefs.current.delete(node.id);
          }}
          role="treeitem"
          aria-label={treeRowLabel(row)}
          aria-selected={selected}
          aria-expanded={childCount(node) ? open : undefined}
          aria-owns={open && childCount(node) ? groupId : undefined}
          aria-level={row.level}
          aria-posinset={row.level===1?visibleRoots.findIndex(root=>root.id===row.id)+1:row.position}
          aria-setsize={row.level===1?visibleRoots.length:row.setSize}
          tabIndex={node.id === tabStopId ? 0 : -1}
          onFocus={() => setFocusedId(node.id)}
          onKeyDown={(event) => onTreeKey(event, row)}
          className={`fwe-tree-row ${node.group ? "fwe-target" : ""} ${
            selected ? "is-selected" : ""
          }`}
          style={{ paddingLeft: 12 + (row.level - 1) * 18 }}
          onClick={() => activateRow(row)}
        >
          {childCount(node) ? (
            <button
              tabIndex={-1}
              className="fwe-expander"
              aria-label={`${open ? "Collapse" : "Expand"} ${node.label}`}
              aria-expanded={open}
              onClick={(event) => {
                event.stopPropagation();
                focusRow(node.id);
                toggle(node.id);
              }}
            >
              {open ? <CaretDown /> : <CaretRight />}
            </button>
          ) : (
            <span className="fwe-expander" />
          )}
          <button
            tabIndex={-1}
            className="fwe-node"
            title={node.label}
          >
            <SemanticIcon name={node.icon || node.key} value={node.value} />
            <span>{node.label}</span>
            {node.path && sharedSourceAtPath(active.document, node.path, sharedIndex) && <small className="fwe-shared">Shared source</small>}
            {(node.summary ||
              (!childCount(node) &&
                node.value !== undefined &&
                typeof node.value !== "object")) && (
              <small>{node.summary || valueSummary(node.value)}</small>
            )}
          </button>
        </div>
        {open && childCount(node) > 0 && (
          <ul id={groupId} role="group">
            {node.children.map(renderNode)}
          </ul>
        )}
        {open && node.group && !childCount(node) && (
          <p className="fwe-empty-target">
            No {node.label} target in this bundle.
          </p>
        )}
      </li>
    );
  }

  return (
    <section className="fwe" aria-label={title}>
      <Header className="fwe-header" aria-label={showHeader ? undefined : "Editor actions"}>
        {showHeader && <div className="fwe-title">
          <AppWindow size={24} />
          <div>
            <Heading className="fwe-heading">{title}</Heading>
            {subtitle && <p>{subtitle}</p>}
          </div>
        </div>
        }
        <div className="fwe-header-actions">
          <button
            aria-label="Undo"
            title="Undo"
            disabled={readOnly || !history.length}
            onClick={() => {
              if (readOnly) return;
              const next = history.at(-1);
              setHistory(history.slice(0, -1));
              setFuture([...future, source]);
              update(next, false);
            }}
          >
            <ArrowCounterClockwise />
          </button>
          <button
            aria-label="Redo"
            title="Redo"
            disabled={readOnly || !future.length}
            onClick={() => {
              if (readOnly) return;
              const next = future.at(-1);
              setFuture(future.slice(0, -1));
              setHistory([...history, source]);
              update(next, false);
            }}
          >
            <ArrowClockwise />
          </button>
          {bundle && <button aria-pressed={technical} onClick={()=>setTechnical(value=>!value)}>Technical metadata</button>}
          <div className="fwe-switch" aria-label="Editor mode">
            {["tree", "yaml"].map((m) => (
              <button
                key={m}
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
              >
                {m === "tree" ? "Tree" : "YAML"}
              </button>
            ))}
          </div>
        </div>
      </Header>
      <div
        className={`fwe-status ${blocked || canonicalStateError ? "has-error" : ""}`}
        role="status"
      >
        {blocked || canonicalStateError ? <WarningCircle size={17} /> : <CheckCircle size={17} />}
        <span>
          {parsed.errors.length
            ? "YAML needs attention. The tree shows your last valid document."
            : bundle && !canonicalReady && !canonicalizer ? canonicalError || "Loading canonical bundle fingerprints…"
            : needsFingerprintUpdate && canonicalStateError === bundleValidationError ? "Apply YAML changes to update the window definition."
            : canonicalStateError ? `Save blocked: ${canonicalStateError}`
            : "Valid YAML · edits preserve custom attributes and source comments"}
        </span>
        {needsFingerprintUpdate && <button disabled={disabled || pendingEdits > 0} onClick={updateFingerprints}>Apply YAML changes</button>}
        {parsed.errors.length > 0 && <button onClick={() => setMode("yaml")}>Fix YAML</button>}
      </div>
      {pendingDrafts.length > 0 && (
        <div className="fwe-pending" role="status">
          <strong>Unapplied attribute edits</strong>
          <span>
            Drafts are kept while you navigate. Correct or discard them to
            resolve.
          </span>
          {pendingDrafts.map((draft) => (
            <div key={pathKey(draft.path)}>
              <span>
                {draft.path.join(" / ")}:{" "}
                <code>{draft.value || "(empty)"}</code>
                {draft.error && (
                  <span className="fwe-field-error"> · {draft.error}</span>
                )}
              </span>
              <button
                onClick={() => {
                  setMode("tree");
                  navigate(draft.ownerPath);
                }}
              >
                Review {String(draft.path.at(-1))}
              </button>
              <button
                onClick={() =>
                  { dispatchDraft({ type: "discard", path: draft.path }); setMutationError(""); }
                }
              >
                Discard {String(draft.path.at(-1))}
              </button>
            </div>
          ))}
        </div>
      )}
      {notice && <p className="fwe-status" role="alert">{notice}</p>}
      {parsed.errors.length > 0 && (
        <div className="fwe-diagnostics" role="alert">
          {parsed.errors.map((error, i) => (
            <pre key={i}>{error}</pre>
          ))}
        </div>
      )}
      {namedSourceSurface && <div className="fwe-named-source" hidden={mode!=="yaml"}>{namedSourceSurface}</div>}
      {mode === "yaml" && namedSourceSurface ? null : mode === "yaml" ? (
        <div className="fwe-source">
          <CodeMirror
            value={authoring ? sourceDraft?.text ?? projected?.source ?? '' : source}
            editable={!readOnly}
            readOnly={readOnly}
            height="100%"
            extensions={[
              yaml(),
              EditorView.lineWrapping,
              EditorView.contentAttributes.of({
                "aria-label": "Window YAML source",
                "aria-readonly": String(readOnly),
              }),
            ]}
            onChange={(next) => {if(readOnly)return;if(authoring){if(!projected)return;setMutationError('');setSourceDraft(next===projected.source?null:{text:next,base:sourceDraft?.base||source,sidecar:sourceDraft?.sidecar||projected});}else update(next);}}
          />
          {authoring ? <><div className="fwe-authoring-actions"><button disabled={readOnly || !sourceDraft || sourceDraftErrors.length>0} onClick={applySourceDraft}>Apply YAML changes</button><button disabled={!sourceDraft} onClick={()=>{setSourceDraft(null);setMutationError('');}}>Discard source draft</button></div><p>Assembled window source. Apply changes to compile datasource bindings and preserve every target. Original files and imports require a source manifest.</p></> : <p>Source edits update the tree as soon as the YAML is valid.</p>}
        </div>
      ) : (
        <div className="fwe-workspace">
          <aside className="fwe-outline">
            <div className="fwe-panel-heading">
              <PanelHeading className="fwe-panel-title">Targets & structure</PanelHeading>
              <button
                onClick={() => {
                  setExpanded(new Set());
                  focusRow("group:web");
                }}
              >
                Collapse all
              </button>
            </div>
            <div className="fwe-tree-scroll">
              <ul role="tree" aria-label="Window structure">
                {visibleRoots.map(renderNode)}
              </ul>
            </div>
            <p className="fwe-tree-hint">
              Arrows move or expand. Enter selects. Chevrons expand separately.
            </p>
          </aside>
          <section className="fwe-inspector" aria-label="Attribute inspector">
            <div className="fwe-panel-heading">
              <div>
                <PanelHeading className="fwe-panel-title">
                  {selection.length
                    ? describeNode(selection.at(-1), node)
                    : "Document root"}
                </PanelHeading>
                <p className="fwe-path" title={selection.join(" / ")}>
                  {selection.length
                    ? selection.map(part => /^[a-f0-9]{64}$/i.test(String(part)) ? "Window source" : part).join(" / ")
                    : data.format || "Window"}
                </p>
              </div>
              <span className="fwe-type">
                {selectedSchema.type || nodeType(node, selectedSchema)}
              </span>
            </div>
            {sharedBindings > 1 && <p className="fwe-shared-notice" role="note">Shared variant: edits apply to all {sharedBindings} target bindings that reference this source.</p>}
            {shared && <p className="fwe-shared-notice" role="note">Shared source: edits update anchor &amp;{shared.anchor} and all its aliases. <button onClick={() => navigate(shared.anchorPath)}>Go to anchor {shared.anchor}</button></p>}
            <div className="fwe-inspector-scroll">
              <AttributeHeading className="fwe-section-title">
                Attributes <span>{entries.length}</span>
              </AttributeHeading>
              {entries.length ? (
                entries.map(([key, val]) => {
                  const part = Array.isArray(node) ? Number(key) : key;
                  return (
                    <Attribute
                      key={key}
                      name={key}
                      value={val}
                      schema={schemaAtPath([...selection, part], data, schema)}
                      disabled={disabled}
                      navigationDisabled={blocked}
                      {...draftProps([...selection, part], selection)}
                      onCommit={(next) =>
                        commitAttribute([...selection, part], next)
                      }
                      onNavigate={() => navigate([...selection, part])}
                      onRemove={() => remove([...selection, part])}
                    />
                  );
                })
              ) : node !== null && typeof node === "object" ? (
                <p className="fwe-empty">
                  This node has no attributes yet. Add one from the Forge model
                  below.
                </p>
              ) : (
                <Attribute
                  name={String(selection.at(-1) || "value")}
                  value={node}
                  schema={selectedSchema}
                  disabled={disabled}
                  navigationDisabled={blocked}
                  {...draftProps(selection, selection)}
                  onCommit={(next) => commitAttribute(selection, next)}
                  onRemove={() => {
                    if (remove(selection)) navigate(selection.slice(0, -1));
                  }}
                />
              )}
              {node !== null && typeof node === "object" && (
                <div className="fwe-add">
                  <AttributeHeading className="fwe-section-title">
                    {Array.isArray(node) ? "Add item" : "Add attribute or node"}
                  </AttributeHeading>
                  <p>
                    {Array.isArray(node)
                      ? "Append an item in source order, then edit its model attributes."
                      : `${available.length} available model attributes. Custom extensions are preserved.`}
                  </p>
                  {!Array.isArray(node) && (
                    <>
                      <label htmlFor={`${treeId}-add-field`}>Attribute</label>
                      <select
                        id={`${treeId}-add-field`}
                        disabled={disabled}
                        value={addKey}
                        onChange={(e) => setAddKey(e.target.value)}
                      >
                        <option value="">Choose a model attribute…</option>
                        {available.map(([key, field]) => (
                          <option key={key} value={key}>
                            {key} · {resolveSchema(field, schema).type || "any"}
                          </option>
                        ))}
                        {typeof selectedSchema.additionalProperties ===
                          "object" && (
                          <option value="__entry">
                            Named entry ·{" "}
                            {resolveSchema(
                              selectedSchema.additionalProperties,
                              schema
                            ).type || "any"}
                          </option>
                        )}
                        <option value="__custom">Custom attribute…</option>
                      </select>
                      {["__custom", "__entry"].includes(addKey) && (
                        <div className="fwe-custom">
                          <input
                            disabled={disabled}
                            aria-label="Custom attribute name"
                            placeholder="Attribute name"
                            value={customKey}
                            onChange={(e) => setCustomKey(e.target.value)}
                          />
                          {addKey === "__custom" && (
                            <select
                              disabled={disabled}
                              aria-label="Custom attribute type"
                              value={customType}
                              onChange={(e) => setCustomType(e.target.value)}
                            >
                              {[
                                "string",
                                "object",
                                "array",
                                "boolean",
                                "integer",
                                "number",
                              ].map((t) => (
                                <option key={t}>{t}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      )}
                    </>
                  )}
                  <button
                    className="fwe-primary"
                    disabled={
                      disabled ||
                      (!Array.isArray(node) &&
                        (!addKey ||
                          (["__custom", "__entry"].includes(addKey) &&
                            !customKey.trim())))
                    }
                    onClick={add}
                  >
                    <Plus />
                    {Array.isArray(node) ? "Append item" : "Add attribute"}
                  </button>
                  {notice && <p role="status">{notice}</p>}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
function RetainedSourceWindowEditor(props){
 const [namedState,setNamedState]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [mode,setMode]=useState(props.defaultMode||'tree');
 const [treeMounted,setTreeMounted]=useState((props.defaultMode||'tree')!=='yaml');
 const latest=useRef(props);latest.current=props;
 useEffect(()=>setError(''),[props.value,props.sourceManifest]);
 const applyTree=async(next,change)=>{
  if(props.readOnly||busy)return;
  // Fingerprints are derived from the compiled definition. Recompiling the
  // untouched named files here would restore their stale compiled metadata.
  if(change?.kind==='canonical-repair'){
   setError('');props.onChange?.(next);return;
  }
  setBusy(true);setError('');
  const baseline=props.sourceManifest;
  try{
   const source=applyNamedTreeChange(baseline,props.value,next);
   if(typeof props.compileSourceManifest!=='function')throw new Error('This host must supply the native named-source compiler.');
   const compiled=await props.compileSourceManifest(source);
   if(latest.current.sourceManifest!==baseline||latest.current.readOnly)throw new Error('Source changed during compilation. Reload the current source.');
   const definition=typeof compiled.definition==='string'?compiled.definition:JSON.stringify(compiled.definition);
   props.onSourceManifestChange?.(source);props.onChange?.(definition);
  }catch(error){setError(error?.message||'Source compilation failed.');}
  finally{setBusy(false);}
 };
 const state={validSource:false,canonicalStatus:'loading',errors:[],...namedState,pendingEdits:(namedState?.pendingEdits||0)+(busy?1:0),canCommit:!busy&&!error&&namedState?.canCommit===true};
 // Named files remain mounted across mode changes so unapplied drafts survive.
 // The assembled document is deliberately absent until Tree is requested: even
 // a hidden instance parses, projects and canonicalizes the entire bundle.
 useEffect(()=>{if(!treeMounted)props.onStateChange?.({...state,readOnly:!!props.readOnly,canCommit:!props.readOnly&&state.canCommit});},[treeMounted,namedState,busy,error,props.readOnly,props.onStateChange]);
 const chooseMode=next=>{if(next==='tree')setTreeMounted(true);setMode(next);};
 return <>
  {!treeMounted&&<section className="fwe" aria-label={props.title||'Window editor'}><div className="fwe-header"><div className="fwe-switch" aria-label="Editor mode"><button aria-pressed={false} onClick={()=>chooseMode('tree')}>Tree</button><button aria-pressed={true}>YAML</button></div></div></section>}
  {treeMounted&&<AssembledWindowYamlEditor {...props} editorMode={mode} onEditorModeChange={chooseMode} readOnly={props.readOnly||busy||(namedState?.pendingEdits||0)>0} onChange={applyTree} namedSourceState={state} namedSourceSurface={<></>}/>}
  <div className="fwe-named-source" hidden={mode!=='yaml'}><NamedWindowSourceEditor {...props} onStateChange={setNamedState}/></div>
  {error&&<p role="alert">{error}</p>}
 </>;
}
export function WindowYamlEditor(props) {
  return props.sourceManifest ? <RetainedSourceWindowEditor {...props}/> : <AssembledWindowYamlEditor {...props}/>;
}
export {createAuthoringDocument,applyAuthoringDocument};
export default WindowYamlEditor;
