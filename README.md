# Forge

Forge is a data-driven UI layer for building interactive applications from structured definitions. It turns window metadata, schemas, bound data, and report documents into forms, tables, charts, editors, conversations, and workspaces.

Definitions describe what to display and how controls interact. Runtime contexts connect those controls to data and actions. Web and native renderers provide the presentation, while the host application supplies services, authentication, authorization, and persistence.

## Why use Forge?

- **Describe an interface alongside its data.** YAML or JSON metadata declares controls, schemas, layouts, datasource references, and actions. Reusable fragments keep related screens consistent.
- **Present data in useful forms.** Structured reports, Markdown, forms, and collections let users inspect results, compare records, and edit declared fields.
- **Keep work visible in a workspace.** Windows, tabs, dialogs, split panels, and nested containers support several related views while preserving navigation and view state.
- **Share state across controls.** Datasource form, selection, collection, input, and loading/error state connect filters, tables, forms, and actions.
- **Separate presentation from execution.** Hosts provide connectors and callbacks. A rendered button, discovered source, or proposed report does not grant permission to execute an operation.
- **Adapt presentation to the client.** React web components, SwiftUI renderers, and Android Compose renderers consume structured definitions with platform-aware layout and capabilities.

## Architecture

| Layer | Responsibility |
| --- | --- |
| Definitions | Window and container metadata, schemas, datasource contracts, actions, report documents, and target-specific presentation |
| Runtime | Contexts, reactive state, bindings, widget classification, window lifecycle, and UI command dispatch |
| Renderers | Web components and native views for controls, layouts, visualizations, and report content |
| Host integration | Authorized data requests, action handlers, stored state, report execution, and artifact delivery |
| Go services | Metadata loading and imports, file-service integrations, report compilation/rendering |

The host supplies definitions and data through Forge's loading and connector boundaries. The runtime resolves widget types and bindings, tracks form and collection state, and routes interactions to declared handlers. Renderers display that state and expose updates back to the runtime. This keeps the same presentation reusable across applications with different services and business rules.

The principal source areas are:

| Directory | What to explore |
| --- | --- |
| `src/core/` | Contexts, signals, workspace presentation, UI snapshots, registry, and commands |
| `src/runtime/` | Widget and wrapper registries, classification, and binding adapters |
| `src/components/` | Windows, layouts, forms, tables, charts, chat, and workflow components |
| `src/reporting/` | Report documents, specifications, resolved datasets, and print models |
| `backend/` | Go metadata, file, and reporting services |
| `ios/` | `ForgeIOSRuntime` and `ForgeIOSUI` Swift packages |
| `android/sdk/` | Forge Android runtime and Compose UI library |

## Interface capabilities

### Metadata and widgets

Definitions can compose containers, controls, schema-based forms, and reusable imported fragments. Widget registries, classifiers, and state/event adapters allow applications to add controls or customize their behavior.

The web component exports include `WindowManager`, `LayoutRenderer`, `Container`, `ControlRenderer`, `FormRenderer`, `BasicTable`, `Editor`, `FileBrowser`, and `Chat`. Workflow primitives cover commands, collections, resource forms, uploads, schedules, and review-oriented interactions.

Read [widgets](doc/widgets.md), [widget extension APIs](doc/widget-runtime.md), and [workflow primitives](doc/workflow-primitives.md).

### Definition loading and resource models

The Go metadata service reads YAML through an abstract filesystem, resolves recursive imports, and decodes the effective definition. Window loading supports a directory with `main.yaml` or a single named YAML file, along with a sibling JavaScript action asset. Target-aware resolution lets hosts supply shared definitions and platform-specific branches.

A typical host-owned definition tree can be organized as:

~~~text
window/
  records/
    main.yaml
    main.js
  shared/
    record-form.yaml
~~~

Fragments may select a named subtree and receive scoped parameters:

~~~yaml
containers:
  - '$import(../shared/record-form.yaml:card, {"prefix":"record","readOnly":false})'
~~~

Inside a fragment, `$param(name)` reads the supplied value. Exact scalar substitutions preserve YAML types; embedded substitutions build names and selectors. Hosts choose the metadata base location and expose only the definitions appropriate to their application.

Schemas describe the client resource shape. Resource models map that shape to reader and writer contracts, including nested objects and collections. This supports a canonical form even when a service reads and writes different envelopes. Validation and declared marshalling keep fields, identities, and command inputs explicit.

See [resource models and marshalling](doc/workflow-primitives.md#resource-models-and-typed-marshalling) and [window parameters](doc/window-parameter-passing.md).

### Windows, layout, and appearance

Window management provides activation, tabs, dialogs, and parameter passing. Layout metadata controls nested panels, grid spans, content sizing, and scrolling. Hosts can adapt definitions using a target context such as:

```json
{
  "platform": "android",
  "formFactor": "phone",
  "surface": "app",
  "capabilities": ["markdown", "chart", "attachments"]
}
```

Themes and color modes are separate choices. Semantic tokens, workspace CSS on the web, and platform font settings let applications retain their visual identity. Native renderers use supported platform properties and tokens; arbitrary browser CSS is not a native styling mechanism.

Start with [container layout](doc/container-layout.md), [grid layout](doc/grid-layout.md), [window parameters](doc/window-parameter-passing.md), and [workspace styles](doc/workspace-styles.md).

### Datasources and actions

A datasource context separates the collection being displayed from the form being edited, selected records, query inputs, and request state. Controls use handlers to update those states or request a fetch. Connectors and action callbacks supply application behavior.

This makes interactions such as selecting a table row, editing its form, changing a filter, or running a declared command part of a consistent state model. Hosts remain responsible for validating inputs and authorizing every request. Permission metadata helps shape the interface and must be paired with server-side authorization.

See [datasource lifecycle](doc/data-source.md), [table behavior](doc/table-behavior.md), and [permission metadata](doc/permission-metadata.md).

### Reports and visual results

Forge renders report documents as structured blocks, including Markdown, KPI values, charts, tables, filters, and composed sections. The reporting model distinguishes the authored document, its compiled specification, resolved datasets, and print presentation.

`ReportDesigner` provides a controlled authoring surface. Applications can supply field catalogs and source providers, retain draft changes, and implement preview, run, and save callbacks. `ReportRuntime` renders the resulting content. Hosts own source execution, revisions, durable run identity, authorization, and artifact storage.

Inline content and progressive report updates can share the application's conversation or appear in a dedicated workspace. Chat and feed components are presentation surfaces; the host supplies their messages and activity state.

Read [reporting](doc/reporting.md), [designer embedding](doc/report-designer-embedding.md), [table formatting](doc/table-formatting.md), and the [durable report-run host adapter](doc/report-builder-report-run-host-adapter.md).

### UI inspection and commands

The UI registry and bridge expose structured snapshots and operations for windows, controls, filters, selection, focus, and dialogs. Applications can use these APIs for automation and custom integrations while keeping the same UI behavior used by people.

Agently Core owns MCP discovery, provider delivery, and the UI bridge. Forge supplies the renderer and UI command interfaces; the embedding application owns source execution and authorization.

The optional bridge and catalog service are configured by the host; datasource and permission contracts are covered in [datasource lifecycle](doc/data-source.md) and [permission metadata](doc/permission-metadata.md).

## Getting started

### Web library and previews

Use a supported Node.js environment with npm. From the repository root:

```sh
git clone https://github.com/viant/forge.git
cd forge
npm install
npm run dev
```

`npm run dev` starts Vite. For the report-builder preview, use:

```sh
npm run dev:report-builder-preview
```

Open `http://127.0.0.1:5175/report-builder-preview.html` for that preview. Its fixtures demonstrate rendering and interaction; connect your own services through a host application.

The package exposes entry points such as `forge/components`, `forge/core`, `forge/hooks`, `forge/actions`, `forge/reporting`, and `forge/report-designer`. A controlled designer can be embedded in an existing React application:

```jsx
import ReportDesigner from 'forge/report-designer';

<ReportDesigner
  report={reportDocument}
  datasets={fieldCatalog}
  expectedRevision={revision}
  onChange={(candidate) => retainDraft(candidate)}
  onPreview={({ report, signal }) => previewReport(report, signal)}
  onSave={({ report, expectedRevision, signal }) =>
    saveReport(report, expectedRevision, signal)}
/>
```

Those callbacks belong to the host application. Follow the [embedding guide](doc/report-designer-embedding.md) for their return contracts and conflict/cancellation behavior.

Build and run the repository's web checks with:

```sh
npm run build
npm test
```

Additional package scripts cover widget contracts, reporting, workflow primitives, workspace themes, and browser previews.

### Native libraries

The iOS package provides `ForgeIOSRuntime` and `ForgeIOSUI`, targeting iOS 17 or later. Integrate the local Swift package into your host application; it supplies rendering and runtime behavior rather than a complete authenticated app shell.

```sh
cd ios
swift build
swift test
```

The Android library uses Compose, Java 17, and a minimum Android SDK level of 26. Integrate android/sdk as a library module in a host Gradle project whose Android and Kotlin plugins match the SDK:

~~~kotlin
// Host settings.gradle.kts; adjust the relative path to your Forge checkout.
include(":forge-sdk")
project(":forge-sdk").projectDir = file("../forge/android/sdk")
~~~

~~~kotlin
// Host app/build.gradle.kts
dependencies {
    implementation(project(":forge-sdk"))
}
~~~

Build and test the integrated module through the host's configured Gradle wrapper.

Platform definitions and widgets should be validated on their intended device; a shared metadata contract does not imply identical behavior for every component.

### Go rendering services

The Go module declares Go 1.25.8. Download dependencies and test the Go packages from the repository root:

```sh
go mod download
go test ./backend/...
```

MCP providers and the UI bridge are implemented by Agently Core. YAML catalog authoring and import are owned by AI Studio.

## Documentation path

For a first integration, read these guides in order:

1. [Widgets and controls](doc/widgets.md) — choose the UI vocabulary.
2. [Datasource lifecycle](doc/data-source.md) — understand form, selection, collection, and request state.
3. [Container layout](doc/container-layout.md) and [grid layout](doc/grid-layout.md) — define sizing and scrolling.
4. [Window parameter passing](doc/window-parameter-passing.md) — connect related views.
5. [Workspace appearance](doc/workspace-styles.md) and [CSS classes](doc/container-css-classes.md) — customize presentation.
6. [Workflow primitives](doc/workflow-primitives.md) and [permissions](doc/permission-metadata.md) — wire application actions.
7. [Reporting](doc/reporting.md) and [designer embedding](doc/report-designer-embedding.md) — present and author structured results.

For individual components, consult [table behavior](doc/table-behavior.md), [table formatting](doc/table-formatting.md), [chat composer](doc/chat-composer.md), and [file browser](doc/file-browser.md).

## Contributing

Keep generic rendering and interaction behavior in Forge, with application policy and business operations in host integrations. Changes to metadata or bindings should include representative definitions and focused checks for affected renderers. For visual changes, inspect the result on the intended surface as well as running the relevant package tests.
