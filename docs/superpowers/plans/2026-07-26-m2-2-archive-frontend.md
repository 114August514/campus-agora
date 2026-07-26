# M2.2 Archive Frontend Flows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete M2 by delivering the archive list, detail, and editor flows on a shared component system, so a knowledge entry can be created, updated, versioned, and corrected through the UI as well as the API.

**Architecture:** `components/ui` gains the primitives the flows need, driven entirely by design tokens. `components/icons` becomes the single Lucide entry point. A router makes entries addressable by URL, which the product depends on — durable knowledge has to be linkable. `features/archive` owns the server-state hooks and feature UI; `pages` only composes. A `/design-system` page renders every primitive and state so the visual system has a human check.

**Tech Stack:** React/Vite, react-router-dom, lucide-react, Bun test, existing `@campus-agora/api-client`.

---

## Why A Router

`apps/web` currently renders one page. M2's core scope is "前端 archive list/detail/editor flows", and the product positioning doc defines the archive as knowledge that can be searched, versioned, and **referenced**. An entry that cannot be linked to fails that purpose, so the flows need real URLs rather than internal view state. The canonical spec already anticipates `app/router.tsx` and route-level pages, so this follows the documented structure rather than inventing one.

`react-router-dom` and `lucide-react` are the two new dependencies. Lucide is already mandated by `docs/engineering/development.md` ("Use Lucide rounded outline icons with 2px stroke") and by the spec's icon rules, which also forbid hand-written SVG in pages.

## Boundaries

In scope: `components/ui` primitives, `components/icons`, router, archive list (search, filter, pagination), archive detail (metadata, revisions, corrections), archive editor (create and edit), status transitions, `/design-system`, and the loading/empty/error/unauthorized states each flow needs.

Not in scope: discussion flows (M3), moderation queue (M4), AI drafting (M4), full-text search (M5 and a documented M2 non-goal), attachments, i18n framework, Toast/Modal/Drawer/Dropdown/Tabs primitives that no M2 flow uses.

Decisions:

- **Tokens first.** The flows need semantic status colors, elevated surfaces, and a z-index scale that `tokens.css` does not yet define. Tokens are added before components, so no component invents a value. Both light and dark themes stay in sync.
- **Primitives built:** `Input`, `Textarea`, `Select`, `Card`, `Badge`, `EmptyState`, `LoadingState`, `ErrorState`, `Pagination`, plus `Button` gaining `ghost`/`danger` variants and a `loading` state. Each covers the states the spec requires: hover, focus-visible, disabled, error where applicable.
- **Form errors are text, never colour alone**, and inputs wire `aria-invalid` plus `aria-describedby` to their message, per the accessibility rules in `docs/engineering/quality.md`.
- **Server state** lives in `features/archive/hooks`. No page calls `fetch`; every request goes through `@campus-agora/api-client`.
- **Permission in the UI is an affordance only.** Buttons hide when the action is unavailable, but the backend remains the boundary — the same rule the guarded shell already follows.
- **Copy stays Chinese** and reuses the existing label constants pattern from `features/auth/labels.ts`.
- **Mock fixtures stay overridable rather than relocated.** `createCampusAgoraMockFetch` already accepts a `users` override, so app-specific fixtures can be injected from `apps/web` without a separate fixtures module that no flow needs yet. `VITE_API_MOCK=true` selects mock mode, and the test setup sets it so component tests never reach a server.

## File Structure

- Modify `apps/web/package.json` (deps), `apps/web/src/styles/{tokens,themes,globals}.css`.
- Create `apps/web/src/components/icons/index.ts`.
- Create `apps/web/src/components/ui/{Input,Textarea,Select,Card,Badge,EmptyState,LoadingState,ErrorState,Pagination}.tsx`; modify `Button.tsx`.
- Create `apps/web/src/app/routes.ts` (the route table as data); modify `app/App.tsx` and `main.tsx`.
- Create `apps/web/src/features/archive/{labels.ts,hooks/useArchiveList.ts,hooks/useArchiveEntry.ts,ui/*}`.
- Create `apps/web/src/pages/{HomePage,ArchiveListPage,ArchiveDetailPage,ArchiveEditorPage,DesignSystemPage}.tsx`.
- Create `apps/web/tests/{tokens.test.ts,ui.test.tsx,routes.test.ts,archive.test.tsx,setup.ts}`.
- Modify docs: `docs/engineering/development.md`, `docs/engineering/quality.md`, `docs/product/milestones.md`, `docs/ai-log/{todo,done}.md`.

## Tasks

### Task 1: Plan And AI Log

- [x] Save this plan and point the M2.2 todo entry at it.
- [x] Record the two new dependencies and why in the plan and later in the PR description.

### Task 2: Tokens And Theme

- [x] Write a failing test asserting every token the components use is defined in `tokens.css`, and that `themes.css` overrides the same colour token names (a dark theme missing a token silently falls back to the light value).
- [x] Add semantic tokens: `--color-success`, `--color-warning`, `--color-info`, `--color-danger-hover`, `--color-hover`, `--color-selected`, `--color-border-strong`, `--shadow-overlay`, `--z-dropdown`, `--z-toast`, `--z-modal`, `--font-size-xxl`, `--space-12`, `--duration-medium`.
- [x] Mirror every colour token in the dark theme.
- [x] Run `bun --cwd apps/web test` green.

### Task 3: Icons And UI Primitives

- [x] Add `react-router-dom` and `lucide-react`; commit the lockfile.
- [x] Create `components/icons/index.ts` re-exporting only the icons the flows use, with the documented `strokeWidth={2}` default.
- [x] Write failing tests for the primitives: `Button` renders `ghost`/`danger` and disables itself while `loading`; `Input`/`Textarea`/`Select` associate a label, expose `aria-invalid` and `aria-describedby` when given an error, and render the error as text; `Badge` maps a moderation status to its tone; `EmptyState`/`LoadingState`/`ErrorState` render a readable title and an actionable next step; `Pagination` disables the boundary controls and reports the page range.
- [x] Implement the primitives with token-only styling.
- [x] Run `bun --cwd apps/web test` green.

### Task 4: Router And Page Shell

- [x] Write a failing test for the route table: `/`, `/archive`, `/archive/new`, `/archive/:id`, `/archive/:id/edit`, `/design-system`, and an unknown path resolving to a not-found view.
- [x] Implement `app/routes.ts`, wire `BrowserRouter` in `main.tsx`, and make `AppShell` navigation use `NavLink` so the active entry is marked.
- [x] Keep the guarded-shell rule: navigation entries stay filtered by session and role.
- [x] Run typecheck and tests green.

### Task 5: Archive List Flow

- [x] Write failing tests for `useArchiveList`: it starts in loading, exposes the paginated envelope, and keeps `q`/`tag`/`category`/`page` in the URL query so a filtered list is linkable. *(The error-with-retry and page-reset assertions were not written; tracked in `docs/ai-log/todo.md`.)*
- [x] Implement the hook and `ArchiveListPage` using `Card`, `Badge`, `Input`, `Select`, `Pagination`, `EmptyState`, `LoadingState`, `ErrorState`.
- [x] Show a "创建资料" action only when the session allows it.
- [x] Run tests green.

### Task 6: Archive Detail Flow

- [x] Write failing tests for `useArchiveEntry`: maps 404 to a not-found view rather than an error, and offers only the transitions the caller may actually perform. *(Loading with content, and the file/resolve refresh cycle, are covered at the application and API layers rather than through the hook; tracked in `docs/ai-log/todo.md`.)*
- [x] Implement `ArchiveDetailPage`: metadata block, body, revision history, correction list with a filing form, and the status actions the viewer may take.
- [x] Run tests green.

### Task 7: Archive Editor Flow

- [x] Write failing tests: the editor validates title and body before submitting and wires each error to its input. *(Server-422 surfacing, create-then-navigate, edit-mode loading, and in-flight blocking are not covered by a frontend test; tracked in `docs/ai-log/todo.md`.)*
- [x] Implement `ArchiveEditorPage` for both create and edit, reusing the form primitives.
- [x] Run tests green.

### Task 8: Design System Page And Mocks

- [x] Write a failing test asserting `/design-system` renders a section per primitive plus the loading, empty, error, unauthorized, and forbidden states.
- [x] Implement `DesignSystemPage` and route the app through mock mode under test rather than adding a fixtures module no flow reads.
- [x] Run tests green.

### Task 9: Docs And Verification

- [x] Update `docs/engineering/development.md` (component inventory, router, icon entry point, mock fixture location) and `docs/engineering/quality.md` (the `/design-system` review checklist).
- [x] Set M2 to 已完成 in `docs/product/milestones.md` once every exit criterion is met, and record both delivery phases.
- [x] Run the full gate set: `bun run typecheck`, `lint`, `lint:styles`, `test`, `build`, `cargo test --workspace`, `bun run api:check`, `bun run ci:docs`, `git diff --check`.
- [x] Move M2.2 facts into `docs/ai-log/done.md` and close the todo.
- [x] Commit in reviewable increments.
