# Complete publication sources

`forge/release-manager` accepts an optional host-owned `publicationSource` when
an application can publish a complete captured collection through its existing
API. Without this prop, stamped artifact selection behaves as before.

```jsx
<ReleaseManager api={releaseAPI} channelKey={{namespace}}
  publicationSource={{
    label: 'Captured collection',
    ready: Boolean(selectedCollection),
    render: ({disabled}) => <CollectionPicker disabled={disabled}
      onChange={setSelectedCollection}/>,
    publish: ({key, description, policies, expectedRevision}) =>
      collectionAPI.publish({collection: selectedCollection.id,
        name: key.name, description, policies, expectedRevision}),
  }}/>
```

The manager presents a Release contents choice between stamped artifacts and the
host source. The host renders its native picker and complete selection summary,
sets `ready` after loading the selection, and propagates `disabled` to all source
controls. The source callback receives the existing channel key, description,
exact named-policy references and optimistic channel revision. It receives no
synthetic stamped roots. The host must return the same activation result contract
as `api.publish`; pending and failed results never count as activation.

Channel selection, policies, submission locking, progress, errors, activation,
promotion and rollback remain shared. Sources may not compute admission or
replace server validation. Optional stamped-root validation is shown only for
stamped selection. A source selection is published in full by its owning API.

`ReleaseManager.render.test.jsx` covers incomplete selection, exact callback
input, pending disabled controls, failed activation and switching back to the
unchanged stamped path. Existing tests cover confirmed activation, namespace
changes, revision conflicts, promotion and rollback. Hosts must additionally test
their own discovery, snapshot read and server publication workflow.
