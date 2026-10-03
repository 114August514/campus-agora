# AI Log Done

Last updated: 2026-10-03

This file records completed agent-visible work. Keep entries factual and link
them to commits, files, and verification commands where possible.

## Entry Format

```md
### YYYY-MM-DD - Task Title

- Result:
- Changed:
- Verification:
- Decisions:
- Follow-up:
```

## Completed

### 2026-10-03 - Apply AI multi-dimension review findings to requirements v1.0

- Source: User asked for a review of the current requirements analysis, then asked to fix all reported issues.
- Result: A 9-dimension AI review (evidence, alternatives, tasks, scope/acceptance, consistency, eight-part contract, feasibility, privacy, readability) with 3-lens adversarial verification kept 8 of 46 findings; 4 low-cost refuted-but-factual items were also fixed. Handoff now states the named-experience precondition (source use + correction handler) in 8.2, overseas language/visa/identity conditions under N04, the contact-advisor scope boundary in 6.2, consistent automation-led supply wording in 2.3, S7–S9 in-text citations, a requirements.md row in the section 10 index, and Arno/skill glosses. requirements.md N04/N05/N11 rows and the G5 note updated; opportunity-needs-map G5 row and needs-analysis N10/N13 historical row annotated; 8.2 multi-topic wording no longer reads as sharing private reasons.
- Changed: docs/product/requirements-handoff.md, docs/product/requirements.md, docs/product/overview.md, docs/product/needs-analysis.md, docs/constraints/opportunity-needs-map.md.
- Verification: `git diff --check`; local relative-link check over the five edited docs (0 broken). `bun run docs:build` not run: `uv` is not installed locally.
- Decisions: Not applied (refuted as conflicting with confirmed decisions or already handled elsewhere): RSTAR/baseline comparison as a demo gate, objection-handling SLA, AI transfer scope and persistence timing in the requirements doc, privacy.md rewrite before implementation, adding columns to handoff tables. This is an AI review, not the pending teammate review.
- Follow-up: Teammate review of v1.0 remains open; advisor-task-design.md still needs the multi-topic/external-discovery revision.

### 2026-09-29 - Record advisor-guide first version and align baseline docs

- Source: User reviewed handoff section 2 and confirmed the first version is a 选导师指南 without a home/external campus split; asked to fix repository-level inconsistencies.
- Result: Handoff v0.6 (merged after the 2026-09-28 v0.5 research update) restructures section 2 into advisor main path, direct tasks and maintainer tasks; summary, section 6, 7.2 and 8.3 updated; non-research sample moved to a pre-expansion check. overview.md, milestones.md, needs-analysis.md and AGENTS.md record the decision. development.md design rules and monorepo-reference.md now defer to the Primer UI spec. Handoff links N/H definitions.
- Deferred by user: trigger timing/frequency, task layering detail, stance toward advisors as information subjects.
- Verification: `git diff --check`; docs build attempted (see commit notes).

### 2026-09-28 - Research student decision psychology

- Result: Added L14–L19 to student-development-literature.md (choice meta-analyses, autonomy experiment, Chinese social-comparison survey, career information experiment and JobMate v2). Recorded reading depth and noncausal/cross-context limits; reused L03/L12.
- Applied: Added task-specific concerns and support implications to needs-analysis.md and handoff v0.5. No psychological profiling, anxiety-reduction claim, new scope or universal research gate. JobMate v2 explicitly does not establish overall superiority; older stronger search summary not adopted.
- Verification: `UV_CACHE_DIR=/tmp/campus-agora-uv-cache bash scripts/ci/docs.sh` and `git diff --check` passed. Paper evidence is distinct from actual USTC user observations.
- Follow-up: Evaluate optional-help interpretation, correctability and source distinctions within already-planned task trials; do not start a separate clinical assessment.

### 2026-09-27 - Strengthen the requirements argument

- Added current-process reconstruction, consequence/actionability analysis, five alternative approaches with priority rationale, and operational task-success criteria to needs-analysis.md; synchronized handoff v0.4 and requirements.md.
- Evidence: Existing records reused; journeys are analytical models, not observed behavior. Scope and criteria remain review proposals; no invented outcomes, prevalence or time thresholds. Existing P/N/H/V identifiers retained.
- Verification: `UV_CACHE_DIR=/tmp/campus-agora-uv-cache bash scripts/ci/docs.sh` and `git diff --check` passed; no runtime changes.
- Follow-up: Peer review of alternative/priority choices and criteria; time budget, owner and actual user outcomes remain unresolved at their appropriate decision points. No universal new research gate.

### 2026-09-27 - Prepare complete documentation handoff for PR 10

- Source: User explicitly authorized all related documentation after scope discussion.
- Result: Included remaining product overview/milestones, AGENTS, reading navigation, UI reference, historical flags and AI logs; handoff updated to v0.3 with restored baseline links. Prototype README explicitly identifies unsubmitted local HTML.
- Verification: Strict workspace build and staged-only export build passed using existing dependency environment; staged diff check and documentation-only scope check passed. No runtime behavior or fresh production CI claim.
- Delivery: Prepared for PR 10 publication; peer review remains pending. Legacy opportunities.html intentionally excluded; no merge authorized.

### 2026-09-27 - Attach existing research in follow-up PR 10

- Result: Commit 85c96c7 adds six research records, full needs analysis, requirements, UI constraints and text specimen; handoff v0.2 links them with reuse/reading guidance. PR 9 was externally merged at c38c154; created https://github.com/114August514/campus-agora/pull/10 for the attachments. Restored PR 9 summary and linked the follow-up.
- Scope: Auto-review rejected initial broad staging; narrowed to 11 Markdown files and approval succeeded. AGENTS, architecture, other baseline edits and HTML remain unsubmitted. No merge.
- Verification: Strict workspace build and narrowed staged-only export build passed with existing dependency environment; diff check passed. Fresh dependency install in temporary export failed under network restrictions; reuse of existing environment resolved build. PR 10 verified OPEN at 85c96c7 with exactly 11 Markdown files.
- Follow-up: Peer review via handoff section 9. Older repository planning pages remain historical; v0.2 makes the review baseline explicit.

### 2026-09-27 - Publish requirements handoff PR

- Result: Opened https://github.com/114August514/campus-agora/pull/9 from `docs/requirements-handoff` into `main` at user request.
- Verification: `gh pr view 9 --json url,state,baseRefName,headRefName,files,commits` confirms OPEN, one commit c38c154 and only docs/product/requirements-handoff.md (223 additions). Commit diff check passed.
- Scope: Other working changes preserved; no merge or direct collaborator message. User will share the PR and document; review remains pending.

### 2026-09-27 - Deliver requirements handoff for peer review

- Result: Created self-contained eight-part analysis with summary, source table, N/P traceability, scope recommendations, task acceptance, open decisions and peer feedback template. No invented user tests or current opportunity claims.
- Commit: `c38c154` contains only `docs/product/requirements-handoff.md` (223 lines). Earlier workspace edits and these log updates remain outside the commit; no push or message sent.
- Verification: Strict documentation build, `git diff --check`, and section/source coverage checks passed. Build reports the standalone handoff is not in site navigation; direct file is the intended delivery.
- Follow-up: Collaborators review scope/value and decision-relevant gaps using section 9; incorporate accepted changes into formal baseline and task/information design. Review not yet performed.

### 2026-09-27 - Research mature-team requirements practices

- Result: Compared GitLab, Atlassian, Basecamp and GOV.UK primary sources; documented evidence reuse, scope/investment decisions and separate readiness for design versus development.
- Changed: Added constraints/requirements-practice-reference.md, indexed it and added documentation navigation. No runtime or product-scope changes.
- Verification: `UV_CACHE_DIR=/tmp/campus-agora-uv-cache bash scripts/ci/docs.sh` and `git diff --check` passed.
- Decisions: Methods are contextual examples, not universal gates. Existing eight-part baseline remains; no new research checklist required.
- Follow-up: Apply baseline to task/information structure; clarify investment and ownership during implementation planning, without inventing budgets or claiming measured benefit.

### 2026-09-27 - Consolidate reviewable requirements and adopt evidence reuse

- Result: Added current requirements conclusions to needs-analysis.md, replaced stale next-work/exit language, synchronized requirements.md, overview.md, milestones.md and AGENTS.md. Explicitly recommend core discovery/understanding/comparison, substantive experience support and optional preparation/resources; lightweight private records remain a design recommendation, push/automatic progress are not first-release essentials.
- Decisions: Existing scoped evidence is sufficient for needs conclusions. No repeated research, participant reply or all H/V completion as a universal gate. Needs baseline is reviewable; full P1 efficacy and sustained supply remain unvalidated. Conditional backlog retained without claiming completion.
- Verification: `UV_CACHE_DIR=/tmp/campus-agora-uv-cache bash scripts/ci/docs.sh` and `git diff --check` passed; documentation only, no new data or runtime work.
- Follow-up: Task/information-structure design; targeted unknowns handled where they affect decisions, claims or release readiness.

### 2026-09-27 - Add empirical information-seeking evidence to needs argument

- Result: Added L10–L13 to student-development-literature.md: Chinese job-source interview abstract (18 successful job seekers), US everyday-search methods/results (8,353 responses, 7.4% response rate), Chongqing interpersonal-seeking abstract (328 cases), and digital-divide abstract with unknown sample detail. Main needs-analysis now separates finding from relevance judgment and preserves existing-channel benefits.
- Decisions: Multiple sources can complement one another; aggregation need is not inferred from fragmentation. Historical/nonlocal studies do not establish current USTC or generative-AI behavior. Blocked/placeholder sources not counted; same PIL dataset not treated as replication. No new UI, content specimen, outreach or population estimate.
- Verification: `UV_CACHE_DIR=/tmp/campus-agora-uv-cache bash scripts/ci/docs.sh` and `git diff --check` passed; docs only.
- Follow-up: Local task-specific unresolved consequences and current alternatives remain missing evidence.

### 2026-09-26 - Separate user need, unmet gap and feasibility evidence

- Result: Added P01–P07 justification review to needs-analysis.md; distinguished direct initiator requests, literature context, source differences and unsupported behavior assumptions. Corrected P03 mandatory-output residue and P05 attribution; separated entry/recognition/progress and saving/notification needs.
- Decisions: Aggregation can be useful without exclusive content; existing source facts do not establish usability or eliminate potential value. Experience information remains a substantive need, not merely questions/notes. Further mentor specimen work is paused behind main needs argument; no new participant evidence or demand ranking.
- Changed: needs-analysis.md sections 4–5 and H5, requirements.md, milestones.md, AI logs.
- Verification: `UV_CACHE_DIR=/tmp/campus-agora-uv-cache bash scripts/ci/docs.sh` and `git diff --check` passed; documentation only.
- Follow-up: Establish task-specific existing-method gaps and natural success conditions; actual-task reply and independent users remain optional missing evidence, not fabricated results.

### 2026-09-26 - Connect existing candidates to concrete research questions

- Result: Read Chen homepage/FAQ, MPK team page and USENIX abstract, Zhang homepage and Clearblue programming-model docs. Extended opportunity-content.md with question/method comparison and optional reading paths; documented source depth in aids-mentor-research.md and progress in needs-analysis.md.
- Decisions: Coauthorship is not advising responsibility; project methods are not observed lab routines. CMU-student participation notice is not an external-student invitation; research-scientist hiring is not degree intake. Candidate works are not linked to MPI/ISTA programs. Removed fixed six-hour trial suggestion as a general preparation expectation.
- Verification: `UV_CACHE_DIR=/tmp/campus-agora-uv-cache bash scripts/ci/docs.sh` and `git diff --check` passed. No paper reproduction, contact, user study or new candidate ranking.
- Follow-up: Real personal preference, team experience, applicable intake and full pilot remain unverified; no additional directory expansion implied.

### 2026-09-26 - Produce source-backed text specimens

- Result: Wrote tools/prototypes/opportunity-content.md with MPI/ISTA program comparison and brief Xingce entry lookup; refreshed three official sources. Added author source-check results to needs-analysis.md and linked specimen from prototype README.
- Decisions: Different tasks need different content depth. Program conditions do not complete mentor/work-interest comparison. Two-month example is constructed, not user preference. QR destination and actual team experience remain unverified. No frontend implementation, user-benefit test or independent model baseline.
- Verification: `UV_CACHE_DIR=/tmp/campus-agora-uv-cache bash scripts/ci/docs.sh` and `git diff --check` passed; source statements reviewed against current returned official text. No runtime changes.
- Follow-up: Research-work/team fit and actual-user observations remain; prototype is a review artifact, not a completed pilot.

### 2026-09-26 - Consolidate candidate scope without inventing validation

- Result: Replaced needs-analysis section 6's broad mandatory-path suggestions with confirmed principles, common-base candidates, conditional capabilities and unresolved release choices. Added task-specific natural endings and a bounded research-pilot recommendation with lightweight counterexamples.
- Changed: needs-analysis.md, requirements.md N06/path wording, milestones.md and AI logs.
- Decisions: Preparation does not universally require a work product or exercise. Research-specific person/work relationships are not mandatory for every opportunity. Conditional experience/compare support remains valuable; no final coverage, implementation or measured-benefit claim. Recent-task question remains unanswered and optional.
- Verification: `UV_CACHE_DIR=/tmp/campus-agora-uv-cache bash scripts/ci/docs.sh` and `git diff --check` passed; docs only.
- Follow-up: Actual task evidence and source-cost evidence still inform release selection; independent progress does not require repeatedly asking the same recall question.

### 2026-09-26 - Prepare neutral actual-task observation and request recall

- Result: Asked initiator for a recent concrete discovery/support episode. Added ready-to-use recall sequence and task-level decision rules to needs-analysis.md; response still pending.
- Decisions: Existing stated research preferences are personal demand evidence, not a completed search episode. Constructed time limits are not user facts. Ask about satisfactory existing methods and non-information barriers before showing a solution. Retrospective recall is distinct from observation and does not establish independent V2 coverage.
- Verification: `UV_CACHE_DIR=/tmp/campus-agora-uv-cache bash scripts/ci/docs.sh` and `git diff --check` passed; no external outreach or invented participant data.
- Follow-up: Analyze the actual answer when supplied, then identify a contrasting voluntary nonauthor task; do not duplicate public case research in place of missing behavior evidence.

### 2026-09-26 - Contrast lightweight tasks and existing peer support

- Result: Read USTC 2026 club-fair report, USTCGUIDE preface and historical first-person elective-course account; re-read Xingce entry. Compared constructed interest browsing, mixed-motive course exploration, direct lookup and existing deep research case.
- Changed: opportunity-needs-map.md evidence/contrast; needs-analysis.md alternatives, progress and H3 status; requirements.md lightweight acceptance examples; AI logs.
- Decisions: Existing alternatives include face-to-face exploration and student guides. One public personal account adds non-organizer evidence, not corroborated current experience or representative demand. Current event availability, QR destination and user benefit remain unverified. No new feature implementation or outreach.
- Verification: `UV_CACHE_DIR=/tmp/campus-agora-uv-cache bash scripts/ci/docs.sh` and `git diff --check` passed.
- Follow-up: Observe actual task starting points and natural endings; do not substitute further case accumulation for user evidence.

### 2026-09-26 - Assess and correct requirements research bias

- Result: Reviewed needs analysis, N01–N13, evidence-map structure and work order. Identified research-case, official-source, skilled-searcher, deep-workflow, rules/maintenance, solution/baseline and validation-process biases. Nonresearch cases exist; their depth does not yet establish broad demand.
- Changed: needs-analysis.md section 7 assessment and current H2 status; requirements.md optional workflow clarification; milestones.md next-work order; AI logs.
- Decisions: Keep accepted personal-use scope and mentor pilot. Prioritize contrasting real task starting points/depth; maintenance supports selected tasks. No population estimates or new user evidence; no need for equal sample counts or every validation before a bounded prototype.
- Verification: `UV_CACHE_DIR=/tmp/campus-agora-uv-cache bash scripts/ci/docs.sh` and `git diff --check` passed; documentation only.
- Follow-up: Actual exploratory/lightweight/deep-choice tasks and ordinary alternatives remain to be observed; a single contrasting participant cannot establish coverage.

### 2026-09-26 - Recheck two research sources and bound timing claims

- Result: Re-read ISTA and MPI official source text; documented missing lead-time and pathway conditions. No detected source-rule change; local-summary enrichment only.
- Changed: opportunity-needs-map.md, needs-analysis.md, requirements.md and AI logs.
- Evidence: Sequential UTC clock boundaries yield 128 and 14 seconds through per-record decision writing; first includes context-management interference. Familiar-source AI wall time is not human labor, cold-start effort, real-update cost or user savings. H6 remains unvalidated.
- Verification: `UV_CACHE_DIR=/tmp/campus-agora-uv-cache bash scripts/ci/docs.sh` passed. `git diff --check` checked at handoff. No runtime changes, outreach or application submissions.
- Follow-up: Initial creation, independent human review, actual changed-source handling, maintenance owner/budget and participant comparison remain pending.

### 2026-09-26 - Execute research and cultural-exchange source walkthroughs

- Result: Read official MPI CS internship, paused ISTernship and year-round ISTA pages; read USTC notices for XJTU, NJU and Fudan summer programs. Recorded author-constructed two-month research and two-week cultural-exchange comparisons, original-site strengths, source-date limits and unresolved conditions.
- Changed: opportunity-needs-map.md evidence and partial V status, needs-analysis.md progress, requirements.md N03/N08 relationship examples, AI logs.
- Decisions: Institution status differs from individual program/cycle; umbrella dates differ from subproject dates; absence of a fixed pre-admission research topic is valid. All sampled 2026 cultural programs are historical. No user-benefit or independent-experience claim.
- Verification: `UV_CACHE_DIR=/tmp/campus-agora-uv-cache bash scripts/ci/docs.sh` and `git diff --check` passed. No applications, outreach or sign-in. No independent AI/user baseline or per-record timing.
- Follow-up: Reuse materials for controlled comparison or measured maintenance; domestic research coverage and experience supply still incomplete.

### 2026-09-26 - Consolidate task-to-unmet-need arguments

- Result: needs-analysis.md section 4 now links seven concrete tasks to existing alternatives, hypothesized gaps, desired outcomes and existing H/V decisions. Preserved external research discovery, nonresearch choices and actual-experience needs without claiming observed prevalence.
- Changed: needs-analysis.md, requirements.md and AI logs. Reworded P06 as determining whether activities satisfy existing requirements; erroneous recommendations remain a risk rather than an observed user event.
- Decisions: Publicly available experience and private judgment remain meaningful needs; official-platform constraints are unverified. No automatic black/red rankings, scoring or community scope added. Missing source material cannot be replaced by generated explanation.
- Verification: `UV_CACHE_DIR=/tmp/campus-agora-uv-cache bash scripts/ci/docs.sh` and `git diff --check` passed. Existing evidence consolidated; no new browsing, participant observation, independent AI comparison or timing performed.
- Follow-up: Execute existing cross-institution discovery and nonresearch comparison tasks; check actual-experience supply and maintenance effort. P1 remains open.

### 2026-09-25 - Stabilize background and target-user baseline

- Result: needs-analysis.md sections 1–2 now separate documented context, adopted research scope and unvalidated prevalence/benefit. Defined overlapping task states, direct student users versus information subjects, institutional information coverage versus service rollout, pilot versus first-release priority.
- Changed: needs-analysis.md, overview.md, requirements.md and AI logs; existing evidence retained, no new fieldwork claims.
- Decisions: Background and overall audience are usable baselines; first-release segment and demand strength remain open. Official-platform feedback limitations remain hypotheses. Keep H1–H6/V1–V5 as the sole validation framework.
- Verification: `UV_CACHE_DIR=/tmp/campus-agora-uv-cache bash scripts/ci/docs.sh` and `git diff --check` passed; documentation only.
- Follow-up: Existing cross-source discovery, experience-supply, different-goal participant and maintenance tasks remain pending.

### 2026-09-25 - Specify cross-institution research discovery hypothesis

- Result: User-proposed external university, institute and overseas project discovery promoted from coverage scope to a priority differentiation hypothesis in overview.md and needs-analysis.md.
- Decisions: Retain local opportunities and broad disciplines; relate research tasks to participation conditions, not just mentor names. RSTAR external coverage remains unknown; counts and geography do not prove value.
- Verification: `UV_CACHE_DIR=/tmp/campus-agora-uv-cache bash scripts/ci/docs.sh` and `git diff --check` passed. No new external research or user-benefit tests in this positioning update.
- Follow-up: Cross-institution discovery comparison and source-maintenance validation tracked in todo.md.

### 2026-09-25 - Review RSTAR public workflows as a local alternative

- Result: Browser-observed homepage search entry points, project/mentor/resource previews and lectures; mentor discovery and selected project detail redirected to authentication. No login or submission; no authentication URLs persisted.
- Changed: opportunity-needs-map.md detailed source/observation boundaries and comparison plan; needs-analysis.md existing-solutions baseline; todo.md authenticated follow-up.
- Decisions: Local mentor/project/resource aggregation already exists. Treat RSTAR as a direct research-scenario alternative and link candidate; potential cross-source/personal-workflow gains remain hypotheses, not verified RSTAR omissions. No UI-rule change or automatic data integration.
- Verification: `UV_CACHE_DIR=/tmp/campus-agora-uv-cache bash scripts/ci/docs.sh` and `git diff --check` passed. User benefit, search quality and login-only behavior untested.

### 2026-09-25 - Map departmental evaluation sources and recognition applicability

- Result: Read information-school class-rule revision report and historical recommendation rule, mathematics-school historical recommendation rule, cyber/engineering/computer-school reports, and the official 2025 competition-management PDF with its 2024 directory. Recorded departmental search gaps without treating missing results as absent policies.
- Changed: opportunity-needs-map.md source inventory; overview.md and requirements.md applicability/overlapping-purpose rules; todo.md remaining source acquisition.
- Verification: `UV_CACHE_DIR=/tmp/campus-agora-uv-cache bash scripts/ci/docs.sh` and `git diff --check` passed. Documentation-only work; no runtime checks or user validation performed.
- Decisions: Enjoyment and formal recognition can be simultaneous. Department/cohort/class context follows actual documents; school credit/GPA recognition is not a departmental comprehensive-evaluation whitelist. No current personal score calculation supported.
- Follow-up: Obtain applicable current departmental originals and attachments; execute multi-purpose and mismatched-rule task checks. No claim of complete departmental coverage or P1 completion.

### 2026-09-25 - Broaden contest samples and separate participation motives

- Result: Read USTC recreational card tournament, USTCPC rules, systems-design contest report, credit/GPA recognition notice and engineering-school comprehensive-evaluation sharing report. Added type × motive research framework and explicit source/eligibility limits.
- Changed: AGENTS.md, overview, requirements, needs-analysis, opportunity-needs-map and AI LOG.
- Decisions: Enjoyment, shared participation, recognition and development are equal legitimate optional purposes. Prizes, credits/GPA and comprehensive evaluation are distinct; no confirmed personal comprehensive-evaluation score. Physics contest remains one sample, no automatic preparation or fixed motive labels.
- Verification: Primary pages read; `UV_CACHE_DIR=/tmp/campus-agora-uv-cache bash scripts/ci/docs.sh` and `git diff --check` checked before handoff; documentation only.
- Follow-up: Applicable unit/year recognition rules, arts/design cases and real motive-specific choices; no participation or motive prevalence measured.

### 2026-09-25 - Consolidate hypotheses and execute contest source check

- Result: needs-analysis.md §8 now owns H1–H6 evidence/gaps/decision outcomes and V1–V5 meanings; removed divergent scenario-specific V table from requirements. Recorded four-source readiness check and added a fresh USTC 2025 physics-experiment contest organizer report to opportunity-needs-map.md.
- Changed: Needs analysis, requirements, milestones, opportunity-needs-map and AI LOG.
- Decisions: Separate discovery from fixed-material explanation; method/questions from actual experience data; allow partial evidence without declaring full validation complete. Contest report supports historical process association, not participant satisfaction, time estimates, current eligibility or success probability.
- Verification: Primary contest report read; `UV_CACHE_DIR=/tmp/campus-agora-uv-cache bash scripts/ci/docs.sh` and `git diff --check` checked before handoff. No participant tests, independent AI baseline or cost timing executed.
- Follow-up: Bounded experience-source checks, comparable candidate task and first independent content-maintenance timing; participants needed only for real behavior/return evidence.

### 2026-09-25 - Generalize experience-informed selection across scenarios

- Result: Promoted actual-content/experience/commitment judgment to a common opportunity/resource problem; removed mentor/employment/long-term-only scope from overview, N11, P07 and research reference.
- Changed: AGENTS.md, overview, requirements, needs analysis, milestones, opportunity-needs-map and AI LOG.
- Decisions: Shared source/context/conflict/unknown/private-judgment handling; scenario-specific questions and optional depth. Simple entry lookups can end immediately. Broader user-approved scope does not establish equal demand or source availability.
- Verification: `UV_CACHE_DIR=/tmp/campus-agora-uv-cache bash scripts/ci/docs.sh` and `git diff --check` checked before handoff; documentation only.
- Follow-up: Non-mentor/employment comparison and entry-only task; direct evidence outside mentor/internship cases remains incomplete.

### 2026-09-25 - Extend core comparison to experienced quality

- Result: Added primary mentorship research (40-person purposive negative-experience sample), two-case abstract, Penn guidance, NACE survey summary and internship criteria to opportunity-needs-map.md. Preserved sample/read limitations; no named allegations collected.
- Changed: Product overview, N11 in requirements, P07/value in needs analysis and AI LOG.
- Decisions: Actual tasks, support, commitments and personal fit belong to core comparison across mentors and internships/employment. Separate self-description, records, experiences and private judgments; preserve unknowns/context, no personality scores. Public disclosure or community is not required. Guidance-only value does not mean hidden experiences have been obtained.
- Verification: Primary pages read; `UV_CACHE_DIR=/tmp/campus-agora-uv-cache bash scripts/ci/docs.sh` and `git diff --check` checked before handoff; documentation only.
- Follow-up: Local/regular-employment evidence, actual source access and willing task observations; compare a generic question list before assuming richer features help.

### 2026-09-25 - Compare core information tasks against existing services

- Result: Re-read advisor intake, MSRA internship, USTC contest and Xingce pages; compared existing college recruitment aggregation and Stanford SOLO scope. Added four task comparisons, minimal outputs and disconfirming outcomes to opportunity-needs-map.md; promoted conclusions into needs-analysis.md.
- Decisions: Prioritize discovery, relation mapping and conditional comparison; original-page completeness may mean a direct link is enough. Chapter teaching remains withdrawn. Separate fixed-material understanding checks from open discovery and single-object checks from multi-candidate comparison.
- Limits: MSRA sample dated 2025, contest signup ended, advisor status is a read snapshot without update date; MIT UROP only search excerpt with failed body fetch. No active-opening guarantee, participant results, independent AI baseline or maintenance timings.
- Verification: `UV_CACHE_DIR=/tmp/campus-agora-uv-cache bash scripts/ci/docs.sh` and `git diff --check` checked before handoff; documentation only.
- Follow-up: Use the four bounded tasks for actual contrasts, add comparable candidates only where required, record maintenance costs and distinct user goals.

### 2026-09-25 - Persist product focus and withdraw teaching drift

- Result: Bound discovery/understanding/comparison as core, preparation priorities as support and resource connections as assistance. Direct resource search and broad user research remain valid; chapter links are optional details.
- Changed: AGENTS.md; product overview, requirements, needs analysis and milestones; student-development reference; AI LOG.
- Decisions: Removed chapter-level requirements and knowledge-learning experiments from current validation and pending tasks. Earlier course research and protocols are historical supporting evidence, not P1 work or exit criteria. This supersedes the teaching-related follow-ups in the two earlier entries below.
- Verification: `UV_CACHE_DIR=/tmp/campus-agora-uv-cache bash scripts/ci/docs.sh` and `git diff --check` (results checked before handoff); documentation only.
- Follow-up: Compare discovery and selection tasks against original sites/general AI; identify minimum guidance and resource support, with willing participants and maintenance timing still pending.

### 2026-09-25 - Inspect concrete course sections and prepare task comparison

- Result: Read USTC CS1001A description, separate OJ program-design-B exercise, CS50P loops and Python control-flow sections. Documented language, section-granularity, course-identity and read/submit mismatches; no claim of learner benefit.
- Changed: Student-development reference §8, needs analysis, requirements and AI LOG.
- Verification: Source text inspected; strict docs build and `git diff --check` run for this documentation change. No login, submissions, independent model baseline or participant experiment.
- Follow-up: Execute four task situations with willing participants, original-site/AI/product controls, voluntary understanding checks and return; record per-stage production/update cost and source owners.

### 2026-09-25 - Separate resource availability from suitability

- Result: Added three learning-research references with access limits and a Python tutorial/CS50P/visualizer comparison. Explicitly left the user's actual school course unassessed. Corrected automatic reuse language in overview, requirements and needs analysis.
- Decisions: Evaluate availability, access, task fit and benefit separately; preserve official handling authority. Allow explanation, alternatives and short paths when existing guidance is unsuitable. Preferences do not establish efficacy or fixed learning-style categories.
- Verification: Primary research/resource pages checked; `UV_CACHE_DIR=/tmp/campus-agora-uv-cache bash scripts/ci/docs.sh` and `git diff --check` passed. No learner experiment, enrolment or runtime implementation.
- Follow-up: Obtain task-specific school course materials and compare resource choice, voluntary understanding checks and burden; do not infer superiority from provider or format.

### 2026-09-25 - Check existing USTC support against student tasks

- Result: Extended student-development-literature.md with six public-source support cases and three optional-help examples. Existing academic advising, career consultation and contest guidance constrain the proposed product gap; did not claim widespread unawareness or absent services.
- Changed: Student-development reference, needs analysis, milestones and AI LOG.
- Verification: Read official pages on 2026-09-25; separated historical events, current listings and inaccessible details. `UV_CACHE_DIR=/tmp/campus-agora-uv-cache bash scripts/ci/docs.sh` and `git diff --check` passed. No login, contacts, applications or runtime changes.
- Follow-up: Original-site/general-AI task contrasts, willing participants, one-week return and per-record production/update timing. Academic booking availability, internship details and complete historical guidance materials remain unverified; source maintenance owners are not assigned.

### 2026-09-24 - Persist optional help and personal pace

- Result: Bound user instruction to offer help/resources without presenting every opportunity as essential. Declining is valid even when eligible; viewing/saving does not create obligations. Defined restrained guidance, opt-in reminders and accurate official requirements.
- Changed: `AGENTS.md`, product overview, requirements, needs analysis and AI LOG.
- Verification: `UV_CACHE_DIR=/tmp/campus-agora-uv-cache bash scripts/ci/docs.sh` and `git diff --check` passed; documentation only.
- Follow-up: Observe information burden and misreading of optional advice during P1 tasks; do not claim proven anxiety reduction. No UI or notification behavior implemented this turn.

### 2026-09-24 - Review social-science evidence for student task segmentation

- Result: Added `docs/constraints/student-development-literature.md`: nine studies/research texts spanning adjustment, unequal career awareness, exploration, internships, competitions, self-regulated learning, burnout and postgraduate choices. Recorded actual full-text/abstract/index-only access and study limits; no fabricated sample totals or local prevalence.
- Changed: Literature reference, needs analysis, requirements, milestones, constraints index, MkDocs and AI LOG.
- Decisions: Treat year as context, not a deterministic recommendation. Add current-course learning support as a distinct research task. Preserve internships/competitions/graduate paths as hypotheses and separate information gains from choice certainty. No feature implementation or questionnaire launched.
- Verification: Source pages checked 2026-09-24; inspected population/design/result consistency and evidence-to-product inference. `UV_CACHE_DIR=/tmp/campus-agora-uv-cache bash scripts/ci/docs.sh` and `git diff --check` passed; documentation only.
- Follow-up: Local support-supply check and actual task contrasts; full-text limits remain explicit, especially the competition journal's 502 response.

### 2026-09-24 - Consolidate the eight-part needs analysis

- Result: Added `docs/product/needs-analysis.md` covering background, task-based users, alternatives, unmet needs, value, scope, requirements and feasibility. Linked local and external cases; distinguished facts, personal requests, hypotheses and missing observations. No new participant findings claimed.
- Changed: Needs report, product overview/requirements/milestones, MkDocs navigation and AI LOG.
- Decisions: AIDS remains the first pilot only. Same-task comparison includes general-purpose AI; valid outcomes include stopping. Promoted the four P1 bias checks into formal requirements and the report. Two-key supply proposal remains unadopted; campus API availability is not reopened as a needs blocker.
- Verification: `UV_CACHE_DIR=/tmp/campus-agora-uv-cache bash scripts/ci/docs.sh` passed strict build; `git diff --check` passed. Documentation only; no runtime changes or tests.
- Follow-up: Execute alternative-method comparisons, maintenance timing and ownership decisions; obtain a willing different-goal participant and one-week return observation. P1 and first-release scope remain open.

### 2026-09-24 - Read network-center posts on 词元计划 coverage

- Result: School news dated 2026-09-12, attributed to the network center, says 词元计划 was opened directly to faculty and students on 2026-05-07. By early September, 12,000 people had used https://llm.ustc.edu.cn; the platform offers a standard API and had processed over 1.4 trillion tokens. A February 2025 post from the WeChat account 中国科大网络信息服务, republished on Sohu, already offered local DeepSeek at https://chat.ustc.edu.cn and in the 中国科大 app to all enrolled faculty and students. The original WeChat archive was not fully retrieved.
- Changed: `docs/product/overview.md`, `docs/product/requirements.md`, `docs/product/milestones.md`, AI LOG.
- Decisions: Whether a student already holds a key is no longer a needs-analysis question. Guidance may assume 词元计划. Per-person quota and pasting a key into this site stay implementation checks. The two-key shape is still not built.
- Verification: News pages fetched 2026-09-24. `git diff --check` on the edited docs.
- Follow-up: None for the needs question of key possession.

### 2026-09-24 - Check 词元计划 before judging student API keys

- Result: USTC 词元计划 is the campus LLM service at https://llm.ustc.edu.cn, run by the network center. School news on 2026-06-03 says that by 2026-06-02 it had served over 4,000 faculty and students and over 100 billion tokens. A 2026-04-25 network-center note says the platform is open to all faculty and students and supports both API calls and visual chat. The live site includes key-management assets. This session did not log in, so per-person quota and third-party use of a personal key are unread.
- Changed: `docs/product/overview.md`, `docs/product/requirements.md`, `docs/product/milestones.md`, AI LOG.
- Decisions: Withdraw "most USTC students have no API key" as a reason to reject the two-key idea. Do not treat platform existence as proof that guidance keys already work in this product. The proposal stays unadopted until quota, external use, and stable guidance quality are checked.
- Verification: News page and llm.ustc.edu.cn fetched 2026-09-24. No login. `git diff --check` on the edited docs.
- Follow-up: Read the logged-in key application rules before designing guidance around 词元计划.

### 2026-09-24 - Review the two-key supply proposal instead of accepting it

- Result: User stopped the wholesale acceptance. Checked the proposal against the personal-use audience and P1 validation. Fixed workflow, pre-published information, and guidance that can be missing are compatible. Defaulting concrete guidance to a key the student brings is not: most intended users have no key, and guidance quality would vary with that key, so V1 could not be compared. A second key we ourselves hold is an operations split, not a user-facing dependency. Xiaohongshu and unapproved group collection stay out of the default sources.
- Changed: `docs/product/overview.md`, `docs/product/requirements.md`, `docs/product/milestones.md`, AI LOG. Earlier wording that called the shape accepted is withdrawn.
- Decisions: The proposal remains on record and is not a product decision. No crawl or key client is authorized by it.
- Verification: `git diff --check` on the edited docs.
- Follow-up: Revisit only if a later decision chooses whose key pays for guidance and how a student without a key still gets it.

### 2026-09-24 - Correct which API key serves information and which serves guidance

- Result: User rejected the split that showed raw crawl records with no key and ran all agent work on one maintainer key. Information is produced with our own webpage-maintenance API key and can be shown as published. Concrete guidance uses a separately supplied API key and stops where that key's capabilities stop.
- Changed: `docs/product/overview.md`, `docs/product/requirements.md`, `docs/product/milestones.md`, AI LOG. No crawler or key client added.
- Decisions: Two keys, neither stored in the repository. A missing guidance key does not hide information already published. Raw extracts are not the visitor-facing information layer.
- Verification: `git diff --check` on the edited docs.
- Follow-up: Supply todo now uses this split. Still do not build either key path.

### 2026-09-24 - Split the fixed workflow from API-key processing

- Result: User fixed the supply shape. The site shows one real workflow. Crawled records from chosen pages can be shown with no API key. Filtering, readable rewrites, and preparation drafts depend on the capabilities of a maintainer-supplied key; steps the key cannot do stay marked as not generated.
- Changed: `docs/product/overview.md`, `docs/product/requirements.md`, `docs/product/milestones.md`, AI LOG. No crawler or API client added.
- Decisions: The workflow does not change when the key changes. Keys are not stored in the repository. Source tiers and the ban on unapproved group collection stay as previously recorded.
- Verification: `git diff --check` on the edited docs.
- Follow-up: Still do not build the crawl or the key-backed steps until the open supply todo's checks have results.

### 2026-09-24 - Record the hoped-for maintenance workflow

- Result: User wants maintenance to move from hand-written cards to a workflow that fetches chosen pages, lets an agent filter, and publishes readable text. Xiaohongshu and group bots were named as further sources.
- Changed: `docs/product/overview.md`, `docs/product/requirements.md`, `docs/product/milestones.md`, AI LOG. No crawler or bot added.
- Decisions: Chosen public pages are the first automation candidate. Xiaohongshu stays personal experience and depends on whether that collection is allowed. A group bot is in scope only after that group agrees; unapproved group chats are not collected. Published text must be readable and must separate official fact, personal experience, and unknown. Someone still owns the source list and corrections. V5 timing is still required before building this.
- Verification: `git diff --check` on the edited docs.
- Follow-up: Open todo "Automated supply workflow, not yet built".

### 2026-09-24 - Read the Marxism School Xingce signup notice

- Result: The signup notice is https://marx.ustc.edu.cn/2023/0606/c30320a605104/page.htm on the notice board. It tells students to scan a code for current large lectures and small classes, including open and closed registration, then submit a signup form. Attendance is classroom check-in. Students may email instructors to request a class. The image filename indicates the code was replaced on 2026-09-17. The code itself was not decoded, so the session list and credit marks are still unread.
- Changed: opportunity-needs-map.md, product overview, requirements N13, milestones P1-07, AI LOG.
- Decisions: Hearing a lecture and submitting the year-3 report are different entrances. N13 stays unverified until the code target is read.
- Verification: Page fetched 2026-09-24. QR decode with OpenCV returned no payload. `git diff --check` on the edited docs passed.
- Follow-up: Open the code target and record fields, quotas, and whether a session is marked as counting.

### 2026-09-24 - Withdraw the claim that Xingce has no public signup site

- Result: User corrected the desk check. A dedicated signup website exists. Public search did not open it, and that miss was wrongly written as if no per-event signup entry had been found.
- Changed: opportunity-needs-map.md, product overview, requirements N13, milestones P1-07, AI LOG.
- Decisions: Credit rules from 教字〔2024〕19号 and the FAQ stay. Statements about the signup site wait until its URL is read. N13 remains unverified.
- Verification: Doc correction only.
- Follow-up: Read the signup site once the user supplies the URL.

### 2026-09-24 - Desk-check the Xingce requirement against official rules

- Result: Read 教字〔2024〕19号 and the academic-affairs FAQ. 形势与政策 is an existing multi-year requirement: 8 non-academic lectures, two reports, first submission in year-3 fall weeks 1–4 via 瀚海教学网, with email/SMS after the course is placed. No public per-event eligibility calendar was found. Login lists were not tested. Added candidate N13: judge whether an event counts and show progress; stop instead of adding preparation when it does not count.
- Changed: `docs/constraints/opportunity-needs-map.md`, `docs/product/requirements.md`, `docs/product/overview.md`, `docs/product/milestones.md`, AI LOG.
- Decisions: This does not put 行策 into the first release, does not close V1–V5, and does not close the P1 validation bias checks. N06's optional preparation step does not apply to a non-counting event.
- Verification: `git diff --check` on the edited docs. No user observation and no authenticated page.
- Follow-up: Log in before claiming there is no eligibility list. Keep notice-to-follow-up and task planning as separate ordinary-week alternatives.

### 2026-09-24 - Bind P1 perspective biases into the AI log

- Result: Reviewed the current P1 frame. It fits a student who already intends to apply and can research, then needs to understand an opportunity and start preparing. Treated as the whole product, that frame is skewed.
- Changed: `docs/ai-log/todo.md`, `docs/ai-log/done.md`. No product-scope or runtime change.
- Decisions: Later sessions must apply the open "P1 validation bias checks" item before counting V1–V5. The author's own mentor replay, a research-to-employment switch, and per-record timing do not by themselves close P1. A general-purpose chatbot is part of the baseline. One correct outcome is to stop. A second person who did not write the cards is required for user evidence. Maintenance must name who continues after the author stops.
- Verification: Doc edit only. `git diff --check -- docs/ai-log/todo.md docs/ai-log/done.md` passed.
- Follow-up: Bias checks remain in `docs/ai-log/todo.md`. Formal V1–V5 text in `docs/product/requirements.md` is unchanged.

### 2026-09-23 - Cross-user and cross-opportunity evidence map

- Result: Eight overlapping user states, ten case/data groups, alternatives,
  G1–G7 shared needs with domain differences and five task scenarios. Mentor
  discovery remains one pilot; no premature MVP narrowing.
- Changed: opportunity-needs-map.md, product overview/milestones, constraints
  index, MkDocs navigation and AI LOG.
- Evidence: Official notices, SOLO/Handshake help, platform survey methods;
  clearly distinguishes published counts, product hypotheses and source limits.
- Verification: `UV_CACHE_DIR=/tmp/campus-agora-uv-cache bash scripts/ci/docs.sh`
  and `git diff --check` passed. No user testing or runtime implementation.
- Follow-up: Broaden remaining coverage, observe real tasks, test supply cost;
  current Xingce endpoint and authenticated service capabilities remain unknown.

### 2026-09-23 - Restore product-wide needs research

- Result: User clarified AIDS mentor discovery is only the first pilot. Current
  P1 covers users across disciplines/stages/goals and multiple opportunity types;
  product potential, research scope and implementation order are now separated.
- Changed: AGENTS.md, product overview/milestones, scope notes in both mentor
  research references, AI LOG. Added P1-11 for cross-scenario evidence.
- Verification: `UV_CACHE_DIR=/tmp/campus-agora-uv-cache bash scripts/ci/docs.sh`
  and `git diff --check` passed; scope correction only, no new evidence or
  completed broader research claimed.
- Follow-up: Build cross-user/scenario evidence and test shared versus distinct
  needs before setting first-release priorities.

### 2026-09-23 - Evidence-backed workflow requirements draft

- Result: Official admissions edge cases, external survey and qualitative study,
  alternative-service scope, two explicitly labelled desk walkthroughs and eight
  candidate requirements with acceptance tasks and open evidence gaps.
- Changed: docs/constraints/mentor-workflow-evidence.md, constraints index,
  product overview/milestones, documentation navigation and AI LOG.
- Verification: `UV_CACHE_DIR=/tmp/campus-agora-uv-cache bash scripts/ci/docs.sh`
  and `git diff --check` passed. Source receipt renderer succeeded (six findings).
- Evidence limits: Source facts distinguished from product inferences; no student
  observation, causal effect, time-saving measurement or automated crawling.
  Yanbridge description readable; main-site request timed out, capabilities not
  exhaustively tested. P1 remains open; priorities are provisional.

### 2026-09-23 - Make reusable workflow the product acceptance target

- Result: User mentor search is the first real pilot; lists and research are
  intermediate outputs. Defined six workflow steps, user/tool roles, manual
  gap tracking and changed-preference replay; no generic workflow builder.
- Changed: AGENTS.md, product overview/milestones, AIDS research reference and AI LOG.
- Verification: `UV_CACHE_DIR=/tmp/campus-agora-uv-cache bash scripts/ci/docs.sh`
  and `git diff --check` passed; documentation only, no runtime validation claimed.
- Follow-up: Execute the pilot and replay, then scope prototype/collection from
  observed gaps. Neither pilot nor replay is claimed complete.

### 2026-09-23 - AIDS mentor direction and source research

- Result: Ten named direction-screening samples, recruiting channels, direction
  exploration exercises, lab comparison questions and a scoped collection pilot
  recorded in docs/constraints/aids-mentor-research.md.
- Changed: Research reference, product overview/milestones, constraints index,
  MkDocs navigation and AI LOG. User favors research; AI4M means AI for Math;
  employment remains a separate comparison lens for other students.
- Verification: `UV_CACHE_DIR=/tmp/campus-agora-uv-cache bash scripts/ci/docs.sh`
  passed; `git diff --check` passed. Public sources read; no crawler or runtime
  behavior implemented or tested.
- Limits: This is not ten verified openings or a completed P1 sample set.
  Admission years, recent-work deep reads and actual advising experience remain
  to be checked; US/HK/institute coverage needs expansion.

### 2026-09-23 - Select mentor discovery as the first use case

- Result: User selected mentor information for third-year students preparing
  postgraduate study, covering USTC, other mainland universities, institutes,
  Hong Kong and the US, without restricting disciplines.
- Changed: Product overview, roadmap, constraints index, mentor-source-reference,
  documentation navigation and AI LOG. Other opportunity types remain deferred.
- Evidence: Nine official source entry points recorded with read/discovery status;
  these are not nine verified available positions or the completed 20–30 mentors.
- Decisions: Associate mentors/groups with degree programs and intake-specific
  notices; distinguish recommendation admission, overseas applications and research
  internships. Do not infer openings from profile existence or a student's year.
- Verification: Public official-source searches and page reads; temporary-cache
  documentation build and `git diff --check` passed. No runtime changes.
- Follow-up: Complete specific mentor records, broaden disciplines, associate
  application guidance and evaluate supply/maintenance in P1.

### 2026-09-23 - Add personal activity and notice subscriptions as a candidate

- Result: Added user-proposed Xingce entry-discovery problem, activity/notice
  aggregation, opt-in updates and reminders to product research scope.
- Changed: Product overview, P1-07 in milestones, and AI LOG.
- Decisions: No community or organizer-onboarding dependency. Channel, frequency
  and first-release priority remain open; existing official services need checking.
- Verification: Documentation build with temporary uv cache and `git diff --check`.
  No runtime changes, subscriptions created or external notifications sent.

### 2026-09-23 - Clarify initial product as a personal-use tool

- Result: Replaced community-cold-start framing with explicit individual-use
  scope. Community is only a potential future extension, not a planned phase;
  editorial information maintenance is distinct from user community features.
- Changed: Product overview, milestones, README, docs index and AGENTS.md.
- Verification: `UV_CACHE_DIR=/tmp/campus-agora-uv-cache bash scripts/ci/docs.sh`
  and `git diff --check`. No runtime code changed.
- Follow-up: P1 research remains pending under the clarified scope.

### 2026-09-22 - Reset active product baseline and retire community roadmap

- Result: Replaced product overview with opportunity discovery and contextual
  guidance requirements; introduced P1-P5 roadmap and concrete P1 research tasks.
  Retired old M-series future tasks and preserved the original roadmap as history.
- Changed: Product overview/milestones, AGENTS, README, docs home and constraints
  index; historical banners on old product references and initialization spec;
  pending-reassessment notices on legacy privacy/auth/desktop/governance docs;
  navigation labels distinguish historical references.
- Decisions: Cross-campus and cross-disciplinary coverage, single-user value,
  external information supply, no default community/SSO/desktop prerequisites.
  MVP details remain proposed pending P1/P2; runtime assets are not presumed useful.
- Verification: `UV_CACHE_DIR=/tmp/campus-agora-uv-cache bash scripts/ci/docs.sh`
  and `git diff --check` passed. Default-cache build initially failed because
  ~/.cache/uv was read-only; temporary cache resolved it. No runtime code changed
  or runtime readiness revalidated. Remote issues and PRs were not modified.
- Follow-up: P1 research in todo.md; evaluate existing assets during P2.

### 2026-09-22 - Organize opportunity platform development plan

- Result: Organized agreed direction, open needs, proposed MVP, user journeys,
  information supply, engineering design, incremental delivery and validation.
- Decisions: Serve USTC users initially with cross-campus, cross-disciplinary
  research, competition and internship information plus contextual guidance.
  Prioritize single-user discovery-to-action value over community growth.
- Changed: AI LOG only; planning delivered in conversation as a proposal.
- Verification: Read product overview, milestones, constraints index and package
  scripts; `git diff --check`. No runtime checks needed for log-only changes.
- Follow-up: Align formal product docs and future milestones with the revised
  direction before business implementation; current community scope is stale
  relative to this conversation. Existing runtime readiness was not revalidated.

### 2026-09-22 - Value-first needs research and VISTA counterexample

- Result: Found USTC VISTA's 2025 upgrade already covers exchange applications,
  documents, travel preparation and return workflows; 2021 documentation also
  described interest-based recommendations. Downgraded generic SOLO replication.
- Evidence: [VISTA upgrade](https://sz.ustc.edu.cn/cn_mobile/xwgg_show/2201.html),
  [2026 local student event](https://physics.ustc.edu.cn/2026/0613/c23786a744381/page.htm),
  [REU guidance](https://doi.org/10.1371/journal.pcbi.1011573),
  [early-feedback study](https://arxiv.org/abs/2510.16052),
  [existing planner](https://mystudylife.com/tour/).
- Decisions: Value means less application preparation work or easier progress on
  complex assignments. Source links are supporting usability, not the product
  pitch. Do not infer software adoption from anecdotes, service descriptions or
  the existence of procrastination. Keep application and coursework hypotheses
  separate pending better local evidence.
- Changed: AI LOG only; no product spec or implementation changes.
- Verification: Public web searches and primary-source reads on 2026-09-22;
  `git diff --check`. VISTA authenticated coverage was not tested.
- Follow-up: No questionnaire needed for this desk-research stage. If choosing
  between the two hypotheses remains blocked, examine a few actual student
  workflows before surveying prevalence. No outreach conducted.

### 2026-09-22 - Deepen SOLO and Assignment Calculator cases

- Result: Examined SOLO discovery, application dependencies and program-officer
  lifecycle; compared Minnesota research-paper, speech, lab-report and dissertation
  templates and evidence of reuse at other colleges.
- Evidence: [SOLO](https://solo.stanford.edu/about),
  [research opportunity](https://solo.stanford.edu/opportunities/2026-27-ay-pt-research-fellowship-thirsting-solutions),
  [calculator](https://www.lib.umn.edu/services/ac),
  [McDaniel adaptation](https://hoover.mcdaniel.edu/calculator/).
- Decisions: Separate verified features from proposed AI extraction, comparison,
  requirement provenance and replanning. Prefer a narrow personal application
  workspace; USTC already has research-plan application and review workflows.
- Changed: AI LOG only; detailed findings delivered in conversation.
- Verification: Public primary-source page reads and searches on 2026-09-22;
  `git diff --check`. No authenticated workflows, date-form interactions or
  effectiveness study tested; no claim of a proven USTC-wide service gap.
- Follow-up: Compare a prototype against source pages plus generic AI using real
  notices and a small user sample before committing to product scope.

### 2026-09-22 - Reassess single-user campus tools

- Result: Benchmarked NUSMods, Cornell Scheduler, Princeton ReCal, Tsinghua
  Learn Helper, Stanford SOLO, Cambridge Spacefinder, and Minnesota Assignment
  Calculator against the user's single-user-value and external-data criteria.
- Evidence: [NUSMods data](https://api.nusmods.com/v2/),
  [SOLO](https://solo.stanford.edu/about),
  [Spacefinder](https://spacefinder.lib.cam.ac.uk/),
  [Assignment Calculator](https://www.lib.umn.edu/services/ac),
  [Learn Helper](https://github.com/Harry-Chen/Learn-Helper).
- Counterexamples: [Life@USTC](https://github.com/Life-USTC/Life-USTC) already
  documents academic information aggregation; [class-arrange](https://github.com/RaymondzyLei/class-arrange)
  documents local scheduling and conflict checking; USTC library already offers
  space booking. Repository descriptions are not proof of tested reliability.
- Decisions: Prefer personal opportunity comparison/preparation, task planning
  grounded in requirements, or purpose-based space discovery. Existing university
  data supply and institutional integrations cannot be assumed transferable.
- Changed: AI LOG only; recommendations delivered in conversation.
- Verification: Public primary-source searches and page reads on 2026-09-22;
  `git diff --check`. No usage study or authenticated product testing.
- Follow-up: Validate narrow tasks against existing tools and generic AI before
  accepting any proposed feature gap or changing implementation milestones.

### 2026-09-22 - Deepen research on collaboration and activity discovery

- Result: Found stronger existing-service overlap and narrowed both proposals.
  USTC Geek Centers and the academic-practice platform already support early
  research entry; the portal manual documents topic subscriptions and calendars.
- Evidence: [2026 Geek Centers exchange](https://news.ustc.edu.cn/info/1055/94805.htm),
  [portal announcement and manual](https://ustcnet.ustc.edu.cn/2025/0416/c33496a680486/page.htm),
  [existing mail/calendar tool](https://git.ustc.edu.cn/ustcnic/ai/-/merge_requests/115),
  [MIT expectations](https://urop.mit.edu/mentors/resources/urop-experience/),
  [Berkeley applications](https://research.berkeley.edu/urap/application/),
  [EPFL projects](https://make.epfl.ch/projects),
  [Michigan event feeds](https://events.umich.edu/feeds).
- Changed: AI LOG only. Detailed comparison delivered in conversation.
- Verification: Public primary-source searches, page reads, portal manual text,
  and `git diff --check`; no authenticated platform walkthrough or user study.
- Decisions: Short research trials are a proposed experiment, not an established
  local demand. Prioritize explicit project roles/commitments or event lifecycle
  and participation fit; avoid duplicating generic listings and subscriptions.
- Follow-up: Inspect academic-practice and portal functions with authorized users;
  validate organizer supply and participant outcomes before implementation.

### 2026-09-22 - Research campus software opportunities

- Result: Compared public USTC services with SJTU Shuiyuan, UBC Wiki, MIT UROP,
  Michigan Maize Pages, Stanford Carta, and Tsinghua's student AI assistant;
  delivered research and prototype recommendations in the conversation.
- Changed: AI LOG only; no runtime or milestone changes.
- Evidence: [USTC research-plan notice](https://www.teach.ustc.edu.cn/notice/notice-teaching/19630.html),
  [USTC navigation](https://ustc.life/), [model platform](https://llm.ustc.edu.cn/guide/),
  [Shuiyuan guide](https://welcome.sjtu.edu.cn/info/1025/1382.htm),
  [MIT UROP](https://urop.mit.edu/), [Maize Pages](https://maizepages.umich.edu/),
  [Tsinghua assistant](https://www.tsinghua.edu.cn/info/1176/114345.htm).
- Verification: Public web searches and page reads on 2026-09-22; `git diff --check`.
- Decisions: Existing forums, course reviews, campus encyclopedia, research
  applications, activity services, and model access are not blank-slate gaps.
  Recommended validating knowledge maintenance, short research collaborations,
  and cross-source activity discovery; Web 4.0 remains framing, not a requirement.
- Follow-up: Demand and private-system coverage require student interviews and
  authorized campus walkthroughs before changing product scope. No claim of
  nationwide absence or current forum participation levels was established.

### 2026-07-06 - 明确工具目录和文档时效规则

- Result: 新增 `tools/README.md`，并在 `AGENTS.md` 中明确长期文档的更新时间规则。
- Changed: `tools/README.md`, `AGENTS.md`, `docs/ai-log/done.md`。
- Verification: `env UV_CACHE_DIR=/tmp/campus-agora-uv-cache bun run ci:docs`, `git diff --check` 和工作区状态检查。
- Decisions: 使用 `README.md` 作为工具目录说明文件；长期文档在实质更新时维护 `Last updated: YYYY-MM-DD`。
- Follow-up: 后续移动工具配置或更新决策性文档时，同步更新时间并核对代码、脚本和 CI。

### 2026-07-06 - 收纳根目录工具配置

- Result: 将文档构建配置和 API 镜像 Dockerfile 从根目录移入工具目录，减少根目录配置文件数量。
- Changed: `tools/docs/*`, `docker/api/Dockerfile`, root scripts, README, engineering and deployment docs, active spec。
- Verification: `env UV_CACHE_DIR=/tmp/campus-agora-uv-cache bun run ci:docs`, `docker build --check -f docker/api/Dockerfile .`, `bash -n scripts/ci/docs.sh scripts/ci/container.sh`, `git diff --check` 和旧路径扫描。
- Decisions: 保留 `package.json`、`Cargo.toml`、lockfiles、Git 与编辑器配置在仓库根目录，保证工具默认发现路径稳定。
- Follow-up: 若继续收纳配置，优先只移动可显式传参的工具配置；不要破坏 Bun、Cargo、Git、编辑器默认发现路径。

### 2026-07-06 - 清理约束参考文档语气

- Result: 将约束参考、里程碑和 MkDocs 入口调整为中文项目参考语气，移除回答式措辞。
- Changed: `docs/constraints/*`, `docs/product/milestones.md`, `docs/index.md`, `mkdocs.yml`。
- Verification: `env UV_CACHE_DIR=/tmp/campus-agora-uv-cache bun run ci:docs`、`git diff --check` 和措辞扫描。
- Decisions: 保留参考文档与正式文档的分层；约束参考继续作为细节清单，已接受要求仍需提升到正式文档或里程碑。
- Follow-up: 后续补充 `docs/constraints/` 时继续使用项目参考语气，避免复制聊天回答格式。

### 2026-07-06 - Promote reference notes into docs constraints

- Result: Moved root-level local reference notes into publishable
  `docs/constraints/` files and expanded milestone tracking.
- Changed: Added constraint reference docs and reading map, updated MkDocs nav,
  expanded `docs/product/milestones.md`, updated `AGENTS.md` collaboration
  rules, and linked constraints from the docs index.
- Verification: `env UV_CACHE_DIR=/tmp/campus-agora-uv-cache bun run
  ci:docs`, `git diff --check`, and old project-name scan over AGENTS.md,
  docs, and MkDocs config.
- Decisions: Kept constraint references separate from formal architecture and
  product docs. Accepted rules should be promoted into formal docs and
  milestones when implemented.
- Follow-up: Keep future durable reference notes under `docs/constraints/`
  instead of the repository root.

### 2026-07-06 - Resolve M0 review findings after PR #2 merge

- Result: Addressed the post-rebase M0/M0.1/M0.2 review findings on PR #3.
- Changed: Flattened API `ErrorResponse`, regenerated OpenAPI and TypeScript
  contract types, updated API client error normalization, added CORS allowlist
  and request body limit middleware, expanded API tests, and corrected
  governance docs for roles and retention.
- Verification: `bun run api:types`, `cargo test -p campus_agora_api --test
  health`, `cargo test -p campus_agora_api --test openapi`,
  `bun --cwd packages/api-client test`, `cargo test -p campus_agora_api`,
  `cargo check --workspace --all-targets`, `cargo clippy --workspace
  --all-targets -- -D warnings`, `cargo test --workspace`, `bun run
  ci:frontend`, `env UV_CACHE_DIR=/tmp/campus-agora-uv-cache bun run
  ci:docs`, and `git diff --check`.
- Decisions: Kept the generated contract as the source of TypeScript response
  types, while the API client still accepts the old nested error shape for
  compatibility. Runtime CORS and body limit controls were implemented because
  the canonical spec already listed them in initialization scope.
- Follow-up: PR CI should still cover Docker/socket-backed checks that this
  sandbox cannot run directly.

### 2026-07-06 - Implement M0.2 governance docs and boundaries

- Result: Added formal M0.2 documentation for product scope, privacy,
  milestones, architecture, backend, auth/permissions, desktop, LFS, quality,
  operations, security, and deployment boundaries.
- Changed: `docs/product/*`, `docs/architecture/{overview,backend,auth-permissions,desktop}.md`,
  `docs/engineering/lfs.md`, expanded development/quality/deployment docs,
  updated `docs/index.md`, `mkdocs.yml`, README, AI LOG, and the M0.2 plan.
- Verification: `bun run ci:docs`, `test ! -d site/superpowers/specs`,
  `test ! -d site/superpowers/plans`, `git diff --check`, and placeholder
  scan over formal docs.
- Decisions: Kept M0.2 documentation-only; no runtime behavior, dependencies,
  APIs, database schema, or CI topology changed.
- Follow-up: After M0.1 merges, publish M0.2 as a follow-up PR or rebase this
  stacked branch onto `main`.

### 2026-07-06 - Rename automation folder to scripts

- Result: Renamed the repository automation directory to `scripts/`.
- Changed: Updated `package.json`, `.github/workflows/ci.yml`, README,
  engineering docs, active M0.1 plan/spec, and existing AI LOG references.
- Verification: stale singular-path scan, `test ! -d script`, `test -d
  scripts`, `bash -n scripts/build.sh scripts/ci/*.sh`, `bun run build:all`,
  `bun run ci:docs`, and `git diff --check`.
- Decisions: Kept the same script layout under the more conventional plural
  directory name.
- Follow-up: Use `scripts/` for future repository automation.

### 2026-07-06 - Add repository automation scripts

- Result: Added shared repository automation scripts for local builds and CI
  job parity.
- Changed: Added `scripts/README.md`, `scripts/build.sh`, `scripts/ci/*.sh`,
  `bun run ci:*`, and `bun run build:all`; updated CI jobs to call scripts;
  documented the workflow split policy in README, engineering docs, the active
  spec, and the M0.1 plan.
- Verification: `bash -n scripts/build.sh scripts/ci/*.sh`, `bun run
  ci:frontend`, `bun run ci:contract`, `bun run ci:desktop`, `bun run
  ci:docs`, `bun run build:all`,
  `DATABASE_URL=postgres://campus_agora:campus_agora@127.0.0.1:55435/campus_agora bun run ci:backend`,
  `bun run ci:container`, and `git diff --check`.
- Decisions: Kept CI in one `.github/workflows/ci.yml` because all jobs share
  the same pull request and `main` push triggers. Scripts now carry command
  reuse; workflow files should split later only for different triggers,
  permissions, deployment lifecycles, or schedules.
- Follow-up: Add new CI scripts only when a workflow gains a distinct local
  reproduction command.

### 2026-07-06 - Switch docs tooling to uv

- Result: Replaced the MkDocs `requirements-docs.txt` flow with uv project
  metadata.
- Changed: Added `pyproject.toml` and `uv.lock`, deleted
  `requirements-docs.txt`, updated `docs:build`, CI docs job, README, quality
  docs, development docs, and the active spec/plan references.
- Verification: `uv lock`, `bun run docs:build`,
  `test ! -d site/superpowers/specs`, `test ! -d site/superpowers/plans`,
  `rg -n "requirements-docs|setup-python|python -m pip|pip install" ...`,
  and `git diff --check`.
- Decisions: CI uses `astral-sh/setup-uv@v6` and runs
  `uv run --locked mkdocs build --strict` directly, without installing Bun in
  the docs job.
- Follow-up: Add future MkDocs themes or plugins to `pyproject.toml`, then
  refresh `uv.lock`.

### 2026-07-06 - Implement M0.1 contract and quality gates

- Result: Added the M0.1 engineering quality loop around the repository
  skeleton.
- Changed: API readiness, request IDs, JSON error shape, OpenAPI export,
  committed contract snapshot, generated TypeScript API types, API client mock
  fetch, API client tests, initial SQL migration, `.env.example`, MkDocs
  config, uv-backed docs tooling, Dockerfile, GitHub Actions CI, README
  commands, and M0.1 plan.
- Verification: `bun run api:types`, hash comparison for
  `contracts/openapi.json` and `packages/api-client/src/generated.ts`,
  `bun run lint`, `bun run lint:styles`, `bun run typecheck`,
  `bun run build`, `bun run test`,
  `cargo clippy --workspace --all-targets -- -D warnings`,
  `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`,
  `cargo fmt --all --check`,
  `cargo fmt --manifest-path apps/desktop/src-tauri/Cargo.toml --check`,
  `uv run --locked mkdocs build --strict`,
  `test ! -d site/superpowers/specs`, `test ! -d site/superpowers/plans`,
  `docker build -f Dockerfile.api .`, temporary PostgreSQL 16 container
  readiness via `docker exec ... pg_isready`,
  `DATABASE_URL=postgres://campus_agora:campus_agora@127.0.0.1:55432/campus_agora cargo sqlx migrate run --source crates/db/migrations`,
  and `git diff --check`.
- Decisions: Used a minimal deterministic local OpenAPI/TypeScript generator
  instead of adding a heavier OpenAPI codegen dependency in M0.1.
- Follow-up: No remaining local Docker/sqlx blocker; rerun the same migration
  smoke test when migrations change.

### 2026-07-06 - Define AI collaboration rules

- Result: Added project-level AI collaboration rules and created AI LOG files.
- Changed: `AGENTS.md`, `docs/ai-log/todo.md`, and `docs/ai-log/done.md`.
- Verification: `git diff --check` and
  `rg -n "[ \t]+$" AGENTS.md docs/ai-log/todo.md docs/ai-log/done.md`.
- Decisions: Kept the rule set lightweight in `AGENTS.md`; deferred a fuller
  engineering guide to M0.2 governance docs.
- Follow-up: Apply the AI LOG workflow to future non-trivial agent tasks.

### 2026-07-06 - Initialize M0 repository skeleton

- Result: Created the runnable Campus Agora M0 skeleton and merged it through
  PR #1.
- Changed: Web app, Tauri shell, Rust workspace, API client package, workspace
  scripts, Apache-2.0 license, repository metadata, and M0 implementation plan.
- Verification: `bun run lint`, `bun run lint:styles`, `bun run typecheck`,
  `bun run build`, `bun run test`,
  `cargo clippy --workspace --all-targets -- -D warnings`,
  `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`,
  `cargo fmt --all --check`,
  `cargo fmt --manifest-path apps/desktop/src-tauri/Cargo.toml --check`, and
  `git diff --check`.
- Decisions: Kept M0 limited to a runnable skeleton; deferred contract
  generation, CI hardening, governance docs, and MkDocs publishing to later
  milestones.
- Follow-up: Start M0.1 contract and quality gates.

### 2026-07-06 - Compress repository history

- Result: Rewrote `main` into a two-commit history.
- Changed: Squashed previous docs/spec iteration commits into
  `docs: add campus agora initialization spec`, followed by
  `chore: initialize m0 repository skeleton`.
- Verification: Compared the rewritten `HEAD` with the previous remote `main`
  tree and confirmed no file content diff.
- Decisions: Kept the final project tree unchanged while making history easier
  to review.
- Follow-up: Future history rewrites should be explicit user requests.


### 2026-09-24 - Preparation guidance evidence and product focus

- Expanded docs/constraints/opportunity-needs-map.md with five primary-source cases, five illustrative preparation cards and G8–G11 candidate needs.
- Updated docs/product/overview.md and milestones.md: task understanding and preparation are central; application handling redirects to official services after key conditions and dates. Prepared users may skip guidance.
- Distinguished basic requirements, preferred qualifications, suggested exercises and participation support. No user-testing or runtime-completion claim.
- Verification: `UV_CACHE_DIR=/tmp/campus-agora-uv-cache bash scripts/ci/docs.sh` passed; `git diff --check` passed.
- Follow-up: real task comparisons and maintenance measurement; scope remains product-wide, AIDS is the first pilot only.


### 2026-09-24 - Three source-backed preparation cards

- Expanded docs/constraints/opportunity-needs-map.md with AlphaEdit, BCG simulation and historical physics competition cards, same-task source comparisons, supply gaps and observation tasks; updated P1-13 in milestones.md.
- Found AlphaEdit repository states at least one A40 48GB GPU; separated reading from experiment preparation. Existing BCG task feedback should be linked rather than presumed missing. Competition appendix remains unread and signup historical.
- Verification: docs strict build and git diff --check passed. No runtime change, external registration, actual student test or measured per-card production time.
- Next: observe varied users and measure content work independently; narrow preparation depth before implementing.


### 2026-09-24 - Resource discovery and access

- Added official compute, library, equipment and research-support evidence to opportunity-needs-map.md and linked resources to preparation tasks. Updated overview.md and milestone P1-14/G12.
- Distinguished supercomputer registration from AI platform applications; AI training-job application says pending launch. Machine-time spending limit is not free credit. Literature subsidy and historical project funding are conditional.
- Verification: strict docs build and git diff --check passed. No login, application or actual resource allocation tested.
- Follow-up: task observation, eligibility/compatibility and maintenance validation.


### 2026-09-24 - Consolidated requirements baseline

- Added docs/product/requirements.md: N01–N12 with G/R evidence mapping, candidate priorities, complete and exception flows, content/personal-use constraints, supply validation, V1–V5 and decision gates.
- Updated overview, milestones/P1-15, mentor-workflow-evidence and MkDocs navigation; corrected residual application-procedure emphasis.
- Candidate priorities are recommendations, not measured user demand or a finalized implementation scope. Content prototyping can now inform P1; broad research scope remains intact.
- Verification: `UV_CACHE_DIR=/tmp/campus-agora-uv-cache bash scripts/ci/docs.sh` and `git diff --check` passed. No runtime or user test performed.
- Next: content prototype and focused task/cost validation, not additional case counts for their own sake.


### 2026-09-24 - Clickable local content prototype

- Created tools/prototypes/opportunities.html and README.md; six evidence-based records, search/filter/empty state, comparison, preparation/resource links, local saved notes and next steps. Temporary display name is not a project rename.
- Updated requirements/milestones; prototype is separate from production app, with static content and no backend or live collection.
- Verification: Playwright via `/tmp/check-campus-prototype.cjs` passed search/reset, comparison, escaped notes, save/reload/next steps, resource/history statuses, 390px overflow and no page errors. Desktop/mobile screenshots visually inspected. Default browser missing; installed Chromium 1228 used successfully.
- Strict docs build and git diff --check passed. Production app unchanged; no full production CI claimed.
- Follow-up: actual task observation and content maintenance timing; prototype lacks preference editing and live updates. Local preview server bound only to 127.0.0.1:8765.


### 2026-09-24 - UI library and visual policy locked

- Selected Primer React Product UI + Primitives + Octicons; light neutral palette, standard Primer blue interaction, system sans-serif and normal tracking.
- Added docs/product/ui-system.md; replaced conflicting frontend-reference.md, updated AGENTS, overview/milestones, constraints index, navigation and prototype README.
- Read requested 107 workspace VIS reference: CMYK is not official HEX; its blue web adaptation is a candidate. Reused neutral/semantic color principles, not its assets or card patterns. Compared official Primer and Ant Design docs and GitHub list structure.
- Explicitly banned emoji icons, eyebrows, subtitles, gradients, bordered content cards, Tailwind and handwritten styles including inline style/sx workarounds.
- Verification: strict docs build and git diff --check passed. No runtime dependency or style migration claimed; previous HTML visual is superseded, content can be reused.
- Next: migrate content prototype using exact-pinned Primer dependencies and verify UI restrictions and interactions.


### 2026-09-24 - Persisted requirements-analysis contract

- Added eight required sections, evidence and completion criteria, need/solution distinction and analysis-first order to docs/product/requirements.md.
- Synchronized AGENTS.md, overview.md, milestones.md and todo priority so prototype/UI work cannot silently displace the analysis.
- Verification: strict docs build and git diff --check passed. This records the contract; the full analysis report remains pending.


### 2026-09-29 - Version-aware review and advisor participation structure

- Fast-forwarded local checkout to PR #10 commit feb4549 before editing; preserved teammate v0.6 decisions and the untracked legacy prototype. No remote merge or push.
- Updated requirements-handoff.md to v0.7, synchronized overview.md and needs-analysis.md, and appended review disposition, Arno/MIT comparison, four real material cases and bounded supply proposal to mentor-workflow-evidence.md.
- Reused the earlier browser inspection of Arno; freshly read MIT policy, HKUST visiting rules, USTC faculty intake page and official RSTAR launch notice. Existing ICT evidence reused with its original date; failed UROP/RSTAR direct fetches do not count as body evidence.
- Separated person from participation route, scoped conditions from general school guidance, experience evidence from questions, and corrected handoff readability/status inconsistencies. No user test or sustainable supply claim.
- Verification: UV_CACHE_DIR=/tmp/campus-agora-uv-cache bash scripts/ci/docs.sh and git diff --check passed. Documentation-only work; no runtime checks needed.
- Follow-up: finite content trial with actual research work/usable experience material and maintenance timing; owner and release coverage remain unresolved. Changes remain local.


### 2026-09-29 - Four-candidate advisor content pilot

- Added comparable research questions, participation routes, experience gaps and optional next steps for Xiang Wang, Yingfei Xiong, Tianqi Chen and Charles Zhang to tools/prototypes/opportunity-content.md; detailed source/failed-link records in docs/constraints/mentor-source-reference.md; progress linked from requirements-handoff.md.
- Six route checks comprise four explicit faculty statements, one institutional relationship and one unconfirmed visiting path; not six open opportunities. Alumnus self-description corroborates one advisor relationship/career record, not mentoring quality.
- Source-reading/assembly/check interval 14:43:48–14:46:30 UTC, 162 seconds. Reused prior research; not per-record human effort or recurring maintenance measurement. No contacts, crawlers or user tests.
- Verification: strict docs build and git diff --check passed; local Markdown links from content sample checked for file existence. No runtime changes. Changes remain local, not pushed.
- Follow-up: actual update timing, missing individual admission/visiting links and usable first-person guidance evidence; do not expand samples just to fill counts.


### 2026-09-30 - Advisor task and information design v0.1

- Created docs/product/advisor-task-design.md with entry paths, result/detail/comparison contents, direct resource lookup, private records, conceptual relationships, six desk checks and prototype acceptance mapped to existing N identifiers.
- Reused four-candidate specimens; separated route/eligibility from interest, source status from intake status, and records from actual mentoring experience. No new browsing, participant results, runtime implementation or data supply claims.
- Linked design in overview.md, milestones.md, requirements-handoff.md and MkDocs navigation; next work is a finite Primer interaction prototype, not automatic sample expansion. Session-only prototype storage cannot establish return value.
- Verification: UV_CACHE_DIR=/tmp/campus-agora-uv-cache bash scripts/ci/docs.sh; git diff --check; design relative links checked for existing files. All passed. Runtime tests not applicable to this documentation change.
- Existing uncommitted research edits and legacy untracked HTML retained. No commit or remote push in this turn.


### 2026-09-30 - Requirements completeness reassessed with transferable evidence

- Added source-specific applicability judgments and eight-part completion matrix to needs-analysis.md; synchronized overview, milestones, handoff and active todo priority.
- Comparable task/population evidence supports common needs without a new USTC survey. Kept actual methodological limits, local rule applicability and product efficacy distinct; did not assume elite-university labels imply population equivalence.
- Conclusion: reviewable analysis, remaining convergence/decision work; prototype is no longer default next task. No new research or participant data claimed.
- Verification: strict docs build and git diff --check passed. Changes remain local.


### 2026-09-30 - Persist negotiated requirements decisions

- Synchronized AGENTS.md, overview.md, needs-analysis.md, requirements.md and requirements-handoff.md (v0.8): discovery and judgment serve autonomous choice; relevant public/consented knowledgeable-contact entries support further inquiry; automation collects/organizes while the team verifies critical facts and handles exceptions/corrections.
- Future community contribution is optional information maintenance, without a scheduled community phase or an initial dependency. No automatic outreach or particular crawler/platform implementation adopted.
- Private-record continuity and actual team verification capacity remain open. Existing evidence reused; no new participant study or measured product benefit claimed.
- Verification: UV_CACHE_DIR=/tmp/campus-agora-uv-cache bash scripts/ci/docs.sh and git diff --check passed. Documentation only; no runtime tests required. Changes remain local, uncommitted and not pushed.


### 2026-09-30 - Multi-session product references

- Read official Perplexity Projects, Zotero collections, Gemini Notebook and Notion Web Clipper documentation; appended facts, proposal and existing-tool substitution analysis to mentor-workflow-evidence.md; linked needs-analysis.md and overview.md.
- User proposed multiple sessions. Persistent exploration topics versus individual queries remain a design proposal, not fully approved functionality. No product hands-on trial or student efficacy claim.
- Verification: strict docs build and git diff --check passed after correcting section links. Documentation-only, local changes; no commit/push.


### 2026-10-01 - Competition demo value and bounded maintenance

- Updated AGENTS.md and product overview, needs-analysis, requirements, milestones and handoff (v0.9) to prioritize demonstrating relevant information discovery/organization; ongoing maintenance staffing and schedules are deferred rather than demo gates.
- Dated information remains useful for discovery with its time/use stated; historical recruitment is not current availability. Fixed specimens and executed automated collection remain distinct. No runtime work or effectiveness claims.
- Cleared obsolete maintenance-capacity prerequisite from current convergence todo. Long-term service remains conditional on demonstrated value and a later investment decision.
- Verification: UV_CACHE_DIR=/tmp/campus-agora-uv-cache bash scripts/ci/docs.sh and git diff --check passed. Local documentation changes only; not committed or pushed.


### 2026-10-01 - Requirements alignment for demo review

- Unified N01–N13 adoption states in requirements.md; retained multi-session structure as proposed. Added source-reusing alternative/increment conclusions to needs-analysis.md and task-based demo checks to requirements-handoff.md v0.10.
- Rewrote active milestone work order; P3 is the competition demo and continued service is conditional. Moved old AI-log research tasks into an explicitly conditional historical backlog; removed active maintenance timing/staffing gates from handoff and requirements sections.
- Synchronized overview and completeness conclusions. No fresh survey, user test, runtime implementation or claim that teammate review passed. Session organization and review remain open.
- Verification: UV_CACHE_DIR=/tmp/campus-agora-uv-cache bash scripts/ci/docs.sh and git diff --check passed; inspected remaining maintenance/gate wording. Fixed a documentation-site link warning by using a repository path for the non-published content specimen.
- All changes remain local; existing unrelated research edits and legacy HTML retained, no commit/push.


### 2026-10-01 - Actual discovery demo accepted; implementation layering proposed

- User accepted option B. Updated overview, requirements and handoff: actual external search/read/organization is required in addition to existing-data exploration; cached fallback is identified as such.
- Appended official Agent Skills and Anthropic workflow references plus proposed procedure/tool/data/topic separation to mentor-workflow-evidence.md. No skill, crawler, SDK or architecture chosen or implemented; multi-topic organization remains a recommendation.
- Verification: strict docs build and git diff --check passed. Local documentation only, no push.


### 2026-10-01 - Exploration and discovery decisions accepted

- User accepted multiple persistent exploration topics and existing-data reuse plus external search/read/organization. Synchronized overview, needs-analysis, requirements, handoff, milestones, workflow evidence and AGENTS.md; removed obsolete session-confirmation todo.
- No further product-direction decision identified as blocking requirements handoff. Providers, storage, interaction details and actual performance remain design/technical validation work; runtime is not implemented by this documentation change.
- Verification: strict docs build and git diff --check passed. Changes local, not committed/pushed.


### 2026-10-01 - Requirements analysis v1.0 consolidated

- Rewrote requirements-handoff.md into the standalone eight-part v1.0 baseline: broad user/tasks, evidence, alternatives, P/N needs, adopted scope, multi-topic/live-discovery workflow, demo acceptance and downstream unknowns. Retained nine direct evidence entries and research reading map; no new research or effectiveness claims.
- Replaced accumulated overview and requirements draft with concise current summary and v1.0 analysis contract/N01–N13 companion. needs-analysis.md remains detailed reasoning/history with original H/V definitions; prior convergence notes retained in its appendix.
- Synchronized docs index, MkDocs navigation, milestones, AGENTS and task-design status. Design v0.1 explicitly requires updating for multi-topic/live discovery; v1.0 is not teammate approval, runtime completion or sustainable supply validation.
- Verification: UV_CACHE_DIR=/tmp/campus-agora-uv-cache bash scripts/ci/docs.sh; git diff --check; checked eight headings, N01–N13 coverage, nine retained source rows and local links. All passed after EOF whitespace correction. Documentation only, no runtime tests applicable.
- Local only, not committed/pushed. Next: teammate review and task/information design based on v1.0; preserve unrelated existing edits and legacy untracked prototype.


### 2026-10-01 - Requirements v1.0 review and corrections

- Reviewed main analysis, detailed N table, overview, milestones, design draft and existing source records. Findings corrected: old design could imply fixed samples suffice and maintenance staffing precedes demo; live-discovery criterion did not explicitly require relevant source body/content; persistence boundary and independent topic edits were underspecified; N02/N09 attribution omitted direct user decisions.
- Updated requirements-handoff.md, requirements.md, advisor-task-design.md and milestones.md. Main v1.0 retained; changes clarify accepted behavior, not new implementation scope. Design still needs concrete multi-topic/live-discovery interaction work.
- Existing evidence counts and study boundaries checked against local research records, not fresh external source verification. No user effect or runtime check claimed.
- Verification: strict docs build, git diff --check, eight-part structure, N01–N13, nine source entries, local links and clarified acceptance checks passed. All changes local, no commit/push.


### 2026-10-01 - Publish requirements analysis v1.0 on PR 10

- Submitted the local v1.0 consolidation, including docs/product/advisor-task-design.md, onto branch docs/requirements-handoff for the existing requirements PR.
- Left tools/prototypes/opportunities.html untracked. No runtime code, dependency, or product-implementation files are in this publication.
- Peer review remains pending. Publication does not merge the PR, approve v1.0, or claim measured user benefit, completed P1 validation, or a finished supply pipeline.
- Verification: UV_CACHE_DIR=/tmp/campus-agora-uv-cache bash scripts/ci/docs.sh and git diff --check, recorded with this commit.
