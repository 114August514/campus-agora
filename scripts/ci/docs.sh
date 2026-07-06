#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

cd "$repo_root/tools/docs"
uv run --locked mkdocs build --strict
test ! -d "$repo_root/site/superpowers/specs"
test ! -d "$repo_root/site/superpowers/plans"
