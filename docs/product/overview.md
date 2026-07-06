# Product Overview

Campus Agora is a campus discussion and knowledge archive platform. It turns
useful discussion into durable, searchable knowledge while keeping moderation,
privacy, and permissions explicit.

## MVP Scope

The first product scope is a trusted campus knowledge loop:

- Students can discover discussion and knowledge entries.
- Authenticated users can create discussion and knowledge drafts.
- Maintainers can refine high-signal discussion into archive entries.
- Moderators can review risky content and manage visibility.
- The system records sensitive actions for later audit.

M0.2 does not implement these flows. It defines the boundaries that future
milestones must follow.

## Non-Goals

These are outside the initialization phase:

- Real campus SSO integration.
- Production moderation console.
- AI-generated archive publication without human review.
- Public file hosting or attachment uploads.
- Full-text search tuning.
- Production backup automation, alerting, and incident tooling.
- Tauri auto-update and signed release distribution.

## User Roles

- `Guest`: unauthenticated reader. Can access public content only.
- `Student`: authenticated campus user. Can create and manage own content.
- `OrganizationMember`: student acting within a campus organization context.
- `Moderator`: trusted reviewer for content state and safety decisions.
- `Admin`: operational administrator for system configuration and high-risk
  recovery actions.

Roles are not a global hierarchy. Permission checks depend on action, resource,
resource state, ownership, organization membership, and system role.

## Core Workflows

1. Discussion starts as a question, correction, or experience report.
2. Contributors add replies, references, and clarifications.
3. A maintainer or moderator identifies durable knowledge.
4. The durable version is archived with tags, sources, and revision history.
5. Later corrections update the archive while preserving previous versions.

## Admin Boundary

Administration exists to protect the community and system integrity. It is not a
shortcut around product rules.

High-risk admin actions require backend permission checks and audit events:

- Role or permission changes.
- Content removal, restoration, or state override.
- Data export.
- System configuration change.
- Security response or abuse mitigation.

## Success Metrics

Early product metrics should stay simple:

- Useful archive entries created from discussion.
- Correction turnaround time.
- Content reports resolved.
- Search or navigation success in demos.
- Percentage of high-risk actions with audit records.

Metrics must not require collecting unnecessary personal data.
