# Opportunity content prototype

Last updated: 2026-09-27

Delivery status: this documentation handoff includes `opportunity-content.md` and this README. The historical `opportunities.html` remains local and is not included in the PR. The preview instructions and functional checks below describe that historical local artifact, not functionality shipped by this PR. Start with the text specimen for peer review.

Visual status: superseded by `docs/product/ui-system.md`. Its custom CSS, bordered cards, eyebrow and subtitle are not approved patterns for future UI. Retain this file only for content/interaction reference until Primer migration.

`opportunities.html` is a standalone P1 content prototype, separate from the production Web application. Its temporary display name is “启程”; this does not rename the project. No dependencies or build step are required.

From the repository root:

```bash
python -m http.server 8765 --bind 127.0.0.1 --directory tools/prototypes
```

Open `http://127.0.0.1:8765/opportunities.html`. The server exposes only this prototype directory on the local machine. Stop it with Ctrl+C.

## Current text specimen

[opportunity-content.md](opportunity-content.md) contains source-backed Chinese text specimens: cross-institution research-program comparison, a Xingce entry lookup, and an existing-candidate comparison of MPK versus Clearblue research questions. It requires no server or UI dependency. This is a content-only P1 review artifact; it does not migrate or approve the legacy HTML styling.

The specimens deliberately end at different depths. Research conditions do not establish individual fit, team experience or an AI/software mentor shortlist. The entry lookup does not establish access to QR destination, current seats or completed registration. Formal content-review findings are in `docs/product/needs-analysis.md` section 8.

## Content and scope

Six curated records come from `docs/constraints/opportunity-needs-map.md` and `docs/constraints/aids-mentor-research.md`: two research leads, a career simulation, a historical competition, compute and literature resources. Dates/statuses are static snapshots, not live availability. Each record links to its source. The sparse second research profile intentionally retains missing information rather than inventing comparability.

Implemented: sample search/type filtering, empty state/reset, selection/comparison, detail/preparation, related resource navigation, source links, saved candidates, explicit personal note saving, next-step recording/removal. Records persist in this browser's local storage, without upload or cross-device sync. Removing a candidate retains its note. Comparison selection is temporary. An unsaved note can be lost when leaving its detail; use “保存笔记” first.

Not implemented: broad source collection, automatic updates, notification delivery, automated judgments, editable research/employment preference, approval/application handling or a maintained backend. The prototype demonstrates selected N01–N09 interactions, not their complete acceptance. N10–N12 are not implemented. It cannot establish user benefit or supply maintenance cost.

## Review tasks

1. Compare the two research leads and identify differences and unknowns.
2. Open the first lead, inspect optional preparation and follow its compute resource. Distinguish a resource entry from confirmed personal access.
3. Save a reason and next step, reload, and recover them under “我的候选”.
4. Search an absent term and reset. Open the competition and identify its historical status.
5. Open the career simulation and identify why it is not an internship.
6. At 390px width, review list/detail navigation. The comparison table intentionally scrolls horizontally.

Verification on 2026-09-24: Playwright with the installed Chromium exercised these major interactions, reload persistence, escaped note text and narrow-screen list/detail overflow; no page errors. Desktop and mobile screenshots inspected. This is functional verification, not participant testing. Initial browser launch encountered a missing default runtime; checks passed using installed Chromium 1228. No production code changed.
