# Report output delivery

`useReportOutput` accepts an optional `onDownload(artifact, format, options)`
callback. When omitted or null, complete exports keep the existing browser Blob download.
Print preview is unchanged. The callback is generic; Forge does not depend on a
host protocol or add a second report authorization decision.

Before invoking a host, Forge preserves the ordinary download checks: supported
and matching format, no incomplete datasets, and decodable base64 bytes. A host
receives the original validated artifact and `{signal, isCurrent}`. Delivery is
awaited; a rejection is visible through the hook's existing output error state.
A missing host capability must reject explicitly rather than use a browser
fallback in a sandbox. A host protocol's unsuccessful result must also reject.

The host must pass the signal to cancellable requests and check `isCurrent()`
before committing delivery after any asynchronous confirmation. A file already
delivered cannot be recalled. Forge prevents obsolete producer results from
invoking the callback, aborts pending delivery on cancellation, unmount or scope
change, and ignores a late acknowledgement instead of replacing newer state.

```jsx
const output = useReportOutput({
  scopeKey,
  onExport,
  onDownload: async (artifact, format, {signal, isCurrent}) => {
    if (!canDownload) throw Error('This host does not support file downloads.');
    if (!isCurrent()) return;
    await deliverFile(artifact, format, {signal, isCurrent});
  },
});
```

`deliverFile` is supplied by the embedding host and owns its capability and
confirmation behavior. The ordinary browser path remains the default. Run the
existing output rendered tests and `node scripts/test-report-output-download-browser.mjs`
for the independently authored synthetic CSV browser fixture.
