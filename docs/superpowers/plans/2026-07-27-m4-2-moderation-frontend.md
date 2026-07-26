# M4.2 Moderation And AI Drafting Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Complete M4 by making the governance loop operable: a moderation queue a reviewer can work through, a report control on any content, and an AI drafting surface where composed text is visibly composed and its sources are visibly its sources.

**Architecture:** Mirrors M2.2 and M3.2 — URL-backed filters, the request-sequence-number pattern in hooks, and frontend permission as an affordance over a server that decides. New this milestone: the shell reads capability flags, so a feature that is off on the server does not appear in navigation.

**Tech Stack:** React 18, Vite, react-router-dom 7, Bun test with happy-dom, the M4.1 client methods and mock.

---

## What Makes This Milestone Done

M4's exit criteria are met by M4.1 in the backend. Two of the three need a face before a person can rely on them:

1. **AI output is traceable, editable, and reviewable, and cannot publish itself.** The backend guarantees the last part structurally. The first three are only true if a reader can *see* that an entry was composed, *see* what it was composed from, and edit it in the ordinary editor. An entry that silently looks hand-written fails this criterion however correct the database is.
2. **Moderation actions produce audit events.** Backed by M4.1; the UI has to make the actions reachable, or the audit trail is of a workflow nobody can perform.
3. **Privacy and security docs cover third-party data before any provider is added.** Documentation, done in M4.1, and this phase must not quietly add a provider call.

## Two Decisions

**Capability flags reach the shell.** `AI_ARCHIVE_ENABLED` defaults to false, so the drafting control has to be absent — not present-and-failing — when the server does not have it. That means the shell fetches `/api/v1/meta` once and navigation is filtered by capability as well as by role. Today two navigation entries point at the home page: 归档助手 and 审核. Both become real, and 归档助手 appears only when the capability is on. A nav entry that leads nowhere is worse than no entry.

**Composed text is labelled where it is read, not only where it is edited.** The archive detail page already lists sources. It gains a visible marker saying the entry was drafted by a provider, next to the status badge, because a reader deciding whether to trust campus information needs that at a glance rather than in a section further down.

## Boundaries

In scope: the moderation queue page, the per-item report review, the report control on archive and discussion detail, the AI draft action on a discussion, the AI marker on an entry, capability-aware navigation.

Not in scope: bulk moderation actions, moderator notes, report analytics, and anything resembling automated triage — the milestone rules that out.

Further decisions:

- **The queue is a page, not a modal.** A reviewer works through it; that is a workspace, not an interruption.
- **Reporting is a form with a required category**, because the category is what determines the queue's ordering. A free-text-only report would make every item look alike.
- **The report control is hidden from a guest** and says what logging in adds, matching the correction and reply forms.
- **Only what the server will accept is offered**, as in M2.2 and M3.2: no report control on content the reader cannot see, and no AI action on a non-public discussion.

## File Structure

- Modify `apps/web/src/app/routes.ts`, `App.tsx`, `features/auth/navigation.ts`.
- Create `apps/web/src/features/moderation/{labels.ts,hooks/useModerationQueue.ts,hooks/useContentReports.ts,ui/ReportDialog.tsx}`.
- Create `apps/web/src/pages/ModerationQueuePage.tsx`.
- Modify `ArchiveDetailPage.tsx` (report control, AI marker), `DiscussionDetailPage.tsx` (report control, AI draft action).
- Create `apps/web/src/features/meta/useCapabilities.ts`.
- Modify `apps/web/src/styles/globals.css`, `pages/DesignSystemPage.tsx`.
- Modify `apps/web/tests/*`; add `apps/web/tests/moderation.test.tsx`.
- Modify `docs/product/milestones.md`, `docs/ai-log/{todo,done}.md`.

## Tasks

### Task 1: Capability-Aware Shell

- [x] Write failing tests: `visibleNavigationItems` filters by capability as well as role; 审核 points at the queue route; 归档助手 is absent when `aiArchiveEnabled` is false and present when true; the route table carries `/moderation`.
- [x] Implement `useCapabilities`, extend `NavigationItem` with a capability predicate, and add the routes.
- [x] Run `bun --cwd apps/web test` green.

### Task 2: The Moderation Queue

- [x] Write failing tests: a non-moderator sees the forbidden state rather than an empty queue; a moderator sees seeded items ordered worst-first with their risk and open-report count; an empty queue renders the empty state; a load failure renders the error state and retries.
- [x] Implement `useModerationQueue` and `ModerationQueuePage`.
- [x] Run the tests green.

### Task 3: Reviewing One Item

- [x] Write failing tests: opening an item lists its reports with category and message; dismissing one makes the item leave the queue when none remain; the content's status is unchanged by resolving. **Not covered:** a failed resolve surfacing the server's reason — the mock has no path that fails a resolve on an item the moderator can already see, so the assertion would test nothing. Logged rather than ticked.
- [x] Implement `useContentReports` and the review section.
- [x] Run the tests green.

### Task 4: Reporting Any Content

- [x] Write failing tests: the control is hidden from a guest and says what logging in adds; a report requires a category; submitting shows the filed state; a duplicate open report surfaces the server's 409 wording rather than a generic failure; the reported content stays visible, which is the rule that matters most.
- [x] Implement `ReportDialog` and wire it into both detail pages.
- [x] Run the tests green.

### Task 5: AI Drafting Where It Is Read And Where It Is Made

- [x] Write failing tests: the draft action is absent when the capability is off; a hand-written entry renders no marker, which is what makes the marker mean something. **Not covered through the page:** drafting navigating to the editor, and the marker on a composed entry — the shell's capability hook reads `/api/v1/meta`, and the page-level fixture cannot turn the mock's flag on for a statically imported client. Both rules are asserted at the client level in `packages/api-client/tests/client.test.ts` instead. Logged rather than ticked.
- [x] Implement the action and the marker.
- [x] Run the tests green.

### Task 6: Styles, Design System, Docs, Verification

- [x] A rule for every new class; the risk badges are on `/design-system` with the full-render test extended to require the section.
- [x] Update `docs/product/milestones.md` with M4's exit criteria checked against what was built, and move M4.1/M4.2 facts into `docs/ai-log/done.md`.
- [x] Run the full gate set against dockerized PostgreSQL 16.
- [x] Tick a checkbox only against work that exists; annotate any step whose delivered shape differs from this plan.
