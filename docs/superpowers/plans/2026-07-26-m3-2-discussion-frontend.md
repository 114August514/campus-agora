# M3.2 Discussion Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Complete M3 by giving the discussion-to-archive loop a face: discussion list, detail, and reply flows, a promote-to-archive action, and source links shown from both ends — with the two kinds of content visibly and structurally distinct.

**Architecture:** Mirrors the M2.2 archive frontend. Filters live in the URL, hooks use the request-sequence-number pattern so a stale response can never overwrite a newer one, and every permission check in the UI is an affordance over a server that decides. Discussions get their own route namespace and their own information architecture rather than a restyled archive page.

**Tech Stack:** React 18, Vite, react-router-dom 7, Bun test with happy-dom, the M3.1 client methods and mock.

---

## The Third Exit Criterion

M3's exit criteria are met by M3.1 except for one: *UI 区分 discussion content 与 durable archive content*. A different accent colour would technically satisfy a reading of that sentence and would satisfy nothing real. The distinction has to be **structural** — the two kinds of content answer different questions, so they show different things:

| | Discussion | Archive entry |
| --- | --- | --- |
| What it is for | Getting an answer now | Being useful in a year |
| Signals shown | Reply count, accepted answer, last activity | Version number, applicable audience, provenance, category |
| Its lifecycle | Open → closed (`archived`) | Draft → published → maintained through corrections |
| Its affordance | Reply, accept the useful answer | File a correction, read the history |
| Where it points | The entries it produced | The discussions it came from |

Two consequences the plan commits to:

- **Separate namespaces.** `/discussions/*` and `/archive/*`. A discussion is never rendered by an archive component.
- **The loop is visible from both ends.** A discussion shows what it produced; an entry shows where it came from, naming the person who wrote the quoted text. Without both, "traceable source context" is a database property nobody can see.

## Boundaries

In scope: discussion list, detail, and create flows; replying; accepting an answer; archiving/reopening a thread; promoting a discussion or a reply into an archive draft; derived-entry and source-link display; navigation.

Not in scope: editing a discussion's body after creation (the backend has no discussion update endpoint — M3.1 deliberately did not add one, since a thread's opening post is a question rather than maintained knowledge), reply editing or deletion, threading, reactions, and notifications.

Decisions:

- **Promotion lands in the archive editor.** `POST /promotions` creates a draft the promoter owns; the UI then navigates to `/archive/{id}/edit`. Promoting is the *start* of curating, not the end — dropping the user on a read-only draft they still have to find and edit would be a worse loop than the one M3.1 built.
- **Promotion is offered per-reply and once for the thread.** The accepted answer is the most likely thing worth sedimenting, so its promote control is the prominent one.
- **Only what the server will accept is offered.** `archived` and `draft` threads show no reply box; a non-public thread shows no promote control. Rendering a button that guarantees a 409 is worse than rendering none, and this rule already has a test in `navigation.test.ts` for archive transitions.
- **Guests read everything public and are told what login adds**, matching the archive detail page's correction form.

## File Structure

- Modify `apps/web/src/app/routes.ts`: `discussionList`, `discussionNew`, `discussionDetail`, plus path builders.
- Modify `apps/web/src/app/App.tsx`: three routes.
- Modify `apps/web/src/features/auth/navigation.ts`: point 讨论 at the real route.
- Create `apps/web/src/features/discussion/labels.ts`: status labels reused from archive where they mean the same thing, plus discussion-specific copy.
- Create `apps/web/src/features/discussion/hooks/useDiscussionList.ts` and `useDiscussion.ts`.
- Create `apps/web/src/pages/DiscussionListPage.tsx`, `DiscussionDetailPage.tsx`, `DiscussionEditorPage.tsx`.
- Modify `apps/web/src/pages/ArchiveDetailPage.tsx`: the 内容来源 section.
- Modify `apps/web/src/features/archive/hooks/useArchiveEntry.ts`: load sources alongside the entry.
- Modify `apps/web/src/styles/globals.css`: rules for every new class.
- Modify `apps/web/src/pages/DesignSystemPage.tsx` if a new primitive appears.
- Modify `apps/web/tests/*`: route table, navigation, and the flows.
- Modify `docs/product/milestones.md`, `docs/ai-log/{todo,done}.md`.

## Tasks

### Task 1: Routes, Navigation, And Their Tests

- [x] Extend `apps/web/tests/navigation.test.ts`: `ROUTE_PATHS` contains the three discussion routes; `discussionDetailPath` builds `/discussions/{id}`; the 讨论 nav item points at `ROUTES.discussionList` rather than home.
- [x] Run the test and watch it fail.
- [x] Add the routes, the path builders, the nav target, and the `App.tsx` entries.
- [x] Run `bun --cwd apps/web test` green.

### Task 2: The Discussion List

- [x] Write failing tests: the list renders a seeded discussion with its reply count and accepted-answer marker and *without* archive metadata; an empty result renders the empty state; the page reads its filters from the URL; a guest is not offered the create action. **Not covered:** the error-with-retry path and the page-reset-on-filter-change, which remain open from M2.2 for the archive list too and are logged in `todo.md` rather than ticked here.
- [x] Implement `useDiscussionList` with the request-sequence-number pattern and URL-backed filters, and `DiscussionListPage`.
- [x] Run the tests green.

### Task 3: The Discussion Detail And Replies

- [x] Write failing tests: a discussion renders its body, reply count, and replies oldest-first; the accepted answer is marked; a guest sees no reply box and is told logging in is what adds one; an archived thread shows no reply box and says it is closed; a failed reply keeps the text the reader typed; a 404 renders the not-found state rather than an error.
- [x] Implement `useDiscussion` (detail, replies, and derived entries in one load; reply, accept, and status actions) and `DiscussionDetailPage`.
- [x] Run the tests green.

### Task 4: Promotion And Both Ends Of The Loop

- [x] Write failing tests: the promote control appears on a published thread and on each reply and is absent on a draft; promoting navigates to the new draft's editor; a discussion lists the entries it produced, and a guest sees neither the draft nor a broken section; an archive entry names its source discussion, says whether a post or a reply was promoted, and renders no source section when it has none. **Not covered:** the promote control on an *archived* thread — the rule is asserted at the `canPromote` level and in the client tests, not through the page.
- [x] Implement the promote actions, the derived-entry section, and the source section on the archive detail page (extending `useArchiveEntry` to load sources).
- [x] Run the tests green.

### Task 5: Styles And The Design System

- [x] Add a rule for every new class name; `styles.test.ts` fails otherwise, which is how M2 shipped fifteen unstyled classes. Also added a guard for *composed* variant classes (`badge-${tone}`), which the coverage check skips by design and which is how `badge-info` would have shipped unstyled.
- [x] Add `ButtonLink` to `/design-system` with an assertion that it renders one `<a>`, not a nested button.

**Beyond the plan, in the path of this work:**

- [x] `ButtonLink` itself. The M2 review logged `Button`-inside-`Link` in eight places as invalid HTML costing two tab stops per action. M3.2 adds four more navigation-as-action controls, so the choice was to grow a known-bad pattern to twelve and file another todo, or close it. Closed, with a test that fails if any page reintroduces the nesting.
- [x] `ui.test.tsx` had no `afterEach(cleanup)`. Every test file shares one `document`, so its components stayed mounted and made an unrelated file's queries ambiguous. It passed by luck of ordering until a new file changed that ordering.

### Task 6: Docs And Verification

- [x] Update `docs/product/milestones.md`: M3 to 评审中 once both phases exist, with the exit criteria stated against what was built.
- [x] Run the full gate set: `cargo fmt --all --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace` against dockerized PostgreSQL 16, `bun run api:check`, `typecheck`, `lint`, `lint:styles`, `test`, `build`, `ci:docs`, `git diff --check`.
- [x] Move M3.2 facts into `docs/ai-log/done.md`; tick a checkbox only for what exists.
- [x] Commit in reviewable increments and request an adversarial review.
