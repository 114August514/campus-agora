# Agent Notes

Last updated: 2026-10-06

This file is the project-level instruction sheet for AI agents and human
collaborators. Follow it before making changes.

## Project Context

Read `docs/product/requirements-handoff.md` for the consolidated requirements
analysis v1.0. `docs/product/overview.md` summarizes decisions and
`docs/product/milestones.md` controls work order. The active direction is opportunity discovery
and actionable guidance across institutions and disciplines, initially serving
USTC students. The initial product is exclusively a personal-use tool; community
features are a possible future extension, not current scope or a scheduled phase.
Current planning stage: P2 task design and bounded implementation experiments,
following the requirements v1.0 baseline. The product
deliverable is a reusable discovery-to-action workflow. The user's AIDS mentor
search is its first real pilot, not a standalone advisor-list delivery goal or
the boundary of needs research. P1 explores product-wide users and opportunities
(research, study, internships, competitions, exchange, activities/notices); keep
research scope separate from the first implementation slice. On 2026-09-29
the user confirmed the first version is an advisor-selection guide (选导师指南)
that does not distinguish home-campus from external advisors, plus lightweight
entry/resource lookups; other opportunity types are not first-version scope.

The user authorized a product reset on 2026-09-22. The initialization spec at
`docs/superpowers/specs/2026-07-06-campus-agora-init-design.md` and the old M-series
community roadmap are historical, not active feature requirements. Do not revive
discussion, archival, campus-auth or desktop tasks merely because code or docs
already exist. Evaluate reuse against the new requirements. Existing engineering
checks still apply when relevant code is changed; this reset does not establish
that runtime behavior or CI has been freshly verified.

## Confirmed Requirements Decisions (2026-09-30)

Discovery and judgment jointly support autonomous choice; emphasis follows the
current task, with no mandatory complete journey. Experience-informed selection
also includes connecting users to knowledgeable current/former participants via
contacts published for relevant communication or shared with consent; preserve
relationship and time context, without automatic outreach or quality endorsement.
Supply direction is automation-led collection/organization with team review of
critical claims, exceptions and corrections. Community contributions may later
extend maintenance, but are optional and unscheduled, not a prerequisite for
individual value. This does not approve specific crawlers, private channels or
key-handling designs. Maintenance capacity and ownership remain unresolved.

## Competition Demo Priority (2026-10-01)

The immediate deliverable is a competition demo showing the value of finding and
organizing relevant information. Initial maintenance capacity is limited. Do not
make long-term staffing, recurring update schedules or sustainable operation a
prerequisite for requirements convergence or the demo. Dated material can still
support discovery and comparison when its time and intended use are clear; do not
present historical recruitment as currently open. Seek broad relevant coverage
without claiming exhaustive discovery. Distinguish fixed demonstration data from
actually executed automated collection. Decide ongoing maintenance investment
after assessing demonstrated value; do not revive a maintenance gate by default.

## Exploration and Discovery Approach (2026-10-01)

User accepted multiple persistent exploration topics with candidates, sources,
private reasons and open questions; reuse public data but retain separate topic
preferences. Browsing need not start with topic creation. The demo must actually
run external discovery alongside existing-data reuse. Use reusable research
instructions (skills or equivalent), executable tools/workflow and AI judgment as
complementary parts; choose providers, storage and frameworks through bounded
implementation experiments rather than treating product decisions as unresolved.
Do not re-ask these product decisions or claim implementation is complete.

On 2026-10-03 the user added result organization, existing-data merging,
failure continuation and isolation of private reasons across topics. Reuse
identified public objects, retain source/time and unresolved conflicts, and keep
private reasons attached to their topic records. The user explicitly confirmed
that external AI may receive only personal content the user explicitly selects;
do not automatically attach other notes, topics or prior private context. Follow
`docs/product/privacy.md` and the updated task design; this is a requirement,
not evidence of implemented isolation or AI integration.

The same day the user accepted cancellable discovery with declared per-run
limits, correction of mistaken merges without losing private topic records,
and truthful external-AI send states. Timeout or cancellation is not proof that
personal content was never sent; show delivery uncertainty when needed.
Thresholds and mechanisms remain technical-design choices, not fixed budgets
or evidence of implementation. These accepted requirements remain active in
`docs/product/advisor-task-design.md` v0.4; the later experiments below do not
establish that cancellation, mistaken-merge repair or external AI are implemented.

On 2026-10-04 the user selected Xiaohongshu recruitment posts as the first
browser-collection pilot, intending to reuse an available logged-in session.
Search and text reading were executed, but sign-in was not performed or verified.
Normal search/read using the available connected session is within this task. The repository draft
`tools/skills/opportunity-discovery/SKILL.md` organizes this work; invoke it
explicitly, since it is not installed in an automatic skill directory. An executed
small batch can be displayed as precollected summaries, distinct from live API
discovery. This does not imply a standalone unattended collector, access to a
different Chrome session, private-message harvesting or automatic outreach.

On 2026-10-05 the user authorized a user-assisted sign-in trial from a signed-out
session. Follow the skill's handoff: the agent opens the site's login entry; the
user completes QR scanning, credentials or CAPTCHA; then verify visible sign-in
state and actual search/body reading separately. A new tab does not isolate login.
Use a tool-supported isolated session or obtain explicit agreement before signing
out an existing session. Do not save credentials, QR codes or authentication screens.
The observed Xiaohongshu session is signed in. The IAB exposes only one normal
profile, without an isolated-session capability. Bilibili visibly showed a signed-out
entry; its original-site login window was shown to the user. After the user reported
completion, fresh UI inspection confirmed the login prompt disappeared and account
navigation appeared. The agent then searched for advisor-selection information and
read a relevant article's text body. Existing sessions were not signed out. This
verifies an assisted Bilibili sign-in and resumed-reading trial, not that reading
requires login, future authentication will persist, Xiaohongshu sign-in was tested,
or the application includes a Bilibili collector. The article was technical reading
verification only, not a new advisor batch or requirements evidence.

On 2026-10-05 a bounded choice-support experiment was implemented in the Web
demo using the two actually collected Jiang/Song candidates. Research/graduate/
short-term perspectives, optional research focus, specific source summaries and
topic-scoped private records are usable. The source-bound interpretations are
curated from the existing batch, not integrated model output or live collection.
Compare selection and perspective are temporary; explicitly saved records use
the existing topic store, and comparison removal does not delete them. This is
developer verification, not a student benefit result or complete demo acceptance;
preparation/resource/contact entries and general choice-help automation remain
subsequent work. See advisor-task-design.md v0.4 §8.4.

## Requirements Analysis Work Order

Before prioritizing prototype or implementation work, follow the eight-part
analysis contract in `docs/product/requirements.md`: problem background, target
users/tasks, existing solutions, unmet needs/causes, value/positioning,
scope/priorities, functional/use requirements, and feasibility/acceptance.
The eight-part argument is now organized into a reviewable baseline; current
priority is to apply its conclusions to task and information-structure design,
filling only decision-relevant gaps. Feature lists, preparation cards and a working
prototype do not substitute for it. Keep user needs separate from solution
ideas and product-wide research separate from the AIDS pilot. Prototypes can
test hypotheses without waiting for every unknown to disappear; do not claim
unvalidated benefit or let UI migration displace the analysis by default.

## Evidence Reuse and Analysis Handoff

User confirmed on 2026-09-27: adopt existing evidence within its stated scope;
do not repeat research merely because it does not prove population prevalence
or product efficacy. `docs/product/requirements-handoff.md` is the consolidated v1.0 baseline;
`docs/product/needs-analysis.md` retains detailed reasoning, H/V definitions and
historical records, not a second active backlog. Continue task/information-structure
design from the v1.0 baseline.
H1–H6/V1–V5 are targeted validation tools, not universal sequential gates.
Only add research that could change a concrete decision; otherwise limit the
claim, defer the optional capability, or observe during trial. Missing task
recall or voluntary participants does not block independent planning. Do not
claim measured benefit, full P1 validation or sustainable supply has passed.

## Product Focus and Depth

Follow the focus hierarchy in `docs/product/overview.md`: discovery, understanding
and comparison are core; preparation guidance supports decisions; resources
connect users to suitable courses, tools and services and may be searched directly.
Keep guidance at preparation priorities, reasons and optional paths. Chapter links
are optional details, not a per-resource requirement. Do not expand into teaching
individual concepts, exercise grading or learning-outcome tests. The Python lesson
walkthrough is supporting research, not an active task or P1 exit requirement.
Before adding research or work, name the discovery/comparison/next-step decision
it improves and the minimum depth needed. Keep cross-user research broad; this
correction does not narrow the product to the mentor pilot.

Experience-informed selection is a common problem across opportunities and
resources, not only advisors, jobs or long-term relationships. Apply source/context,
conflict, unknown and private-judgment handling across scenarios; vary the actual
questions by task. Deeper examination is optional, and a simple entry-point lookup
may end immediately. Broader scope is a user decision, not evidence that all
scenarios have equal demand or equally available experience data.

## Optional Support Principle

Follow the optional-help principle in `docs/product/overview.md`. Offer resources
without implying every opportunity matters or every student must keep advancing.
Browsing or saving is not a commitment. Pausing or declining is valid even when
eligible; no explanation is required. Separate official obligations from optional
suggestions. Avoid grade-based pressure, deficit checklists, social comparison and
unsolicited reminders. Evaluate clarity and task resolution, not activity volume;
do not claim anxiety reduction without evidence.

Participation motives (enjoyment, shared activity, formal recognition, learning
or career goals) may overlap and change. Do not rank them or infer them from
contest type/year; no mandatory motive questionnaire. Physics competition is one
sample, not the contest scope. Distinguish contest prizes, comprehensive evaluation,
credits/GPA and other recognition; only applicable rules support eligibility.

## UI Rules

Follow `docs/product/ui-system.md` before any UI or prototype work. Use only Primer React Product UI + Primer Primitives + Octicons. No Tailwind, handwritten CSS/CSS Modules, inline style, sx or CSS-in-JS. Use library layouts and one declarative theme configuration. Fix light neutral palette with Primer blue interaction, system sans-serif and normal letter spacing. Ban emoji icons, eyebrows, subtitles/taglines, gradients, bordered content cards, display monospace and tracking. Keep necessary field borders and keyboard focus. The current Web app uses Primer; the historical HTML prototype remains superseded and is not a compliant template. Reference sites inform interaction only; they cannot override these rules.

## Collaboration Rules

- Read the relevant local context before editing: this file, the active spec,
  applicable docs, package scripts, and nearby source files. Reuse context
  already read in the session; reread when it changes or is no longer reliable.
- Before changing a product, frontend, backend, API, operations, desktop, or
  monorepo boundary, read `docs/constraints/index.md` and the area-specific
  constraint reference listed there.
- If a constraint reference becomes an accepted project rule, promote it into
  the matching formal doc or milestone in the same change.
- Keep changes scoped to the active task and milestone. Do not expand runtime
  behavior, dependencies, or documentation structure unless the task requires it.
- Prefer existing workspace conventions over new abstractions.
- Before editing files, state what will change and why.
- Verify changes with the narrowest meaningful command set, and report commands
  that were run or could not be run.
- Do not claim work is complete without fresh verification evidence.

## Rapid Iteration Default (2026-10-03)

The user prefers short feedback loops and autonomous execution. Apply the
iteration guidance in `docs/engineering/development.md` proportionally:

- Clear small changes go directly to implementation and meaningful checks.
  Normal features need only a short plan in the turn or existing task record;
  research/design first only when an unknown blocks the current result.
- Authorized implementation includes running, observing and fixing the result.
  Continue until the requested outcome is verified; decide routine reversible
  details without repeated confirmation, using existing project conventions.
- Reuse current context and existing logs. Update durable docs for changed
  decisions, contracts or handoff facts; use focused checks during edits and
  affected required checks at completion. Review and extra testing respond to
  substantive risk or new failures, not every microtask.

## AI Log Workflow

Use `docs/ai-log/` for low-friction task memory. It complements issues,
milestones, commit history, and PRs; it does not replace them.

For non-trivial agent work:

1. Add or update an entry in `docs/ai-log/todo.md` when a task starts, when a
   blocker is found, or when a follow-up becomes clear.
2. Move completed task facts into `docs/ai-log/done.md` before final handoff.
3. Keep entries short, dated, and tied to concrete files, commits, commands, or
   follow-up decisions.

`todo.md` should record what needs to happen:

- task title and source
- priority or milestone
- acceptance criteria
- dependencies or blockers
- owner/status when useful

`done.md` should record what actually happened:

- completed work
- changed files or commits
- verification commands
- important decisions and tradeoffs
- follow-up tasks that remain

Do not log every terminal command. Do not write secrets, tokens, credentials,
real student identity data, private callback URLs, database dumps, or raw
unredacted logs into AI LOG files.

## Documentation Freshness

Docs can become stale and affect implementation judgment. Treat code, scripts,
contracts, lockfiles, and current CI as the freshest source for executable
behavior.

For durable docs that guide decisions, add or update a `Last updated:
YYYY-MM-DD` line near the top when creating the file or making a material
change. This applies to formal docs under `docs/`, reference docs under
`docs/constraints/`, tool docs such as `tools/README.md`, and this file.

Do not change the date for typo-only edits. If an existing doc has no freshness
line and the task depends on it, verify the claim against local source files
before relying on it, then add the freshness line if the doc is updated.

When a documented command, path, config location, API contract, milestone, or
security boundary changes, update the relevant doc in the same PR and record the
verification command in AI LOG when the work is non-trivial.

## Local Reference Files

Durable reference notes belong under `docs/constraints/`, not in the repository
root. Do not create new root-level scratch files such as `ref*.md`, `temp*.md`,
`api.md`, `backend.md`, `frontend.md`, or `monorepo.md` unless the user
explicitly requests a short-lived local note.

When a root-level reference note is useful for collaboration, rename it into
`docs/constraints/`, add it to `docs/constraints/index.md`, and update MkDocs
navigation if it should be published.
