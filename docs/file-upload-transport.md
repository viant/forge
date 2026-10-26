# Bounded file upload preparation

`uploadCollection.transport: files` passes browser File references to the upload
command's `prepare` handler. It performs type/count/size validation without reading
whole-file bytes. The handler must return a sanitized final parameter map for
the configured writer. File references are for local preparation, not connector
serialization. Both Go model validation and the control reject this transport
when the command has no preparation handler. Existing `mcpBlob` behavior remains
the default. That legacy name describes a serialized file shape, not a network
transport. Forge does not implement an MCP adapter; the host application owns
its connector and protocol integration.

Hosts can import `transferFileChunks` from `forge/core`. It reads one browser file
slice at a time, base64-encodes only that part, awaits the application's admitted
transport callback, validates its `nextOffset` acknowledgement, and then reads the
next part. The callback owns session IDs, datasource bindings, authorization,
validation and finalization; no business tool name or endpoint is built in.

```js
await transferFileChunks(file, {
  chunkBytes: serverReply.chunkBytes,
  signal,
  append: async ({offset, data, signal}) => {
    const reply = await admittedAppend({sessionId, offset, data, signal});
    return reply.receipt;
  },
  onProgress: ({sentBytes, totalBytes}) => updateProgress(sentBytes, totalBytes),
});
```

Chunk size is bounded at eight MiB, independent of total file size. The
application uses the backend's advertised part size, chooses an appropriate
command preparation timeout, and cancels its server session when abandoning an
upload. The helper does not retry failed operations or publish/create entities;
applications own those protocol decisions. Progress advances only after a valid
acknowledgement. A rejected or cancelled transfer stops before reading another
part. Empty files transfer zero parts and still require backend validation.

Native retained window actions receive the same helper as
`utilities.files.transferChunks`; an application need not embed another encoder
or install a window-specific React component.

Tests cover sequential reads, binary fidelity, bounded first read for a logical
multi-gigabyte file, cancellation, invalid part sizes and acknowledgements. This
does not establish full large-file or business-window E2E acceptance.

`UploadCollection` also honors its container's `disabledWhen` and `readOnlyWhen`
predicates for file selection, removal and submission. Container
`onSelectionChange` handlers receive `{context, execution, files, operation}`,
where `files` contains only `{name, size, type}` and `operation` is `select` or
`remove`. This lets authored forms lock metadata as soon as a file is selected,
without sharing browser File references or adding domain rules to the primitive.

## Confirming replacement and retaining the selection

`uploadCollection.replaceConfirmation` optionally prompts before accepting a new
selection when files are already selected. Cancel keeps the current selection
and payload and never reads the proposed file. Replace accepts the new selection
and then runs the existing type/count/size checks and preparation. An empty
chooser result leaves the current selection intact. The native chooser resets
after each proposal so the same path can be chosen again after cancellation.

`retainOnSuccess: true` keeps selected files after the writer succeeds. The
default remains false. Applications can use the command's existing `validateWhen`
to prevent resubmitting an acknowledged selection while still allowing a new
file proposal. Container availability blocks selection, removal and submission;
command guards and an open replacement confirmation block conflicting actions.
A guard/availability/command-identity change abandons a pending replacement.

```yaml
uploadCollection:
  multiple: false
  retainOnSuccess: true
  replaceConfirmation: Replace the selected file?
  upload:
    dataSourceRef: upload
    validateWhen: {source: form, field: uploaded, equals: false}
```

Confirmation and retention remain local file-selection behavior. Applications
own publication receipts, resource identity and retry/update protocols.
