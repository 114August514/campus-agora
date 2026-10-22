# API Contracts

Last updated: 2026-10-22

Campus Lumen uses `contracts/openapi.json` as the committed API contract
snapshot. The Rust API crate is the source of this contract.

After the 2026-10-22 project rename, metadata `appName` is `Campus Lumen` and
the OpenAPI title is `Campus Lumen API`. Regenerate both contract snapshots
from the Rust source. Endpoint paths, internal crate/package names and browser
storage identifiers retain compatibility.

## Generate

```bash
bun run api:types
```

This command exports OpenAPI from `crates/api` and regenerates
`packages/api-client/src/generated.ts`.

## Check

```bash
bun run api:check
```

CI runs this command to ensure generated files were committed. If it fails,
regenerate the contract and review the diff before committing.

## Rules

- Public endpoints must explicitly use `security: []` in the OpenAPI document.
- Business endpoints live under `/api/v1`.
- `/healthz`, `/readyz`, and OpenAPI tooling stay outside `/api/v1`.
- Errors use flat `ApiErrorResponse` fields:

  ```json
  {
    "code": "validation_failed",
    "message": "The request is invalid.",
    "requestId": "req_abc123",
    "details": {}
  }
  ```

  `details` is optional and must stay structured when present.

- Error codes use stable `snake_case` names.
- Frontend code imports API types through `@campus-agora/api-client`, not by
  reaching into generated internals.

## Live Discovery

`POST /api/v1/discoveries` is public (`security: []`). Its JSON body contains
only `query`, a nonempty public query of at most 200 characters. It accepts
either keywords or a single public HTTP(S) academic URL, subject to the same
source restrictions as search results. There is no separate URL field and no
browser-private reasons/preferences in the request.

```json
{"query": "机器学习"}
```

The generated `DiscoveryResponse` contains `query`, `provider`, `scope`,
`status`, `collectedAt`, `sources`, and `warnings`:

- `provider` is `duckduckgo_html`, `official_directory`, or `direct_url`.
  `official_directory` means
  search failed and the service performed live body matching against only
  Stanford AI Laboratory faculty and CMU Machine Learning core faculty.
  `direct_url` reads only the submitted page without sending the URL to
  DuckDuckGo or falling back to another source when reading fails.
  `scope` describes the actual range in Chinese.
- HTTP 200 represents a completed attempt; `status` is `complete`, `partial`,
  or `failed`, so HTTP success alone does not establish successful discovery.
  A readable directory with no matching passage returns an explicit
  `directory_no_matches` warning and no sources.
- Each `DiscoverySource` keeps `url`, `title`, source-hostname `institution`,
  fetched `content`, separate `searchSnippet`, `relevanceEvidence`, ISO
  `collectedAt`, optional original `publishedAt` metadata, and `unknowns`.
  The hostname is not verified affiliation; the passages are body matches,
  not model judgments or automatic identification of an advisor. Direct URL
  reading has no search snippet or keyword-matching passages; the body is
  available for the user to examine before associating it with a candidate.
- Each `DiscoveryWarning` keeps a stable `code`, readable `message`, and
  optional failed-source `url`. Search failure remains visible after a
  successful directory fallback. Unsupported pages are not substituted with
  snippets or demonstration snapshots.

Invalid input returns HTTP 422 `validation_failed`; a third concurrent
discovery request returns 429 `discovery_busy`; the existing request-body
limit returns 413 `request_body_too_large`. These use `ApiErrorResponse` and
the request ID. Reading limits and allowed destinations are documented in
[Backend](backend.md) and [Security](../operations/security.md).
