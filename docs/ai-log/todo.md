# AI Log Todo

Last updated: 2026-10-14

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

### 2026-10-14 - Refine the Web experience and apply the new logo

- Source: User requested improvement of the Web design after the logo proposal.
- Milestone: P2 interaction and visual refinement.
- Status: Reviewing the running Web app; root owns shell/home/brand, delegated agents own discovery rows and advisor/comparison pages.
- Acceptance: Clear shared navigation and page hierarchy, useful home discovery and topic continuation, responsive filters/lists/detail/comparison, integrated brand asset; retain source/time/unknown/private-record and real-discovery behavior. Primer-only layout and the sole root theme mapping; verify lint, types, production build and desktop/mobile browser flows.
- User addition: Persistent light/dark switching and a portable HTML that can open by double-click; source entry should lead to the built export. Browser tooling rejects file: navigation, so verify standalone structure plus HTTP runtime and report the manual-opening limit explicitly.

### 2026-10-01 - Review aligned requirements and choose demo tasks

- Source: Requirements alignment; requirements analysis v1.0.
- Status: Requirements v1.0 merged via PR #10 into main at `09cb425` on 2026-10-03; teammate review still pending. Task design v0.3 covers result handling, topic isolation and selected personal AI input, plus user-adopted cancellation/run limits, mistaken-merge correction and truthful send states; P3 wording aligned. Delivery of these additions uses docs/requirements-handoff and a PR to protected main; implementation and user testing remain open.
- Acceptance: Resolve actual review differences and apply task design v0.3 plus handoff 8.2 to concrete demo content, technical trials and the complete walkthrough. Choose search/AI/persistence mechanisms, declare per-run limits and explain storage/service boundaries. No new broad research or long-term staffing gate.

### 2026-10-14 - Primer frontend prototype for the advisor guide

- Source: User asked to see the frontend before wiring real providers.
- Milestone: P2 prototype (task design v0.3 pages).
- Status: apps/web rebuilt on Primer React 38.40.1 / Primitives 11.10.0 / Octicons 19.40.0 (exact pins, bun.lock updated; bun 1.4.3 installed via Homebrew). Legacy shell and handwritten CSS removed. Pages: 找导师 (search, route/region filters, explicit-only), advisor detail, 比较 (table on wide, stacked on narrow), 资源与入口, 我的探索 (per-topic private reasons in localStorage). External lookup panel replays a clearly labelled synthetic run (progress, partial failure, cancel, merge outcomes). `bun run lint`, `typecheck`, `build` pass; browser walkthrough at 1280px and 375px: save same advisor to two topics with separate reasons, reload restores both, deleting A leaves B intact, cancel keeps partial results, no horizontal page scroll.
- Acceptance: Peer/user review of the prototype.
- Update 2026-10-14: synthetic in-page script replaced by the real pipeline behind a local API (tools/discovery-trial/src/server.ts, run-manager.ts; Vite proxies /api/discovery). Web shows recipients before sending, send state, live steps, cancel, limit/failure banners and merge outcomes; unverified quotes hidden by default. `npm run serve:synthetic` exercises the full pipeline without keys (always labelled). Verified: 16 trial tests pass; HTTP smoke test (409 busy, 400 bad body, 503 unconfigured); browser walkthrough of not-started, unconfigured, synthetic complete and cancel (no late writes after 6 s). Real-provider run still pending keys.
- Update 2026-10-14 (visual pass, "简约大气" within ui-system.md): single-row header, large search, result rows reduced to name/question/route status with invisible compare/save actions, fixed-sample and original-site notes moved to a footer, consistent page-header spacing, quieter discovery intro; checked at 1440px and 375px.
- Update 2026-10-14 (production build): Vite `base: "./"` so the hash-routed bundle works from any sub-path; `bun --cwd apps/web build` → apps/web/dist/index.html as a single file (JS and Primer CSS inlined by a small plugin in vite.config.ts, 846 kB / 223 kB gzip) so it also opens from file://, where module scripts are blocked; verified with headless Chrome via file://. Added `preview` script (port 4180); served dist and verified routing, assets and no console errors. Static hosting alone leaves 外部补查 showing “服务未启动” unless /api/discovery is reverse-proxied to the discovery API.
- Notes: Known gap: Primer has no 24px title variant (h1 stays 32px), recorded in docs/product/ui-system.md. Build bundle is ~531 kB (Vite size warning, not addressed). Fixed sample data dated 2026-09-29.

### 2026-10-14 - External discovery pipeline technical trial

- Source: Task design v0.3 §6 and handoff 8.2 "实际发现"; user chose to start implementation from the discovery pipeline.
- Milestone: P2 technical trial (prerequisite for P3 demo).
- Status: Model chosen by user on 2026-10-14: Zhipu GLM-4.7-Flash (BigModel.cn free tier, OpenAI-compatible API, free tier concurrency 1). Page reader chosen by user: Jina Reader (non-commercial competition use; works keyless at a low rate limit, or with a key's one-time free tokens). Search chosen 2026-10-14 for lowest cost with no idle charges: domestic Baidu Qianfan `web_search` (free monthly/daily quota per docs, which conflict on 1500/month vs 100/day; postpaid ¥0.036/call only if enabled) and overseas Tavily (1,000 free credits/month, no card; $0.008/credit pay-as-you-go only beyond that). Connectivity of Tavily/Jina from the user's network is untested. Code skeleton added in tools/discovery-trial/ (zero-dependency Node 22 TypeScript): providers, budget/cancel, extraction with verbatim-quote check, conservative merge, run records; `npm test` 12/12 offline tests pass and keyless Jina check succeeded. Next: user adds keys locally, run `npm run check`, then 2–3 real queries. Typecheck/biome not run (no node_modules installed).
- Acceptance: CLI script runs search → full-text read → GLM relevance/extraction → structured candidate/evidence JSON with source URL, quote, retrieval time and link to the input question; merges against the four existing specimens (reuse known objects, mark conflicts/unknown identity, no duplicate on repeated read); records per-run time/call limits, cancellation and failures. Compare 2–3 real queries; record result quality, latency and failures.
- Dependencies: User-provided API keys in local env vars only (never committed or logged). Provider-agnostic OpenAI-compatible client so a paid fallback can be swapped by config for demo day.
- Notes: GLM-4.7-Flash free tier is approved for public web content only. Sending user-selected private content to external AI still requires checking the chosen service's retention/deletion terms per docs/product/privacy.md; do not reuse the free tier for that by default. Free model names/quotas may change (GLM-4.5-Flash was retired 2026-01-30).

## Historical and conditional research backlog

The dated entries below are retained for context, not an active queue. Run one only when it changes a specific current decision. Earlier demands for mandatory maintenance timing, full V1–V5 completion, automatic sample expansion or prototype migration are superseded by the 2026-10-01 demo priority. Preserve unvalidated claims as unknown; do not treat deferral as completion.

### 2026-09-29 - Bounded advisor content and maintenance trial

- Source: Screenshot review and Arno/official-rule comparison; P1 follow-up.
- Status: Initial assembly completed on 2026-09-29; follow-up is observed updates and unresolved participation/experience evidence, not further list expansion.
- Acceptance: Up to 4 advisor/team records, at least 2 institutions and 6 participation relationships across undergraduate research, short visits and graduate applications; record gaps rather than inventing coverage. Connect concrete research work, scoped conditions and available experience evidence; measure preparation/update effort.
- Dependencies: Assign maintenance owner and available time before publication commitments; no default private-source collection. See mentor-source-reference.md: 4 candidate summaries, 6 route checks (4 explicit, 1 institutional, 1 unconfirmed); no independently usable mentoring-experience sample. Future update timing must be separate from initial AI-assisted assembly.

### 2026-09-27 - Apply requirements baseline to task and information design

- Source: User authorized evidence reuse and requirements convergence.
- Status: Task/information design v0.1 completed 2026-09-30 in docs/product/advisor-task-design.md. Deferred behind 2026-09-30 requirements convergence at user request; later use the four existing specimens and decide persistence scope before promising return behavior. Research backlog remains conditional, not prerequisite.
- Acceptance: Design user entry/results and necessary content relationships from needs-analysis.md conclusions; preserve lightweight endings and substantive experience support. Keep recommendation versus accepted implementation explicit. Do not resume generic evidence gathering or imply full P1 validation.
- Dependencies: Only uncertainties affecting the specific design; data ownership/update promises resolved before release.

### 2026-09-27 - Check remaining task gaps against existing-channel benefits

- Source: L10–L13 seeking-behavior literature added to student-development-literature.md; main argument updated.
- Status: Current local task evidence pending; historical studies cannot establish present USTC prevalence or AI-era behavior.
- Acceptance: Distinguish candidate discovery from relevance judgment, identify each channel's positive contribution and unresolved consequence; retain already-successful tasks. No automatic survey or prototype expansion.

### 2026-09-26 - Complete research-content depth beyond program conditions

- Source: Two text specimens expose program-level comparison versus actual research-fit gap.
- Status: Two work-level examples completed (MPK/Clearblue). Further content expansion paused behind needs justification per user correction; personal fit, actual advising experience and current eligible intake remain unverified.
- Acceptance: Reuse candidate research-work evidence to connect an opportunity to actual work and interest-relevant differences; distinguish team intake and actual experience. Do not expand institution count merely to fill a directory. Text specimen does not establish full pilot completion or user benefit.

### 2026-09-26 - Start actual-task recall and prepare observation

- Source: Continue after public-source bias correction; V1–V3.
- Status: Asked initiator for one recent actual task via asynchronous question; response pending. Prepare neutral observation and distinguish existing stated preferences from observed behavior.
- Acceptance: Record actual episode if supplied, identify existing solution strengths and task-specific gap; no invented response, outreach or broad survey. Initiator recall cannot satisfy independent-participant coverage.

### 2026-09-26 - Contrast lightweight discovery and direct-entry tasks

- Source: Continue bias correction; P1 H1/H2/H4, V1–V3 material preparation.
- Status: Public material contrast completed; participant observation remains pending. Added fair/guide alternatives and one historical personal course account; no actual-user benefit claim.
- Acceptance: Concrete nonresearch examples, existing-channel strengths, minimum decision information and natural endings; reuse deep research comparison without requiring its workflow for every task.

### 2026-09-26 - Review requirements research bias

- Source: User asks whether current needs analysis overgeneralizes a narrow perspective.
- Status: Review complete; follow-up pending: contrast actual starting points and task depth before further standalone source maintenance. No new population evidence.
- Acceptance: Identify concrete sampling, source, workflow and validation biases; distinguish accepted product boundaries from unsupported generalization; record corrective priorities without expanding implementation.

### 2026-09-26 - Validate human maintenance effort and real updates

- Source: Two AI-assisted same-day source rechecks completed; V5 remains partial.
- Status: Pending human review/initial-creation timing and changed-source update; no owner or budget decision.
- Acceptance: Separate initial preparation, human review and actual update effort; record errors and responsible maintainer. AI wall times of 128/14 seconds are not human-cost estimates; first trial includes context-management interference. Do not extrapolate coverage capacity.

### 2026-09-25 - Validate cross-institution research discovery

- Source: User proposed external universities, research institutes and overseas projects as a research-scenario distinction.
- Milestone: P1; positioning recorded, benefit validation pending. On 2026-09-26, MPI/ISTA official pages and a nonresearch cultural-exchange comparison were read and documented; author-constructed tasks only, no independent baseline. Later same-day AI maintenance rechecks do not establish human cost.
- Acceptance: Compare relevant, actionable discoveries across domestic external universities, research institutes and overseas programs against existing sites plus general AI; separate institution location from actual eligibility, project existence from open recruitment, and preparation advice from requirements. Include source-maintenance effort; no coverage-count success claim.

### 2026-09-25 - Review RSTAR as an existing alternative

- Source: User supplied https://rstar.ustc.edu.cn/.
- Status: Public homepage walkthrough complete; login-required detail/list/personal workflows remain unverified. No available authenticated session. Follow up with user-controlled sign-in when needed, then compare actual tasks against RSTAR before claiming differentiation.
- Acceptance: Observe public discovery/detail workflows, corroborate official scope, document overlap, useful patterns and unverified gaps; update existing-solutions analysis.

### 2026-09-25 - Inspect school-specific recognition rules and lists

- Source: User requested USTC departmental comprehensive-evaluation files/whitelists; enjoyment and recognition can coincide.
- Status: Public-source pass documented in opportunity-needs-map.md; current applicable departmental rules/lists remain missing. Follow up through official student-affairs/download sections and referenced attachments, starting with the pilot user’s applicable AIDS cohort. No personal eligibility calculation is supported yet.
- Acceptance: Department-by-department evidence with purpose/year/access limits; distinguish actual rules from mentions and recommendation/credit schemes; persist overlapping motives and documentation checks.

### 2026-09-25 - Validate information discovery and selection across student tasks

- Source: User-confirmed product focus correction; P1.
- Status: Canonical H1–H6 decisions and V1–V5 are now in needs-analysis.md §8. A USTC 2025 contest organizer report adds process information, not independent participant experience. Four core task comparisons and minimal outputs added to opportunity-needs-map.md on 2026-09-25; source content checked, independent AI/user comparisons remain unexecuted. Existing literature and supply cases retained. Concrete course teaching, chapter production and learning-outcome experiments withdrawn from active work; no actual-course materials or learner tests required to close this item.
- Motive follow-up: Sample contest type × participation purpose; entertainment and recognition may overlap. Non-physics cases and a departmental source inventory added; applicable current comprehensive-evaluation rules and arts/design participation cases remain missing. The school recognition directory includes arts/sports but is not departmental comprehensive-evaluation policy. Credit/GPA policy is not comprehensive-evaluation eligibility.
- Experience follow-up: N11 now covers experience-informed selection across opportunity/resource types, not just mentors or employment. Add a non-mentor/employment case and a simple entry-only task; dimensions and depth vary by task. Validate source access and whether linked evidence/questions improve a real choice; Chinese/local and regular-employment evidence remains thin. Do not solicit named allegations or treat private notes as public supply.
- Acceptance: Identify which opportunity/support information is hard to discover, which differences are hard to judge and the minimum preparation explanation/resource connection needed. Compare original sites and general AI for these tasks; retain different-goal participants, optional stopping, return and maintenance checks.
- Limits: Cross-stage/discipline research remains broad. Learning-support discovery is valid without an application goal; no approved teaching platform, chapter catalogue or course-effectiveness claim.

### 2026-09-24 - P1 validation bias checks

- Source: User asked to bind the 2026-09-24 perspective review so later sessions do not repeat the current skew. Docs remain the evidence base; this entry constrains how V1–V5 may be counted.
- Milestone: P1. Applies to mentor-sample expansion, prototype walkthroughs, and maintenance timing. Community features stay out of scope.
- Status: Open. Not closed by more desk cases, or by the author replaying the AIDS mentor path.
- Additional user constraint: Test eligible-but-declines/browses-only outcomes and whether optional advice feels mandatory; no automatic tasks or reminders. See requirements.md, 自主选择与信息负担.
- Acceptance: The complete P1 validation set must cover all four checks below. Partial work (including one source timing) can be recorded as partial evidence, but cannot close P1 or stand in for unexecuted checks. Canonical H1–H6 and V1–V5 definitions are in needs-analysis.md §8:
  1. Run the same materials through a general-purpose chatbot as well as the original sites. Compare misreads and whether the result is still usable a week later.
  2. Include one sample whose correct outcome is to stop: eligibility, cost, or time already makes participation impossible, and the tool must not add another preparation step.
  3. One walkthrough is done by someone with a different goal who did not write the cards. The author's switch from research to employment is only a schema check.
  4. The maintenance note names who owns the source list, filter rules, and corrections after the author stops writing cards by hand. An automated workflow does not by itself close this; minutes per record remain required.
- Notes: Fluent research explanations can misstate unpublished mentor daily work; keep unknowns unknown, and do not score advisors or publish student notes. Do not let the seasonal mentor pilot crowd out notice-to-follow-up and task planning as ordinary-week alternatives. The Xingce public rule was desk-checked on 2026-09-24 and recorded as N13; that does not close the four checks above. Login lecture lists and a real walkthrough remain open. Other gaps stay out until explicitly pulled in: early undergraduates without a graduate goal, non-STEM / arts / volunteering, students already inside a lab, barriers that are time, money, or rejection beyond the new stop rule, conflicting recent peer accounts with dates, disability and caregiving, and graduate-specific tasks.

### 2026-09-24 - Content prototype and focused validation

- Source: Consolidated docs/product/requirements.md; P1-15.
- Status: Local six-record content prototype implemented and browser-checked; its visual design is superseded by ui-system.md. Next migrate to Primer, exact-lock dependencies and verify forbidden-pattern checks before further visual iteration; real task/cost validation pending.
- Acceptance: Use N01–N12 and V1–V5 for mentor comparison, optional preparation, resource access and return flow; contrast career/competition tasks; measure content work and record remaining decisions. Evidence is incomplete until the same-day "P1 validation bias checks" entry is satisfied.
- Dependencies: Real participant observations require willing participants; content prototype and supply work can proceed without a broad survey.

### 2026-09-22 - P1 needs and information-supply validation

- Source: New roadmap after user-authorized product reset.
- Status: In progress; first scenario selected by user on 2026-09-23: mentor
  discovery for third-year students preparing graduate applications.
- Acceptance: First establish product-wide user/scenario evidence, then validate
  shared and distinct needs. Walk through the first mentor pilot and a
  changed-preference case, recording manual gaps; expand toward 20–30 AI/software samples as needed,
  compare alternatives, estimate maintenance, refine the selected mentor-discovery use case
  and define prototype tasks. Questionnaires only if needed for a key decision.
- Activities/notices, competitions, exchange and internships are current research
  scope; implementation priorities are not yet determined. Initial source pilot: docs/constraints/mentor-source-reference.md;
  nine source entry points do not count as 20–30 completed mentor samples.
- Notes: Runtime work starts after scope and design; no inherited community tasks. Evidence from this item is incomplete until the 2026-09-24 "P1 validation bias checks" entry is satisfied.

- 2026-09-23 follow-up: Ten direction-screened people documented in
  docs/constraints/aids-mentor-research.md; complete recent-work and intake checks,
  broaden institutional coverage, then pilot five public profiles and five notices.
  User favors research; AI4M means AI for Math. Employment remains a separate lens.

- 2026-09-23 follow-up: docs/constraints/mentor-workflow-evidence.md records
  official cases, external survey limitations, alternatives, two desk walkthroughs
  and R1–R8 candidate requirements. Observe real tasks and validate maintenance;
  Yanbridge main-site interaction remains untested. No measured time saving yet.

- 2026-09-23 product-wide follow-up: opportunity-needs-map.md contains cross-user
  states, ten case/data groups and G1–G7 hypotheses. Validate varied tasks and
  maintenance, expand non-STEM/public-service samples, verify current Xingce
  entry and existing service experience. No final feature priorities yet.

- 2026-09-24 follow-up: Three source-backed preparation cards and desk comparisons completed. Observe real task understanding and next-action selection; independently time content preparation and updates. G8–G11 remain hypotheses.

- 2026-09-24 resource follow-up: Validate G12 task-linked resource cards; confirm personal eligibility, compute compatibility, current equipment rules and next research-funding window. Public availability is not approved access.

- 2026-09-24 Xingce follow-up: Signup notice is the Marxism School page 《“形势与政策”课程预告》. Decode or open the 2026-09-17 QR before describing the session list, quotas, or credit marks. Report submission remains 瀚海教学网. Do not treat email/SMS at report time as the signup channel.

### 2026-09-24 - Automated supply workflow, not yet built

- Source: User hopes maintenance becomes a repeatable workflow: crawl chosen web pages, optionally Xiaohongshu or an agreed group bot, then an agent filters and publishes human-readable text.
- Milestone: P1 supply. Candidate only.
- Status: Proposal, not accepted. Do not implement a crawler, Xiaohongshu collector, group bot, or user-key guidance from this item.
- Acceptance: Keep the 2026-09-24 review in `docs/product/overview.md`. Do not treat "students have no API key" as an open needs question; 词元计划 is the campus capability for guidance. A later session may adopt a fixed on-site workflow, information published ahead of time by our side, and guidance that can be absent. Quota and whether a personal key may be entered into this site are implementation checks, not a reason to reopen the needs decision. Do not treat Xiaohongshu or unapproved group chats as default sources. Keys stay out of the repository.
- Notes: V5 manual timing still comes before treating automation as the maintainer.
