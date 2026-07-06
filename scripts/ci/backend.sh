#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../.."

cargo fmt --all --check
cargo check --workspace --all-targets
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
cargo sqlx migrate run --source crates/db/migrations
cargo run -p campus_agora_api --bin export-openapi -- contracts/openapi.json
