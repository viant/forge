import {parse, walk, generate, lexer} from 'css-tree';

const stringCSS = value => generate({type: 'String', value});
const nameOf = node => node?.type === 'String' ? node.value : node?.name;
const setName = (node, name) => { if (node.type === 'String') node.value = name; else node.name = name; };

// Parse before installing any CSS. Selectors are bounded by the owning window
// and portal roots; names that remain global inside @scope are made unique.
export async function compileResourceCSS(definition, {providerIdentity, namespace, uri}) {
  if (definition?.schemaVersion !== 1 || typeof definition.css !== 'string' || !providerIdentity || !namespace || !uri) throw new Error('Invalid style resource');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([providerIdentity, namespace, uri])));
  const prefix = 'forge_' + [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2, '0')).join('').slice(0, 24);
  const ast = parse(definition.css, {parseCustomProperty: true, onParseError: error => { throw error; }});
  const animations = new Map(), fonts = new Map(), properties = new Map();
  const rename = (map, name) => { if (!map.has(name)) map.set(name, `${prefix}_${map.size}_${map === fonts ? 'font' : map === animations ? 'animation' : 'property'}`); return map.get(name); };
  let layerDepth = 0;
  const fontName = value => {
    const nodes = value.children?.toArray() || [];
    return nodes.length === 1 && nodes[0].type === 'String' ? nodes[0].value : nodes.every(n => n.type === 'Identifier') ? nodes.map(n => n.name).join(' ') : null;
  };
  walk(ast, {visit: 'Atrule', enter(node) {
    const kind = node.name.toLowerCase();
    if (kind === 'keyframes' || kind === '-webkit-keyframes') {
      const name = node.prelude?.children?.first;
      if (!nameOf(name)) throw new Error('Invalid keyframe name');
      setName(name, rename(animations, nameOf(name)));
    } else if (kind === 'font-face') {
      node.block.children.forEach(declaration => {
        if (declaration.type !== 'Declaration' || declaration.property.toLowerCase() !== 'font-family') return;
        const name = fontName(declaration.value); if (!name) throw new Error('Invalid font family');
        declaration.value = parse(stringCSS(rename(fonts, name.toLowerCase())), {context: 'value'});
      });
    } else if (kind === 'layer') {
      if (layerDepth === 0 && node.prelude) walk(node.prelude, n => { if (n.type === 'Layer') n.name = `${prefix}.${n.name}`; });
      if (node.block) layerDepth++;
    } else if (kind === 'property') {
      const name = node.prelude?.children?.first;
      if (!nameOf(name)?.startsWith('--')) throw new Error('Invalid registered property');
      const original = nameOf(name);
      if (!properties.has(original)) properties.set(original, '--' + rename(properties, original));
      setName(name, properties.get(original));
    } else if (!['media', 'supports', 'container', 'scope', 'starting-style'].includes(kind)) {
      throw new Error(`Style resource contains unsupported global rule @${node.name}`);
    }
  }, leave(node) { if (node.name.toLowerCase() === 'layer' && node.block) layerDepth--; }});
  walk(ast, {visit: 'Declaration', enter(node) {
    const property = node.property.toLowerCase();
    if (properties.has(node.property)) node.property = properties.get(node.property);
    walk(node.value, child => { if (child.type === 'Identifier' && properties.has(child.name)) child.name = properties.get(child.name); });
    if (['animation', 'animation-name', '-webkit-animation', '-webkit-animation-name'].includes(property)) {
      const match = lexer.matchProperty(property.replace('-webkit-', ''), node.value);
      walk(node.value, child => {
        const name = nameOf(child);
        if (animations.has(name) && match.getTrace(child)?.some(type => type.name === 'keyframes-name')) setName(child, animations.get(name));
      });
    }
    if (['font', 'font-family'].includes(property)) {
      const match = lexer.matchProperty(property, node.value);
      const values = node.value.children?.toArray() || [], replacement = [];
      for (let i = 0; i < values.length; i++) {
        const current = values[i];
        if (!match.getTrace(current)?.some(type => type.name === 'family-name')) { replacement.push(current); continue; }
        const group = [current];
        while (current.type === 'Identifier' && i + 1 < values.length && values[i + 1].type === 'Identifier' && match.getTrace(values[i + 1])?.some(type => type.name === 'family-name')) group.push(values[++i]);
        const name = group.length === 1 && current.type === 'String' ? current.value : group.map(n => n.name).join(' ');
        const scoped = fonts.get(name.toLowerCase());
        replacement.push(...(scoped ? [{type: 'String', value: scoped}] : group));
      }
      node.value.children?.fromArray(replacement);
    }
  }});
  const tokens = Object.entries(definition.tokens || {}).map(([name, value]) => {
    if (!/^--[a-zA-Z_][\w-]*$/.test(name) || typeof value !== 'string') throw new Error('Invalid resource style token');
    return `${properties.get(name) || name}:${generate(parse(value, {context: 'value'}))}`;
  }).join(';');
  const selector = `[data-forge-resource-provider=${stringCSS(providerIdentity)}][data-forge-resource-namespace=${stringCSS(namespace)}]`;
  return `@scope (${selector}) {${tokens ? `:scope{${tokens}}` : ''}${generate(ast)}}`;
}
