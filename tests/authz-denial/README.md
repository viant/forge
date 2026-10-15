# Protected datasource denial browser fixture

From the Forge root, run `npm run dev -- --host 127.0.0.1 --port 5178` and open
`http://127.0.0.1:5178/tests/authz-denial/preview.html` in a browser.

The page mounts the real `WindowContent` and `DataSource` components with a
protected metadata snapshot and one prior result row. Either button makes the
next datasource refresh return an upstream 401 or 403. The window must replace
its content with the matching authentication or access-denied alert, and
`window.authzDenialFixture.state()` must show `rows: []` and the matching
denial status. Reload the page between checks.

The fixture intercepts only its local `/fixture/window/` and `/fixture/rows`
requests. It has no credential or external service dependency.
