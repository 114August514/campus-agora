# Contributing

Keep changes scoped to the active milestone. M0 work should only establish the runnable repository skeleton.

Before submitting changes, run the checks that match the files you touched:

```bash
bun run typecheck
bun run build
cargo fmt --all --check
cargo check --workspace --all-targets
cargo test --workspace
```

Do not commit local secrets, `.env` files, generated logs, database dumps, or reference scratch files.
