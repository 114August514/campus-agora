//! Pure policy functions for the action/resource matrix in
//! `docs/architecture/auth-permissions.md`. Roles are not ordered; a decision
//! is the most permissive outcome across the actor's applicable matrix
//! columns (system role, `Author`, `Maintainer`).

use crate::roles::SystemRole;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Action {
    ReadPublicContent,
    ViewArchiveEntry,
    CreateOwnDraft,
    EditOwnDraft,
    MaintainOrganizationContent,
    PublishArchiveEntry,
    FileCorrection,
    ResolveCorrection,
    ReplyToDiscussion,
    AcceptAnswer,
    PromoteToArchive,
    ArchiveContent,
    ReportContent,
    ReviewReports,
    ChangeModerationState,
    ChangeRoles,
    ExportData,
}

/// Resource-scoped context for an authenticated user. The caller resolves
/// these flags against the concrete resource before asking for a decision.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct AuthenticatedActor {
    pub system_role: SystemRole,
    /// The actor created or owns the resource (`Author` resource role).
    pub is_resource_author: bool,
    /// The actor is an assigned `Maintainer` of the resource.
    pub is_assigned_maintainer: bool,
    /// The actor holds a verified membership in the resource's organization.
    pub is_organization_member: bool,
    /// The export target is the actor's own data.
    pub owns_exported_data: bool,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Actor {
    Guest,
    Authenticated(AuthenticatedActor),
}

/// `Conditional` mirrors the matrix cells whose extra requirements are owned
/// by a later milestone; runtime checks must treat it as denied until then.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PermissionDecision {
    Allow,
    Conditional,
    Deny,
}

impl PermissionDecision {
    fn strongest(self, other: Self) -> Self {
        match (self, other) {
            (Self::Allow, _) | (_, Self::Allow) => Self::Allow,
            (Self::Conditional, _) | (_, Self::Conditional) => Self::Conditional,
            _ => Self::Deny,
        }
    }
}

/// Matrix columns. `Author` and `Maintainer` are resource roles that combine
/// with the actor's system role column.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Column {
    Guest,
    Student,
    OrganizationMember,
    Author,
    Maintainer,
    Moderator,
    Admin,
}

impl Column {
    fn for_system_role(system_role: SystemRole) -> Self {
        match system_role {
            SystemRole::Student => Self::Student,
            SystemRole::OrganizationMember => Self::OrganizationMember,
            SystemRole::Moderator => Self::Moderator,
            SystemRole::Admin => Self::Admin,
        }
    }
}

pub fn decide(action: Action, actor: &Actor) -> PermissionDecision {
    match actor {
        Actor::Guest => cell(action, Column::Guest, None),
        Actor::Authenticated(context) => {
            let mut columns = vec![Column::for_system_role(context.system_role)];

            if context.is_resource_author {
                columns.push(Column::Author);
            }

            if context.is_assigned_maintainer {
                columns.push(Column::Maintainer);
            }

            columns
                .into_iter()
                .map(|column| cell(action, column, Some(context)))
                .fold(PermissionDecision::Deny, PermissionDecision::strongest)
        }
    }
}

pub fn is_allowed(action: Action, actor: &Actor) -> bool {
    decide(action, actor) == PermissionDecision::Allow
}

fn cell(
    action: Action,
    column: Column,
    context: Option<&AuthenticatedActor>,
) -> PermissionDecision {
    use Column::*;
    use PermissionDecision::*;

    match action {
        // Visibility of a specific entry is enforced by the repository query,
        // not here, so the read action itself is open.
        Action::ReadPublicContent | Action::ViewArchiveEntry => Allow,
        Action::CreateOwnDraft => match column {
            Guest => Deny,
            _ => Allow,
        },
        Action::EditOwnDraft => match column {
            Author | Maintainer | Moderator | Admin => Allow,
            _ => Deny,
        },
        Action::MaintainOrganizationContent => match column {
            OrganizationMember => allow_if(context.is_some_and(|c| c.is_organization_member)),
            Maintainer | Moderator | Admin => Allow,
            _ => Deny,
        },
        // An author may publish their own draft (resolved in M2.1). Publishing
        // organization-scoped content still depends on resource state no
        // milestone has modelled, so that column stays Conditional.
        Action::PublishArchiveEntry => match column {
            OrganizationMember => Conditional,
            Author | Maintainer | Moderator | Admin => Allow,
            _ => Deny,
        },
        Action::FileCorrection => match column {
            Guest => Deny,
            _ => Allow,
        },
        Action::ResolveCorrection => match column {
            Author | Maintainer | Moderator | Admin => Allow,
            _ => Deny,
        },
        // Anyone with a session may join a discussion. Whether the discussion
        // is visible and still open is resolved before this point.
        Action::ReplyToDiscussion => match column {
            Guest => Deny,
            _ => Allow,
        },
        // The asker plus the people who curate the thread. Not a moderation
        // power, so a bare Student or OrganizationMember column is Deny and
        // only the Author/Maintainer resource columns grant it.
        Action::AcceptAnswer => match column {
            Author | Maintainer | Moderator | Admin => Allow,
            _ => Deny,
        },
        // Promotion creates the promoter's own draft and never mutates the
        // source, so it carries the same bar as any other draft creation.
        // Reading the source is gated by visibility, not by this action.
        Action::PromoteToArchive => match column {
            Guest => Deny,
            _ => Allow,
        },
        // Retiring content leaves it readable and is reversible, so it sits
        // with the people who own or curate it rather than with moderation.
        Action::ArchiveContent => match column {
            Author | Maintainer | Moderator | Admin => Allow,
            _ => Deny,
        },
        // Whoever is affected must be able to raise it, so this needs only a
        // session — including from a moderator, who is also a campus member.
        Action::ReportContent => match column {
            Guest => Deny,
            _ => Allow,
        },
        // Moderation only, and pointedly not Author or Maintainer: a report
        // may be *about* the author, and the accused must not close the case.
        // Because columns combine as a union of grants, every other column has
        // to be Deny rather than relying on one of them being absent.
        Action::ReviewReports | Action::ChangeModerationState => match column {
            Moderator | Admin => Allow,
            _ => Deny,
        },
        Action::ChangeRoles => match column {
            Admin => Allow,
            _ => Deny,
        },
        Action::ExportData => match column {
            Student | OrganizationMember | Author => {
                allow_if(context.is_some_and(|c| c.owns_exported_data))
            }
            Admin => Allow,
            _ => Deny,
        },
    }
}

fn allow_if(condition: bool) -> PermissionDecision {
    if condition {
        PermissionDecision::Allow
    } else {
        PermissionDecision::Deny
    }
}
