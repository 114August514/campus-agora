# AI Log Todo

This file records meaningful pending work for AI agents and collaborators.
Keep entries short, dated, and actionable.

## Entry Format

```md
### YYYY-MM-DD - Task Title

- Source:
- Milestone:
- Status:
- Acceptance:
- Dependencies:
- Notes:
```

## Pending

### 2026-07-26 - Verify desktop CI check outside a nested worktree

- Source: `./scripts/ci/desktop.sh` could not run in the nested worktree at
  `.claude/worktrees/`, because the parent repository workspace claims
  `apps/desktop/src-tauri` and its `exclude` entry resolves to the main
  checkout path only.
- Milestone: M1.
- Status: open.
- Acceptance: `./scripts/ci/desktop.sh` passes in a flat checkout or in CI.
- Dependencies: none. `apps/desktop` is unchanged by M1, so this is an
  environment limitation rather than a code defect.
- Notes: no action needed if the CI desktop job stays green on the PR.
