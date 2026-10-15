import { canonicalDocumentMetadata } from "./bundleCanonical";
import { parseDocument, isScalar, isAlias, isMap, isSeq } from "yaml";
import canonicalSchema from "./forgeWindowSchema.json";
export { canonicalSchema };
export const pathKey = (path) => JSON.stringify(path);
export function resolveSchema(
  schema = {},
  root = canonicalSchema,
  seen = new Set()
) {
  if (schema.$ref) {
    if (seen.has(schema.$ref)) return {};
    seen.add(schema.$ref);
    const name = schema.$ref
      .split("/")
      .pop()
      .replaceAll("~1", "/")
      .replaceAll("~0", "~");
    return resolveSchema(root.$defs?.[name] || {}, root, seen);
  }
  const properties = { ...(schema.properties || {}) };
  for (const member of schema.allOf || [])
    Object.assign(
      properties,
      resolveSchema(member, root, new Set(seen)).properties || {}
    );
  return { ...schema, properties };
}
export function schemaAtPath(path, value, root = canonicalSchema) {
  let schema = value?.format?.startsWith("window.")
    ? { $ref: "#/$defs/WindowResourceEnvelope" }
    : root;
  for (const part of path) {
    schema = resolveSchema(schema, root);
    schema =
      schema.type === "array"
        ? schema.items || {}
        : schema.properties?.[part] ||
          (typeof schema.additionalProperties === "object"
            ? schema.additionalProperties
            : {});
  }
  return resolveSchema(schema, root);
}
export function readDocument(source) {
  const document = parseDocument(source, {
    keepSourceTokens: true,
    intAsBigInt: true,
    uniqueKeys: true,
  });
  function normalizeIntegers(node) {
    if (isScalar(node) && typeof node.value === "bigint" && node.value >= BigInt(Number.MIN_SAFE_INTEGER) && node.value <= BigInt(Number.MAX_SAFE_INTEGER)) node.value = Number(node.value);
    if (isMap(node)) for (const pair of node.items) { normalizeIntegers(pair.key); normalizeIntegers(pair.value); }
    if (isSeq(node)) node.items.forEach(normalizeIntegers);
  }
  normalizeIntegers(document.contents);
  // Keep authored numeric lexemes (including precise decimals) until this scalar
  // itself is edited. Fingerprinting consumes the resulting YAML bytes in Go.
  document.schema.tags = document.schema.tags.map((tag) => tag.stringify ? {
    ...tag,
    stringify(node, ...args) {
      if ((typeof node.value === "number" || typeof node.value === "bigint") && node.source !== undefined && Object.is(Number(node.source), Number(node.value))) return node.source;
      return tag.stringify(node, ...args);
    },
  } : tag);
  document.options.indent = detectIndent(source);
  document.options.lineWidth = 0;
  const errors = document.errors.map((error) => error.message);
  let value;
  if (!errors.length) {
    try {
      value = document.toJS({ maxAliasCount: 100 });
    } catch (error) {
      errors.push(error.message);
    }
  }
  if (
    !errors.length &&
    (!value || typeof value !== "object" || Array.isArray(value))
  )
    errors.push("A window document must be a YAML mapping.");
  return { document, value, errors };
}
// Follow aliases when traversing a property path; editing a shared anchor updates
// all its aliases, just as an edit to the authored YAML anchor does.
function location(document, path) {
  let parent = document.contents;
  for (const part of path.slice(0, -1)) {
    if (isAlias(parent)) parent = parent.resolve(document);
    if (!isMap(parent) && !isSeq(parent))
      throw new Error(
        "Select an existing collection before adding an attribute."
      );
    parent = parent.get(part, true);
  }
  if (isAlias(parent)) parent = parent.resolve(document);
  return { parent, key: path.at(-1) };
}
export function mutateDocument(document, path, value, options = {}) {
  const next = document.clone();
  const { parent, key } = location(next, path);
  let prior = path.length ? parent?.get(key, true) : next.contents;
  if (isAlias(prior)) prior = prior.resolve(next);
  if (isScalar(prior) && (value === null || typeof value !== "object"))
    { prior.value = value; delete prior.source; }
  else {
    const node = next.createNode(value);
    if (prior) {
      node.comment = prior.comment;
      node.commentBefore = prior.commentBefore;
      node.spaceBefore = prior.spaceBefore;
      node.anchor = prior.anchor;
    }
    if (path.length) parent.set(key, node);
    else next.contents = node;
  }
  return serializeMutation(next, document, options);
}
export function removeDocumentNode(document, path, options = {}) {
  const next = document.clone();
  const { parent, key } = location(next, path);
  if (path.length) parent.delete(key);
  return serializeMutation(next, document, options);
}
export function defaultValue(schema, root = canonicalSchema) {
  const s = resolveSchema(schema, root);
  if ("default" in s) return s.default;
  if (s.enum?.length) return s.enum[0];
  return (
    {
      string: "",
      integer: 0,
      number: 0,
      boolean: false,
      array: [],
      object: {},
    }[s.type] ?? null
  );
}
export function nodeType(value, schema) {
  return (
    schema.type ||
    (Array.isArray(value) ? "array" : value === null ? "null" : typeof value === "bigint" ? "integer" : typeof value)
  );
}
export function treeNodes(value, path = [], ancestors = new Set()) {
  if (value === null || typeof value !== "object" || ancestors.has(value))
    return [];
  const seen = new Set(ancestors);
  seen.add(value);
  return Object.entries(value).map(([key, child]) => {
    const part = Array.isArray(value) ? Number(key) : key;
    return {
      path: [...path, part],
      key: part,
      value: child,
      children: treeNodes(child, [...path, part], seen),
    };
  });
}
export function targetGroups(value) {
  const groups = [
    { label: "Desktop", platform: "web", icon: "desktop", children: [] },
    { label: "iOS", platform: "ios", icon: "phone", children: [] },
    { label: "Android", platform: "android", icon: "phone", children: [] },
  ];
  if (value?.format?.startsWith("window.") && Array.isArray(value.targets)) {
    value.targets.forEach((binding, index) => {
      const platform = binding?.target?.platform || "";
      let group = groups.find((g) => g.platform === platform);
      if (!group) {
        group = { label: platform || "Default", platform, icon: "desktop", children: [] };
        groups.push(group);
      }
      group.children.push({
        label: (binding?.target?.formFactor || "default").replace(/^./, letter => letter.toUpperCase()),
        path: ["variants", binding?.variant],
        bindingPath: ["targets", index],
        value: value.variants?.[binding?.variant],
        icon:
          binding?.target?.formFactor === "tablet"
            ? "tablet"
            : platform === "web"
            ? "desktop"
            : "phone",
      });
    });
  } else {
    groups[0].children.push({
      label: "Window · shared source",
      path: [],
      value,
      icon: "window",
    });
    for (const group of groups.slice(1))
      for (const factor of ["phone", "tablet"])
        group.children.push({
          label: `${factor} · shared source`,
          path: [],
          value,
          icon: factor,
        });
  }
  return groups;
}
export function describeNode(key, value) {
  const label =
    value && typeof value === "object" && !Array.isArray(value)
      ? value.title || value.label || value.id || value.name
      : null;
  return label ? `${key} · ${label}` : String(key);
}
export function valueSummary(value) {
  return Array.isArray(value)
    ? `${value.length} items`
    : value && typeof value === "object"
    ? `${Object.keys(value).length} attributes`
    : value === null
    ? "null"
    : String(value);
}

// Source indentation applies to every CST edit; long scalars never fold.
export function detectIndent(source) {
  // Large canonical bundles can exceed JavaScript's function-argument limit.
  // Scan the source without materializing or spreading one entry per line.
  let minimum = Infinity;
  for (const match of source.matchAll(/^( +)\S/gm)) minimum = Math.min(minimum, match[1].length);
  return minimum === Infinity ? 2 : minimum;
}
// Identify both aliases and anchored descendants before the author edits.
export function sharedSourceIndex(document) {
  const anchors = new Map(), aliases = new Set();
  function visit(node, current = []) {
    if (node?.anchor) anchors.set(node.anchor, current);
    if (isAlias(node)) { aliases.add(node.source); return; }
    if (isMap(node)) for (const pair of node.items) visit(pair.value, [...current, pair.key.value]);
    if (isSeq(node)) node.items.forEach((child, i) => visit(child, [...current, i]));
  }
  visit(document.contents);
  return { anchors, aliases };
}
export function sharedSourceAtPath(document, path, index = sharedSourceIndex(document)) {
  const { anchors, aliases } = index;
  let node = document.contents, shared = null;
  for (const part of [...path, null]) {
    if (isAlias(node)) { shared = { anchor: node.source, anchorPath: anchors.get(node.source) || [], alias: true }; node = node.resolve(document); }
    else if (node?.anchor && aliases.has(node.anchor)) shared = { anchor: node.anchor, anchorPath: anchors.get(node.anchor), alias: false };
    if (part === null) break;
    node = isMap(node) || isSeq(node) ? node.get(part, true) : null;
  }
  return shared;
}

function serializeMutation(next, original, options) {
  const keys = next.get("format")?.startsWith("window.") ? rekeyBundle(next, options.canonicalizer) : null;
  const source = next.toString({ verifyAliasOrder: false, indent: original.options.indent, lineWidth: 0 });
  if (keys) options.onRekey?.(keys);
  return source;
}
export function rekeyBundle(document, canonicalizer) {
  const { keys, dependencies } = canonicalDocumentMetadata(document, canonicalizer);
  if (new Set(Object.values(keys)).size !== Object.keys(keys).length)
    throw new Error("This edit would merge distinct variants. Choose a shared variant explicitly in YAML to preserve each source's comments and extensions.");
  const variants = document.get("variants", true);
  const emitted = new Set();
  for (const pair of [...variants.items]) {
    const old = pair.key.value, key = keys[old];
    let variant = pair.value;
    if (isAlias(variant)) variant = variant.resolve(document);
    let window = variant.get("window", true);
    if (isAlias(window)) window = window.resolve(document);
    if (Object.keys(dependencies[old]).length) {
      let deps = window.get("resourceDependencies", true);
      if (!isMap(deps)) { deps = document.createNode({}); window.set("resourceDependencies", deps); }
      for (const pair of [...deps.items]) if (!Object.hasOwn(dependencies[old], pair.key.value)) deps.delete(pair.key.value);
      for (const [id, fingerprint] of Object.entries(dependencies[old])) {
        const prior = deps.get(id, true);
        if (isScalar(prior)) prior.value = fingerprint;
        else deps.set(id, fingerprint);
      }
    }
    else window.delete("resourceDependencies");
    if (emitted.has(key)) variants.items.splice(variants.items.indexOf(pair), 1);
    else { pair.key.value = key; emitted.add(key); }
  }
  const targets = document.get("targets", true);
  for (const binding of targets.items) {
    const prior = binding.get("variant", true);
    if (keys[prior.value]) prior.value = keys[prior.value];
  }
  return keys;
}
