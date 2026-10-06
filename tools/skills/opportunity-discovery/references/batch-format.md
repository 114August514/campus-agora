# Collected batch contract

Last updated: 2026-10-05

This repository draft is invoked by explicitly reading `tools/skills/opportunity-discovery/SKILL.md`; it has not been installed into an agent's automatic skill-discovery directory. Run commands below from the repository root.

The executable contract is `apps/web/src/lib/collected-batch.ts`. Real small examples are `apps/web/src/data/xhs-recruitment-2026-10-04.json` and `apps/web/src/data/xhs-recruitment-2026-10-05.json`. The latter includes a text post and an image-only post. Do not use their successful reads as proof that every site or later session works.

```text
version: 1
batchId: stable batch label
query: the search actually submitted
scope: sources and portions actually examined
collector: tool/workflow label, without personal account identifiers
completedAt: actual ISO timestamp
status: complete | partial | failed
warnings: incomplete reads and limits
advisors: Advisor[]
```

Each `Advisor` has `candidateId`, `name`, `institution`, `research`, `approach`, `participation`, `unknowns`, and `sources`. These are short source-backed explanations, not an inferred quality ranking. Do not invent a named candidate merely to fit this contract; unmatched leads can remain in the research result outside the integrated candidate batch.

Each source has `url`, `title`, `content`, `collectedAt`, `kind: "snapshot"` and:

```text
collection: {
  method: browser_dom | web_read,
  contentKind: summary | body,
  readStatus: partial | complete,
  scope: what was actually read,
  batchId: the enclosing batch's label
}
```

Optional fields: `publishedAt` (original visible label at collection time, including relative dates), `query`, `relevanceEvidence` (brief direct evidence, not invented quotations), and `unknowns`. For a context-dependent original link, `lookupUrl` gives a verified same-site search entry and `accessNote` explains the access result; `url` remains the original source identifier. A summary of a fully read page is still `contentKind: "summary"`; `complete` describes the stated reading scope, not certainty of its claims. Use `partial` if material relevant parts were not read. Old sources without collection metadata remain supported.

The batch excludes private topic reasons, student identities, credentials, access tokens and account exports. Links use normal HTTP(S), without embedded login information. In the pilot, the Xiaohongshu canonical post link could not open directly, while the title-search entry located the post. Record the observed lookup entry rather than inventing a working short link or exporting an access token.

For browser reads that also use rendered images, record the visual scope explicitly (for example, all three images or first image only). An image-only post must not become a completed text-body read merely because its title is available. Store a brief summary, not a copy of the original image or full post. Preserve each batch's captured time when combining batches; established candidate identity may recur with different dated sources. Conflicting names or institutions need review instead of automatic merging.

```bash
bun run discovery:validate apps/web/src/data/xhs-recruitment-2026-10-04.json
```

The command validates the structure and outputs a short count/scope result; it does not search the web, authenticate a browser, verify factual truth, or publish the batch. For a new demo batch, place the reviewed JSON under `apps/web/src/data/` and import it through `parseCollectedBatch` in `advisors.ts`. Integration reuses the existing detail and personal-save paths; it does not copy private notes into public data.
