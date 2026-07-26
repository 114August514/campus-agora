# Authentication And Permissions

Last updated: 2026-07-26

Campus Agora will support real campus identity later. M0.2 defined the provider
and permission boundaries; M1 implements the mock provider, session lifecycle,
and permission policy checks behind those boundaries.

## Auth Providers

Provider implementations fit behind the `AuthProvider` abstraction in
`crates/application`:

- `MockCampusAuthProvider`: local development, CI, demos, and tests.
  Implemented in M1.
- `CampusSsoAuthProvider`: future CAS or SSO integration.
- `CampusOidcAuthProvider`: future OAuth/OIDC integration.

Real provider integration must not rewrite business permissions. It should only
change how an authenticated session is established.

### Mock Campus Provider

`MockCampusAuthProvider` verifies fixed demo personas instead of free-form
identity input: `student`, `organization_member`, `moderator`, and `admin`.
Each persona maps to a deterministic provider subject and display name; the
`organization_member` persona also provisions a demo organization
(`demo-student-union`) and a verified membership. Users are stored by
`(auth_provider, provider_subject_hash)`; raw provider subjects are hashed
with SHA-256 before persistence.

The mock login endpoint is controlled by `AUTH_MOCK_ENABLED`. When the flag is
off the endpoint answers `403` with error code `auth_mock_disabled`.

## Session Rules

- Public endpoints explicitly declare that they do not require auth.
- Protected endpoints require a backend session or bearer-token strategy.
- Long-lived tokens must not be stored in WebView localStorage.
- Logout must clear client state and invalidate server-side session material
  when that feature exists.

### M1 Session Implementation

- Login issues an opaque 256-bit random session token. The API returns it to
  the client exactly once; the backend stores only the SHA-256 hash together
  with `expires_at` and `revoked_at`.
- Sessions expire after `SESSION_TTL_SECONDS` (default 86400 seconds). Expired
  or revoked sessions resolve to `401 unauthorized`.
- Clients send the token as `Authorization: Bearer <token>`. Cookie/session
  mode and CSRF design stay out of scope until a real campus provider needs
  them.
- Web and Tauri WebView store the token in tab-scoped `sessionStorage`, never
  in `localStorage`. Closing the tab or window drops the token; the server
  session then ages out through its expiry.
- Logout revokes the server-side session record and clears the client-side
  token.

### M1 Auth Endpoints

- `POST /api/v1/auth/mock-login` (public, feature-flagged): verifies a persona
  and returns `token`, `expiresAt`, and the current user.
- `GET /api/v1/auth/session` (bearer): returns the authenticated user and the
  session expiry.
- `POST /api/v1/auth/logout` (bearer): revokes the current session and answers
  `204`.

When `DATABASE_URL` is configured the auth runtime persists users, sessions,
organizations, memberships, and audit events in PostgreSQL. Without it the API
falls back to an in-memory store for local development and integration tests;
in-memory state is lost on restart and must never be used in production.

## Roles

System/user roles:

- `Guest`: unauthenticated reader.
- `Student`: authenticated campus user.
- `OrganizationMember`: authenticated campus user acting within a verified
  organization membership context.
- `Moderator`: content safety reviewer.
- `Admin`: operational administrator.

Resource roles:

- `Author`: creator or owner of a resource.
- `Maintainer`: trusted editor for archive quality.

Roles are not ordered. Avoid language like "role and above." Use an
action/resource matrix.

## Permission Matrix

| Action | Guest | Student | OrganizationMember | Author | Maintainer | Moderator | Admin |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Read public content | Allow | Allow | Allow | Allow | Allow | Allow | Allow |
| View archive entry | Allow | Allow | Allow | Allow | Allow | Allow | Allow |
| Create own draft | Deny | Allow | Allow | Allow | Allow | Allow | Allow |
| Edit own draft | Deny | Deny | Deny | Allow | Allow if assigned | Allow | Allow |
| Maintain organization content | Deny | Deny | Allow if member | Deny | Allow if assigned | Allow | Allow |
| Publish archive entry | Deny | Deny | Conditional | Allow | Allow | Allow | Allow |
| File correction | Deny | Allow | Allow | Allow | Allow | Allow | Allow |
| Resolve correction | Deny | Deny | Deny | Allow | Allow if assigned | Allow | Allow |
| Change moderation state | Deny | Deny | Deny | Deny | Deny | Allow | Allow |
| Change roles | Deny | Deny | Deny | Deny | Deny | Deny | Allow |
| Export data | Deny | Own data only | Own data only | Own data only | Deny | Deny | Allow |

`View archive entry` is `Allow` for everyone on purpose: whether a *particular*
entry is visible is decided by the repository query (published, or owned,
maintained, or moderated by the caller), so encoding visibility in the matrix
as well would put the same rule in two places that can drift. An entry the
caller may not see returns `404`, never `403`.

`Publish archive entry` was `Conditional` for `Author` until M2.1, which
resolved the condition as "an author may publish their own draft". The
`OrganizationMember` column stays `Conditional` because organization-scoped
entries are not modelled yet, and `is_allowed` therefore denies it.

Each future endpoint must define the action it checks and the resource context
needed for the decision.

M1 implements this matrix as pure policy functions in `crates/domain`
(`Action`, `Actor`, `decide`, `is_allowed`) with tests per cell. Cells marked
`Conditional` return a dedicated `Conditional` decision and are denied at
runtime until the owning milestone (M2+) binds the missing resource state.
"Allow if member/assigned" and "own data only" cells resolve from explicit
actor context flags supplied by the caller.

### How Columns Combine

An actor can match several columns at once: their system role, plus `Author`
and `Maintainer` when they hold that resource role. The decision is the **union
of grants** — the most permissive matching column wins. This is what makes
"Edit own draft" work: a `Student` is denied by their system-role column but
allowed by the `Author` column, and the author grant is the intended outcome.

The consequence is that a `Deny` cell means "this column alone does not grant
the action", not "this column revokes the action". A `Deny` can never take a
capability away from another column. For example a `Moderator` who is also the
`Author` of the data being exported is allowed to export it, because the
`Author` column grants "own data only" — the `Moderator` column's `Deny` only
means moderation status by itself confers no export right.

If a future action needs a role to genuinely *revoke* a capability, that needs
an explicit mechanism rather than a `Deny` cell, and this section must be
updated at the same time.

## Anonymous Semantics

Anonymous display can hide identity from ordinary readers. It must not prevent
authorized moderation and audit review. Anonymous content still needs an
auditable account linkage with access limited by policy.

## Audit Requirements

Create audit events for:

- Login and logout once auth exists. M1 records `auth.login` and `auth.logout`
  with the acting user, the session resource id, the provider name, and the
  request id; never the token or its hash preimage.
- Role or permission changes.
- Content deletion and restoration.
- Data export.
- Moderation state changes.
- System configuration changes.
- Security or abuse-response actions.

Audit events must not store raw secrets, bearer tokens, or raw campus identity
assertions.
