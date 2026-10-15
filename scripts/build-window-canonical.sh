#!/bin/sh
set -eu
GOWORK=off GOOS=js GOARCH=wasm go build -trimpath -o public/window-editor/canonical.wasm ./scripts/window-bundle-canonical
cp "$(go env GOROOT)/lib/wasm/wasm_exec.js" public/window-editor/wasm_exec.js
