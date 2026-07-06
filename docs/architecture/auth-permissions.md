# Authentication And Permissions

Campus Agora will support real campus identity later. M0.2 defines the provider
and permission boundaries before runtime implementation.

## Auth Providers

Provider implementations should fit behind an auth provider abstraction:

- `MockCampusAuthProvider`: local development, CI, demos, and tests.
- `CampusSsoAuthProvider`: future CAS or SSO integration.
- `CampusOidcAuthProvider`: future OAuth/OIDC integration.

Real provider integration must not rewrite business permissions. It should only
change how an authenticated session is established.

## Session Rules

- Public endpoints explicitly declare that they do not require auth.
- Protected endpoints require a backend session or bearer-token strategy.
- Long-lived tokens must not be stored in WebView localStorage.
- Logout must clear client state and invalidate server-side session material
  when that feature exists.

## Roles

System roles:

- `Guest`: unauthenticated reader.
- `Student`: authenticated campus user.
- `Moderator`: content safety reviewer.
- `Admin`: operational administrator.

Resource roles:

- `Author`: creator or owner of a resource.
- `OrganizationMember`: member acting in an organization context.
- `Maintainer`: trusted editor for archive quality.

Roles are not ordered. Avoid language like "role and above." Use an
action/resource matrix.

## Permission Matrix

| Action | Guest | Student | Author | Maintainer | Moderator | Admin |
| --- | --- | --- | --- | --- | --- | --- |
| Read public content | Allow | Allow | Allow | Allow | Allow | Allow |
| Create own draft | Deny | Allow | Allow | Allow | Allow | Allow |
| Edit own draft | Deny | Deny | Allow | Allow if assigned | Allow | Allow |
| Publish archive entry | Deny | Deny | Conditional | Allow | Allow | Allow |
| Change moderation state | Deny | Deny | Deny | Deny | Allow | Allow |
| Change roles | Deny | Deny | Deny | Deny | Deny | Allow |
| Export data | Deny | Own data only | Own data only | Deny | Deny | Allow |

Each future endpoint must define the action it checks and the resource context
needed for the decision.

## Anonymous Semantics

Anonymous display can hide identity from ordinary readers. It must not prevent
authorized moderation and audit review. Anonymous content still needs an
auditable account linkage with access limited by policy.

## Audit Requirements

Create audit events for:

- Login and logout once auth exists.
- Role or permission changes.
- Content deletion and restoration.
- Data export.
- Moderation state changes.
- System configuration changes.
- Security or abuse-response actions.

Audit events must not store raw secrets, bearer tokens, or raw campus identity
assertions.
