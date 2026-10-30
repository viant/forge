# Application selection scope

`forge/utils/applicationScope` exports `createApplicationScope({windows, closeWindow})`.
It stores UI selection context in memory; it does not grant resource or data access.
The producer remains responsible for authorization.

A host configures the store with its authenticated workspace/session identity and
visible application metadata. Each participating application declares `scope.keys`,
for example `['entityId', 'entityName']`. Provider identity and application ID together
isolate selections. Changing session identity clears selections and ownership.

Register each menu-opened window with `register(window, application, action)`.
Descendants inherit ownership through `parentKey`. ResourceWindow binds its generated
inner ID to `hostServices.windowState.windowId` and removes that binding on unmount.
A standalone preview host must register its own scoped root; resource URIs do not
establish ownership.

Expose the store as `services.applicationScope`. Authored code calls
`context.handlers.applicationScope.get(context)` for a copy of current values and
`context.handlers.applicationScope.set(context, values)` to update declared keys.
A successful update returns `true`; unknown ownership or undeclared keys throw.
`null` clears a key. Missing declared keys never fall back to another focused window.

Changing a key invalidates dependent windows in the same application using their
menu parameter bindings and window parameters. The calling selector and its ancestors
remain open. No query or business action is replayed. The host supplies `closeWindow`
to dispose affected views. Report-specific values should remain in their own windows,
rather than being declared as shared application keys.

Use `inputs(application, focusedInputs)` when resolving subsequent menu actions and
subscribe to `revision` for reactive menu labels. Call `clear()` on logout. These
values are navigation context, never trusted identity or authorization facts.
