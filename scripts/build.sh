#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

bun run build
cargo build --workspace
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
