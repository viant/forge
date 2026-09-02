# File Browser

The FileBrowser container renders a navigable tree of files/folders from a DataSource collection and supports event hooks for customization.

## Styling

- Set height and width via `container.fileBrowser.style`.
  - Example: `height: "60vh"`, `width: "100%"`.

## Events

The file browser supports the following `on` events:

- `onInit`: Invoked on first mount when the collection is empty. Defaults to `dataSource.fetchCollection` if not provided.
- `onNodeSelect`: Invoked when any node is clicked. Defaults to `dataSource.toggleSelection` if not provided.
- `onFileSelect`: Invoked when a file node is clicked.
- `onFolderSelect`: Invoked when a folder node is clicked.
- `onPrepareTreeData` (new): Allows transforming the collection before building the tree. This can be used to filter, map, or normalize fields.

### onPrepareTreeData signature

- Input args: `{ collection, context }`
- Return:
  - An array (the transformed collection), or
  - An object `{ collection: [...] }`
  - If the handler throws or returns an invalid shape, the original collection is used.

### Node shape expectations

Each entry should have:

- `uri` (string) – unique identifier and path (required; if only `url` is present it will be copied to `uri`).
- `name` (string) – label; if missing, it will be derived from the last segment of `uri`.
- `isFolder` (boolean) – whether the node is a folder; if both `name` and `isFolder` are undefined, `isFolder` defaults to `false`.
- `childNodes` (array) – optional nested children.

## Metadata example

```yaml
containers:
  - id: files
    dataSourceRef: fs
    fileBrowser:
      style:
        height: "50vh"
      on:
        - event: onPrepareTreeData
          handler: my.file.transform
        - event: onFileSelect
          handler: my.file.open
```

## Action handlers example

Provide `actions.namespace` and `actions.code` in window metadata (or equivalent) so handlers are available by name.

```js
// actions.namespace: "my"
// actions.code (string):
({
  file: {
    // Transform the collection before FileBrowser builds the tree
    transform: ({ collection }) => {
      // Example: filter out hidden files and map url->uri
      const cleaned = (collection || [])
        .filter(n => !n.name?.startsWith('.'))
        .map(n => ({ ...n, uri: n.uri || n.url }));
      return cleaned;
    },

    // Example file open
    open: ({ item, context }) => {
      const uri = item?.nodeData?.uri;
      if (!uri) return;
      // Call your backend or emit an event
      console.log('Open file:', uri);
    },
  }
})
```

## Notes

- The parent-folder entry (`..`) is injected after `onPrepareTreeData` runs when applicable.
- Errors in `onPrepareTreeData` are caught and logged; the original collection is used as a fallback.

