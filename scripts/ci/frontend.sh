#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../.."

bun run typecheck
bun run lint
bun run lint:styles
bun --cwd packages/api-client test
bun --cwd apps/web test
bun run build
