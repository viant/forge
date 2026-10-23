// Shared management-window section contract. Hosts choose how to place the
// destination; the provider still admits the selected window resource.
const destinations=Object.freeze({
  overview:['overview','Overview'],connectors:['connectors','Connectors'],
  schema:['schema','Explorer'],namespaces:['namespaces','Namespaces'],
  security:['security','Security'],runtime:['runtime','Runtime'],
  audit:['audit','Audit log'],skills:['skills','Skills'],
  components:['component-catalog','Components'],builder:['reader-workbench','Reader Builder'],
});
export function managementWindowDestination(section) {
  const selected=destinations[String(section || '').trim()];
  return selected ? {name:selected[0],title:selected[1]} : null;
}
