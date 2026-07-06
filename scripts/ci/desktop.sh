#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../.."

cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
test -f apps/desktop/src-tauri/capabilities/default.json
grep -q '"core:default"' apps/desktop/src-tauri/capabilities/default.json
