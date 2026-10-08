# AI Log Todo

Last updated: 2026-10-07

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

### 2026-10-07 - Follow a comparison question through lookup and saved evidence

- Source: User accepted the next iteration after PR #12 and asked to start.
- Milestone: P2, T2/T3/T5.
- Status: Implemented on feat/comparison-followup and developer-walked on 2026-10-08. A real public lookup returned body text and explicit failure/fallback messages. Saved evidence reloaded on the same topic only. Topic-condition editing, cancellation limits, and preparation entries remain later.
- Acceptance: Execute an actual external lookup; successful body reads and failures remain explicit. Save a relevant source, return and reload to recover it without duplicate candidates, changed fixed summaries, lost drafts or cross-topic private-record changes. Keep existing Primer UI and same-browser storage.
- Dependencies: Existing discovery API availability and reading scope. No model/provider or database migration selected for this slice.

### 2026-10-06 - Define subsequent implementation work after PR #12

- Source: Current implementation squash merged via [PR #12](https://github.com/114August514/campus-agora/pull/12) as main a8a0209; review and integration facts are in done.md.
- Status: Merge completed under the user's authorization after review found no blocking issue and head c5bd897 passed all six CI jobs. Local main matches origin/main; old local main history is preserved in backup/main-before-pr12-20261006. Historical tools/prototypes/opportunities.html stays local as documented. Subsequent issue groups remain proposals.
- Proposed issues, not created: (1) decision-relevant lookup → source-bound candidate/comparison update; (2) editable topic conditions plus cancellable/bounded discovery; (3) optional preparation/knowledgeable-participant/resource entries; (4) complete demo walkthrough and synthetic mistaken-association repair. Define acceptance from task design v0.4 when taking up a group; no staffing gate or new broad research task.

### 2026-10-03 - Review task design and begin bounded implementation experiments

- Source: Requirements alignment; requirements analysis v1.0.
- Milestone: P2.
- Status: Requirements v1.0 was merged via PR #10; task-design v0.4 has six user tasks and G1–G5 work packages. On 2026-10-04 the first actual discovery/body/save/reopen slice was implemented and developer-tested, including independent two-topic records. October 5 repeated the discovery skill on text/image recruitment formats and integrated a second batch; seven candidates now include four dated samples and three collected people. The source-bound Jiang/Song choice-support slice was implemented and developer-tested on October 5; complete demo and student usability remain open.
- Acceptance: Review concrete task/interaction differences; use real specimens for the Primer interaction draft. Trial two-topic persistence and one actual external search/body read, then integrate the user tasks and handoff 8.2 checks. No new broad research or long-term staffing gate.
- Dependencies: First slice reuses React/Vite, existing Rust API and contract tooling; same-origin localStorage, DuckDuckGo/limited directory fallback and public-query transfer are documented. Current design/runtime work is integrated into main via PR #12; model/provider costs, deployment and continued supply remain subsequent decisions.
- Reuse input: docs/constraints/open-source-reuse-reference.md compares 18 projects. Select a bounded component/service comparison and a topic-persistence trial rather than install all candidates; license/version, cost, reading state and source/notes boundaries remain implementation decisions.
- Next: Build on the implemented choice-support slice (advisor-task-design.md §8.4): connect a decision-relevant unknown to optional follow-up lookup, then topic-condition editing and preparation/contact/resource entries. Generalizing the curated two-candidate comparison into a choice-help skill/output or model path is subsequent work; no model or decision engine selected. Check changed-query behavior and full §8.2 demo tasks; independent student trial/benefit and ongoing maintenance are not claimed. Public index fallback currently matches only Stanford AI/CMU ML directories; browser tests used labeled demo records.
- Collection follow-up: Reuse the two completed batches for comparison before collecting more. Introduce a fixed browser adapter only for a concrete repeated gap; image-only content requires visual reading, not title/DOM-only completion. Application-triggered Xiaohongshu discovery and unattended collection remain unimplemented; the explicitly invoked repository skill and login handoff remain available.
- Engineering follow-up: Production build warns about a roughly 762 kB main JS bundle (about 187 kB gzip); assess splitting when expanding the next slice. Pin remains Bun 1.3.14; this machine used Bun 1.4.2. The committed snapshots passed local contract drift checks and all six jobs of latest-head PR #12 CI run 37477321621 before merging, including the pinned Bun version. This is not a claim that post-merge main CI has completed.
- Adopted rules retained from PR #11: declare per-run limits, support cancellation with partial results, repair mistaken public associations without losing private records, and send only explicitly selected personal AI inputs with truthful delivery states. Complete walkthrough and chosen AI mechanisms remain open.

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
