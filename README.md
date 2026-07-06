# Campus Agora

Campus Agora is a campus discussion and knowledge archive platform. This repository is currently in the M0 Repository Skeleton stage.

## Requirements

- Bun
- Rust stable with `rustfmt` and `clippy`

## M0 Commands

```bash
bun install
bun run dev:web
cargo run -p campus_agora_api
bun run typecheck
bun run build
cargo check --workspace --all-targets
cargo test -p campus_agora_api
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
```

The M0 API exposes:

- `GET /healthz`
- `GET /api/v1/meta`
