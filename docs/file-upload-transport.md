# Bounded file upload preparation

`uploadCollection.transport: files` passes browser File references to the upload
command's `prepare` handler. It performs type/count/size validation without reading
whole-file bytes. The handler must return a sanitized final parameter map for
the configured writer. File references are for local preparation, not connector
serialization. Both Go model validation and the control reject this transport
when the command has no preparation handler. Existing `mcpBlob` behavior remains
the default.

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
