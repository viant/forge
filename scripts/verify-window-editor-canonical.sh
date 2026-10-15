#!/bin/sh
# Reproduce editor schema from Forge's committed canonical models and contracts.
set -eu
forge_commit=$(git log -1 --format=%H -- backend/types backend/window/contract backend/datasource/contract)
if test -n "$(git status --porcelain --untracked-files=no -- backend/types backend/window/contract backend/datasource/contract)"; then
  echo 'Canonical backend models and contracts must be clean committed source.' >&2; exit 1
fi
task_dir=$(mktemp -d /tmp/forge-window-canonical.XXXXXX)
trap 'rm -rf "$task_dir"' EXIT
git archive HEAD backend/types backend/window/contract backend/datasource/contract | tar -x -C "$task_dir"
export GOWORK=off
go run ./scripts/window-schema --source "$task_dir/backend/types" --source-commit "$forge_commit" --descriptor-source "$task_dir/backend/datasource/contract" --window-source "$task_dir/backend/window/contract" --out "$task_dir/schema.json"
if test "${1:-}" = --generate; then
  cp "$task_dir/schema.json" src/window-editor/forgeWindowSchema.json
  sh scripts/build-window-canonical.sh
else
  cmp "$task_dir/schema.json" src/window-editor/forgeWindowSchema.json
fi
printf 'Canonical schema matches Forge models at %s\n' "$forge_commit"
go test ./backend/types
