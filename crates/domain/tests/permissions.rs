use campus_agora_domain::{
    decide, is_allowed, Action, Actor, AuthenticatedActor, PermissionDecision, SystemRole,
};

fn actor(system_role: SystemRole) -> AuthenticatedActor {
    AuthenticatedActor {
        system_role,
        is_resource_author: false,
        is_assigned_maintainer: false,
        is_organization_member: false,
        owns_exported_data: false,
    }
}

fn authenticated(actor: AuthenticatedActor) -> Actor {
    Actor::Authenticated(actor)
}

#[test]
fn read_public_content_is_allowed_for_everyone() {
    assert_eq!(
        decide(Action::ReadPublicContent, &Actor::Guest),
        PermissionDecision::Allow
    );

    for system_role in [
        SystemRole::Student,
        SystemRole::OrganizationMember,
        SystemRole::Moderator,
        SystemRole::Admin,
    ] {
        assert_eq!(
            decide(
                Action::ReadPublicContent,
                &authenticated(actor(system_role))
            ),
            PermissionDecision::Allow
        );
    }
}

#[test]
fn create_own_draft_requires_an_authenticated_role() {
    assert_eq!(
        decide(Action::CreateOwnDraft, &Actor::Guest),
        PermissionDecision::Deny
    );

    for system_role in [
        SystemRole::Student,
        SystemRole::OrganizationMember,
        SystemRole::Moderator,
        SystemRole::Admin,
    ] {
        assert_eq!(
            decide(Action::CreateOwnDraft, &authenticated(actor(system_role))),
            PermissionDecision::Allow
        );
    }
}

#[test]
fn edit_own_draft_requires_author_maintainer_or_oversight_role() {
    assert_eq!(
        decide(Action::EditOwnDraft, &Actor::Guest),
        PermissionDecision::Deny
    );
    assert_eq!(
        decide(
            Action::EditOwnDraft,
            &authenticated(actor(SystemRole::Student))
        ),
        PermissionDecision::Deny
    );
    assert_eq!(
        decide(
            Action::EditOwnDraft,
            &authenticated(actor(SystemRole::OrganizationMember))
        ),
        PermissionDecision::Deny
    );

    let student_author = AuthenticatedActor {
        is_resource_author: true,
        ..actor(SystemRole::Student)
    };
    assert_eq!(
        decide(Action::EditOwnDraft, &authenticated(student_author)),
        PermissionDecision::Allow
    );

    let assigned_maintainer = AuthenticatedActor {
        is_assigned_maintainer: true,
        ..actor(SystemRole::Student)
    };
    assert_eq!(
        decide(Action::EditOwnDraft, &authenticated(assigned_maintainer)),
        PermissionDecision::Allow
    );

    assert_eq!(
        decide(
            Action::EditOwnDraft,
            &authenticated(actor(SystemRole::Moderator))
        ),
        PermissionDecision::Allow
    );
    assert_eq!(
        decide(
            Action::EditOwnDraft,
            &authenticated(actor(SystemRole::Admin))
        ),
        PermissionDecision::Allow
    );
}

#[test]
fn maintain_organization_content_requires_membership_or_assignment() {
    assert_eq!(
        decide(Action::MaintainOrganizationContent, &Actor::Guest),
        PermissionDecision::Deny
    );

    let member_in_organization = AuthenticatedActor {
        is_organization_member: true,
        ..actor(SystemRole::OrganizationMember)
    };
    assert_eq!(
        decide(
            Action::MaintainOrganizationContent,
            &authenticated(member_in_organization)
        ),
        PermissionDecision::Allow
    );

    let member_outside_organization = actor(SystemRole::OrganizationMember);
    assert_eq!(
        decide(
            Action::MaintainOrganizationContent,
            &authenticated(member_outside_organization)
        ),
        PermissionDecision::Deny
    );

    let student_with_membership_flag = AuthenticatedActor {
        is_organization_member: true,
        ..actor(SystemRole::Student)
    };
    assert_eq!(
        decide(
            Action::MaintainOrganizationContent,
            &authenticated(student_with_membership_flag)
        ),
        PermissionDecision::Deny
    );

    let author_only = AuthenticatedActor {
        is_resource_author: true,
        ..actor(SystemRole::Student)
    };
    assert_eq!(
        decide(
            Action::MaintainOrganizationContent,
            &authenticated(author_only)
        ),
        PermissionDecision::Deny
    );

    let assigned_maintainer = AuthenticatedActor {
        is_assigned_maintainer: true,
        ..actor(SystemRole::Student)
    };
    assert_eq!(
        decide(
            Action::MaintainOrganizationContent,
            &authenticated(assigned_maintainer)
        ),
        PermissionDecision::Allow
    );

    assert_eq!(
        decide(
            Action::MaintainOrganizationContent,
            &authenticated(actor(SystemRole::Moderator))
        ),
        PermissionDecision::Allow
    );
    assert_eq!(
        decide(
            Action::MaintainOrganizationContent,
            &authenticated(actor(SystemRole::Admin))
        ),
        PermissionDecision::Allow
    );
}

#[test]
fn publish_archive_entry_is_conditional_for_members_and_authors() {
    assert_eq!(
        decide(Action::PublishArchiveEntry, &Actor::Guest),
        PermissionDecision::Deny
    );
    assert_eq!(
        decide(
            Action::PublishArchiveEntry,
            &authenticated(actor(SystemRole::Student))
        ),
        PermissionDecision::Deny
    );

    let organization_member = AuthenticatedActor {
        is_organization_member: true,
        ..actor(SystemRole::OrganizationMember)
    };
    assert_eq!(
        decide(
            Action::PublishArchiveEntry,
            &authenticated(organization_member)
        ),
        PermissionDecision::Conditional
    );

    let author = AuthenticatedActor {
        is_resource_author: true,
        ..actor(SystemRole::Student)
    };
    assert_eq!(
        decide(Action::PublishArchiveEntry, &authenticated(author)),
        PermissionDecision::Conditional
    );

    let assigned_maintainer = AuthenticatedActor {
        is_assigned_maintainer: true,
        ..actor(SystemRole::Student)
    };
    assert_eq!(
        decide(
            Action::PublishArchiveEntry,
            &authenticated(assigned_maintainer)
        ),
        PermissionDecision::Allow
    );

    assert_eq!(
        decide(
            Action::PublishArchiveEntry,
            &authenticated(actor(SystemRole::Moderator))
        ),
        PermissionDecision::Allow
    );
    assert_eq!(
        decide(
            Action::PublishArchiveEntry,
            &authenticated(actor(SystemRole::Admin))
        ),
        PermissionDecision::Allow
    );
}

#[test]
fn conditional_decisions_are_denied_at_runtime() {
    let author = AuthenticatedActor {
        is_resource_author: true,
        ..actor(SystemRole::Student)
    };

    assert_eq!(
        decide(Action::PublishArchiveEntry, &authenticated(author.clone())),
        PermissionDecision::Conditional
    );
    assert!(!is_allowed(
        Action::PublishArchiveEntry,
        &authenticated(author)
    ));
}

#[test]
fn change_moderation_state_is_limited_to_moderation_roles() {
    let author_and_maintainer = AuthenticatedActor {
        is_resource_author: true,
        is_assigned_maintainer: true,
        ..actor(SystemRole::Student)
    };

    assert_eq!(
        decide(Action::ChangeModerationState, &Actor::Guest),
        PermissionDecision::Deny
    );
    assert_eq!(
        decide(
            Action::ChangeModerationState,
            &authenticated(author_and_maintainer)
        ),
        PermissionDecision::Deny
    );
    assert_eq!(
        decide(
            Action::ChangeModerationState,
            &authenticated(actor(SystemRole::OrganizationMember))
        ),
        PermissionDecision::Deny
    );
    assert_eq!(
        decide(
            Action::ChangeModerationState,
            &authenticated(actor(SystemRole::Moderator))
        ),
        PermissionDecision::Allow
    );
    assert_eq!(
        decide(
            Action::ChangeModerationState,
            &authenticated(actor(SystemRole::Admin))
        ),
        PermissionDecision::Allow
    );
}

#[test]
fn change_roles_is_admin_only() {
    let moderator_with_all_flags = AuthenticatedActor {
        is_resource_author: true,
        is_assigned_maintainer: true,
        is_organization_member: true,
        owns_exported_data: true,
        ..actor(SystemRole::Moderator)
    };

    assert_eq!(
        decide(Action::ChangeRoles, &Actor::Guest),
        PermissionDecision::Deny
    );
    assert_eq!(
        decide(
            Action::ChangeRoles,
            &authenticated(moderator_with_all_flags)
        ),
        PermissionDecision::Deny
    );
    assert_eq!(
        decide(
            Action::ChangeRoles,
            &authenticated(actor(SystemRole::Admin))
        ),
        PermissionDecision::Allow
    );
}

#[test]
fn export_data_is_own_data_only_except_for_admin() {
    assert_eq!(
        decide(Action::ExportData, &Actor::Guest),
        PermissionDecision::Deny
    );

    let student_own_data = AuthenticatedActor {
        owns_exported_data: true,
        ..actor(SystemRole::Student)
    };
    assert_eq!(
        decide(Action::ExportData, &authenticated(student_own_data)),
        PermissionDecision::Allow
    );
    assert_eq!(
        decide(
            Action::ExportData,
            &authenticated(actor(SystemRole::Student))
        ),
        PermissionDecision::Deny
    );

    let member_own_data = AuthenticatedActor {
        owns_exported_data: true,
        ..actor(SystemRole::OrganizationMember)
    };
    assert_eq!(
        decide(Action::ExportData, &authenticated(member_own_data)),
        PermissionDecision::Allow
    );

    let author_own_data = AuthenticatedActor {
        is_resource_author: true,
        owns_exported_data: true,
        ..actor(SystemRole::Student)
    };
    assert_eq!(
        decide(Action::ExportData, &authenticated(author_own_data)),
        PermissionDecision::Allow
    );

    let moderator_own_data = AuthenticatedActor {
        owns_exported_data: true,
        ..actor(SystemRole::Moderator)
    };
    assert_eq!(
        decide(Action::ExportData, &authenticated(moderator_own_data)),
        PermissionDecision::Deny
    );

    assert_eq!(
        decide(Action::ExportData, &authenticated(actor(SystemRole::Admin))),
        PermissionDecision::Allow
    );
}

#[test]
fn is_allowed_matches_allow_decisions_only() {
    assert!(is_allowed(Action::ReadPublicContent, &Actor::Guest));
    assert!(!is_allowed(Action::CreateOwnDraft, &Actor::Guest));
    assert!(is_allowed(
        Action::ChangeRoles,
        &authenticated(actor(SystemRole::Admin))
    ));
}
