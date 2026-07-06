#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../.."

uv run --locked mkdocs build --strict
test ! -d site/superpowers/specs
test ! -d site/superpowers/plans
