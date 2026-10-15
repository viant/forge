import { describeNode, pathKey, targetGroups, valueSummary } from "./windowDocument";

// Only visited branches acquire children. The full authored values stay attached
// to every node; lazy navigation never filters or substitutes model fields.
const trees = new WeakMap();
export const childCount = (node) => node.childCount ?? node.children.length;
function collectionSize(value, ancestors) {
  return value && typeof value === "object" && !ancestors.has(value)
    ? Array.isArray(value) ? value.length : Object.keys(value).length : 0;
}
function lazyNode(fields, ancestors = new Set(), extra = []) {
  const entries = () => Object.entries(fields.value || {}).filter(([key]) => !fields.excludeFields?.has(key));
  const count = fields.excludeFields ? entries().length : collectionSize(fields.value, ancestors);
  const nextAncestors = new Set(ancestors);
  if (fields.value && typeof fields.value === "object") nextAncestors.add(fields.value);
  return {
    ...fields, children: [], childCount: count + extra.length,
    loadChildren: () => [...(count ? entries().map(([key, value]) => {
      const part = Array.isArray(fields.value) ? Number(key) : key;
      const path = [...fields.path, part];
      const excludeFields = fields.authoring && path[0] === 'variants' && path[2] === 'window' && path.length === 3 ? new Set(['dataSource','resourceDependencies','resource','resourceTarget','selectionBinding']) : fields.authoring && path[0] === 'variants' && path[2] === 'dataSources' && path.length === 4 && value?.service?.endpoint === 'agentlyAPI' && value.service.uri === `/v1/api/datasources/${part}/fetch` ? new Set(['service']) : fields.namedSources && path[0]==='variants' && path[2]==='window' && part==='actions' ? new Set(['code']) : fields.authoring && part==='component' ? new Set(['contentFingerprint','schemaFingerprint','authorityBinding','providerIdentity','revision']) : null;
      return lazyNode({key:part,value,path,authoring:fields.authoring,namedSources:fields.namedSources,excludeFields,branch:fields.branch,id:`${fields.branch}:${pathKey(path)}`,label:describeNode(part,value)}, nextAncestors);
    }) : []), ...extra],
  };
}
export function buildWindowTree(value, {authoring = false,namedSources = false} = {}) {
  const roots = targetGroups(value).map((group) => ({
    id:`group:${group.platform}`,label:group.label,icon:group.icon,path:null,
    summary:`${group.children.length || "no variants"}`,group:true,
    children:group.children.map((variant,index) => {
      const branch=`variant:${group.platform}:${index}`;
      const binding=variant.bindingPath ? lazyNode({id:`${branch}:${pathKey(variant.bindingPath)}`,branch,label:"Target binding",key:"target",path:variant.bindingPath,value:value.targets[variant.bindingPath[1]]}) : null;
      return lazyNode({id:branch,branch,...variant,authoring,namedSources,excludeFields:authoring?new Set(['dataSourceResources']):null},new Set(),binding && !authoring ? [binding] : []);
    }),
  }));
  roots.unshift(lazyNode({id:"document-root",branch:"document",label:"Document root",icon:"model",path:[],value,summary:`${Object.keys(value).length} attributes`}));
  const state={index:new Map()};
  state.register=(nodes,parentId=null,level=1) => nodes.forEach((node,position) => {
    node.materialize=() => {
      if (node.loadChildren) {
        node.children=node.loadChildren();
        delete node.loadChildren;
        state.index.get(node.id).children=node.children;
        state.register(node.children,node.id,level+1);
      }
      return node.children;
    };
    state.index.set(node.id,{...node,parentId,level,position:position+1,setSize:nodes.length});
    if(node.children.length)state.register(node.children,node.id,level+1);
  });
  state.register(roots);
  trees.set(roots,state);
  return roots;
}
/** Existing indexes gain newly visited nodes; selection never rebuilds them. */
export function indexTree(roots) { return trees.get(roots).index; }
export function materializeTree(roots,expanded) {
  function visit(nodes) { for(const node of nodes) if(expanded.has(node.id)) visit(node.materialize()); }
  visit(roots);
  return roots;
}
export function visibleTreeRows(roots,expanded,index) {
  materializeTree(roots,expanded);
  index ||= indexTree(roots);
  const rows=[];
  function visit(nodes) { for(const node of nodes) {
    rows.push({...index.get(node.id),expanded:expanded.has(node.id)});
    if(expanded.has(node.id))visit(node.children);
  }}
  visit(roots);
  return rows;
}
export function ancestorsOf(id,index) {
  const ancestors=[];let current=index.get(id);
  while(current?.parentId){ancestors.unshift(current.parentId);current=index.get(current.parentId);}
  return ancestors;
}
const isPrefix=(prefix,path)=>prefix.length<=path.length && prefix.every((part,index)=>part===path[index]);
export function treeBranchForId(id,roots) {
  const known=indexTree(roots).get(id)?.branch;
  if(known)return known;
  if(id==="document-root" || id.startsWith("document:"))return "document";
  return roots.slice(1).flatMap((group)=>group.children).find((node)=>id===node.id || id.startsWith(`${node.id}:`))?.branch;
}
export function revealTreePath(path,roots,preferredBranch="document") {
  const candidates=[roots[0],...roots.slice(1).flatMap((group)=>group.children)];
  const ordered=[...candidates.filter((node)=>node.branch===preferredBranch),...candidates.filter((node)=>node.branch==="document"),...candidates];
  for(const root of new Set(ordered)) {
    if(!isPrefix(root.path,path) && !(root.bindingPath && isPrefix(root.bindingPath,path)))continue;
    let node=root;
    while(pathKey(node.path)!==pathKey(path)) {
      const child=node.materialize().find((child)=>isPrefix(child.path,path));
      if(!child){node=null;break;}node=child;
    }
    if(node)return {id:node.id,ancestors:ancestorsOf(node.id,indexTree(roots))};
  }
  return null;
}
export function treeKeyAction(key, id, visibleRows) {
  const position = visibleRows.findIndex((node) => node.id === id),
    current = visibleRows[position];
  if (!current) return null;
  switch (key) {
    case "ArrowDown":
      return {
        focus: visibleRows[Math.min(position + 1, visibleRows.length - 1)].id,
      };
    case "ArrowUp":
      return { focus: visibleRows[Math.max(position - 1, 0)].id };
    case "Home":
      return { focus: visibleRows[0].id };
    case "End":
      return { focus: visibleRows.at(-1).id };
    case "ArrowRight":
      return childCount(current)
        ? !current.expanded
          ? { expand: id }
          : { focus: visibleRows[position + 1]?.id || id }
        : { focus: id };
    case "ArrowLeft":
      return childCount(current) && current.expanded
        ? { collapse: id }
        : { focus: current.parentId || id };
    case "Enter":
    case " ":
      return { activate: id };
    default:
      return null;
  }
}
export function treeRowLabel(node) {
  return childCount(node) ||
    node.summary ||
    typeof node.value === "object" ||
    node.value === undefined
    ? node.label
    : `${node.label} ${valueSummary(node.value)}`;
}
export function validateAttributeDraft(draft, type) {
  if (type === "integer" && /^[-+]?\d+$/.test(draft.trim())) {
    const integer = BigInt(draft.trim());
    if (integer > BigInt(Number.MAX_SAFE_INTEGER) || integer < BigInt(Number.MIN_SAFE_INTEGER)) return { value: integer };
  }
  if (type === "number" || type === "integer") {
    const number = Number(draft);
    if (
      !draft.trim() ||
      !Number.isFinite(number) ||
      (type === "integer" && !Number.isInteger(number))
    )
      return { error: `Enter a valid ${type}.` };
    return { value: number };
  }
  return { value: draft };
}
/** Drafts belong to source paths, not the mounted inspector or active mode. */
export function attributeDraftReducer(state, action) {
  if (action.type === "rekey") {
    const remap = (path) => path[0] === "variants" && path[1] === action.previous ? ["variants", action.variant, ...path.slice(2)] : path;
    return Object.fromEntries(Object.values(state).map((draft) => {
      const path = remap(draft.path);
      return [pathKey(path), { ...draft, path, ownerPath: remap(draft.ownerPath) }];
    }));
  }
  const key = pathKey(action.path);
  if (action.type === "discard") {
    const next = { ...state };
    delete next[key];
    return next;
  }
  return {
    ...state,
    [key]: {
      ...state[key],
      ...action.draft,
      path: action.path,
      ownerPath: action.ownerPath,
    },
  };
}
