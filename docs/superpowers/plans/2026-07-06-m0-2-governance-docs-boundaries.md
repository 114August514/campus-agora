# M0.2 Governance Docs And Boundaries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete M0.2 by adding formal governance, product, architecture, engineering, and operations documentation without expanding runtime behavior.

**Architecture:** Treat documentation as the project control plane. Product docs define scope and data boundaries; architecture docs define system and permission boundaries; engineering docs define quality, LFS, seed/mock, and dependency rules; operations docs define deployment, security, environment, backup, monitoring, and runbook boundaries.

**Tech Stack:** Markdown, MkDocs, uv, existing Campus Agora monorepo.

---

## File Structure

- Create `docs/product/overview.md` for MVP scope, non-goals, roles, workflows, success metrics, and admin boundary.
- Create `docs/product/privacy.md` for data inventory, retention, access, export/delete, audit, anonymous semantics, and third-party sharing.
- Create `docs/product/milestones.md` for M0-M7 phase goals, deliverables, and exit criteria.
- Create `docs/architecture/overview.md` for monorepo boundaries, dependency direction, and frontend/backend ownership.
- Create `docs/architecture/backend.md` for Rust layering, DTO/domain/db boundaries, errors, config, observability, security, and tests.
- Create `docs/architecture/auth-permissions.md` for auth providers, roles, permission matrix, anonymous semantics, and audit requirements.
- Create `docs/architecture/desktop.md` for Tauri WebView, command bridge, capability policy, local storage/token boundaries, and release notes.
- Create `docs/engineering/lfs.md` for Git LFS paths, allowed content, forbidden content, and review checklist.
- Modify `docs/engineering/development.md` for frontend organization, API client usage, mock mode, component/design-system rules, UI copy, and dependency upgrades.
- Modify `docs/engineering/quality.md` for accessibility, UI regression, performance budgets, seed/mock, feature flags, version policy, dependency upgrades, and M0.2 review checklist.
- Create `docs/operations/overview.md` for environment isolation, backup/restore, monitoring, alerts, runbooks, and data repair.
- Create `docs/operations/security.md` for secrets, rate limiting, upload/download safety, Tauri security, data protection, audit, and retention.
- Modify `docs/operations/deployment.md` for deployment order, migration failure handling, rollback/forward-fix, version strategy, and smoke checks.
- Modify `docs/index.md` and `mkdocs.yml` to expose formal docs in navigation while keeping `docs/superpowers/**` excluded.
- Update `docs/ai-log/todo.md` and `docs/ai-log/done.md`.

## Tasks

### Task 1: Product Governance Docs

- [x] Create product overview with MVP, non-goals, roles, workflows, admin boundary, and success metrics.
- [x] Create privacy and data lifecycle doc with inventory, retention, deletion/export, access, audit, and third-party sharing boundaries.
- [x] Create milestones doc with M0-M7 deliverables and exit criteria.

### Task 2: Architecture Boundary Docs

- [x] Create architecture overview documenting monorepo ownership and dependency direction.
- [x] Create backend architecture doc documenting Rust crate layering, DTO/domain/db boundaries, config, observability, security, and tests.
- [x] Create auth/permissions doc documenting providers, roles, permission matrix, anonymous semantics, and audit requirements.
- [x] Create desktop doc documenting Tauri WebView, command bridge, capability policy, token/cache rules, and release/update placeholders.

### Task 3: Engineering Governance Docs

- [x] Create LFS doc matching `.gitattributes` paths and review policy.
- [x] Expand development doc with frontend organization, API client/mock usage, component/design-system rules, UI copy, and dependency updates.
- [x] Expand quality doc with accessibility, UI regression, performance budgets, seed/mock, feature flags, version strategy, and review checklist.

### Task 4: Operations And Security Docs

- [x] Expand deployment doc with migration failure handling, release order, rollback/forward-fix, version strategy, and smoke checks.
- [x] Create operations overview with environment isolation, backups, restore drills, monitoring metrics, alerts, runbooks, and data repair policy.
- [x] Create security doc with secrets, rate limits, upload/download safety, Tauri security, audit, data protection, and retention rules.

### Task 5: MkDocs, AI LOG, And Verification

- [x] Update `mkdocs.yml` nav to include all formal docs and continue excluding `superpowers/specs/**` and `superpowers/plans/**`.
- [x] Update docs index quick links for product, architecture, engineering, operations, and AI LOG.
- [x] Move M0.2 AI LOG task facts from todo to done.
- [x] Run `bun run ci:docs`.
- [x] Run `git diff --check`.
- [x] Verify `site/superpowers/specs` and `site/superpowers/plans` are absent.
