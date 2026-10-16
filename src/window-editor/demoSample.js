import { stringify } from "yaml";
const window = {
  namespace: "workspace",
  windowKey: "workspace",
  window: { titleBinding: { template: "Workspace" } },
  parameters: [{ name: "search", type: "string", value: "" }],
  dataSource: {
    records: {
      service: { endpoint: "/api/records" },
      cardinality: "many",
      parameters: [{ name: "search", type: "string" }],
    },
  },
  actions: { code: "workspace.js" },
  view: {
    layout: { kind: "grid", columns: 2, gap: "16px" },
    content: {
      id: "workspace",
      title: "Workspace",
      className: "workspace",
      containers: [
        {
          id: "details",
          title: "Details",
          items: [{ id: "name", name: "name", label: "Name", type: "text" }],
        },
      ],
      items: [{ id: "search", name: "search", label: "Search", type: "text" }],
      tabs: { defaultSelectedTabId: "overview", animate: true },
      style: { padding: "20px" },
      customExtension: {
        css: "workspace.css",
        featureFlags: ["compact", "keyboard"],
      },
    },
  },
  resourceModels: {
    record: {
      schemaRef: "record",
      fields: { name: { read: "name", write: "name" } },
    },
  },
  schemas: {
    record: { type: "object", properties: { name: { type: "string" } } },
  },
};
const targets = [
  ["", ""],
  ["web", "desktop"],
  ["ios", "phone"],
  ["ios", "tablet"],
  ["android", "phone"],
  ["android", "tablet"],
];
const variants = {},
  bindings = [];
for (const [platform, formFactor] of targets) {
  const key = `${platform}-${formFactor}`;
  variants[key] = {
    window: { ...structuredClone(window), windowKey: key },
    dataSources: { records: { id: "records", backend: { kind: "inline", rows: [] } } },
  };
  bindings.push({ target: { platform, formFactor }, variant: key });
}
export const sample =
  "# Public Forge window bundle — illustrative portable authoring example.\n# Custom attributes and JS/CSS references remain in the YAML.\n" +
  stringify({
    schemaVersion: 2,
    format: "window.bundle",
    targets: bindings,
    variants,
  });
