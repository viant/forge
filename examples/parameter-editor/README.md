# Parameter editor

`parameterEditor` is a reusable Forge container primitive. Its React implementation
contains no Datly endpoints, codec registry, source-kind list, or auth rules.

The window supplies ordinary Forge `Item` metadata in `fields` and in collapsible
`sections`. Existing control bindings, lookup datasources, and change actions apply.
Optional `draft` metadata uses Forge's existing draft validation, save, reset,
confirmation, and mutation lifecycle. `readOnlyWhen` disables the entire editor,
including draft actions; backend authorization remains mandatory.

See `main.yaml` for the metadata contract. Replace its `example.*` MCP tool names
with the host's authorized tools. Custom codec identifiers are lookup values and
are preserved verbatim, including fully qualified package/type names.

Run `npm run dev -- --host 127.0.0.1 --port 18796` and open
`/parameter-editor-preview.html` for the explicitly local fixture demo.

Validation:

- `go test ./backend/types -run TestParameterEditorRoundTrip`
- `npx vitest run --maxWorkers=2 src/components/primitives/ParameterEditor.render.test.jsx src/components/WindowContent.lazyOptions.render.test.jsx`
